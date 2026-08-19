import { SECTION_DOT, SECTION_LABEL } from "../../lib/fundConnect/tone";
import type { SectionStatus } from "../../lib/fundConnect/types";

/* Persistent section rail. Spec §3 — every section's state is visible
 * without scrolling to it, and the counts say *why* a section is not
 * finished rather than just that it isn't. */

export type RailItem = {
  id: string;
  label: string;
  status: SectionStatus;
  missing: number;
  errors: number;
  flags: number;
};

export default function StatusRail({
  items,
  activeId,
  onSelect,
}: {
  items: RailItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Form sections">
      <ol className="flex flex-col">
        {items.map((item, i) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full items-start gap-2.5 border-l-2 py-2.5 pr-2 pl-3 text-left transition ${
                  active
                    ? "border-neutral-900 bg-white"
                    : "border-transparent hover:bg-white/70"
                }`}
              >
                <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center">
                  {item.status === "complete" ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-neutral-900" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className={`h-2 w-2 rounded-full ${SECTION_DOT[item.status]}`} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[10px] tabular-nums text-neutral-400">{i + 1}</span>
                    <span
                      className={`truncate text-sm ${active ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}
                    >
                      {item.label}
                    </span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-neutral-400">{SECTION_LABEL[item.status]}</span>
                    {item.errors > 0 && (
                      <span className="rounded-full bg-red-100 px-1.5 font-medium text-red-700">
                        {item.errors} error{item.errors === 1 ? "" : "s"}
                      </span>
                    )}
                    {item.flags > 0 && (
                      <span className="rounded-full bg-amber-100 px-1.5 font-medium text-amber-800">
                        {item.flags} flagged
                      </span>
                    )}
                    {item.missing > 0 && item.errors === 0 && (
                      <span className="text-neutral-400">{item.missing} outstanding</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
