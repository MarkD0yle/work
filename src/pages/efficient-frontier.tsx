import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Efficient Frontier";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Mean-variance optimizer: a risk-aversion slider (or a click on the frontier)
   walks the portfolio along the efficient frontier; toggling asset classes in
   or out re-solves the mix live. */

interface Asset {
  k: string;
  name: string;
  ret: number;
  vol: number;
  color: string;
}

const ASSETS: Asset[] = [
  { k: "USEQ", name: "US Equity", ret: 8.5, vol: 16, color: "#4f46e5" },
  { k: "INTL", name: "Intl Equity", ret: 7.8, vol: 17, color: "#0ea5e9" },
  { k: "EM", name: "EM Equity", ret: 9.2, vol: 22, color: "#f97316" },
  { k: "IG", name: "IG Credit", ret: 5.4, vol: 7, color: "#10b981" },
  { k: "HY", name: "HY Credit", ret: 7.0, vol: 11, color: "#f59e0b" },
  { k: "UST", name: "Treasuries", ret: 4.6, vol: 5, color: "#64748b" },
  { k: "RE", name: "Real Estate", ret: 6.8, vol: 14, color: "#a855f7" },
  { k: "CMD", name: "Commodities", ret: 5.5, vol: 19, color: "#eab308" },
  { k: "CASH", name: "Cash", ret: 4.3, vol: 1, color: "#14b8a6" },
];

const CONS: Record<string, number> = { CASH: 0.1, UST: 0.35, IG: 0.25, HY: 0.05, USEQ: 0.1, INTL: 0.05, RE: 0.05, CMD: 0.05, EM: 0 };
const AGGR: Record<string, number> = { CASH: 0, UST: 0, IG: 0.05, HY: 0.1, USEQ: 0.35, INTL: 0.2, RE: 0.1, CMD: 0.05, EM: 0.15 };
const RHO = 0.35;
const RF = 4.3;

function allocate(t: number, excluded: Set<string>): Record<string, number> {
  const raw = ASSETS.map((a) => ({ k: a.k, w: excluded.has(a.k) ? 0 : Math.max(0, CONS[a.k] * (1 - t) + AGGR[a.k] * t) }));
  const sum = raw.reduce((s, r) => s + r.w, 0) || 1;
  return Object.fromEntries(raw.map((r) => [r.k, r.w / sum]));
}

function stats(w: Record<string, number>) {
  const ret = ASSETS.reduce((s, a) => s + w[a.k] * a.ret, 0);
  let v = 0;
  for (const a of ASSETS) for (const b of ASSETS) v += w[a.k] * w[b.k] * a.vol * b.vol * (a.k === b.k ? 1 : RHO);
  const vol = Math.sqrt(Math.max(0, v));
  return { ret, vol, sharpe: (ret - RF) / (vol || 1) };
}

const W = 640;
const H = 460;
const PAD = { l: 50, r: 18, t: 16, b: 40 };

function EfficientFrontier() {
  const [t, setT] = useState(0.55);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [cml, setCml] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const frontier = useMemo(() => Array.from({ length: 41 }, (_, i) => stats(allocate(i / 40, excluded))), [excluded]);
  const alloc = useMemo(() => allocate(t, excluded), [t, excluded]);
  const cur = useMemo(() => stats(alloc), [alloc]);
  const maxSharpeIdx = useMemo(() => frontier.reduce((best, f, i) => (f.sharpe > frontier[best].sharpe ? i : best), 0), [frontier]);

  const active = ASSETS.filter((a) => !excluded.has(a.k));
  const xDom = [0, Math.max(...active.map((a) => a.vol), ...frontier.map((f) => f.vol)) + 2];
  const yDom = [RF - 0.5, Math.max(...active.map((a) => a.ret)) + 1];
  const xTo = (v: number) => PAD.l + ((v - xDom[0]) / (xDom[1] - xDom[0])) * (W - PAD.l - PAD.r);
  const yTo = (v: number) => PAD.t + (1 - (v - yDom[0]) / (yDom[1] - yDom[0])) * (H - PAD.t - PAD.b);
  const fPath = frontier.map((f, i) => `${i === 0 ? "M" : "L"}${xTo(f.vol).toFixed(1)},${yTo(f.ret).toFixed(1)}`).join(" ");
  const sortedAlloc = [...active].sort((a, b) => alloc[b.k] - alloc[a.k]);
  const hoverAsset = hover ? ASSETS.find((a) => a.k === hover) : null;

  const toggle = (k: string) =>
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <PortfolioShell title="Efficient Frontier" badge="Mean-Variance" subtitle="Multi-asset">
      {() => (
        <div className="flex h-full min-h-0 gap-3 p-3">
          {/* left */}
          <div className="flex w-72 shrink-0 flex-col gap-2.5 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Return" value={`${cur.ret.toFixed(2)}%`} tone="pos" />
              <StatTile label="Vol" value={`${cur.vol.toFixed(2)}%`} />
              <StatTile label="Sharpe" value={cur.sharpe.toFixed(2)} tone={cur.sharpe >= 0.3 ? "pos" : undefined} />
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
                <span>Conservative</span>
                <button type="button" onClick={() => setT(maxSharpeIdx / 40)} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">
                  Max Sharpe
                </button>
                <span>Aggressive</span>
              </div>
              <input type="range" min={0} max={1} step={0.025} value={t} onChange={(e) => setT(Number(e.target.value))} className="mt-1.5 h-1.5 w-full cursor-pointer accent-indigo-600" />
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Investable set · click to toggle</div>
              <div className="flex flex-wrap gap-1">
                {ASSETS.map((a) => {
                  const on = !excluded.has(a.k);
                  return (
                    <button key={a.k} type="button" onClick={() => toggle(a.k)} className={`rounded px-1.5 py-1 text-[10px] font-semibold transition ${on ? "text-white" : "bg-neutral-100 text-neutral-400 line-through"}`} style={on ? { background: a.color } : undefined}>
                      {a.k}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Optimal allocation</div>
              <div className="space-y-1.5">
                {sortedAlloc.filter((a) => alloc[a.k] > 0.001).map((a) => (
                  <div key={a.k} className="flex items-center gap-2" onMouseEnter={() => setHover(a.k)} onMouseLeave={() => setHover(null)}>
                    <span className="w-20 shrink-0 truncate text-[11px] text-neutral-600">{a.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full" style={{ width: `${alloc[a.k] * 100}%`, background: a.color }} />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-800">{(alloc[a.k] * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* chart */}
          <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-900">Risk / Return</div>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                <input type="checkbox" checked={cml} onChange={(e) => setCml(e.target.checked)} className="accent-indigo-600" />
                Capital Market Line
              </label>
            </div>
            <div className="min-h-0 flex-1">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="viz h-full w-full" onMouseLeave={() => setHover(null)}>
                <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="#fff" stroke="#e5e5e5" rx={8} />
                {Array.from({ length: 6 }, (_, i) => {
                  const v = yDom[0] + ((yDom[1] - yDom[0]) / 5) * i;
                  return (
                    <g key={`y${i}`}>
                      <line x1={PAD.l} y1={yTo(v)} x2={W - PAD.r} y2={yTo(v)} stroke="#f1f1f1" />
                      <text x={PAD.l - 8} y={yTo(v) + 3} textAnchor="end" className="fill-neutral-400" fontSize={10}>{v.toFixed(1)}%</text>
                    </g>
                  );
                })}
                {Array.from({ length: 6 }, (_, i) => {
                  const v = xDom[0] + ((xDom[1] - xDom[0]) / 5) * i;
                  return <text key={`x${i}`} x={xTo(v)} y={H - PAD.b + 16} textAnchor="middle" className="fill-neutral-400" fontSize={10}>{v.toFixed(0)}%</text>;
                })}
                <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 6} textAnchor="middle" className="fill-neutral-500" fontSize={11} fontWeight={600}>Volatility</text>
                <text x={13} y={PAD.t + (H - PAD.t - PAD.b) / 2} textAnchor="middle" className="fill-neutral-500" fontSize={11} fontWeight={600} transform={`rotate(-90 13 ${PAD.t + (H - PAD.t - PAD.b) / 2})`}>Expected Return</text>

                {cml && <line x1={xTo(0)} y1={yTo(RF)} x2={xTo(frontier[maxSharpeIdx].vol * 1.6)} y2={yTo(RF + (frontier[maxSharpeIdx].ret - RF) * 1.6)} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 4" />}

                <path d={fPath} fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeOpacity={0.85} />
                {/* clickable frontier handles */}
                {frontier.map((f, i) => (i % 2 === 0 ? <circle key={i} cx={xTo(f.vol)} cy={yTo(f.ret)} r={7} fill="transparent" className="cursor-pointer" onClick={() => setT(i / 40)} /> : null))}

                {active.map((a) => (
                  <g key={a.k} onMouseEnter={() => setHover(a.k)} className="cursor-pointer">
                    <circle cx={xTo(a.vol)} cy={yTo(a.ret)} r={hover === a.k ? 7 : 5} fill={a.color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
                    <text x={xTo(a.vol) + 8} y={yTo(a.ret) + 3} className="fill-neutral-600" fontSize={9.5} fontWeight={600}>{a.k}</text>
                  </g>
                ))}

                {frontier[maxSharpeIdx] && <circle cx={xTo(frontier[maxSharpeIdx].vol)} cy={yTo(frontier[maxSharpeIdx].ret)} r={5} fill="none" stroke="#10b981" strokeWidth={2} />}

                <circle cx={xTo(cur.vol)} cy={yTo(cur.ret)} r={9} fill="#4f46e5" stroke="#fff" strokeWidth={2.5} />
                <text x={xTo(cur.vol)} y={yTo(cur.ret) - 14} textAnchor="middle" className="fill-neutral-700" fontSize={10} fontWeight={700}>Portfolio</text>

                {hoverAsset && (
                  <g>
                    <rect x={xTo(hoverAsset.vol) + 10} y={yTo(hoverAsset.ret) - 34} width={120} height={30} rx={5} fill="#171717" opacity={0.92} />
                    <text x={xTo(hoverAsset.vol) + 18} y={yTo(hoverAsset.ret) - 20} fill="#fff" fontSize={10} fontWeight={700}>{hoverAsset.name}</text>
                    <text x={xTo(hoverAsset.vol) + 18} y={yTo(hoverAsset.ret) - 9} fill="#a3a3a3" fontSize={9}>ret {hoverAsset.ret}% · vol {hoverAsset.vol}%</text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default EfficientFrontier;
