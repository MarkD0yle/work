import { useEffect, useRef, useState } from "react";
import type { RecordSummary } from "../../lib/fundConnect2/engine";

/* Record status strip — the FC2 take on the progress header.
 *
 * Each metric is a status chip: a coloured dot for at-a-glance severity, the
 * count in tabular numerals, and the label underneath. A metric at zero (or
 * fully met) drops to a quiet outline with a tick.
 *
 * A live chip is also navigation. One affected field jumps straight to it;
 * several open a summary popover — the fields listed by section, each entry
 * an anchor to the exact field — the classic form-error-summary pattern, so
 * "where do I go?" is answered by a list, not a hunt.
 */

/** Metrics a chip can jump to — everything except the sections meter. */
export type StripMetric = "missing" | "errors" | "flags" | "imported" | "modified";

export type MetricField = { id: string; label: string; section: string };

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
  metric,
  label,
  count,
  dot,
  text,
  clear,
  title,
  openMetric,
  onOpen,
  items,
  onPick,
}: {
  metric: StripMetric;
  label: string;
  count: number;
  dot: string;
  text: string;
  /** True when this metric being zero means "all clear" rather than "none". */
  clear: boolean;
  title: string;
  openMetric: StripMetric | null;
  onOpen: (metric: StripMetric) => void;
  items: MetricField[];
  onPick: (fieldId: string, metric: StripMetric) => void;
}) {
  const idle = count === 0;
  const open = openMetric === metric;

  // Preserve field order but render grouped by section.
  const groups: { section: string; items: MetricField[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }

  const inner = (
    <>
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
    </>
  );

  if (idle) {
    return (
      <div title={title} className="flex min-w-[92px] flex-col gap-1 border border-neutral-200 bg-white px-3 py-2">
        {inner}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpen(metric)}
        aria-expanded={open}
        title={`${title} — click to jump to ${count === 1 ? "the field" : "the fields"}`}
        className={`flex min-w-[92px] flex-col gap-1 border bg-white px-3 py-2 text-left shadow-sm ${
          open ? "border-neutral-900" : "border-neutral-300 hover:border-neutral-900"
        }`}
      >
        {inner}
      </button>
      {open && items.length > 1 && (
        <div className="absolute left-0 z-40 mt-1.5 max-h-72 w-60 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1.5 shadow-xl">
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
            {label} — {count} field{count === 1 ? "" : "s"}
          </p>
          {groups.map((g) => (
            <div key={g.section}>
              <p className="bg-neutral-50 px-3 py-1 text-[9px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
                {g.section}
              </p>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item.id, metric)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <span className="text-neutral-300" aria-hidden>→</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatusStrip({
  summary,
  metricFields,
  onJumpField,
}: {
  summary: RecordSummary;
  /** The fields behind a metric, in form order, with their section labels. */
  metricFields: (metric: StripMetric) => MetricField[];
  /** Open the section and land on one exact field. */
  onJumpField: (fieldId: string, metric: StripMetric) => void;
}) {
  const done = summary.sectionsComplete === summary.sectionsTotal;
  const [openMetric, setOpenMetric] = useState<StripMetric | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMetric) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMetric(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMetric]);

  /** One field jumps straight there; several open the summary popover. */
  function open(metric: StripMetric) {
    const items = metricFields(metric);
    if (items.length <= 1) {
      setOpenMetric(null);
      if (items[0]) onJumpField(items[0].id, metric);
      return;
    }
    setOpenMetric((prev) => (prev === metric ? null : metric));
  }

  function pick(fieldId: string, metric: StripMetric) {
    setOpenMetric(null);
    onJumpField(fieldId, metric);
  }

  const chip = (
    metric: StripMetric,
    label: string,
    count: number,
    dot: string,
    text: string,
    clear: boolean,
    title: string,
  ) => (
    <Chip
      metric={metric}
      label={label}
      count={count}
      dot={dot}
      text={text}
      clear={clear}
      title={title}
      openMetric={openMetric}
      onOpen={open}
      items={openMetric === metric || count > 0 ? metricFields(metric) : []}
      onPick={pick}
    />
  );

  return (
    <div ref={rootRef} className="flex flex-wrap items-stretch gap-2">
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

      {chip("missing", "Outstanding", summary.missing, "bg-amber-400", "text-amber-800", true, "Required fields still empty at the submit tier")}
      {chip("errors", "Errors", summary.errors, "bg-red-500", "text-red-700", true, "Fields whose current value fails validation")}
      {chip("flags", "Flagged", summary.flags, "bg-amber-500", "text-amber-800", true, "Fields a reviewer rejected and has not yet seen fixed")}
      {chip("imported", "Imported", summary.imported, "bg-blue-400", "text-blue-800", false, "Fields written by the upload — not retyped")}
      {chip("modified", "Modified", summary.modified, "bg-amber-400", "text-amber-800", true, "Imported, then hand-edited — verify against the source")}
    </div>
  );
}
