import type { MonitorAction, QlikMonitor } from "../../lib/qlik";

/* Spec §2.4 — read-only action log for this monitor over the last 30 days.
 * Implemented as inline expansion rather than a drawer; same information,
 * less navigation. Newest first. */

function formatRel(ts: string, now: number): string {
  const diff = now - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function actionPhrase(a: MonitorAction): string {
  switch (a.action) {
    case "ack":
      return `Acknowledged by ${a.actor}`;
    case "resolve":
      return `Resolved by ${a.actor} — ${a.resolutionReason ?? "no reason"}`;
    case "reopen":
      return `Reopened by ${a.actor}`;
    case "handoff":
      return `Handed off by ${a.actor} → ${a.handoffTo}`;
    case "note":
      return `Note from ${a.actor}`;
  }
}

export default function MonitorHistory({
  monitor,
  actions,
  now,
}: {
  monitor: QlikMonitor;
  actions: MonitorAction[];
  now: number;
}) {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60_000;
  const cutoff = now - THIRTY_DAYS_MS;
  const monitorActions = actions
    .filter((a) => a.monitorId === monitor.id)
    .filter((a) => new Date(a.timestamp).getTime() >= cutoff)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          History · 30 days
        </span>
        <span className="text-[10px] text-neutral-400">
          {monitorActions.length}{" "}
          {monitorActions.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {monitorActions.length === 0 ? (
        <p className="text-xs text-neutral-500">No actions logged.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {monitorActions.map((a) => {
            const stale = a.qlikRefreshTimestamp !== monitor.lastRefresh;
            return (
              <li
                key={a.id}
                className="flex items-baseline gap-2 text-xs"
              >
                <span className="w-16 shrink-0 font-mono text-[10px] text-neutral-400">
                  {formatRel(a.timestamp, now)}
                </span>
                <span className="flex-1 text-neutral-700">
                  {actionPhrase(a)}
                  {a.note && (
                    <span className="ml-1.5 text-neutral-500">— "{a.note}"</span>
                  )}
                </span>
                {stale && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-neutral-600 uppercase">
                    prior refresh
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
