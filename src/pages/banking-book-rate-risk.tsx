import { useCallback, useMemo, useState } from "react";
import {
  APPROVED,
  ASSUMPTION_KEYS,
  AS_OF,
  BALANCE_SHEET,
  ENTITIES,
  LIMITS,
  TIER1,
  buildView,
  type AssumptionKey,
  type Assumptions,
  type BucketId,
  type Entity,
  type Horizon,
  type ScenarioId,
} from "../components/banking-book-rate-risk/model";
import { dateLong, gbpBn, pct, pctSigned } from "../components/banking-book-rate-risk/format";
import { MicroLabel, Seg, SelectField, StatusChip } from "../components/banking-book-rate-risk/ui";
import { ScenarioStrip } from "../components/banking-book-rate-risk/ScenarioStrip";
import { AssumptionsRail, type SliderDelta } from "../components/banking-book-rate-risk/AssumptionsRail";
import { LadderCard, NiiCard, WaterfallCard } from "../components/banking-book-rate-risk/charts";
import { HedgeTable, LimitsTable } from "../components/banking-book-rate-risk/Tables";

export const title = "Banking Book Rate Risk";
export const fullWidth = true;

/* Banking Book Rate Risk — "How exposed are earnings and economic value to
 * rate moves, and are we inside the outlier limit?"
 *
 * For the ALCO of a UK bank, as of Mon 21 Sep 2026 close. An assumption-
 * driven workbench rather than a KPI grid: the six Basel standardised
 * shocks run as a strip of selectable cards across the top (ΔEVE against
 * Tier 1, ΔNII over the chosen horizon, outlier status); the selected shock
 * drives a ~70% main canvas of three chart cards (repricing gap ladder,
 * month-by-month NII against base, ΔEVE waterfall by bucket) beside a
 * sticky right rail of five behavioural sliders that recompute every
 * figure live and report their own contribution against the ALCO-approved
 * set. The hedge programme and the limits table close the page. Every
 * number is derived by one `buildView(entity, horizon, assumptions)` in
 * components/banking-book-rate-risk/model.ts, so cards, charts, rail
 * deltas and tables always agree. */

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: "12", label: "12m" },
  { value: "24", label: "24m" },
  { value: "36", label: "36m" },
];

export default function BankingBookRateRiskPage() {
  const [entity, setEntity] = useState<Entity>("group");
  const [horizon, setHorizon] = useState<Horizon>("12");
  const [assumptions, setAssumptions] = useState<Assumptions>(APPROVED);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("par_up");
  const [focus, setFocus] = useState<BucketId | null>(null);

  const view = useMemo(() => buildView(entity, horizon, assumptions), [entity, horizon, assumptions]);
  const approvedView = useMemo(() => buildView(entity, horizon, APPROVED), [entity, horizon]);
  const scenario = view.scenarios.find((s) => s.id === scenarioId) ?? view.scenarios[0];

  /* Each slider's own contribution: the selected scenario now, less the
   * same scenario with only that slider put back to its approved value. */
  const deltas = useMemo(() => {
    const cur = view.scenarios.find((s) => s.id === scenarioId) ?? view.scenarios[0];
    return Object.fromEntries(
      ASSUMPTION_KEYS.map((k) => {
        if (assumptions[k] === APPROVED[k]) return [k, { eve: 0, nii: 0 }];
        const alt = buildView(entity, horizon, { ...assumptions, [k]: APPROVED[k] });
        const s = alt.scenarios.find((x) => x.id === cur.id) ?? alt.scenarios[0];
        return [k, { eve: cur.dEve - s.dEve, nii: cur.dNii - s.dNii }];
      }),
    ) as Record<AssumptionKey, SliderDelta>;
  }, [view, entity, horizon, assumptions, scenarioId]);

  const setAssumption = useCallback((k: AssumptionKey, v: number) => setAssumptions((a) => ({ ...a, [k]: v })), []);
  const resetAssumptions = useCallback(() => setAssumptions(APPROVED), []);
  const onFocus = useCallback((b: BucketId | null) => setFocus(b), []);
  const clearFocus = useCallback(() => setFocus(null), []);
  const dirty = ASSUMPTION_KEYS.some((k) => assumptions[k] !== APPROVED[k]);

  const { worst } = view;
  const outlierStatus = view.outlierBreach ? "bad" : worst.status;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Dashboards · Treasury &amp; ALM · As of {dateLong(AS_OF)} close
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Banking Book Rate Risk</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              How exposed are earnings and economic value to rate moves, and are we inside the outlier limit?
              IRRBB for {view.entityLabel}: {gbpBn(BALANCE_SHEET.assets)} of assets, Tier 1 {gbpBn(TIER1)}.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2" role="group" aria-label="Page filters">
            <div className="hidden text-right xl:block">
              <MicroLabel>Outlier test</MicroLabel>
              <div className="mt-1 flex items-center justify-end gap-2">
                <StatusChip
                  status={outlierStatus}
                  label={view.outlierBreach ? "Breached" : outlierStatus === "warn" ? "Early warning" : "Passed"}
                />
                <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                  worst {worst.label} {pctSigned(worst.dEvePct)}
                </span>
              </div>
            </div>
            <SelectField<Entity>
              id="bb-entity"
              label="Entity"
              value={entity}
              onChange={setEntity}
              options={ENTITIES.map((e) => ({ value: e.id, label: e.label }))}
            />
            <Seg<Horizon> label="NII horizon" value={horizon} onChange={setHorizon} options={HORIZONS} />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4 lg:p-5">
          {/* Row 1: the six Basel shocks */}
          <section aria-labelledby="bb-shocks-title">
            <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h2 id="bb-shocks-title" className="text-sm font-semibold text-neutral-900">
                  Basel standardised shocks
                </h2>
                <p className="mt-0.5 max-w-4xl text-[11px] text-neutral-500">
                  Select a shock to drive the charts, the rail deltas and the limits row. ΔEVE status: outlier at a
                  loss of {pct(LIMITS.outlier, 0)} of Tier 1 or more, early warning above {pct(LIMITS.early, 0)},
                  internal limit {pct(LIMITS.internal, 0)}. Meters run 0–20% with marks at 10, 12 and 15.
                  {dirty && " Cards show the approved-set result underneath while the assumptions are modified."}
                </p>
              </div>
              <p className="text-[11px] text-neutral-500">
                Worst case <span className="font-medium text-neutral-800">{worst.label}</span>{" "}
                <span className="font-mono tabular-nums">{pctSigned(worst.dEvePct)}</span> of Tier 1
              </p>
            </div>
            <ScenarioStrip
              scenarios={view.scenarios}
              approved={approvedView.scenarios}
              selected={scenario.id}
              onSelect={setScenarioId}
              months={view.months}
              dirty={dirty}
            />
          </section>

          {/* Row 2: main canvas (70%) + sticky assumptions rail (30%) */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-10">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-7">
              <LadderCard view={view} focus={focus} onFocus={onFocus} />
              <NiiCard view={view} scenario={scenario} />
              <WaterfallCard scenario={scenario} focus={focus} />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <div className="xl:sticky xl:top-0">
                <AssumptionsRail
                  value={assumptions}
                  onChange={setAssumption}
                  onReset={resetAssumptions}
                  deltas={deltas}
                  scenario={scenario}
                  view={view}
                  approvedView={approvedView}
                />
              </div>
            </div>
          </div>

          {/* Row 3: hedge programme and limits */}
          <section aria-labelledby="bb-row3-title">
            <div className="mb-2.5">
              <h2 id="bb-row3-title" className="text-sm font-semibold text-neutral-900">
                Hedge programme and limits
              </h2>
              <p className="mt-0.5 max-w-4xl text-[11px] text-neutral-500">
                Click a bucket in the gap ladder to scope the hedge table to the swaps repricing there; click a ΔEVE
                row in the limits table to select that scenario.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <HedgeTable view={view} focus={focus} onClearFocus={clearFocus} />
              <LimitsTable view={view} selected={scenario.id} onSelect={setScenarioId} />
            </div>
          </section>

          <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
            <p>
              EVE is the present value of notional repricing cash flows under the base SONIA/gilt curve and under
              each shocked curve, on a run-off balance sheet and excluding commercial margins; ΔEVE is shown against
              Tier 1 of {gbpBn(TIER1)}. Core non-maturity deposits are spread evenly to their behavioural life and
              the non-core share reprices overnight; fixed mortgages prepay at the CPR; the committed pipeline is
              slotted at the offer fix. NII is a {view.months}-month simulation on a constant balance sheet: each
              tranche re-fixes at base plus the shock at its reference tenor when it reprices, savings pass the move
              through at the deposit beta on the core and in full on the non-core, current accounts are
              non-interest-bearing in both directions and administered rates floor at zero; ΔNII is expressed
              against group NII. Shocks follow the Basel IRRBB standardised shapes with an illustrative GBP
              calibration (parallel ±200bp, short ±250bp decaying with a 4-year constant, long 100bp) and no
              post-shock floor. Swaps are a fixed leg at maturity against a floating leg at the next 3-month reset;
              MTM and DV01 are struck off the base curve. Limits are set at Group; segment views compare against the
              same thresholds. Figures are illustrative; the bank, its book and its hedges are fictional.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
