/* Three-tier severity logic — spec v0.1.2 §1.
 *
 *   typical    cream    "watch this"          slower than normal pace
 *   required   amber    "act now"             past internal SLA
 *   benchmark  red      "page the boss"       past contractual benchmark
 *
 * Tiers are derived from breach age vs per-stage thresholds. The thresholds
 * are sourced from config/the monitor source — never hardcoded in
 * components (spec §6, hard rule 20).
 *
 * For this prototype we keep thresholds in a single config map below; in
 * production this comes from the backend per-mandate config.
 */

import type {
  PipelineStageName,
  PipelineStageStatus,
  PipelineState,
} from "./qlik";

export type BreachTier = "typical" | "required" | "benchmark";

/** Per-stage breach thresholds, in minutes since the stage's nominal time.
 *  Spec hard rule 20: this map stands in for backend config; do not
 *  reference its values from components. */
export interface BreachThresholds {
  typical: number;
  required: number;
  benchmark: number;
}

const DEFAULT_THRESHOLDS: BreachThresholds = {
  typical: 5,
  required: 20,
  benchmark: 45,
};

/* Per-stage override map. Real impl reads this from the mandate config. */
const STAGE_THRESHOLDS: Partial<Record<PipelineStageName, BreachThresholds>> = {
  // Rebalance is the most time-sensitive — feeds downstream stages.
  Rebalance: { typical: 3, required: 12, benchmark: 30 },
  Estimates: { typical: 5, required: 20, benchmark: 45 },
  Actuals: { typical: 5, required: 25, benchmark: 60 },
  Reporting: { typical: 10, required: 30, benchmark: 90 },
};

export function thresholdsForStage(stage: PipelineStageName): BreachThresholds {
  return STAGE_THRESHOLDS[stage] ?? DEFAULT_THRESHOLDS;
}

/** Derive the tier a given breach age falls into. */
export function tierForBreach(
  stage: PipelineStageName,
  breachAgeMin: number,
): BreachTier {
  const t = thresholdsForStage(stage);
  if (breachAgeMin >= t.benchmark) return "benchmark";
  if (breachAgeMin >= t.required) return "required";
  return "typical";
}

/** Map a stage status to its breach tier, when the status is a breach. */
export function tierForStageStatus(
  status: PipelineStageStatus,
): BreachTier | null {
  switch (status) {
    case "past_typical":
      return "typical";
    case "past_required":
      return "required";
    case "past_benchmark":
    case "failed":
      return "benchmark";
    default:
      return null;
  }
}

/** Worst tier present across a row's stages, or null if none breached. */
export function worstTierInPipeline(p: PipelineState): BreachTier | null {
  let worst: BreachTier | null = null;
  for (const stage of p.stages) {
    const tier = tierForStageStatus(stage.status);
    if (tier === "benchmark") return "benchmark";
    if (tier === "required") worst = "required";
    else if (tier === "typical" && worst === null) worst = "typical";
  }
  return worst;
}

/** Count of breached stages in a row, regardless of tier. */
export function breachCountInPipeline(p: PipelineState): number {
  return p.stages.filter((s) => tierForStageStatus(s.status) !== null).length;
}

/** Numeric weight for sort comparisons. Higher = worse. */
export function tierWeight(tier: BreachTier | null): number {
  switch (tier) {
    case "benchmark":
      return 3;
    case "required":
      return 2;
    case "typical":
      return 1;
    default:
      return 0;
  }
}
