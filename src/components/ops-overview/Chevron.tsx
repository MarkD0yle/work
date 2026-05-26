import type { PipelineStage } from "../../lib/qlik";

/* Pipeline-stage chevron. Color is the EXCEPTION — complete is calm grey,
 * not green. Eye gets pulled only to amber / red. */

const TONE: Record<
  PipelineStage["status"],
  { bg: string; border: string; text: string; glyph: string }
> = {
  complete: {
    bg: "bg-neutral-100",
    border: "border-neutral-300",
    text: "text-neutral-500",
    glyph: "✓",
  },
  in_progress: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    glyph: "◐",
  },
  past_typical: {
    bg: "bg-yellow-100",
    border: "border-yellow-400",
    text: "text-yellow-900",
    glyph: "·",
  },
  past_required: {
    bg: "bg-amber-100",
    border: "border-amber-400",
    text: "text-amber-900",
    glyph: "!",
  },
  past_benchmark: {
    bg: "bg-red-100",
    border: "border-red-500",
    text: "text-red-800",
    glyph: "!",
  },
  failed: {
    bg: "bg-red-200",
    border: "border-red-700",
    text: "text-red-900",
    glyph: "✕",
  },
  pending: {
    bg: "bg-white",
    border: "border-neutral-200",
    text: "text-neutral-400",
    glyph: "·",
  },
  not_started: {
    bg: "bg-white",
    border: "border-neutral-200",
    text: "text-neutral-400",
    glyph: "·",
  },
  holiday: {
    bg: "bg-neutral-50",
    border: "border-neutral-100",
    text: "text-neutral-300",
    glyph: "—",
  },
};

export default function Chevron({
  stage,
  density,
  isLast,
}: {
  stage: PipelineStage;
  density: "compact" | "comfortable";
  isLast: boolean;
}) {
  const t = TONE[stage.status];
  const isActive =
    stage.status === "in_progress" ||
    stage.status === "past_typical" ||
    stage.status === "past_required" ||
    stage.status === "past_benchmark" ||
    stage.status === "failed";
  const height = density === "compact" ? 26 : 32;
  const minWidth = density === "compact" ? 100 : 130;
  return (
    <span
      title={`${stage.name} — ${stage.status}${stage.detail ? ` · ${stage.detail}` : ""}`}
      className={`relative inline-flex items-center gap-1.5 border ${t.bg} ${t.border} ${t.text} font-medium ${
        density === "compact" ? "text-[11px]" : "text-xs"
      } ${isActive ? "shadow-sm" : ""}`}
      style={{
        height,
        minWidth,
        paddingLeft: 14,
        paddingRight: isLast ? 12 : 18,
        clipPath: isLast
          ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 8px 50%)"
          : "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)",
      }}
    >
      <span className="font-semibold">{stage.name}</span>
      <span
        className={`ml-auto inline-flex items-center gap-1 font-mono text-[10px] ${
          stage.status === "complete" ? "opacity-70" : ""
        }`}
      >
        <span aria-hidden>{t.glyph}</span>
        {stage.detail && <span className="whitespace-nowrap">{stage.detail}</span>}
      </span>
    </span>
  );
}
