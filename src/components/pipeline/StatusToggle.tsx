import type { PipelineStatusFilter } from "../../lib/pipeline-filters";

/* Spec §2.3 — segmented Status toggle (New / Pending).
 *
 * Mutually exclusive. Clicking the active one deselects (returns to
 * "neither" = both shown). Avoids a tri-state "All" pill. */

export default function StatusToggle({
  value,
  onChange,
}: {
  value: PipelineStatusFilter;
  onChange: (next: PipelineStatusFilter) => void;
}) {
  function select(next: "new" | "pending") {
    onChange(value === next ? null : next);
  }
  return (
    <div
      role="radiogroup"
      aria-label="Status"
      className="inline-flex items-center gap-px overflow-hidden rounded-md border border-neutral-300 bg-white text-xs"
    >
      <SegmentButton
        active={value === "new"}
        onClick={() => select("new")}
        ariaLabel="Show new pipelines only"
      >
        New
      </SegmentButton>
      <span aria-hidden className="h-4 w-px bg-neutral-200" />
      <SegmentButton
        active={value === "pending"}
        onClick={() => select("pending")}
        ariaLabel="Show pending pipelines only"
      >
        Pending
      </SegmentButton>
    </div>
  );
}

function SegmentButton({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`px-2.5 py-1 transition ${
        active
          ? "bg-neutral-900 font-medium text-white"
          : "text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}
