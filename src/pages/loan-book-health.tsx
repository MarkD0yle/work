import { useMemo, useState } from "react";
import {
  AS_OF_OPTIONS,
  LATEST,
  SEGMENTS,
  aggregate,
  metrics as M,
  monthEnd,
  monthShort,
  type Agg,
} from "../components/loan-book-health/model";
import {
  FOCUS,
  MINUS,
  TONE_TEXT,
  countCompact,
  gbp,
  pct,
  signedPp,
  toneOf,
  type Tone,
} from "../components/loan-book-health/format";
import {
  FACETS,
  NO_FILTERS,
  inSlice,
  type DimKey,
  type Filters,
} from "../components/loan-book-health/filters";
import { Sparkline } from "../components/loan-book-health/chrome";
import { FacetRail } from "../components/loan-book-health/FacetRail";
import { VintageCard } from "../components/loan-book-health/VintageCard";
import { BucketMixCard } from "../components/loan-book-health/BucketMixCard";
import { RollMatrixCard } from "../components/loan-book-health/RollMatrixCard";
import { LeagueTable } from "../components/loan-book-health/LeagueTable";

export const title = "Loan Book Health";
export const fullWidth = true;

/* Loan Book Health — "is the book deteriorating, and where?"
 *
 * A left facet rail slices a product × region × score band × channel cube
 * of the UK unsecured book; everything in the main canvas (KPI tiles,
 * vintage curves, the DPD bucket mix, the roll-rate matrix and the segment
 * league table) is re-aggregated from the same selected segments, so the
 * numbers always agree. The model lives in components/loan-book-health.
 */

/* ------------------------------------------------------------------ *
 * KPI tiles
 * ------------------------------------------------------------------ */

interface Kpi {
  label: string;
  def: string;
  value: string;
  delta: string;
  tone: Tone;
  spark: number[];
  sparkLabel: string;
}

function buildKpis(a: Agg, k: number): Kpi[] {
  const months = Array.from({ length: 12 }, (_, i) => k - 11 + i);
  const rate = (
    label: string,
    def: string,
    get: (m: number) => number,
    upGood: boolean,
    fmt: (v: number) => string,
    dp = 2,
  ): Kpi => {
    const cur = get(k);
    const d = cur - get(k - 1);
    const spark = months.map(get);
    return {
      label,
      def,
      value: fmt(cur),
      delta: signedPp(d, dp),
      tone: toneOf(d, upGood, 0.00005),
      spark,
      sparkLabel: `${label}, 12 months to ${monthShort(k)}: ${fmt(spark[0])} to ${fmt(cur)}`,
    };
  };
  const bal = a.bal[k];
  const balPrev = a.bal[k - 1];
  const dBal = bal - balPrev;
  return [
    {
      label: "Outstanding balance",
      value: gbp(bal),
      delta: `${dBal >= 0 ? "▲ +" : `▼ ${MINUS}`}${gbp(Math.abs(dBal))}`,
      def: `Gross · ${dBal >= 0 ? "+" : MINUS}${pct(Math.abs(balPrev > 0 ? dBal / balPrev : 0), 1)} m/m`,
      tone: toneOf(dBal, true, 1),
      spark: months.map((m) => a.bal[m]),
      sparkLabel: `Outstanding balance, 12 months to ${monthShort(k)}: ${gbp(
        a.bal[k - 11],
      )} to ${gbp(bal)}`,
    },
    rate("30+ DPD rate", "30+ DPD ÷ balance", (m) => M.dpd30(a, m), false, (v) => pct(v)),
    rate("90+ DPD (NPL)", "90+ DPD ÷ balance", (m) => M.npl(a, m), false, (v) => pct(v)),
    rate("Net charge-off", "Annualised, net", (m) => M.nco(a, m), false, (v) => pct(v)),
    rate(
      "NPL coverage",
      "Allowance ÷ 90+",
      (m) => M.coverage(a, m),
      true,
      (v) => pct(v, 0),
      1,
    ),
  ];
}

function KpiTile({ kpi, vs }: { kpi: Kpi; vs: string }) {
  return (
    <div className="flex min-w-0 flex-col bg-white px-4 pt-3 pb-2.5">
      <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        {kpi.label}
      </div>
      <div className="mt-2 text-[26px] leading-none font-semibold tracking-tight text-neutral-950">
        {kpi.value}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className={`font-medium ${TONE_TEXT[kpi.tone]}`}>{kpi.delta}</span>
        <span className="text-neutral-400">vs {vs}</span>
      </div>
      <Sparkline className="mt-3" values={kpi.spark} label={kpi.sparkLabel} />
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[10px] text-neutral-400">
        <span className="truncate" title={kpi.def}>
          {kpi.def}
        </span>
        <span className="shrink-0 font-mono">12M</span>
      </div>
    </div>
  );
}

export default function LoanBookHealthPage() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [asOf, setAsOf] = useState(LATEST);

  const segs = useMemo(() => SEGMENTS.filter((s) => inSlice(s, filters)), [filters]);
  const agg = useMemo(() => aggregate(segs), [segs]);
  const kpis = useMemo(() => buildKpis(agg, asOf), [agg, asOf]);
  const empty = segs.length === 0;

  const toggle = (k: DimKey, i: number) =>
    setFilters((f) => ({
      ...f,
      [k]: f[k].includes(i) ? f[k].filter((x) => x !== i) : [...f[k], i].sort((a, b) => a - b),
    }));
  const clear = (k: DimKey) => setFilters((f) => ({ ...f, [k]: [] }));

  const scope = FACETS.filter((f) => filters[f.key].length > 0).map((f) =>
    f.key === "b"
      ? `Band ${filters.b.map((i) => f.options[i].label).join(", ")}`
      : filters[f.key].map((i) => f.options[i].label).join(", "),
  );

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Risk / Retail credit
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">
              Loan Book Health
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Is the UK unsecured book deteriorating, and where? Arrears, roll rates and vintage
              performance across personal loans, car finance, cards and point-of-sale.
            </p>
          </div>
          <div className="flex items-end gap-5">
            <div className="hidden text-right lg:block">
              <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Data
              </div>
              <div className="mt-1 text-[11px] text-neutral-600">
                Month-end close · refreshed 22 Sep 2026
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                As of month-end
              </span>
              <span className="relative">
                <select
                  value={asOf}
                  onChange={(e) => setAsOf(Number(e.target.value))}
                  className={`appearance-none border border-neutral-300 bg-white py-1.5 pr-8 pl-2.5 text-xs font-medium text-neutral-900 hover:border-neutral-400 ${FOCUS}`}
                  style={{ borderRadius: 0 }}
                >
                  {[...AS_OF_OPTIONS].reverse().map((k) => (
                    <option key={k} value={k}>
                      {monthEnd(k)}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-neutral-500"
                  fill="none"
                >
                  <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </label>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <FacetRail
          filters={filters}
          asOf={asOf}
          onToggle={toggle}
          onClear={clear}
          onReset={() => setFilters(NO_FILTERS)}
          inView={empty ? 0 : agg.bal[asOf]}
        />

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
                Book at {monthEnd(asOf)}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {scope.length === 0 ? (
                  "All segments"
                ) : (
                  <>
                    Filtered to <span className="text-neutral-800">{scope.join(" · ")}</span>
                  </>
                )}
                {!empty && (
                  <span className="ml-2 font-mono text-neutral-400 tabular-nums">
                    {segs.length} segments · {countCompact(agg.acc[asOf])} accounts
                  </span>
                )}
              </p>
            </div>

            {empty ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
                <div className="text-sm font-semibold text-neutral-900">
                  No lending matches this combination
                </div>
                <p className="mt-1 max-w-md text-xs text-neutral-500">
                  Point-of-sale finance is only written through retail partners, so it has no
                  Direct or Broker balances. Loosen a facet in the rail, or reset.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className={`mt-4 border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 ${FOCUS}`}
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3 xl:grid-cols-5">
                  {kpis.map((k) => (
                    <KpiTile
                      key={k.label}
                      kpi={k}
                      vs={monthShort(asOf - 1)}
                    />
                  ))}
                </div>

                <VintageCard segs={segs} asOf={asOf} />

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="flex xl:col-span-5">
                    <BucketMixCard agg={agg} asOf={asOf} />
                  </div>
                  <div className="flex xl:col-span-7">
                    <RollMatrixCard agg={agg} asOf={asOf} />
                  </div>
                </div>

                <LeagueTable segs={segs} agg={agg} asOf={asOf} />

                <p className="pb-2 text-[10px] leading-relaxed text-neutral-400">
                  Definitions: 30+ DPD and NPL are month-end balances 30+ and 90+ days past due as
                  a share of gross balance. NCO is the month's charge-offs net of recoveries,
                  annualised, over average balance. NPL coverage is the IFRS 9 allowance over 90+
                  balance. Roll rates are the share of each start-of-month bucket's balance by
                  where it sits at month end. Vintage curves are cumulative, as a share of the
                  originated balance. Mock data for a fictional lender.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
