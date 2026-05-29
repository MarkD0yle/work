import { FILTER_LABEL, type PipelineFilters } from "../../lib/pipeline-filters";

/* Spec §3.5 — empty result state with suggested filter removal.
 *
 * "No pipelines match — try removing [Status: New] or [Clear all]." */

export default function PipelineEmptyState({
  filters,
  suggestedRemoval,
  onRemoveFilter,
  onClearAll,
}: {
  filters: PipelineFilters;
  suggestedRemoval: keyof PipelineFilters | null;
  onRemoveFilter: (key: keyof PipelineFilters) => void;
  onClearAll: () => void;
}) {
  // Friendly description of the suggested filter's current value.
  let suggestedLabel: string | null = null;
  if (suggestedRemoval) {
    const v = filters[suggestedRemoval];
    if (Array.isArray(v) && v.length > 0) {
      suggestedLabel = `${FILTER_LABEL[suggestedRemoval]}: ${v.join(", ")}`;
    } else if (typeof v === "boolean" && v) {
      suggestedLabel = FILTER_LABEL[suggestedRemoval];
    } else if (v === "new" || v === "pending") {
      suggestedLabel = `${FILTER_LABEL[suggestedRemoval]}: ${v === "new" ? "New" : "Pending"}`;
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-5 py-6 text-sm">
      <p className="text-neutral-700">No pipelines match these filters.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {suggestedRemoval && suggestedLabel && (
          <button
            type="button"
            onClick={() => onRemoveFilter(suggestedRemoval)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Try removing: {suggestedLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClearAll}
          className="text-blue-700 hover:underline"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
}
