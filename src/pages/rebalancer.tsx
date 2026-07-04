import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Rebalancer";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Target-vs-current drift monitor with tolerance bands and an auto-generated
   trade list to bring the book back to policy weights (Charles River / Aladdin
   rebalancing workflow). */

const NAV = 250_000_000; // $
const TOL = 2; // ± tolerance %

const SLEEVES = [
  { name: "US Equity", target: 35, current: 38.2 },
  { name: "Intl Equity", target: 18, current: 15.4 },
  { name: "EM Equity", target: 8, current: 9.1 },
  { name: "IG Credit", target: 15, current: 13.2 },
  { name: "HY Credit", target: 6, current: 7.3 },
  { name: "Treasuries", target: 10, current: 8.6 },
  { name: "Real Estate", target: 5, current: 5.4 },
  { name: "Commodities", target: 3, current: 2.8 },
];

const DRIFT_DOM = [-6, 6];
const dzero = ((0 - DRIFT_DOM[0]) / (DRIFT_DOM[1] - DRIFT_DOM[0])) * 100;
const dpct = (v: number) => ((v - DRIFT_DOM[0]) / (DRIFT_DOM[1] - DRIFT_DOM[0])) * 100;
const fmtUsd = (v: number) => `${v < 0 ? "−" : "+"}$${(Math.abs(v) / 1e6).toFixed(2)}M`;

function Rebalancer() {
  const [onlyBreaches, setOnlyBreaches] = useState(false);

  const rows = useMemo(
    () =>
      SLEEVES.map((s) => {
        const drift = Math.round((s.current - s.target) * 10) / 10;
        const breach = Math.abs(drift) > TOL;
        const trade = -(drift / 100) * NAV; // sell overweight, buy underweight
        return { ...s, drift, breach, trade };
      }),
    [],
  );

  const shown = onlyBreaches ? rows.filter((r) => r.breach) : rows;
  const maxDrift = Math.max(...rows.map((r) => Math.abs(r.drift)));
  const breaches = rows.filter((r) => r.breach).length;
  const turnover = rows.reduce((s, r) => s + Math.abs(r.trade), 0) / 2;
  const cost = (turnover * 0.0005) / 1e3; // 5bp, in $k

  return (
    <PortfolioShell
      title="Rebalancer"
      badge="Policy Drift"
      subtitle={`NAV $${(NAV / 1e6).toFixed(0)}M · tolerance ±${TOL}%`}
      actions={
        <button
          type="button"
          onClick={() => setOnlyBreaches((v) => !v)}
          className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {onlyBreaches ? "Show all" : "Breaches only"}
        </button>
      }
    >
      {() => (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Max Drift" value={`${maxDrift.toFixed(1)}%`} tone={maxDrift > TOL ? "neg" : "pos"} />
            <StatTile label="Over Tolerance" value={breaches.toString()} tone={breaches ? "neg" : "pos"} />
            <StatTile label="Turnover" value={`$${(turnover / 1e6).toFixed(1)}M`} sub={`${((turnover / NAV) * 100).toFixed(1)}% of NAV`} />
            <StatTile label="Est. Cost" value={`$${cost.toFixed(0)}k`} sub="@ 5bp" />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-900">Allocation Drift</div>
              <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-400/60" /> within band</span>
                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-rose-400" /> breach</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                    <th className="py-1.5 pr-4">Sleeve</th>
                    <th className="py-1.5 pr-4 text-right">Target</th>
                    <th className="py-1.5 pr-4 text-right">Current</th>
                    <th className="py-1.5 pr-4" style={{ minWidth: 220 }}>Drift</th>
                    <th className="py-1.5 text-right">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.name} className="border-b border-neutral-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-neutral-800">{r.name}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-neutral-500">{r.target.toFixed(0)}%</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-neutral-800">{r.current.toFixed(1)}%</td>
                      <td className="py-2 pr-4">
                        <div className="relative h-5 w-full rounded bg-neutral-100">
                          <div className="absolute inset-y-0 rounded bg-emerald-400/25" style={{ left: `${dpct(-TOL)}%`, width: `${dpct(TOL) - dpct(-TOL)}%` }} />
                          <div className="absolute inset-y-0 w-px bg-neutral-300" style={{ left: `${dzero}%` }} />
                          <div
                            className={`absolute inset-y-1 rounded ${r.breach ? "bg-rose-400" : "bg-indigo-400"}`}
                            style={r.drift >= 0 ? { left: `${dzero}%`, width: `${dpct(r.drift) - dzero}%` } : { left: `${dpct(r.drift)}%`, width: `${dzero - dpct(r.drift)}%` }}
                          />
                          <span className={`absolute inset-y-0 flex items-center px-1 font-mono text-[11px] tabular-nums ${r.drift >= 0 ? "text-emerald-700" : "text-rose-700"}`} style={{ left: r.drift >= 0 ? `${dpct(r.drift) + 1}%` : undefined, right: r.drift < 0 ? `${100 - dpct(r.drift) + 1}%` : undefined }}>
                            {r.drift > 0 ? "+" : ""}
                            {r.drift.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className={`py-2 text-right font-mono text-[12px] font-semibold tabular-nums ${r.trade >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.trade === 0 ? "—" : fmtUsd(r.trade)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className="h-8 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-500">
                Generate {breaches} rebalance trades
              </button>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default Rebalancer;
