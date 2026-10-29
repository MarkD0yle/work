import type { ReactNode } from "react";
import { Lightbulb, Map as MapIcon, TrendingDown, TrendingUp } from "lucide-react";
import { StudioShell } from "../components/fi-studio/StudioShell";
import { Badge, Card, InfoTip, Move, Row, Segmented, Spark, Stat, Takeaway, Term } from "../components/fi-studio/ui";
import { divergingHeat, levelHeat, onHeat, s } from "../components/fi-studio/tokens";
import { studioSlug } from "../components/fi-studio/screens";
import { shortName } from "../components/fi-terminal/bonds";
import { openWith } from "../components/fi-terminal/selection";
import { signed } from "../components/fi-terminal/format";
import {
  MARKET_TONE, SECTORS, TENORS, fmtMetric, metricValue, tenorIndex, useCreditMap, type Metric, type Mover, type Pos, type Universe,
} from "../components/fi-terminal/model/creditMap";

export const title = "FI Studio · Credit Map";
export const section = "trading";
export const fullWidth = true;

/* FI Studio · 1 of 5 — the friendly credit heat map.
 *
 * Same features as the terminal's HMAP (one shared model), told plainly:
 * a sentence at the top says what happened today, the controls use words
 * instead of codes, every move carries an arrow and "tighter / wider", and
 * the selected bucket explains itself before showing the bonds you can trade. */

const METRIC_LABELS: { id: Metric; label: string }[] = [
  { id: "oas", label: "Spread" },
  { id: "d1", label: "1 day" },
  { id: "d1w", label: "1 week" },
  { id: "d1m", label: "1 month" },
  { id: "z", label: "How unusual" },
];
const UNIVERSE_LABELS: { id: Universe; label: string }[] = [
  { id: "ig", label: "All IG" },
  { id: "a", label: "A & up" },
  { id: "bbb", label: "BBB" },
  { id: "hy", label: "High yield" },
];

const METRIC_HELP: Record<Metric, string> = {
  oas: "Colour shows how wide each bucket's spread is. Darker = wider.",
  d1: "Colour shows today's change in spread. Green tightened, red widened.",
  d1w: "Colour shows this week's change in spread. Green tightened, red widened.",
  d1m: "Colour shows this month's change in spread. Green tightened, red widened.",
  z: "Colour shows how unusual this week's move is versus the last 3 months. Beyond ±2 is rare.",
};

export default function FiStudioCreditMap() {
  const {
    metric, setMetric, universe, setUniverse, sel, setSel, setHover,
    grid, maxAbs, minLvl, maxLvl, rowAvg, colAvg, focus, fc, sc, movers, sectorBonds, z, zVerdict, percentile,
  } = useCreditMap();

  const norm = (v: number) => (metric === "oas" ? (v - minLvl) / (maxLvl - minLvl || 1) : metric === "z" ? v / 2.5 : v / (maxAbs || 1));
  const colour = (v: number) => (metric === "oas" ? levelHeat(norm(v)) : divergingHeat(norm(v)));

  const w = movers.wider[0];
  const tt = movers.tighter[0];
  const unusual = grid.flatMap((row, si) => row.map((c, ti) => ({ si, ti, z: c.z }))).filter((c) => Math.abs(c.z) >= 2).length;

  return (
    <StudioShell
      screen="HMAP"
      title="Credit map"
      lead="Where did US corporate spreads move today — and is the move unusual?"
      context={
        <div className="flex items-center gap-3">
          <Segmented label="Which bonds" value={universe} options={UNIVERSE_LABELS} onChange={setUniverse} />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Takeaway icon={<Lightbulb className="h-4 w-4" />}>
          A risk-off day. <strong>{SECTORS[w.si]} {TENORS[w.ti]}</strong> widened most ({signed(w.d1)} bp) while{" "}
          <strong>{SECTORS[tt.si]} {TENORS[tt.ti]}</strong> tightened ({signed(tt.d1)} bp).{" "}
          {unusual > 0 ? `${unusual} bucket${unusual > 1 ? "s are" : " is"} moving more than usual — worth a look.` : "Nothing is moving more than usual."}
        </Takeaway>

        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-4">
          {/* Heat map */}
          <Card
            icon={<MapIcon className="h-4 w-4" />}
            title={<>Spreads by sector and maturity</>}
            hint={METRIC_HELP[metric]}
            actions={<Segmented label="Colour shows" value={metric} options={METRIC_LABELS} onChange={setMetric} />}
          >
            <table className="w-full border-separate border-spacing-1 tabular-nums" aria-label="Credit spread heat map">
              <thead>
                <tr>
                  <th className="w-28 text-left text-[11px] font-medium text-stone-400">Sector</th>
                  {TENORS.map((tn) => (
                    <th key={tn} className="text-center text-[11px] font-medium text-stone-400">{tn}</th>
                  ))}
                  <th className="w-16 text-center text-[11px] font-medium text-stone-400">Average</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((row, si) => (
                  <tr key={SECTORS[si]}>
                    <th scope="row" className={`text-left text-[13px] font-medium ${si === sel.s ? "text-indigo-700" : "text-stone-700"}`}>{SECTORS[si]}</th>
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
                            aria-label={`${SECTORS[si]} ${TENORS[ti]}: ${METRIC_LABELS.find((m) => m.id === metric)?.label} ${fmtMetric(v, metric)}`}
                            className={`flex h-9 w-full items-center justify-center text-[12px] transition ${onHeat(norm(v))} ${
                              isSel ? "ring-2 ring-indigo-600 ring-offset-1" : "hover:ring-2 hover:ring-stone-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            } outline-none`}
                            style={{ backgroundColor: colour(v) }}
                          >
                            {fmtMetric(v, metric)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-0">
                      <div className="flex h-9 items-center justify-center bg-stone-50 text-[12px] text-stone-500">{fmtMetric(rowAvg[si], metric)}</div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="text-left text-[11px] font-medium text-stone-400">Average</th>
                  {colAvg.map((v, i) => (
                    <td key={i} className="p-0">
                      <div className="flex h-8 items-center justify-center bg-stone-50 text-[12px] text-stone-500">{fmtMetric(v, metric)}</div>
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>

            {/* Readout: exact numbers for whatever is under the pointer */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 pt-3 text-[13px] tabular-nums">
              <span className="font-semibold text-indigo-700">{SECTORS[focus.s]} · {TENORS[focus.t]}</span>
              <span><span className={s.muted}>Spread </span>{fc.oas.toFixed(0)} bp</span>
              <span><span className={s.muted}>Today </span><Move v={fc.d1} goodWhenNegative /></span>
              <span><span className={s.muted}>Week </span><Move v={fc.d1w} goodWhenNegative /></span>
              <span><span className={s.muted}>Month </span><Move v={fc.d1m} goodWhenNegative /></span>
              <span><span className={s.muted}>Unusual </span>{signed(fc.z, 2)}σ</span>
              <div className="flex-1" />
              <Legend metric={metric} lo={metric === "oas" ? minLvl : -maxAbs} hi={metric === "oas" ? maxLvl : maxAbs} />
            </div>
          </Card>

          {/* Selected bucket */}
          <div className="flex flex-col gap-4">
            <Card
              title={`${SECTORS[sel.s]} · ${TENORS[sel.t]}`}
              hint="The bucket you picked"
              actions={<Badge tone={Math.abs(z) >= 2 ? "bad" : Math.abs(z) >= 1 ? "warn" : "neutral"}>{zVerdict}</Badge>}
            >
              <div className="grid grid-cols-3 gap-3">
                <Stat label={<><Term k="OAS">Spread</Term></>} value={`${sc.oas.toFixed(0)}`} sub="basis points" />
                <Stat label="Today" value={<Move v={sc.d1} goodWhenNegative />} sub={sc.d1 > 0 ? "wider" : "tighter"} />
                <Stat label={<Term k="z">How unusual</Term>} value={`${signed(sc.z, 2)}σ`} valueClass={Math.abs(sc.z) >= 2 ? s.down : s.value} sub="vs last 3 months" />
              </div>
              <p className="mt-4 text-[11px] text-stone-500">Spread over the last 3 months · {Math.min(...sc.hist).toFixed(0)}–{Math.max(...sc.hist).toFixed(0)} bp</p>
              <Spark data={sc.hist} label={`Spread over 3 months, from ${sc.hist[0].toFixed(0)} to ${sc.oas.toFixed(0)} bp`} />
              <div className="mt-2">
                <Row k="Bonds in this bucket" v={sc.issues} />
                <Row k={<Term k="TRACE">Traded today</Term>} v={`$${sc.vol}MM`} />
                <Row k="Range, 3 months" v={`${Math.min(...sc.hist).toFixed(0)} – ${Math.max(...sc.hist).toFixed(0)} bp`} />
                <Row k="Wider than" v={`${percentile}% of days`} />
              </div>
              <p className="mt-3 bg-stone-50 px-3 py-2 text-[13px] leading-relaxed text-stone-600">
                {Math.abs(z) >= 2
                  ? `${SECTORS[sel.s]} ${TENORS[sel.t]} has moved ${Math.abs(z).toFixed(1)}σ in a week — outside its normal range. Check the news before you fade it.`
                  : Math.abs(z) >= 1
                    ? "A notable move, but still within its normal range. Compare it with peers at the same maturity."
                    : "Trading in line with its recent range. Nothing unusual here."}
              </p>
            </Card>

            <Card title={`${SECTORS[sel.s]} bonds you can trade`} hint="Highlighted bonds sit in your bucket" bodyClassName="px-2 pb-2">
              {sectorBonds.length === 0 ? (
                <p className="px-2 py-4 text-[13px] text-stone-500">No bonds from this sector in your universe. Pick another row.</p>
              ) : (
                <ul className={`divide-y ${s.divide}`}>
                  {sectorBonds.map(({ b, spread, d1, inBucket }) => (
                    <li key={b.id} className={`flex items-center gap-3 px-2 py-2.5 ${inBucket ? "bg-indigo-50/60" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[13px] font-medium text-stone-900">
                          {shortName(b)} {inBucket && <Badge tone="indigo">In bucket</Badge>}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-stone-500 tabular-nums">
                          <span>{b.rating} · {TENORS[tenorIndex(b)]}</span>
                          <span>{spread.toFixed(0)} bp</span>
                          <Move v={d1} goodWhenNegative />
                          <span>px {b.mid.toFixed(3)}</span>
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openWith(studioSlug("RFQ"), { bondId: b.id, side: "Buy" })} className={`px-2.5 py-1 text-[12px] font-semibold ${s.buyBg} ${s.focus}`} aria-label={`Get quotes to buy ${shortName(b)}`}>Buy</button>
                        <button type="button" onClick={() => openWith(studioSlug("RFQ"), { bondId: b.id, side: "Sell" })} className={`px-2.5 py-1 text-[12px] font-semibold ${s.sellBg} ${s.focus}`} aria-label={`Get quotes to sell ${shortName(b)}`}>Sell</button>
                        <button type="button" onClick={() => openWith(studioSlug("TKT"), { bondId: b.id })} className={`px-2.5 py-1 text-[12px] ${s.secondary} ${s.focus}`} aria-label={`Open order ticket for ${shortName(b)}`}>Order</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-4">
          <MoverCard title="Widened most today" icon={<TrendingUp className="h-4 w-4" />} rows={movers.wider} onPick={setSel} />
          <MoverCard title="Tightened most today" icon={<TrendingDown className="h-4 w-4" />} rows={movers.tighter} onPick={setSel} />
          <Card title="Market mood" hint="The wider credit market today" bodyClassName="grid grid-cols-3 gap-x-4 gap-y-4 p-4">
            {MARKET_TONE.map((m) => (
              <Stat key={m.label} label={m.label} value={m.value} sub={m.sub} valueClass={m.tone === "bad" ? s.down : s.value} />
            ))}
          </Card>
        </div>
        <p className="flex items-center gap-1.5 text-[12px] text-stone-400">
          Spreads are <Term k="gSpread">G-spreads</Term> over on-the-run Treasuries, in <Term k="bp">bp</Term>. <InfoTip k="IG" />
        </p>
      </div>
    </StudioShell>
  );
}

function MoverCard({ title, icon, rows, onPick }: { title: string; icon: ReactNode; rows: Mover[]; onPick: (p: Pos) => void }) {
  return (
    <Card title={title} icon={icon} hint="Click one to open it on the map" bodyClassName="px-2 pb-2">
      <ul>
        {rows.map((r, i) => (
          <li key={`${r.si}-${r.ti}`}>
            <button type="button" onClick={() => onPick({ s: r.si, t: r.ti })} className={`flex w-full items-center gap-3 px-2 py-2 text-left text-[13px] tabular-nums ${s.hover} ${s.focus}`}>
              <span className="w-4 text-stone-400">{i + 1}</span>
              <span className="flex-1 truncate text-stone-800">{SECTORS[r.si]} <span className="text-stone-400">{TENORS[r.ti]}</span></span>
              <span className="w-12 text-right text-stone-500">{r.oas.toFixed(0)} bp</span>
              <span className="w-16 text-right"><Move v={r.d1} goodWhenNegative /></span>
              <span className={`w-12 text-right text-[12px] ${Math.abs(r.z) >= 2 ? "font-semibold text-rose-600" : "text-stone-400"}`}>{signed(r.z, 1)}σ</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Legend({ metric, lo, hi }: { metric: Metric; lo: number; hi: number }) {
  const steps = Array.from({ length: 11 }, (_, i) => i / 10);
  const fill = (x: number) => (metric === "oas" ? levelHeat(x) : divergingHeat(x * 2 - 1));
  return (
    <div className="flex items-center gap-2 text-[11px] text-stone-500">
      <span>{metric === "oas" ? `${lo.toFixed(0)} bp` : metric === "z" ? "−2.5σ tighter" : `${signed(lo)} tighter`}</span>
      <div className="flex" aria-hidden>
        {steps.map((x) => (
          <span key={x} className="h-3 w-3" style={{ backgroundColor: fill(x) }} />
        ))}
      </div>
      <span>{metric === "oas" ? `${hi.toFixed(0)} bp` : metric === "z" ? "+2.5σ wider" : `${signed(hi)} wider`}</span>
    </div>
  );
}
