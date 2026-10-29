import type { ReactNode } from "react";
import type { SchemeView, StressRow } from "./model";
import { INK, MUTED_SERIES, STATUS, bpSigned, dateMid, gbpM, gbpMSigned, monthYear, pct, pp, toneOf, type Tone } from "./format";
import { Chip, Delta, GhostButton, MicroLabel } from "./ui";

/* 01 · Funding position: the wide stat band and the journey bar. When a
 * stress scenario is selected in section 03, each stat gains a second line
 * with its value after the shock and the bar gains a hollow marker. */

interface Stat {
  label: string;
  value: string;
  delta: string;
  tone: Tone;
  sub: string;
  after?: string;
}

export function FundingPosition({
  view,
  shock,
  onClearShock,
}: {
  view: SchemeView;
  shock: StressRow | null;
  onClearShock: () => void;
}) {
  const { stats, prior, current, basis, journey } = view;
  const vs = dateMid(prior.t);

  const items: Stat[] = [
    {
      label: "Assets",
      value: gbpM(stats.assets.value),
      delta: gbpMSigned(stats.assets.delta),
      tone: toneOf(stats.assets.delta, true, 0.5),
      sub: `Investable ${gbpM(view.investable)} plus the buy-in policy ${gbpM(view.buyin)}`,
      after: shock ? gbpM(shock.assetsAfter) : undefined,
    },
    {
      label: `Liabilities · ${basis.short}`,
      value: gbpM(stats.liabilities.value),
      delta: gbpMSigned(stats.liabilities.delta),
      tone: toneOf(stats.liabilities.delta, false, 0.5),
      sub: `${basis.label}, discounted at ${basis.discount}`,
      after: shock ? gbpM(shock.liabAfter) : undefined,
    },
    {
      label: "Funding level",
      value: pct(stats.fl.value),
      delta: pp(stats.fl.delta),
      tone: toneOf(stats.fl.delta, true, 0.05),
      sub: `Journey plan ${pct(current.plan)} · ${pp(view.vsPlan)} ${view.vsPlan >= 0 ? "ahead" : "behind"}`,
      after: shock ? pct(shock.flAfter) : undefined,
    },
    {
      label: stats.surplus.value >= 0 ? "Surplus" : "Deficit",
      value: gbpM(stats.surplus.value),
      delta: gbpMSigned(stats.surplus.delta),
      tone: toneOf(stats.surplus.delta, true, 0.5),
      sub: stats.surplus.value >= 0 ? "Assets over liabilities on this basis" : "Shortfall against liabilities on this basis",
      after: shock ? gbpM(shock.assetsAfter - shock.liabAfter) : undefined,
    },
  ];

  return (
    <section aria-labelledby="pf-position-title" className="border border-neutral-200 bg-white">
      <h3 id="pf-position-title" className="sr-only">
        Funding position at {dateMid(current.t)}
      </h3>
      <dl className="grid grid-cols-1 gap-px bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="bg-white px-5 pt-4 pb-4">
            <dt>
              <MicroLabel>{s.label}</MicroLabel>
            </dt>
            <dd className="mt-2 text-[30px] leading-none font-semibold tracking-tight text-neutral-950">{s.value}</dd>
            <dd className="mt-2">
              <Delta text={s.delta} tone={s.tone} vs={`${vs} (prior quarter-end)`} />
            </dd>
            <dd className="mt-1.5 text-[11px] leading-snug text-neutral-500">{s.sub}</dd>
            {s.after && shock && (
              <dd className="mt-2 flex items-center gap-2 border-t border-dashed border-neutral-200 pt-2 text-[11px]">
                <Chip tone="neutral" size="sm">
                  After {bpSigned(shock.bp)}
                </Chip>
                <span className="font-mono font-semibold text-neutral-900 tabular-nums">{s.after}</span>
              </dd>
            )}
          </div>
        ))}
      </dl>

      <div className="border-t border-neutral-200 px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <MicroLabel>Journey bar · {basis.label} basis</MicroLabel>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              From {pct(journey.start)} in Jan 2020 to the buyout target of {pct(journey.buyoutTarget, 0)} by Dec 2031, by way of low dependency ({pct(journey.ldTarget, 0)}) in Dec 2029.
            </p>
          </div>
          {shock && (
            <GhostButton onClick={onClearShock}>Clear {bpSigned(shock.bp)} scenario</GhostButton>
          )}
        </div>
        <JourneyBar view={view} shock={shock} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Journey bar: a horizontal scale from the 2020 funding level to buyout
 * ------------------------------------------------------------------ */

const TRACK_TOP = 46;

function JourneyBar({ view, shock }: { view: SchemeView; shock: StressRow | null }) {
  const { journey, current, basis } = view;
  const min = Math.floor((Math.min(journey.start, journey.today, shock?.flAfter ?? journey.start) - 4) / 5) * 5;
  const max = journey.max;
  const x = (v: number) => `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += 5) ticks.push(v);

  const label =
    `Journey bar on the ${basis.label} basis: started at ${pct(journey.start)} in January 2020, now ${pct(journey.today)} at ${dateMid(current.t)} against a plan of ${pct(journey.planToday)}; ` +
    `low-dependency target ${pct(journey.ldTarget, 0)} by December 2029 and buyout target ${pct(journey.buyoutTarget, 0)} by December 2031` +
    (shock ? `; after a ${bpSigned(shock.bp)} yield shock the funding level would be ${pct(shock.flAfter)}.` : ".");

  return (
    <figure role="img" aria-label={label} className="relative mt-3 h-[118px] select-none">
      {/* targets above the track */}
      <Pin at={x(100)} top={8} align="center" color="#a3a3a3" stem={TRACK_TOP - 18} muted>
        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">100%</span>
      </Pin>
      <Pin at={x(journey.ldTarget)} top={0} align="center" color={INK} stem={TRACK_TOP - 12}>
        <span className="text-[11px] font-semibold text-neutral-900">Low dependency</span>
        <span className="text-[10px] text-neutral-500">Dec 2029 · {pct(journey.ldTarget, 0)}</span>
      </Pin>
      <Pin at={x(journey.buyoutTarget)} top={0} align="right" color={INK} stem={TRACK_TOP - 12}>
        <span className="text-[11px] font-semibold text-neutral-900">Buyout</span>
        <span className="text-[10px] text-neutral-500">Dec 2031 · {pct(journey.buyoutTarget, 0)}</span>
      </Pin>

      {/* track, progress and the scale ticks */}
      <div className="absolute inset-x-0 h-3 bg-neutral-100" style={{ top: TRACK_TOP }} />
      <div
        className="absolute h-3 bg-neutral-900"
        style={{ top: TRACK_TOP, left: x(journey.start), width: `calc(${x(journey.today)} - ${x(journey.start)})` }}
      />
      {ticks.map((v) => (
        <span
          key={v}
          aria-hidden
          className="absolute w-px bg-neutral-300"
          style={{ top: TRACK_TOP + 12, height: 4, left: x(v) }}
        />
      ))}

      {/* plan marker on the track: hollow, muted */}
      <span
        aria-hidden
        className="absolute h-3 w-[7px] -translate-x-1/2 border-2 bg-white"
        style={{ top: TRACK_TOP, left: x(journey.planToday), borderColor: MUTED_SERIES }}
      />
      {/* the stressed level, when a scenario is selected */}
      {shock && (
        <span
          aria-hidden
          className="absolute h-5 w-[7px] -translate-x-1/2 border-2 bg-white"
          style={{ top: TRACK_TOP - 4, left: x(shock.flAfter), borderColor: STATUS.bad }}
        />
      )}

      {/* today and the start, below the track */}
      <Pin at={x(journey.start)} top={TRACK_TOP + 20} align="left" color="#a3a3a3" stem={0} muted>
        <span className="text-[10px] text-neutral-500">Jan 2020 · {pct(journey.start)}</span>
      </Pin>
      <Pin at={x(journey.today)} top={TRACK_TOP + 20} align={journey.today > max - 8 ? "right" : "center"} color={INK} stem={0}>
        <span className="text-[12px] font-semibold text-neutral-950">{pct(journey.today)} today</span>
        <span className="text-[10px] text-neutral-500">
          {monthYear(current.t)} · plan {pct(journey.planToday)} · {pp(view.vsPlan)}
        </span>
      </Pin>
      {shock && (
        <Pin at={x(shock.flAfter)} top={TRACK_TOP + 50} align={shock.flAfter > max - 8 ? "right" : "center"} color={STATUS.bad} stem={0}>
          <span className="text-[10px] font-semibold text-rose-700">
            {pct(shock.flAfter)} after {bpSigned(shock.bp)}
          </span>
        </Pin>
      )}
    </figure>
  );
}

/** A labelled pin at a horizontal position: a stem to the track and a small text stack. */
function Pin({
  at,
  top,
  align,
  color,
  stem,
  muted,
  children,
}: {
  at: string;
  top: number;
  align: "left" | "center" | "right";
  color: string;
  stem: number;
  muted?: boolean;
  children: ReactNode;
}) {
  const shift = align === "center" ? "-translate-x-1/2" : align === "right" ? "-translate-x-full" : "";
  const text = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`absolute flex flex-col ${text} ${shift} whitespace-nowrap`} style={{ left: at, top }}>
      {stem > 0 && (
        <span
          aria-hidden
          className={`absolute w-px ${align === "center" ? "left-1/2" : align === "right" ? "right-0" : "left-0"}`}
          style={{ top: "100%", height: stem, background: color, opacity: muted ? 0.5 : 1 }}
        />
      )}
      {children}
    </div>
  );
}
