import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ASSET_CLASSES,
  CHANNELS,
  FUNDS,
  FUND_BY_ID,
  PERIODS,
  PERIOD_BY_ID,
  REGIONS,
  summarise,
  type AssetClass,
  type Channel,
  type PeriodKey,
  type Region,
} from "../components/fund-flows/data";
import { EmptyState, FOCUS_RING, MicroLabel, MultiSelect, Segmented } from "../components/fund-flows/ui";
import { MonthlyTile, SankeyTile } from "../components/fund-flows/charts";
import { ClientsTile, FundsTile, HeroTile, RegionTile } from "../components/fund-flows/tiles";
import { useWidth } from "../components/fund-flows/hooks";

export const title = "Fund Flows";
export const fullWidth = true;

/* Fund Flows: distribution dashboard for the Head of Distribution's monthly
 * sales meeting. "Where is money coming in and going out, and through which
 * channels?"
 *
 * Layout is a bento grid rather than rows of equal cards: a 2×2 hero (net
 * flows, the AUM bridge and four satellites) beside a wide channel → asset
 * class sankey, with the monthly trend and a region table-bar underneath it;
 * then a tall diverging bar of net flows by fund next to a wide table of the
 * biggest client moves. Clicking a fund focuses the client table on it.
 *
 * One filter row under the header (period + three multi-selects) scopes every
 * tile; everything reads from one `summarise()` slice so the numbers agree.
 * Model and mock data: src/components/fund-flows/data.ts.
 */

const ALL_AC = ASSET_CLASSES.map((a) => a.id);
const ALL_CH = CHANNELS.map((c) => c.id);
const ALL_RG = REGIONS.map((r) => r.id);

const AC_OPTIONS = ASSET_CLASSES.map((a) => ({
  id: a.id,
  label: a.label,
  swatch: a.color,
  meta: `${FUNDS.filter((f) => f.ac === a.id).length} funds`,
}));
const CH_OPTIONS = CHANNELS.map((c) => ({ id: c.id, label: c.label }));
const RG_OPTIONS = REGIONS.map((r) => ({ id: r.id, label: r.label }));

/* Grid templates by container width. Inline styles, not arbitrary classes, so
 * the dev JIT can never drop a layout-critical template. */
function gridFor(width: number): CSSProperties {
  if (width >= 1120) {
    const row = (spec: [string, number][]) => spec.flatMap(([a, n]) => Array(n).fill(a)).join(" ");
    return {
      gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
      gridTemplateAreas: [
        row([["hero", 4], ["sankey", 6]]),
        row([["hero", 4], ["monthly", 3], ["region", 3]]),
        row([["funds", 3], ["clients", 7]]),
      ]
        .map((r) => `"${r}"`)
        .join(" "),
    };
  }
  if (width >= 720) {
    return {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gridTemplateAreas: `"hero hero" "sankey sankey" "monthly region" "funds funds" "clients clients"`,
    };
  }
  return {
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateAreas: `"hero" "sankey" "funds" "monthly" "region" "clients"`,
  };
}

export default function FundFlowsPage() {
  const [period, setPeriod] = useState<PeriodKey>("YTD");
  const [ac, setAc] = useState<AssetClass[]>(ALL_AC);
  const [ch, setCh] = useState<Channel[]>(ALL_CH);
  const [rg, setRg] = useState<Region[]>(ALL_RG);
  const [focusId, setFocusId] = useState<string | null>(null);

  const s = useMemo(() => summarise({ ac, ch, rg }, period), [ac, ch, rg, period]);

  // A focus on a fund the filters have removed simply lapses.
  const focus = focusId && s.byFund.some((f) => f.fund.id === focusId) ? focusId : null;
  const moves = useMemo(
    () => (focus ? s.moves.filter((m) => m.fund.id === focus) : s.moves),
    [s.moves, focus],
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const width = useWidth(gridRef, 1280);
  const grid = gridFor(width);

  const dirty = ac.length !== ALL_AC.length || ch.length !== ALL_CH.length || rg.length !== ALL_RG.length;
  const reset = () => {
    setAc(ALL_AC);
    setCh(ALL_CH);
    setRg(ALL_RG);
  };
  const p = PERIOD_BY_ID[period];

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="relative z-30 flex-none border-b border-neutral-200 bg-white">
        {/* pl-36 clears the app's fixed Home pill. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pt-4 pr-6 pb-3 pl-36">
          <div className="min-w-0">
            <MicroLabel>Dashboards · Distribution</MicroLabel>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Fund Flows</h1>
            <p className="mt-0.5 max-w-3xl text-xs text-neutral-500">
              Where money is coming in and going out, and through which channels: gross sales, redemptions
              and net flows across {FUNDS.length} funds, for the monthly sales meeting.
            </p>
          </div>
          <dl className="flex shrink-0 items-end gap-5 text-right">
            <div>
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Data through</dt>
              <dd className="text-xs font-medium text-neutral-800">Fri 18 Sep 2026</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Currency</dt>
              <dd className="text-xs font-medium text-neutral-800">GBP, £</dd>
            </div>
          </dl>
        </div>

        <div
          role="toolbar"
          aria-label="Filters"
          className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-2.5"
        >
          <MicroLabel className="mr-0.5">Period</MicroLabel>
          <Segmented<PeriodKey>
            label="Period"
            size="md"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((x) => ({ value: x.id, label: x.label, title: `${x.long}: ${x.range}` }))}
          />
          <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-neutral-200" />
          <MicroLabel className="mr-0.5">Filter</MicroLabel>
          <MultiSelect<AssetClass> label="Asset class" options={AC_OPTIONS} value={ac} onChange={setAc} />
          <MultiSelect<Channel> label="Channel" options={CH_OPTIONS} value={ch} onChange={setCh} />
          <MultiSelect<Region> label="Region" options={RG_OPTIONS} value={rg} onChange={setRg} />
          {dirty && (
            <button
              type="button"
              onClick={reset}
              className={`h-8 px-2 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline ${FOCUS_RING}`}
            >
              Reset filters
            </button>
          )}
          <span className="ml-auto text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-700">{p.long}</span> · {p.range}
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div ref={gridRef} className="p-5">
          {s.empty ? (
            <div className="border border-neutral-200 bg-white">
              <EmptyState
                title="No flows match these filters"
                body="At least one asset class, channel and region must be selected. Every tile reads from the same slice, so there is nothing to show."
                action={
                  <button
                    type="button"
                    onClick={reset}
                    className={`mt-2 h-8 border border-neutral-900 bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-800 ${FOCUS_RING}`}
                  >
                    Reset filters
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3" style={grid}>
              <HeroTile area="hero" s={s} period={period} />
              <SankeyTile area="sankey" s={s} period={period} />
              <MonthlyTile area="monthly" s={s} period={period} />
              <RegionTile area="region" s={s} />
              <FundsTile
                area="funds"
                s={s}
                focus={focus}
                onFocus={setFocusId}
                inline={width >= 720 && width < 1120}
              />
              <ClientsTile
                area="clients"
                moves={moves}
                period={period}
                focusName={focus ? FUND_BY_ID[focus].name : null}
                onClearFocus={() => setFocusId(null)}
                retailOnly={ch.length === 1 && ch[0] === "retail"}
              />
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
            Fictional asset manager and clients; flows are simulated from a seeded generator at fund × channel ×
            region grain, so the AUM bridge closes for any filter. Organic growth and redemption rate are
            annualised over the {p.long.toLowerCase()} window ({s.days} days).
          </p>
        </div>
      </main>
    </div>
  );
}
