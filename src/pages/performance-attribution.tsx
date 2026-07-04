import { useMemo } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Performance Attribution";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Brinson-Fachler attribution: splits active return into allocation vs
   selection by sector, with a cumulative portfolio-vs-benchmark track
   (FactSet / Bloomberg PORT performance lens). */

const SECTORS = [
  { name: "Technology", wp: 28, wb: 24, rp: 12.5, rb: 10.2 },
  { name: "Financials", wp: 16, wb: 18, rp: 6.1, rb: 7.0 },
  { name: "Health Care", wp: 12, wb: 14, rp: 8.0, rb: 8.5 },
  { name: "Consumer", wp: 14, wb: 13, rp: 5.5, rb: 4.8 },
  { name: "Industrials", wp: 10, wb: 11, rp: 9.2, rb: 8.0 },
  { name: "Energy", wp: 8, wb: 6, rp: 15.0, rb: 13.5 },
  { name: "Utilities", wp: 6, wb: 8, rp: 3.0, rb: 3.5 },
  { name: "Materials", wp: 6, wb: 6, rp: 7.0, rb: 6.2 },
];

const BENCH_CUM = [0, 0.9, 1.7, 1.4, 2.8, 3.6, 3.3, 4.7, 5.6, 6.4, 7.0, 7.5, 7.86];
const PORT_CUM = [0, 1.1, 2.1, 1.9, 3.3, 4.3, 4.0, 5.5, 6.5, 7.4, 8.0, 8.5, 8.93];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", ""];

const CW = 640;
const CH = 300;
const CP = { l: 40, r: 16, t: 16, b: 30 };

function Delta({ v, digits = 2 }: { v: number; digits?: number }) {
  return (
    <span className={`font-mono tabular-nums ${v > 0.001 ? "text-emerald-600" : v < -0.001 ? "text-rose-600" : "text-neutral-400"}`}>
      {v > 0 ? "+" : ""}
      {v.toFixed(digits)}
    </span>
  );
}

function PerformanceAttribution() {
  const { rows, Rb, Rp, allocTot, selTot } = useMemo(() => {
    const Rb = SECTORS.reduce((s, x) => s + (x.wb / 100) * x.rb, 0);
    const rows = SECTORS.map((x) => {
      const wpf = x.wp / 100;
      const wbf = x.wb / 100;
      const alloc = (wpf - wbf) * (x.rb - Rb);
      const sel = wpf * (x.rp - x.rb); // selection incl. interaction
      return { ...x, alloc, sel, total: alloc + sel };
    });
    const Rp = SECTORS.reduce((s, x) => s + (x.wp / 100) * x.rp, 0);
    return { rows, Rb, Rp, allocTot: rows.reduce((s, r) => s + r.alloc, 0), selTot: rows.reduce((s, r) => s + r.sel, 0) };
  }, []);

  const yMax = Math.max(...PORT_CUM, ...BENCH_CUM) + 1;
  const xTo = (i: number) => CP.l + (i / (MONTHS.length - 1)) * (CW - CP.l - CP.r);
  const yTo = (v: number) => CP.t + (1 - v / yMax) * (CH - CP.t - CP.b);
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${xTo(i).toFixed(1)},${yTo(v).toFixed(1)}`).join(" ");

  return (
    <PortfolioShell title="Performance Attribution" badge="Brinson-Fachler" subtitle="YTD · vs strategic benchmark">
      {() => (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Active Return" value={`${Rp - Rb > 0 ? "+" : ""}${(Rp - Rb).toFixed(2)}%`} tone={Rp - Rb >= 0 ? "pos" : "neg"} />
            <StatTile label="Allocation" value={`${allocTot > 0 ? "+" : ""}${allocTot.toFixed(2)}%`} tone={allocTot >= 0 ? "pos" : "neg"} />
            <StatTile label="Selection" value={`${selTot > 0 ? "+" : ""}${selTot.toFixed(2)}%`} tone={selTot >= 0 ? "pos" : "neg"} />
            <StatTile label="Portfolio / Bench" value={`${Rp.toFixed(1)} / ${Rb.toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* cumulative */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Cumulative Return</div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-indigo-600"><span className="h-0.5 w-3 bg-indigo-500" /> Portfolio</span>
                  <span className="flex items-center gap-1 text-neutral-500"><span className="h-0.5 w-3 bg-neutral-400" /> Benchmark</span>
                </div>
              </div>
              <svg viewBox={`0 0 ${CW} ${CH}`} className="viz h-auto w-full">
                <rect x={CP.l} y={CP.t} width={CW - CP.l - CP.r} height={CH - CP.t - CP.b} fill="#fff" stroke="#e5e5e5" rx={8} />
                {Array.from({ length: 5 }, (_, i) => {
                  const v = (yMax / 4) * i;
                  return (
                    <g key={i}>
                      <line x1={CP.l} y1={yTo(v)} x2={CW - CP.r} y2={yTo(v)} stroke="#f1f1f1" />
                      <text x={CP.l - 6} y={yTo(v) + 3} textAnchor="end" className="fill-neutral-400" fontSize={9}>{v.toFixed(0)}%</text>
                    </g>
                  );
                })}
                {MONTHS.map((m, i) => m && i % 2 === 0 ? (
                  <text key={i} x={xTo(i)} y={CH - CP.b + 14} textAnchor="middle" className="fill-neutral-400" fontSize={9}>{m}</text>
                ) : null)}
                <path d={line(BENCH_CUM)} fill="none" stroke="#a3a3a3" strokeWidth={2} />
                <path d={line(PORT_CUM)} fill="none" stroke="#4f46e5" strokeWidth={2.5} />
              </svg>
            </div>

            {/* allocation vs selection scatter-of-bars */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-neutral-900">Effect by Sector</div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const maxAbs = Math.max(...rows.map((x) => Math.abs(x.total))) || 1;
                  const pos = r.total >= 0;
                  const w = (Math.abs(r.total) / maxAbs) * 45;
                  return (
                    <div key={r.name} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-right text-[12px] text-neutral-600">{r.name}</span>
                      <div className="relative h-4 flex-1">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-300" />
                        <div className={`absolute inset-y-0.5 rounded ${pos ? "bg-emerald-500" : "bg-rose-400"}`} style={pos ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right"><Delta v={r.total} /></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* attribution table */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-neutral-900">Attribution Detail</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-neutral-200 text-right text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                    <th className="py-1.5 pr-4 text-left">Sector</th>
                    <th className="py-1.5 pr-4">Port Wt</th>
                    <th className="py-1.5 pr-4">Bench Wt</th>
                    <th className="py-1.5 pr-4">Port Ret</th>
                    <th className="py-1.5 pr-4">Bench Ret</th>
                    <th className="py-1.5 pr-4">Allocation</th>
                    <th className="py-1.5 pr-4">Selection</th>
                    <th className="py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-b border-neutral-100 text-right last:border-0">
                      <td className="py-1.5 pr-4 text-left font-medium text-neutral-800">{r.name}</td>
                      <td className="py-1.5 pr-4 font-mono tabular-nums text-neutral-600">{r.wp}%</td>
                      <td className="py-1.5 pr-4 font-mono tabular-nums text-neutral-600">{r.wb}%</td>
                      <td className="py-1.5 pr-4 font-mono tabular-nums text-neutral-600">{r.rp.toFixed(1)}%</td>
                      <td className="py-1.5 pr-4 font-mono tabular-nums text-neutral-600">{r.rb.toFixed(1)}%</td>
                      <td className="py-1.5 pr-4"><Delta v={r.alloc} /></td>
                      <td className="py-1.5 pr-4"><Delta v={r.sel} /></td>
                      <td className="py-1.5 font-semibold"><Delta v={r.total} /></td>
                    </tr>
                  ))}
                  <tr className="text-right font-semibold">
                    <td className="py-2 pr-4 text-left text-neutral-800">Total</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-neutral-500">100%</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-neutral-500">100%</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-neutral-700">{Rp.toFixed(1)}%</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-neutral-700">{Rb.toFixed(1)}%</td>
                    <td className="py-2 pr-4"><Delta v={allocTot} /></td>
                    <td className="py-2 pr-4"><Delta v={selTot} /></td>
                    <td className="py-2"><Delta v={Rp - Rb} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default PerformanceAttribution;
