import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CreditCard, HeroCurveCard, KeyRateCard, SectorCard } from "../components/fixed-income-portfolio/Charts";
import { HoldingsGrid } from "../components/fixed-income-portfolio/HoldingsGrid";
import {
  AS_OF_LABEL,
  COLORS,
  DIM_LABEL,
  FUNDS,
  FUND_BY_ID,
  NO_FILTER,
  creditRows,
  fmt,
  isFiltered,
  keyRateRows,
  notchLabel,
  sectorRows,
  sliceStats,
  type CompareKey,
  type FundId,
  type RatingBucket,
  type Sector,
  type Side,
  type SliceStats,
  type TenorBucket,
  type XDim,
  type XFilter,
} from "../components/fixed-income-portfolio/model";

export const title = "Fixed Income Portfolio";
export const fullWidth = true;

/* Fixed Income Portfolio: a portfolio manager's view of rate and credit risk
 * against the benchmark, close of business Mon 21 Sep 2026.
 *
 * Layout: hero curve on top, a comparative stat line, three analysis cards,
 * then the full holdings grid. The analysis cards are the filter controls:
 * clicking a tenor bucket, a rating or a sector slices the hero's dots, the
 * stat line and the grid to that bucket (dimensions AND together), and the
 * active slices show as removable chips above the grid.
 *
 * Model, generation and aggregation: components/fixed-income-portfolio/model.ts
 * Charts: …/Charts.tsx · Grid: …/HoldingsGrid.tsx
 */

const DIMS: XDim[] = ["tenor", "rating", "sector"];

function describe(f: XFilter, skip?: XDim): string | null {
  const parts = DIMS.filter((d) => d !== skip && f[d]).map((d) => `${DIM_LABEL[d]} = ${f[d]}`);
  return parts.length ? parts.join(" and ") : null;
}

/* ================================================================== */
/*  Stat line                                                          */
/* ================================================================== */

interface Metric {
  key: keyof Side;
  label: string;
  unit: string;
  value: (v: number) => ReactNode;
  /** Active as display text, plus the signed number that drives tone. */
  active: (p: number, b: number) => { text: string; v: number; title: string };
  eps: number;
  /** Additive exposure (DV01): an empty side is a real zero, not a missing average. */
  additive?: boolean;
}

const METRICS: Metric[] = [
  {
    key: "ytw",
    label: "Yield to worst",
    unit: "%",
    value: (v) => fmt.n2(v),
    active: (p, b) => ({ v: (p - b) * 100, text: fmt.signed((p - b) * 100, 0, "bp"), title: "Portfolio minus benchmark, bp" }),
    eps: 0.5,
  },
  {
    key: "modDur",
    label: "Modified duration",
    unit: "yrs",
    value: (v) => fmt.n2(v),
    active: (p, b) => ({ v: p - b, text: fmt.signed(p - b, 2), title: "Portfolio minus benchmark, years" }),
    eps: 0.005,
  },
  {
    key: "sprDur",
    label: "Spread duration",
    unit: "yrs",
    value: (v) => fmt.n2(v),
    active: (p, b) => ({ v: p - b, text: fmt.signed(p - b, 2), title: "Portfolio minus benchmark, years" }),
    eps: 0.005,
  },
  {
    key: "oas",
    label: "OAS",
    unit: "bp",
    value: (v) => fmt.n0(v),
    active: (p, b) => ({ v: p - b, text: fmt.signed(p - b, 0), title: "Portfolio minus benchmark, bp" }),
    eps: 0.5,
  },
  {
    key: "dv01",
    label: "DV01",
    unit: "£k per bp",
    value: (v) => fmt.n0(v),
    active: (p, b) => ({
      v: p - b,
      text: fmt.signed(p - b, 0),
      title: "Portfolio DV01 minus benchmark DV01 scaled to NAV, £k per bp",
    }),
    eps: 0.5,
    additive: true,
  },
  {
    key: "convexity",
    label: "Convexity",
    unit: "÷100",
    value: (v) => fmt.n2(v),
    active: (p, b) => ({ v: p - b, text: fmt.signed(p - b, 2), title: "Portfolio minus benchmark" }),
    eps: 0.005,
  },
  {
    key: "notch",
    label: "Average rating",
    unit: "notch score · AAA = 1",
    // Letter plus the underlying score, so two funds that both round to A+ still read apart.
    value: (v) => (
      <>
        {notchLabel(v)}
        <span className="ml-1.5 text-[11px] font-normal text-neutral-400">{fmt.n1(v)}</span>
      </>
    ),
    // Higher notch number = lower quality, so quality active is bench − port.
    active: (p, b) => {
      const q = b - p;
      const n = Math.abs(q);
      return {
        v: q,
        text: `${fmt.signed(q, 1)} nt`,
        title: `Average rating is ${fmt.n1(n)} notch${n === 1 ? "" : "es"} ${q >= 0 ? "higher" : "lower"} than the benchmark`,
      };
    },
    eps: 0.05,
  },
];

const ROW_HEAD = "border-neutral-100 px-3 py-2 text-left text-[11px] font-medium whitespace-nowrap text-neutral-600";

function StatLine({ stats, filter, benchName, nav }: { stats: SliceStats; filter: XFilter; benchName: string; nav: number }) {
  const scope = describe(filter);
  const { port, bench } = stats;
  const cols = { gridTemplateColumns: `minmax(118px, 150px) repeat(${METRICS.length}, minmax(0, 1fr))` };

  const cell = (s: Side, m: Metric) => {
    const v = s[m.key];
    if (m.additive) return m.value(v ?? 0);
    return v == null || s.count === 0 ? "—" : m.value(v);
  };

  return (
    <section aria-labelledby="stat-line-title" className="border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-neutral-100 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 id="stat-line-title" className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Risk characteristics
          </h2>
          {scope ? (
            <span className="text-[11px] text-neutral-600">
              <span className="font-semibold text-blue-700">Slice: {scope}</span>
              <span className="text-neutral-400"> · </span>
              {port.count} holdings · {fmt.gbp(stats.mv)} ·{" "}
              <span className="font-mono tabular-nums">{fmt.pct1(port.weight)}</span> of NAV vs{" "}
              <span className="font-mono tabular-nums">{fmt.pct1(bench.weight)}</span> of index
            </span>
          ) : (
            <span className="text-[11px] text-neutral-600">
              Whole fund · {port.count} holdings · {fmt.gbp(nav)} NAV · vs {benchName} ({bench.count} constituents)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-[3px]" style={{ background: COLORS.over }} />▲ above benchmark
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-[3px]" style={{ background: COLORS.under }} />▼ below
          </span>
        </div>
      </div>

      <div role="table" aria-label="Portfolio, benchmark and active risk characteristics" className="overflow-x-auto">
        <div role="rowgroup">
          <div role="row" className="grid border-b border-neutral-100 bg-neutral-50/60" style={cols}>
            <div role="columnheader" className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              <span className="sr-only">Series</span>
            </div>
            {METRICS.map((m) => (
              <div key={m.key} role="columnheader" className="border-l border-neutral-100 px-3 py-1.5 text-right">
                <div className="text-[10px] font-semibold tracking-widest whitespace-nowrap text-neutral-500 uppercase">{m.label}</div>
                <div className="text-[10px] text-neutral-400">{m.unit}</div>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {[
            { label: "Portfolio", s: port, strong: true },
            { label: "Benchmark", s: bench, strong: false },
          ].map((r) => (
            <div key={r.label} role="row" className="grid border-b border-neutral-100" style={cols}>
              <div role="rowheader" className={ROW_HEAD}>
                {r.label}
              </div>
              {METRICS.map((m) => (
                <div
                  key={m.key}
                  role="cell"
                  className={`border-l border-neutral-100 px-3 py-2 text-right font-mono text-[13px] tabular-nums ${
                    r.strong ? "font-semibold text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {cell(r.s, m)}
                </div>
              ))}
            </div>
          ))}
          <div role="row" className="grid" style={cols}>
            <div role="rowheader" className={`${ROW_HEAD} font-semibold text-neutral-900`}>
              Active
            </div>
            {METRICS.map((m) => {
              const p = port[m.key];
              const b = bench[m.key];
              const missing = m.additive ? p == null || b == null : p == null || b == null || port.count === 0 || bench.count === 0;
              if (missing || p == null || b == null) {
                return (
                  <div key={m.key} role="cell" className="border-l border-neutral-100 px-3 py-2 text-right font-mono text-[13px] text-neutral-400">
                    —
                  </div>
                );
              }
              const a = m.active(p, b);
              const flat = Math.abs(a.v) < m.eps;
              const tone = flat ? COLORS.mid : a.v > 0 ? COLORS.over : COLORS.under;
              return (
                <div
                  key={m.key}
                  role="cell"
                  title={a.title}
                  className="flex items-center justify-end gap-2 border-l border-neutral-100 px-3 py-2 font-mono text-[13px] font-semibold text-neutral-900 tabular-nums"
                  style={{ background: flat ? undefined : `${tone}0f` }}
                >
                  <span aria-hidden className="inline-block h-3.5 w-[3px]" style={{ background: tone }} />
                  <span className="text-[10px] font-normal text-neutral-500">{flat ? "–" : a.v > 0 ? "▲" : "▼"}</span>
                  <span>{a.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Cross-filter chips                                                 */
/* ================================================================== */

function Chips({ filter, onRemove, onClear }: { filter: XFilter; onRemove: (d: XDim) => void; onClear: () => void }) {
  const active = DIMS.filter((d) => filter[d]);
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Cross-filters</span>
      {active.length === 0 ? (
        <span className="text-[11px] text-neutral-400">None. Click a bar in the charts above to slice the book.</span>
      ) : (
        <>
          {active.map((d, i) => (
            <span key={d} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-[10px] font-semibold text-neutral-400 uppercase">and</span>}
              <button
                type="button"
                onClick={() => onRemove(d)}
                aria-label={`Remove filter ${DIM_LABEL[d]} = ${filter[d]}`}
                className="inline-flex h-7 items-center gap-2 border border-blue-200 bg-blue-50 px-2 text-[11px] font-medium text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                <span>
                  {DIM_LABEL[d]} = <span className="font-semibold">{filter[d]}</span>
                </span>
                <span aria-hidden className="text-blue-500">
                  ✕
                </span>
              </button>
            </span>
          ))}
          {active.length > 1 && (
            <button
              type="button"
              onClick={onClear}
              className="ml-1 text-[11px] font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              Clear all
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default function FixedIncomePortfolioPage() {
  const [fundId, setFundId] = useState<FundId>("agg");
  const [compare, setCompare] = useState<CompareKey>("1M");
  const [xf, setXf] = useState<XFilter>(NO_FILTER);
  const fund = FUND_BY_ID[fundId];

  const onTenor = useCallback((t: TenorBucket) => setXf((f) => ({ ...f, tenor: f.tenor === t ? null : t })), []);
  const onRating = useCallback((r: RatingBucket) => setXf((f) => ({ ...f, rating: f.rating === r ? null : r })), []);
  const onSector = useCallback((s: Sector) => setXf((f) => ({ ...f, sector: f.sector === s ? null : s })), []);
  const removeDim = useCallback((d: XDim) => setXf((f) => ({ ...f, [d]: null })), []);
  const clearAll = useCallback(() => setXf(NO_FILTER), []);

  const stats = useMemo(() => sliceStats(fund, xf), [fund, xf]);
  const krd = useMemo(() => keyRateRows(fund, xf), [fund, xf]);
  const credit = useMemo(() => creditRows(fund, xf), [fund, xf]);
  const sectors = useMemo(() => sectorRows(fund, xf), [fund, xf]);
  const maxAbsActive = useMemo(() => Math.max(0.5, ...fund.holdings.map((h) => Math.abs(h.active))), [fund]);

  const filtered = isFiltered(xf);
  // Series ids are keyed on this so each slice renders fresh (see Charts.tsx).
  const sliceKey = `${fundId}|${xf.tenor ?? ""}|${xf.rating ?? ""}|${xf.sector ?? ""}`;
  const heroNote = filtered ? (
    <>
      <span className="font-mono tabular-nums">{stats.holdings.length}</span> of{" "}
      <span className="font-mono tabular-nums">{fund.holdings.length}</span> holdings plotted ·{" "}
      <span className="font-semibold text-blue-700">{describe(xf)}</span>
    </>
  ) : (
    <>
      All <span className="font-mono tabular-nums">{fund.holdings.length}</span> holdings plotted
    </>
  );

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed Home pill. */}
      <header className="shrink-0 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Dashboards · Fixed income · Portfolio management
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-950">Fixed Income Portfolio</h1>
              <span className="border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-500">
                COB {AS_OF_LABEL}
              </span>
            </div>
            <p className="mt-0.5 max-w-xl text-xs text-neutral-500">
              Where the fund&apos;s rate and credit risk sits against its benchmark, from the gilt curve to the line item.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Portfolio</span>
              <span className="relative">
                <select
                  value={fundId}
                  onChange={(e) => setFundId(e.target.value as FundId)}
                  className="h-8 w-60 appearance-none border border-neutral-300 bg-white pr-8 pl-2.5 text-[13px] font-medium text-neutral-900 hover:border-neutral-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:outline-none"
                >
                  {FUNDS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                  className="pointer-events-none absolute top-2 right-2 h-4 w-4 text-neutral-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </label>
            <dl className="flex flex-wrap items-end gap-x-5 gap-y-2">
              <div className="flex flex-col gap-1">
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Benchmark</dt>
                <dd
                  className="flex h-8 items-center text-[13px] text-neutral-800"
                  style={{ maxWidth: "16rem" }}
                  title={fund.benchmark}
                >
                  <span className="truncate">{fund.benchmark}</span>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">NAV</dt>
                <dd className="flex h-8 items-center text-[13px] font-semibold text-neutral-900">{fmt.gbp(fund.nav)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <HeroCurveCard
            fund={fund}
            holdings={stats.holdings}
            compare={compare}
            onCompare={setCompare}
            tenor={xf.tenor}
            note={heroNote}
            sliceKey={sliceKey}
          />

          <StatLine stats={stats} filter={xf} benchName={fund.benchmarkShort} nav={fund.nav} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <KeyRateCard rows={krd} selected={xf.tenor} onSelect={onTenor} scope={describe(xf, "tenor")} sliceKey={sliceKey} />
            <CreditCard rows={credit} selected={xf.rating} onSelect={onRating} scope={describe(xf, "rating")} sliceKey={sliceKey} />
            <SectorCard rows={sectors} selected={xf.sector} onSelect={onSector} scope={describe(xf, "sector")} sliceKey={sliceKey} />
          </div>

          <section aria-labelledby="holdings-title" className="border border-neutral-200 bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-100 px-4 py-3">
              <div className="min-w-0">
                <h2 id="holdings-title" className="text-sm font-semibold text-neutral-900">
                  Holdings
                </h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Active weight is fund weight minus index weight for the same ISIN. A hollow marker flags an off-index
                  line, whose whole weight is active. Totals follow the rows shown.
                </p>
              </div>
            </header>
            <div className="px-4 pt-3 pb-4">
              <HoldingsGrid
                rows={stats.holdings}
                maxAbsActive={maxAbsActive}
                toolbar={<Chips filter={xf} onRemove={removeDim} onClear={clearAll} />}
              />
            </div>
          </section>

          <p className="px-1 pb-2 text-[11px] leading-relaxed text-neutral-400">
            OAS is measured against the fitted gilt par curve, so gilts carry no spread duration. Benchmark DV01 is scaled
            to the fund&apos;s NAV. Key-rate buckets assign each bond&apos;s duration to its maturity bucket. Issuer names
            other than the UK Treasury and supranationals are fictional; all figures are generated.
          </p>
        </div>
      </main>
    </div>
  );
}
