import type { FileEvidence } from "../../lib/file-forensic-data";

/* Spec v0.1.2 L4 §2.4 — footer zone.
 *
 * Left: count summary. Right: show-all toggle + refresh with last-poll
 * timestamp on hover. */

function formatClock(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ForensicFooter({
  rows,
  showAllFields,
  onToggleShowAll,
  onRefresh,
  loading,
  lastPolledAt,
}: {
  rows: FileEvidence[];
  showAllFields: boolean;
  onToggleShowAll: () => void;
  onRefresh: () => void;
  loading: boolean;
  lastPolledAt: string | null;
}) {
  return (
    <footer className="flex h-12 shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-50/80 px-5">
      <span className="text-[11px] text-neutral-500">
        Showing {rows.length} of {rows.length} expected file
        {rows.length === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleShowAll}
          aria-pressed={showAllFields}
          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
            showAllFields
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {showAllFields ? "Show curated fields" : "Show all fields"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title={`Last poll: ${formatClock(lastPolledAt)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          <span aria-hidden>{loading ? "↻" : "⟳"}</span>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </footer>
  );
}
