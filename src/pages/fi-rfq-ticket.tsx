import { useEffect, useState } from "react";
import { TerminalShell } from "../components/fi-terminal/TerminalShell";
import { Panel, Row, Segmented, SideToggle, Stat, Tag } from "../components/fi-terminal/ui";
import { moveText, sideBg, sideText, t, type Side } from "../components/fi-terminal/tokens";
import {
  BONDS, DEALERS, SETTLE_T1, accrued, bondById, midAnalytics, seeded, shortName, spreadFromYield, yieldFromPrice, type Bond,
} from "../components/fi-terminal/bonds";
import { openWith, readHandoff, writeHandoff } from "../components/fi-terminal/selection";
import { date, mm, signed, usd } from "../components/fi-terminal/format";

export const title = "FI · Multi-Dealer RFQ";
export const section = "trading";
export const fullWidth = true;

/* FI Terminal · 2 of 5 — RFQ.
 *
 * Buy-side request-for-quote, the way most corporate bonds actually trade:
 * pick a bond, a side and a size, put it in competition with up to five
 * dealers, and watch the quote stack fill in against a countdown.
 *
 * Design rules:
 *   · The direction is stated in words everywhere ("You BUY", "Lift"), not
 *     only by colour — a mis-sided trade is the costliest error on a desk.
 *   · Best and cover are labelled, not implied by sort order.
 *   · Every quote is shown against the composite, so "good" has a reference.
 *   · One primary action at a time: Send → Lift/Hit best → New RFQ. */

type Phase = "draft" | "live" | "done" | "expired";

type Quote = {
  dealer: string;
  delay: number; // seconds until the dealer responds
  pass: boolean;
  price: number;
  size: number;
};

const SIZES = [1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000];
const TIMERS = [
  { id: "15", label: "15s" },
  { id: "30", label: "30s" },
  { id: "60", label: "60s" },
] as const;
const FUNDS = ["IG CORE FUND", "LONG CREDIT", "MULTI-ASSET INC"];
const MAX_DEALERS = 5;

function axesFor(b: Bond) {
  const r = seeded(b.id.length * 97 + Math.round(b.coupon * 1000));
  const axes = DEALERS.filter(() => r() < 0.3).map((d) => ({ code: d.code, side: (r() < 0.5 ? "Buy" : "Sell") as Side, size: 2 + Math.floor(r() * 20) }));
  // Every bond has at least one axed dealer — the street always has a view.
  return axes.length ? axes : [{ code: DEALERS[3].code, side: "Sell" as Side, size: 10 }];
}

function buildQuotes(b: Bond, side: Side, face: number, dealers: string[], seed: number): Quote[] {
  const r = seeded(seed);
  const axes = axesFor(b);
  const half = 0.06 + (10 - b.liq) * 0.025 + (face >= 10_000_000 ? 0.04 : 0);
  return dealers.map((code) => {
    // An axe that matches our flow (they want to sell when we buy) means a sharper price.
    const axed = axes.some((a) => a.code === code && a.side !== side);
    const edge = (axed ? -0.05 : 0) + r() * 0.09 - 0.02;
    const px = side === "Buy" ? b.mid + half + edge : b.mid - half - edge;
    return {
      dealer: code,
      delay: 1.2 + r() * 9,
      pass: !axed && r() < 0.16,
      price: Math.round(px * 1000) / 1000,
      size: face,
    };
  });
}

export default function FiRfqTicket() {
  const init = readHandoff();
  const [bondId, setBondId] = useState(init.bondId);
  const [side, setSide] = useState<Side>(init.side);
  const [face, setFace] = useState(init.face);
  const [fund, setFund] = useState(FUNDS[0]);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]["id"]>("30");
  const [picked, setPicked] = useState<string[]>(["MSX", "HLB", "CRN", "VTX", "BRK"]);

  const [phase, setPhase] = useState<Phase>("draft");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [filled, setFilled] = useState<{ q: Quote; at: number } | null>(null);
  const [rfqNo, setRfqNo] = useState(40217);

  const bond = bondById(bondId);
  const comp = midAnalytics(bond);
  const axes = axesFor(bond);
  const limit = Number(timer);
  const remaining = Math.max(0, limit - elapsed);

  useEffect(() => {
    if (phase !== "live") return;
    // The clock starts when the RFQ goes live; reading it here keeps render pure.
    const startedAt = Date.now();
    const id = setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      setElapsed(e);
      if (e >= limit) setPhase("expired");
    }, 100);
    return () => clearInterval(id);
  }, [phase, limit]);

  // Escape cancels a live RFQ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "live") setPhase("expired");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const visible = quotes.filter((q) => elapsed >= q.delay || phase === "done" || phase === "expired");
  const responded = quotes.filter((q) => elapsed >= q.delay);
  const live = visible
    .filter((q) => !q.pass && elapsed >= q.delay)
    .sort((a, b) => (side === "Buy" ? a.price - b.price : b.price - a.price));
  const best = live[0];
  const cover = live[1];

  const editable = phase === "draft";

  function send() {
    setQuotes(buildQuotes(bond, side, face, picked, rfqNo + face / 1e6 + (side === "Buy" ? 1 : 2)));
    setElapsed(0);
    setFilled(null);
    setPhase("live");
    writeHandoff({ bondId, side, face });
  }

  function execute(q: Quote) {
    setFilled({ q, at: elapsed });
    setPhase("done");
  }

  function reset() {
    setPhase("draft");
    setQuotes([]);
    setElapsed(0);
    setFilled(null);
    setRfqNo((n) => n + 1);
  }

  function toggleDealer(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length >= MAX_DEALERS ? p : [...p, code]));
  }

  const verb = side === "Buy" ? "Lift" : "Hit";
  const compSide = side === "Buy" ? bond.mid + 0.125 : bond.mid - 0.125;

  return (
    <TerminalShell
      screen="RFQ"
      context={
        <span className="text-[11px] text-neutral-400">
          RFQ #{rfqNo} · <span className="text-neutral-100">{shortName(bond)}</span> · {bond.isin} · {bond.rating} · {bond.sector}
        </span>
      }
    >
      <div className="grid h-full grid-cols-[320px_minmax(0,1fr)_340px] gap-px bg-[#1c232d]">
        {/* ---------- Left: the request ---------- */}
        <Panel n={1} title="Request" bodyClassName="flex flex-col overflow-auto p-3">
          <SideToggle side={side} onChange={(s) => editable && setSide(s)} buyLabel="Buy" sellLabel="Sell" />
          <p className="mt-1.5 text-center text-[10px] text-neutral-500">
            You <span className={`font-bold ${sideText(side)}`}>{side.toUpperCase()}</span> · dealers quote you {side === "Buy" ? "an offer" : "a bid"}
          </p>

          <label className="mt-4 block">
            <span className={t.colHead}>Instrument</span>
            <select
              value={bondId}
              disabled={!editable}
              onChange={(e) => setBondId(e.target.value)}
              className={`mt-1 w-full ${t.input} disabled:opacity-60`}
            >
              {BONDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {shortName(b)} · {b.rating}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <span className={t.colHead}>Size (face)</span>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!editable}
                  onClick={() => setFace(s)}
                  className={`py-1.5 text-[11px] ${t.focus} ${face === s ? "bg-amber-400 font-bold text-black" : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]"} disabled:cursor-not-allowed`}
                >
                  {mm(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className={t.colHead}>Account</span>
              <select value={fund} disabled={!editable} onChange={(e) => setFund(e.target.value)} className={`mt-1 w-full ${t.input} text-[11px] disabled:opacity-60`}>
                {FUNDS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <div>
              <span className={t.colHead}>Settle</span>
              <p className={`mt-1 ${t.input} text-[11px]`}>T+1 · {date(SETTLE_T1)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className={t.colHead}>Response window</span>
            <Segmented label="Response window" value={timer} options={TIMERS} onChange={(v) => editable && setTimer(v)} />
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className={t.colHead}>Dealers</span>
            <span className={`text-[10px] ${picked.length === MAX_DEALERS ? "text-amber-300" : "text-neutral-500"}`}>
              {picked.length}/{MAX_DEALERS} selected
            </span>
          </div>
          <ul className={`mt-1 divide-y border ${t.border} ${t.divide}`}>
            {DEALERS.map((dl) => {
              const on = picked.includes(dl.code);
              const axe = axes.find((a) => a.code === dl.code);
              const helpful = axe && axe.side !== side;
              return (
                <li key={dl.code}>
                  <label className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[11px] ${t.hover} ${!editable ? "cursor-default opacity-70" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!editable || (!on && picked.length >= MAX_DEALERS)}
                      onChange={() => toggleDealer(dl.code)}
                      className="accent-amber-400"
                    />
                    <span className="w-9 font-bold text-neutral-100">{dl.code}</span>
                    <span className="flex-1 truncate text-neutral-500">{dl.name}</span>
                    {axe && <Tag tone={helpful ? "up" : "neutral"}>axe {axe.side === "Buy" ? "bid" : "offer"}</Tag>}
                    <span className="w-8 text-right tabular-nums text-neutral-400">{dl.hitRate}%</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[10px] text-neutral-600">% = your hit rate with the dealer, last 90 days. Green axe = dealer wants the other side of your trade.</p>

          <div className="flex-1" />
          {phase === "draft" ? (
            <button type="button" onClick={send} disabled={picked.length === 0} className={`mt-4 py-3 text-[12px] font-bold uppercase tracking-widest ${t.action} ${t.focus} disabled:opacity-40`}>
              Send RFQ · {side} {mm(face)} to {picked.length}
            </button>
          ) : (
            <button type="button" onClick={reset} className={`mt-4 py-3 text-[12px] font-bold uppercase tracking-widest ${t.ghost} ${t.focus}`}>
              {phase === "live" ? "Cancel RFQ (Esc)" : "New RFQ"}
            </button>
          )}
        </Panel>

        {/* ---------- Centre: the quote stack ---------- */}
        <div className="flex min-h-0 flex-col gap-px">
          <Panel
            n={2}
            title="Live quotes"
            className="min-h-0 flex-1"
            bodyClassName="flex flex-col"
            actions={
              <span className="text-[10px] text-neutral-500">
                {phase === "draft" && "Not sent"}
                {phase === "live" && `${responded.length}/${quotes.length} responded`}
                {phase === "done" && "Done"}
                {phase === "expired" && "Closed"}
              </span>
            }
          >
            {/* Countdown */}
            <div className={`shrink-0 border-b ${t.border} px-3 py-2.5`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px]">
                  {phase === "draft" && <span className="text-neutral-500">Ready to send · {picked.length} dealers in competition</span>}
                  {phase === "live" && <span className="text-amber-300">In competition · dealers quoting</span>}
                  {phase === "done" && <span className="text-emerald-400">Traded · {filled ? `${(filled.at).toFixed(1)}s` : ""}</span>}
                  {phase === "expired" && <span className="text-rose-400">Window closed · no trade</span>}
                </span>
                <span className={`text-2xl font-semibold tabular-nums ${phase === "live" && remaining < 6 ? "text-rose-400" : "text-neutral-100"}`}>
                  0:{String(Math.ceil(phase === "draft" ? limit : remaining)).padStart(2, "0")}
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-white/[0.06]">
                <div
                  className={`h-1 transition-[width] duration-100 ${phase === "live" && remaining < 6 ? "bg-rose-400" : "bg-amber-400"}`}
                  style={{ width: `${phase === "draft" ? 100 : phase === "live" ? (remaining / limit) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead className={`sticky top-0 ${t.panel}`}>
                  <tr className={`border-b ${t.border}`}>
                    {["#", "Dealer", "Status", side === "Buy" ? "Offer px" : "Bid px", "Yield", "Spread", "vs Comp", "Size", "Time", ""].map((h, i) => (
                      <th key={h || i} className={`px-2 py-1.5 ${i < 3 ? "text-left" : "text-right"} ${t.colHead}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phase === "draft" &&
                    picked.map((code) => (
                      <tr key={code} className={`border-b ${t.border}`}>
                        <td className="px-2 py-2 text-neutral-600">—</td>
                        <td className="px-2 py-2 font-bold text-neutral-400">{code}</td>
                        <td className="px-2 py-2 text-neutral-600" colSpan={8}>Waiting for send</td>
                      </tr>
                    ))}
                  {phase !== "draft" &&
                    [...quotes]
                      .sort((a, b) => {
                        const ra = live.indexOf(a);
                        const rb = live.indexOf(b);
                        return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || a.delay - b.delay;
                      })
                      .map((q) => {
                        const arrived = elapsed >= q.delay || phase !== "live";
                        const rank = live.indexOf(q);
                        const isBest = q === best;
                        const isCover = q === cover;
                        const isFilled = filled?.q === q;
                        const yld = yieldFromPrice(bond, q.price);
                        const sprd = spreadFromYield(bond, yld);
                        // Positive = better than composite for us.
                        const vsComp = (side === "Buy" ? compSide - q.price : q.price - compSide) * 100;
                        const timedOut = !arrived || (phase !== "live" && elapsed < q.delay);
                        return (
                          <tr
                            key={q.dealer}
                            className={`border-b ${t.border} ${isFilled ? "bg-emerald-500/10" : isBest && phase === "live" ? "bg-amber-400/[0.07]" : ""}`}
                          >
                            <td className="px-2 py-2 text-neutral-500">{rank >= 0 ? rank + 1 : "—"}</td>
                            <td className="px-2 py-2 font-bold text-neutral-100">{q.dealer}</td>
                            <td className="px-2 py-2">
                              {timedOut ? (
                                phase === "live" ? <span className="animate-pulse text-neutral-500">Pricing…</span> : <span className="text-neutral-600">No response</span>
                              ) : q.pass ? (
                                <span className="text-neutral-500">Passed</span>
                              ) : isFilled ? (
                                <Tag tone="up">Done</Tag>
                              ) : isBest ? (
                                <Tag tone="amber">Best</Tag>
                              ) : isCover ? (
                                <Tag>Cover</Tag>
                              ) : (
                                <span className="text-neutral-400">Firm</span>
                              )}
                            </td>
                            {timedOut || q.pass ? (
                              <td colSpan={7} />
                            ) : (
                              <>
                                <td className={`px-2 py-2 text-right text-[13px] font-semibold ${isBest ? "text-amber-300" : "text-neutral-100"}`}>{q.price.toFixed(3)}</td>
                                <td className="px-2 py-2 text-right text-neutral-300">{yld.toFixed(3)}</td>
                                <td className="px-2 py-2 text-right text-neutral-300">{sprd.toFixed(1)}</td>
                                <td className={`px-2 py-2 text-right ${moveText(vsComp)}`}>{signed(vsComp, 1)}¢</td>
                                <td className="px-2 py-2 text-right text-neutral-400">{mm(q.size)}</td>
                                <td className="px-2 py-2 text-right text-neutral-500">{q.delay.toFixed(1)}s</td>
                                <td className="px-2 py-1.5 text-right">
                                  {phase === "live" && (
                                    <button
                                      type="button"
                                      onClick={() => execute(q)}
                                      className={`px-2.5 py-1 text-[10px] font-bold uppercase ${isBest ? sideBg(side) : t.ghost} ${t.focus}`}
                                      aria-label={`${verb} ${q.dealer} at ${q.price.toFixed(3)}`}
                                    >
                                      {verb}
                                    </button>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Primary action / outcome */}
            <div className={`shrink-0 border-t ${t.border} p-3`}>
              {phase === "live" && (
                <button
                  type="button"
                  disabled={!best}
                  onClick={() => best && execute(best)}
                  className={`w-full py-3 text-[13px] font-bold uppercase tracking-widest ${sideBg(side)} ${t.focus} disabled:cursor-wait disabled:opacity-40`}
                >
                  {best ? `${verb} best · ${side} ${mm(face)} @ ${best.price.toFixed(3)} from ${best.dealer}` : "Waiting for first quote…"}
                </button>
              )}
              {phase === "draft" && <p className="py-2 text-center text-[11px] text-neutral-500">Quotes appear here as dealers respond. Best and cover are labelled.</p>}
              {phase === "expired" && (
                <p className="py-2 text-center text-[11px] text-neutral-400">
                  Window closed without a trade. {live.length > 0 ? `Best was ${best.price.toFixed(3)} (${best.dealer}).` : ""} Start a new RFQ to re-quote.
                </p>
              )}
              {phase === "done" && filled && <Confirmation bond={bond} side={side} face={face} fund={fund} q={filled.q} cover={cover && cover !== filled.q ? cover : live.find((l) => l !== filled.q)} rfqNo={rfqNo} compSide={compSide} />}
            </div>
          </Panel>
        </div>

        {/* ---------- Right: instrument context ---------- */}
        <div className="flex min-h-0 flex-col gap-px">
          <Panel n={3} title="Composite · COMP" bodyClassName="p-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Bid" value={(bond.mid - 0.125).toFixed(3)} valueClass={side === "Sell" ? "text-rose-300" : t.value} />
              <Stat label="Mid" value={bond.mid.toFixed(3)} />
              <Stat label="Ask" value={(bond.mid + 0.125).toFixed(3)} valueClass={side === "Buy" ? "text-sky-300" : t.value} />
            </div>
            <div className="mt-3 text-[11px]">
              <Row k="Mid yield" v={`${comp.yld.toFixed(3)}%`} />
              <Row k={`G-spread vs ${bond.bench}`} v={`${comp.spread.toFixed(1)} bp`} />
              <Row k="PV01 / 1MM" v={`$${usd(comp.pv01 * 10_000)}`} />
              <Row k="Accrued" v={`${accrued(bond).amount.toFixed(4)} · ${accrued(bond).days}d`} />
              <Row k="Liquidity score" v={`${bond.liq}/10`} vClass={bond.liq >= 7 ? "text-emerald-300" : bond.liq >= 5 ? "text-amber-300" : "text-rose-300"} />
              <Row k="Outstanding" v={`$${usd(bond.outstanding)}MM`} />
            </div>
          </Panel>

          <Panel n={4} title="TRACE prints · today" className="min-h-0 flex-1" bodyClassName="overflow-auto">
            <Trace bond={bond} />
          </Panel>

          <Panel n={5} title="Your position" bodyClassName="p-3 text-[11px]">
            <Row k={fund} v={`${mm(8_000_000)} long`} />
            <Row k="After this trade" v={`${mm(side === "Buy" ? 8_000_000 + face : Math.max(0, 8_000_000 - face))}${side === "Sell" && face > 8_000_000 ? " · short!" : ""}`} vClass={side === "Sell" && face > 8_000_000 ? "text-rose-400" : t.value} />
            <Row k="Issuer limit used" v={`${side === "Buy" ? 61 + Math.round(face / 1e6) : 61 - Math.round(face / 1e6)}%`} />
            <button type="button" onClick={() => openWith("fi-bond-ticket", { bondId, side, face })} className={`mt-2 w-full py-1.5 text-[10px] font-semibold uppercase tracking-wider ${t.ghost} ${t.focus}`}>
              Open full order ticket →
            </button>
          </Panel>
        </div>
      </div>
    </TerminalShell>
  );
}

function Confirmation({ bond, side, face, fund, q, cover, rfqNo, compSide }: {
  bond: Bond; side: Side; face: number; fund: string; q: Quote; cover?: Quote; rfqNo: number; compSide: number;
}) {
  const ai = accrued(bond);
  const principal = (q.price / 100) * face;
  const acc = (ai.amount / 100) * face;
  const yld = yieldFromPrice(bond, q.price);
  const savedVsComp = (side === "Buy" ? compSide - q.price : q.price - compSide) * face / 100;
  const coverDiff = cover ? Math.abs(cover.price - q.price) * 100 : 0;
  return (
    <div className="border border-emerald-500/40 bg-emerald-500/[0.06] p-3" role="status">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-bold text-emerald-300">
          Done · You {side === "Buy" ? "bought" : "sold"} {mm(face)} {shortName(bond)} @ {q.price.toFixed(3)} from {q.dealer}
        </p>
        <span className="text-[10px] text-neutral-500">T-{rfqNo}-{q.dealer}</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-3 text-[11px]">
        <Stat label="Yield" value={`${yld.toFixed(3)}%`} />
        <Stat label="Principal" value={`$${usd(principal)}`} />
        <Stat label="Accrued" value={`$${usd(acc)}`} sub={`${ai.days} days`} />
        <Stat label="Net money" value={`$${usd(principal + acc)}`} />
        <Stat label="vs Comp" value={`${savedVsComp >= 0 ? "+" : "−"}$${usd(Math.abs(savedVsComp))}`} valueClass={moveText(savedVsComp)} sub={cover ? `Cover ${cover.price.toFixed(3)} · ${coverDiff.toFixed(1)}¢ away` : "No cover"} />
      </div>
      <p className="mt-2 text-[10px] text-neutral-500">Booked to {fund} · settles {date(SETTLE_T1)} · sent to OMS and confirmation matching.</p>
    </div>
  );
}

function Trace({ bond }: { bond: Bond }) {
  const r = seeded(bond.outstanding + bond.id.length);
  const rows = Array.from({ length: 12 }, (_, i) => {
    const side = r() < 0.5 ? "B" : "S";
    const px = bond.mid + (side === "B" ? 0.08 : -0.08) + (r() - 0.5) * 0.18;
    const size = r() < 0.3 ? "5MM+" : `${(0.25 + Math.floor(r() * 18) * 0.25).toFixed(2)}MM`;
    // Newest first: walk back from 15:58 in uneven steps.
    const mins = 15 * 60 + 58 - Math.round(i * 23 + r() * 15);
    return { time: `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`, side, px, size };
  });
  return (
    <table className="w-full text-[11px] tabular-nums">
      <thead className={`sticky top-0 ${t.panel}`}>
        <tr className={`border-b ${t.border}`}>
          <th className={`px-2.5 py-1 text-left ${t.colHead}`}>Time</th>
          <th className={`py-1 text-left ${t.colHead}`}>Side</th>
          <th className={`py-1 text-right ${t.colHead}`}>Price</th>
          <th className={`px-2.5 py-1 text-right ${t.colHead}`}>Size</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => (
          <tr key={i} className={`border-b ${t.border}`}>
            <td className="px-2.5 py-1 text-neutral-500">{p.time}</td>
            <td className={`py-1 ${p.side === "B" ? "text-sky-400" : "text-rose-400"}`}>{p.side === "B" ? "D→C" : "C→D"}</td>
            <td className="py-1 text-right text-neutral-100">{p.px.toFixed(3)}</td>
            <td className="px-2.5 py-1 text-right text-neutral-400">{p.size}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
