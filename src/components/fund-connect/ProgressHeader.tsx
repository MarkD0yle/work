import type { RecordSummary } from "../../lib/fundConnect/engine";

/* Always-visible progress summary. Spec §3 — sections complete and error
 * count, so the state of a long form is never something you have to scroll
 * to reconstruct. */

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "error" | "warn" | "ok";
}) {
  const text =
    tone === "error"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-800"
        : tone === "ok"
          ? "text-neutral-900"
          : "text-neutral-900";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${text}`}>{value}</span>
    </div>
  );
}

export default function ProgressHeader({ summary }: { summary: RecordSummary }) {
  const pct = Math.round((summary.sectionsComplete / summary.sectionsTotal) * 100);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="min-w-40">
        <Stat
          label="Sections complete"
          value={`${summary.sectionsComplete} of ${summary.sectionsTotal}`}
        />
        <div className="mt-1.5 h-1 w-40 bg-neutral-200">
          <div className="h-1 bg-neutral-900" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Stat
        label="Required outstanding"
        value={String(summary.missing)}
        tone={summary.missing > 0 ? "warn" : "ok"}
      />
      <Stat
        label="Errors"
        value={String(summary.errors)}
        tone={summary.errors > 0 ? "error" : "ok"}
      />
      <Stat
        label="Flagged by reviewer"
        value={String(summary.flags)}
        tone={summary.flags > 0 ? "warn" : "ok"}
      />
      <Stat label="Imported fields" value={String(summary.imported)} />
      <Stat
        label="Modified after import"
        value={String(summary.modified)}
        tone={summary.modified > 0 ? "warn" : "ok"}
      />
    </div>
  );
}
