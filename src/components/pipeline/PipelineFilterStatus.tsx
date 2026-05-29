import type { PipelineFilters } from "../../lib/pipeline-filters";
import { hasAnyFilter } from "../../lib/pipeline-filters";

/* Spec §3.4 — status line.
 *
 * Plain English, left-to-right. Active filters listed; Clear link at the
 * end. When no filters active: "Showing all N pipelines". */

export default function PipelineFilterStatus({
  scopedCount,
  totalCount,
  filters,
  onClear,
}: {
  scopedCount: number;
  totalCount: number;
  filters: PipelineFilters;
  onClear: () => void;
}) {
  const anyActive = hasAnyFilter(filters);

  if (!anyActive) {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        Showing all {totalCount} pipelines
      </p>
    );
  }

  const parts: string[] = [`Scoping ${scopedCount} of ${totalCount}`];
  if (filters.clients.length > 0) {
    parts.push(
      `${filters.clients.length} client${filters.clients.length === 1 ? "" : "s"}`,
    );
  }
  if (filters.mandates.length > 0) {
    parts.push(
      `${filters.mandates.length} mandate${filters.mandates.length === 1 ? "" : "s"}`,
    );
  }
  if (filters.bmTypes.length > 0) {
    parts.push(`BM Type: ${filters.bmTypes.join(", ")}`);
  }
  if (filters.usernames.length > 0) {
    parts.push(`User: ${filters.usernames.join(", ")}`);
  }
  if (filters.processes.length > 0) {
    parts.push(
      `Process: ${filters.processes.length === 1 ? filters.processes[0] : `${filters.processes.length} processes`}`,
    );
  }
  if (filters.optionA) parts.push("Option A");
  if (filters.optionB) parts.push("Option B");
  if (filters.status) parts.push(`Status: ${filters.status === "new" ? "New" : "Pending"}`);

  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs text-neutral-500">
      <span>{parts.join(" · ")}</span>
      <span aria-hidden className="text-neutral-300">·</span>
      <button
        type="button"
        onClick={onClear}
        className="font-medium text-blue-700 hover:underline"
      >
        Clear
      </button>
    </p>
  );
}
