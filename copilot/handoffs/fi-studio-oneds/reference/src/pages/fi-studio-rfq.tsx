import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleCheck, Hourglass, MessagesSquare, RotateCcw, Send, Star, Users, Wallet } from "lucide-react";
import { StudioShell } from "../components/fi-studio/StudioShell";
import { Badge, Card, Meter, Ring, Row, Segmented, SideSwitch, Stat, Stepper, Term } from "../components/fi-studio/ui";
import { moveText, s, sideBg, sideText } from "../components/fi-studio/tokens";
import { studioSlug } from "../components/fi-studio/screens";
import { BONDS, DEALERS, SETTLE_T1, accrued, shortName, spreadFromYield, yieldFromPrice, type Bond } from "../components/fi-terminal/bonds";
import { openWith } from "../components/fi-terminal/selection";
import { date, mm, signed, usd } from "../components/fi-terminal/format";
import { FUNDS, MAX_DEALERS, POSITION, SIZES, TIMERS, tracePrints, useRfq, type Quote } from "../components/fi-terminal/model/rfq";
import type { Side } from "../components/fi-studio/tokens";

export const title = "FI Studio · Get Quotes";
export const section = "trading";
export const fullWidth = true;

/* FI Studio · 2 of 5 — the friendly multi-dealer RFQ.
 *
 * Same engine as the terminal RFQ (useRfq). The flow is told as steps —
 * what, who, compare, done — and the competition plays out as cards that
 * slide in as dealers answer, with the best price called out in words
 * ("best price · 0.5¢ better than market") instead of by rank alone. */

const STEPS = ["Choose bond", "Pick dealers", "Compare quotes", "Done"];

export default function FiStudioRfq() {
  const {
    bondId, setBondId, side, setSide, face, setFace, fund, setFund, timer, setTimer, picked,
    phase, quotes, elapsed, filled, rfqNo, bond, comp, axes, limit, remaining,
    responded, live, best, cover, ordered, editable,
    send, execute, reset, toggleDealer, verb, compSide, vsComp, fillCover, positionAfter, goesShort, issuerUse,
  } = useRfq();

  const step = phase === "draft" ? 1 : phase === "live" ? 2 : 3;
  const urgent = phase === "live" && remaining < 6;
  const action = side === "Buy" ? "Buy" : "Sell";

  return (
    <StudioShell
      screen="RFQ"
      title="Get quotes"
      lead="Ask up to five dealers for a price at once, then take the best one."
      context={
        <div className="flex flex-col items-end gap-1.5">
          <Stepper steps={STEPS} current={step} />
          <span className="text-[12px] text-stone-500">
            Request #{rfqNo} · {shortName(bond)} · {bond.isin} · {bond.rating} · {bond.sector}
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-[360px_minmax(0,1fr)_320px] gap-4">
        {/* ---------- Left: the request ---------- */}
        <div className="flex flex-col gap-4">
          <Card title="1. What do you want to do?" icon={<Wallet className="h-4 w-4" />}>
            <SideSwitch side={side} onChange={(sd) => editable && setSide(sd)} disabled={!editable} buyLabel="I want to buy" sellLabel="I want to sell" />
            <p className="mt-2 text-[12px] text-stone-500">
              Dealers will quote you {side === "Buy" ? "a price to buy at (their offer)" : "a price to sell at (their bid)"}.
            </p>

            <label className="mt-4 block">
              <span className={s.label}>Bond</span>
              <select value={bondId} disabled={!editable} onChange={(e) => setBondId(e.target.value)} className={`mt-1 w-full ${s.input} disabled:bg-stone-50`}>
                {BONDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {shortName(b)} · {b.issuer} · {b.rating}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4">
              <span className={s.label}>How much (face value)</span>
              <div className="mt-1 grid grid-cols-5 gap-1.5">
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    disabled={!editable}
                    onClick={() => setFace(sz)}
                    className={`py-2 text-[13px] ${s.focus} disabled:cursor-not-allowed ${face === sz ? "bg-indigo-600 font-semibold text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                  >
                    ${mm(sz).replace("MM", "M")}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className={s.label}>Book it to</span>
                <select value={fund} disabled={!editable} onChange={(e) => setFund(e.target.value)} className={`mt-1 w-full text-[13px] ${s.input} disabled:bg-stone-50`}>
                  {FUNDS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className={s.label}>Settles</span>
                <p className="mt-1 border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] text-stone-700">{date(SETTLE_T1)} · T+1</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={s.label}>Give dealers</span>
              <Segmented label="Response window" value={timer} options={TIMERS} onChange={setTimer} disabled={!editable} />
            </div>
          </Card>

          <Card
            title="2. Who should quote?"
            icon={<Users className="h-4 w-4" />}
            hint={`Pick up to ${MAX_DEALERS}. Green badge = the dealer wants the other side of your trade.`}
            actions={<Badge tone={picked.length === MAX_DEALERS ? "warn" : "neutral"}>{picked.length} of {MAX_DEALERS}</Badge>}
            bodyClassName="px-2 pb-2"
          >
            <ul>
              {DEALERS.map((dl) => {
                const on = picked.includes(dl.code);
                const axe = axes.find((a) => a.code === dl.code);
                const helpful = axe && axe.side !== side;
                const full = !on && picked.length >= MAX_DEALERS;
                return (
                  <li key={dl.code}>
                    <label className={`flex items-center gap-3 px-2 py-2 ${editable && !full ? "cursor-pointer hover:bg-stone-50" : "opacity-60"} ${on ? "bg-indigo-50/60" : ""}`}>
                      <input type="checkbox" checked={on} disabled={!editable || full} onChange={() => toggleDealer(dl.code)} className="h-4 w-4 accent-indigo-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-stone-900">{dl.name}</span>
                        <span className="flex items-center gap-2 text-[11px] text-stone-500">
                          {dl.code} · <Term k="hitRate">you trade {dl.hitRate}% of the time</Term>
                        </span>
                      </span>
                      {axe && (
                        <Badge tone={helpful ? "good" : "neutral"}>
                          <Term k="axe">wants to {axe.side === "Buy" ? "buy" : "sell"}</Term>
                        </Badge>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* ---------- Centre: the competition ---------- */}
        <Card
          title="3. Compare quotes"
          icon={<MessagesSquare className="h-4 w-4" />}
          hint={
            phase === "draft"
              ? "Quotes appear here as dealers answer. We'll point out the best one."
              : phase === "live"
                ? `${responded.length} of ${quotes.length} dealers have answered`
                : phase === "done"
                  ? "Trade done"
                  : "Time ran out"
          }
          bodyClassName="flex flex-col p-4"
        >
          <div className="flex items-center gap-5 border border-stone-100 bg-stone-50 p-4">
            <Ring fraction={phase === "draft" ? 1 : phase === "live" ? remaining / limit : 0} label={`0:${String(Math.ceil(phase === "draft" ? limit : remaining)).padStart(2, "0")}`} urgent={urgent} />
            <div className="min-w-0 flex-1">
              {phase === "draft" && (
                <>
                  <p className="text-[15px] font-semibold text-stone-900">Ready when you are</p>
                  <p className="text-[13px] text-stone-500">{picked.length} dealers will compete for {mm(face)} of {shortName(bond)}. They have {limit} seconds.</p>
                </>
              )}
              {phase === "live" && (
                <>
                  <p className={`text-[15px] font-semibold ${urgent ? "text-rose-600" : "text-stone-900"}`}>{best ? "Quotes are coming in" : "Dealers are pricing…"}</p>
                  <p className="text-[13px] text-stone-500">
                    {best ? `Best so far: ${best.price.toFixed(3)} from ${best.dealer}.` : "First prices usually land within a few seconds."} Press Esc to cancel.
                  </p>
                </>
              )}
              {phase === "done" && filled && (
                <>
                  <p className="text-[15px] font-semibold text-emerald-700">Done in {filled.at.toFixed(1)} seconds</p>
                  <p className="text-[13px] text-stone-500">Booked and sent to confirmation matching.</p>
                </>
              )}
              {phase === "expired" && (
                <>
                  <p className="text-[15px] font-semibold text-stone-900">No trade this time</p>
                  <p className="text-[13px] text-stone-500">
                    The window closed. {live.length > 0 ? `Best was ${best.price.toFixed(3)} from ${best.dealer}.` : ""} Start a new request to try again.
                  </p>
                </>
              )}
            </div>
            {phase === "draft" ? (
              <button type="button" onClick={send} disabled={picked.length === 0} className={`flex items-center gap-2 px-5 py-3 text-[14px] font-semibold ${s.primary} ${s.focus} disabled:opacity-40`}>
                <Send className="h-4 w-4" /> Send to {picked.length} dealers
              </button>
            ) : (
              <button type="button" onClick={reset} className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium ${s.secondary} ${s.focus}`}>
                <RotateCcw className="h-4 w-4" /> {phase === "live" ? "Cancel request" : "New request"}
              </button>
            )}
          </div>

          {/* Quote cards */}
          <ul className="mt-4 flex flex-col gap-2" aria-live="polite">
            {phase === "draft" &&
              picked.map((code) => (
                <li key={code} className="flex items-center gap-3 border border-dashed border-stone-200 px-4 py-3 text-[13px] text-stone-400">
                  <Hourglass className="h-4 w-4" />
                  <span className="font-medium text-stone-600">{DEALERS.find((d) => d.code === code)?.name}</span>
                  <span>will quote once you send</span>
                </li>
              ))}
            <AnimatePresence initial={false}>
              {phase !== "draft" &&
                ordered.map((q) => (
                  <motion.li key={q.dealer} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <QuoteRow
                      q={q}
                      bond={bond}
                      side={side}
                      arrived={elapsed >= q.delay || phase !== "live"}
                      live={phase === "live"}
                      rank={live.indexOf(q)}
                      isBest={q === best}
                      isCover={q === cover}
                      isFilled={filled?.q === q}
                      vsC={vsComp(q.price)}
                      verb={verb}
                      onTrade={() => execute(q)}
                    />
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>

          <div className="flex-1" />

          {phase === "live" && (
            <button
              type="button"
              disabled={!best}
              onClick={() => best && execute(best)}
              className={`mt-4 flex items-center justify-center gap-2 py-3.5 text-[15px] font-semibold ${sideBg(side)} ${s.focus} disabled:cursor-wait disabled:opacity-40`}
            >
              {best ? (
                <>
                  {action} {mm(face)} at {best.price.toFixed(3)} from {best.dealer} <span className="font-normal opacity-80">· best price</span>
                </>
              ) : (
                "Waiting for the first quote…"
              )}
            </button>
          )}

          <AnimatePresence>
            {phase === "done" && filled && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-4">
                <Confirmation bond={bond} side={side} face={face} fund={fund} q={filled.q} cover={fillCover} rfqNo={rfqNo} compSide={compSide} />
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* ---------- Right: context ---------- */}
        <div className="flex flex-col gap-4">
          <Card title="Market price" hint={<><Term k="composite">Composite</Term> — the fair-value reference</>}>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Bid" value={(bond.mid - 0.125).toFixed(3)} valueClass={side === "Sell" ? s.sell : s.value} sub={side === "Sell" ? "you'd sell near" : undefined} />
              <Stat label="Mid" value={bond.mid.toFixed(3)} />
              <Stat label="Offer" value={(bond.mid + 0.125).toFixed(3)} valueClass={side === "Buy" ? s.buy : s.value} sub={side === "Buy" ? "you'd buy near" : undefined} />
            </div>
            <div className="mt-3 border-t border-stone-100 pt-2">
              <Row k="Yield at mid" v={`${comp.yld.toFixed(3)}%`} />
              <Row k={<Term k="gSpread">{`Spread vs ${bond.bench}`}</Term>} v={`${comp.spread.toFixed(1)} bp`} />
              <Row k={<Term k="PV01">PV01 per $1M</Term>} v={`$${usd(comp.pv01 * 10_000)}`} />
              <Row k={<Term k="accrued">Accrued</Term>} v={`${accrued(bond).amount.toFixed(4)} · ${accrued(bond).days} days`} />
              <Row k="How easy to trade" v={`${bond.liq}/10`} vClass={bond.liq >= 7 ? s.up : bond.liq >= 5 ? "text-amber-700" : s.down} />
              <Row k="Bonds outstanding" v={`$${usd(bond.outstanding)}M`} />
            </div>
          </Card>

          <Card title={<Term k="TRACE">Recent trades</Term>} hint="Today's public prints, newest first" bodyClassName="px-2 pb-2">
            <Trace bond={bond} />
          </Card>

          <Card title="Your position" icon={<Wallet className="h-4 w-4" />}>
            <Row k={fund} v={`${mm(POSITION)} owned`} />
            <Row k="After this trade" v={`${mm(positionAfter)}${goesShort ? " · would go short" : ""}`} vClass={goesShort ? s.down : s.value} />
            <div className="mt-2">
              <div className="flex justify-between text-[12px] text-stone-500">
                <span>Issuer limit used</span>
                <span className="tabular-nums">{issuerUse}%</span>
              </div>
              <div className="mt-1">
                <Meter pct={issuerUse} tone={issuerUse > 85 ? "bad" : issuerUse > 70 ? "warn" : "indigo"} label="Issuer limit used" />
              </div>
            </div>
            <button type="button" onClick={() => openWith(studioSlug("TKT"), { bondId, side, face })} className={`mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-medium ${s.secondary} ${s.focus}`}>
              Use the full order ticket instead <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Card>
        </div>
      </div>
    </StudioShell>
  );
}

function QuoteRow({ q, bond, side, arrived, live, rank, isBest, isCover, isFilled, vsC, verb, onTrade }: {
  q: Quote; bond: Bond; side: Side; arrived: boolean; live: boolean; rank: number; isBest: boolean; isCover: boolean; isFilled: boolean; vsC: number; verb: string; onTrade: () => void;
}) {
  const name = DEALERS.find((d) => d.code === q.dealer)?.name ?? q.dealer;
  const box = isFilled
    ? "border-emerald-300 bg-emerald-50"
    : isBest && live
      ? side === "Buy"
        ? "border-blue-300 bg-blue-50/60"
        : "border-orange-300 bg-orange-50/60"
      : "border-stone-200 bg-white";

  if (!arrived || q.pass) {
    return (
      <div className="flex items-center gap-3 border border-stone-200 bg-white px-4 py-3 text-[13px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-[11px] text-stone-400">—</span>
        <span className="flex-1 font-medium text-stone-700">{name}</span>
        {!arrived ? (
          live ? <span className="animate-pulse text-stone-400">Pricing…</span> : <span className="text-stone-400">Didn't answer in time</span>
        ) : (
          <span className="text-stone-400">Passed on this one</span>
        )}
      </div>
    );
  }

  const yld = yieldFromPrice(bond, q.price);
  const sprd = spreadFromYield(bond, yld);
  return (
    <div className={`flex items-center gap-4 border px-4 py-3 ${box}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${isBest ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-600"}`}>{rank + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13px] font-medium text-stone-900">
          {name}
          {isFilled && <Badge tone="good" icon={<CircleCheck className="h-3 w-3" />}>Traded</Badge>}
          {!isFilled && isBest && <Badge tone="indigo" icon={<Star className="h-3 w-3" />}>Best price</Badge>}
          {!isFilled && isCover && <Badge><Term k="cover">Second best</Term></Badge>}
        </p>
        <p className="text-[12px] text-stone-500 tabular-nums">
          Yield {yld.toFixed(3)}% · spread {sprd.toFixed(1)} bp · {mm(q.size)} · answered in {q.delay.toFixed(1)}s
        </p>
      </div>
      <div className="text-right">
        <p className={`text-[20px] font-semibold tabular-nums ${isBest ? "text-stone-900" : "text-stone-700"}`}>{q.price.toFixed(3)}</p>
        <p className={`text-[12px] tabular-nums ${moveText(vsC)}`}>
          {Math.abs(vsC) < 0.05 ? "same as market" : `${Math.abs(vsC).toFixed(1)}¢ ${vsC > 0 ? "better" : "worse"} than market`}
        </p>
      </div>
      {live && (
        <button
          type="button"
          onClick={onTrade}
          className={`px-4 py-2 text-[13px] font-semibold ${isBest ? sideBg(side) : s.secondary} ${s.focus}`}
          aria-label={`${verb} ${q.dealer} at ${q.price.toFixed(3)}`}
          title={`${verb} — ${side === "Buy" ? "buy at this offer" : "sell at this bid"}`}
        >
          {side} here
        </button>
      )}
    </div>
  );
}

function Confirmation({ bond, side, face, fund, q, cover, rfqNo, compSide }: {
  bond: Bond; side: Side; face: number; fund: string; q: Quote; cover?: Quote; rfqNo: number; compSide: number;
}) {
  const ai = accrued(bond);
  const principal = (q.price / 100) * face;
  const acc = (ai.amount / 100) * face;
  const yld = yieldFromPrice(bond, q.price);
  const savedVsComp = ((side === "Buy" ? compSide - q.price : q.price - compSide) * face) / 100;
  const coverDiff = cover ? Math.abs(cover.price - q.price) * 100 : 0;
  return (
    <div className="border border-emerald-200 bg-emerald-50 p-4" role="status">
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-stone-900">
            You {side === "Buy" ? "bought" : "sold"} <span className={sideText(side)}>{mm(face)}</span> {shortName(bond)} at {q.price.toFixed(3)} from {q.dealer}
          </p>
          <p className="text-[12px] text-stone-500">Trade T-{rfqNo}-{q.dealer} · booked to {fund} · settles {date(SETTLE_T1)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-3">
        <Stat label="Yield" value={`${yld.toFixed(3)}%`} />
        <Stat label="Price × size" value={`$${usd(principal)}`} />
        <Stat label="Accrued" value={`$${usd(acc)}`} sub={`${ai.days} days`} />
        <Stat label={side === "Buy" ? "You pay" : "You receive"} value={`$${usd(principal + acc)}`} />
        <Stat
          label="Versus market"
          value={`${savedVsComp >= 0 ? "+" : "−"}$${usd(Math.abs(savedVsComp))}`}
          valueClass={moveText(savedVsComp)}
          sub={cover ? `Second best ${cover.price.toFixed(3)} · ${coverDiff.toFixed(1)}¢ away` : "No second quote"}
        />
      </div>
      <p className="mt-3 text-[12px] text-stone-500">${usd(Math.abs(savedVsComp))} {savedVsComp >= 0 ? "better" : "worse"} than trading at the composite {side === "Buy" ? "offer" : "bid"} ({signed((side === "Buy" ? compSide - q.price : q.price - compSide) * 100, 1)}¢).</p>
    </div>
  );
}

function Trace({ bond }: { bond: Bond }) {
  const rows = tracePrints(bond);
  return (
    <ul className="max-h-72 overflow-auto">
      {rows.map((p, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-1.5 text-[13px] tabular-nums">
          <span className="w-12 text-stone-400">{p.time}</span>
          <Badge tone={p.side === "B" ? "buy" : "sell"}>{p.side === "B" ? "Client bought" : "Client sold"}</Badge>
          <span className="flex-1 text-right font-medium text-stone-900">{p.px.toFixed(3)}</span>
          <span className="w-16 text-right text-stone-500">{p.size}</span>
        </li>
      ))}
    </ul>
  );
}
