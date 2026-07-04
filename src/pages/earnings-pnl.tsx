import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Earnings P&L";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Earnings event lens (benchmarked on Arcana): options-implied move vs realized
   move, earnings-day and ±5-day P&L, and hit rate across the book's reporters. */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES: [string, string][] = [
  ["NVDA", "Jul 02"], ["MSFT", "Jul 01"], ["META", "Jun 30"], ["AMZN", "Jun 27"], ["GOOGL", "Jun 26"],
  ["AVGO", "Jul 01"], ["AMD", "Jun 30"], ["NFLX", "Jun 25"], ["TSLA", "Jun 24"], ["CRM", "Jun 27"],
  ["PLTR", "Jun 26"], ["UBER", "Jun 25"], ["COST", "Jul 02"], ["LLY", "Jul 03"],
];

const UPCOMING: [string, string, number][] = [
  ["AAPL", "Jul 08", 5.2], ["JPM", "Jul 09", 4.1], ["SMCI", "Jul 10", 13.5], ["COIN", "Jul 11", 11.2],
];

interface Row {
  ticker: string;
  date: string;
  side: "L" | "S";
  implied: number;
  realized: number; // signed
  surprise: number; // %
  edPnl: number; // $k
  fivePnl: number; // $k
}

const DATA: Row[] = (() => {
  const rng = mulberry32(0xea27);
  return NAMES.map(([ticker, date]) => {
    const implied = Math.round((4 + rng() * 8) * 10) / 10;
    const surprise = Math.round((rng() * 20 - 8) * 10) / 10;
    const mag = implied * (0.5 + rng() * 1.1);
    const realized = Math.round((surprise >= 0 ? mag : -mag) * 10) / 10;
    const side: "L" | "S" = rng() > 0.35 ? "L" : "S";
    const weight = 1 + rng() * 3;
    const edPnl = Math.round((side === "L" ? realized : -realized) * weight * 40);
    const fivePnl = Math.round(edPnl * (0.7 + rng() * 0.9));
    return { ticker, date, side, implied, realized, surprise, edPnl, fivePnl };
  });
})();

const W = 560;
const H = 380;
const PAD = { l: 44, r: 18, t: 18, b: 40 };
const AX = 16;
const xTo = (v: number) => PAD.l + (v / AX) * (W - PAD.l - PAD.r);
const yTo = (v: number) => PAD.t + (1 - v / AX) * (H - PAD.t - PAD.b);

function EarningsPnl() {
  const [hover, setHover] = useState<string | null>(null);

  const stats = useMemo(() => {
    const wins = DATA.filter((d) => d.edPnl > 0).length;
    const totalPnl = DATA.reduce((s, d) => s + d.fivePnl, 0);
    const avgImplied = DATA.reduce((s, d) => s + d.implied, 0) / DATA.length;
    const avgRealized = DATA.reduce((s, d) => s + Math.abs(d.realized), 0) / DATA.length;
    return { hitRate: (wins / DATA.length) * 100, totalPnl, avgImplied, avgRealized };
  }, []);

  const sorted = [...DATA].sort((a, b) => b.fivePnl - a.fivePnl);

  return (
    <PortfolioShell title="Earnings P&L" badge="Event Risk" subtitle="This season · options-implied vs realized">
      {() => (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Hit Rate" value={`${stats.hitRate.toFixed(0)}%`} tone={stats.hitRate >= 50 ? "pos" : "neg"} />
            <StatTile label="±5d P&L" value={`${stats.totalPnl >= 0 ? "+" : "−"}$${Math.abs(stats.totalPnl / 1000).toFixed(1)}M`} tone={stats.totalPnl >= 0 ? "pos" : "neg"} />
            <StatTile label="Avg Implied Move" value={`${stats.avgImplied.toFixed(1)}%`} />
            <StatTile label="Reporting Next Wk" value={UPCOMING.length.toString()} sub="upcoming" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* implied vs realized */}
            <div className="rounded-xl border border-neutral-200 bg-white p-3 lg:col-span-2">
              <div className="mb-1 text-sm font-semibold text-neutral-900">Implied vs Realized Move</div>
              <svg viewBox={`0 0 ${W} ${H}`} className="viz h-auto w-full" onMouseLeave={() => setHover(null)}>
                <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="#fff" stroke="#e5e5e5" rx={8} />
                <line x1={xTo(0)} y1={yTo(0)} x2={xTo(AX)} y2={yTo(AX)} stroke="#cbd5e1" strokeDasharray="4 4" />
                <text x={xTo(AX) - 6} y={yTo(AX) + 14} textAnchor="end" className="fill-neutral-400" fontSize={9}>vol underpriced ↑</text>
                {[0, 4, 8, 12, 16].map((v) => (
                  <g key={v}>
                    <text x={xTo(v)} y={H - PAD.b + 15} textAnchor="middle" className="fill-neutral-400" fontSize={9}>{v}%</text>
                    <text x={PAD.l - 6} y={yTo(v) + 3} textAnchor="end" className="fill-neutral-400" fontSize={9}>{v}%</text>
                  </g>
                ))}
                <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 5} textAnchor="middle" className="fill-neutral-500" fontSize={10} fontWeight={600}>Implied move</text>
                <text x={12} y={PAD.t + (H - PAD.t - PAD.b) / 2} textAnchor="middle" className="fill-neutral-500" fontSize={10} fontWeight={600} transform={`rotate(-90 12 ${PAD.t + (H - PAD.t - PAD.b) / 2})`}>Realized move</text>
                {DATA.map((d) => {
                  const active = hover === d.ticker;
                  const c = d.edPnl >= 0 ? "#10b981" : "#ef4444";
                  return (
                    <g key={d.ticker} onMouseEnter={() => setHover(d.ticker)} className="cursor-pointer">
                      <circle cx={xTo(d.implied)} cy={yTo(Math.abs(d.realized))} r={active ? 8 : 5} fill={c} fillOpacity={active ? 0.9 : 0.6} stroke="#fff" strokeWidth={1.2} />
                      {active && <text x={xTo(d.implied)} y={yTo(Math.abs(d.realized)) - 10} textAnchor="middle" className="fill-neutral-700" fontSize={10} fontWeight={700}>{d.ticker}</text>}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* table */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-3">
              <div className="mb-2 text-sm font-semibold text-neutral-900">Reporters</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-neutral-200 text-right text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                      <th className="py-1.5 pr-3 text-left">Name</th>
                      <th className="py-1.5 pr-3 text-left">Date</th>
                      <th className="py-1.5 pr-3">Side</th>
                      <th className="py-1.5 pr-3">Impl</th>
                      <th className="py-1.5 pr-3">Real</th>
                      <th className="py-1.5 pr-3">ED P&L</th>
                      <th className="py-1.5">±5d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((d) => (
                      <tr key={d.ticker} onMouseEnter={() => setHover(d.ticker)} onMouseLeave={() => setHover(null)} className={`border-b border-neutral-100 text-right last:border-0 ${hover === d.ticker ? "bg-indigo-50" : ""}`}>
                        <td className="py-1.5 pr-3 text-left font-mono font-semibold text-neutral-800">{d.ticker}</td>
                        <td className="py-1.5 pr-3 text-left text-neutral-500">{d.date}</td>
                        <td className="py-1.5 pr-3"><span className={`rounded px-1 text-[10px] font-semibold ${d.side === "L" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{d.side}</span></td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums text-neutral-600">{d.implied.toFixed(1)}%</td>
                        <td className={`py-1.5 pr-3 font-mono tabular-nums ${d.realized >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{d.realized > 0 ? "+" : ""}{d.realized.toFixed(1)}%</td>
                        <td className={`py-1.5 pr-3 font-mono tabular-nums ${d.edPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{d.edPnl >= 0 ? "+" : "−"}${Math.abs(d.edPnl)}k</td>
                        <td className={`py-1.5 font-mono font-semibold tabular-nums ${d.fivePnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{d.fivePnl >= 0 ? "+" : "−"}${Math.abs(d.fivePnl)}k</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 border-t border-neutral-100 pt-2">
                <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Upcoming · implied move</div>
                <div className="flex flex-wrap gap-1.5">
                  {UPCOMING.map(([t, dt, im]) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px]">
                      <span className="font-mono font-semibold text-neutral-700">{t}</span>
                      <span className="text-neutral-400">{dt}</span>
                      <span className="font-mono text-amber-600">±{im}%</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default EarningsPnl;
