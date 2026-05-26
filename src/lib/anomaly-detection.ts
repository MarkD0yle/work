/* Anomaly classification for the Stage Trend Strip (spec §4).
 *
 * Pure σ-from-mean comparison — NOT ML anomaly detection. The thresholds
 * are chosen for human readability, not statistical rigour:
 *   |σ| < 1.0  → flat
 *   1.0 ≤ |σ| < 2.0 → elevated
 *   |σ| ≥ 2.0  → significant
 *
 * Hard rule (spec §11.4): if fewer than 7 historical points are
 * available, suppress the anomaly indicator entirely. Better silence
 * than false signal.
 */

export type AnomalyDirection = "above" | "below" | "flat";
export type AnomalyMagnitude = "normal" | "elevated" | "significant";

export interface AnomalyState {
  direction: AnomalyDirection;
  magnitude: AnomalyMagnitude;
  sigmaFromMean: number; // signed; positive = above
  /** True when there isn't enough history to classify reliably. */
  insufficient: boolean;
}

const MIN_HISTORY_DAYS = 7;

/**
 * Classify today's count against the rolling history (which excludes today).
 *
 * historicalCounts: counts from prior days, oldest-first, today NOT included.
 */
export function classifyAnomaly(
  todayCount: number,
  historicalCounts: number[],
): AnomalyState {
  if (historicalCounts.length < MIN_HISTORY_DAYS) {
    return {
      direction: "flat",
      magnitude: "normal",
      sigmaFromMean: 0,
      insufficient: true,
    };
  }

  const n = historicalCounts.length;
  const mu = historicalCounts.reduce((a, b) => a + b, 0) / n;
  const variance =
    historicalCounts.reduce((s, x) => s + (x - mu) * (x - mu), 0) / n;
  const sigma = Math.sqrt(variance);

  // Zero-variance edge case — every prior day had the same count.
  // Any deviation is significant; absent deviation is flat.
  if (sigma === 0) {
    if (todayCount === mu) {
      return {
        direction: "flat",
        magnitude: "normal",
        sigmaFromMean: 0,
        insufficient: false,
      };
    }
    return {
      direction: todayCount > mu ? "above" : "below",
      magnitude: "significant",
      sigmaFromMean: todayCount > mu ? 3 : -3,
      insufficient: false,
    };
  }

  const z = (todayCount - mu) / sigma;
  const abs = Math.abs(z);

  if (abs < 1.0) {
    return {
      direction: "flat",
      magnitude: "normal",
      sigmaFromMean: z,
      insufficient: false,
    };
  }
  if (abs < 2.0) {
    return {
      direction: z > 0 ? "above" : "below",
      magnitude: "elevated",
      sigmaFromMean: z,
      insufficient: false,
    };
  }
  return {
    direction: z > 0 ? "above" : "below",
    magnitude: "significant",
    sigmaFromMean: z,
    insufficient: false,
  };
}
