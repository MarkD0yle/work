import { useMemo, useState } from "react";

export const title = "Asset Allocation";
export const fullWidth = true;

/* Asset Allocation — current mix against the mandate's target, and the trades
 * to close the gap.
 *
 * A donut carries the current shape; the table beside it shows every sleeve's
 * current vs target weight, the drift, and whether it's inside the tolerance
 * band. When anything is out of band the page proposes a rebalance: a short
 * list of buys and sells sized to bring each sleeve back to target. */

type Sleeve = {
  name: string;
  color: string;
  current: number; // %
  target: number; // %
  band: number; // ± tolerance in %
};

type Mandate = {
  key: string;
  name: string;
  portfolioValue: number;
  sleeves: Sleeve[];
};

const MANDATES: Mandate[] = [
  {
    key: "growth",
    name: "Harrington Trust — Growth",
    portfolioValue: 128_400_000,
    sleeves: [
      { name: "Global equity", color: "#059669", current: 48.2, target: 45, band: 3 },
      { name: "Private markets", color: "#6366f1", current: 18.6, target: 20, band: 3 },
      { name: "Fixed income", color: "#0ea5e9", current: 14.1, target: 18, band: 2.5 },
      { name: "Alternatives", color: "#f59e0b", current: 12.9, target: 12, band: 2 },
      { name: "Real assets", color: "#a855f7", current: 3.0, target: 3, band: 1.5 },
      { name: "Cash", color: "#94a3b8", current: 3.2, target: 2, band: 1 },
    ],
  },
  {
    key: "balanced",
    name: "Adeyemi Foundation — Balanced",
    portfolioValue: 76_100_000,
    sleeves: [
      { name: "Global equity", color: "#059669", current: 34.5, target: 35, band: 3 },
      { name: "Fixed income", color: "#0ea5e9", current: 33.8, target: 35, band: 2.5 },
      { name: "Private credit", color: "#6366f1", current: 16.2, target: 15, band: 2 },
      { name: "Alternatives", color: "#f59e0b", current: 9.9, target: 10, band: 2 },
      { name: "Cash", color: "#94a3b8", current: 5.6, target: 5, band: 1.5 },
    ],
  },
  {
    key: "conservative",
    name: "Pryce Family — Conservative",
    portfolioValue: 9_250_000,
    sleeves: [
      { name: "Fixed income", color: "#0ea5e9", current: 46.1, target: 50, band: 3 },
      { name: "Global equity", color: "#059669", current: 27.8, target: 25, band: 2.5 },
      { name: "Alternatives", color: "#f59e0b", current: 8.4, target: 8, band: 1.5 },
      { name: "Real assets", color: "#a855f7", current: 8.8, target: 10, band: 1.5 },
      { name: "Cash", color: "#94a3b8", current: 8.9, target: 7, band: 1.5 },
    ],
  },
];

type Trade = { sleeve: string; action: "Buy" | "Sell"; amount: number; color: string };

function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function Donut({ sleeves }: { sleeves: Sleeve[] }) {
  const size = 168;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = sleeves.reduce((s, x) => s + x.current, 0);
  // Precompute each arc's dash length and starting offset so the render stays
  // pure (no mutation inside the JSX map).
  const segments = sleeves.reduce<
    { name: string; color: string; dash: number; offset: number }[]
  >((acc, s) => {
    const dash = (s.current / total) * c;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    acc.push({ name: s.name, color: s.color, dash, offset });
    return acc;
  }, []);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44" role="img">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((s) => (
          <circle
            key={s.name}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </g>
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        className="fill-neutral-400"
        fontSize={9}
      >
        SLEEVES
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        className="fill-neutral-900 font-semibold"
        fontSize={18}
      >
        {sleeves.length}
      </text>
    </svg>
  );
}

export default function AssetAllocationPage() {
  const [key, setKey] = useState("growth");
  const m = useMemo(() => MANDATES.find((x) => x.key === key) ?? MANDATES[0], [key]);

  const rows = useMemo(
    () =>
      m.sleeves.map((s) => {
        const drift = s.current - s.target;
        const inBand = Math.abs(drift) <= s.band;
        const dollarDrift = (drift / 100) * m.portfolioValue;
        return { ...s, drift, inBand, dollarDrift };
      }),
    [m],
  );

  const trades: Trade[] = useMemo(
    () =>
      rows
        .filter((r) => !r.inBand)
        .map((r) => ({
          sleeve: r.name,
          action: r.drift > 0 ? ("Sell" as const) : ("Buy" as const),
          amount: Math.abs(r.dollarDrift),
          color: r.color,
        }))
        .sort((a, b) => b.amount - a.amount),
    [rows],
  );

  const outOfBand = rows.filter((r) => !r.inBand).length;
  const totalDrift = rows.reduce((s, r) => s + Math.abs(r.drift), 0) / 2;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Wealth · Strategic asset allocation · {fmtM(m.portfolioValue)}
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Asset Allocation
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Current mix versus mandate target, drift against tolerance bands,
              and the trades to bring it back.
            </p>
          </div>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 focus:border-neutral-500 focus:outline-none"
          >
            {MANDATES.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Donut + status */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Current mix</h2>
            <div className="mt-2 flex justify-center">
              <Donut sleeves={m.sleeves} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {m.sleeves.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-neutral-600">{s.name}</span>
                  <span className="ml-auto font-mono tabular-nums text-neutral-800">
                    {s.current.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
            <div
              className={`mt-4 rounded-lg border px-3 py-2.5 text-xs ${
                outOfBand === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {outOfBand === 0 ? (
                <>In tolerance — no rebalance needed.</>
              ) : (
                <>
                  <span className="font-semibold">{outOfBand}</span> sleeve
                  {outOfBand === 1 ? "" : "s"} out of band ·{" "}
                  <span className="font-semibold">{totalDrift.toFixed(1)}%</span>{" "}
                  total drift.
                </>
              )}
            </div>
          </section>

          {/* Current vs target table */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold text-neutral-900">
              Current vs target
            </h2>
            <div className="mt-3 space-y-3">
              {rows.map((r) => {
                return (
                  <div key={r.name}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-neutral-800">{r.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-neutral-500">
                          {r.current.toFixed(1)}% / {r.target.toFixed(0)}%
                        </span>
                        <span
                          className={`inline-flex w-14 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            r.inBand
                              ? "bg-neutral-100 text-neutral-500"
                              : r.drift > 0
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {r.drift > 0 ? "+" : ""}
                          {r.drift.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    {/* dual bar: target marker over current fill */}
                    <div className="relative mt-1.5 h-3 rounded-full bg-neutral-100">
                      <div
                        className="absolute top-0 h-full rounded-full"
                        style={{
                          width: `${r.current}%`,
                          backgroundColor: r.color,
                          opacity: r.inBand ? 0.85 : 1,
                        }}
                      />
                      {/* tolerance band around target */}
                      <div
                        className="absolute top-0 h-full bg-neutral-900/5"
                        style={{
                          left: `${Math.max(0, r.target - r.band)}%`,
                          width: `${r.band * 2}%`,
                        }}
                      />
                      {/* target marker */}
                      <div
                        className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5 bg-neutral-900"
                        style={{ left: `${r.target}%` }}
                        title={`Target ${r.target}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-0.5 bg-neutral-900" /> Target
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-4 bg-neutral-900/5" /> Tolerance band
              </span>
            </div>
          </section>

          {/* Rebalance proposal */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Proposed rebalance
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Trades sized to return each out-of-band sleeve to its target
                  weight.
                </p>
              </div>
              {trades.length > 0 && (
                <button
                  type="button"
                  className="rounded-md bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                >
                  Stage {trades.length} trade{trades.length === 1 ? "" : "s"}
                </button>
              )}
            </div>

            {trades.length === 0 ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
                Portfolio is within tolerance across every sleeve. Nothing to
                trade today.
              </div>
            ) : (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400">
                    <th className="pb-2 font-semibold">Sleeve</th>
                    <th className="pb-2 font-semibold">Action</th>
                    <th className="pb-2 text-right font-semibold">Notional</th>
                    <th className="pb-2 text-right font-semibold">% of book</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {trades.map((t) => (
                    <tr key={t.sleeve}>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium text-neutral-800">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.sleeve}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            t.action === "Buy"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {t.action}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-neutral-900">
                        {fmtM(t.amount)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-neutral-500">
                        {((t.amount / m.portfolioValue) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
