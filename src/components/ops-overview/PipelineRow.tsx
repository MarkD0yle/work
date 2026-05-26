import {
  PIPELINE_STAGE_ORDER,
  type PipelineRowStatus,
  type PipelineState,
} from "../../lib/qlik";
import Chevron from "./Chevron";
import {
  SEVERITY_TONES,
  ageBand,
  mandateStatusToSeverity,
} from "../../lib/severity-tokens";

/* Per-pipeline row — colour-first design.
 *
 * Reading hierarchy by colour weight:
 *   1. Left severity stripe — primary signal, scannable down the column
 *   2. Chevron strip — per-stage status, scannable left-to-right
 *   3. Right-edge status dot — backup confirmation
 *
 * Words exist for context but the colour stripe alone tells the operator
 * "this row is the red one, this row is the amber one, this row is fine."
 * No reading required to triage.
 */

/* Stripe colour comes from severity tokens (§1.4); thickness comes from
 * age weight (§7.3) — applied only to red/amber rows. Clean is always
 * flat (no age weight). */
function stripeClasses(status: PipelineRowStatus, ageMin: number): string {
  const sev = mandateStatusToSeverity(status);
  if (sev === "holiday" || sev === "clean") {
    return `bg-neutral-200 w-1`;
  }
  const bg = SEVERITY_TONES[sev].surface.bg;
  // Age weight only applies to active severities (spec §11 — green never).
  const weighted = sev === "broken" || sev === "atrisk";
  if (!weighted || ageMin <= 0) return `${bg} w-1`;
  const band = ageBand(ageMin);
  // Map border-l width tokens to stripe width for visual consistency.
  const width =
    band === "critical"
      ? "w-1.5"
      : band === "hot" || band === "warming"
        ? "w-1"
        : "w-0.5";
  return `${bg} ${width}`;
}

// Retained map for hover/dot reference outside the stripe.
const STRIPE: Record<PipelineRowStatus, string> = {
  broken: SEVERITY_TONES.broken.surface.bg,
  at_risk: SEVERITY_TONES.atrisk.surface.bg,
  watch: SEVERITY_TONES.watch.surface.bg,
  working: SEVERITY_TONES.working.surface.bg,
  clean: SEVERITY_TONES.clean.surface.bg,
  holiday: "bg-neutral-200",
};
void STRIPE;

const DOT: Record<PipelineRowStatus, string> = {
  broken: "bg-red-500",
  at_risk: "bg-red-500",
  watch: "bg-amber-500",
  working: "bg-blue-500",
  clean: "bg-neutral-400",
  holiday: "bg-neutral-300",
};

/* Tiny status abbreviation — single character so colour does the work
 * and the letter is a backup for accessibility / printing. */
const STATUS_GLYPH: Record<PipelineRowStatus, string> = {
  broken: "✕",
  at_risk: "!",
  watch: "▲",
  working: "◐",
  clean: "✓",
  holiday: "—",
};

const SUMMARY_TONE: Record<PipelineRowStatus, string> = {
  broken: "text-red-700",
  at_risk: "text-red-700",
  watch: "text-amber-800",
  working: "text-blue-700",
  clean: "text-neutral-500",
  holiday: "text-neutral-400",
};

export default function PipelineRow({
  pipeline,
  density,
  onMonitorClick,
  onPipelineClick,
}: {
  pipeline: PipelineState;
  density: "compact" | "comfortable";
  onMonitorClick?: (monitorId: string) => void;
  onPipelineClick?: (pipelineId: string) => void;
}) {
  // Whole row is the drawer click target; chevrons stop propagation to drill
  // into the underlying monitor instead.
  const rowClickable = !!onPipelineClick;

  return (
    <div
      role={rowClickable ? "button" : undefined}
      tabIndex={rowClickable ? 0 : undefined}
      onClick={() => rowClickable && onPipelineClick?.(pipeline.id)}
      onKeyDown={(e) => {
        if (!rowClickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPipelineClick?.(pipeline.id);
        }
      }}
      aria-label={
        rowClickable
          ? `Open ${pipeline.clientName} ${pipeline.groupName} pipeline detail`
          : undefined
      }
      className={`relative flex items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:bg-neutral-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        rowClickable ? "cursor-pointer" : ""
      }`}
    >
      {/* Left severity stripe — hue from §1.4 token, width from §7.3 age weight */}
      <span
        aria-hidden
        className={`shrink-0 ${stripeClasses(pipeline.worstStatus, pipeline.worstAgeMin)}`}
      />

      <div
        className={`flex flex-1 items-center gap-4 ${
          density === "compact" ? "px-4 py-2.5" : "px-5 py-3.5"
        }`}
      >
        <div className="flex w-[240px] shrink-0 flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-neutral-900">
              {pipeline.clientName}
            </span>
            <span className="text-xs text-neutral-500">{pipeline.groupName}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Tag>{pipeline.cadence}</Tag>
            <Tag>{pipeline.region}</Tag>
            {pipeline.isMine && (
              <span className="text-[9px] font-semibold tracking-wider text-blue-700 uppercase">
                mine
              </span>
            )}
          </div>
          <p
            className={`mt-1 truncate text-[11px] ${SUMMARY_TONE[pipeline.worstStatus]}`}
            title={pipeline.summaryLine}
          >
            {pipeline.summaryLine}
          </p>
        </div>

        <div className="flex flex-1 items-center gap-0">
          {PIPELINE_STAGE_ORDER.map((name, idx) => {
            const stage =
              pipeline.stages.find((s) => s.name === name) ?? {
                name,
                status: "not_started" as const,
                monitorIds: [],
                detail: "—",
              };
            const isLast = idx === PIPELINE_STAGE_ORDER.length - 1;
            const monitorId = stage.monitorIds[0];
            const clickable =
              !!monitorId && stage.status !== "complete" && stage.status !== "pending";
            return (
              <span
                key={name}
                className={`block ${idx > 0 ? "-ml-2" : ""} ${
                  clickable ? "cursor-pointer" : ""
                }`}
                onClick={(e) => {
                  if (clickable && monitorId && onMonitorClick) {
                    // Don't bubble to the row's drawer-open handler.
                    e.stopPropagation();
                    onMonitorClick(monitorId);
                  }
                }}
              >
                <Chevron stage={stage} density={density} isLast={isLast} />
              </span>
            );
          })}
        </div>

        {/* Compact status badge — colour-led, single glyph. */}
        <span
          title={pipeline.worstStatus.replace("_", " ")}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white"
        >
          <span
            aria-hidden
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${DOT[pipeline.worstStatus]}`}
          >
            {pipeline.worstStatus === "clean" || pipeline.worstStatus === "holiday"
              ? ""
              : STATUS_GLYPH[pipeline.worstStatus]}
          </span>
        </span>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600">
      {children}
    </span>
  );
}
