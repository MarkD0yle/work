import { useMemo } from "react";
import type { SchemeView, StressRow } from "./model";
import {
  FOCUS,
  INK,
  STATUS,
  TIER_COLOR,
  TIER_LABEL,
  bp,
  bpSigned,
  gbpM,
  monthShort,
  monthYear,
  num,
  pct,
} from "./format";
import { CardHeader, Chip, LegendItem, MicroLabel, StressChip, Swatch } from "./ui";

/* 03 · Collateral headroom stress: a bespoke table of gilt-yield shocks
 * with the collateral waterfall drawn in the cell, a deleveraging-trigger
 * callout and the history of instant resilience since 2020. Selecting a
 * row scopes section 01 to the position after that shock. */

const TH = "px-3 py-2 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";
const TIERS = ["cash", "gilts", "credit"] as const;

export function StressPanel({
  view,
  selected,
  onSelect,
}: {
  view: SchemeView;
  selected: number | null;
  onSelect: (bp: number | null) => void;
}) {
  const { stress, hedge, stressMode } = view;
  const instant = stressMode === "instant";
  const total = stress.tiers.cash + stress.tiers.gilts + stress.tiers.credit;
  // One scale for every bar in the column: the full waterfall or the largest call, whichever is bigger.
  const scale = Math.max(total, ...stress.rows.map((r) => r.call)) * 1.04;
  const w = (v: number) => `${(v / scale) * 100}%`;

  const vsPolicy = stress.instantBp - stress.policyMinBp;
  const policyTone = vsPolicy >= 50 ? "good" : vsPolicy >= 0 ? "warn" : "bad";

  return (
    <section aria-labelledby="pf-stress-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="pf-stress-title"
        title="Collateral headroom under gilt-yield shocks"
        sub={
          instant
            ? "Instant: the call must be met from cash and gilts the same day; eligible credit does not count until it settles"
            : "Over 5 days: eligible investment-grade credit can be sold and settled (T+3), so it joins the waterfall after cash and gilts"
        }
        right={
          <span className="text-[11px] text-neutral-500">
            Hedge PV01 <span className="font-mono font-semibold text-neutral-800 tabular-nums">£{num(hedge.hedgePv01, 2)}m/bp</span>
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5 lg:px-5">
        {TIERS.map((t) => (
          <LegendItem key={t} color={TIER_COLOR[t]}>
            {TIER_LABEL[t]}
            {t === "credit" && instant && <span className="text-neutral-400"> (not counted)</span>}
          </LegendItem>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
          <span aria-hidden className="inline-block h-3 w-0.5 bg-neutral-900" />
          Collateral call
        </span>
        <span className="ml-auto text-[11px] text-neutral-400">Select a row to see the position after the shock in section 01</span>
      </div>

      <div className="overflow-x-auto px-1 pt-2">
        <table className="w-full min-w-[760px] text-left">
          <caption className="sr-only">
            Collateral call, available collateral by tier, headroom, days to cure and status for each yield shock
          </caption>
          <thead className="border-b border-neutral-200">
            <tr>
              <th scope="col" className={TH}>Yield rise</th>
              <th scope="col" className={`${TH} text-right`}>Collateral call</th>
              <th scope="col" className={`${TH} w-[34%]`}>Available collateral by tier</th>
              <th scope="col" className={`${TH} text-right`}>Headroom after call</th>
              <th scope="col" className={`${TH} text-right`}>Days to cure</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {stress.rows.map((r) => (
              <StressLine
                key={r.bp}
                row={r}
                instant={instant}
                on={selected === r.bp}
                onToggle={() => onSelect(selected === r.bp ? null : r.bp)}
                w={w}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 pt-4 pb-4 lg:grid-cols-2 lg:px-5">
        <TriggerCallout view={view} tone={policyTone} vsPolicy={vsPolicy} />
        <ResilienceHistory view={view} />
      </div>
    </section>
  );
}

function StressLine({
  row,
  instant,
  on,
  onToggle,
  w,
}: {
  row: StressRow;
  instant: boolean;
  on: boolean;
  onToggle: () => void;
  w: (v: number) => string;
}) {
  const mono = `px-3 py-2.5 text-right font-mono text-[11px] tabular-nums whitespace-nowrap ${on ? "text-white" : "text-neutral-800"}`;
  const drawn = new Set(row.drawn);
  return (
    <tr
      onClick={onToggle}
      aria-selected={on}
      className={`cursor-pointer transition ${on ? "bg-neutral-900" : "hover:bg-neutral-50"}`}
    >
      <th scope="row" className="px-3 py-2.5 text-left">
        <button
          type="button"
          aria-pressed={on}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`font-mono text-[12px] font-semibold tabular-nums ${FOCUS} ${on ? "text-white" : "text-neutral-900"}`}
        >
          {bpSigned(row.bp)}
        </button>
      </th>
      <td className={mono}>{gbpM(row.call)}</td>
      <td className="px-3 py-2.5">
        <div className="relative h-4 w-full">
          <div className={`absolute inset-y-0.5 left-0 flex w-full gap-[2px] ${on ? "bg-neutral-800" : "bg-neutral-100"}`}>
            {TIERS.map((t) => {
              const counted = t !== "credit" || !instant;
              return (
                <span
                  key={t}
                  title={`${TIER_LABEL[t]} ${gbpM(row.tiers[t])}${counted ? "" : " · not counted in an instant call"}${drawn.has(t) ? " · drawn" : ""}`}
                  className="h-full shrink-0"
                  style={{ width: w(row.tiers[t]), background: TIER_COLOR[t], opacity: counted ? 1 : 0.3 }}
                />
              );
            })}
          </div>
          {/* the call, as a marker over the waterfall */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5"
            style={{ left: w(row.call), background: on ? "#ffffff" : INK }}
          />
        </div>
        <div className={`mt-1 flex justify-between font-mono text-[10px] tabular-nums ${on ? "text-neutral-300" : "text-neutral-500"}`}>
          <span>
            {row.drawn.length === 0 ? "No draw" : `Draws ${row.drawn.map((t) => TIER_LABEL[t].toLowerCase()).join(" → ")}`}
          </span>
          <span>{gbpM(row.available)} available</span>
        </div>
      </td>
      <td className={`${mono} font-semibold ${row.headroom < 0 ? (on ? "text-rose-300" : "text-rose-700") : ""}`}>{gbpM(row.headroom)}</td>
      <td className={mono}>{row.daysToCure === null ? "—" : row.daysToCure === 0 ? "Same day" : `T+${row.daysToCure}`}</td>
      <td className="px-3 py-2.5">
        <StressChip status={row.status} />
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Deleveraging trigger callout
 * ------------------------------------------------------------------ */

function TriggerCallout({
  view,
  tone,
  vsPolicy,
}: {
  view: SchemeView;
  tone: "good" | "warn" | "bad";
  vsPolicy: number;
}) {
  const { stress, hedge, stressMode } = view;
  const edge = tone === "good" ? "border-l-emerald-600" : tone === "warn" ? "border-l-amber-600" : "border-l-rose-600";
  return (
    <div className={`border border-neutral-200 border-l-4 bg-neutral-50 px-4 py-3 ${edge}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <MicroLabel>Deleveraging trigger · {stressMode === "instant" ? "instant" : "over 5 days"}</MicroLabel>
        <Chip tone={tone}>{tone === "good" ? "Above policy minimum" : tone === "warn" ? "Close to policy minimum" : "Below policy minimum"}</Chip>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[30px] leading-none font-semibold tracking-tight text-neutral-950">{bpSigned(stress.triggerBp)}</span>
        <span className="text-xs text-neutral-500">rise in gilt yields exhausts the collateral</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
        At that point the LDI manager cuts the interest-rate hedge from{" "}
        <span className="font-mono font-semibold text-neutral-800 tabular-nums">{pct(hedge.rate, 0)}</span> to about{" "}
        <span className="font-mono font-semibold text-neutral-800 tabular-nums">{pct(hedge.afterCut, 0)}</span> of liabilities until collateral is
        restored, and the scheme carries the unhedged liability move from there. Scheme policy requires instant resilience of at least{" "}
        <span className="font-mono font-semibold text-neutral-800 tabular-nums">{bp(stress.policyMinBp)}</span> (the regulator's minimum): it is{" "}
        <span className="font-mono font-semibold text-neutral-800 tabular-nums">{bp(stress.instantBp)}</span> today,{" "}
        <span className={`font-mono font-semibold tabular-nums ${tone === "bad" ? "text-rose-700" : "text-neutral-800"}`}>
          {vsPolicy >= 0 ? `${bp(vsPolicy)} above` : `${bp(-vsPolicy)} below`}
        </span>{" "}
        the minimum.
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-x-3 border-t border-neutral-200 pt-2">
        {(["cash", "gilts", "credit"] as const).map((t) => (
          <div key={t}>
            <dt className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <Swatch color={TIER_COLOR[t]} className="h-2 w-2" />
              {TIER_LABEL[t]}
            </dt>
            <dd className="font-mono text-[12px] font-semibold text-neutral-900 tabular-nums">{gbpM(stress.tiers[t])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Instant resilience since 2020: a bespoke SVG sparkline
 * ------------------------------------------------------------------ */

const SPARK_H = 64;

function ResilienceHistory({ view }: { view: SchemeView }) {
  const series = view.resilienceHistory;
  const policy = view.stress.policyMinBp;

  const { path, area, top, low, policyY, y } = useMemo(() => {
    const n = series.length;
    const topBp = Math.max(policy * 1.2, ...series.map((r) => r.bp)) * 1.05;
    const yFor = (v: number) => SPARK_H - (Math.max(0, v) / topBp) * SPARK_H;
    const pts = series.map((r, i) => `${i + 0.5},${yFor(r.bp).toFixed(2)}`);
    const lowIdx = series.reduce((best, r, i) => (r.low < series[best].low ? i : best), 0);
    return {
      path: `M${pts.join("L")}`,
      area: `M0.5,${SPARK_H}L${pts.join("L")}L${n - 0.5},${SPARK_H}Z`,
      top: topBp,
      low: { i: lowIdx, r: series[lowIdx] },
      policyY: yFor(policy),
      y: yFor,
    };
  }, [series, policy]);

  const n = series.length;
  const last = series[n - 1];
  const lowX = ((low.i + 0.5) / n) * 100;

  return (
    <figure className="border border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <MicroLabel>Instant resilience since 2020</MicroLabel>
        <span className="text-[11px] text-neutral-500">
          Month-end · low point{" "}
          <span className="font-mono font-semibold text-rose-700 tabular-nums">{bp(low.r.low)}</span> in {monthYear(low.r.t)}
        </span>
      </div>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${n} ${SPARK_H}`}
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height: SPARK_H }}
          role="img"
          aria-label={`Instant collateral resilience each month since January 2020: ${bp(series[0].bp)} at the start, a low of ${bp(low.r.low)} in ${monthYear(low.r.t)}, ${bp(last.bp)} at ${monthYear(last.t)}, against a ${bp(policy)} policy minimum.`}
        >
          <path d={area} fill={INK} opacity={0.06} />
          <line x1={0} x2={n} y1={policyY} y2={policyY} stroke={STATUS.warn} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={path} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <line
            x1={low.i + 0.5}
            x2={low.i + 0.5}
            y1={y(low.r.bp)}
            y2={y(low.r.low)}
            stroke={STATUS.bad}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* markers in HTML so they keep their shape whatever the aspect ratio */}
        <span
          aria-hidden
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border-2 border-white"
          style={{ left: `${lowX}%`, top: y(low.r.low), background: STATUS.bad }}
        />
        <span
          aria-hidden
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-neutral-900"
          style={{ left: `${((n - 0.5) / n) * 100}%`, top: y(last.bp) }}
        />
        <span
          aria-hidden
          className="absolute left-0 bg-white/80 px-0.5 font-mono text-[9px] text-amber-700 tabular-nums"
          style={{ top: policyY + 2 }}
        >
          policy {bp(policy)}
        </span>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-neutral-400 tabular-nums">
        <span>{monthShort(series[0].t)}</span>
        <span>0 – {bp(top)}</span>
        <span>{monthShort(last.t)}</span>
      </div>
      <figcaption className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">
        The red drop marks the worst point within the month: the collateral position after the hedge loss and before the top-ups from
        credit and growth sales and the hedge cut. Today's <span className="font-mono font-semibold text-neutral-800 tabular-nums">{bp(last.bp)}</span> is
        measured on the same instant basis.
      </figcaption>
    </figure>
  );
}
