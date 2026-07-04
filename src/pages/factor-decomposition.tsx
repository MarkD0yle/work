import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Factor / Idio Split";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Factor vs idiosyncratic decomposition (Arcana's core lens): splits book risk
   and return into systematic factor exposure vs stock-specific idio (alpha).
   Click a position to drill into its single-stock decomposition. */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TICKERS = ["NVDA", "MSFT", "META", "JPM", "XOM", "UNH", "LLY", "COST", "CAT", "PLTR", "NEE", "V"];

interface Pos {
  ticker: string;
  weight: number;
  idioPct: number;
  totalRet: number;
  idioRet: number;
}

const POS: Pos[] = (() => {
  const rng = mulberry32(0x1d10);
  const raw = TICKERS.map((ticker) => {
    const idioPct = Math.round(30 + rng() * 55);
    const totalRet = Math.round((rng() * 24 - 4) * 10) / 10;
    const idioRet = Math.round(totalRet * (idioPct / 100) * (0.6 + rng() * 0.6) * 10) / 10;
    return { ticker, weight: 2 + rng() * 8, idioPct, totalRet, idioRet };
  });
  const sum = raw.reduce((s, r) => s + r.weight, 0);
  return raw.map((r) => ({ ...r, weight: Math.round((r.weight / sum) * 1000) / 10 }));
})();

const FACTORS = [
  { name: "Market", risk: 30, color: "#4f46e5" },
  { name: "Growth", risk: 12, color: "#0ea5e9" },
  { name: "Momentum", risk: 8, color: "#f59e0b" },
  { name: "Quality", risk: 7, color: "#10b981" },
  { name: "Value", risk: 5, color: "#a855f7" },
];

type SortKey = "idio" | "weight" | "alpha";

function FactorDecomposition() {
  const [selected, setSelected] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("idio");

  const port = useMemo(() => {
    const wsum = POS.reduce((s, p) => s + p.weight, 0) || 1;
    const idioVar = POS.reduce((s, p) => s + p.weight * p.idioPct, 0) / wsum;
    const totalRet = POS.reduce((s, p) => s + (p.weight / wsum) * p.totalRet, 0);
    const idioRet = POS.reduce((s, p) => s + (p.weight / wsum) * p.idioRet, 0);
    return { idioVar, totalRet, idioRet };
  }, []);

  const view = useMemo(() => {
    if (selected) {
      const p = POS.find((x) => x.ticker === selected)!;
      return { label: p.ticker, idioVar: p.idioPct, totalRet: p.totalRet, idioRet: p.idioRet };
    }
    return { label: "Portfolio", ...port };
  }, [selected, port]);
  const factorVar = 100 - view.idioVar;
  const factorRet = view.totalRet - view.idioRet;
  const factorTot = FACTORS.reduce((s, f) => s + f.risk, 0);

  const sorted = useMemo(
    () => [...POS].sort((a, b) => (sortBy === "idio" ? b.idioPct - a.idioPct : sortBy === "weight" ? b.weight - a.weight : b.idioRet - a.idioRet)),
    [sortBy],
  );

  return (
    <PortfolioShell title="Factor / Idio Split" badge="Alpha vs Beta" subtitle="Risk + realized return">
      {() => (
        <div className="flex h-full min-h-0 flex-col gap-2.5 p-3">
          {/* scope */}
          <div className="flex shrink-0 items-center gap-2 text-[12px]">
            <span className="text-neutral-400">Scope</span>
            <button type="button" onClick={() => setSelected(null)} className={`rounded-md px-2 py-1 font-medium transition ${!selected ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>Portfolio</button>
            {selected && (
              <button type="button" onClick={() => setSelected(null)} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 font-mono font-semibold text-indigo-700 ring-1 ring-indigo-200">
                {selected} <span className="text-indigo-400">✕</span>
              </button>
            )}
            <span className="ml-auto text-[11px] text-neutral-400">Click a position → single-stock decomposition</span>
          </div>

          {/* KPIs (view-aware) */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Idio Risk" value={`${view.idioVar.toFixed(0)}%`} tone="pos" sub="stock-specific" />
            <StatTile label="Factor Risk" value={`${factorVar.toFixed(0)}%`} sub="systematic" />
            <StatTile label="Idio Return (α)" value={`${view.idioRet > 0 ? "+" : ""}${view.idioRet.toFixed(1)}%`} tone={view.idioRet >= 0 ? "pos" : "neg"} />
            <StatTile label="Factor Return" value={`${factorRet > 0 ? "+" : ""}${factorRet.toFixed(1)}%`} tone={factorRet >= 0 ? "pos" : "neg"} />
          </div>

          {/* main */}
          <div className="flex min-h-0 flex-1 gap-2.5">
            {/* left: decomposition + factor breakdown */}
            <div className="flex w-80 shrink-0 flex-col gap-2.5">
              <div className="shrink-0 rounded-xl border border-neutral-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold text-neutral-900">{view.label} · Decomposition</div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium">
                  <span className="text-emerald-600">Idio {view.idioVar.toFixed(0)}%</span>
                  <span className="text-indigo-600">Factor {factorVar.toFixed(0)}%</span>
                </div>
                <div className="flex h-5 w-full overflow-hidden rounded-md">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${view.idioVar}%` }} />
                  <div className="bg-indigo-500 transition-all" style={{ width: `${factorVar}%` }} />
                </div>
                <div className="mt-3 mb-1 flex items-center justify-between text-[11px] font-medium">
                  <span className="text-emerald-600">Alpha {view.idioRet > 0 ? "+" : ""}{view.idioRet.toFixed(1)}%</span>
                  <span className="text-indigo-600">Factor {factorRet > 0 ? "+" : ""}{factorRet.toFixed(1)}%</span>
                </div>
                <div className="flex h-5 w-full overflow-hidden rounded-md bg-neutral-100">
                  {view.totalRet > 0 ? (
                    <>
                      <div className="bg-emerald-500 transition-all" style={{ width: `${Math.max(0, (view.idioRet / view.totalRet) * 100)}%` }} />
                      <div className="bg-indigo-500 transition-all" style={{ width: `${Math.max(0, (factorRet / view.totalRet) * 100)}%` }} />
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
                <div className="mb-2 shrink-0 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Factor risk breakdown · portfolio</div>
                <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
                  {FACTORS.map((f) => (
                    <div key={f.name} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
                      <span className="flex-1 text-neutral-600">{f.name}</span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full" style={{ width: `${(f.risk / factorTot) * 100}%`, background: f.color }} />
                      </div>
                      <span className="w-9 text-right font-mono tabular-nums text-neutral-700">{((f.risk / factorTot) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* right: position list */}
            <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Position Idio / Factor Mix</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5 text-[11px]">
                    {(["idio", "weight", "alpha"] as SortKey[]).map((k) => (
                      <button key={k} type="button" onClick={() => setSortBy(k)} className={`rounded px-2 py-0.5 font-medium capitalize transition ${sortBy === k ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>{k}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500" /> idio</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-indigo-500" /> factor</span>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-around">
                {sorted.map((p) => {
                  const isSel = selected === p.ticker;
                  return (
                    <button key={p.ticker} type="button" onClick={() => setSelected(isSel ? null : p.ticker)} className={`flex items-center gap-3 rounded-md px-1.5 py-1 text-[12px] transition ${isSel ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-neutral-50"}`}>
                      <span className="w-12 shrink-0 text-left font-mono font-semibold text-neutral-800">{p.ticker}</span>
                      <span className="w-10 shrink-0 text-right font-mono tabular-nums text-neutral-500">{p.weight.toFixed(1)}%</span>
                      <div className="flex h-4 flex-1 overflow-hidden rounded">
                        <div className="bg-emerald-500" style={{ width: `${p.idioPct}%` }} />
                        <div className="bg-indigo-500" style={{ width: `${100 - p.idioPct}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono tabular-nums text-neutral-600">idio {p.idioPct}%</span>
                      <span className={`w-12 shrink-0 text-right font-mono tabular-nums ${p.idioRet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{p.idioRet > 0 ? "+" : ""}{p.idioRet.toFixed(1)}</span>
                    </button>
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

export default FactorDecomposition;
