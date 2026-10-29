import { TerminalShell } from "../components/fi-terminal/TerminalShell";
import { Panel, Row, Segmented, SideToggle, Stat, Tag } from "../components/fi-terminal/ui";
import { moveText, sideBg, sideText, t, type Side } from "../components/fi-terminal/tokens";
import { BONDS, SETTLE_T1, benchYield, bondById, shortName, yearsToMaturity } from "../components/fi-terminal/bonds";
import { openWith } from "../components/fi-terminal/selection";
import { ORD_TYPES, PORTFOLIO, ROUTES, SIZE_PRESETS, TIFS, useTicket } from "../components/fi-terminal/model/ticket";
import { date, mm, signed, usd } from "../components/fi-terminal/format";

export const title = "FI · Bond Order Ticket";
export const section = "trading";
export const fullWidth = true;

/* FI Terminal · 3 of 5 — TKT.
 *
 * A full buy/sell order ticket for a corporate bond. The heart of it is
 * three linked fields — price, yield, spread. Type in any one and the other
 * two follow, using real bond maths, because traders think in all three.
 *
 * Around it: allocation across funds, the trade's economics and risk, a
 * pre-trade checklist that blocks on a hard fail, and a two-step confirm
 * that restates the whole order in a sentence. Nothing is sent on one click. */

export default function FiBondTicket() {
  const {
    bondId, setBond, side, setSide, faceMM, setFaceMM, bond, comp, bid, ask,
    editing, ordType, setOrdType, tif, setTif, route, setRoute, funds, setFundPct, stage, setStage, working,
    face, effPx, yld, sprd, ai, principal, accruedAmt, net, dv01, allocTotal,
    display, onField, nudge, focusField, blurField,
    throughMid, vsTouch, fillProb, checks, fails, warns, fundImpact, risk, submit, verbing,
  } = useTicket();

  return (
    <TerminalShell
      screen="TKT"
      context={
        <span className="text-[11px] text-neutral-400">
          <span className="text-neutral-100">{bond.issuer}</span> · {shortName(bond)} · {bond.isin} · {bond.rating} · {yearsToMaturity(bond).toFixed(1)}y · vs {bond.bench} UST {benchYield(bond.bench).toFixed(3)}
        </span>
      }
    >
      <div className="grid h-full grid-cols-[360px_minmax(0,1fr)_360px] gap-px bg-[#1c232d]">
        {/* ---------- Left: the order ---------- */}
        <Panel n={1} title="Order" bodyClassName="relative flex flex-col overflow-auto p-3">
          <SideToggle
            side={side}
            onChange={setSide}
          />

          <label className="mt-3 block">
            <span className={t.colHead}>Security</span>
            <select
              value={bondId}
              onChange={(e) => setBond(e.target.value)}
              className={`mt-1 w-full ${t.input}`}
            >
              {BONDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {shortName(b)} · {b.rating} · {b.sector}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <label className="flex items-baseline justify-between" htmlFor="tkt-qty">
              <span className={t.colHead}>Quantity · face, MM</span>
              <span className="text-[10px] text-neutral-500">min 0.25 · incr 0.25</span>
            </label>
            <div className="mt-1 flex gap-1">
              <input
                id="tkt-qty"
                inputMode="decimal"
                value={faceMM}
                onChange={(e) => setFaceMM(e.target.value.replace(/[^0-9.]/g, ""))}
                className={`w-24 text-right text-[14px] font-semibold tabular-nums ${t.input}`}
              />
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFaceMM(String(s))}
                  className={`flex-1 text-[11px] ${t.focus} ${Number(faceMM) === s ? "bg-amber-400 font-bold text-black" : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className={t.colHead}>Order type</span>
            <Segmented label="Order type" value={ordType} options={ORD_TYPES} onChange={setOrdType} />
          </div>

          {/* Linked price / yield / spread */}
          <fieldset className={`mt-3 border ${t.borderStrong} p-2.5`} disabled={ordType === "market"}>
            <legend className="px-1 text-[10px] text-neutral-500">
              {ordType === "market" ? "Market — fills at best available" : "Limit — edit any one, the others follow"}
            </legend>
            {(["price", "yield", "spread"] as const).map((f) => (
              <label key={f} className="flex items-center gap-2 py-1">
                <span className="w-16 text-[11px] capitalize text-neutral-400">{f}</span>
                <input
                  inputMode="decimal"
                  value={display(f)}
                  onFocus={() => focusField(f)}
                  onBlur={blurField}
                  onChange={(e) => onField(f, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      nudge(f, e.key === "ArrowUp" ? 1 : -1);
                    }
                  }}
                  aria-label={`Limit ${f}`}
                  className={`min-w-0 flex-1 text-right text-[14px] font-semibold tabular-nums disabled:opacity-50 ${t.input} ${editing?.f === f ? "border-amber-400" : ""}`}
                />
                <span className="w-12 text-[10px] text-neutral-500">{f === "price" ? "clean" : f === "yield" ? "% YTM" : `bp/${bond.bench}`}</span>
              </label>
            ))}
            <p className="mt-1 text-[10px] text-neutral-600">↑ ↓ nudge · price ⅛ · yield 1bp · spread 1bp</p>
          </fieldset>

          <div className="mt-3 flex items-center justify-between">
            <span className={t.colHead}>Time in force</span>
            <Segmented label="Time in force" value={tif} options={TIFS} onChange={setTif} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className={t.colHead}>Route</span>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className={`mt-1 w-full text-[11px] ${t.input}`}>
                {ROUTES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <div>
              <span className={t.colHead}>Settlement</span>
              <p className={`mt-1 text-[11px] ${t.input}`}>T+1 · {date(SETTLE_T1)}</p>
            </div>
          </div>

          {/* Allocation */}
          <div className="mt-4 flex items-baseline justify-between">
            <span className={t.colHead}>Allocation</span>
            <span className={`text-[10px] tabular-nums ${allocTotal === 100 ? "text-neutral-500" : "text-rose-400"}`}>{allocTotal}% of 100%</span>
          </div>
          <ul className={`mt-1 divide-y border ${t.border} ${t.divide}`}>
            {funds.map((f, i) => (
              <li key={f.name} className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
                <span className="flex-1 text-neutral-200">{f.name}</span>
                <span className="w-14 text-right tabular-nums text-neutral-500">{mm((f.pct / 100) * face)}</span>
                <input
                  inputMode="numeric"
                  aria-label={`${f.name} allocation percent`}
                  value={f.pct}
                  onChange={(e) => setFundPct(i, e.target.value)}
                  className={`w-12 py-0.5 text-right tabular-nums ${t.input}`}
                />
                <span className="text-neutral-500">%</span>
              </li>
            ))}
          </ul>

          <div className="flex-1" />

          {stage === "edit" && (
            <button
              type="button"
              onClick={() => setStage("review")}
              disabled={fails > 0}
              className={`mt-4 py-3 text-[12px] font-bold uppercase tracking-widest ${sideBg(side)} ${t.focus} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {fails > 0 ? `Fix ${fails} blocking check${fails > 1 ? "s" : ""}` : `Review ${side} ${mm(face)} @ ${effPx.toFixed(3)}`}
            </button>
          )}
          {stage === "sent" && (
            <div className="mt-4 border border-emerald-500/40 bg-emerald-500/[0.07] p-2.5 text-[11px]" role="status">
              <p className="font-bold text-emerald-300">Order routed · {working[0].id} · working</p>
              <p className="mt-0.5 text-neutral-400">{route} · {tif.toUpperCase()} · see working orders.</p>
              <button type="button" onClick={() => setStage("edit")} className={`mt-2 w-full py-1.5 text-[10px] font-semibold uppercase ${t.ghost} ${t.focus}`}>
                New order
              </button>
            </div>
          )}

          {/* Review — restates the order in words before anything is sent */}
          {stage === "review" && (
            <div className="absolute inset-0 z-10 flex flex-col bg-[#0c1016]/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tkt-review">
              <p id="tkt-review" className={t.label}>Confirm order</p>
              <p className="mt-3 text-[15px] leading-snug text-neutral-100">
                You are <span className={`font-bold ${sideText(side)}`}>{verbing}</span> {mm(face)} {shortName(bond)}
                {ordType === "market" ? " at market" : ` at a limit of ${effPx.toFixed(3)}`} ({yld.toFixed(3)}% · {sprd.toFixed(0)} bp).
              </p>
              <div className="mt-4 text-[11px]">
                <Row k={side === "Buy" ? "Net cost" : "Net proceeds"} v={`$${usd(net)}`} />
                <Row k="Of which accrued" v={`$${usd(accruedAmt)}`} />
                <Row k="Trade DV01" v={`$${usd(dv01)}`} />
                <Row k="Route · TIF" v={`${route} · ${tif.toUpperCase()}`} />
                {funds.filter((f) => f.pct > 0).map((f) => (
                  <Row key={f.name} k={f.name} v={`${f.pct}% · ${mm((f.pct / 100) * face)}`} />
                ))}
              </div>
              {warns > 0 && (
                <p className="mt-3 border-l-2 border-amber-400 pl-2 text-[11px] text-amber-200">
                  {warns} warning{warns > 1 ? "s" : ""}: {checks.filter((c) => c.status === "warn").map((c) => c.name).join(", ")}. Sending confirms you have reviewed them.
                </p>
              )}
              <div className="flex-1" />
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" onClick={() => setStage("edit")} className={`py-3 text-[11px] font-semibold uppercase ${t.ghost} ${t.focus}`}>
                  Back
                </button>
                <button type="button" autoFocus onClick={submit} className={`py-3 text-[12px] font-bold uppercase tracking-widest ${sideBg(side)} ${t.focus}`}>
                  Confirm {side}
                </button>
              </div>
            </div>
          )}
        </Panel>

        {/* ---------- Centre: economics, positioning, checks, working ---------- */}
        <div className="flex min-h-0 flex-col gap-px">
          <Panel n={2} title="Trade economics" bodyClassName="grid grid-cols-6 gap-3 p-3">
            <Stat label="Principal" value={`$${usd(principal)}`} />
            <Stat label="Accrued" value={`$${usd(accruedAmt)}`} sub={`${ai.days} days · 30/360`} />
            <Stat label={side === "Buy" ? "Net cost" : "Net proceeds"} value={`$${usd(net)}`} valueClass={sideText(side)} />
            <Stat label="Yield" value={`${yld.toFixed(3)}%`} sub={`comp ${comp.yld.toFixed(3)}`} />
            <Stat label="Spread" value={`${sprd.toFixed(1)}`} sub={`comp ${comp.spread.toFixed(1)} bp`} />
            <Stat label="Trade DV01" value={`$${usd(dv01)}`} sub={`CS01 ≈ $${usd(dv01 * 0.97)}`} />
          </Panel>

          <Panel n={3} title="Where your limit sits" bodyClassName="p-3">
            <PriceTrack bid={bid} ask={ask} mid={bond.mid} limit={effPx} side={side} last={bond.mid + 0.04} />
            <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
              <Row k="vs mid" v={`${signed(throughMid, 1)}¢`} vClass={throughMid > 0 ? "text-amber-300" : "text-neutral-300"} />
              <Row k={side === "Buy" ? "vs offer" : "vs bid"} v={`${signed(vsTouch, 1)}¢`} />
              <Row k="Fill probability" v={`${fillProb.toFixed(0)}%`} vClass={fillProb > 70 ? "text-emerald-300" : fillProb > 35 ? "text-amber-300" : "text-rose-300"} />
            </div>
          </Panel>

          <Panel
            n={4}
            title="Pre-trade checks"
            className="min-h-0 flex-1"
            bodyClassName="overflow-auto"
            actions={
              <span className="flex gap-1">
                {fails > 0 && <Tag tone="down">{fails} block</Tag>}
                {warns > 0 && <Tag tone="amber">{warns} warn</Tag>}
                {fails + warns === 0 && <Tag tone="up">All clear</Tag>}
              </span>
            }
          >
            <ul className={`divide-y ${t.divide}`}>
              {checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 px-3 py-2 text-[11px]">
                  <span
                    aria-label={c.status}
                    className={`mt-px w-10 shrink-0 text-center text-[9px] font-bold uppercase ${
                      c.status === "pass" ? "bg-emerald-500/15 text-emerald-300" : c.status === "warn" ? "bg-amber-400/15 text-amber-300" : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {c.status === "pass" ? "Pass" : c.status === "warn" ? "Warn" : "Block"}
                  </span>
                  <span className="w-32 shrink-0 text-neutral-200">{c.name}</span>
                  <span className="text-neutral-400">{c.detail}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel n={5} title="Working orders" className="min-h-0 flex-[0.8]" bodyClassName="overflow-auto">
            <table className="w-full text-[11px] tabular-nums">
              <thead className={`sticky top-0 ${t.panel}`}>
                <tr className={`border-b ${t.border}`}>
                  {["Order", "Side", "Security", "Size", "Limit", "Filled", "Route"].map((h, i) => (
                    <th key={h} className={`px-2.5 py-1 ${i >= 3 && i <= 5 ? "text-right" : "text-left"} ${t.colHead}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {working.map((w) => {
                  const pctFilled = (w.filled / w.face) * 100;
                  return (
                    <tr key={w.id} className={`border-b ${t.border}`}>
                      <td className="px-2.5 py-1.5 text-neutral-400">{w.id}</td>
                      <td className={`px-2.5 py-1.5 font-bold ${sideText(w.side)}`}>{w.side.toUpperCase()}</td>
                      <td className="px-2.5 py-1.5 text-neutral-100">{shortName(bondById(w.bond))}</td>
                      <td className="px-2.5 py-1.5 text-right">{mm(w.face)}</td>
                      <td className="px-2.5 py-1.5 text-right">{w.px.toFixed(3)}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1 w-16 bg-white/10">
                            <div className={`h-1 ${pctFilled >= 100 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${pctFilled}%` }} />
                          </div>
                          <span className="w-8 text-right text-neutral-400">{pctFilled.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 text-neutral-500">{w.route}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* ---------- Right: impact ---------- */}
        <div className="flex min-h-0 flex-col gap-px">
          <Panel n={6} title="Position impact" bodyClassName="p-3">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className={`border-b ${t.border}`}>
                  <th className={`py-1 text-left ${t.colHead}`}>Fund</th>
                  <th className={`py-1 text-right ${t.colHead}`}>Now</th>
                  <th className={`py-1 text-right ${t.colHead}`}>After</th>
                  <th className={`py-1 text-right ${t.colHead}`}>Wt bp</th>
                </tr>
              </thead>
              <tbody>
                {fundImpact.map(({ after, wtBp: wt, ...f }) => {
                  return (
                    <tr key={f.name} className={`border-b ${t.border}`}>
                      <td className="py-1.5 text-neutral-300">{f.name}</td>
                      <td className="py-1.5 text-right text-neutral-400">{mm(f.pos)}</td>
                      <td className={`py-1.5 text-right ${after < 0 ? "text-rose-400" : "text-neutral-100"}`}>{mm(after)}</td>
                      <td className={`py-1.5 text-right ${moveText(wt)}`}>{signed(wt, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          <Panel n={7} title="Risk impact" bodyClassName="p-3 text-[11px]">
            <Row k="Portfolio DV01" v={`$${usd(PORTFOLIO.dv01)} → $${usd(risk.dv01After)}`} />
            <Row k="Duration (IG CORE)" v={`${PORTFOLIO.duration} → ${risk.durationAfter.toFixed(2)}`} />
            <Row k={`${bond.sector} weight`} v={`${risk.sectorWt.toFixed(2)}%`} />
            <Row k={`${bond.rating} bucket`} v={`${risk.ratingWt.toFixed(2)}%`} />
            <Row k="Tracking error (ex-ante)" v={`${risk.te.toFixed(1)} bp`} />
          </Panel>

          <Panel n={8} title="Security" className="min-h-0 flex-1" bodyClassName="overflow-auto p-3 text-[11px]">
            <Row k="Issuer" v={bond.issuer} />
            <Row k="Coupon · freq" v={`${bond.coupon.toFixed(3)}% · S/A`} />
            <Row k="Maturity" v={date(bond.maturity)} />
            <Row k="Rating" v={bond.rating} />
            <Row k="Sector" v={bond.sector} />
            <Row k="Amount out" v={`$${usd(bond.outstanding)}MM`} />
            <Row k="Benchmark" v={`${bond.bench} · ${benchYield(bond.bench).toFixed(3)}%`} />
            <Row k="Liquidity" v={`${bond.liq}/10`} />
            <div className="mt-3 grid grid-cols-2 gap-1">
              <button type="button" onClick={() => openWith("fi-rfq-ticket", { bondId, side, face })} className={`py-1.5 text-[10px] font-semibold uppercase ${t.ghost} ${t.focus}`}>
                RFQ instead →
              </button>
              <button type="button" onClick={() => openWith("fi-credit-heatmap", { bondId })} className={`py-1.5 text-[10px] font-semibold uppercase ${t.ghost} ${t.focus}`}>
                Sector map →
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </TerminalShell>
  );
}

/** Horizontal scale: composite bid / mid / ask, last print and your limit. */
function PriceTrack({ bid, ask, mid, limit, last, side }: { bid: number; ask: number; mid: number; limit: number; last: number; side: Side }) {
  const lo = Math.min(bid, limit) - 0.25;
  const hi = Math.max(ask, limit) + 0.25;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const marks = [
    { v: bid, label: "Bid", cls: "bg-neutral-400" },
    { v: mid, label: "Mid", cls: "bg-neutral-500" },
    { v: ask, label: "Ask", cls: "bg-neutral-400" },
  ];
  return (
    <div className="relative h-16" role="img" aria-label={`Limit ${limit.toFixed(3)} against bid ${bid.toFixed(3)} and ask ${ask.toFixed(3)}`}>
      {/* Composite marks sit above the rule, your limit sits below it — they never collide. */}
      <div className="absolute inset-x-0 top-[34px] h-px bg-[#2a3340]" />
      <div className="absolute top-[30px] h-2 bg-white/[0.06]" style={{ left: x(bid), width: `calc(${x(ask)} - ${x(bid)})` }} />
      {marks.map((m) => (
        <div key={m.label} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: x(m.v) }}>
          <p className="text-[9px] uppercase leading-3 text-neutral-500">{m.label}</p>
          <p className="text-[10px] leading-4 tabular-nums text-neutral-400">{m.v.toFixed(3)}</p>
          <div className={`mx-auto h-2.5 w-px ${m.cls}`} />
        </div>
      ))}
      <div className="absolute top-[29px] -translate-x-1/2" style={{ left: x(last) }} title="Last TRACE print">
        <div className="h-0 w-0 border-x-4 border-t-[5px] border-x-transparent border-t-neutral-500" />
      </div>
      <div className="absolute top-[30px] -translate-x-1/2" style={{ left: x(limit) }}>
        <div className={`mx-auto h-4 w-1 ${side === "Buy" ? "bg-sky-400" : "bg-rose-400"}`} />
        <p className={`whitespace-nowrap text-center text-[10px] font-bold tabular-nums ${side === "Buy" ? "text-sky-300" : "text-rose-300"}`}>
          You {limit.toFixed(3)}
        </p>
      </div>
    </div>
  );
}
