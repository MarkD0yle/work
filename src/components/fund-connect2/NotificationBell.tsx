import { useEffect, useRef, useState } from "react";
import { ageLabel } from "../../lib/fundConnect2/engine";
import type { Notice } from "../../lib/fundConnect2/types";

/* Per-user notification inbox. What changed, and whether you are expected
 * to act on it — clicking an item jumps to the record and marks it read. */

export default function NotificationBell({
  notices,
  onOpen,
  onMarkAllRead,
}: {
  notices: Notice[];
  onOpen: (notice: Notice) => void;
  onMarkAllRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = notices.filter((n) => !n.read).length;
  const actions = notices.filter((n) => !n.read && n.actionNeeded).length;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications — ${unread} unread`}
        className={`relative rounded-md border p-1.5 ${
          open
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-300 bg-white text-neutral-600 hover:text-neutral-900"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.9 32.9 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.9 32.9 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.45 11.45 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.5 33.5 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z"
            clipRule="evenodd"
          />
        </svg>
        {unread > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white tabular-nums ${
              actions > 0 ? "bg-red-500" : "bg-neutral-500"
            }`}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
            <span className="text-xs font-semibold text-neutral-900">
              Notifications
              {actions > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                  {actions} need action
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-[10px] text-neutral-400 underline underline-offset-2 hover:text-neutral-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <ol className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
            {notices.length === 0 && (
              <li className="px-3 py-4 text-xs text-neutral-500">Nothing yet.</li>
            )}
            {notices.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(n);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-neutral-50 ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      {!n.read && (
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            n.actionNeeded ? "bg-red-500" : "bg-blue-400"
                          }`}
                          aria-hidden
                        />
                      )}
                      <span className="font-mono text-[10px] text-neutral-400">{n.recordId}</span>
                      {n.actionNeeded && !n.read && (
                        <span className="rounded-full bg-red-100 px-1.5 text-[9px] font-medium tracking-wide text-red-700 uppercase">
                          Action needed
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-neutral-400">{ageLabel(n.at)} ago</span>
                  </span>
                  <span className="text-[11px] leading-snug text-neutral-700">{n.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
