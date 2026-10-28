import { TerminalShell } from "../components/fi-terminal/TerminalShell";
import { Panel, Row, Segmented, SideToggle, Stat, Tag } from "../components/fi-terminal/ui";
import { moveText, sideBg, sideText, t, type Side } from "../components/fi-terminal/tokens";
import { BONDS, DEALERS, SETTLE_T1, accrued, shortName, spreadFromYield, yieldFromPrice, type Bond } from "../components/fi-terminal/bonds";
import { openWith } from "../components/fi-terminal/selection";
import { FUNDS, MAX_DEALERS, POSITION, SIZES, TIMERS, tracePrints, useRfq, type Quote } from "../components/fi-terminal/model/rfq";
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

export default function FiRfqTicket() {
  const {
    bondId, setBondId, side, setSide, face, setFace, fund, setFund, timer, setTimer, picked,
    phase, quotes, elapsed, filled, rfqNo, bond, comp, axes, limit, remaining,
    responded, live, best, cover, ordered, editable,
    send, execute, reset, toggleDealer, verb, compSide, vsComp, fillCover, positionAfter, goesShort, issuerUse,
  } = useRfq();

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
                    ordered
                      .map((q) => {
                        const arrived = elapsed >= q.delay || phase !== "live";
                        const rank = live.indexOf(q);
                        const isBest = q === best;
                        const isCover = q === cover;
                        const isFilled = filled?.q === q;
                        const yld = yieldFromPrice(bond, q.price);
                        const sprd = spreadFromYield(bond, yld);
                        // Positive = better than composite for us.
                        const vsC = vsComp(q.price);
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
                                <td className={`px-2 py-2 text-right ${moveText(vsC)}`}>{signed(vsC, 1)}¢</td>
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
              {phase === "done" && filled && <Confirmation bond={bond} side={side} face={face} fund={fund} q={filled.q} cover={fillCover} rfqNo={rfqNo} compSide={compSide} />}
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
            <Row k={fund} v={`${mm(POSITION)} long`} />
            <Row k="After this trade" v={`${mm(positionAfter)}${goesShort ? " · short!" : ""}`} vClass={goesShort ? "text-rose-400" : t.value} />
            <Row k="Issuer limit used" v={`${issuerUse}%`} />
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
  const rows = tracePrints(bond);
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
