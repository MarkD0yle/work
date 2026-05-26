import { useState } from "react";
import {
  effectiveState,
  type MonitorAction,
  type QlikMonitor,
} from "../../lib/qlik";
import MonitorRow from "./MonitorRow";

/* Spec v0.1.1 §7 — default sort: severity desc, then age desc.
 *   1. Red, unacknowledged   (oldest first within tier)
 *   2. Red, acknowledged
 *   3. Amber, unacknowledged
 *   4. Amber, acknowledged
 *   5. Green / info (collapsed by default)
 *
 * Spec v0.1 §2.2 ordering preserved; v0.1.1 §7 makes age within tier
 * explicit (oldest first). */

type SortMode = "severity-age" | "age" | "name" | "region";

function ageMin(mon: QlikMonitor, now: number) {
  return (now - new Date(mon.lastRefresh).getTime()) / 60_000;
}

function sortBucket(
  monitors: QlikMonitor[],
  actions: MonitorAction[],
  now: number,
  mode: SortMode,
): QlikMonitor[] {
  return [...monitors].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name);
    if (mode === "region") {
      // No region on monitor type; fall back to name.
      return a.name.localeCompare(b.name);
    }
    if (mode === "age") {
      return ageMin(b, now) - ageMin(a, now);
    }
    // severity-age (default): severity then age desc within tier
    const ea = effectiveState(a, actions);
    const eb = effectiveState(b, actions);
    const rank = (mon: QlikMonitor, e: ReturnType<typeof effectiveState>) => {
      const statusBase =
        mon.status === "red" ? 0 : mon.status === "amber" ? 2 : 99;
      const stateOffset =
        e.kind === "unacked" ? 0 : e.kind === "acked" ? 1 : 1.5;
      return statusBase + stateOffset;
    };
    const ra = rank(a, ea);
    const rb = rank(b, eb);
    if (ra !== rb) return ra - rb;
    // Within severity tier: age desc (oldest first = highest age value)
    return ageMin(b, now) - ageMin(a, now);
  });
}

type TabKind = "alerts" | "refresh";

export default function MonitorList({
  monitors,
  actions,
  now,
  pulseMonitorId,
}: {
  monitors: QlikMonitor[];
  actions: MonitorAction[];
  now: number;
  pulseMonitorId?: string | null;
}) {
  // Spec — split alerts (data conditions) from refresh failures (feed
  // health). Two tabs at the top of the sidebar; lists are filtered by tab.
  const alertMonitors = monitors.filter(
    (m) => (m.kind ?? "alert") === "alert",
  );
  const refreshMonitors = monitors.filter(
    (m) => m.kind === "refresh_failure",
  );

  const [tab, setTab] = useState<TabKind>("alerts");
  const scopedMonitors = tab === "alerts" ? alertMonitors : refreshMonitors;

  // Split into active (red/amber) vs quiet (green/info) per spec.
  const active = scopedMonitors.filter(
    (m) => m.status === "red" || m.status === "amber",
  );
  const quiet = scopedMonitors.filter(
    (m) => m.status === "green" || m.status === "info",
  );

  const [quietOpen, setQuietOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("severity-age");
  const sortedActive = sortBucket(active, actions, now, sortMode);
  const sortedQuiet = sortBucket(quiet, actions, now, sortMode);

  // Counts shown on the tabs — total monitors per kind, including clean.
  const alertCount = alertMonitors.filter(
    (m) => m.status === "red" || m.status === "amber",
  ).length;
  const refreshCount = refreshMonitors.length;

  return (
    <section aria-label="Monitors" className="flex h-full flex-col">
      {/* Sticky header inside the scrollable sidebar */}
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
            Monitors
          </h2>
          <span className="text-[11px] text-neutral-500">
            {active.length} active · {quiet.length} clean
          </span>
        </div>
        {/* Spec — Alerts vs Refresh Status split (Qlik convention).
            Distinct from severity: refresh_failure monitors are listed
            even when green, because the issue is "feed didn't update". */}
        <div className="flex items-center gap-1 rounded-md bg-neutral-100 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setTab("alerts")}
            className={`flex-1 rounded px-2 py-1 font-medium transition ${
              tab === "alerts"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Alerts ({alertCount})
          </button>
          <button
            type="button"
            onClick={() => setTab("refresh")}
            className={`flex-1 rounded px-2 py-1 font-medium transition ${
              tab === "refresh"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Refresh ({refreshCount})
          </button>
        </div>
        {/* Spec v0.1.1 §7.2 — explicit sort control. */}
        <label className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span className="font-semibold tracking-widest uppercase">Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-700"
          >
            <option value="severity-age">Severity + age</option>
            <option value="age">Age only</option>
            <option value="name">Monitor name</option>
          </select>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">

      {sortedActive.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
          No active monitors. {quiet.length} monitors clean.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedActive.map((m) => (
            <MonitorRow
              key={m.id}
              monitor={m}
              actions={actions}
              now={now}
              pulsing={pulseMonitorId === m.id}
            />
          ))}
        </ul>
      )}

      {/* Spec §2.2: green/info collapsed by default, single line. */}
      <button
        type="button"
        onClick={() => setQuietOpen((v) => !v)}
        className="mt-3 flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-left text-xs text-neutral-500 hover:bg-neutral-50"
      >
        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-neutral-300" />
        <span>
          {quiet.length} monitor{quiet.length === 1 ? "" : "s"} clean
        </span>
        <span className="ml-auto text-[10px] text-neutral-400">
          {quietOpen ? "▼ hide" : "▶ show"}
        </span>
      </button>
      {quietOpen && sortedQuiet.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {sortedQuiet.map((m) => (
            <MonitorRow
              key={m.id}
              monitor={m}
              actions={actions}
              now={now}
              pulsing={pulseMonitorId === m.id}
            />
          ))}
        </ul>
      )}
      </div>
    </section>
  );
}
