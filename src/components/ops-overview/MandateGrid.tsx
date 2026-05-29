import { useMemo } from "react";
import {
  PIPELINE_STAGE_ORDER,
  type OperationalState,
  type PipelineStage,
  type PipelineStageStatus,
  type PipelineState,
} from "../../lib/qlik";
import { SEVERITY_TONES } from "../../lib/severity-tokens";
import { sortPipelines, type GridSortMode } from "../../lib/grid-sort";
import GridSortControl from "./GridSortControl";
import { scopeFromPipeline, type ForensicScope } from "../../lib/forensic-scope";

/* Mandate × stage grid — the densest at-a-glance surface.
 *
 * Three tiers of zoom on this page, in order of visual density:
 *   1. This grid          — 12 mandates × 4 stages in one viewport
 *   2. Pipeline rows      — per-mandate detail, chevron strip, status pill
 *   3. Monitor list       — flat Qlik monitor list with action menu
 *
 * Calm-default discipline: complete = grey, not green. Only amber/red
 * pulls the eye. Sorted failures-first, then breaches, then in-progress,
 * then clean, then holiday at the bottom. */

/* Spec v0.1.2 §1.6 — three-tier breach ladder driven by SSDS tokens.
 *
 *   complete       → light grey + ✓
 *   in_progress    → blue surface + ◐
 *   past_typical   → cream + · (slow vs typical, no SLA breached)
 *   past_required  → amber + ! (past internal SLA — act now)
 *   past_benchmark → red + !   (past contractual benchmark — escalate)
 *   failed         → dark red + ✕ (validation failure)
 *   pending / not_started → empty cell, no fill, no glyph
 *   holiday        → diagonal hatch, no glyph
 *
 * Hard rule (spec §6, rule 19): the three tiers stay distinct. Cream →
 * amber → red must read as a ladder of severity in a single row.
 */
const STAGE_TONE: Record<
  PipelineStageStatus,
  { bg: string; text: string; glyph: string }
> = {
  complete: {
    bg: SEVERITY_TONES.clean.surface.bg,
    text: SEVERITY_TONES.clean.surface.text,
    glyph: "✓",
  },
  in_progress: {
    bg: SEVERITY_TONES.working.surface.bg,
    text: SEVERITY_TONES.working.surface.text,
    glyph: "◐",
  },
  past_typical: {
    bg: SEVERITY_TONES.typical.surface.bg,
    text: SEVERITY_TONES.typical.surface.text,
    glyph: "·",
  },
  past_required: {
    bg: SEVERITY_TONES.required.surface.bg,
    text: SEVERITY_TONES.required.surface.text,
    glyph: "!",
  },
  past_benchmark: {
    bg: SEVERITY_TONES.benchmark.surface.bg,
    text: SEVERITY_TONES.benchmark.surface.text,
    glyph: "!",
  },
  failed: {
    bg: "bg-red-700",
    text: "text-white",
    glyph: "✕",
  },
  pending: { bg: "bg-white", text: "text-transparent", glyph: "·" },
  not_started: { bg: "bg-white", text: "text-transparent", glyph: "·" },
  holiday: {
    bg: "bg-[repeating-linear-gradient(45deg,_theme(colors.neutral.100)_0,_theme(colors.neutral.100)_4px,_theme(colors.neutral.50)_4px,_theme(colors.neutral.50)_8px)]",
    text: "text-transparent",
    glyph: "",
  },
};

function describeStatus(s: PipelineStageStatus): string {
  switch (s) {
    case "complete":
      return "complete";
    case "in_progress":
      return "in progress";
    case "past_typical":
      return "past typical";
    case "past_required":
      return "past required";
    case "past_benchmark":
      return "past benchmark";
    case "failed":
      return "failed";
    case "holiday":
      return "holiday";
    case "pending":
      return "pending";
    case "not_started":
      return "not started";
  }
}

export default function MandateGrid({
  pipelines,
  l0State,
  sortMode,
  onSortChange,
  onMonitorClick,
  onPipelineClick,
  onOpenForensic,
}: {
  pipelines: PipelineState[];
  l0State: OperationalState;
  sortMode: GridSortMode;
  onSortChange: (m: GridSortMode) => void;
  onMonitorClick?: (monitorId: string) => void;
  onPipelineClick?: (pipelineId: string) => void;
  onOpenForensic?: (scope: ForensicScope) => void;
}) {
  // Spec v0.1.2 §2 — Smart sort by default. Hard rule 22: stable across
  // refreshes (the tiebreaker chain ends in mandate name).
  const sorted = useMemo(
    () => sortPipelines(pipelines, sortMode, l0State),
    [pipelines, sortMode, l0State],
  );

  return (
    <section aria-label="Mandate grid" className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Mandates · stage grid
        </h2>
        <div className="flex items-center gap-4">
          <GridSortControl value={sortMode} onChange={onSortChange} />
          <Legend />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {/* Column headers */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50/70 px-4 py-2">
          <div className="w-[240px] text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
            Mandate
          </div>
          <div className="w-[56px] text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
            Region
          </div>
          <div className="flex flex-1 gap-px">
            {PIPELINE_STAGE_ORDER.map((s) => (
              <div
                key={s}
                className="flex-1 text-[10px] font-medium tracking-wider text-neutral-400 uppercase"
              >
                {s}
              </div>
            ))}
          </div>
          <div className="w-[60px] text-right text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
            Age
          </div>
        </div>

        <ul>
          {sorted.map((p) => {
            const rowClickable = !!onPipelineClick;
            return (
            <li key={p.id} className="border-b border-neutral-100 last:border-b-0">
              <div
                role={rowClickable ? "button" : undefined}
                tabIndex={rowClickable ? 0 : undefined}
                onClick={() => rowClickable && onPipelineClick?.(p.id)}
                onKeyDown={(e) => {
                  if (!rowClickable) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPipelineClick?.(p.id);
                  }
                }}
                aria-label={
                  rowClickable
                    ? `Open ${p.clientName} ${p.groupName} pipeline detail`
                    : undefined
                }
                title={p.arrival?.label}
                className={`flex items-center gap-3 py-1 pr-4 pl-4 transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  rowClickable ? "cursor-pointer" : ""
                }`}
              >
                <div className="flex w-[240px] items-baseline gap-1.5 overflow-hidden">
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {p.clientName}
                  </span>
                  <span className="truncate text-xs text-neutral-500">
                    · {p.groupName}
                  </span>
                  {p.isMine && (
                    <span className="ml-0.5 text-[9px] font-semibold tracking-wider text-blue-700 uppercase">
                      mine
                    </span>
                  )}
                </div>
                <div className="w-[56px] text-[10px] font-medium tracking-wider text-neutral-500 uppercase">
                  {p.region}
                </div>
                <div className="flex flex-1 gap-px">
                  {PIPELINE_STAGE_ORDER.map((name) => {
                    const stage =
                      p.stages.find((s) => s.name === name) ??
                      ({
                        name,
                        status: "not_started" as const,
                        monitorIds: [],
                      } as PipelineStage);
                    return (
                      <StageCell
                        key={name}
                        stage={stage}
                        onClick={
                          stage.monitorIds[0] && onMonitorClick
                            ? () => onMonitorClick(stage.monitorIds[0])
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
                <div className="flex w-[60px] items-center justify-end gap-1.5">
                  <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                    {p.worstAgeMin > 0
                      ? p.worstAgeMin >= 60
                        ? `${Math.floor(p.worstAgeMin / 60)}h ${p.worstAgeMin % 60}m`
                        : `${p.worstAgeMin}m`
                      : p.isHolidayToday
                        ? "—"
                        : "·"}
                  </span>
                </div>
                {onOpenForensic && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenForensic(scopeFromPipeline(p));
                    }}
                    title="Inspect file evidence"
                    aria-label={`Open file forensic for ${p.clientName} ${p.groupName}`}
                    className="ml-1 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                  >
                    Files ›
                  </button>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function StageCell({
  stage,
  onClick,
}: {
  stage: PipelineStage;
  onClick?: () => void;
}) {
  const t = STAGE_TONE[stage.status];
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={(e) => {
        // Cell-level click is a monitor drill — don't bubble up to the row's
        // pipeline-drawer handler.
        e.stopPropagation();
        onClick?.();
      }}
      disabled={!interactive}
      title={`${stage.name} — ${describeStatus(stage.status)}${
        stage.detail ? ` · ${stage.detail}` : ""
      }`}
      className={`flex h-9 flex-1 items-center justify-center ${t.bg} ${t.text} font-mono text-[10px] tabular-nums transition ${
        interactive ? "cursor-pointer hover:brightness-95" : "cursor-default"
      }`}
    >
      <span aria-hidden className="opacity-70">{t.glyph}</span>
    </button>
  );
}

/* Three-tier legend (Qlik convention): typical / required / benchmark
 * for the gradient + complete + in-progress + holiday hatch + failed. */
function Legend() {
  const items: { glyph: string; label: string; cls: string; hatch?: boolean }[] = [
    {
      glyph: "✓",
      label: "complete",
      cls: `${SEVERITY_TONES.clean.surface.bg} ${SEVERITY_TONES.clean.surface.text}`,
    },
    {
      glyph: "◐",
      label: "in progress",
      cls: `${SEVERITY_TONES.working.surface.bg} ${SEVERITY_TONES.working.surface.text}`,
    },
    {
      glyph: "·",
      label: "past typical",
      cls: `${SEVERITY_TONES.typical.surface.bg} ${SEVERITY_TONES.typical.surface.text}`,
    },
    {
      glyph: "!",
      label: "past required",
      cls: `${SEVERITY_TONES.required.surface.bg} ${SEVERITY_TONES.required.surface.text}`,
    },
    {
      glyph: "!",
      label: "past benchmark",
      cls: `${SEVERITY_TONES.benchmark.surface.bg} ${SEVERITY_TONES.benchmark.surface.text}`,
    },
    {
      glyph: "✕",
      label: "failed",
      cls: "bg-red-700 text-white",
    },
    {
      glyph: "",
      label: "holiday",
      cls: "bg-[repeating-linear-gradient(45deg,_theme(colors.neutral.100)_0,_theme(colors.neutral.100)_3px,_theme(colors.neutral.50)_3px,_theme(colors.neutral.50)_6px)] text-neutral-400",
      hatch: true,
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center ${i.cls} font-mono text-[9px]`}
          >
            {!i.hatch && <span className="opacity-70">{i.glyph}</span>}
          </span>
          <span className="text-[10px] text-neutral-500">{i.label}</span>
        </span>
      ))}
    </div>
  );
}
