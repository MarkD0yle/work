import { useEffect, useState } from "react";
import { TerminalShell } from "../components/fi-terminal/TerminalShell";
import { Panel, Row, Segmented, Stat, Tag } from "../components/fi-terminal/ui";
import { divergingHeat, moveText, t } from "../components/fi-terminal/tokens";
import { BONDS, DEALERS, seeded, shortName, type Bond } from "../components/fi-terminal/bonds";
import { mm, signed, usd } from "../components/fi-terminal/format";

export const title = "FI · BWIC List Sale";
export const section = "trading";
export const fullWidth = true;

/* FI Terminal · 4 of 5 — BWIC.
 *
 * Selling a whole list at once: a "bids wanted in competition". Fourteen
 * bonds went out to six dealers; the bids are in and the PM has minutes to
 * decide what trades.
 *
 * The grid is a heat map in disguise. Each dealer's bid is shaded by how
 * far it sits from our mark — green above (good for a seller), red below —
 * so a glance shows which dealers stepped up and which lines are soft.
 * Best and cover are marked in every row. A line only trades if its best
 * bid clears the reserve, unless the PM overrides it. */

const DEALER_CODES = DEALERS.slice(0, 6).map((d) => d.code);

type Line = {
  n: number;
  bond: Bond;
  face: number;
  mark: number;
  reserve: number;
  bids: (number | null)[]; // per dealer; null = did not bid
};

function buildLines(): Line[] {
  const pick = ["CHTR-34", "PARA-30", "F-30", "GM-33", "T-36", "VZ-32", "ORCL-34", "OXY-33", "DUK-34", "NEE-29", "CCL-29", "BA-35", "PLD-34", "MET-33"];
  return pick.map((id, i) => {
    const bond = BONDS.find((b) => b.id === id)!;
    const r = seeded(i * 977 + 13);
    const mark = Math.round((bond.mid - 0.05) * 1000) / 1000;
    const softness = (10 - bond.liq) * 0.06;
    const bids = DEALER_CODES.map((_, di) => {
      // Some dealers skip illiquid lines; the axed one is aggressive.
      if (r() < 0.12 + softness * 0.35) return null;
      const axe = (i + di) % 5 === 0 ? 0.18 : 0;
      const bid = mark - 0.12 - softness * 1.3 + axe + (r() - 0.45) * 0.4;
      return Math.round(bid * 1000) / 1000;
    });
    return {
      n: i + 1,
      bond,
      face: [10, 5, 15, 20, 10, 25, 15, 8, 6, 12, 10, 20, 5, 25][i] * 1_000_000,
      mark,
      reserve: Math.round((mark - 0.15 - softness * 0.2) * 1000) / 1000,
      bids,
    };
  });
}

const LINES = buildLines();

type View = "px" | "vsmark";
type Filter = "all" | "trade" | "dnt";

function rank(l: Line) {
  const sorted = l.bids
    .map((b, i) => ({ b, i }))
    .filter((x): x is { b: number; i: number } => x.b !== null)
    .sort((a, b) => b.b - a.b);
  return { best: sorted[0], cover: sorted[1], count: sorted.length };
}

export default function FiBwic() {
  const [view, setView] = useState<View>("vsmark");
  const [filter, setFilter] = useState<Filter>("all");
  const [override, setOverride] = useState<Record<number, boolean>>({});
  const [stage, setStage] = useState<"deciding" | "confirm" | "awarded">("deciding");
  const [left, setLeft] = useState(9 * 60 + 42);
  const [focus, setFocus] = useState(1);

  useEffect(() => {
    if (stage === "awarded") return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [stage]);

  const rows = LINES.map((l) => {
    const { best, cover, count } = rank(l);
    const clears = !!best && best.b >= l.reserve;
    const trade = override[l.n] ?? clears;
    return { l, best, cover, count, clears, trade: trade && !!best };
  });

  const shown = rows.filter((r) => filter === "all" || (filter === "trade" ? r.trade : !r.trade));
  const trading = rows.filter((r) => r.trade);
  const totalFace = LINES.reduce((a, l) => a + l.face, 0);
  const proceeds = trading.reduce((a, r) => a + (r.best!.b / 100) * r.l.face, 0);
  const vsMark = trading.reduce((a, r) => a + ((r.best!.b - r.l.mark) / 100) * r.l.face, 0);
  const bidsIn = LINES.reduce((a, l) => a + l.bids.filter((b) => b !== null).length, 0);
  const maxDev = 0.6;

  const dealerStats = DEALER_CODES.map((code, di) => {
    const wins = trading.filter((r) => r.best!.i === di);
    const bidsGiven = LINES.filter((l) => l.bids[di] !== null);
    const avg = bidsGiven.reduce((a, l) => a + (l.bids[di]! - l.mark), 0) / (bidsGiven.length || 1);
    return { code, wins: wins.length, face: wins.reduce((a, r) => a + r.l.face, 0), resp: bidsGiven.length, avg: avg * 100 };
  }).sort((a, b) => b.face - a.face);
  const maxFace = Math.max(...dealerStats.map((d) => d.face), 1);

  const fr = rows.find((r) => r.l.n === focus) ?? rows[0];
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <TerminalShell
      screen="BWIC"
      context={
        <span className="text-[11px] text-neutral-400">
          BWIC <span className="text-neutral-100">BW-1028-A</span> · IG CORE FUND · {LINES.length} lines · ${usd(totalFace / 1e6)}MM · all-or-none: <span className="text-neutral-100">No</span>
        </span>
      }
    >
      <div className="flex h-full flex-col gap-px bg-[#1c232d]">
        {/* Summary strip */}
        <div className={`grid shrink-0 grid-cols-8 gap-4 ${t.panel} px-4 py-2.5`}>
          <Stat label="Status" value={stage === "awarded" ? "Awarded" : "Bids in · deciding"} valueClass={stage === "awarded" ? "text-emerald-300" : "text-amber-300"} sub="Bids due 14:00 · closed" />
          <Stat label="Decide by" value={stage === "awarded" ? "—" : mmss} valueClass={left < 120 && stage !== "awarded" ? "text-rose-400" : t.value} sub="bids firm until 14:15" />
          <Stat label="Bids received" value={`${bidsIn}/${LINES.length * DEALER_CODES.length}`} sub={`${Math.round((bidsIn / (LINES.length * DEALER_CODES.length)) * 100)}% response`} />
          <Stat label="Lines trading" value={`${trading.length}/${LINES.length}`} sub={`${rows.filter((r) => !r.clears).length} below reserve`} />
          <Stat label="Face trading" value={`$${usd(trading.reduce((a, r) => a + r.l.face, 0) / 1e6)}MM`} sub={`of $${usd(totalFace / 1e6)}MM`} />
          <Stat label="Proceeds" value={`$${usd(proceeds / 1e6, 2)}MM`} sub="clean, ex-accrued" />
          <Stat label="vs Mark" value={`${vsMark >= 0 ? "+" : "−"}$${usd(Math.abs(vsMark))}`} valueClass={moveText(vsMark)} sub="P&L on award" />
          <div className="flex items-center justify-end">
            {stage === "deciding" && (
              <button type="button" onClick={() => setStage("confirm")} disabled={trading.length === 0} className={`px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest ${t.sellBg} ${t.focus} disabled:opacity-40`}>
                Award {trading.length} lines
              </button>
            )}
            {stage === "awarded" && <Tag tone="up">Tickets sent to {new Set(trading.map((r) => r.best!.i)).size} dealers</Tag>}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-px">
          <Panel
            n={1}
            title="Bid grid · best and cover per line"
            bodyClassName="relative overflow-auto"
            actions={
              <div className="flex items-center gap-2">
                <Segmented label="Filter lines" value={filter} options={[{ id: "all", label: "All" }, { id: "trade", label: "Trading" }, { id: "dnt", label: "DNT" }] as const} onChange={setFilter} />
                <Segmented label="Cell shows" value={view} options={[{ id: "vsmark", label: "vs Mark ¢" }, { id: "px", label: "Price" }] as const} onChange={setView} />
              </div>
            }
          >
            <table className="w-full border-separate border-spacing-0 text-[11px] tabular-nums">
              <thead className={`sticky top-0 z-10 ${t.panel}`}>
                <tr>
                  {["#", "Bond", "Face", "Mark", "Reserve"].map((h, i) => (
                    <th key={h} className={`border-b ${t.border} px-2 py-1.5 ${i < 2 ? "text-left" : "text-right"} ${t.colHead}`}>{h}</th>
                  ))}
                  {DEALER_CODES.map((c) => (
                    <th key={c} className={`border-b ${t.border} px-1 py-1.5 text-center ${t.colHead}`}>{c}</th>
                  ))}
                  {["Best", "Cover", "vs Mark", "Decision"].map((h, i) => (
                    <th key={h} className={`border-b ${t.border} px-2 py-1.5 ${i === 3 ? "text-center" : "text-right"} ${t.colHead}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(({ l, best, cover, clears, trade }) => {
                  const bestVs = best ? (best.b - l.mark) * 100 : 0;
                  const overridden = override[l.n] !== undefined;
                  return (
                    <tr key={l.n} onClick={() => setFocus(l.n)} className={`cursor-pointer ${focus === l.n ? "bg-amber-400/[0.06]" : t.hover} ${!trade ? "opacity-60" : ""}`}>
                      <td className={`border-b ${t.border} px-2 py-1 text-neutral-500`}>{l.n}</td>
                      <td className={`border-b ${t.border} px-2 py-1`}>
                        <span className="text-neutral-100">{shortName(l.bond)}</span>
                        <span className="ml-1.5 text-[10px] text-neutral-500">{l.bond.rating}</span>
                      </td>
                      <td className={`border-b ${t.border} px-2 py-1 text-right text-neutral-300`}>{mm(l.face)}</td>
                      <td className={`border-b ${t.border} px-2 py-1 text-right text-neutral-400`}>{l.mark.toFixed(3)}</td>
                      <td className={`border-b ${t.border} px-2 py-1 text-right text-neutral-500`}>{l.reserve.toFixed(3)}</td>
                      {l.bids.map((b, di) => {
                        const isBest = best?.i === di;
                        const isCover = cover?.i === di;
                        const dev = b === null ? 0 : b - l.mark;
                        return (
                          <td key={di} className={`border-b ${t.border} p-[2px]`}>
                            {b === null ? (
                              <div className="flex h-6 items-center justify-center text-neutral-700" aria-label="No bid">DNB</div>
                            ) : (
                              <div
                                className={`flex h-6 items-center justify-center ${isBest ? "font-bold text-amber-200 ring-1 ring-inset ring-amber-400" : isCover ? "text-neutral-100 ring-1 ring-inset ring-neutral-500" : "text-neutral-300"} ${b < l.reserve ? "line-through decoration-rose-400/70" : ""}`}
                                style={{ backgroundColor: divergingHeat(-dev / maxDev) }}
                                title={`${DEALER_CODES[di]} ${b.toFixed(3)} · ${signed(dev * 100)}¢ vs mark${isBest ? " · BEST" : isCover ? " · COVER" : ""}`}
                              >
                                {view === "px" ? b.toFixed(3) : signed(dev * 100, 1)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className={`border-b ${t.border} px-2 py-1 text-right font-semibold text-amber-200`}>{best ? best.b.toFixed(3) : "—"}</td>
                      <td className={`border-b ${t.border} px-2 py-1 text-right text-neutral-400`}>{cover ? cover.b.toFixed(3) : "—"}</td>
                      <td className={`border-b ${t.border} px-2 py-1 text-right ${moveText(bestVs)}`}>{best ? `${signed(bestVs, 1)}¢` : "—"}</td>
                      <td className={`border-b ${t.border} px-2 py-1 text-center`}>
                        <button
                          type="button"
                          disabled={!best || stage !== "deciding"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverride((o) => {
                              const next = { ...o };
                              const want = !trade;
                              if (want === clears) delete next[l.n];
                              else next[l.n] = want;
                              return next;
                            });
                          }}
                          aria-pressed={trade}
                          aria-label={`Line ${l.n} ${shortName(l.bond)}: ${trade ? "trading, click to hold back" : "do not trade, click to trade"}`}
                          className={`w-20 py-0.5 text-[10px] font-bold uppercase ${t.focus} ${trade ? "bg-rose-500/90 text-black" : "border border-neutral-700 text-neutral-500"} disabled:cursor-not-allowed`}
                        >
                          {!best ? "No bids" : trade ? "Trade" : "DNT"}
                          {overridden && " *"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className={`flex items-center gap-4 border-t ${t.border} px-3 py-2 text-[10px] text-neutral-500`}>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 ring-1 ring-inset ring-amber-400" /> Best</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 ring-1 ring-inset ring-neutral-500" /> Cover</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-4" style={{ backgroundColor: divergingHeat(-1) }} /> above mark</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-4" style={{ backgroundColor: divergingHeat(1) }} /> below mark</span>
              <span><span className="line-through decoration-rose-400">101.0</span> below reserve</span>
              <span>* = PM override of the reserve rule</span>
            </div>

            {stage === "confirm" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="bwic-confirm">
                <div className={`w-[460px] border ${t.borderStrong} ${t.raised} p-5`}>
                  <p id="bwic-confirm" className={t.label}>Award BWIC</p>
                  <p className="mt-3 text-[15px] leading-snug text-neutral-100">
                    You are <span className="font-bold text-rose-400">SELLING</span> {trading.length} lines, ${usd(trading.reduce((a, r) => a + r.l.face, 0) / 1e6)}MM face, to {new Set(trading.map((r) => r.best!.i)).size} dealers for ${usd(proceeds / 1e6, 2)}MM.
                  </p>
                  <div className="mt-3 text-[11px]">
                    <Row k="P&L vs mark" v={`${vsMark >= 0 ? "+" : "−"}$${usd(Math.abs(vsMark))}`} vClass={moveText(vsMark)} />
                    <Row k="Held back (DNT)" v={`${LINES.length - trading.length} lines`} />
                    <Row k="Overrides" v={`${Object.keys(override).length}`} />
                    <Row k="Cover sent to losing dealers" v="Yes · after award" />
                  </div>
                  <div className="mt-5 grid grid-cols-[1fr_2fr] gap-2">
                    <button type="button" onClick={() => setStage("deciding")} className={`py-2.5 text-[11px] font-semibold uppercase ${t.ghost} ${t.focus}`}>Back</button>
                    <button type="button" autoFocus onClick={() => setStage("awarded")} className={`py-2.5 text-[12px] font-bold uppercase tracking-widest ${t.sellBg} ${t.focus}`}>Confirm award</button>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <div className="flex min-h-0 flex-col gap-px">
            <Panel n={2} title={`Line ${fr.l.n} · ${shortName(fr.l.bond)}`} bodyClassName="p-3 text-[11px]">
              <div className="space-y-1">
                {fr.l.bids
                  .map((b, i) => ({ b, i }))
                  .sort((a, b) => (b.b ?? -1) - (a.b ?? -1))
                  .map(({ b, i }) => {
                    const w = b === null ? 0 : Math.max(4, ((b - (fr.l.mark - 1)) / 1.4) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-8 font-bold text-neutral-300">{DEALER_CODES[i]}</span>
                        <div className="relative h-4 flex-1 bg-white/[0.04]">
                          {b !== null && <div className={`h-4 ${fr.best?.i === i ? "bg-amber-400/70" : "bg-neutral-600/60"}`} style={{ width: `${Math.min(100, w)}%` }} />}
                          <div className="absolute inset-y-0 w-px bg-sky-400" style={{ left: `${((fr.l.mark - (fr.l.mark - 1)) / 1.4) * 100}%` }} title="Mark" />
                          <div className="absolute inset-y-0 w-px bg-rose-400" style={{ left: `${((fr.l.reserve - (fr.l.mark - 1)) / 1.4) * 100}%` }} title="Reserve" />
                        </div>
                        <span className="w-14 text-right tabular-nums text-neutral-200">{b === null ? "DNB" : b.toFixed(3)}</span>
                      </div>
                    );
                  })}
              </div>
              <p className="mt-2 flex gap-3 text-[10px] text-neutral-500">
                <span><span className="inline-block h-2 w-px bg-sky-400" /> mark {fr.l.mark.toFixed(3)}</span>
                <span><span className="inline-block h-2 w-px bg-rose-400" /> reserve {fr.l.reserve.toFixed(3)}</span>
              </p>
              <div className="mt-2">
                <Row k="Best − cover" v={fr.best && fr.cover ? `${((fr.best.b - fr.cover.b) * 100).toFixed(1)}¢` : "—"} />
                <Row k="Proceeds if traded" v={fr.best ? `$${usd((fr.best.b / 100) * fr.l.face)}` : "—"} />
                <Row k="Liquidity score" v={`${fr.l.bond.liq}/10`} />
              </div>
              <p className="mt-2 border-l-2 border-amber-400/60 pl-2 text-neutral-400">
                {!fr.best
                  ? "No dealer bid. Hold it back and try an all-to-all session."
                  : fr.clears
                    ? fr.cover && fr.best.b - fr.cover.b > 0.25
                      ? "Best is well clear of cover — the winner is likely axed. Good line to trade."
                      : "Clears reserve with a tight cover. Fair, competitive level."
                    : "Best bid is below reserve. Default is do-not-trade; override only with a reason."}
              </p>
            </Panel>

            <Panel n={3} title="Dealer scorecard" className="min-h-0 flex-1" bodyClassName="overflow-auto p-3">
              <table className="w-full text-[11px] tabular-nums">
                <thead>
                  <tr className={`border-b ${t.border}`}>
                    <th className={`py-1 text-left ${t.colHead}`}>Dealer</th>
                    <th className={`py-1 text-left ${t.colHead}`}>Won</th>
                    <th className={`py-1 text-right ${t.colHead}`}>Bids</th>
                    <th className={`py-1 text-right ${t.colHead}`}>Avg vs mk</th>
                  </tr>
                </thead>
                <tbody>
                  {dealerStats.map((d) => (
                    <tr key={d.code} className={`border-b ${t.border}`}>
                      <td className="py-1.5 font-bold text-neutral-200">{d.code}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 bg-white/[0.05]">
                            <div className="h-2 bg-amber-400/80" style={{ width: `${(d.face / maxFace) * 100}%` }} />
                          </div>
                          <span className="text-neutral-400">{d.wins} · {mm(d.face)}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right text-neutral-400">{d.resp}/{LINES.length}</td>
                      <td className={`py-1.5 text-right ${moveText(d.avg)}`}>{signed(d.avg, 1)}¢</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-neutral-600">Scorecard feeds the dealer panel review — dealers who rarely bid lose their slot.</p>
            </Panel>
          </div>
        </div>
      </div>
    </TerminalShell>
  );
}
