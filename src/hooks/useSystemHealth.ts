/* System-health hook — spec v0.1.2 §4.
 *
 * Two indicators that sit above the L0 banner:
 *   - Qlik feed       (is monitor data being refreshed?)
 *   - Dependent systems (sources Qlik depends on)
 *
 * For the prototype we drive these off the QlikSummary that's already
 * fetched on every render. Real impl polls the feed-status endpoint on a
 * different cadence (it changes more slowly than monitor data). */

import { useMemo } from "react";
import { STALE_THRESHOLD_MIN, type QlikSummary } from "../lib/qlik";

export type HealthState = "healthy" | "stale" | "failed";

export interface HealthIndicator {
  label: string;
  state: HealthState;
  /** ISO timestamp of last successful refresh. */
  lastRefresh: string;
  /** Polling cadence in seconds. */
  pollSeconds: number;
  /** ISO timestamp of last poll attempt (success or fail). */
  lastPollAttempt: string;
  /** Did the last poll attempt succeed? */
  lastPollOk: boolean;
}

export interface SystemHealth {
  qlikFeed: HealthIndicator;
  dependentSystems: HealthIndicator;
  /** Worst state across all indicators — drives the L0 fallback escalation. */
  worst: HealthState;
}

const SEVERE_STALE_MIN = 60;

function classify(ageMin: number, sourceStatus: "ok" | "degraded" | "failed"): HealthState {
  if (sourceStatus === "failed" || ageMin >= SEVERE_STALE_MIN) return "failed";
  if (sourceStatus === "degraded" || ageMin > STALE_THRESHOLD_MIN) return "stale";
  return "healthy";
}

function ageMinutes(ts: string, now: number): number {
  return Math.floor((now - new Date(ts).getTime()) / 60_000);
}

export function useSystemHealth(summary: QlikSummary, now: number): SystemHealth {
  return useMemo(() => {
    const qlikAge = ageMinutes(summary.lastRefresh, now);
    const qlikFeed: HealthIndicator = {
      label: "Qlik feed",
      state: classify(qlikAge, summary.monitorRefreshStatus),
      lastRefresh: summary.lastRefresh,
      pollSeconds: 60,
      lastPollAttempt: new Date(now).toISOString(),
      lastPollOk: summary.monitorRefreshStatus !== "failed",
    };
    const depAge = qlikAge;
    const dependentSystems: HealthIndicator = {
      label: "Dependent systems",
      state: classify(depAge, summary.otherDashboardStatus),
      lastRefresh: summary.lastRefresh,
      pollSeconds: 60,
      lastPollAttempt: new Date(now).toISOString(),
      lastPollOk: summary.otherDashboardStatus !== "failed",
    };
    const order: HealthState[] = ["healthy", "stale", "failed"];
    const worst =
      order[Math.max(order.indexOf(qlikFeed.state), order.indexOf(dependentSystems.state))];
    return { qlikFeed, dependentSystems, worst };
  }, [summary, now]);
}

export function formatAge(ts: string, now: number): string {
  const min = ageMinutes(ts, now);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  const rem = min % 60;
  return `${hours}h ${rem}m`;
}

export function formatClock(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
