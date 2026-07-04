import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Correlation Matrix";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Cross-asset correlation heatmap with a diversification read-out. Click a cell
   to pin a pair (hedge vs redundancy + an action); a highlight threshold and a
   values toggle keep it tight and scannable. */

const ASSETS: { code: string; name: string; load: number[] }[] = [
  { code: "US", name: "US Equity", load: [1, -0.1, 0.3, 0.1, -0.2] },
  { code: "INTL", name: "Intl Equity", load: [0.9, -0.1, 0.3, 0.15, 0.2] },
  { code: "EM", name: "EM Equity", load: [0.85, -0.05, 0.35, 0.3, 0.3] },
  { code: "IG", name: "IG Credit", load: [0.3, 0.5, 0.9, 0, 0] },
  { code: "HY", name: "HY Credit", load: [0.6, 0.2, 0.8, 0.1, 0] },
  { code: "UST", name: "Treasuries", load: [-0.2, 1, -0.1, -0.1, -0.1] },
  { code: "RE", name: "Real Estate", load: [0.6, 0.4, 0.4, 0.05, 0] },
  { code: "CMD", name: "Commodities", load: [0.2, -0.1, 0.05, 1, 0.1] },
  { code: "GLD", name: "Gold", load: [-0.1, 0.3, 0, 0.5, -0.5] },
];

function corr(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return Math.max(-1, Math.min(1, dot / (na * nb || 1)));
}
const cellColor = (v: number) => (v >= 0 ? `rgba(239, 68, 68, ${Math.abs(v) * 0.85})` : `rgba(59, 130, 246, ${Math.abs(v) * 0.85})`);

function CorrelationMatrix() {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const [pin, setPin] = useState<{ i: number; j: number } | null>(null);
  const [thr, setThr] = useState(0);
  const [showVals, setShowVals] = useState(true);

  const M = useMemo(() => ASSETS.map((a) => ASSETS.map((b) => corr(a.load, b.load))), []);
  const stats = useMemo(() => {
    const off: { v: number; i: number; j: number }[] = [];
    for (let i = 0; i < ASSETS.length; i++) for (let j = i + 1; j < ASSETS.length; j++) off.push({ v: M[i][j], i, j });
    const avg = off.reduce((s, o) => s + o.v, 0) / off.length;
    const max = off.reduce((m, o) => (o.v > m.v ? o : m), off[0]);
    const min = off.reduce((m, o) => (o.v < m.v ? o : m), off[0]);
    return { avg, max, min };
  }, [M]);

  const pinV = pin ? M[pin.i][pin.j] : null;
  const N = ASSETS.length;

  return (
    <PortfolioShell title="Correlation Matrix" badge="Diversification" subtitle="Trailing 3y · weekly">
      {() => (
        <div className="flex h-full min-h-0 flex-col gap-2 p-3">
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Avg Correlation" value={stats.avg.toFixed(2)} />
            <StatTile label="Diversification" value={`${((1 - Math.max(0, stats.avg)) * 100).toFixed(0)}%`} tone="pos" />
            <button type="button" onClick={() => setPin({ i: stats.max.i, j: stats.max.j })} className="text-left"><StatTile label="Most Correlated" value={`${ASSETS[stats.max.i].code}·${ASSETS[stats.max.j].code}`} sub={stats.max.v.toFixed(2)} /></button>
            <button type="button" onClick={() => setPin({ i: stats.min.i, j: stats.min.j })} className="text-left"><StatTile label="Best Hedge" value={`${ASSETS[stats.min.i].code}·${ASSETS[stats.min.j].code}`} sub={stats.min.v.toFixed(2)} /></button>
          </div>

          <div className="flex min-h-0 flex-1 gap-3">
            {/* heatmap */}
            <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-neutral-900">Cross-Asset Correlation</div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                    Highlight ≥
                    <input type="range" min={0} max={0.9} step={0.05} value={thr} onChange={(e) => setThr(Number(e.target.value))} className="h-1 w-20 cursor-pointer accent-indigo-600" />
                    <span className="w-6 font-mono tabular-nums text-neutral-800">{thr.toFixed(2)}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                    <input type="checkbox" checked={showVals} onChange={(e) => setShowVals(e.target.checked)} className="accent-indigo-600" />
                    Values
                  </label>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="grid h-full w-full gap-0.5" style={{ gridTemplateColumns: `76px repeat(${N}, minmax(0,1fr))`, gridTemplateRows: `auto repeat(${N}, minmax(0,1fr))` }}>
                  <div />
                  {ASSETS.map((a, j) => (
                    <div key={a.code} className={`flex items-end justify-center pb-1 text-[10px] font-semibold ${hover && hover.j === j ? "text-indigo-600" : "text-neutral-500"}`}>{a.code}</div>
                  ))}
                  {ASSETS.map((a, i) => (
                    <div key={a.code} className="contents">
                      <div className={`flex items-center truncate pr-1.5 text-[11px] ${hover && hover.i === i ? "font-semibold text-indigo-600" : "text-neutral-600"}`}>{a.name}</div>
                      {ASSETS.map((_, j) => {
                        const v = M[i][j];
                        const dim = thr > 0 && Math.abs(v) < thr && i !== j;
                        const strong = Math.abs(v) > 0.5;
                        const active = (hover && (hover.i === i || hover.j === j)) || (pin && ((pin.i === i && pin.j === j) || (pin.i === j && pin.j === i)));
                        return (
                          <div
                            key={j}
                            onMouseEnter={() => setHover({ i, j })}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => i !== j && setPin({ i, j })}
                            className={`flex cursor-pointer items-center justify-center rounded font-mono text-[10px] tabular-nums transition ${strong && !dim ? "" : "text-neutral-600"} ${active ? "ring-2 ring-indigo-500" : ""}`}
                            style={{ background: i === j ? "rgba(99,102,241,0.9)" : cellColor(v), color: (i === j || strong) && !dim ? "#fff" : undefined, opacity: dim ? 0.18 : 1 }}
                          >
                            {showVals ? v.toFixed(2) : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex shrink-0 items-center justify-center gap-2 text-[11px] text-neutral-400">
                <span>−1 hedge</span>
                <span className="h-2.5 w-32 rounded-full" style={{ background: "linear-gradient(90deg,#3b82f6,rgba(120,120,120,0.15),#ef4444)" }} />
                <span>+1 redundant</span>
              </div>
            </div>

            {/* pinned pair */}
            <div className="flex w-64 shrink-0 flex-col gap-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Pinned pair</div>
                {pin && pinV !== null ? (
                  <>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                      <span>{ASSETS[pin.i].name}</span>
                      <span className="text-neutral-300">×</span>
                      <span>{ASSETS[pin.j].name}</span>
                    </div>
                    <div className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${pinV >= 0 ? "text-rose-500" : "text-blue-500"}`}>{pinV > 0 ? "+" : ""}{pinV.toFixed(2)}</div>
                    <div className="mt-1 text-[12px] leading-snug text-neutral-500">
                      {pinV > 0.6 ? "Highly correlated — stacking risk, limited diversification benefit." : pinV < -0.1 ? "Natural hedge — pairs offset, improves diversification." : "Modestly related — decent diversifier."}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button type="button" className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-500">{pinV > 0.4 ? "Trim overlap" : "Add diversifier"}</button>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-[12px] text-neutral-400">Click any cell to inspect a pair.</div>
                )}
              </div>
              <div className="min-h-0 flex-1 rounded-xl border border-neutral-200 bg-white p-3">
                <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Quick jumps</div>
                <div className="space-y-1">
                  <button type="button" onClick={() => setPin({ i: stats.max.i, j: stats.max.j })} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-neutral-50">
                    <span className="text-neutral-600">Most correlated</span>
                    <span className="font-mono font-semibold text-rose-500">{stats.max.v.toFixed(2)}</span>
                  </button>
                  <button type="button" onClick={() => setPin({ i: stats.min.i, j: stats.min.j })} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-neutral-50">
                    <span className="text-neutral-600">Best hedge</span>
                    <span className="font-mono font-semibold text-blue-500">{stats.min.v.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default CorrelationMatrix;
