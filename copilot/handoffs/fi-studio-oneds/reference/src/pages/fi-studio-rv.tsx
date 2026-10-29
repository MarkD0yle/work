import { ArrowLeftRight, ChartSpline, CircleCheck, Layers, Lightbulb, TriangleAlert } from "lucide-react";
import { StudioShell } from "../components/fi-studio/StudioShell";
import { Badge, Card, Dialog, Row, Segmented, Stat, Takeaway, Term } from "../components/fi-studio/ui";
import { actionHeat, divergingHeat, moveText, onHeat, s } from "../components/fi-studio/tokens";
import { mm, signed, usd } from "../components/fi-terminal/format";
import { FLIES, ISSUES, SPREAD_METRICS, TENORS, curveName, fitted, label, money, spreadCell, useRv, type Issue } from "../components/fi-terminal/model/rv";

export const title = "FI Studio · Curve Ideas";
export const section = "trading";
export const fullWidth = true;

/* FI Studio · 5 of 5 — friendly Treasury relative value.
 *
 * Same engine as the terminal RV (useRv). The page reads top to bottom as
 * a story: which bonds look cheap or expensive, which parts of the curve
 * look stretched, then a switch builder that turns the best idea into one
 * DV01-neutral package. Buy-blue marks cheap bonds, sell-orange marks rich
 * ones — the colour tells you what you'd do with it. */

export default function FiStudioRv() {
  const {
    sellIdx, setSellIdx, buyIdx, setBuyIdx, sellFace, setSellFace, metric, setMetric, cell, setCell, stage, setStage, hover, setHover,
    sell, buy, sFace, dv01Sell, bFace, dv01Buy, pickupYield, pickupRv, cashSell, cashBuy, carry, sameIssue, sc, hi, swapLegs, pick,
  } = useRv();

  const richest = [...ISSUES].sort((a, b) => a.resid - b.resid)[0];
  const cheapest = [...ISSUES].sort((a, b) => b.resid - a.resid)[0];
  const flagged = FLIES.filter((f) => Math.abs(f.z) >= 2);

  return (
    <StudioShell
      screen="RV"
      title="Curve ideas"
      lead="Spot Treasuries that look cheap or expensive, then swap one for another without changing your rate risk."
      context={
        <span className="text-[12px] text-stone-500">
          US Treasury curve · Nelson–Siegel fit · fit error <span className="font-medium text-stone-800">2.4 bp</span> · 17 bonds · mid yields
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <Takeaway icon={<Lightbulb className="h-4 w-4" />}>
          Cheapest bond today is <strong>{label(cheapest)}</strong> ({signed(cheapest.resid)} bp above the curve). Most expensive is <strong>{label(richest)}</strong> ({signed(richest.resid)} bp below).{" "}
          {flagged.length > 0 ? `${flagged.map((f) => f.name).join(" and ")} ${flagged.length > 1 ? "are" : "is"} stretched — flagged as ideas below.` : ""}
        </Takeaway>

        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-4">
          <div className="flex min-w-0 flex-col gap-4">
            {/* 1 · Curve */}
            <Card
              icon={<ChartSpline className="h-4 w-4" />}
              title={<>Which bonds look <Term k="richCheap">cheap or rich</Term>?</>}
              hint="Dots are bonds, the line is the fitted curve. Bars underneath show how far each bond sits from it."
              actions={
                <span className="flex items-center gap-3 text-[12px] text-stone-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> cheap · buy</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> rich · sell</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 border-2 border-stone-700" /> <Term k="OTR">newest issue</Term></span>
                </span>
              }
              bodyClassName="flex flex-col px-4 pb-3"
            >
              <CurveSvg hover={hover} setHover={setHover} sellIdx={sellIdx} buyIdx={buyIdx} onPick={pick} />
              <div className="flex min-h-10 flex-wrap items-center gap-x-5 gap-y-1 border-t border-stone-100 pt-2 text-[13px] tabular-nums">
                {hi ? (
                  <>
                    <span className="font-semibold text-indigo-700">{label(hi)}{hi.otr ? " · newest" : ""}</span>
                    <span><span className={s.muted}>Yield </span>{hi.yld.toFixed(3)}%</span>
                    <span><span className={s.muted}>Curve </span>{fitted(hi.years).toFixed(3)}%</span>
                    <span className={hi.resid > 0 ? "text-blue-700" : "text-orange-700"}>{signed(hi.resid)} bp {hi.resid > 0 ? "cheap" : "rich"}</span>
                    <span><span className={s.muted}>Price </span>{hi.price.toFixed(3)}</span>
                    <span><span className={s.muted}><Term k="PV01">PV01</Term> per $1M </span>${usd(hi.pv01 * 10_000)}</span>
                  </>
                ) : (
                  <span className="text-stone-500">Point at a bond to see its numbers. Click to make it the bond you sell; Shift-click to make it the bond you buy.</span>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
              {/* 2 · Curve spread matrix */}
              <Card
                icon={<Layers className="h-4 w-4" />}
                title={<><Term k="curveSpread">Curve spreads</Term>: far minus near</>}
                actions={<Segmented label="Matrix shows" value={metric} options={SPREAD_METRICS} onChange={setMetric} />}
                bodyClassName="flex flex-col px-4 pb-4"
              >
                <table className="w-full border-separate border-spacing-1 text-[12px] tabular-nums" aria-label="Curve spread matrix">
                  <thead>
                    <tr>
                      <th className="w-10 text-left text-[11px] font-medium text-stone-400">near</th>
                      {TENORS.slice(1).map((tn) => (
                        <th key={tn} className="text-center text-[11px] font-medium text-stone-400">{tn}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TENORS.slice(0, -1).map((near, i) => (
                      <tr key={near}>
                        <th scope="row" className="text-left text-[12px] font-medium text-stone-600">{near}</th>
                        {TENORS.slice(1).map((far, jj) => {
                          const j = jj + 1;
                          if (j <= i) return <td key={far} />;
                          const c = spreadCell(i, j);
                          const v = metric === "lvl" ? c.lvl : metric === "d1" ? c.d1 : c.z;
                          const n = metric === "lvl" ? -c.lvl / 120 : metric === "d1" ? -c.d1 / 2 : -c.z / 2.2;
                          const on = cell.i === i && cell.j === j;
                          return (
                            <td key={far} className="p-0">
                              <button
                                type="button"
                                onClick={() => setCell({ i, j })}
                                aria-pressed={on}
                                aria-label={`${curveName(i, j)}: ${metric === "lvl" ? `${c.lvl.toFixed(1)} bp` : metric === "d1" ? `${signed(c.d1)} bp today` : `${signed(c.z, 2)} sigma`}`}
                                className={`flex h-8 w-full items-center justify-center ${onHeat(n)} ${on ? "ring-2 ring-indigo-600 ring-offset-1" : "hover:ring-2 hover:ring-stone-300"} ${s.focus}`}
                                style={{ backgroundColor: divergingHeat(n) }}
                              >
                                {metric === "lvl" ? v.toFixed(1) : metric === "d1" ? signed(v) : signed(v, 1)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 flex gap-4 text-[11px] text-stone-500">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-4" style={{ backgroundColor: divergingHeat(-0.8) }} /> {metric === "lvl" ? "steeper" : metric === "d1" ? "steepened today" : "steeper than usual"}</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-4" style={{ backgroundColor: divergingHeat(0.8) }} /> {metric === "lvl" ? "inverted" : metric === "d1" ? "flattened today" : "flatter than usual"}</span>
                </p>
                <div className="mt-3 bg-stone-50 px-3 py-2.5 text-[13px]">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-indigo-700">{curveName(cell.i, cell.j)}</span>
                    <span className="tabular-nums text-stone-900">{sc.lvl.toFixed(1)} bp <span className={moveText(sc.d1)}>{signed(sc.d1)}</span></span>
                  </div>
                  <p className="mt-1 text-stone-600">
                    {Math.abs(sc.z) >= 1.5
                      ? `${signed(sc.z, 1)}σ vs 3 months — ${sc.z > 0 ? "steep" : "flat"} to history (${sc.pct}th percentile). A ${sc.z > 0 ? "flattener" : "steepener"} would bet on it reverting.`
                      : `${signed(sc.z, 1)}σ vs 3 months — inside its normal range (${sc.pct}th percentile).`}
                  </p>
                </div>
              </Card>

              {/* 3 · Butterflies */}
              <Card title={<Term k="fly">Butterflies</Term>} hint="2 × belly minus the wings. Positive = belly cheap." bodyClassName="px-4 pb-4">
                <ul className={`divide-y ${s.divide}`}>
                  {FLIES.map((f) => {
                    const flag = Math.abs(f.z) >= 2;
                    return (
                      <li key={f.name} className="py-2.5">
                        <div className="flex items-baseline justify-between text-[13px] tabular-nums">
                          <span className="font-medium text-stone-900">{f.name} {flag && <Badge tone="warn">Idea</Badge>}</span>
                          <span className="text-stone-900">{signed(f.lvl)} bp <span className={moveText(f.d1)}>{signed(f.d1)}</span></span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="relative h-1.5 flex-1 bg-stone-100" aria-hidden>
                            <div className="absolute inset-y-0 left-1/2 w-px bg-stone-400" />
                            <div className={`absolute inset-y-0 ${f.z >= 0 ? "left-1/2 bg-blue-500" : "right-1/2 bg-orange-500"}`} style={{ width: `${Math.min(1, Math.abs(f.z) / 3) * 50}%` }} />
                          </div>
                          <span className={`w-12 text-right text-[12px] tabular-nums ${flag ? "font-semibold text-amber-700" : "text-stone-500"}`}>{signed(f.z, 1)}σ</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-[11px] text-stone-400">Beyond ±2σ is flagged as a trade idea.</p>
              </Card>
            </div>
          </div>

          {/* 4 · Switch builder */}
          <Card
            icon={<ArrowLeftRight className="h-4 w-4" />}
            title={<>Build a <Term k="switch">switch</Term></>}
            hint="Sell the expensive bond, buy the cheap one. Rate risk stays the same."
            bodyClassName="flex flex-col px-4 pb-4"
          >
            <Leg tone="sell" title="You sell" issue={sell} idx={sellIdx} onPick={setSellIdx} />
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="srv-sell-face" className={`w-28 ${s.label}`}>Amount, $M</label>
              <input id="srv-sell-face" inputMode="decimal" value={sellFace} onChange={(e) => setSellFace(e.target.value.replace(/[^0-9.]/g, ""))} className={`w-24 text-right text-[16px] font-semibold tabular-nums ${s.input}`} />
              <span className="text-[12px] text-stone-500"><Term k="DV01">DV01</Term> ${usd(dv01Sell)}</span>
            </div>

            <div className="my-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-stone-200" />
              <button type="button" onClick={swapLegs} className={`flex items-center gap-1.5 px-3 py-1 text-[12px] ${s.secondary} ${s.focus}`} aria-label="Swap legs">
                <ArrowLeftRight className="h-3.5 w-3.5 rotate-90" /> Swap
              </button>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <Leg tone="buy" title="You buy" issue={buy} idx={buyIdx} onPick={setBuyIdx} />
            <div className="mt-2 flex items-center gap-2">
              <span className={`w-28 ${s.label}`}>Amount, $M</span>
              <span className="w-24 border border-blue-200 bg-blue-50 px-3 py-2 text-right text-[16px] font-semibold text-blue-700 tabular-nums">{(bFace / 1e6).toFixed(1)}</span>
              <span className="text-[12px] text-stone-500">DV01 ${usd(dv01Buy)} · ratio {(bFace / (sFace || 1)).toFixed(3)}</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-400">Worked out for you so both legs carry the same rate risk.</p>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
              <Stat label="Extra yield" value={`${signed(pickupYield)} bp`} valueClass={moveText(pickupYield)} />
              <Stat label="Cheapness gained" value={`${signed(pickupRv)} bp`} valueClass={moveText(pickupRv)} />
              <Stat label={<Term k="carry">Carry + roll, 3M</Term>} value={`${signed(carry, 1)} bp`} valueClass={moveText(carry)} />
              <Stat label="Net DV01" value={money(dv01Buy - dv01Sell)} sub="buy size rounded to $0.1M" />
            </div>
            <div className="mt-3">
              <Row k="Cash from the sale" v={`$${usd(cashSell)}`} />
              <Row k="Cash for the purchase" v={`$${usd(cashBuy)}`} />
              <Row k="Net cash" v={money(cashSell - cashBuy)} vClass={moveText(cashSell - cashBuy)} />
              <Row k="Curve exposure" v={buy.years > sell.years ? "Flattener bias · extends" : "Steepener bias · shortens"} />
            </div>

            {sameIssue && <p className="mt-3 flex items-start gap-2 bg-rose-50 px-3 py-2 text-[13px] text-rose-800"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />Both legs are the same bond. Pick a different one to buy.</p>}
            {!sameIssue && pickupRv < 0 && (
              <p className="mt-3 flex items-start gap-2 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />You're selling the cheaper bond, which gives up value. Swap the legs unless this is a curve trade.
              </p>
            )}

            <div className="flex-1" />
            {stage === "build" && (
              <button type="button" disabled={sameIssue || sFace === 0} onClick={() => setStage("confirm")} className={`mt-4 py-3 text-[14px] font-semibold ${s.primary} ${s.focus} disabled:opacity-40`}>
                Review switch · {signed(pickupRv)} bp gained
              </button>
            )}
            {stage === "sent" && (
              <div className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-[13px]" role="status">
                <p className="flex items-center gap-2 font-semibold text-emerald-800"><CircleCheck className="h-4 w-4" /> Switch sent to dealers as one package · SW-30981</p>
                <p className="mt-0.5 text-stone-600">Quoted as a single spread, so both legs fill together — no risk of only one side trading.</p>
                <button type="button" onClick={() => setStage("build")} className={`mt-2 w-full py-1.5 text-[13px] ${s.secondary} ${s.focus}`}>Build another</button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {stage === "confirm" && (
        <Dialog
          title="Send this switch?"
          onClose={() => setStage("build")}
          actions={
            <>
              <button type="button" onClick={() => setStage("build")} className={`px-4 py-2 text-[13px] ${s.secondary} ${s.focus}`}>Back</button>
              <button type="button" autoFocus onClick={() => setStage("sent")} className={`px-5 py-2 text-[14px] font-semibold ${s.primary} ${s.focus}`}>Send to dealers</button>
            </>
          }
        >
          <p className="text-[16px] leading-snug text-stone-900">
            <strong className="text-orange-600">SELL</strong> {mm(sFace)} {label(sell)} and <strong className="text-blue-600">BUY</strong> {mm(bFace)} {label(buy)} as one package.
          </p>
          <div className="mt-4">
            <Row k="Package level" v={`${signed(pickupYield)} bp`} />
            <Row k="Cheapness gained" v={`${signed(pickupRv)} bp`} />
            <Row k="Net DV01" v={money(dv01Buy - dv01Sell)} />
            <Row k="Net cash" v={money(cashSell - cashBuy)} />
            <Row k="Dealers" v="Morrow · Halbrook · Corran · Vantage" />
          </div>
        </Dialog>
      )}
    </StudioShell>
  );
}

function Leg({ tone, title, issue, idx, onPick }: { tone: "buy" | "sell"; title: string; issue: Issue; idx: number; onPick: (i: number) => void }) {
  const buy = tone === "buy";
  return (
    <div className={`border-l-4 pl-3 ${buy ? "border-blue-600" : "border-orange-600"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[12px] font-semibold ${buy ? "text-blue-700" : "text-orange-700"}`}>{title}</span>
        <Badge tone={issue.resid > 0 ? "buy" : "sell"}>{signed(issue.resid)} bp {issue.resid > 0 ? "cheap" : "rich"}</Badge>
      </div>
      <select value={idx} onChange={(e) => onPick(Number(e.target.value))} aria-label={title} className={`mt-1.5 w-full text-[13px] ${s.input}`}>
        {ISSUES.map((i, k) => (
          <option key={k} value={k}>
            {label(i)} · {i.yld.toFixed(3)}% · {signed(i.resid)} bp{i.otr ? " · newest" : ""}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex gap-4 text-[12px] tabular-nums text-stone-500">
        <span>Price <span className="text-stone-900">{issue.price.toFixed(3)}</span></span>
        <span>Yield <span className="text-stone-900">{issue.yld.toFixed(3)}%</span></span>
        <span>Matures in <span className="text-stone-900">{issue.years.toFixed(1)} yrs</span></span>
      </div>
    </div>
  );
}

function CurveSvg({ hover, setHover, sellIdx, buyIdx, onPick }: {
  hover: number | null;
  setHover: (n: number | null) => void;
  sellIdx: number;
  buyIdx: number;
  onPick: (i: number, asBuy: boolean) => void;
}) {
  const W = 900;
  const H = 300;
  const L = 44;
  const R = 12;
  const T = 16;
  const curveB = 196;
  const resT = 214;
  const resB = H - 22;
  const xs = (y: number) => L + (Math.sqrt(y) / Math.sqrt(31)) * (W - L - R); // sqrt scale gives the front end room
  const yLo = 3.3;
  const yHi = 4.75;
  const ys = (v: number) => T + ((yHi - v) / (yHi - yLo)) * (curveB - T);
  const resMid = (resT + resB) / 2;
  const rs = (bp: number) => resMid - (bp / 6) * ((resB - resT) / 2);
  const font = "ui-sans-serif, system-ui, sans-serif";

  const fitPath = Array.from({ length: 120 }, (_, k) => {
    const y = 0.7 + (k / 119) * 30;
    return `${k ? "L" : "M"}${xs(y).toFixed(1)},${ys(fitted(y)).toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="US Treasury yield curve with the fitted curve and how cheap or rich each bond is">
      {[3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke="#f5f5f4" />
          <text x={L - 8} y={ys(v) + 4} textAnchor="end" fontSize={11} fill="#a8a29e" fontFamily={font}>{v.toFixed(1)}%</text>
        </g>
      ))}
      {[1, 2, 3, 5, 7, 10, 20, 30].map((v) => (
        <text key={v} x={xs(v)} y={H - 4} textAnchor="middle" fontSize={11} fill="#a8a29e" fontFamily={font}>{v} yr</text>
      ))}
      <text x={L} y={resT - 4} fontSize={11} fill="#78716c" fontFamily={font}>Cheap ↑ / rich ↓, bp</text>
      <line x1={L} x2={W - R} y1={resMid} y2={resMid} stroke="#d6d3d1" />
      <path d={fitPath} fill="none" stroke="#6366f1" strokeWidth={2} />

      {ISSUES.map((iss, i) => {
        const cx = xs(iss.years);
        const cy = ys(iss.yld);
        const fill = iss.resid > 0 ? "#2563eb" : "#ea580c";
        const leg = i === sellIdx ? "Sell" : i === buyIdx ? "Buy" : null;
        const on = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={(e) => onPick(i, e.shiftKey)} className="cursor-pointer">
            <line x1={cx} x2={cx} y1={ys(fitted(iss.years))} y2={cy} stroke={fill} strokeWidth={1.25} opacity={0.5} />
            {iss.otr ? (
              <rect x={cx - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${cx} ${cy})`} fill={fill} stroke="#1c1917" strokeWidth={on ? 2.5 : 1.5} />
            ) : (
              <circle cx={cx} cy={cy} r={on ? 6.5 : 5} fill={fill} stroke="#fff" strokeWidth={1.5} />
            )}
            {leg && (
              <g>
                <rect x={cx - 17} y={cy - 27} width={34} height={16} fill={leg === "Sell" ? "#ea580c" : "#2563eb"} />
                <text x={cx} y={cy - 15} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" fontFamily={font}>{leg}</text>
              </g>
            )}
            <rect x={cx - 5} width={10} y={Math.min(rs(iss.resid), resMid)} height={Math.abs(rs(iss.resid) - resMid)} fill={actionHeat(iss.resid / 5)} stroke={on ? "#1c1917" : "none"} />
            <rect x={cx - 10} y={T} width={20} height={resB - T} fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
