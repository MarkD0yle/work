import {
  monitorActionsRepo,
  type MonitorAction,
  type QlikMonitor,
} from "../../lib/qlik";
import { useSyncExternalStore } from "react";

/* Spec v0.1.1 §8 — Clean-day panel.
 *
 * Replaces the monitor list in the right sidebar when L0 state is Clean.
 * Three sections:
 *   - Streak counter (days clean this month) — gamified but subtle
 *   - Next expected event (forward-looking, useful)
 *   - Recent audit (last 5 actions across users) — shows the team has
 *     been working even when the dashboard is green
 */

function formatClock(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCountdown(targetMin: number): string {
  if (targetMin < 60) return `${targetMin}m`;
  const h = Math.floor(targetMin / 60);
  const m = targetMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function actionPhrase(a: MonitorAction, monitorName?: string): string {
  const target = monitorName ?? a.monitorId;
  switch (a.action) {
    case "ack":
      return `${a.actor} acked ${target}`;
    case "resolve":
      return `${a.actor} resolved ${target}${a.resolutionReason ? ` — ${a.resolutionReason}` : ""}`;
    case "reopen":
      return `${a.actor} reopened ${target}`;
    case "handoff":
      return `${a.actor} handed off ${target} → ${a.handoffTo ?? "?"}`;
    case "note":
      return `${a.actor} noted on ${target}`;
  }
}

function relTime(ts: string, now: number): string {
  const diff = now - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function CleanDayPanel({
  monitors,
  now,
}: {
  monitors: QlikMonitor[];
  now: number;
}) {
  const actions = useSyncExternalStore(
    (cb) => monitorActionsRepo.subscribe(cb),
    () => monitorActionsRepo.snapshot(),
    () => [],
  );

  // Recent audit: last 5 actions, newest first.
  const monitorById = new Map(monitors.map((m) => [m.id, m]));
  const recent = [...actions]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  // Next expected event — pick the earliest monitor lastRefresh that
  // hasn't yet flipped to green. Mocked for prototype: assume next batch
  // is at 14:30 ET. In production this comes from the same calendar that
  // feeds monitor benchmarks.
  // Placeholder for next event:
  const nextEventLabel = "Actuals batch";
  const nextEventTime = "14:30 ET";
  // 130 minutes ahead from "now" is a sensible mock countdown.
  const nextEventCountdownMin = 130;

  // Streak — mocked. In production: ManagementStrip uses 12 / 23. We'll
  // reuse those numbers for visual consistency.
  const daysClean = 12;
  const tradingDaysSoFar = 14;

  return (
    <section
      aria-label="Clean day panel"
      className="flex h-full flex-col"
    >
      {/* Sticky header to match the MonitorList visual contract */}
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
            Today
          </h2>
          <span className="text-[11px] text-emerald-700">
            All systems clean
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Streak — gamified but subtle */}
        <div className="mb-5 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Days clean this month
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-neutral-900">
              {daysClean}
            </span>
            <span className="text-xs text-neutral-500">
              of {tradingDaysSoFar} trading days
            </span>
          </div>
          {/* Subtle progress bar — visual reinforcement, not the headline */}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full bg-emerald-400"
              style={{
                width: `${(daysClean / tradingDaysSoFar) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Next expected event */}
        <div className="mb-5 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Next expected event
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-neutral-900">
              {nextEventLabel}
            </span>
            <span className="font-mono text-xs text-neutral-500">
              {nextEventTime}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            in {fmtCountdown(nextEventCountdownMin)}
          </div>
        </div>

        {/* Recent audit */}
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              Recent audit
            </div>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="text-[10px] font-medium text-blue-700 hover:underline"
            >
              View full log →
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No actions logged yet today.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {recent.map((a) => {
                const monitor = monitorById.get(a.monitorId);
                return (
                  <li
                    key={a.id}
                    className="flex items-baseline gap-2 text-xs"
                  >
                    <span className="w-16 shrink-0 font-mono text-[10px] text-neutral-400">
                      {relTime(a.timestamp, now)}
                    </span>
                    <span className="flex-1 text-neutral-700">
                      {actionPhrase(a, monitor?.name)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="mt-6 text-[10px] text-neutral-400">
          Last refresh{" "}
          {monitors.length > 0
            ? formatClock(monitors[0].lastRefresh)
            : "—"}
        </div>
      </div>
    </section>
  );
}
