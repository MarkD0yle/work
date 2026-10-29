import { ArrowRight, CircleCheck, CircleX, Link2, ReceiptText, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { StudioShell } from "../components/fi-studio/StudioShell";
import { Badge, Card, Dialog, Meter, Row, Segmented, SideSwitch, Stat, Term } from "../components/fi-studio/ui";
import { moveText, s, sideBg, sideText, type Side } from "../components/fi-studio/tokens";
import { studioSlug } from "../components/fi-studio/screens";
import { BONDS, SETTLE_T1, benchYield, bondById, shortName, yearsToMaturity } from "../components/fi-terminal/bonds";
import { openWith } from "../components/fi-terminal/selection";
import { date, mm, signed, usd } from "../components/fi-terminal/format";
import { ORD_TYPES, PORTFOLIO, ROUTES, SIZE_PRESETS, TIFS, useTicket, type Check, type Field } from "../components/fi-terminal/model/ticket";

export const title = "FI Studio · Place an Order";
export const section = "trading";
export const fullWidth = true;

/* FI Studio · 3 of 5 — the friendly order ticket.
 *
 * Same engine as the terminal ticket (useTicket). A live sentence at the top
 * always says what you're about to do and roughly what it costs. The form is
 * four short numbered sections. Price, yield and spread sit side by side
 * with a link icon — change one, the others follow. Checks read as a
 * checklist with a clear "what to fix" when one blocks. */

const FIELD_META: Record<Field, { label: string; unit: string }> = {
  price: { label: "Price", unit: "per 100" },
  yield: { label: "Yield", unit: "% to maturity" },
  spread: { label: "Spread", unit: "bp over UST" },
};

const TIF_HELP: Record<string, string> = { day: "Live until close", gtc: "Live until you cancel", ioc: "Fill now or cancel" };

export default function FiStudioTicket() {
  const {
    bondId, setBond, side, setSide, faceMM, setFaceMM, bond, comp, bid, ask,
    editing, ordType, setOrdType, tif, setTif, route, setRoute, funds, setFundPct, stage, setStage, working,
    face, effPx, yld, sprd, ai, principal, accruedAmt, net, dv01, allocTotal,
    display, onField, nudge, focusField, blurField,
    throughMid, vsTouch, fillProb, checks, fails, warns, fundImpact, risk, submit, verbing,
  } = useTicket();

  const passed = checks.filter((c) => c.status === "pass").length;
  const firstFail = checks.find((c) => c.status === "fail");

  return (
    <StudioShell
      screen="TKT"
      title="Place an order"
      lead="Set your price in whichever terms you think in. We'll check it before it goes."
      context={
        <p className="text-[12px] text-stone-500">
          <span className="font-medium text-stone-800">{bond.issuer}</span> · {shortName(bond)} · {bond.isin} · {bond.rating} · {yearsToMaturity(bond).toFixed(1)} yrs · vs {bond.bench} Treasury {benchYield(bond.bench).toFixed(3)}%
        </p>
      }
    >
      {/* Live summary — the order in one sentence */}
      <div className={`mb-4 flex items-center gap-4 border-l-4 bg-white px-5 py-3.5 ${s.card} ${side === "Buy" ? "border-l-blue-600" : "border-l-orange-600"}`}>
        <ReceiptText className={`h-5 w-5 ${sideText(side)}`} />
        <p className="min-w-0 flex-1 text-[15px] text-stone-800">
          You're <strong className={sideText(side)}>{side === "Buy" ? "buying" : "selling"}</strong> <strong>{mm(face)}</strong> {shortName(bond)}{" "}
          {ordType === "market" ? "at the market" : <>at <strong>{effPx.toFixed(3)}</strong></>} ({yld.toFixed(3)}% · {sprd.toFixed(0)} bp){" "}
          — {side === "Buy" ? "costs" : "brings in"} about <strong>${usd(net / 1e6, 2)}M</strong> including accrued.
        </p>
        {stage === "edit" && (
          <button
            type="button"
            onClick={() => setStage("review")}
            disabled={fails > 0}
            className={`px-5 py-2.5 text-[14px] font-semibold ${sideBg(side)} ${s.focus} disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600`}
          >
            {fails > 0 ? `Fix ${fails} thing${fails > 1 ? "s" : ""} first` : `Review ${side.toLowerCase()} order`}
          </button>
        )}
        {stage === "sent" && (
          <span className="flex items-center gap-2" role="status">
            <Badge tone="good" icon={<CircleCheck className="h-3 w-3" />}>Sent · {working[0].id} working</Badge>
            <button type="button" onClick={() => setStage("edit")} className={`px-3 py-1.5 text-[13px] ${s.secondary} ${s.focus}`}>New order</button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-[380px_minmax(0,1fr)_340px] gap-4">
        {/* ---------- Left: the form ---------- */}
        <div className="flex flex-col gap-4">
          <Card title="1. What">
            <SideSwitch side={side} onChange={setSide} />
            <label className="mt-4 block">
              <span className={s.label}>Bond</span>
              <select value={bondId} onChange={(e) => setBond(e.target.value)} className={`mt-1 w-full ${s.input}`}>
                {BONDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {shortName(b)} · {b.rating} · {b.sector}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4">
              <label htmlFor="stk-qty" className="flex items-baseline justify-between">
                <span className={s.label}>How much (face value, millions)</span>
                <span className="text-[11px] text-stone-400">steps of 0.25</span>
              </label>
              <div className="mt-1 flex gap-1.5">
                <input
                  id="stk-qty"
                  inputMode="decimal"
                  value={faceMM}
                  onChange={(e) => setFaceMM(e.target.value.replace(/[^0-9.]/g, ""))}
                  className={`w-20 text-right text-[16px] font-semibold tabular-nums ${s.input}`}
                />
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFaceMM(String(p))}
                    className={`flex-1 text-[13px] ${s.focus} ${Number(faceMM) === p ? "bg-indigo-600 font-semibold text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title="2. Price"
            actions={<Segmented label="Order type" value={ordType} options={ORD_TYPES} onChange={setOrdType} />}
            hint={ordType === "market" ? "Market order: fills at the best price available." : ordType === "work" ? "Work: a trader works the order for you, up to this limit." : "Limit: you won't pay more (or sell for less) than this."}
          >
            <fieldset disabled={ordType === "market"} className="disabled:opacity-50">
              <legend className="sr-only">Limit price, yield or spread</legend>
              <div className="flex items-stretch gap-1">
                {(["price", "yield", "spread"] as const).map((f, i) => (
                  <div key={f} className="flex flex-1 items-center gap-1">
                    <label className={`flex-1 border px-2.5 py-2 ${editing?.f === f ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-stone-300"} bg-white`}>
                      <span className="block text-[11px] text-stone-500">{FIELD_META[f].label}</span>
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
                        className="w-full bg-transparent text-[17px] font-semibold text-stone-900 tabular-nums focus:outline-none"
                      />
                      <span className="block text-[10px] text-stone-400">{f === "spread" ? `bp over ${bond.bench}` : FIELD_META[f].unit}</span>
                    </label>
                    {i < 2 && <Link2 className="h-3.5 w-3.5 shrink-0 text-stone-300" aria-hidden />}
                  </div>
                ))}
              </div>
            </fieldset>
            <p className="mt-2 text-[12px] text-stone-500">Change any one — the others update. ↑ ↓ nudges price by ⅛, yield and spread by 1 bp.</p>
          </Card>

          <Card title="3. How">
            <div className="flex items-center justify-between">
              <span className={s.label}>
                <Term k="TIF">How long it stays live</Term>
              </span>
              <Segmented label="Time in force" value={tif} options={TIFS} onChange={setTif} />
            </div>
            <p className="mt-1 text-right text-[11px] text-stone-400">{TIF_HELP[tif]}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className={s.label}>Send it via</span>
                <select value={route} onChange={(e) => setRoute(e.target.value)} className={`mt-1 w-full text-[13px] ${s.input}`}>
                  {ROUTES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className={s.label}>Settles</span>
                <p className="mt-1 border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] text-stone-700">{date(SETTLE_T1)} · T+1</p>
              </div>
            </div>
          </Card>

          <Card title="4. Which funds" actions={<Badge tone={allocTotal === 100 ? "good" : "bad"}>{allocTotal}% of 100%</Badge>} bodyClassName="px-4 pb-4">
            <ul className={`divide-y ${s.divide}`}>
              {funds.map((f, i) => (
                <li key={f.name} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-[13px] text-stone-800">{f.name}</span>
                  <span className="w-14 text-right text-[12px] text-stone-500 tabular-nums">{mm((f.pct / 100) * face)}</span>
                  <input
                    inputMode="numeric"
                    aria-label={`${f.name} allocation percent`}
                    value={f.pct}
                    onChange={(e) => setFundPct(i, e.target.value)}
                    className={`w-16 py-1 text-right tabular-nums ${s.input}`}
                  />
                  <span className="text-[13px] text-stone-500">%</span>
                </li>
              ))}
            </ul>
            <div className="mt-1">
              <Meter pct={allocTotal} tone={allocTotal === 100 ? "good" : "bad"} label="Allocation total" />
            </div>
          </Card>
        </div>

        {/* ---------- Centre: economics, limit, checks, working ---------- */}
        <div className="flex flex-col gap-4">
          <Card title="What it costs" icon={<Wallet className="h-4 w-4" />} bodyClassName="grid grid-cols-3 gap-x-6 gap-y-4 p-4">
            <Stat label="Price × size" value={`$${usd(principal)}`} />
            <Stat label={<Term k="accrued">Accrued interest</Term>} value={`$${usd(accruedAmt)}`} sub={`${ai.days} days · 30/360`} />
            <Stat label={side === "Buy" ? "You pay" : "You receive"} value={`$${usd(net)}`} valueClass={sideText(side)} big />
            <Stat label="Yield" value={`${yld.toFixed(3)}%`} sub={`market ${comp.yld.toFixed(3)}%`} />
            <Stat label={<Term k="gSpread">Spread</Term>} value={`${sprd.toFixed(1)} bp`} sub={`market ${comp.spread.toFixed(1)} bp`} />
            <Stat label={<Term k="DV01">Rate risk (DV01)</Term>} value={`$${usd(dv01)}`} sub={<><Term k="CS01">CS01</Term> ≈ ${usd(dv01 * 0.97)}</>} />
          </Card>

          <Card title="Your price vs the market" hint="Where your limit sits against the composite bid, mid and offer">
            <PriceTrack bid={bid} ask={ask} mid={bond.mid} limit={effPx} side={side} last={bond.mid + 0.04} />
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Stat label="vs mid" value={`${signed(throughMid, 1)}¢`} valueClass={throughMid > 0 ? "text-amber-700" : s.value} sub={throughMid > 0 ? (side === "Buy" ? "paying up" : "giving up") : "inside mid"} />
              <Stat label={side === "Buy" ? "vs offer" : "vs bid"} value={`${signed(vsTouch, 1)}¢`} />
              <div>
                <p className={s.label}>
                  <Term k="fillProb">Chance it fills</Term>
                </p>
                <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${fillProb > 70 ? s.up : fillProb > 35 ? "text-amber-700" : s.down}`}>{fillProb.toFixed(0)}%</p>
                <div className="mt-1">
                  <Meter pct={fillProb} tone={fillProb > 70 ? "good" : fillProb > 35 ? "warn" : "bad"} label="Fill probability" />
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Checks before it goes"
            icon={<ShieldCheck className="h-4 w-4" />}
            hint={fails > 0 ? `${passed} of ${checks.length} passed — fix the red one${fails > 1 ? "s" : ""} to continue` : warns > 0 ? `${passed} of ${checks.length} passed — ${warns} to keep an eye on` : `All ${checks.length} checks passed`}
            actions={fails > 0 ? <Badge tone="bad">{fails} blocking</Badge> : warns > 0 ? <Badge tone="warn">{warns} warning</Badge> : <Badge tone="good">All clear</Badge>}
            bodyClassName="px-4 pb-3"
          >
            {firstFail && (
              <p className="mb-2 flex items-start gap-2 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
                <CircleX className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>To fix:</strong> {firstFail.detail}</span>
              </p>
            )}
            <ul className={`divide-y ${s.divide}`}>
              {checks.map((c) => (
                <CheckRow key={c.name} c={c} />
              ))}
            </ul>
          </Card>

          <Card title="Working orders" hint="Orders already out in the market" bodyClassName="px-2 pb-2">
            <table className="w-full text-[13px] tabular-nums">
              <thead>
                <tr className="text-[11px] text-stone-400">
                  {["Order", "Side", "Bond", "Size", "Limit", "Filled", "Via"].map((h, i) => (
                    <th key={h} className={`px-2 py-1.5 font-medium ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${s.divide}`}>
                {working.map((w) => {
                  const pct = (w.filled / w.face) * 100;
                  return (
                    <tr key={w.id}>
                      <td className="px-2 py-2 text-stone-500">{w.id}</td>
                      <td className="px-2 py-2"><Badge tone={w.side === "Buy" ? "buy" : "sell"}>{w.side}</Badge></td>
                      <td className="px-2 py-2 text-stone-900">{shortName(bondById(w.bond))}</td>
                      <td className="px-2 py-2 text-right">{mm(w.face)}</td>
                      <td className="px-2 py-2 text-right">{w.px.toFixed(3)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16"><Meter pct={pct} tone={pct >= 100 ? "good" : "indigo"} label={`${w.id} filled`} /></div>
                          <span className="w-9 text-right text-stone-500">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-stone-500">{w.route}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* ---------- Right: impact ---------- */}
        <div className="flex flex-col gap-4">
          <Card title="Effect on each fund" bodyClassName="px-4 pb-4">
            <table className="w-full text-[13px] tabular-nums">
              <thead>
                <tr className="text-[11px] text-stone-400">
                  <th className="py-1.5 text-left font-medium">Fund</th>
                  <th className="py-1.5 text-right font-medium">Now</th>
                  <th className="py-1.5 text-right font-medium">After</th>
                  <th className="py-1.5 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${s.divide}`}>
                {fundImpact.map((f) => (
                  <tr key={f.name}>
                    <td className="py-2 text-stone-700">{f.name}</td>
                    <td className="py-2 text-right text-stone-500">{mm(f.pos)}</td>
                    <td className={`py-2 text-right font-medium ${f.after < 0 ? s.down : "text-stone-900"}`}>{mm(f.after)}</td>
                    <td className={`py-2 text-right ${moveText(f.wtBp)}`}>{signed(f.wtBp, 1)} bp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Effect on portfolio risk">
            <Row k={<Term k="DV01">Portfolio DV01</Term>} v={`$${usd(PORTFOLIO.dv01)} → $${usd(risk.dv01After)}`} />
            <Row k="Duration (IG Core)" v={`${PORTFOLIO.duration} → ${risk.durationAfter.toFixed(2)} yrs`} />
            <Row k={`${bond.sector} weight`} v={`${risk.sectorWt.toFixed(2)}%`} />
            <Row k={`${bond.rating} bucket`} v={`${risk.ratingWt.toFixed(2)}%`} />
            <Row k="Tracking error (expected)" v={`${risk.te.toFixed(1)} bp`} />
          </Card>

          <Card title="About this bond">
            <Row k="Issuer" v={bond.issuer} />
            <Row k="Coupon" v={`${bond.coupon.toFixed(3)}% · twice a year`} />
            <Row k="Matures" v={date(bond.maturity)} />
            <Row k="Rating" v={bond.rating} />
            <Row k="Sector" v={bond.sector} />
            <Row k="Bonds outstanding" v={`$${usd(bond.outstanding)}M`} />
            <Row k="Benchmark" v={`${bond.bench} · ${benchYield(bond.bench).toFixed(3)}%`} />
            <Row k="How easy to trade" v={`${bond.liq}/10`} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => openWith(studioSlug("RFQ"), { bondId, side, face })} className={`flex items-center justify-center gap-1 py-2 text-[13px] ${s.secondary} ${s.focus}`}>
                Get quotes <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => openWith(studioSlug("HMAP"), { bondId })} className={`flex items-center justify-center gap-1 py-2 text-[13px] ${s.secondary} ${s.focus}`}>
                Sector map <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {stage === "review" && (
        <Dialog
          title="Check your order"
          onClose={() => setStage("edit")}
          actions={
            <>
              <button type="button" onClick={() => setStage("edit")} className={`px-4 py-2 text-[13px] ${s.secondary} ${s.focus}`}>Back</button>
              <button type="button" autoFocus onClick={submit} className={`px-5 py-2 text-[14px] font-semibold ${sideBg(side)} ${s.focus}`}>
                Confirm {side.toLowerCase()}
              </button>
            </>
          }
        >
          <p className="text-[16px] leading-snug text-stone-900">
            You are <strong className={sideText(side)}>{verbing}</strong> {mm(face)} {shortName(bond)}
            {ordType === "market" ? " at the market" : ` at a limit of ${effPx.toFixed(3)}`} ({yld.toFixed(3)}% · {sprd.toFixed(0)} bp).
          </p>
          <div className="mt-4">
            <Row k={side === "Buy" ? "You pay" : "You receive"} v={`$${usd(net)}`} />
            <Row k="Of which accrued" v={`$${usd(accruedAmt)}`} />
            <Row k="Rate risk (DV01)" v={`$${usd(dv01)}`} />
            <Row k="Sent via · lasts" v={`${route} · ${tif.toUpperCase()}`} />
            {funds.filter((f) => f.pct > 0).map((f) => (
              <Row key={f.name} k={f.name} v={`${f.pct}% · ${mm((f.pct / 100) * face)}`} />
            ))}
          </div>
          {warns > 0 && (
            <p className="mt-3 flex items-start gap-2 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {warns} warning{warns > 1 ? "s" : ""}: {checks.filter((c) => c.status === "warn").map((c) => c.name).join(", ")}. Confirming means you've reviewed {warns > 1 ? "them" : "it"}.
            </p>
          )}
        </Dialog>
      )}
    </StudioShell>
  );
}

function CheckRow({ c }: { c: Check }) {
  const Icon = c.status === "pass" ? CircleCheck : c.status === "warn" ? TriangleAlert : CircleX;
  const tone = c.status === "pass" ? "text-emerald-600" : c.status === "warn" ? "text-amber-600" : "text-rose-600";
  return (
    <li className="flex items-start gap-3 py-2 text-[13px]">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-label={c.status === "pass" ? "Passed" : c.status === "warn" ? "Warning" : "Blocking"} />
      <span className="w-36 shrink-0 font-medium text-stone-800">{c.name}</span>
      <span className="text-stone-500">{c.detail}</span>
    </li>
  );
}

/** Horizontal scale: composite bid / mid / ask, last trade and your limit. */
function PriceTrack({ bid, ask, mid, limit, last, side }: { bid: number; ask: number; mid: number; limit: number; last: number; side: Side }) {
  const lo = Math.min(bid, limit) - 0.25;
  const hi = Math.max(ask, limit) + 0.25;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const marks = [
    { v: bid, label: "Bid" },
    { v: mid, label: "Mid" },
    { v: ask, label: "Offer" },
  ];
  const col = side === "Buy" ? "bg-blue-600" : "bg-orange-600";
  return (
    <div className="relative h-[72px]" role="img" aria-label={`Your limit ${limit.toFixed(3)} against bid ${bid.toFixed(3)} and offer ${ask.toFixed(3)}`}>
      {/* Market marks sit above the bar, your limit below it — they never collide. */}
      <div className="absolute inset-x-0 top-[36px] h-1.5 bg-stone-100" />
      <div className="absolute top-[36px] h-1.5 bg-stone-300" style={{ left: x(bid), width: `calc(${x(ask)} - ${x(bid)})` }} />
      {marks.map((m) => (
        <div key={m.label} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: x(m.v) }}>
          <p className="text-[10px] leading-3 text-stone-400">{m.label}</p>
          <p className="text-[12px] leading-5 font-medium tabular-nums text-stone-700">{m.v.toFixed(3)}</p>
          <div className="mx-auto h-2.5 w-px bg-stone-400" />
        </div>
      ))}
      <div className="absolute top-[31px] -translate-x-1/2" style={{ left: x(last) }} title="Last trade">
        <div className="h-0 w-0 border-x-4 border-t-[5px] border-x-transparent border-t-stone-500" />
      </div>
      <div className="absolute top-[32px] -translate-x-1/2" style={{ left: x(limit) }}>
        <div className={`mx-auto h-4 w-4 rounded-full border-2 border-white ${col} shadow`} />
        <p className={`mt-0.5 text-center text-[12px] font-semibold whitespace-nowrap tabular-nums ${side === "Buy" ? "text-blue-700" : "text-orange-700"}`}>You · {limit.toFixed(3)}</p>
      </div>
    </div>
  );
}
