import type { RecordSummary } from "../../lib/fundConnect2/engine";

/* Record status strip — the FC2 take on the progress header.
 *
 * Each metric is a status chip: a coloured dot for at-a-glance severity, the
 * count in tabular numerals, and the label underneath. A metric at zero (or
 * fully met) drops to a quiet outline with a tick — the strip reads like a
 * row of indicator lights, so "all clear" is visibly different from "needs
 * attention" without reading a single number. Sections complete carries a
 * segmented meter, one segment per section.
 */

function Tick() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Chip({
  label,
  count,
  dot,
  text,
  clear,
  title,
}: {
  label: string;
  count: number;
  /** Dot colour class when the metric is live (count > 0). */
  dot: string;
  /** Count colour class when the metric is live. */
  text: string;
  /** True when this metric being zero means "all clear" rather than "none". */
  clear: boolean;
  title: string;
}) {
  const idle = count === 0;
  return (
    <div
      title={title}
      className={`flex min-w-[92px] flex-col gap-1 border px-3 py-2 ${
        idle ? "border-neutral-200 bg-white" : "border-neutral-300 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {idle && clear ? (
          <span className="text-neutral-300">
            <Tick />
          </span>
        ) : (
          <span
            className={`h-1.5 w-1.5 rounded-full ${idle ? "bg-neutral-200" : `${dot} animate-pulse`}`}
          />
        )}
        <span
          className={`text-base leading-none font-semibold tabular-nums ${
            idle ? "text-neutral-300" : text
          }`}
        >
          {count}
        </span>
      </div>
      <span className="text-[9px] leading-tight font-medium tracking-[0.12em] text-neutral-400 uppercase">
        {label}
      </span>
    </div>
  );
}

export default function StatusStrip({ summary }: { summary: RecordSummary }) {
  const done = summary.sectionsComplete === summary.sectionsTotal;
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {/* Sections meter — one segment per section. */}
      <div
        className={`flex min-w-[132px] flex-col justify-between gap-1 border px-3 py-2 ${
          done ? "border-neutral-200 bg-white" : "border-neutral-300 bg-white shadow-sm"
        }`}
        title="Sections complete"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-base leading-none font-semibold text-neutral-900 tabular-nums">
            {summary.sectionsComplete}
            <span className="text-neutral-400">/{summary.sectionsTotal}</span>
          </span>
          {done && (
            <span className="text-neutral-900">
              <Tick />
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex gap-[3px]">
            {Array.from({ length: summary.sectionsTotal }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-4 ${
                  i < summary.sectionsComplete ? "bg-neutral-900" : "bg-neutral-200"
                }`}
              />
            ))}
          </div>
        </div>
        <span className="text-[9px] leading-tight font-medium tracking-[0.12em] text-neutral-400 uppercase">
          Sections complete
        </span>
      </div>

      <Chip
        label="Outstanding"
        count={summary.missing}
        dot="bg-amber-400"
        text="text-amber-800"
        clear
        title="Required fields still empty at the submit tier"
      />
      <Chip
        label="Errors"
        count={summary.errors}
        dot="bg-red-500"
        text="text-red-700"
        clear
        title="Fields whose current value fails validation"
      />
      <Chip
        label="Flagged"
        count={summary.flags}
        dot="bg-amber-500"
        text="text-amber-800"
        clear
        title="Fields a reviewer rejected and has not yet seen fixed"
      />
      <Chip
        label="Imported"
        count={summary.imported}
        dot="bg-blue-400"
        text="text-blue-800"
        clear={false}
        title="Fields written by the upload — not retyped"
      />
      <Chip
        label="Modified"
        count={summary.modified}
        dot="bg-amber-400"
        text="text-amber-800"
        clear
        title="Imported, then hand-edited — verify against the source"
      />
    </div>
  );
}
