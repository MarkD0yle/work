import { useEffect } from "react";

/* Spec §5.2 — drilled view of a past day. Read-only.
 *
 * Prototype stub: shows the date and a placeholder for the breached
 * monitors that closed on that day. In production this hits the action
 * log endpoint with a date filter.
 *
 * Renders as a small inline drawer pinned bottom-right of the page; Esc
 * or backdrop click closes. NOT a modal — the rest of the page stays
 * interactive (spec §5.5 — read-only context, doesn't filter the page). */

export default function HistoricalDayDrawer({
  date,
  stage,
  onClose,
}: {
  date: string;
  stage?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateLabel = new Date(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Historical view for ${dateLabel}`}
        onClick={(e) => e.stopPropagation()}
        className="m-6 w-[420px] rounded-lg border border-neutral-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              Historical · read-only
            </div>
            <h3 className="mt-0.5 text-base font-semibold text-neutral-900">
              {dateLabel}
            </h3>
            {stage && (
              <p className="text-xs text-neutral-500">Stage: {stage}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close historical view"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-neutral-500">
            In production this would show the monitors that were breached
            at end-of-day, plus the resolution actions that closed them.
            Prototype stub — backend not wired.
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-xs text-neutral-700">
            <li className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="font-semibold">
                Actuals file from WMH not received
              </div>
              <div className="text-neutral-500">
                breached 09:47 · resolved 11:23 by Sriram K · fixed
              </div>
            </li>
            <li className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="font-semibold">
                Custodian pricing feed delay
              </div>
              <div className="text-neutral-500">
                breached 14:02 · auto-cleared 14:58
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
