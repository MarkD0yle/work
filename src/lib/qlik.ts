/* ------------------------------------------------------------------ *
 * Qlik integration layer + ccymgmt action store
 *
 * Spec source: ccymgmt — Ops Overview Build Spec (v0.1 + v0.2)
 * Sections: §1.1 (Qlik integration), §1.2 (Feedback state), §2.1 (mapping)
 *
 * For real build: split this into the file layout shown in spec §3:
 *   lib/qlik-client.ts, lib/qlik-state-mapper.ts, lib/monitor-actions.ts
 * Kept as one file here because this is a design prototype workspace.
 * The exported surface area is intentionally identical to the spec.
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";

/* ==================================================================== *
 * §1.1 — Typed contracts (confirm names against real Qlik API)
 * ==================================================================== */

export type MonitorStatus = "green" | "amber" | "red" | "info";
export type MonitorCategory = "process" | "data" | "rule" | "system";

/* Spec — three-tier benchmark on monitors (the right-hand version of
 * the stage-tier concept). Only meaningful when status is amber or red. */
export type MonitorTier = "typical" | "required" | "benchmark";

/* Spec — distinguishes data-condition alerts from feed-refresh failures.
 * The right sidebar splits monitors into two tabs by this field. */
export type MonitorKind = "alert" | "refresh_failure";

export interface QlikMonitor {
  id: string;
  name: string;
  status: MonitorStatus;
  lastRefresh: string; // ISO
  detail: string;
  affectedCount: number;
  category: MonitorCategory;
  /** Defaults to "alert". refresh_failure means the underlying feed
   *  hasn't refreshed — operator action is "kick the feed", not
   *  "fix the data". */
  kind?: MonitorKind;
  /** Refines the amber/red status into a benchmark tier. */
  tier?: MonitorTier;
}

export interface QlikSummary {
  monitorRefreshStatus: "ok" | "degraded" | "failed";
  monitorSummary: {
    midLevelFlags: number;
    infoWarnings: number;
  };
  otherDashboardStatus: "ok" | "degraded" | "failed";
  lastRefresh: string;
}

/* ==================================================================== *
 * §1.2 — ccymgmt feedback state (lives in ccymgmt store, not Qlik)
 * ==================================================================== */

export type ResolutionReason =
  | "false-positive"
  | "fixed"
  | "auto-cleared"
  | "deferred"
  | "external-dependency"
  | "other";

export const RESOLUTION_REASONS: { value: ResolutionReason; label: string }[] = [
  { value: "false-positive", label: "False positive" },
  { value: "fixed", label: "Fixed at source" },
  { value: "auto-cleared", label: "Auto-cleared" },
  { value: "deferred", label: "Deferred to next cycle" },
  { value: "external-dependency", label: "External dependency" },
  { value: "other", label: "Other (note required)" },
];

/* Spec deviation: action type in spec is 'ack' | 'resolve' | 'reopen' only,
 * but §2.3 lists Hand off and Add note as first-class actions. Extending
 * here; flag for spec author review. */
export type ActionType = "ack" | "resolve" | "reopen" | "handoff" | "note";

export interface MonitorAction {
  id: string; // local sequencing; not in spec, used to dedupe in history
  monitorId: string;
  qlikRefreshTimestamp: string; // binds action to a specific Qlik state
  action: ActionType;
  actor: string;
  timestamp: string;
  resolutionReason?: ResolutionReason;
  note?: string;
  handoffTo?: string; // for action === 'handoff'
}

/* ==================================================================== *
 * §2.1 — Operational state mapper
 * ==================================================================== */

/* Spec v0.1.2 §1.5 — `watch` joins the L0 ladder between clean and at-risk.
 *   clean    nothing late
 *   watch    at least one Past Typical breach (slow but no SLA breached)
 *   at-risk  at least one Past Required breach (SLA breached, but not benchmark)
 *   broken   at least one Past Benchmark breach (or validation failure) */
export type OperationalState = "clean" | "watch" | "at-risk" | "broken";

/* Monitor-only derivation — retained for surfaces that don't have pipeline
 * data on hand. Monitors don't carry tier info today, so amber maps to
 * at-risk (the most conservative read) and red maps to broken. */
export function deriveOperationalStateFromMonitors(
  monitors: QlikMonitor[],
): OperationalState {
  if (monitors.some((m) => m.status === "red")) return "broken";
  if (monitors.some((m) => m.status === "amber")) return "at-risk";
  return "clean";
}

/* Spec v0.1.2 §1.5 — primary L0 derivation, sourced from pipeline stage
 * tiers (the part of the system that actually carries tier information).
 * Monitors are folded in as a fallback so a refresh-failure monitor that
 * isn't attached to a pipeline still escalates the L0 state. */
export function deriveOperationalState(
  pipelines: PipelineState[],
  monitors: QlikMonitor[] = [],
): OperationalState {
  let worst: OperationalState = "clean";
  const bump = (s: OperationalState) => {
    const rank = (x: OperationalState) =>
      x === "broken" ? 3 : x === "at-risk" ? 2 : x === "watch" ? 1 : 0;
    if (rank(s) > rank(worst)) worst = s;
  };

  for (const p of pipelines) {
    for (const stage of p.stages) {
      if (stage.status === "past_benchmark" || stage.status === "failed") {
        return "broken";
      }
      if (stage.status === "past_required") bump("at-risk");
      else if (stage.status === "past_typical") bump("watch");
    }
  }

  // Fallback signal — monitors that aren't backed by a pipeline (e.g. feed
  // refresh failures) still escalate.
  for (const m of monitors) {
    if (m.status === "red") return "broken";
    if (m.status === "amber") {
      // typical-tier monitors stay at watch; others escalate to at-risk.
      if (m.tier === "typical") bump("watch");
      else bump("at-risk");
    }
  }
  return worst;
}

export function deriveSummary(monitors: QlikMonitor[]): QlikSummary {
  // Mirrors what Qlik's own summary endpoint would return; surfaced here so
  // we can render the banner from a single shape regardless of API path.
  const red = monitors.filter((m) => m.status === "red").length;
  const amber = monitors.filter((m) => m.status === "amber").length;
  const info = monitors.filter((m) => m.status === "info").length;
  const lastRefresh = monitors.reduce(
    (acc, m) => (m.lastRefresh > acc ? m.lastRefresh : acc),
    monitors[0]?.lastRefresh ?? new Date().toISOString(),
  );
  return {
    monitorRefreshStatus: "ok",
    monitorSummary: { midLevelFlags: red + amber, infoWarnings: info },
    otherDashboardStatus: "ok",
    lastRefresh,
  };
}

/** Stale if Qlik's last refresh is more than this many minutes ago. */
export const STALE_THRESHOLD_MIN = 5; // spec §2.1

export function isStale(lastRefresh: string, now: number): boolean {
  const ts = new Date(lastRefresh).getTime();
  return (now - ts) / 60_000 > STALE_THRESHOLD_MIN;
}

/* ==================================================================== *
 * Effective action state — collapses the action log into "what does this
 * monitor look like RIGHT NOW given user actions and Qlik's current
 * refresh stamp?" The qlikRefreshTimestamp binding (spec §1.2) is enforced
 * here: an action only applies if its refresh stamp matches the monitor's
 * current lastRefresh. If they differ, the action is stale; the monitor
 * reverts to unacknowledged.
 * ==================================================================== */

export type EffectiveState =
  | { kind: "unacked" }
  | { kind: "acked"; actor: string; at: string }
  | {
      kind: "resolved";
      actor: string;
      at: string;
      reason: ResolutionReason;
      note?: string;
    };

export function effectiveState(
  monitor: QlikMonitor,
  actions: MonitorAction[],
): EffectiveState {
  // Only actions tied to the monitor's CURRENT refresh count.
  const live = actions
    .filter(
      (a) =>
        a.monitorId === monitor.id &&
        a.qlikRefreshTimestamp === monitor.lastRefresh,
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (live.length === 0) return { kind: "unacked" };

  // Walk forward, applying actions in order.
  let state: EffectiveState = { kind: "unacked" };
  for (const a of live) {
    if (a.action === "ack" || a.action === "handoff") {
      state = {
        kind: "acked",
        actor: a.action === "handoff" ? a.handoffTo ?? a.actor : a.actor,
        at: a.timestamp,
      };
    } else if (a.action === "resolve") {
      state = {
        kind: "resolved",
        actor: a.actor,
        at: a.timestamp,
        reason: a.resolutionReason ?? "other",
        note: a.note,
      };
    } else if (a.action === "reopen") {
      state = { kind: "unacked" };
    }
    // 'note' actions don't change state; they show in history only.
  }
  return state;
}

/* ==================================================================== *
 * Action store — module singleton with useSyncExternalStore subscription.
 * Behind a MonitorActionsRepo interface so real backend swaps in cleanly.
 * ==================================================================== */

export interface MonitorActionsRepo {
  snapshot(): MonitorAction[];
  record(
    action: Omit<MonitorAction, "id" | "timestamp">,
    options?: { optimistic?: boolean },
  ): Promise<MonitorAction>;
  subscribe(fn: () => void): () => void;
  reset(): void;
}

class InMemoryRepo implements MonitorActionsRepo {
  private actions: MonitorAction[] = [];
  private subscribers = new Set<() => void>();
  private seq = 0;

  snapshot() {
    return this.actions;
  }

  async record(
    input: Omit<MonitorAction, "id" | "timestamp">,
    options?: { optimistic?: boolean },
  ) {
    const action: MonitorAction = {
      ...input,
      id: `act-${++this.seq}`,
      timestamp: new Date().toISOString(),
    };
    // Spec §4.4: ack can be optimistic; resolve must await persistence.
    // Simulate ~150ms backend round-trip for non-optimistic.
    if (!options?.optimistic) {
      await new Promise((r) => setTimeout(r, 150));
    }
    // Replace existing reference so React notices.
    this.actions = [...this.actions, action];
    this.emit();
    return action;
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  reset() {
    this.actions = [];
    this.emit();
  }

  private emit() {
    for (const fn of this.subscribers) fn();
  }
}

export const monitorActionsRepo: MonitorActionsRepo = new InMemoryRepo();

/* React-19 idiomatic subscription. Returns the full snapshot; callers
 * filter by monitorId where needed. */
export function useMonitorActions(): MonitorAction[] {
  return useSyncExternalStore(
    (cb) => monitorActionsRepo.subscribe(cb),
    () => monitorActionsRepo.snapshot(),
    () => [],
  );
}

/* ==================================================================== *
 * Current user — hardcoded for prototype. Real impl pulls from SSO claim.
 * ==================================================================== */

// TODO_VALIDATE — spec §6 open question: User identity source.
export const ME = "Mark D";

export const TEAM: { id: string; name: string }[] = [
  { id: "Mark D", name: "Mark D" },
  { id: "Sriram K", name: "Sriram K" },
  { id: "Howard W", name: "Howard W" },
  { id: "Mary R", name: "Mary R" },
  { id: "Jess T", name: "Jess T" },
  { id: "Dev O", name: "Dev O" },
];

/* ==================================================================== *
 * Mock Qlik client — 17 monitors, three fixture days
 * ==================================================================== */

const NOW = Date.now();
const iso = (offsetMin: number) =>
  new Date(NOW + offsetMin * 60_000).toISOString();

type MonitorSeed = Omit<QlikMonitor, "lastRefresh"> & {
  lastRefreshOffsetMin: number;
};

/* 17 monitors mirroring the State Street Qlik dashboard. Names match
 * the actual Qlik conventions verbatim where possible (GAM/CH prefixes,
 * "none detected" / "no relevant activity detected" status copy, "DoD
 * Matches" for day-over-day patterns). */
const MONITOR_SEEDS_BASE: MonitorSeed[] = [
  {
    id: "mon-01",
    name: "Estimate trades settling today have not been reversed",
    status: "green",
    detail: "none detected",
    affectedCount: 0,
    category: "process",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-02",
    name: "GAM Actuals File Monitor — file not received by 14:30 EST",
    status: "green",
    detail: "file received 14:12 EST",
    affectedCount: 0,
    category: "data",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-03",
    name: "NAV validation — securities returned negative quantity",
    status: "green",
    detail: "none detected",
    affectedCount: 0,
    category: "rule",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-04",
    name: "Manual NAV override pending Ops sign-off",
    status: "green",
    detail: "none detected",
    affectedCount: 0,
    category: "process",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-05",
    name: "CH Custodian pricing feed — delay > 30m",
    status: "green",
    detail: "feed current — last tick 09:01 EST",
    affectedCount: 0,
    category: "data",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-06",
    name: "Bloomberg snapshot stale > 4h",
    status: "green",
    detail: "snapshot from 08:55 EST",
    affectedCount: 0,
    category: "data",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-07",
    name: "Late upstream OMS rebalance feed",
    status: "green",
    detail: "feed on schedule",
    affectedCount: 0,
    category: "process",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-08",
    name: "SGT liquidity actuals — cutoff missed",
    status: "green",
    detail: "cutoff met 12:14 SGT",
    affectedCount: 0,
    category: "process",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-09",
    name: "iShares 25 day P&L rule — accounts approaching limit",
    status: "green",
    detail: "no accounts approaching limit",
    affectedCount: 0,
    category: "rule",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-10",
    name: "Markets Gateway Performance Monitor — DoD Matches",
    status: "green",
    detail: "DoD pattern within tolerance",
    affectedCount: 0,
    category: "process",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-11",
    name: "Currency exposure — mandate limit",
    status: "green",
    detail: "no relevant activity detected",
    affectedCount: 0,
    category: "rule",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-12",
    name: "T+1 settlement break — unresolved",
    status: "info",
    detail: "1 break expected to clear by 11:00",
    affectedCount: 1,
    category: "process",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-13",
    name: "Corporate action data — missing for active securities",
    status: "info",
    detail: "2 mandate(s) awaiting CA file",
    affectedCount: 2,
    category: "data",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-14",
    name: "GAM Fee File Monitor",
    status: "green",
    detail: "feed refreshed at 13:45 EST",
    affectedCount: 0,
    category: "system",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-15",
    name: "Approved Trades Monitor — none waiting to be executed",
    status: "green",
    detail: "none detected",
    affectedCount: 0,
    category: "rule",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-16",
    name: "Trade allocation imbalance — DoD Matches",
    status: "green",
    detail: "no relevant activity detected",
    affectedCount: 0,
    category: "rule",
    lastRefreshOffsetMin: -1,
  },
  {
    id: "mon-17",
    name: "GAM Large Redemptions Monitor",
    status: "green",
    detail: "no relevant activity detected",
    affectedCount: 0,
    category: "data",
    lastRefreshOffsetMin: -1,
  },
];

function withFixtureOverrides(
  overrides: Partial<Record<string, Partial<MonitorSeed>>>,
): QlikMonitor[] {
  return MONITOR_SEEDS_BASE.map((seed) => {
    const o = overrides[seed.id] ?? {};
    const { lastRefreshOffsetMin, ...rest } = { ...seed, ...o };
    return { ...rest, lastRefresh: iso(lastRefreshOffsetMin) };
  });
}

const CLEAN_FIXTURE: QlikMonitor[] = withFixtureOverrides({});

const AT_RISK_FIXTURE: QlikMonitor[] = withFixtureOverrides({
  "mon-01": {
    status: "amber",
    detail: "4 trade(s) identified",
    affectedCount: 4,
    lastRefreshOffsetMin: -3,
  },
  // Cross-referenced from Pipeline view (Cohen & Steers Actuals breached)
  "mon-02": {
    status: "amber",
    detail: "Actuals file expected 14:30 — partial file received 14:54",
    affectedCount: 2,
    lastRefreshOffsetMin: -25,
  },
  "mon-05": {
    status: "amber",
    detail: "Feed running 22m behind schedule",
    affectedCount: 6,
    lastRefreshOffsetMin: -2,
  },
  "mon-06": {
    status: "amber",
    detail: "Snapshot >4h old — using 04:30 EST tick",
    affectedCount: 2,
    lastRefreshOffsetMin: -4,
  },
  // Cross-referenced from Pipeline view (Vanguard Rebalance breached)
  "mon-07": {
    status: "amber",
    detail: "Rebalance feed delayed — 12m past 09:00 cutoff",
    affectedCount: 1,
    lastRefreshOffsetMin: -12,
  },
  "mon-08": {
    status: "amber",
    detail: "Cutoff missed — partial file received 12:15 SGT",
    affectedCount: 1,
    lastRefreshOffsetMin: -18,
  },
  // Refresh-failure monitors — feed didn't refresh, so we can't evaluate.
  // Action is "kick the feed", not "fix data". Shown in the Refresh tab
  // of the sidebar, not the Alerts tab.
  "mon-14": {
    status: "amber",
    detail: "feed not refreshed since 09:45 — vendor incident",
    affectedCount: 0,
    kind: "refresh_failure",
    lastRefreshOffsetMin: -288, // ~4.8h stale
  },
  "mon-17": {
    status: "amber",
    detail: "scheduled feed at 10:30 — no data received",
    affectedCount: 0,
    kind: "refresh_failure",
    lastRefreshOffsetMin: -210, // ~3.5h stale
  },
});

const BROKEN_FIXTURE: QlikMonitor[] = withFixtureOverrides({
  "mon-02": {
    status: "red",
    detail: "File not received — 48m late",
    affectedCount: 1,
    lastRefreshOffsetMin: -48,
  },
  "mon-03": {
    status: "red",
    detail: "3 security(s) returned negative quantity",
    affectedCount: 3,
    lastRefreshOffsetMin: -91,
  },
  "mon-04": {
    status: "red",
    detail: "1 override flagged — awaiting Ops sign-off (1h 6m)",
    affectedCount: 1,
    lastRefreshOffsetMin: -66,
  },
  "mon-07": {
    status: "amber",
    detail: "Rebalance feed delayed — 12m past 09:00 cutoff",
    affectedCount: 1,
    lastRefreshOffsetMin: -12,
  },
  "mon-09": {
    status: "amber",
    detail: "2 mandate(s) approaching tolerance band",
    affectedCount: 2,
    lastRefreshOffsetMin: -7,
  },
  "mon-14": {
    status: "amber",
    detail: "Vendor incident — partial outage since 09:45",
    affectedCount: 3,
    lastRefreshOffsetMin: -22,
  },
  // Cross-referenced from Pipeline view (PIMCO Estimates awaiting approval)
  "mon-15": {
    status: "amber",
    detail: "Estimates ready 14:00 — pending approver sign-off (41m)",
    affectedCount: 1,
    lastRefreshOffsetMin: -41,
  },
});

/* Watch fixture — only Past Typical breaches present. Demonstrates the
 * new v0.1.2 §1.5 `watch` L0 state: something is slightly off but no SLA
 * has slipped yet. Banner renders cream, not amber. */
const WATCH_FIXTURE: QlikMonitor[] = withFixtureOverrides({
  "mon-05": {
    status: "amber",
    tier: "typical",
    detail: "Feed running 4m behind schedule",
    affectedCount: 1,
    lastRefreshOffsetMin: -1,
  },
  "mon-06": {
    status: "amber",
    tier: "typical",
    detail: "Snapshot 4h 12m old — slightly past typical 4h window",
    affectedCount: 1,
    lastRefreshOffsetMin: -2,
  },
});

const FIXTURES: Record<OperationalState, QlikMonitor[]> = {
  clean: CLEAN_FIXTURE,
  watch: WATCH_FIXTURE,
  "at-risk": AT_RISK_FIXTURE,
  broken: BROKEN_FIXTURE,
};

/* The exported client interface mirrors what spec §1.1 demands. The
 * implementation here is a deterministic mock; in production this calls
 * Qlik. Polling cadence (60s) is enforced by the caller hook, not here. */
export function fetchMonitors(fixture: OperationalState): Promise<QlikMonitor[]> {
  return Promise.resolve(FIXTURES[fixture]);
}

export function fetchSummary(fixture: OperationalState): Promise<QlikSummary> {
  return Promise.resolve(deriveSummary(FIXTURES[fixture]));
}

/* Dev-only: simulate Qlik refreshing its monitor data. Bumping a monitor's
 * lastRefresh invalidates any prior actions tied to the old value (spec
 * §1.2). Used to demo the "ack does not carry across refresh" guarantee. */
export function simulateRefresh(
  fixture: OperationalState,
  monitorIds?: string[],
): QlikMonitor[] {
  const target = FIXTURES[fixture];
  const newIso = new Date().toISOString();
  for (let i = 0; i < target.length; i++) {
    if (!monitorIds || monitorIds.includes(target[i].id)) {
      target[i] = { ...target[i], lastRefresh: newIso };
    }
  }
  return target;
}

/* ==================================================================== *
 * Pipeline view — supplementary visual surface
 *
 * NOT in the v0.1 spec component list, but spec §0 references Qlik's L2
 * "per-process and per-client past-benchmark counts" — this view consumes
 * that L2 data. The shape below maps to what Qlik's per-client breakdown
 * exposes; if the real Qlik API uses different field names, this is the
 * boundary to adjust.
 *
 * Each PipelineState row references the monitor IDs implicated, so click-
 * through to MonitorList is possible.
 * ==================================================================== */

export type PipelineStageName =
  | "Rebalance"
  | "Estimates"
  | "Actuals"
  | "Reporting";

export const PIPELINE_STAGE_ORDER: PipelineStageName[] = [
  "Rebalance",
  "Estimates",
  "Actuals",
  "Reporting",
];

/** True if a stage status is any of the three breach tiers (but not failed). */
export function isBreachedTier(
  s: PipelineStageStatus | LifecycleStatus | undefined,
): boolean {
  return (
    s === "past_typical" || s === "past_required" || s === "past_benchmark"
  );
}

/* Spec — three-tier benchmark state, borrowed from Qlik's
 *   Past Typical / Past Required / Past Benchmark gradient.
 *
 *   past_typical  → slower than typical historical pace (yellow flag)
 *   past_required → past internal SLA but not contractual breach (amber)
 *   past_benchmark → past contractual benchmark — the actual breach (red)
 *   failed        → catastrophic / validation failure (dark red)
 *
 * The mandate-level worstStatus collapses these tiers into broken /
 * at_risk / watch. Stage cells carry the finer gradient. */
export type PipelineStageStatus =
  | "complete"
  | "in_progress"
  | "past_typical"
  | "past_required"
  | "past_benchmark"
  | "failed"
  | "pending"
  | "not_started"
  | "holiday";

export type PipelineRowStatus =
  | "clean"
  | "watch"
  | "at_risk"
  | "broken"
  | "holiday"
  | "working";

export interface PipelineStage {
  name: PipelineStageName;
  status: PipelineStageStatus;
  /** related Qlik monitor IDs — for click-through to MonitorList */
  monitorIds: string[];
  /** short display ("24m 42s ago", "8m to cutoff", "06:16") */
  detail?: string;
}

export interface PipelineState {
  id: string;
  clientName: string;
  groupName: string;
  cadence: "Daily" | "Weekly" | "Monthly";
  region: "Lux" | "London" | "NY" | "Singapore";
  isMine: boolean;
  isHolidayToday: boolean;
  stages: PipelineStage[];
  /** worst stage state — drives the row-level pill */
  worstStatus: PipelineRowStatus;
  /** breach age minutes — for sort */
  worstAgeMin: number;
  /** "Actuals breached · 24m 42s ago" */
  summaryLine: string;
}

/* Fixtures — twelve pipelines spanning the four regions. Counts and
 * statuses align with the monitor fixtures so the two surfaces tell a
 * consistent story. In production these would come from Qlik's L2 endpoint. */

function cleanStages(): PipelineStage[] {
  return [
    { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:34" },
    { name: "Estimates", status: "complete", monitorIds: ["mon-01"], detail: "08:49" },
    { name: "Actuals", status: "complete", monitorIds: ["mon-02"], detail: "11:12" },
    { name: "Reporting", status: "complete", monitorIds: ["mon-10"], detail: "14:05" },
  ];
}

const CLEAN_PIPELINES: PipelineState[] = [
  {
    id: "pl-cohen-cap",
    clientName: "Cohen & Steers",
    groupName: "Capstock",
    cadence: "Daily",
    region: "Lux",
    isMine: true,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "All stages complete · last 14:05",
  },
  {
    id: "pl-ishares-nav",
    clientName: "iShares",
    groupName: "STT Daily NAV Rebalance",
    cadence: "Daily",
    region: "Lux",
    isMine: true,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "All stages complete · last 14:05",
  },
  {
    id: "pl-pimco-inc",
    clientName: "PIMCO",
    groupName: "Income Fund",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "All stages complete · last 14:05",
  },
  {
    id: "pl-vanguard-pl",
    clientName: "Vanguard",
    groupName: "Unrealized P&L",
    cadence: "Daily",
    region: "NY",
    isMine: true,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "All stages complete · last 14:05",
  },
];

const AT_RISK_PIPELINES: PipelineState[] = [
  {
    id: "pl-cohen-cap",
    clientName: "Cohen & Steers",
    groupName: "Capstock",
    cadence: "Daily",
    region: "Lux",
    isMine: true,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:34" },
      { name: "Estimates", status: "complete", monitorIds: ["mon-01"], detail: "08:49" },
      { name: "Actuals", status: "past_benchmark", monitorIds: ["mon-02"], detail: "24m 42s ago" },
      { name: "Reporting", status: "pending", monitorIds: ["mon-10"], detail: "2h 58m" },
    ],
    worstStatus: "at_risk",
    worstAgeMin: 25,
    summaryLine: "Actuals breached · 24m 42s ago",
  },
  {
    id: "pl-ishares-nav",
    clientName: "iShares",
    groupName: "STT Daily NAV Rebalance",
    cadence: "Daily",
    region: "Lux",
    isMine: true,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:24" },
      { name: "Estimates", status: "past_typical", monitorIds: ["mon-05", "mon-06"], detail: "6m 17s ago" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "4h 58m" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "6h 58m" },
    ],
    worstStatus: "at_risk",
    worstAgeMin: 6,
    summaryLine: "Estimates at risk · 6m 17s",
  },
  {
    id: "pl-jpm-liq",
    clientName: "JP Morgan AM",
    groupName: "Liquidity Fund",
    cadence: "Daily",
    region: "Singapore",
    isMine: false,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "06:48" },
      { name: "Estimates", status: "complete", monitorIds: ["mon-01"], detail: "08:11" },
      { name: "Actuals", status: "past_required", monitorIds: ["mon-08"], detail: "18m ago" },
      { name: "Reporting", status: "pending", monitorIds: ["mon-10"], detail: "4h 38m" },
    ],
    worstStatus: "at_risk",
    worstAgeMin: 18,
    summaryLine: "Actuals breached · 18m ago",
  },
  {
    id: "pl-pimco-inc",
    clientName: "PIMCO",
    groupName: "Income Fund",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "06:42" },
      { name: "Estimates", status: "in_progress", monitorIds: ["mon-05"], detail: "ETA 30m" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "3h 40m" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "6h 20m" },
    ],
    worstStatus: "watch",
    worstAgeMin: 0,
    summaryLine: "Estimates in progress · feed slow",
  },
  {
    id: "pl-fidelity-glb",
    clientName: "Fidelity",
    groupName: "Global Bond",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "06:25" },
      { name: "Estimates", status: "in_progress", monitorIds: ["mon-06"], detail: "ETA 27m" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "5h 18m" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "7h 22m" },
    ],
    worstStatus: "watch",
    worstAgeMin: 0,
    summaryLine: "Estimates in progress · snapshot stale",
  },
  {
    id: "pl-vanguard-pl",
    clientName: "Vanguard",
    groupName: "Unrealized P&L",
    cadence: "Daily",
    region: "NY",
    isMine: true,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "past_required", monitorIds: ["mon-07"], detail: "12m ago" },
      { name: "Estimates", status: "pending", monitorIds: [], detail: "2h" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "5h 20m" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "7h 40m" },
    ],
    worstStatus: "at_risk",
    worstAgeMin: 12,
    summaryLine: "Rebalance breached · 12m ago",
  },
  // On-track rows kept in list so the filter ratio reads sensibly
  {
    id: "pl-statestreet-gx",
    clientName: "State Street GA",
    groupName: "GX Multi-Asset",
    cadence: "Daily",
    region: "NY",
    isMine: true,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "On track · reporting due 16:00",
  },
  {
    id: "pl-blackrock-eq",
    clientName: "BlackRock",
    groupName: "Equity Index",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "On track · reporting due 16:00",
  },
  {
    id: "pl-amundi-lux",
    clientName: "Amundi",
    groupName: "Lux SICAV",
    cadence: "Daily",
    region: "Lux",
    isMine: false,
    isHolidayToday: true,
    stages: [
      { name: "Rebalance", status: "holiday", monitorIds: [], detail: "—" },
      { name: "Estimates", status: "holiday", monitorIds: [], detail: "—" },
      { name: "Actuals", status: "holiday", monitorIds: [], detail: "—" },
      { name: "Reporting", status: "holiday", monitorIds: [], detail: "—" },
    ],
    worstStatus: "holiday",
    worstAgeMin: 0,
    summaryLine: "Holiday — Luxembourg closed",
  },
  {
    id: "pl-schroders-mthly",
    clientName: "Schroders",
    groupName: "Monthly Dividend",
    cadence: "Monthly",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "Monthly cycle — not due today",
  },
  {
    id: "pl-dws-xtrackers",
    clientName: "DWS",
    groupName: "Xtrackers Lux",
    cadence: "Daily",
    region: "Lux",
    isMine: false,
    isHolidayToday: true,
    stages: [
      { name: "Rebalance", status: "holiday", monitorIds: [], detail: "—" },
      { name: "Estimates", status: "holiday", monitorIds: [], detail: "—" },
      { name: "Actuals", status: "holiday", monitorIds: [], detail: "—" },
      { name: "Reporting", status: "holiday", monitorIds: [], detail: "—" },
    ],
    worstStatus: "holiday",
    worstAgeMin: 0,
    summaryLine: "Holiday — Luxembourg closed",
  },
  {
    id: "pl-aviva-mmf",
    clientName: "Aviva Investors",
    groupName: "MMF Daily",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "On track",
  },
];

const BROKEN_PIPELINES: PipelineState[] = [
  {
    id: "pl-cohen-cap",
    clientName: "Cohen & Steers",
    groupName: "Capstock",
    cadence: "Daily",
    region: "Lux",
    isMine: true,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:34" },
      { name: "Estimates", status: "failed", monitorIds: ["mon-03"], detail: "1h 31m ago" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "blocked" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "blocked" },
    ],
    worstStatus: "broken",
    worstAgeMin: 91,
    summaryLine: "Estimates failed — NAV validation · 1h 31m",
  },
  {
    id: "pl-ishares-nav",
    clientName: "iShares",
    groupName: "STT Daily NAV Rebalance",
    cadence: "Daily",
    region: "Lux",
    isMine: true,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:24" },
      { name: "Estimates", status: "past_benchmark", monitorIds: ["mon-04"], detail: "1h 6m ago" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "blocked" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "blocked" },
    ],
    worstStatus: "broken",
    worstAgeMin: 66,
    summaryLine: "Manual override awaiting sign-off · 1h 6m",
  },
  {
    id: "pl-pimco-inc",
    clientName: "PIMCO",
    groupName: "Income Fund",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "06:42" },
      { name: "Estimates", status: "past_required", monitorIds: ["mon-15"], detail: "41m ago" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "blocked" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "blocked" },
    ],
    worstStatus: "at_risk",
    worstAgeMin: 41,
    summaryLine: "Estimates awaiting approval · 41m",
  },
  {
    id: "pl-vanguard-pl",
    clientName: "Vanguard",
    groupName: "Unrealized P&L",
    cadence: "Daily",
    region: "NY",
    isMine: true,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "past_required", monitorIds: ["mon-07"], detail: "12m ago" },
      { name: "Estimates", status: "pending", monitorIds: [], detail: "2h" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "5h 20m" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "7h 40m" },
    ],
    worstStatus: "at_risk",
    worstAgeMin: 12,
    summaryLine: "Rebalance feed delayed · 12m",
  },
  {
    id: "pl-jpm-liq",
    clientName: "JP Morgan AM",
    groupName: "Liquidity Fund",
    cadence: "Daily",
    region: "Singapore",
    isMine: false,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "06:48" },
      { name: "Estimates", status: "failed", monitorIds: ["mon-14"], detail: "31m ago" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "blocked" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "blocked" },
    ],
    worstStatus: "broken",
    worstAgeMin: 31,
    summaryLine: "Estimates failed — feed outage · 31m",
  },
  {
    id: "pl-fidelity-glb",
    clientName: "Fidelity",
    groupName: "Global Bond",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: [
      { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "06:25" },
      { name: "Estimates", status: "in_progress", monitorIds: ["mon-09"], detail: "ETA 22m" },
      { name: "Actuals", status: "not_started", monitorIds: [], detail: "5h 18m" },
      { name: "Reporting", status: "not_started", monitorIds: [], detail: "7h 22m" },
    ],
    worstStatus: "watch",
    worstAgeMin: 0,
    summaryLine: "Estimates approaching tolerance band",
  },
  {
    id: "pl-statestreet-gx",
    clientName: "State Street GA",
    groupName: "GX Multi-Asset",
    cadence: "Daily",
    region: "NY",
    isMine: true,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "On track",
  },
  {
    id: "pl-blackrock-eq",
    clientName: "BlackRock",
    groupName: "Equity Index",
    cadence: "Daily",
    region: "London",
    isMine: false,
    isHolidayToday: false,
    stages: cleanStages(),
    worstStatus: "clean",
    worstAgeMin: 0,
    summaryLine: "On track",
  },
];

/* Spec v0.1.2 §1.5 — watch fixture pipelines. Only past_typical breaches
 * present (no past_required, no past_benchmark). Drives the cream-tone L0
 * watch banner. */
const WATCH_PIPELINES: PipelineState[] = CLEAN_PIPELINES.map((p, i) => {
  if (i === 0) {
    return {
      ...p,
      stages: [
        { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:34" },
        { name: "Estimates", status: "past_typical", monitorIds: ["mon-05"], detail: "4m ago" },
        { name: "Actuals", status: "not_started", monitorIds: [], detail: "3h 12m" },
        { name: "Reporting", status: "not_started", monitorIds: [], detail: "6h 25m" },
      ],
      worstStatus: "watch",
      worstAgeMin: 4,
      summaryLine: "Estimates running slow · 4m past typical",
    };
  }
  if (i === 1) {
    return {
      ...p,
      stages: [
        { name: "Rebalance", status: "complete", monitorIds: ["mon-07"], detail: "07:24" },
        { name: "Estimates", status: "past_typical", monitorIds: ["mon-06"], detail: "8m ago" },
        { name: "Actuals", status: "not_started", monitorIds: [], detail: "4h 58m" },
        { name: "Reporting", status: "not_started", monitorIds: [], detail: "6h 58m" },
      ],
      worstStatus: "watch",
      worstAgeMin: 8,
      summaryLine: "Estimates running slow · 8m past typical",
    };
  }
  return p;
});

const PIPELINE_FIXTURES: Record<OperationalState, PipelineState[]> = {
  clean: CLEAN_PIPELINES,
  watch: WATCH_PIPELINES,
  "at-risk": AT_RISK_PIPELINES,
  broken: BROKEN_PIPELINES,
};

export function fetchPipelineStates(
  fixture: OperationalState,
): Promise<PipelineState[]> {
  return Promise.resolve(PIPELINE_FIXTURES[fixture]);
}

/* ==================================================================== *
 * Pipeline detail (drawer source) — richer per-pipeline data
 *
 * Not in v0.1 §1.1; in production this is a separate "pipeline detail"
 * endpoint that the list view pulls on demand. Shape is the boundary to
 * confirm with backend; field names should align with whatever the real
 * detail endpoint exposes.
 * ==================================================================== */

export type LifecycleStageName =
  | "Rebalance"
  | "Estimates"
  | "Trades"
  | "Actuals"
  | "NAV Strike"
  | "Reporting";

export const LIFECYCLE_STAGE_ORDER: LifecycleStageName[] = [
  "Rebalance",
  "Estimates",
  "Trades",
  "Actuals",
  "NAV Strike",
  "Reporting",
];

export type LifecycleStatus =
  | "complete"
  | "in_progress"
  | "now"
  | "pending"
  | "past_typical"
  | "past_required"
  | "past_benchmark"
  | "failed";

export interface LifecycleStage {
  name: LifecycleStageName;
  status: LifecycleStatus;
  time?: string; // "07:16" or "09:00"
  detail?: string; // "File expected 09:30, not received. Escalate by 11:00."
  monitorIds?: string[];
}

export interface MarketDependency {
  ccy: string; // "USD"
  market: string; // "New York"
  isOpen: boolean;
}

export interface UpcomingClosure {
  ccy: string;
  date: string; // "25 May"
  reason: string; // "Memorial Day"
  earlyClose?: boolean;
}

export interface PipelineNote {
  id: string;
  pipelineId: string;
  author: string;
  timestamp: string;
  body: string;
}

/* A Mandate is a CONTAINER for one or more processing groups. Each
 * processing group has its own cadence and lifecycle; the mandate-level
 * status is the worst-of across its groups. */
export interface ProcessingGroupSummary {
  id: string;
  name: string; // "Daily NAV Calc", "Subscriptions / Redemptions", etc.
  cadence: "Daily" | "Weekly" | "Monthly" | "Ad-hoc";
  status: PipelineState["worstStatus"];
  summaryLine: string; // "Actuals breached · 24m 42s ago"
  lifecycleStages: LifecycleStage[];
  affectedMonitorIds: string[];
  /** True when this PG is the one that drives the mandate-level worst status */
  isPrimary: boolean;
}

/* Spec — Account level (Qlik "NPV Projects" equivalent).
 * Each mandate has 1..N accounts; most have 1, large mandates (BlackRock,
 * iShares) have many. Listed in the drawer with status. */
export interface AccountSummary {
  id: string;
  name: string;
  status: PipelineState["worstStatus"];
}

export interface PipelineDetail {
  id: string;
  clientName: string;
  /** Mandate name — the contractual unit. Contains 1+ processing groups. */
  mandateName: string;
  /** Legacy alias — same value as mandateName, kept while other components migrate */
  groupName: string;
  cadence: "Daily" | "Weekly" | "Monthly";
  region: PipelineState["region"];
  isMine: boolean;
  worstStatus: PipelineState["worstStatus"];

  /** Section: owner / size / currency / cutoff (mandate-level) */
  owner: { id: string; initials: string; name: string };
  aum: number; // in USD (display as $X.XXB)
  baseCurrency: "USD" | "EUR" | "GBP" | "JPY";
  cutoffTime: string; // "16:00"
  cutoffCountdownMin: number;

  /** Section: processing groups within this mandate.
   *  Most mandates have 1; a few have 2-3 to demonstrate the grouping. */
  processingGroups: ProcessingGroupSummary[];

  /** Section: market dependencies + closures (mandate-level) */
  marketDependencies: MarketDependency[];
  upcomingClosures: UpcomingClosure[];

  /** Cross-ref to underlying monitors (drives Snooze degradation, rolled up
   *  from all processing groups). */
  affectedMonitorIds: string[];

  /** Account-level rollup within this mandate (Qlik "NPV Projects"). */
  accounts: AccountSummary[];
}

/* Static portion of detail keyed by pipeline id — owner / AUM / etc don't
 * change between fixture states. Lifecycle status DOES change by fixture
 * and is computed at fetch time. */

interface PipelineStaticDetail {
  owner: PipelineDetail["owner"];
  aum: number;
  baseCurrency: PipelineDetail["baseCurrency"];
  cutoffTime: string;
  cutoffCountdownMin: number;
  marketDependencies: MarketDependency[];
  upcomingClosures: UpcomingClosure[];
}

const STATIC_DETAILS: Record<string, PipelineStaticDetail> = {
  "pl-cohen-cap": {
    owner: { id: "Howard W", initials: "HW", name: "Howard W" },
    aum: 4.12e9,
    baseCurrency: "USD",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [
      { ccy: "USD", market: "New York", isOpen: true },
      { ccy: "EUR", market: "Luxembourg", isOpen: false },
      { ccy: "GBP", market: "London", isOpen: true },
    ],
    upcomingClosures: [
      { ccy: "USD", date: "25 May", reason: "Memorial Day" },
      { ccy: "EUR", date: "25 May", reason: "Whit Monday", earlyClose: true },
      { ccy: "GBP", date: "25 May", reason: "Spring Bank Holiday" },
    ],
  },
  "pl-ishares-nav": {
    owner: { id: "Sriram K", initials: "SK", name: "Sriram K" },
    aum: 18.7e9,
    baseCurrency: "EUR",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [
      { ccy: "EUR", market: "Luxembourg", isOpen: false },
      { ccy: "USD", market: "New York", isOpen: true },
    ],
    upcomingClosures: [
      { ccy: "EUR", date: "25 May", reason: "Whit Monday", earlyClose: true },
      { ccy: "USD", date: "25 May", reason: "Memorial Day" },
    ],
  },
  "pl-pimco-inc": {
    owner: { id: "Mary R", initials: "MR", name: "Mary R" },
    aum: 9.4e9,
    baseCurrency: "USD",
    cutoffTime: "16:30",
    cutoffCountdownMin: 428,
    marketDependencies: [
      { ccy: "USD", market: "New York", isOpen: true },
      { ccy: "GBP", market: "London", isOpen: true },
    ],
    upcomingClosures: [
      { ccy: "USD", date: "25 May", reason: "Memorial Day" },
      { ccy: "GBP", date: "25 May", reason: "Spring Bank Holiday" },
    ],
  },
  "pl-vanguard-pl": {
    owner: { id: "Jess T", initials: "JT", name: "Jess T" },
    aum: 7.1e9,
    baseCurrency: "USD",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [
      { ccy: "USD", market: "New York", isOpen: true },
    ],
    upcomingClosures: [{ ccy: "USD", date: "25 May", reason: "Memorial Day" }],
  },
  "pl-fidelity-glb": {
    owner: { id: "Dev O", initials: "DO", name: "Dev O" },
    aum: 5.6e9,
    baseCurrency: "GBP",
    cutoffTime: "12:30",
    cutoffCountdownMin: 158,
    marketDependencies: [
      { ccy: "GBP", market: "London", isOpen: true },
      { ccy: "USD", market: "New York", isOpen: true },
    ],
    upcomingClosures: [
      { ccy: "GBP", date: "25 May", reason: "Spring Bank Holiday" },
    ],
  },
  "pl-jpm-liq": {
    owner: { id: "Howard W", initials: "HW", name: "Howard W" },
    aum: 12.3e9,
    baseCurrency: "USD",
    cutoffTime: "17:00",
    cutoffCountdownMin: 458,
    marketDependencies: [
      { ccy: "USD", market: "New York", isOpen: true },
      { ccy: "JPY", market: "Tokyo", isOpen: false },
    ],
    upcomingClosures: [{ ccy: "USD", date: "25 May", reason: "Memorial Day" }],
  },
  "pl-statestreet-gx": {
    owner: { id: "Mark D", initials: "MD", name: "Mark D" },
    aum: 22.1e9,
    baseCurrency: "USD",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [
      { ccy: "USD", market: "New York", isOpen: true },
      { ccy: "EUR", market: "Luxembourg", isOpen: false },
    ],
    upcomingClosures: [],
  },
  "pl-blackrock-eq": {
    owner: { id: "Sriram K", initials: "SK", name: "Sriram K" },
    aum: 34.8e9,
    baseCurrency: "GBP",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [
      { ccy: "GBP", market: "London", isOpen: true },
      { ccy: "USD", market: "New York", isOpen: true },
    ],
    upcomingClosures: [{ ccy: "GBP", date: "25 May", reason: "Spring Bank Holiday" }],
  },
  "pl-amundi-lux": {
    owner: { id: "Mary R", initials: "MR", name: "Mary R" },
    aum: 8.9e9,
    baseCurrency: "EUR",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [{ ccy: "EUR", market: "Luxembourg", isOpen: false }],
    upcomingClosures: [
      { ccy: "EUR", date: "25 May", reason: "Whit Monday", earlyClose: true },
    ],
  },
  "pl-schroders-mthly": {
    owner: { id: "Dev O", initials: "DO", name: "Dev O" },
    aum: 3.4e9,
    baseCurrency: "GBP",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [{ ccy: "GBP", market: "London", isOpen: true }],
    upcomingClosures: [{ ccy: "GBP", date: "25 May", reason: "Spring Bank Holiday" }],
  },
  "pl-dws-xtrackers": {
    owner: { id: "Jess T", initials: "JT", name: "Jess T" },
    aum: 6.2e9,
    baseCurrency: "EUR",
    cutoffTime: "16:00",
    cutoffCountdownMin: 398,
    marketDependencies: [{ ccy: "EUR", market: "Luxembourg", isOpen: false }],
    upcomingClosures: [
      { ccy: "EUR", date: "25 May", reason: "Whit Monday", earlyClose: true },
    ],
  },
  "pl-aviva-mmf": {
    owner: { id: "Mark D", initials: "MD", name: "Mark D" },
    aum: 2.8e9,
    baseCurrency: "GBP",
    cutoffTime: "12:30",
    cutoffCountdownMin: 158,
    marketDependencies: [{ ccy: "GBP", market: "London", isOpen: true }],
    upcomingClosures: [{ ccy: "GBP", date: "25 May", reason: "Spring Bank Holiday" }],
  },
};

/* Derive 6-stage lifecycle from the 4 base PipelineState stages.
 * Trades follows Estimates; NAV Strike follows Actuals. */
function lifecycleFromPipeline(p: PipelineState): LifecycleStage[] {
  const base = new Map(p.stages.map((s) => [s.name, s]));
  const rebal = base.get("Rebalance");
  const est = base.get("Estimates");
  const act = base.get("Actuals");
  const rep = base.get("Reporting");

  const mapStatus = (
    s: PipelineState["stages"][number] | undefined,
  ): LifecycleStatus => {
    if (!s) return "pending";
    switch (s.status) {
      case "complete":
        return "complete";
      case "in_progress":
        return "in_progress";
      case "past_typical":
        return "past_typical";
      case "past_required":
        return "past_required";
      case "past_benchmark":
        return "past_benchmark";
      case "failed":
        return "failed";
      case "pending":
      case "not_started":
      case "holiday":
        return "pending";
    }
  };

  // For Trades, mirror Estimates status (Trades is a downstream consequence).
  // For NAV Strike, mirror Actuals downstream.
  const stages: LifecycleStage[] = [
    {
      name: "Rebalance",
      status: mapStatus(rebal),
      time: rebal?.detail,
      monitorIds: rebal?.monitorIds ?? [],
    },
    {
      name: "Estimates",
      status: mapStatus(est),
      time: est?.detail,
      monitorIds: est?.monitorIds ?? [],
    },
    {
      name: "Trades",
      // Trades is complete if Estimates was complete; otherwise pending.
      status: est?.status === "complete" ? "complete" : "pending",
      time: est?.status === "complete" ? "08:55" : undefined,
      monitorIds: [],
    },
    {
      name: "Actuals",
      status: mapStatus(act),
      time: act?.detail,
      detail:
        isBreachedTier(act?.status) || act?.status === "failed"
          ? "File expected 09:30, not received. Escalate by 11:00."
          : undefined,
      monitorIds: act?.monitorIds ?? [],
    },
    {
      name: "NAV Strike",
      status: act?.status === "complete" ? "complete" : "pending",
      time: act?.status === "complete" ? "13:00" : "13:00",
      monitorIds: [],
    },
    {
      name: "Reporting",
      status: mapStatus(rep),
      time: rep?.detail ?? "16:00",
      monitorIds: rep?.monitorIds ?? [],
    },
  ];

  // Mark the most recent non-complete stage as "now" so it gets highlighted.
  // Any breach tier or in_progress counts.
  const nowIdx = stages.findIndex(
    (s) =>
      s.status === "past_typical" ||
      s.status === "past_required" ||
      s.status === "past_benchmark" ||
      s.status === "failed" ||
      s.status === "in_progress",
  );
  if (nowIdx >= 0) {
    // keep its status (breached/failed) and additionally tag as "now"; we
    // surface this via a flag in the renderer rather than overwriting.
  }
  return stages;
}

/* Extra processing groups for selected mandates — demonstrates the
 * Mandate-as-container model. In production, this comes from the same
 * detail endpoint; mocked statically here. */
function makeCleanLifecycle(times: Partial<Record<LifecycleStageName, string>> = {}): LifecycleStage[] {
  const defaults: Record<LifecycleStageName, string> = {
    Rebalance: "07:34",
    Estimates: "08:49",
    Trades: "08:55",
    Actuals: "11:12",
    "NAV Strike": "13:00",
    Reporting: "15:45",
  };
  return LIFECYCLE_STAGE_ORDER.map((name) => ({
    name,
    status: "complete" as const,
    time: times[name] ?? defaults[name],
    monitorIds: [],
  }));
}

const EXTRA_PROCESSING_GROUPS: Record<string, ProcessingGroupSummary[]> = {
  "pl-cohen-cap": [
    {
      id: "pg-cohen-cap-subs",
      name: "Subscriptions / Redemptions",
      cadence: "Daily",
      status: "clean",
      summaryLine: "On track · last 11:12",
      lifecycleStages: makeCleanLifecycle(),
      affectedMonitorIds: [],
      isPrimary: false,
    },
    {
      id: "pg-cohen-cap-eur-hedge",
      name: "EUR Hedge Sleeve",
      cadence: "Weekly",
      status: "clean",
      summaryLine: "Weekly cycle · next run Mon 09:00",
      lifecycleStages: makeCleanLifecycle({
        Rebalance: "Mon 09:00",
        Estimates: "—",
        Trades: "—",
        Actuals: "—",
        "NAV Strike": "—",
        Reporting: "—",
      }),
      affectedMonitorIds: [],
      isPrimary: false,
    },
  ],
  "pl-ishares-nav": [
    {
      id: "pg-ishares-nav-capstock",
      name: "Cap Stock Activity",
      cadence: "Daily",
      status: "clean",
      summaryLine: "On track · last 10:48",
      lifecycleStages: makeCleanLifecycle({ Actuals: "10:48" }),
      affectedMonitorIds: [],
      isPrimary: false,
    },
  ],
  "pl-jpm-liq": [
    {
      id: "pg-jpm-liq-overdraft",
      name: "Overdraft Sweep",
      cadence: "Daily",
      status: "clean",
      summaryLine: "On track · last 09:31",
      lifecycleStages: makeCleanLifecycle({ Actuals: "09:31" }),
      affectedMonitorIds: [],
      isPrimary: false,
    },
  ],
};

/* Static account roster per mandate. Most mandates have 1; large clients
 * (BlackRock, iShares, JPM) have multiple. Account status is derived from
 * the mandate's worstStatus in fetchPipelineDetail — for the prototype the
 * first account inherits the mandate status; others stay clean unless
 * named below. */
const STATIC_ACCOUNTS: Record<string, { name: string; nonCleanIdx?: number[] }[]> = {
  "pl-cohen-cap": [
    { name: "Cohen & Steers Capstock — A47" },
    { name: "Cohen & Steers Capstock — A48" },
    { name: "Cohen & Steers Capstock — B12" },
  ],
  "pl-ishares-nav": [
    { name: "iShares STT NAV — Account 001" },
    { name: "iShares STT NAV — Account 015" },
    { name: "iShares STT NAV — Account 042" },
    { name: "iShares STT NAV — Account 088" },
    { name: "iShares STT NAV — Account 124" },
  ],
  "pl-pimco-inc": [{ name: "PIMCO Income — Master" }],
  "pl-vanguard-pl": [{ name: "Vanguard Unrealized P&L — Master" }],
  "pl-fidelity-glb": [
    { name: "Fidelity Global Bond — Master" },
    { name: "Fidelity Global Bond — EMEA Sleeve" },
  ],
  "pl-jpm-liq": [
    { name: "JPM Liquidity — APAC" },
    { name: "JPM Liquidity — US" },
  ],
  "pl-statestreet-gx": [{ name: "GX Multi-Asset — Master" }],
  "pl-blackrock-eq": [
    { name: "BlackRock Equity Index — A001" },
    { name: "BlackRock Equity Index — A002" },
    { name: "BlackRock Equity Index — A003" },
    { name: "BlackRock Equity Index — A004" },
  ],
  "pl-amundi-lux": [{ name: "Amundi Lux SICAV — Master" }],
  "pl-schroders-mthly": [{ name: "Schroders Monthly Dividend" }],
  "pl-dws-xtrackers": [{ name: "DWS Xtrackers — Master" }],
  "pl-aviva-mmf": [{ name: "Aviva MMF — Master" }],
};

/* The "primary" PG name — the one driving the mandate-level status. Falls
 * back to a sensible default if not configured. */
const PRIMARY_PG_NAMES: Record<string, string> = {
  "pl-cohen-cap": "Daily NAV Calc",
  "pl-ishares-nav": "Daily NAV Strike",
  "pl-pimco-inc": "Daily NAV Calc",
  "pl-vanguard-pl": "Unrealized P&L Calc",
  "pl-fidelity-glb": "Daily NAV Calc",
  "pl-jpm-liq": "Liquidity Actuals",
  "pl-statestreet-gx": "Multi-Asset Rebalance",
  "pl-blackrock-eq": "Equity Index NAV",
  "pl-amundi-lux": "Lux SICAV NAV",
  "pl-schroders-mthly": "Monthly Dividend Run",
  "pl-dws-xtrackers": "Xtrackers NAV",
  "pl-aviva-mmf": "MMF Daily NAV",
};

function primarySummaryLine(pipeline: PipelineState): string {
  return pipeline.summaryLine;
}

export function fetchPipelineDetail(
  fixture: OperationalState,
  pipelineId: string,
): Promise<PipelineDetail | null> {
  const pipeline = PIPELINE_FIXTURES[fixture].find((p) => p.id === pipelineId);
  if (!pipeline) return Promise.resolve(null);
  const stat = STATIC_DETAILS[pipelineId];
  if (!stat) return Promise.resolve(null);

  const lifecycle = lifecycleFromPipeline(pipeline);
  const primaryAffected = new Set<string>();
  for (const s of pipeline.stages) {
    if (isBreachedTier(s.status) || s.status === "failed") {
      for (const id of s.monitorIds) primaryAffected.add(id);
    }
  }

  // Primary processing group: derived from the pipeline's own stages.
  const primaryPG: ProcessingGroupSummary = {
    id: `${pipeline.id}-primary`,
    name: PRIMARY_PG_NAMES[pipeline.id] ?? pipeline.groupName,
    cadence: pipeline.cadence,
    status: pipeline.worstStatus,
    summaryLine: primarySummaryLine(pipeline),
    lifecycleStages: lifecycle,
    affectedMonitorIds: Array.from(primaryAffected),
    isPrimary: true,
  };

  // Plus any extra PGs configured for this mandate.
  const extras = EXTRA_PROCESSING_GROUPS[pipeline.id] ?? [];

  const allPGs = [primaryPG, ...extras];
  const allAffected = new Set<string>();
  for (const pg of allPGs) {
    for (const id of pg.affectedMonitorIds) allAffected.add(id);
  }

  // Account-level rollup. First account inherits mandate worstStatus
  // (it's the one driving the alert); others stay clean.
  const accountConfigs = STATIC_ACCOUNTS[pipeline.id] ?? [];
  const accounts: AccountSummary[] = accountConfigs.map((cfg, i) => ({
    id: `${pipeline.id}-acct-${i + 1}`,
    name: cfg.name,
    status: i === 0 ? pipeline.worstStatus : "clean",
  }));

  return Promise.resolve({
    id: pipeline.id,
    clientName: pipeline.clientName,
    mandateName: pipeline.groupName,
    groupName: pipeline.groupName, // legacy alias
    cadence: pipeline.cadence,
    region: pipeline.region,
    isMine: pipeline.isMine,
    worstStatus: pipeline.worstStatus,
    ...stat,
    processingGroups: allPGs,
    affectedMonitorIds: Array.from(allAffected),
    accounts,
  });
}

/* ==================================================================== *
 * Pipeline notes store — separate from monitor action log
 * Pipeline-scoped: persists across monitor refreshes, independent of any
 * single monitor's lifecycle. Same useSyncExternalStore pattern.
 * ==================================================================== */

interface PipelineNotesRepo {
  snapshot(): PipelineNote[];
  add(pipelineId: string, author: string, body: string): Promise<PipelineNote>;
  subscribe(fn: () => void): () => void;
}

class InMemoryNotesRepo implements PipelineNotesRepo {
  private notes: PipelineNote[] = [];
  private subscribers = new Set<() => void>();
  private seq = 0;

  snapshot() {
    return this.notes;
  }

  async add(pipelineId: string, author: string, body: string) {
    const note: PipelineNote = {
      id: `note-${++this.seq}`,
      pipelineId,
      author,
      timestamp: new Date().toISOString(),
      body,
    };
    await new Promise((r) => setTimeout(r, 80));
    this.notes = [...this.notes, note];
    this.emit();
    return note;
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.subscribers) fn();
  }
}

export const pipelineNotesRepo: PipelineNotesRepo = new InMemoryNotesRepo();

// Seed one note on Cohen & Steers so the drawer demonstrates non-empty state.
void pipelineNotesRepo.add(
  "pl-cohen-cap",
  "Howard W",
  "Pune team chasing the actuals feed — Mary on it.",
);

export function usePipelineNotes(pipelineId: string): PipelineNote[] {
  const all = useSyncExternalStore(
    (cb) => pipelineNotesRepo.subscribe(cb),
    () => pipelineNotesRepo.snapshot(),
    () => [],
  );
  return all.filter((n) => n.pipelineId === pipelineId);
}
