import type { CSSProperties } from "react";
import type { StageIdx, StageSummary } from "./model";
import { FOCUS, INK, STATUS, dateDay, days, gbpM, int } from "./format";
import { Chip, MicroLabel } from "./ui";

/* The stage board: six connected chevron panels, one per pipeline stage,
 * drawn with CSS clip-path so the corners stay square. Each panel is a
 * toggle button: selecting a stage scopes the case list and the
 * time-in-stage chart to it and highlights its band in the funnel.
 *
 * The chevron border is two clipped layers (a border-coloured back layer
 * and an inset white front layer) because clip-path also clips borders and
 * box-shadows. The focus ring therefore lives on the unclipped button box. */

const ARROW = 18;
const OVERLAP = ARROW - 4; // panels overlap so a 4px gap separates arrow and notch

function chevron(first: boolean, last: boolean): string {
  const right = last
    ? "100% 0, 100% 100%"
    : `calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%`;
  const notch = first ? "" : `, ${ARROW}px 50%`;
  return `polygon(0 0, ${right}, 0 100%${notch})`;
}

/** Fourteen business days of inflow as a column sparkline; today is partial. */
function InflowSpark({ summary }: { summary: StageSummary }) {
  const { inflow, inflowDays } = summary;
  const max = Math.max(1, ...inflow);
  const n = inflow.length;
  const label = `Cases entering ${summary.stage.label} per business day, ${dateDay(inflowDays[0])} to today: ${inflow
    .slice(0, -1)
    .join(", ")}; today so far ${inflow[n - 1]}`;
  return (
    <svg
      viewBox={`0 0 ${n} 24`}
      preserveAspectRatio="none"
      className="block h-6 w-full"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {inflow.map((v, i) => {
        const h = Math.max(0.6, (v / max) * 22);
        const today = i === n - 1;
        return (
          <rect
            key={i}
            x={i + 0.15}
            width={0.7}
            y={24 - h}
            height={h}
            fill={today ? INK : "#cbd5e1"}
          />
        );
      })}
    </svg>
  );
}

/** Median against SLA as a same-ramp meter: track to 1.5× SLA, tick at the SLA. */
function SlaMeter({ median, sla }: { median: number; sla: number }) {
  const span = sla * 1.5;
  const fill = Math.min(1, median / span);
  const over = median > sla;
  return (
    <span className="relative block h-1.5 w-full bg-neutral-100" aria-hidden>
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${fill * 100}%`, background: over ? STATUS.bad : STATUS.neutral }}
      />
      <span className="absolute inset-y-[-2px] w-px bg-neutral-900" style={{ left: `${(sla / span) * 100}%` }} />
    </span>
  );
}

export function StageStrip({
  stages,
  selected,
  onSelect,
}: {
  stages: StageSummary[];
  selected: StageIdx | null;
  onSelect: (s: StageIdx) => void;
}) {
  const n = stages.length;
  return (
    <ol className="flex overflow-x-auto pb-1" aria-label="Pipeline stages">
      {stages.map((s, i) => {
        const on = selected === s.stage.idx;
        const dim = selected !== null && !on;
        const first = i === 0;
        const last = i === n - 1;
        const clipPath = chevron(first, last);
        const border = on ? 2 : 1;
        const overSla = s.median > s.stage.sla;
        const style: CSSProperties = {
          flex: "1 1 0",
          minWidth: 208,
          marginLeft: first ? 0 : -OVERLAP,
          zIndex: n - i,
        };
        return (
          <li key={s.stage.id} className="relative" style={style}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(s.stage.idx)}
              aria-label={`${s.stage.label}: ${int(s.count)} cases, ${gbpM(s.value)}, median ${days(s.median)} in stage against a ${s.stage.sla}-day SLA, ${int(
                s.breaches,
              )} past SLA. ${on ? "Selected; click to clear" : "Click to focus the page on this stage"}`}
              className={`group relative block h-full w-full text-left transition ${FOCUS} ${dim ? "opacity-60 hover:opacity-100" : ""}`}
            >
              <span
                aria-hidden
                className={`absolute inset-0 transition-colors ${on ? "bg-neutral-900" : "bg-neutral-300 group-hover:bg-neutral-500"}`}
                style={{ clipPath }}
              />
              <span aria-hidden className="absolute bg-white" style={{ inset: border, clipPath }} />
              <span
                className="relative flex flex-col gap-2 py-3"
                style={{ paddingLeft: first ? 14 : ARROW + 12, paddingRight: last ? 14 : ARROW + 8 }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{i + 1}</span>
                    <span className="truncate text-[11px] font-semibold tracking-wide text-neutral-800 uppercase">
                      {s.stage.label}
                    </span>
                  </span>
                  <MicroLabel className="shrink-0">SLA {s.stage.sla}d</MicroLabel>
                </span>

                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[26px] leading-none font-semibold tracking-tight text-neutral-950">
                    {int(s.count)}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-600 tabular-nums">{gbpM(s.value)}</span>
                </span>

                <span className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between text-[11px]">
                    <span className="text-neutral-500">Median in stage</span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${overSla ? "text-rose-700" : "text-neutral-800"}`}
                    >
                      {days(s.median)}
                      <span className="font-normal text-neutral-400"> / {s.stage.sla}d</span>
                    </span>
                  </span>
                  <SlaMeter median={s.median} sla={s.stage.sla} />
                </span>

                <span className="flex items-center justify-between gap-2">
                  <Chip tone={s.breaches > 0 ? "bad" : "neutral"} size="sm">
                    {int(s.breaches)} past SLA
                  </Chip>
                  {s.breaches > 0 && (
                    <span className="font-mono text-[10px] text-neutral-500 tabular-nums">{gbpM(s.breachValue)}</span>
                  )}
                </span>

                <span className="flex flex-col gap-0.5">
                  <span className="flex items-baseline justify-between">
                    <MicroLabel>Inflow · 14d</MicroLabel>
                    <span className="font-mono text-[10px] text-neutral-500 tabular-nums">
                      {int(s.inflow.reduce((a, b) => a + b, 0))}
                    </span>
                  </span>
                  <InflowSpark summary={s} />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
