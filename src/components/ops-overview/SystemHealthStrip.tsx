import { useState } from "react";
import type { QlikSummary } from "../../lib/qlik";
import {
  formatAge,
  formatClock,
  useSystemHealth,
  type HealthIndicator,
  type HealthState,
} from "../../hooks/useSystemHealth";
import SystemHealthDrawer from "./SystemHealthDrawer";

/* Spec v0.1.2 §4 — compact two-indicator strip above the L0 banner.
 *
 * Replaces the v0.1.1 three-tile Qlik header, which duplicated the L0
 * banner. Also absorbs the StaleBanner — one piece of UI per signal
 * (spec §4.5).
 *
 * Hard rule (spec §6, rule 24): this strip must be quieter than the L0
 * banner. Always. */

const STATE_DOT: Record<HealthState, string> = {
  healthy: "bg-emerald-500",
  stale: "bg-amber-500",
  failed: "bg-red-500",
};

export default function SystemHealthStrip({
  summary,
  now,
}: {
  summary: QlikSummary;
  now: number;
}) {
  const health = useSystemHealth(summary, now);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div
        role="status"
        aria-label="System health"
        className="mb-3 flex h-8 items-center gap-6 rounded-md border border-neutral-200 bg-white px-3"
      >
        <Indicator indicator={health.qlikFeed} now={now} onClick={() => setDrawerOpen(true)} />
        <span aria-hidden className="h-3 w-px bg-neutral-200" />
        <Indicator indicator={health.dependentSystems} now={now} onClick={() => setDrawerOpen(true)} />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="ml-auto text-[10px] font-medium text-neutral-400 hover:text-neutral-700"
        >
          history ›
        </button>
      </div>
      {drawerOpen && (
        <SystemHealthDrawer
          health={health}
          now={now}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}

function Indicator({
  indicator,
  now,
  onClick,
}: {
  indicator: HealthIndicator;
  now: number;
  onClick?: () => void;
}) {
  const age = formatAge(indicator.lastRefresh, now);
  const suffix =
    indicator.state === "failed"
      ? ` — failing`
      : indicator.state === "stale"
        ? ` — stale`
        : "";
  const title =
    `${indicator.label}\n` +
    `Last refresh: ${formatClock(indicator.lastRefresh)} (${age})\n` +
    `Polling every ${indicator.pollSeconds}s\n` +
    `Last poll attempt: ${formatClock(indicator.lastPollAttempt)} (${
      indicator.lastPollOk ? "success" : "fail"
    })`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="group inline-flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-900"
    >
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${STATE_DOT[indicator.state]}`} />
      <span className="font-medium">{indicator.label}</span>
      <span className="font-mono text-[10px] text-neutral-400 group-hover:text-neutral-600">
        · last {formatClock(indicator.lastRefresh)} ({age}{suffix})
      </span>
    </button>
  );
}
