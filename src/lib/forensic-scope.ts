/* Forensic scope — spec v0.1.2 L4 §3.4.
 *
 * A ForensicScope captures everything the bottom sheet needs to know
 * about WHY it was opened. It travels from the chevron click (in the L3
 * mandate detail panel) through the sheet to the data fetcher.
 *
 * Hard rule (spec §7, rule 26): scope follows the click path. The sheet
 * never broadens its query beyond what the click implied. */

import type { LifecycleStage, PipelineDetail } from "./qlik";

export interface ForensicScope {
  /** Pipeline / mandate id (e.g. "pl-ishares-nav"). */
  mandateId: string;
  /** Client name for the sheet header ("iShares"). */
  clientName: string;
  /** Mandate display name ("STT Daily NAV Rebalance"). */
  mandateName: string;
  /** The lifecycle stage that drove the breach ("Estimates"). */
  stageName: string;
  /** Short human label of the breach for the header subtitle. */
  breachLabel: string;
  /** ISO timestamp of the most recent L4 data fetch attempt. */
  scopedAt: string;
}

/** Build a scope from a chevron click on a failed/breached lifecycle row. */
export function scopeFromLifecycleStage(
  detail: PipelineDetail,
  stage: LifecycleStage,
): ForensicScope {
  return {
    mandateId: detail.id,
    clientName: detail.clientName,
    mandateName: detail.mandateName,
    stageName: stage.name,
    breachLabel: breachLabelFor(stage),
    scopedAt: new Date().toISOString(),
  };
}

function breachLabelFor(stage: LifecycleStage): string {
  switch (stage.status) {
    case "failed":
      return `${stage.name} failed`;
    case "past_benchmark":
      return `${stage.name} past benchmark`;
    case "past_required":
      return `${stage.name} past required`;
    case "past_typical":
      return `${stage.name} past typical`;
    case "in_progress":
      return `${stage.name} running`;
    default:
      return stage.name;
  }
}

/** A lifecycle stage qualifies for L4 drill-in only if it carries evidence
 *  worth investigating — i.e. it's a breach or a failure. */
export function isForensicTrigger(stage: LifecycleStage): boolean {
  return (
    stage.status === "failed" ||
    stage.status === "past_benchmark" ||
    stage.status === "past_required" ||
    stage.status === "past_typical"
  );
}

/** Pipeline-level scope (no specific stage clicked). Used when the user
 *  opens L4 from a Mandate Grid row or a Pipeline Row — surfaces that
 *  don't break the mandate down by stage. Picks the worst stage if any
 *  is breached, otherwise the most recently active one. */
export function scopeFromPipeline(p: {
  id: string;
  clientName: string;
  groupName: string;
  stages: { name: string; status: string }[];
}): ForensicScope {
  // Severity weight: lower = worse. Unknown statuses (pending,
  // not_started, holiday) fall through to LAST so they're never picked
  // over a real signal.
  const weight: Record<string, number> = {
    failed: 0,
    past_benchmark: 1,
    past_required: 2,
    past_typical: 3,
    in_progress: 4,
    complete: 5,
  };
  const rank = (s: string) => weight[s] ?? 99;
  const ranked = [...p.stages].sort((a, b) => rank(a.status) - rank(b.status));
  const chosen = ranked[0] ?? p.stages[0];
  const stageName = chosen?.name ?? "Pipeline";
  const breachLabel =
    chosen?.status === "failed"
      ? `${stageName} failed`
      : chosen?.status === "past_benchmark"
        ? `${stageName} past benchmark`
        : chosen?.status === "past_required"
          ? `${stageName} past required`
          : chosen?.status === "past_typical"
            ? `${stageName} past typical`
            : chosen?.status === "in_progress"
              ? `${stageName} running`
              : `${stageName} on track`;
  return {
    mandateId: p.id,
    clientName: p.clientName,
    mandateName: p.groupName,
    stageName,
    breachLabel,
    scopedAt: new Date().toISOString(),
  };
}
