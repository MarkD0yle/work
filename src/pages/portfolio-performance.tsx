import { useMemo, useState } from "react";

export const title = "Portfolio Performance";
export const fullWidth = true;

/* Portfolio Performance — how a mandate has done, and why.
 *
 * A growth-of-100 chart carries the headline (portfolio vs benchmark, with the
 * gap shaded), a period table breaks returns down by horizon, a monthly grid
 * gives the shape of the ride, and an attribution panel explains the excess
 * return by asset class. One period selector re-scopes the chart and stats. */

type PortfolioKey = "harrington" | "adeyemi" | "okonkwo";
type PeriodKey = "3M" | "6M" | "YTD" | "1Y";

type PortfolioMeta = {
  key: PortfolioKey;
  name: string;
  benchmark: string;
  inceptionReturn: number;
  inceptionBench: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  // 13 monthly index points (portfolio, benchmark), base 100.
  series: { label: string; port: number; bench: number }[];
  // period → { port, bench }
  periods: Record<PeriodKey, { port: number; bench: number }>;
  attribution: { sleeve: string; effect: number }[];
};

const PORTFOLIOS: PortfolioMeta[] = [
  {
    key: "harrington",
    name: "Harrington Trust — Growth",
    benchmark: "60/40 Global",
    inceptionReturn: 46.2,
    inceptionBench: 38.9,
    volatility: 11.4,
    sharpe: 1.12,
    maxDrawdown: -9.8,
    series: [
      { label: "Jun", port: 100.0, bench: 100.0 },
      { label: "Jul", port: 101.8, bench: 101.1 },
      { label: "Aug", port: 100.9, bench: 100.4 },
      { label: "Sep", port: 103.4, bench: 101.9 },
      { label: "Oct", port: 105.7, bench: 103.6 },
      { label: "Nov", port: 104.6, bench: 103.1 },
      { label: "Dec", port: 107.9, bench: 105.2 },
      { label: "Jan", port: 109.6, bench: 106.4 },
      { label: "Feb", port: 108.2, bench: 105.8 },
      { label: "Mar", port: 111.5, bench: 107.9 },
      { label: "Apr", port: 113.8, bench: 109.1 },
      { label: "May", port: 115.6, bench: 110.4 },
      { label: "Jun", port: 117.9, bench: 111.8 },
    ],
    periods: {
      "3M": { port: 5.7, bench: 3.6 },
      "6M": { port: 7.6, bench: 5.1 },
      YTD: { port: 9.4, bench: 8.1 },
      "1Y": { port: 17.9, bench: 11.8 },
    },
    attribution: [
      { sleeve: "Global equity", effect: 3.1 },
      { sleeve: "Private markets", effect: 1.8 },
      { sleeve: "Fixed income", effect: -0.4 },
      { sleeve: "Alternatives", effect: 0.9 },
      { sleeve: "Cash", effect: -0.2 },
    ],
  },
  {
    key: "adeyemi",
    name: "Adeyemi Foundation — Balanced",
    benchmark: "50/50 Global",
    inceptionReturn: 31.4,
    inceptionBench: 29.6,
    volatility: 8.2,
    sharpe: 0.94,
    maxDrawdown: -6.1,
    series: [
      { label: "Jun", port: 100.0, bench: 100.0 },
      { label: "Jul", port: 100.9, bench: 100.7 },
      { label: "Aug", port: 100.4, bench: 100.2 },
      { label: "Sep", port: 101.8, bench: 101.4 },
      { label: "Oct", port: 103.1, bench: 102.6 },
      { label: "Nov", port: 102.6, bench: 102.2 },
      { label: "Dec", port: 104.4, bench: 103.7 },
      { label: "Jan", port: 105.3, bench: 104.6 },
      { label: "Feb", port: 104.6, bench: 104.1 },
      { label: "Mar", port: 106.2, bench: 105.5 },
      { label: "Apr", port: 107.4, bench: 106.6 },
      { label: "May", port: 108.1, bench: 107.4 },
      { label: "Jun", port: 108.9, bench: 108.2 },
    ],
    periods: {
      "3M": { port: 2.5, bench: 2.6 },
      "6M": { port: 4.3, bench: 4.1 },
      YTD: { port: 8.7, bench: 8.1 },
      "1Y": { port: 8.9, bench: 8.2 },
    },
    attribution: [
      { sleeve: "Global equity", effect: 1.2 },
      { sleeve: "Fixed income", effect: 0.6 },
      { sleeve: "Private markets", effect: 0.5 },
      { sleeve: "Alternatives", effect: -0.3 },
      { sleeve: "Cash", effect: -0.1 },
    ],
  },
  {
    key: "okonkwo",
    name: "Okonkwo Estate — Growth",
    benchmark: "70/30 Global",
    inceptionReturn: 52.8,
    inceptionBench: 44.1,
    volatility: 13.1,
    sharpe: 1.05,
    maxDrawdown: -12.4,
    series: [
      { label: "Jun", port: 100.0, bench: 100.0 },
      { label: "Jul", port: 102.2, bench: 101.4 },
      { label: "Aug", port: 101.1, bench: 100.6 },
      { label: "Sep", port: 104.0, bench: 102.3 },
      { label: "Oct", port: 106.9, bench: 104.2 },
      { label: "Nov", port: 105.2, bench: 103.4 },
      { label: "Dec", port: 108.7, bench: 105.8 },
      { label: "Jan", port: 111.0, bench: 107.2 },
      { label: "Feb", port: 109.4, bench: 106.5 },
      { label: "Mar", port: 113.2, bench: 108.9 },
      { label: "Apr", port: 116.1, bench: 110.4 },
      { label: "May", port: 118.5, bench: 111.9 },
      { label: "Jun", port: 121.3, bench: 113.5 },
    ],
    periods: {
      "3M": { port: 7.2, bench: 4.2 },
      "6M": { port: 9.3, bench: 5.9 },
      YTD: { port: 10.2, bench: 8.4 },
      "1Y": { port: 21.3, bench: 13.5 },
    },
    attribution: [
      { sleeve: "Global equity", effect: 4.4 },
      { sleeve: "Private markets", effect: 2.6 },
      { sleeve: "Alternatives", effect: 1.1 },
      { sleeve: "Fixed income", effect: -0.6 },
      { sleeve: "Cash", effect: -0.3 },
    ],
  },
];

const PERIODS: PeriodKey[] = ["3M", "6M", "YTD", "1Y"];

// Monthly return grid — deterministic per portfolio, drives the shape band.
const MONTH_LABELS = [
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
];

function monthlyReturns(series: PortfolioMeta["series"]) {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    out.push(((series[i].port / series[i - 1].port) - 1) * 100);
  }
  return out;
}

function fmtPct(n: number, sign = true) {
  const s = sign && n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function GrowthChart({
  series,
  periodMonths,
}: {
  series: PortfolioMeta["series"];
  periodMonths: number;
}) {
  const sliced = series.slice(Math.max(0, series.length - 1 - periodMonths));
  const w = 640;
  const h = 220;
  const pad = { top: 12, right: 12, bottom: 22, left: 34 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const all = sliced.flatMap((d) => [d.port, d.bench]);
  const min = Math.floor(Math.min(...all) - 1);
  const max = Math.ceil(Math.max(...all) + 1);
  const span = max - min || 1;

  const x = (i: number) => pad.left + (i / (sliced.length - 1)) * iw;
  const y = (v: number) => pad.top + ih - ((v - min) / span) * ih;

  const line = (key: "port" | "bench") =>
    sliced.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const areaPort = `${line("port")} ${x(sliced.length - 1).toFixed(1)},${y(
    sliced[sliced.length - 1].bench,
  ).toFixed(1)} ${sliced
    .map((_, i) => `${x(sliced.length - 1 - i).toFixed(1)},${y(
      sliced[sliced.length - 1 - i].bench,
    ).toFixed(1)}`)
    .join(" ")}`;

  const gridVals = [min, min + span / 2, max];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img">
      {gridVals.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            x2={w - pad.right}
            y1={y(v)}
            y2={y(v)}
            stroke="#e5e5e5"
            strokeWidth={1}
          />
          <text
            x={pad.left - 6}
            y={y(v) + 3}
            textAnchor="end"
            className="fill-neutral-400"
            fontSize={9}
          >
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      {sliced.map((d, i) =>
        i % 2 === 0 ? (
          <text
            key={d.label + i}
            x={x(i)}
            y={h - 6}
            textAnchor="middle"
            className="fill-neutral-400"
            fontSize={9}
          >
            {d.label}
          </text>
        ) : null,
      )}
      {/* excess-return band between portfolio and benchmark */}
      <polygon points={areaPort} fill="#05966918" />
      <polyline
        points={line("bench")}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
        strokeDasharray="4 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={line("port")}
        fill="none"
        stroke="#059669"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? "text-neutral-900"}`}>
        {value}
      </div>
    </div>
  );
}

export default function PortfolioPerformancePage() {
  const [key, setKey] = useState<PortfolioKey>("harrington");
  const [period, setPeriod] = useState<PeriodKey>("YTD");

  const p = useMemo(
    () => PORTFOLIOS.find((x) => x.key === key) ?? PORTFOLIOS[0],
    [key],
  );

  const periodMonths = period === "3M" ? 3 : period === "6M" ? 6 : period === "YTD" ? 6 : 12;
  const monthly = useMemo(() => monthlyReturns(p.series), [p]);
  const maxAttr = Math.max(...p.attribution.map((a) => Math.abs(a.effect)));
  const totalAttr = p.attribution.reduce((s, a) => s + a.effect, 0);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Performance · {p.benchmark} benchmark
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Portfolio Performance
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Growth of 100, period returns and what drove the excess against
              benchmark.
            </p>
          </div>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value as PortfolioKey)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 focus:border-neutral-500 focus:outline-none"
          >
            {PORTFOLIOS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Return (since incept.)"
            value={fmtPct(p.inceptionReturn)}
            tone="text-emerald-600"
          />
          <Stat label="Volatility" value={`${p.volatility.toFixed(1)}%`} />
          <Stat label="Sharpe" value={p.sharpe.toFixed(2)} />
          <Stat
            label="Max drawdown"
            value={fmtPct(p.maxDrawdown)}
            tone="text-rose-600"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Chart */}
          <section className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
                  <span className="h-2 w-4 rounded-full bg-emerald-600" />
                  Portfolio
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-neutral-500">
                  <span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-slate-400" />
                  {p.benchmark}
                </span>
              </div>
              <div className="flex items-center gap-0.5 rounded-full border border-neutral-200 bg-neutral-50 p-0.5">
                {PERIODS.map((pk) => (
                  <button
                    key={pk}
                    type="button"
                    onClick={() => setPeriod(pk)}
                    aria-pressed={period === pk}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      period === pk
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {pk}
                  </button>
                ))}
              </div>
            </div>
            <GrowthChart series={p.series} periodMonths={periodMonths} />
          </section>

          {/* Period table */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">
              Returns by period
            </h2>
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400">
                  <th className="pb-2 font-semibold">Period</th>
                  <th className="pb-2 text-right font-semibold">Port.</th>
                  <th className="pb-2 text-right font-semibold">Bench.</th>
                  <th className="pb-2 text-right font-semibold">Excess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {PERIODS.map((pk) => {
                  const row = p.periods[pk];
                  const excess = row.port - row.bench;
                  const active = pk === period;
                  return (
                    <tr key={pk} className={active ? "bg-emerald-50/50" : ""}>
                      <td className="py-2 font-medium text-neutral-800">{pk}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-neutral-900">
                        {fmtPct(row.port)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-neutral-500">
                        {fmtPct(row.bench)}
                      </td>
                      <td
                        className={`py-2 text-right font-mono font-semibold tabular-nums ${
                          excess >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {fmtPct(excess)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Monthly returns grid */}
          <section className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">
              Monthly returns
            </h2>
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
              {monthly.map((r, i) => {
                const intensity = Math.min(1, Math.abs(r) / 3);
                const bg =
                  r >= 0
                    ? `rgba(5, 150, 105, ${0.12 + intensity * 0.55})`
                    : `rgba(225, 29, 72, ${0.12 + intensity * 0.55})`;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center rounded-lg py-2 text-center"
                    style={{ backgroundColor: bg }}
                    title={`${MONTH_LABELS[i]}: ${fmtPct(r)}`}
                  >
                    <span className="text-[9px] font-medium uppercase text-neutral-500">
                      {MONTH_LABELS[i]}
                    </span>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        r >= 0 ? "text-emerald-800" : "text-rose-800"
                      }`}
                    >
                      {r >= 0 ? "+" : ""}
                      {r.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Attribution */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Attribution vs benchmark
              </h2>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  totalAttr >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {fmtPct(totalAttr)}
              </span>
            </div>
            <div className="mt-3 space-y-2.5">
              {p.attribution.map((a) => {
                const pct = (Math.abs(a.effect) / maxAttr) * 50;
                const positive = a.effect >= 0;
                return (
                  <div key={a.sleeve} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate text-neutral-600">
                      {a.sleeve}
                    </span>
                    <div className="relative h-4 flex-1">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-neutral-200" />
                      <div
                        className={`absolute top-0 h-full rounded-sm ${
                          positive ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={
                          positive
                            ? { left: "50%", width: `${pct}%` }
                            : { right: "50%", width: `${pct}%` }
                        }
                      />
                    </div>
                    <span
                      className={`w-12 shrink-0 text-right font-mono font-semibold tabular-nums ${
                        positive ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {fmtPct(a.effect)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
