import type { ReactNode } from "react";
import { SECTION_DOT, SECTION_LABEL } from "../../lib/fundConnect/tone";
import type { SectionStatus } from "../../lib/fundConnect/types";

/* A section of the form. Spec §3: one section expanded at a time, and a
 * completed section condenses to a single summary row that is still on the
 * page and still clickable — not folded away behind a toggle you have to
 * remember to open. */

export default function SectionCard({
  index,
  label,
  blurb,
  status,
  summary,
  expanded,
  errors,
  flags,
  missing,
  onToggle,
  children,
}: {
  index: number;
  label: string;
  blurb: string;
  status: SectionStatus;
  summary: string;
  expanded: boolean;
  errors: number;
  flags: number;
  missing: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={`fc-section-${index}`}
      className={`border bg-white ${
        status === "error" ? "border-red-200" : "border-neutral-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {status === "complete" ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-neutral-900" aria-hidden>
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <span className={`h-2 w-2 rounded-full ${SECTION_DOT[status]}`} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-[11px] tabular-nums text-neutral-400">
              {String(index).padStart(2, "0")}
            </span>
            <span className="text-sm font-semibold text-neutral-900">{label}</span>
            <span className="text-[11px] text-neutral-400">{SECTION_LABEL[status]}</span>
            {errors > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-medium text-red-700">
                {errors} error{errors === 1 ? "" : "s"}
              </span>
            )}
            {flags > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800">
                {flags} flagged
              </span>
            )}
            {missing > 0 && (
              <span className="text-[11px] text-neutral-400">{missing} outstanding</span>
            )}
          </span>
          {/* Condensed sections keep their values on screen — the summary is
              the whole point of condensing rather than collapsing. */}
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {expanded ? blurb : summary}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-neutral-500">
          {expanded ? "Condense" : "Open"}
        </span>
      </button>
      {expanded && <div className="border-t border-neutral-200">{children}</div>}
    </section>
  );
}
