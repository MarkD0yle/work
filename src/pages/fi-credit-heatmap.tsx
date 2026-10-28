import { TerminalShell } from "../components/fi-terminal/TerminalShell";
import { Panel, Row, Segmented, Stat, Tag } from "../components/fi-terminal/ui";
import { divergingHeat, levelHeat, moveText, t } from "../components/fi-terminal/tokens";
import { shortName } from "../components/fi-terminal/bonds";
import { MARKET_TONE, METRICS, SECTORS, TENORS, UNIVERSES, fmtMetric, metricValue, tenorIndex, useCreditMap, type Metric, type Mover, type Pos } from "../components/fi-terminal/model/creditMap";
import { openWith } from "../components/fi-terminal/selection";
import { signed } from "../components/fi-terminal/format";

export const title = "FI · Credit Heat Map";
export const section = "trading";
export const fullWidth = true;

/* FI Terminal · 1 of 5 — HMAP.
 *
 * The morning question for a credit trader: "where did spreads move, and is
 * that move unusual?" A sector × tenor heat map answers it at a glance.
 * Metric switch changes what the colour means (level, 1D/1W/1M change,
 * 3-month z-score); the readout bar always states the exact number, so
 * colour is never the only carrier of meaning. Pick a cell → the right
 * rail shows the bucket and the bonds in it, each one a click from an RFQ. */

export default function FiCreditHeatmap() {
  const {
    metric, setMetric, universe, setUniverse, sel, setSel, setHover,
    grid, maxAbs, minLvl, maxLvl, rowAvg, colAvg, focus, fc, sc, movers, sectorBonds, z, zVerdict, percentile,
  } = useCreditMap();

  const colour = (v: number) =>
    metric === "oas" ? levelHeat((v - minLvl) / (maxLvl - minLvl || 1)) : metric === "z" ? divergingHeat(v / 2.5) : divergingHeat(v / (maxAbs || 1));

  return (
    <TerminalShell
      screen="HMAP"
      context={
        <span className="text-[11px] text-neutral-400">
          USD Corporates · <span className="text-neutral-200">{UNIVERSES.find((u) => u.id === universe)?.label}</span> · G-spread vs on-the-run UST · close-to-live
        </span>
      }
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_380px] gap-px bg-[#1c232d]">
        {/* Left: matrix + movers */}
        <div className="flex min-h-0 flex-col gap-px">
          <Panel
            n={1}
            title="Spread heat map · sector × tenor"
            className="min-h-0 flex-[3]"
            bodyClassName="flex flex-col"
            actions={
              <div className="flex items-center gap-2">
                <Segmented label="Universe" value={universe} options={UNIVERSES} onChange={setUniverse} />
                <Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />
              </div>
            }
          >
            <div className="min-h-0 flex-1 overflow-auto p-2.5">
              <table className="w-full border-separate border-spacing-[2px] tabular-nums" aria-label="Credit spread heat map">
                <thead>
                  <tr>
                    <th className={`w-28 text-left ${t.colHead}`}>Sector</th>
                    {TENORS.map((tn) => (
                      <th key={tn} className={`${t.colHead} text-center`}>{tn}</th>
                    ))}
                    <th className={`w-16 text-center ${t.colHead}`}>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, si) => (
                    <tr key={SECTORS[si]}>
                      <th scope="row" className={`text-left text-[11px] font-medium ${si === sel.s ? "text-amber-300" : "text-neutral-300"}`}>
                        {SECTORS[si]}
                      </th>
                      {row.map((c, ti) => {
                        const v = metricValue(c, metric);
                        const isSel = si === sel.s && ti === sel.t;
                        return (
                          <td key={ti} className="p-0">
                            <button
                              type="button"
                              onClick={() => setSel({ s: si, t: ti })}
                              onMouseEnter={() => setHover({ s: si, t: ti })}
                              onMouseLeave={() => setHover(null)}
                              onFocus={() => setHover({ s: si, t: ti })}
                              onBlur={() => setHover(null)}
                              aria-pressed={isSel}
                              aria-label={`${SECTORS[si]} ${TENORS[ti]}: ${METRICS.find((m) => m.id === metric)?.label} ${fmtMetric(v, metric)}`}
                              className={`flex h-8 w-full items-center justify-center text-[11px] text-neutral-100 outline-none transition ${
                                isSel ? "ring-2 ring-inset ring-amber-400" : "hover:ring-1 hover:ring-inset hover:ring-white/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-amber-300"
                              }`}
                              style={{ backgroundColor: colour(v) }}
                            >
                              {fmtMetric(v, metric)}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-0">
                        <div className={`flex h-8 items-center justify-center border ${t.border} text-[11px] text-neutral-400`}>{fmtMetric(rowAvg[si], metric)}</div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className={`text-left ${t.colHead}`}>Avg</th>
                    {colAvg.map((v, i) => (
                      <td key={i} className="p-0">
                        <div className={`flex h-7 items-center justify-center border ${t.border} text-[11px] text-neutral-400`}>{fmtMetric(v, metric)}</div>
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Readout + legend: the exact numbers for whatever is under the cursor */}
            <div className={`flex h-9 shrink-0 items-center gap-5 border-t ${t.border} px-3 text-[11px] tabular-nums`}>
              <span className="w-36 truncate text-amber-300">
                {SECTORS[focus.s]} · {TENORS[focus.t]}
              </span>
              <span><span className={t.muted}>OAS </span><span className={t.value}>{fc.oas.toFixed(0)}</span></span>
              <span><span className={t.muted}>1D </span><span className={moveText(fc.d1, true)}>{signed(fc.d1)}</span></span>
              <span><span className={t.muted}>1W </span><span className={moveText(fc.d1w, true)}>{signed(fc.d1w)}</span></span>
              <span><span className={t.muted}>1M </span><span className={moveText(fc.d1m, true)}>{signed(fc.d1m)}</span></span>
              <span><span className={t.muted}>Z </span><span className={moveText(fc.z, true)}>{signed(fc.z, 2)}</span></span>
              <div className="flex-1" />
              <Legend metric={metric} lo={metric === "oas" ? minLvl : -maxAbs} hi={metric === "oas" ? maxLvl : maxAbs} />
            </div>
          </Panel>

          <div className="grid min-h-0 flex-[1.15] grid-cols-3 gap-px">
            <MoverList n={2} title="Widest 1D" rows={movers.wider} onPick={setSel} />
            <MoverList n={3} title="Tightest 1D" rows={movers.tighter} onPick={setSel} />
            <Panel n={4} title="Market tone" bodyClassName="grid grid-cols-2 content-start gap-x-4 gap-y-3 p-3">
              {MARKET_TONE.map((m) => (
                <Stat key={m.label} label={m.label} value={m.value} sub={m.sub} valueClass={m.tone === "bad" ? "text-rose-300" : "text-neutral-100"} />
              ))}
            </Panel>
          </div>
        </div>

        {/* Right: bucket detail */}
        <div className="flex min-h-0 flex-col gap-px">
          <Panel n={5} title={`Bucket · ${SECTORS[sel.s]} ${TENORS[sel.t]}`} bodyClassName="p-3" actions={<Tag tone={Math.abs(z) >= 2 ? "down" : Math.abs(z) >= 1 ? "amber" : "neutral"}>{zVerdict}</Tag>}>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="OAS" value={sc.oas.toFixed(0)} sub="bp" />
              <Stat label="Δ 1D" value={signed(sc.d1)} valueClass={moveText(sc.d1, true)} sub="bp" />
              <Stat label="Z 3M" value={signed(sc.z, 2)} valueClass={moveText(sc.z, true)} sub="σ" />
            </div>
            <Spark data={sc.hist} />
            <div className="mt-2 text-[11px]">
              <Row k="Issues in bucket" v={sc.issues} />
              <Row k="TRACE vol (1D)" v={`$${sc.vol}MM`} />
              <Row k="3M range" v={`${Math.min(...sc.hist).toFixed(0)} – ${Math.max(...sc.hist).toFixed(0)}`} />
              <Row k="Percentile (3M)" v={`${percentile}th`} />
            </div>
            <p className="mt-2 border-l-2 border-amber-400/60 pl-2 text-[11px] leading-relaxed text-neutral-400">
              {Math.abs(z) >= 2
                ? `${SECTORS[sel.s]} ${TENORS[sel.t]} has moved ${Math.abs(z).toFixed(1)}σ in a week — outside its normal range. Check for headline risk before fading it.`
                : Math.abs(z) >= 1
                  ? `Move is notable but within range. Worth a look against peers in the same tenor.`
                  : `Trading in line with its recent range. Nothing unusual here.`}
            </p>
          </Panel>

          <Panel n={6} title={`${SECTORS[sel.s]} · bonds`} className="min-h-0 flex-1" bodyClassName="overflow-auto">
            {sectorBonds.length === 0 ? (
              <p className="p-4 text-[11px] text-neutral-500">No bonds from this sector in your universe. Pick another row.</p>
            ) : (
              <table className="w-full text-[11px] tabular-nums">
                <thead className={`sticky top-0 ${t.panel}`}>
                  <tr className={`border-b ${t.border}`}>
                    <th className={`px-2.5 py-1.5 text-left ${t.colHead}`}>Bond</th>
                    <th className={`py-1.5 text-right ${t.colHead}`}>Sprd</th>
                    <th className={`py-1.5 text-right ${t.colHead}`}>1D</th>
                    <th className={`py-1.5 text-right ${t.colHead}`}>Px</th>
                    <th className={`px-2.5 py-1.5 text-right ${t.colHead}`}>Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorBonds.map(({ b, spread, d1, inBucket }) => (
                    <tr key={b.id} className={`border-b ${t.border} ${inBucket ? "bg-amber-400/[0.06]" : ""}`}>
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          {inBucket && <span className="h-1.5 w-1.5 bg-amber-400" aria-label="In selected bucket" />}
                          <span className="text-neutral-100">{shortName(b)}</span>
                        </div>
                        <span className="text-[10px] text-neutral-500">{b.rating} · {TENORS[tenorIndex(b)]}</span>
                      </td>
                      <td className="py-1.5 text-right text-neutral-100">{spread.toFixed(0)}</td>
                      <td className={`py-1.5 text-right ${moveText(d1, true)}`}>{signed(d1)}</td>
                      <td className="py-1.5 text-right text-neutral-300">{b.mid.toFixed(3)}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => openWith("fi-rfq-ticket", { bondId: b.id, side: "Buy" })} className={`px-1.5 py-0.5 text-[10px] font-bold ${t.buyBg} ${t.focus}`} aria-label={`RFQ to buy ${shortName(b)}`}>B</button>
                          <button type="button" onClick={() => openWith("fi-rfq-ticket", { bondId: b.id, side: "Sell" })} className={`px-1.5 py-0.5 text-[10px] font-bold ${t.sellBg} ${t.focus}`} aria-label={`RFQ to sell ${shortName(b)}`}>S</button>
                          <button type="button" onClick={() => openWith("fi-bond-ticket", { bondId: b.id })} className={`px-1.5 py-0.5 text-[10px] ${t.ghost} ${t.focus}`} aria-label={`Open order ticket for ${shortName(b)}`}>TKT</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </TerminalShell>
  );
}

function MoverList({ n, title, rows, onPick }: {
  n: number;
  title: string;
  rows: Mover[];
  onPick: (s: Pos) => void;
}) {
  return (
    <Panel n={n} title={title} bodyClassName="overflow-auto">
      <ul className={`divide-y ${t.divide}`}>
        {rows.map((r) => (
          <li key={`${r.si}-${r.ti}`}>
            <button type="button" onClick={() => onPick({ s: r.si, t: r.ti })} className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] tabular-nums ${t.hover} ${t.focus}`}>
              <span className="flex-1 truncate text-neutral-200">{SECTORS[r.si]} <span className="text-neutral-500">{TENORS[r.ti]}</span></span>
              <span className="w-10 text-right text-neutral-400">{r.oas.toFixed(0)}</span>
              <span className={`w-12 text-right font-semibold ${moveText(r.d1, true)}`}>{signed(r.d1)}</span>
              <span className={`w-12 text-right ${moveText(r.z, true)}`}>{signed(r.z, 1)}σ</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Legend({ metric, lo, hi }: { metric: Metric; lo: number; hi: number }) {
  const steps = Array.from({ length: 11 }, (_, i) => i / 10);
  const fill = (x: number) => (metric === "oas" ? levelHeat(x) : divergingHeat(x * 2 - 1));
  return (
    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
      <span>{metric === "oas" ? `${lo.toFixed(0)} bp` : metric === "z" ? "−2.5σ tighter" : `${signed(lo)} tighter`}</span>
      <div className="flex" aria-hidden>
        {steps.map((s) => (
          <span key={s} className="h-2.5 w-3" style={{ backgroundColor: fill(s) }} />
        ))}
      </div>
      <span>{metric === "oas" ? `${hi.toFixed(0)} bp` : metric === "z" ? "+2.5σ wider" : `${signed(hi)} wider`}</span>
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  const w = 340;
  const h = 64;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const path = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  return (
    <figure className="mt-3">
      <figcaption className="mb-1 flex justify-between text-[10px] text-neutral-500">
        <span>OAS · last 3 months</span>
        <span>{lo.toFixed(0)}–{hi.toFixed(0)} bp</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" role="img" aria-label={`OAS over 3 months, from ${data[0].toFixed(0)} to ${last.toFixed(0)} bp`}>
        <line x1={0} x2={w} y1={y(data[0])} y2={y(data[0])} stroke="#334155" strokeDasharray="2 3" />
        <path d={`${path} L${w},${h} L0,${h} Z`} fill="rgba(251,191,36,0.08)" />
        <path d={path} fill="none" stroke="#fbbf24" strokeWidth={1.25} />
        <circle cx={x(data.length - 1)} cy={y(last)} r={2.5} fill="#fbbf24" />
      </svg>
    </figure>
  );
}
