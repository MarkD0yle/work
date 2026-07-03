import { useMemo, useState } from "react";

export const title = "Wealth Summary";
export const fullWidth = true;

/* Wealth Summary — a household's net-worth statement.
 *
 * The left column is the balance sheet: assets stacked above liabilities, each
 * line a labelled bar so relative size reads at a glance. The right column
 * carries the net-worth headline, its 12-point trend, and a liquidity split.
 * Switching household re-scopes everything. This is the "where does it all sit"
 * view that precedes any planning conversation. */

type Line = { label: string; value: number; sub?: string };

type Household = {
  key: string;
  name: string;
  asOf: string;
  assets: { group: string; lines: Line[] }[];
  liabilities: Line[];
  netWorthTrend: number[]; // 12 points, in millions
  liquidity: { liquid: number; semiLiquid: number; illiquid: number };
};

const HOUSEHOLDS: Household[] = [
  {
    key: "harrington",
    name: "The Harrington Trust",
    asOf: "2026-06-30",
    assets: [
      {
        group: "Investable",
        lines: [
          { label: "Managed portfolios", value: 128_400_000, sub: "3 mandates" },
          { label: "Brokerage & direct", value: 22_100_000 },
          { label: "Cash & equivalents", value: 8_600_000 },
        ],
      },
      {
        group: "Private & real",
        lines: [
          { label: "Private equity", value: 34_500_000, sub: "5 funds" },
          { label: "Real estate", value: 41_200_000, sub: "4 properties" },
          { label: "Operating business", value: 18_000_000 },
        ],
      },
      {
        group: "Other",
        lines: [
          { label: "Art & collectibles", value: 6_400_000 },
          { label: "Pension & annuities", value: 4_900_000 },
        ],
      },
    ],
    liabilities: [
      { label: "Investment property loans", value: 19_300_000, sub: "3.8% blended" },
      { label: "Securities-backed line", value: 12_500_000, sub: "SOFR + 1.1%" },
      { label: "Residence mortgage", value: 3_800_000 },
    ],
    netWorthTrend: [252, 255, 251, 258, 263, 261, 268, 272, 269, 275, 279, 284],
    liquidity: { liquid: 159_100_000, semiLiquid: 65_200_000, illiquid: 100_000_000 },
  },
  {
    key: "adeyemi",
    name: "Adeyemi Foundation",
    asOf: "2026-06-30",
    assets: [
      {
        group: "Investable",
        lines: [
          { label: "Managed portfolios", value: 76_100_000, sub: "2 mandates" },
          { label: "Cash & equivalents", value: 11_400_000 },
        ],
      },
      {
        group: "Private & real",
        lines: [
          { label: "Private credit", value: 14_800_000 },
          { label: "Real estate", value: 9_500_000 },
        ],
      },
      {
        group: "Other",
        lines: [{ label: "Endowment reserve", value: 6_200_000 }],
      },
    ],
    liabilities: [
      { label: "Programme-related loan", value: 4_200_000 },
      { label: "Facility drawdown", value: 2_100_000 },
    ],
    netWorthTrend: [102, 104, 103, 106, 108, 107, 110, 112, 111, 114, 116, 118],
    liquidity: { liquid: 87_500_000, semiLiquid: 14_800_000, illiquid: 15_700_000 },
  },
  {
    key: "pryce",
    name: "Eleanor & James Pryce",
    asOf: "2026-06-30",
    assets: [
      {
        group: "Investable",
        lines: [
          { label: "Managed portfolios", value: 9_250_000 },
          { label: "Cash & equivalents", value: 820_000 },
        ],
      },
      {
        group: "Private & real",
        lines: [{ label: "Primary residence", value: 3_100_000 }],
      },
      {
        group: "Other",
        lines: [{ label: "Pensions (SIPP)", value: 1_450_000 }],
      },
    ],
    liabilities: [{ label: "Residence mortgage", value: 640_000, sub: "4.2% fixed" }],
    netWorthTrend: [13.8, 13.9, 13.7, 13.9, 14.0, 13.9, 14.1, 14.2, 14.1, 14.2, 14.3, 13.98],
    liquidity: { liquid: 10_070_000, semiLiquid: 1_450_000, illiquid: 3_100_000 },
  },
];

function fmtFull(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function TrendChart({ data }: { data: number[] }) {
  const w = 320;
  const h = 70;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - min) / span) * (h - 12);
  const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0)},${h} ${line} ${x(data.length - 1)},${h}`;
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "#059669" : "#e11d48";
  const fill = up ? "#05966915" : "#e11d4815";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" aria-hidden>
      <polygon points={area} fill={fill} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AssetBar({ line, max }: { line: Line; max: number }) {
  const pct = (line.value / max) * 100;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-neutral-800">
          {line.label}
          {line.sub && (
            <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
              {line.sub}
            </span>
          )}
        </span>
        <span className="font-mono tabular-nums text-neutral-700">
          {fmtM(line.value)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function WealthSummaryPage() {
  const [key, setKey] = useState("harrington");
  const hh = useMemo(
    () => HOUSEHOLDS.find((h) => h.key === key) ?? HOUSEHOLDS[0],
    [key],
  );

  const totalAssets = useMemo(
    () =>
      hh.assets.reduce(
        (s, g) => s + g.lines.reduce((t, l) => t + l.value, 0),
        0,
      ),
    [hh],
  );
  const totalLiab = useMemo(
    () => hh.liabilities.reduce((s, l) => s + l.value, 0),
    [hh],
  );
  const netWorth = totalAssets - totalLiab;
  const maxAsset = Math.max(
    ...hh.assets.flatMap((g) => g.lines.map((l) => l.value)),
  );
  const maxLiab = Math.max(...hh.liabilities.map((l) => l.value));

  const nwStart = hh.netWorthTrend[0] * 1_000_000;
  const nwNow = hh.netWorthTrend[hh.netWorthTrend.length - 1] * 1_000_000;
  const nwChangePct = ((nwNow - nwStart) / nwStart) * 100;

  const liq = hh.liquidity;
  const liqTotal = liq.liquid + liq.semiLiquid + liq.illiquid;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Wealth · Net-worth statement · as of {hh.asOf}
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Wealth Summary
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              The full balance sheet — what the household owns, what it owes, and
              where the net worth has trended.
            </p>
          </div>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 focus:border-neutral-500 focus:outline-none"
          >
            {HOUSEHOLDS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Balance sheet */}
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between border-b border-neutral-100 pb-3">
                <h2 className="text-sm font-semibold text-neutral-900">Assets</h2>
                <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700">
                  {fmtM(totalAssets)}
                </span>
              </div>
              <div className="mt-3 space-y-4">
                {hh.assets.map((g) => {
                  const groupTotal = g.lines.reduce((t, l) => t + l.value, 0);
                  return (
                    <div key={g.group}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                          {g.group}
                        </span>
                        <span className="text-[11px] font-medium text-neutral-500">
                          {fmtM(groupTotal)} ·{" "}
                          {((groupTotal / totalAssets) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="divide-y divide-neutral-50">
                        {g.lines.map((l) => (
                          <AssetBar key={l.label} line={l} max={maxAsset} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between border-b border-neutral-100 pb-3">
                <h2 className="text-sm font-semibold text-neutral-900">
                  Liabilities
                </h2>
                <span className="font-mono text-sm font-semibold tabular-nums text-rose-700">
                  {fmtM(totalLiab)}
                </span>
              </div>
              <div className="mt-3 space-y-1">
                {hh.liabilities.map((l) => {
                  const pct = (l.value / maxLiab) * 100;
                  return (
                    <div key={l.label} className="py-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium text-neutral-800">
                          {l.label}
                          {l.sub && (
                            <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
                              {l.sub}
                            </span>
                          )}
                        </span>
                        <span className="font-mono tabular-nums text-neutral-700">
                          {fmtM(l.value)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-rose-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Net worth column */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-neutral-900 bg-neutral-900 p-5 text-white shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                Net worth
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {fmtM(netWorth)}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                    nwChangePct >= 0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {nwChangePct >= 0 ? "▲" : "▼"} {Math.abs(nwChangePct).toFixed(1)}%
                </span>
                <span className="text-white/50">trailing 12 months</span>
              </div>
              <div className="mt-4">
                <TrendChart data={hh.netWorthTrend} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs">
                <div>
                  <div className="text-white/40">Total assets</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums text-emerald-300">
                    {fmtM(totalAssets)}
                  </div>
                </div>
                <div>
                  <div className="text-white/40">Total liabilities</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums text-rose-300">
                    {fmtM(totalLiab)}
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-white/10 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Debt-to-assets</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {((totalLiab / totalAssets) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">
                Liquidity profile
              </h2>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                <div
                  className="bg-sky-500"
                  style={{ width: `${(liq.liquid / liqTotal) * 100}%` }}
                  title="Liquid"
                />
                <div
                  className="bg-amber-400"
                  style={{ width: `${(liq.semiLiquid / liqTotal) * 100}%` }}
                  title="Semi-liquid"
                />
                <div
                  className="bg-neutral-400"
                  style={{ width: `${(liq.illiquid / liqTotal) * 100}%` }}
                  title="Illiquid"
                />
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                {[
                  { label: "Liquid", value: liq.liquid, dot: "bg-sky-500" },
                  {
                    label: "Semi-liquid",
                    value: liq.semiLiquid,
                    dot: "bg-amber-400",
                  },
                  { label: "Illiquid", value: liq.illiquid, dot: "bg-neutral-400" },
                ].map((r) => (
                  <li key={r.label} className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                    <span className="text-neutral-600">{r.label}</span>
                    <span className="ml-auto font-mono tabular-nums text-neutral-800">
                      {fmtM(r.value)}
                    </span>
                    <span className="w-10 text-right text-neutral-400">
                      {((r.value / liqTotal) * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
                Full statement value {fmtFull(netWorth)}.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
