import { useMemo, useState } from "react";
import {
  AS_OF,
  CHANNELS,
  PRODUCTS,
  STAGES,
  buildView,
  type CaseRow,
  type Channel,
  type Product,
  type StageIdx,
} from "../components/mortgage-pipeline/model";
import { FOCUS, dateLong, gbpM, int, timeShort } from "../components/mortgage-pipeline/format";
import { Check, MicroLabel, Seg } from "../components/mortgage-pipeline/ui";
import { StageStrip } from "../components/mortgage-pipeline/StageStrip";
import {
  CohortHeatmapCard,
  FunnelCard,
  PacingCard,
  TimeInStageCard,
} from "../components/mortgage-pipeline/charts";
import { LeagueTable } from "../components/mortgage-pipeline/LeagueTable";
import { CaseList, type CaseOp } from "../components/mortgage-pipeline/CaseList";

export const title = "Mortgage Pipeline";
export const fullWidth = true;

/* Mortgage Pipeline — "Where is the pipeline stuck, and will we hit this
 * month's completions target?"
 *
 * For the Head of Mortgage Lending and the underwriting ops lead at a UK
 * lender, intraday. The page is a stage board: six connected chevron panels
 * (Application → Completion) carry the live count, value, median days
 * against SLA, breaches and a 14-day inflow sparkline, and clicking one
 * scopes the case list and the time-in-stage chart to that stage and
 * highlights it in the cohort funnel and heatmap. Below sit the September
 * cohort funnel against August at the same age, the week-cohort heatmap and
 * the completions pacing card; then the introducer league table beside the
 * time-in-stage distribution; then the ageing case list with bulk actions.
 * Every number comes from one `buildView(filters)` slice in
 * components/mortgage-pipeline/model.ts, so the board, the charts and the
 * list always agree. */

type ChannelFilter = Channel | "all";
type ProductFilter = Product | "all";

export default function MortgagePipelinePage() {
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [product, setProduct] = useState<ProductFilter>("all");
  const [breachesOnly, setBreachesOnly] = useState(true);
  const [selected, setSelected] = useState<StageIdx | null>(null);
  const [ops, setOps] = useState<CaseOp[]>([]);

  const view = useMemo(() => buildView({ channel, product }), [channel, product]);

  const listRows = useMemo<CaseRow[]>(
    () => view.rows.filter((r) => (selected === null || r.stage === selected) && (!breachesOnly || r.breach)),
    [view, selected, breachesOnly],
  );

  const scope = `${channel === "all" ? "All channels" : channel} · ${product === "all" ? "All products" : product}`;
  const stage = selected === null ? null : STAGES[selected];
  const worst = [...view.stages].sort((a, b) => b.median / b.stage.sla - a.median / a.stage.sla)[0];

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <MicroLabel>
              Dashboards · Mortgage origination · As of {dateLong(AS_OF)}, {timeShort(AS_OF)}
            </MicroLabel>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Mortgage Pipeline</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Where is the pipeline stuck, and will we hit this month&rsquo;s completions target? Live cases by
              stage against SLA, cohort conversion and September pacing.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2" role="group" aria-label="Page filters">
            <Seg<ChannelFilter>
              label="Channel"
              value={channel}
              onChange={setChannel}
              options={[{ value: "all", label: "All" }, ...CHANNELS.map((c) => ({ value: c, label: c }))]}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="mp-product">
                <MicroLabel>Product</MicroLabel>
              </label>
              <div className="relative">
                <select
                  id="mp-product"
                  value={product}
                  onChange={(e) => setProduct(e.target.value as ProductFilter)}
                  className={`h-[26px] w-40 appearance-none border border-neutral-200 bg-white pr-7 pl-2.5 text-xs font-medium text-neutral-900 hover:border-neutral-400 ${FOCUS}`}
                >
                  <option value="all">All products</option>
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden
                  viewBox="0 0 10 10"
                  className="pointer-events-none absolute top-1/2 right-2 h-2.5 w-2.5 -translate-y-1/2 text-neutral-500"
                >
                  <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <MicroLabel>Case list</MicroLabel>
              <label
                htmlFor="mp-breaches"
                className="flex h-[26px] cursor-pointer items-center gap-2 border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 hover:border-neutral-400"
              >
                <Check id="mp-breaches" checked={breachesOnly} onChange={setBreachesOnly} label="SLA breaches only" />
                SLA breaches only
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4 lg:p-5">
          {/* the stage board: also the stage filter */}
          <section aria-labelledby="mp-board-title">
            <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h2 id="mp-board-title" className="text-sm font-semibold text-neutral-900">
                  Stage board
                </h2>
                <p className="mt-0.5 max-w-4xl text-[11px] text-neutral-500">
                  {int(view.totals.open)} live cases worth {gbpM(view.totals.openValue)} · {int(view.totals.breaches)} past SLA (
                  {gbpM(view.totals.breachValue)}) · {scope}. Click a stage to focus the case list, the time-in-stage
                  chart and the funnel on it.
                  {worst && worst.median > worst.stage.sla && (
                    <>
                      {" "}
                      <span className="text-neutral-800">
                        {worst.stage.label} is the bottleneck: median {worst.median.toFixed(1)}d against a {worst.stage.sla}d SLA.
                      </span>
                    </>
                  )}
                </p>
              </div>
              {stage && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
                >
                  ← Clear stage · {stage.label}
                </button>
              )}
            </div>
            <StageStrip
              stages={view.stages}
              selected={selected}
              onSelect={(s) => setSelected((cur) => (cur === s ? null : s))}
            />
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <FunnelCard funnel={view.funnel} selected={selected} />
            <CohortHeatmapCard cohorts={view.cohorts} selected={selected} />
            <PacingCard pacing={view.pacing} scope={scope} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7">
              <LeagueTable rows={view.league} scope={scope} />
            </div>
            <div className="min-w-0 xl:col-span-5">
              <TimeInStageCard rows={view.rows} selected={selected} />
            </div>
          </div>

          <CaseList
            rows={listRows}
            stage={stage}
            breachesOnly={breachesOnly}
            onClearStage={() => setSelected(null)}
            onShowAll={() => setBreachesOnly(false)}
            ops={ops}
            onOps={setOps}
          />

          <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
            <p>
              Stages run Application → Decision in principle → Valuation → Underwriting → Offer → Completion; a case
              is live in the stage it has reached and completes when funds are released. Time in stage and SLAs are
              in business days (weekends and the 31 Aug bank holiday excluded): 1, 2, 5, 4, 3 and 28 days
              respectively, and a breach is any live case past its stage SLA. Cohort conversion counts the share of
              a cohort&rsquo;s applications that has reached at least each stage; the September cohort is measured
              at 09:30 today and the August cohort at the same number of business days after the start of its
              month, so the two are like for like. Week cohorts are the ten application weeks from Mon 20 Jul.
              Completions pacing counts funds released in September against a linear target of 640 completions
              (£172m) over 22 working days, scaled to a slice&rsquo;s planned share when filtered; the projection
              is completions to date plus the remaining working days at the trailing 10-day run-rate. Offer rate
              is offers over decided cases (offers plus fall-throughs before offer); packaging quality is the share
              of an introducer&rsquo;s submissions that arrived fully packaged. Figures are illustrative; the
              lender, introducers, staff and applicants are fictional.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
