import { useMemo, useState } from "react";
import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Crowding & Positioning";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Hedge-fund crowding lens (benchmarked on Arcana): a positioning map of HF
   ownership vs short interest with long/short crowding scores. Click a name to
   inspect it and act; search and quadrant filters keep the read tight. */

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
  ["NVDA", "NVIDIA"], ["META", "Meta"], ["AMZN", "Amazon"], ["MSFT", "Microsoft"], ["GOOGL", "Alphabet"],
  ["TSLA", "Tesla"], ["AAPL", "Apple"], ["AVGO", "Broadcom"], ["AMD", "AMD"], ["NFLX", "Netflix"],
  ["CRM", "Salesforce"], ["UBER", "Uber"], ["COIN", "Coinbase"], ["PLTR", "Palantir"], ["SMCI", "Super Micro"],
  ["CVNA", "Carvana"], ["DKNG", "DraftKings"], ["SNOW", "Snowflake"], ["SHOP", "Shopify"], ["MSTR", "MicroStrategy"],
  ["ROKU", "Roku"], ["AFRM", "Affirm"], ["RIVN", "Rivian"], ["ENPH", "Enphase"],
];

interface Row {
  ticker: string;
  name: string;
  hfOwn: number;
  shortInt: number;
  dtc: number;
  flow: number;
  crowdLong: number;
  crowdShort: number;
  net: number;
}

const DATA: Row[] = (() => {
  const rng = mulberry32(0xc0d);
  return NAMES.map(([ticker, name]) => {
    const hfOwn = Math.round((6 + rng() * 34) * 10) / 10;
    const shortInt = Math.round((1 + rng() * 22) * 10) / 10;
    const dtc = Math.round((0.5 + rng() * 6) * 10) / 10;
    const flow = Math.round((rng() - 0.45) * 180);
    const crowdLong = Math.max(0, Math.min(100, Math.round(hfOwn * 1.9 + flow * 0.18)));
    const crowdShort = Math.max(0, Math.min(100, Math.round(shortInt * 3 + dtc * 4)));
    return { ticker, name, hfOwn, shortInt, dtc, flow, crowdLong, crowdShort, net: crowdLong - crowdShort };
  });
})();

const W = 560;
const H = 420;
const PAD = { l: 44, r: 16, t: 16, b: 38 };
const xMax = 42;
const yMax = 26;
const xTo = (v: number) => PAD.l + (v / xMax) * (W - PAD.l - PAD.r);
const yTo = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
const netLabel = (v: number) => (v > 35 ? "CROWDED LONG" : v < -35 ? "CROWDED SHORT" : "NEUTRAL");
const netColor = (v: number) => (v > 35 ? "#ef4444" : v < -35 ? "#3b82f6" : "#94a3b8");

function CrowdingPage() {
  const [side, setSide] = useState<"long" | "short">("long");
  const [quad, setQuad] = useState<"all" | "long" | "short">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("NVDA");

  const inQuad = (d: Row) => quad === "all" || (quad === "long" ? d.net > 35 : d.net < -35);
  const matches = (d: Row) => query === "" || d.ticker.toLowerCase().includes(query.toLowerCase()) || d.name.toLowerCase().includes(query.toLowerCase());
  const visible = (d: Row) => inQuad(d) && matches(d);

  const sorted = useMemo(
    () => DATA.filter(visible).sort((a, b) => (side === "long" ? b.crowdLong - a.crowdLong : b.crowdShort - a.crowdShort)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [side, quad, query],
  );
  const sel = selected ? DATA.find((d) => d.ticker === selected) ?? null : null;
  const topLong = [...DATA].sort((a, b) => b.crowdLong - a.crowdLong)[0];
  const topShort = [...DATA].sort((a, b) => b.crowdShort - a.crowdShort)[0];
  const crowdedCount = DATA.filter((d) => Math.abs(d.net) > 35).length;

  return (
    <PortfolioShell
      title="Crowding & Positioning"
      badge="HF Consensus"
      subtitle="13F + short interest"
      actions={
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5">
          {(["long", "short"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSide(s)} className={`rounded px-2.5 py-1 text-[12px] font-medium capitalize transition ${side === s ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {s}-side
            </button>
          ))}
        </div>
      }
    >
      {() => (
        <div className="flex h-full min-h-0 flex-col gap-2 p-3">
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Most Crowded Long" value={topLong.ticker} sub={`score ${topLong.crowdLong}`} tone="neg" />
            <StatTile label="Most Crowded Short" value={topShort.ticker} sub={`score ${topShort.crowdShort}`} />
            <StatTile label="Crowded Names" value={crowdedCount.toString()} sub={`of ${DATA.length}`} />
            <StatTile label="Avg HF Own" value={`${(DATA.reduce((s, d) => s + d.hfOwn, 0) / DATA.length).toFixed(0)}%`} />
          </div>

          <div className="flex min-h-0 flex-1 gap-3">
            {/* map */}
            <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Positioning Map</div>
                <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5 text-[11px]">
                  {(["all", "long", "short"] as const).map((q) => (
                    <button key={q} type="button" onClick={() => setQuad(q)} className={`rounded px-2 py-0.5 font-medium capitalize transition ${quad === q ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
                      {q === "all" ? "All" : q === "long" ? "Crowded L" : "Crowded S"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="viz h-full w-full">
                  <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="#fff" stroke="#e5e5e5" rx={8} />
                  <line x1={xTo(18)} y1={PAD.t} x2={xTo(18)} y2={H - PAD.b} stroke="#f1f1f1" />
                  <line x1={PAD.l} y1={yTo(8)} x2={W - PAD.r} y2={yTo(8)} stroke="#f1f1f1" />
                  {[0, 10, 20, 30, 40].map((v) => <text key={v} x={xTo(v)} y={H - PAD.b + 15} textAnchor="middle" className="fill-neutral-400" fontSize={9}>{v}%</text>)}
                  {[0, 10, 20].map((v) => <text key={v} x={PAD.l - 6} y={yTo(v) + 3} textAnchor="end" className="fill-neutral-400" fontSize={9}>{v}%</text>)}
                  <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 5} textAnchor="middle" className="fill-neutral-500" fontSize={10} fontWeight={600}>HF Ownership (% float)</text>
                  <text x={12} y={PAD.t + (H - PAD.t - PAD.b) / 2} textAnchor="middle" className="fill-neutral-500" fontSize={10} fontWeight={600} transform={`rotate(-90 12 ${PAD.t + (H - PAD.t - PAD.b) / 2})`}>Short Interest</text>
                  {DATA.map((d) => {
                    const vis = visible(d);
                    const isSel = selected === d.ticker;
                    return (
                      <g key={d.ticker} onClick={() => setSelected(d.ticker)} className="cursor-pointer">
                        <circle cx={xTo(d.hfOwn)} cy={yTo(d.shortInt)} r={isSel ? 9 : 6} fill={netColor(d.net)} fillOpacity={vis ? (isSel ? 0.95 : 0.55) : 0.1} stroke={isSel ? "#111" : "#fff"} strokeWidth={isSel ? 2 : 1.2} />
                        {(isSel || vis) && (isSel || d.hfOwn > 26 || d.shortInt > 16) && <text x={xTo(d.hfOwn)} y={yTo(d.shortInt) - 10} textAnchor="middle" className="fill-neutral-600" fontSize={9} fontWeight={700} opacity={vis ? 1 : 0.3}>{d.ticker}</text>}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* right: detail + leaderboard */}
            <div className="flex w-80 shrink-0 flex-col gap-2">
              {sel && (
                <div className="shrink-0 rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-base font-semibold text-neutral-900">{sel.ticker}</span>
                      <span className="ml-2 text-[12px] text-neutral-400">{sel.name}</span>
                    </div>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: netColor(sel.net) }}>{netLabel(sel.net)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                    {[["HF Own", `${sel.hfOwn}%`], ["Short Int", `${sel.shortInt}%`], ["Days to Cover", `${sel.dtc}`], ["30d Flow", `${sel.flow > 0 ? "+" : ""}${sel.flow}`], ["Crowd Long", `${sel.crowdLong}`], ["Crowd Short", `${sel.crowdShort}`]].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-neutral-100 py-0.5">
                        <span className="text-neutral-500">{k}</span>
                        <span className="font-mono tabular-nums text-neutral-800">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-500">Add to hedge basket</button>
                    <button type="button" className="rounded-md border border-neutral-200 px-2 py-1.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50">Flag</button>
                  </div>
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3">
                <div className="relative mb-2 shrink-0">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names…" className="h-7 w-full rounded-md border border-neutral-200 bg-white pl-7 pr-2 text-[12px] outline-none focus:border-indigo-400" />
                  <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2 top-1.5 h-4 w-4 text-neutral-400"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" /></svg>
                </div>
                <div className="mb-1.5 shrink-0 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">{side}-side leaderboard</div>
                <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                  {sorted.map((d) => {
                    const score = side === "long" ? d.crowdLong : d.crowdShort;
                    return (
                      <button key={d.ticker} type="button" onClick={() => setSelected(d.ticker)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12px] transition ${selected === d.ticker ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-neutral-50"}`}>
                        <span className="w-11 shrink-0 text-left font-mono font-semibold text-neutral-800">{d.ticker}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                          <div className={`h-full rounded-full ${side === "long" ? "bg-rose-400" : "bg-sky-400"}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className="w-7 shrink-0 text-right font-mono tabular-nums text-neutral-700">{score}</span>
                      </button>
                    );
                  })}
                  {sorted.length === 0 && <div className="mt-6 text-center text-[12px] text-neutral-400">No matches</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default CrowdingPage;
