import { TerminalShell } from "../components/fi-terminal/TerminalShell";
import { Panel, Row, Segmented, Stat, Tag } from "../components/fi-terminal/ui";
import { actionHeat, divergingHeat, moveText, t } from "../components/fi-terminal/tokens";
import { FLIES, ISSUES, SPREAD_METRICS, TENORS, curveName, fitted, label, money, spreadCell, useRv, type Issue } from "../components/fi-terminal/model/rv";
import { mm, signed, usd } from "../components/fi-terminal/format";

export const title = "FI · Rates Relative Value";
export const section = "trading";
export const fullWidth = true;

/* FI Terminal · 5 of 5 — RV.
 *
 * Treasury relative value: which bonds are rich or cheap to a fitted curve,
 * which parts of the curve look stretched, and a switch builder that turns
 * the idea into a DV01-neutral sell-one / buy-the-other trade.
 *
 * Colour here means "what you'd do": cheap (yield above the curve) is sky,
 * the buy colour; rich is rose, the sell colour. The curve-spread matrix
 * uses the market green/red for steeper/flatter vs its own history. */

export default function FiRatesRv() {
  const {
    sellIdx, setSellIdx, buyIdx, setBuyIdx, sellFace, setSellFace, metric, setMetric, cell, setCell, stage, setStage, hover, setHover,
    sell, buy, sFace, dv01Sell, bFace, dv01Buy, pickupYield, pickupRv, cashSell, cashBuy, carry, sameIssue, sc, hi, swapLegs, pick,
  } = useRv();

  return (
    <TerminalShell
      screen="RV"
      context={
        <span className="text-[11px] text-neutral-400">
          US Treasury curve · Nelson–Siegel fit · RMS error <span className="text-neutral-100">2.4 bp</span> · 17 issues · mid yields
        </span>
      }
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_400px] gap-px bg-[#1c232d]">
        <div className="flex min-h-0 flex-col gap-px">
          {/* 1 · Curve + residuals */}
          <Panel
            n={1}
            title="Yield curve · rich / cheap to fit"
            className="min-h-0 flex-[1.35]"
            bodyClassName="flex flex-col"
            actions={
              <span className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> cheap · buy</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> rich · sell</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rotate-45 border border-amber-300" /> on-the-run</span>
              </span>
            }
          >
            <CurveSvg hover={hover} setHover={setHover} sellIdx={sellIdx} buyIdx={buyIdx} onPick={pick} />
            <div className={`flex h-8 shrink-0 items-center gap-5 border-t ${t.border} px-3 text-[11px] tabular-nums`}>
              {hi ? (
                <>
                  <span className="w-32 text-amber-300">{label(hi)}{hi.otr ? " · OTR" : ""}</span>
                  <span><span className={t.muted}>Yld </span><span className={t.value}>{hi.yld.toFixed(3)}</span></span>
                  <span><span className={t.muted}>Fit </span><span className={t.value}>{fitted(hi.years).toFixed(3)}</span></span>
                  <span><span className={t.muted}>Rich/cheap </span><span className={hi.resid > 0 ? "text-sky-300" : "text-rose-300"}>{signed(hi.resid)} bp {hi.resid > 0 ? "cheap" : "rich"}</span></span>
                  <span><span className={t.muted}>Px </span><span className={t.value}>{hi.price.toFixed(3)}</span></span>
                  <span><span className={t.muted}>PV01/MM </span><span className={t.value}>${usd(hi.pv01 * 10_000)}</span></span>
                </>
              ) : (
                <span className="text-neutral-500">Hover a bond for its numbers · click to put it in the switch (click = sell leg, shift-click = buy leg)</span>
              )}
            </div>
          </Panel>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-px">
            {/* 2 · Curve spread matrix */}
            <Panel
              n={2}
              title="Curve spreads · far − near"
              bodyClassName="flex flex-col p-2.5"
              actions={<Segmented label="Matrix metric" value={metric} options={SPREAD_METRICS} onChange={setMetric} />}
            >
              <table className="w-full border-separate border-spacing-[2px] text-[11px] tabular-nums" aria-label="Curve spread matrix">
                <thead>
                  <tr>
                    <th className={`w-10 text-left ${t.colHead}`}>near</th>
                    {TENORS.slice(1).map((tn) => (
                      <th key={tn} className={`text-center ${t.colHead}`}>{tn}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TENORS.slice(0, -1).map((near, i) => (
                    <tr key={near}>
                      <th scope="row" className="text-left text-[11px] text-neutral-400">{near}</th>
                      {TENORS.slice(1).map((far, jj) => {
                        const j = jj + 1;
                        if (j <= i) return <td key={far} />;
                        const c = spreadCell(i, j);
                        const v = metric === "lvl" ? c.lvl : metric === "d1" ? c.d1 : c.z;
                        const bg = metric === "lvl" ? divergingHeat(-c.lvl / 120) : metric === "d1" ? divergingHeat(-c.d1 / 2) : divergingHeat(-c.z / 2.2);
                        const on = cell.i === i && cell.j === j;
                        return (
                          <td key={far} className="p-0">
                            <button
                              type="button"
                              onClick={() => setCell({ i, j })}
                              aria-pressed={on}
                              aria-label={`${curveName(i, j)}: ${metric === "lvl" ? `${c.lvl.toFixed(1)} bp` : metric === "d1" ? `${signed(c.d1)} bp today` : `${signed(c.z, 2)} sigma`}`}
                              className={`flex h-7 w-full items-center justify-center text-neutral-100 ${on ? "ring-2 ring-inset ring-amber-400" : "hover:ring-1 hover:ring-inset hover:ring-white/40"} ${t.focus}`}
                              style={{ backgroundColor: bg }}
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
              <p className="mt-2 flex gap-4 text-[10px] text-neutral-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-4" style={{ backgroundColor: divergingHeat(-0.8) }} /> {metric === "lvl" ? "steeper" : metric === "d1" ? "steepened today" : "steeper than usual"}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-4" style={{ backgroundColor: divergingHeat(0.8) }} /> {metric === "lvl" ? "inverted" : metric === "d1" ? "flattened today" : "flatter than usual"}</span>
              </p>
              <div className={`mt-auto border-t ${t.border} pt-2 text-[11px]`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-amber-300">{curveName(cell.i, cell.j)}</span>
                  <span className="text-neutral-100">{sc.lvl.toFixed(1)} bp <span className={moveText(sc.d1)}>{signed(sc.d1)}</span></span>
                </div>
                <p className="mt-1 text-neutral-400">
                  {Math.abs(sc.z) >= 1.5
                    ? `${signed(sc.z, 1)}σ vs 3M — ${sc.z > 0 ? "steep" : "flat"} to history (${sc.pct}th pct). A ${sc.z > 0 ? "flattener" : "steepener"} fades it.`
                    : `${signed(sc.z, 1)}σ vs 3M — inside its normal range (${sc.pct}th pct).`}
                </p>
              </div>
            </Panel>

            {/* 3 · Butterflies */}
            <Panel n={3} title="Butterflies · 2×belly − wings" bodyClassName="overflow-auto">
              <table className="w-full text-[11px] tabular-nums">
                <thead>
                  <tr className={`border-b ${t.border}`}>
                    <th className={`px-2.5 py-1.5 text-left ${t.colHead}`}>Fly</th>
                    <th className={`py-1.5 text-right ${t.colHead}`}>Level</th>
                    <th className={`py-1.5 text-right ${t.colHead}`}>Δ1D</th>
                    <th className={`px-2.5 py-1.5 text-left ${t.colHead}`}>Z 3M</th>
                  </tr>
                </thead>
                <tbody>
                  {FLIES.map((f) => (
                    <tr key={f.name} className={`border-b ${t.border}`}>
                      <td className="px-2.5 py-2 text-neutral-100">{f.name}</td>
                      <td className="py-2 text-right text-neutral-100">{signed(f.lvl)}</td>
                      <td className={`py-2 text-right ${moveText(f.d1)}`}>{signed(f.d1)}</td>
                      <td className="px-2.5 py-2">
                        <ZBar z={f.z} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2.5 py-2 text-[10px] text-neutral-600">Positive fly = belly cheap to wings. |z| ≥ 2 is flagged as a trade idea.</p>
            </Panel>
          </div>
        </div>

        {/* 4 · Switch builder */}
        <Panel n={4} title="Switch builder · DV01-neutral" bodyClassName="relative flex flex-col overflow-auto p-3">
          <Leg tone="sell" title="Sell · rich leg" issue={sell} idx={sellIdx} onPick={setSellIdx} />
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="rv-sell-face" className={`w-28 ${t.colHead}`}>Sell face, MM</label>
            <input
              id="rv-sell-face"
              inputMode="decimal"
              value={sellFace}
              onChange={(e) => setSellFace(e.target.value.replace(/[^0-9.]/g, ""))}
              className={`w-24 text-right text-[14px] font-semibold tabular-nums ${t.input}`}
            />
            <span className="text-[10px] text-neutral-500">DV01 ${usd(dv01Sell)}</span>
          </div>

          <div className="my-3 flex items-center gap-2 text-[10px] text-neutral-500">
            <div className="h-px flex-1 bg-[#2a3340]" />
            <button type="button" onClick={swapLegs} className={`px-2 py-0.5 ${t.ghost} ${t.focus}`} aria-label="Swap legs">
              ⇅ swap legs
            </button>
            <div className="h-px flex-1 bg-[#2a3340]" />
          </div>

          <Leg tone="buy" title="Buy · cheap leg" issue={buy} idx={buyIdx} onPick={setBuyIdx} />
          <div className="mt-2 flex items-center gap-2">
            <span className={`w-28 ${t.colHead}`}>Buy face, MM</span>
            <span className={`w-24 text-right text-[14px] font-semibold tabular-nums ${t.input} text-sky-300`}>{(bFace / 1e6).toFixed(1)}</span>
            <span className="text-[10px] text-neutral-500">DV01 ${usd(dv01Buy)} · ratio {(bFace / (sFace || 1)).toFixed(3)}</span>
          </div>

          <div className={`mt-4 grid grid-cols-2 gap-3 border-t ${t.border} pt-3`}>
            <Stat label="Yield pickup" value={`${signed(pickupYield)} bp`} valueClass={moveText(pickupYield)} />
            <Stat label="RV pickup" value={`${signed(pickupRv)} bp`} valueClass={moveText(pickupRv)} sub="cheapness gained" />
            <Stat label="Carry + roll 3M" value={`${signed(carry, 1)} bp`} valueClass={moveText(carry)} />
            <Stat label="Net DV01" value={money(dv01Buy - dv01Sell)} sub="buy face rounded to 0.1MM" />
          </div>
          <div className="mt-3 text-[11px]">
            <Row k="Cash from sale" v={`$${usd(cashSell)}`} />
            <Row k="Cash for purchase" v={`$${usd(cashBuy)}`} />
            <Row k="Net cash" v={money(cashSell - cashBuy)} vClass={moveText(cashSell - cashBuy)} />
            <Row k="Curve exposure" v={buy.years > sell.years ? "Flattener bias · extends" : "Steepener bias · shortens"} />
          </div>

          {sameIssue && <p className="mt-3 text-[11px] text-rose-400">Both legs are the same bond. Pick a different buy leg.</p>}
          {!sameIssue && pickupRv < 0 && <p className="mt-3 border-l-2 border-amber-400 pl-2 text-[11px] text-amber-200">You are selling the cheaper bond. That gives up RV — swap legs unless this is a curve trade.</p>}

          <div className="flex-1" />
          {stage === "build" && (
            <button type="button" disabled={sameIssue || sFace === 0} onClick={() => setStage("confirm")} className={`mt-4 py-3 text-[12px] font-bold uppercase tracking-widest ${t.action} ${t.focus} disabled:opacity-40`}>
              Review switch · {signed(pickupRv)} bp RV
            </button>
          )}
          {stage === "sent" && (
            <div className="mt-4 border border-emerald-500/40 bg-emerald-500/[0.07] p-2.5 text-[11px]" role="status">
              <p className="font-bold text-emerald-300">Switch sent as a package RFQ · SW-30981</p>
              <p className="mt-0.5 text-neutral-400">Quoted as a single spread so both legs fill together — no legging risk.</p>
              <button type="button" onClick={() => setStage("build")} className={`mt-2 w-full py-1.5 text-[10px] font-semibold uppercase ${t.ghost} ${t.focus}`}>New switch</button>
            </div>
          )}
          {stage === "confirm" && (
            <div className="absolute inset-0 z-10 flex flex-col bg-[#0c1016]/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rv-confirm">
              <p id="rv-confirm" className={t.label}>Confirm switch</p>
              <p className="mt-3 text-[15px] leading-snug text-neutral-100">
                <span className="font-bold text-rose-400">SELL</span> {mm(sFace)} {label(sell)} and <span className="font-bold text-sky-400">BUY</span> {mm(bFace)} {label(buy)} as one package.
              </p>
              <div className="mt-4 text-[11px]">
                <Row k="Package level" v={`${signed(pickupYield)} bp`} />
                <Row k="RV pickup" v={`${signed(pickupRv)} bp`} />
                <Row k="Net DV01" v={money(dv01Buy - dv01Sell)} />
                <Row k="Net cash" v={money(cashSell - cashBuy)} />
                <Row k="Dealers" v="MSX · HLB · CRN · VTX" />
              </div>
              <div className="flex-1" />
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" onClick={() => setStage("build")} className={`py-3 text-[11px] font-semibold uppercase ${t.ghost} ${t.focus}`}>Back</button>
                <button type="button" autoFocus onClick={() => setStage("sent")} className={`py-3 text-[12px] font-bold uppercase tracking-widest ${t.action} ${t.focus}`}>Send package RFQ</button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </TerminalShell>
  );

}

/* ---------- pieces ---------- */

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
  const T = 14;
  const curveB = 196; // bottom of curve plot
  const resT = 214; // top of residual plot
  const resB = H - 22;
  const xs = (y: number) => L + (Math.sqrt(y) / Math.sqrt(31)) * (W - L - R); // sqrt scale gives the front end room
  const yLo = 3.3;
  const yHi = 4.75;
  const ys = (v: number) => T + ((yHi - v) / (yHi - yLo)) * (curveB - T);
  const resMid = (resT + resB) / 2;
  const rs = (bp: number) => resMid - (bp / 6) * ((resB - resT) / 2);

  const fitPath = Array.from({ length: 120 }, (_, k) => {
    const y = 0.7 + (k / 119) * 30;
    return `${k ? "L" : "M"}${xs(y).toFixed(1)},${ys(fitted(y)).toFixed(1)}`;
  }).join(" ");

  const yTicks = [3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6];
  const xTicks = [1, 2, 3, 5, 7, 10, 20, 30];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="min-h-0 w-full flex-1" role="img" aria-label="US Treasury yield curve with fitted Nelson–Siegel curve and rich/cheap residuals per bond">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke="#161c25" />
          <text x={L - 6} y={ys(v) + 3} textAnchor="end" fontSize={9} fill="#6b7280" fontFamily="ui-monospace, monospace">{v.toFixed(1)}</text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={v}>
          <line x1={xs(v)} x2={xs(v)} y1={T} y2={resB} stroke="#11161e" />
          <text x={xs(v)} y={H - 6} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="ui-monospace, monospace">{v}Y</text>
        </g>
      ))}
      <text x={6} y={T + 4} fontSize={9} fill="#fbbf24" fontFamily="ui-monospace, monospace">Yld %</text>
      <text x={6} y={resT + 4} fontSize={9} fill="#fbbf24" fontFamily="ui-monospace, monospace">bp</text>

      {/* residual axis */}
      <line x1={L} x2={W - R} y1={resMid} y2={resMid} stroke="#2a3340" />
      {[-4, 4].map((v) => (
        <text key={v} x={L - 6} y={rs(v) + 3} textAnchor="end" fontSize={9} fill="#6b7280" fontFamily="ui-monospace, monospace">{v > 0 ? `+${v}` : v}</text>
      ))}

      <path d={fitPath} fill="none" stroke="#fbbf24" strokeWidth={1.5} opacity={0.85} />

      {ISSUES.map((iss, i) => {
        const cx = xs(iss.years);
        const cy = ys(iss.yld);
        const fill = iss.resid > 0 ? "#38bdf8" : "#fb7185";
        const leg = i === sellIdx ? "S" : i === buyIdx ? "B" : null;
        const on = hover === i;
        return (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => onPick(i, e.shiftKey)}
            className="cursor-pointer"
          >
            {/* stick from fit to point */}
            <line x1={cx} x2={cx} y1={ys(fitted(iss.years))} y2={cy} stroke={fill} strokeWidth={1} opacity={0.6} />
            {iss.otr ? (
              <rect x={cx - 4} y={cy - 4} width={8} height={8} transform={`rotate(45 ${cx} ${cy})`} fill={fill} stroke="#fcd34d" strokeWidth={on ? 2 : 1} />
            ) : (
              <circle cx={cx} cy={cy} r={on ? 5 : 3.5} fill={fill} />
            )}
            {leg && (
              <text x={cx} y={cy - 9} textAnchor="middle" fontSize={10} fontWeight={700} fill={leg === "S" ? "#fb7185" : "#38bdf8"} fontFamily="ui-monospace, monospace">{leg}</text>
            )}
            {/* residual bar */}
            <rect x={cx - 4} width={8} y={Math.min(rs(iss.resid), resMid)} height={Math.abs(rs(iss.resid) - resMid)} fill={actionHeat(iss.resid / 5)} stroke={on ? "#fff" : "none"} />
            {/* larger invisible hit area */}
            <rect x={cx - 9} y={T} width={18} height={resB - T} fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}

function Leg({ tone, title, issue, idx, onPick }: { tone: "buy" | "sell"; title: string; issue: Issue; idx: number; onPick: (i: number) => void }) {
  const colour = tone === "buy" ? "text-sky-400" : "text-rose-400";
  return (
    <div className={`border-l-2 ${tone === "buy" ? "border-sky-500" : "border-rose-500"} pl-2.5`}>
      <div className="flex items-baseline justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${colour}`}>{title}</span>
        <Tag tone={issue.resid > 0 ? "sky" : "down"}>{signed(issue.resid)} bp {issue.resid > 0 ? "cheap" : "rich"}</Tag>
      </div>
      <select value={idx} onChange={(e) => onPick(Number(e.target.value))} aria-label={title} className={`mt-1.5 w-full ${t.input}`}>
        {ISSUES.map((i, k) => (
          <option key={k} value={k}>
            {label(i)} · {i.yld.toFixed(3)}% · {signed(i.resid)}bp{i.otr ? " · OTR" : ""}
          </option>
        ))}
      </select>
      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <span><span className={t.muted}>Px </span><span className={t.value}>{issue.price.toFixed(3)}</span></span>
        <span><span className={t.muted}>Yld </span><span className={t.value}>{issue.yld.toFixed(3)}</span></span>
        <span><span className={t.muted}>Mat </span><span className={t.value}>{issue.years.toFixed(1)}y</span></span>
      </div>
    </div>
  );
}

function ZBar({ z }: { z: number }) {
  const w = Math.min(1, Math.abs(z) / 3) * 50;
  const flagged = Math.abs(z) >= 2;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 bg-white/[0.05]" aria-hidden>
        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-600" />
        <div className={`absolute inset-y-0 ${z >= 0 ? "left-1/2 bg-sky-400/70" : "right-1/2 bg-rose-400/70"}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`w-10 tabular-nums ${flagged ? "font-bold text-amber-300" : "text-neutral-400"}`}>{signed(z, 1)}σ</span>
      {flagged && <Tag tone="amber">idea</Tag>}
    </div>
  );
}
