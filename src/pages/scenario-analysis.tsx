import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Scenario Analysis";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Macro stress testing: dial in rate / equity / credit / FX / oil shocks (or
   pick a preset regime) and see the P&L impact decomposed by sector — the
   Bloomberg PORT / Aladdin scenario workflow. */

interface Shocks {
  rate: number;
  equity: number;
  credit: number;
  fx: number;
  oil: number;
}

const SECTORS = [
  { name: "Technology", w: 22, eq: 1.3, rateDur: 6, spreadDur: 4, fx: -0.2, oil: 0 },
  { name: "Financials", w: 18, eq: 1.1, rateDur: 5, spreadDur: 5, fx: 0.1, oil: 0 },
  { name: "Consumer", w: 14, eq: 0.9, rateDur: 6, spreadDur: 4, fx: 0, oil: -0.3 },
  { name: "Health Care", w: 12, eq: 0.8, rateDur: 8, spreadDur: 4, fx: -0.1, oil: 0 },
  { name: "Industrials", w: 10, eq: 1.05, rateDur: 6, spreadDur: 4, fx: 0.15, oil: 0.1 },
  { name: "Energy", w: 9, eq: 1.0, rateDur: 7, spreadDur: 5, fx: 0.2, oil: 0.6 },
  { name: "Utilities", w: 8, eq: 0.5, rateDur: 10, spreadDur: 6, fx: 0, oil: 0.1 },
  { name: "Materials", w: 7, eq: 1.1, rateDur: 5, spreadDur: 5, fx: 0.2, oil: 0.3 },
];

const PRESETS: { id: string; label: string; s: Shocks }[] = [
  { id: "riskoff", label: "Risk-off", s: { rate: -50, equity: -20, credit: 120, fx: 5, oil: -15 } },
  { id: "hike", label: "Rate Hike", s: { rate: 100, equity: -6, credit: 30, fx: 3, oil: 5 } },
  { id: "soft", label: "Soft Landing", s: { rate: -25, equity: 8, credit: -20, fx: -2, oil: 5 } },
  { id: "crisis", label: "Credit Crisis", s: { rate: -75, equity: -30, credit: 250, fx: 8, oil: -25 } },
];

const ZERO: Shocks = { rate: 0, equity: 0, credit: 0, fx: 0, oil: 0 };

function sleeveReturn(sec: (typeof SECTORS)[number], s: Shocks) {
  return sec.eq * s.equity - sec.rateDur * (s.rate / 100) - sec.spreadDur * (s.credit / 100) + sec.fx * s.fx + sec.oil * s.oil * 0.1;
}

function ShockSlider({ label, unit, min, max, value, onChange }: { label: string; unit: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-neutral-600">{label}</span>
        <span className={`font-mono text-[11px] tabular-nums ${value > 0 ? "text-emerald-600" : value < 0 ? "text-rose-600" : "text-neutral-400"}`}>
          {value > 0 ? "+" : ""}
          {value}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer accent-indigo-600" />
    </div>
  );
}

function ScenarioAnalysis() {
  const [s, setS] = useState<Shocks>(PRESETS[0].s);
  const [preset, setPreset] = useState<string | null>("riskoff");
  const patch = (k: keyof Shocks, v: number) => {
    setS((cur) => ({ ...cur, [k]: v }));
    setPreset(null);
  };

  const rows = useMemo(() => SECTORS.map((sec) => ({ name: sec.name, contrib: (sec.w / 100) * sleeveReturn(sec, s) })).sort((a, b) => a.contrib - b.contrib), [s]);
  const total = rows.reduce((a, r) => a + r.contrib, 0);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.contrib)));

  return (
    <PortfolioShell title="Scenario Analysis" badge="Stress Test" subtitle="Instantaneous · $250M book">
      {() => (
        <div className="flex h-full min-h-0 flex-col gap-2.5 p-3 lg:flex-row">
          {/* controls */}
          <div className="flex w-72 shrink-0 flex-col gap-2.5 overflow-y-auto">
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Preset regime</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setS(p.s); setPreset(p.id); }} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${preset === p.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                    {p.label}
                  </button>
                ))}
                <button type="button" onClick={() => { setS(ZERO); setPreset(null); }} className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-50">Reset</button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-3.5 rounded-xl border border-neutral-200 bg-white p-3">
              <div className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Shocks</div>
              <ShockSlider label="Rates" unit="bp" min={-100} max={200} value={s.rate} onChange={(v) => patch("rate", v)} />
              <ShockSlider label="Equity" unit="%" min={-30} max={15} value={s.equity} onChange={(v) => patch("equity", v)} />
              <ShockSlider label="Credit spread" unit="bp" min={-50} max={250} value={s.credit} onChange={(v) => patch("credit", v)} />
              <ShockSlider label="USD" unit="%" min={-10} max={10} value={s.fx} onChange={(v) => patch("fx", v)} />
              <ShockSlider label="Oil" unit="%" min={-40} max={40} value={s.oil} onChange={(v) => patch("oil", v)} />
            </div>
          </div>

          {/* impact */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="grid shrink-0 grid-cols-3 gap-2">
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2">
                <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">Total P&amp;L Impact</div>
                <div className={`mt-0.5 font-mono text-2xl font-semibold tabular-nums ${total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {total > 0 ? "+" : ""}
                  {total.toFixed(2)}%
                </div>
                <div className="text-[11px] text-neutral-400">{total >= 0 ? "+" : "−"}${Math.abs((total / 100) * 250).toFixed(1)}M on $250M</div>
              </div>
              <StatTile label="Worst Sector" value={rows[0].name} sub={`${rows[0].contrib.toFixed(2)}%`} tone="neg" />
              <StatTile label="Best Sector" value={rows[rows.length - 1].name} sub={`${rows[rows.length - 1].contrib > 0 ? "+" : ""}${rows[rows.length - 1].contrib.toFixed(2)}%`} tone="pos" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-1 shrink-0 text-sm font-semibold text-neutral-900">P&amp;L Contribution by Sector</div>
              <div className="flex min-h-0 flex-1 flex-col justify-around">
                {rows.map((r) => {
                  const pos = r.contrib >= 0;
                  return (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-right text-[12px] text-neutral-600">{r.name}</span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-100">
                        <div className={`h-full rounded transition-all ${pos ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${(Math.abs(r.contrib) / maxAbs) * 100}%` }} />
                      </div>
                      <span className={`w-16 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums ${pos ? "text-emerald-600" : "text-rose-600"}`}>
                        {pos ? "+" : ""}
                        {r.contrib.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default ScenarioAnalysis;
