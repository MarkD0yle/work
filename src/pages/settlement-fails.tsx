import { useMemo, useState } from "react";
import {
  ALL_MARKETS,
  AS_OF_TIME,
  ASSET_CLASSES,
  DIRECTIONS,
  MARKETS,
  MTD_DAYS,
  REVISION_T,
  RATE_BP,
  buildView,
  type AssetClass,
  type Direction,
  type Filters,
  type Focus,
  type Instruction,
  type MarketId,
} from "../components/settlement-fails/model";
import { FOCUS, dateLong, focusLabel, num0, timeHM } from "../components/settlement-fails/format";
import { Chip, MicroLabel, Seg } from "../components/settlement-fails/ui";
import { KpiTiles } from "../components/settlement-fails/KpiTiles";
import { PenaltiesCard, TimelineCard } from "../components/settlement-fails/charts";
import { AgeingMatrix, MarketTable } from "../components/settlement-fails/OpsPanels";
import { FailsBlotter, type ActionKind, type BlotterRow } from "../components/settlement-fails/FailsBlotter";

export const title = "Settlement Fails";
export const fullWidth = true;

/* Settlement Fails — "What is failing today, why, who is responsible, and
 * what are the penalties costing us?"
 *
 * An intraday operations console for the settlement operations manager at a
 * custodian: table-forward and dense. Six KPI tiles lead (with the fails
 * rate's 30-day sparkline and its usual-range band), then the 60-day
 * timeline of fails by root cause beside month-to-date penalties by market,
 * then the counterparty × age heatmap beside the market league table, and
 * finally the blotter itself on AG Grid with bulk actions. The market chips
 * and the asset-class and direction segments scope everything; clicking the
 * heatmap scopes the blotter further. Every number comes from one
 * `buildView` slice in components/settlement-fails/model.ts, where the
 * instruction list, the daily history cube and the CSDR penalty schedule
 * live. */

type Flags = Map<string, ActionKind>;
type Notice = { text: string; prev: Flags };

const matchesFocus = (r: Instruction, f: Focus) =>
  (f.counterparty === null || r.counterparty === f.counterparty) && (f.bucket === null || r.bucket === f.bucket);

const ACTION_TEXT: Record<ActionKind, (n: number, cptys: number) => string> = {
  chase: (n, c) => `${num0(n)} instruction${n === 1 ? "" : "s"}: chase sent to ${c} counterpart${c === 1 ? "y" : "ies"}`,
  escalate: (n) => `${num0(n)} instruction${n === 1 ? "" : "s"} escalated to the settlement desk lead`,
  partial: (n) => `Partial settlement requested on ${num0(n)} instruction${n === 1 ? "" : "s"}`,
};

export default function SettlementFailsPage() {
  const [markets, setMarkets] = useState<MarketId[]>(ALL_MARKETS);
  const [assetClass, setAssetClass] = useState<AssetClass | "All">("All");
  const [direction, setDirection] = useState<Direction | "All">("All");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [flags, setFlags] = useState<Flags>(() => new Map());
  const [notice, setNotice] = useState<Notice | null>(null);

  const filters = useMemo<Filters>(() => ({ markets, assetClass, direction }), [markets, assetClass, direction]);
  const view = useMemo(() => buildView(filters), [filters]);

  // A matrix focus the header filters have emptied simply lapses.
  const liveFocus = focus && view.rows.some((r) => matchesFocus(r, focus)) ? focus : null;

  const blotterRows = useMemo<BlotterRow[]>(
    () =>
      view.rows
        .filter((r) => !liveFocus || matchesFocus(r, liveFocus))
        .map((r) => {
          const action = flags.get(r.id) ?? null;
          return { ...r, action, status: action === "partial" ? "Partial" : r.status };
        }),
    [view.rows, liveFocus, flags],
  );

  const act = (rows: BlotterRow[], kind: ActionKind) => {
    const next = new Map(flags);
    for (const r of rows) next.set(r.id, kind);
    const cptys = new Set(rows.map((r) => r.counterparty)).size;
    setNotice({ text: ACTION_TEXT[kind](rows.length, cptys), prev: flags });
    setFlags(next);
  };
  const undo = () => {
    if (notice) setFlags(notice.prev);
    setNotice(null);
  };

  const toggleMarket = (id: MarketId) =>
    setMarkets((m) => (m.includes(id) ? m.filter((x) => x !== id) : ALL_MARKETS.filter((x) => x === id || m.includes(x))));
  const allMarkets = markets.length === ALL_MARKETS.length;
  const noMarkets = markets.length === 0;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <MicroLabel>
              Dashboards · Custody ops · As of {dateLong(AS_OF_TIME)}, {timeHM(AS_OF_TIME)} intraday
            </MicroLabel>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Settlement Fails</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              What is failing today, why, who is responsible, and what are the CSDR penalties costing us? Open fails
              across six markets in £, with the 60-day trend.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2" role="group" aria-label="Page filters">
            <div className="flex flex-col gap-1">
              <MicroLabel>Market</MicroLabel>
              <div role="group" aria-label="Market" className="flex flex-wrap gap-1">
                <Chip on={allMarkets} onClick={() => setMarkets(ALL_MARKETS)} title="Select every market">
                  All
                </Chip>
                {MARKETS.map((m) => (
                  <Chip key={m.id} on={markets.includes(m.id)} onClick={() => toggleMarket(m.id)} title={`${m.label} · ${m.ccy}`}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            </div>
            <Seg<AssetClass | "All">
              label="Asset class"
              value={assetClass}
              onChange={setAssetClass}
              options={[{ value: "All", label: "All" }, ...ASSET_CLASSES.map((a) => ({ value: a, label: a }))]}
            />
            <Seg<Direction | "All">
              label="Direction"
              value={direction}
              onChange={setDirection}
              options={[{ value: "All", label: "All" }, ...DIRECTIONS.map((d) => ({ value: d, label: d }))]}
            />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4 lg:p-5">
          {noMarkets ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
              <div className="text-sm font-semibold text-neutral-900">No market selected</div>
              <p className="mt-1 max-w-md text-xs text-neutral-500">
                Every tile, chart and the blotter read from the same slice, so with no market there is nothing to show.
              </p>
              <button
                type="button"
                onClick={() => setMarkets(ALL_MARKETS)}
                className={`mt-4 border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 ${FOCUS}`}
              >
                Select all markets
              </button>
            </div>
          ) : (
            <>
              <KpiTiles kpis={view.kpis} empty={view.empty} />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-7">
                  <TimelineCard days={view.days} revisionT={REVISION_T} />
                </div>
                <div className="min-w-0 xl:col-span-5">
                  <PenaltiesCard rows={view.markets} />
                </div>
              </div>

              <section aria-labelledby="sf-who-title" className="flex flex-col gap-2.5">
                <div>
                  <h2 id="sf-who-title" className="text-sm font-semibold text-neutral-900">
                    Who is responsible, and how old is it
                  </h2>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    The heatmap ranks counterparties by open fails and is the blotter&rsquo;s cross-filter; the league
                    table compares markets on rate, size, age and penalties.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="min-w-0 xl:col-span-7">
                    <AgeingMatrix matrix={view.matrix} focus={liveFocus} onFocus={setFocus} />
                  </div>
                  <div className="min-w-0 xl:col-span-5">
                    <MarketTable rows={view.markets} />
                  </div>
                </div>
              </section>

              <FailsBlotter
                rows={blotterRows}
                total={view.rows.length}
                focusLabel={liveFocus ? focusLabel(liveFocus) : null}
                onClearFocus={() => setFocus(null)}
                onAction={act}
                notice={notice?.text ?? null}
                onUndo={undo}
                onDismiss={() => setNotice(null)}
              />
            </>
          )}

          <footer className="border-t border-neutral-200 pt-3 pb-2 text-[11px] leading-relaxed text-neutral-500">
            <p>
              Fails rate is failing value divided by value due to settle that day; the usual range is the 10th to 90th
              percentile of the previous 30 business days. Age counts business days since the intended settlement date,
              so T+0 is due today and unsettled at 10:40. CSDR cash penalties accrue per business day failing at{" "}
              {RATE_BP.liquid.toFixed(1)} bp of value for liquid equities, {RATE_BP.illiquid.toFixed(1)} bp for illiquid
              equities and other instruments including ETFs, {RATE_BP.govt.toFixed(2)} bp for government bonds and{" "}
              {RATE_BP.other.toFixed(2)} bp for other bonds, on the schedule in force since the 1 Sep 2026 revision
              (rates were a quarter lower before it). The failing party pays and its counterparty receives: an
              instruction we failed accrues as paid, one the counterparty failed accrues as received, and month-to-date
              net is received less paid over {MTD_DAYS} business days including today&rsquo;s projected accrual. CSDR
              applies at Euroclear Bank and Clearstream; the JASDEC and ASX fails charges are shown on the same schedule
              for comparability; UK CREST and DTC have no cash-penalty regime. Cumulative penalty in the blotter is the
              accrual on still-open fails only. Foreign markets are converted at fixed illustrative rates. Figures are
              illustrative; counterparties, securities, owners and data are fictional.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
