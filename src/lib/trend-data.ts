import { classifyAnomaly, type AnomalyState } from "./anomaly-detection";

/* Trend-data layer for the Stage Trend Strip (spec §3).
 *
 * Per-stage, per-day breach counts over a rolling window. Mocked here;
 * in production this comes from the same action-store aggregation that
 * powers monitor history, with one row per (stage, trading day, count).
 *
 * Hard rule (spec §3.1): breach count is UNIQUE monitors that breached
 * that day. A monitor that flapped 5 times counts as 1.
 *
 * Hard rule (spec §11.2): holidays excluded from the window. 14d means
 * 14 trading days, not 14 calendar days.
 */

export type StageName = "Rebalance" | "Estimates" | "Actuals" | "Reporting";

export const STAGE_NAMES: StageName[] = [
  "Rebalance",
  "Estimates",
  "Actuals",
  "Reporting",
];

export interface DailyCount {
  /** YYYY-MM-DD */
  date: string;
  count: number;
  isToday: boolean;
  /** True if today is mid-day and may still climb. */
  isPartial: boolean;
}

export interface StageTrendData {
  stage: StageName;
  windowDays: number;
  dailyCounts: DailyCount[];
  todayCount: number;
  rollingAverage: number;
  anomaly: AnomalyState;
}

export type WindowDays = 7 | 14 | 30 | 90;

/* 90 days of mock history per stage, oldest first. Today is the LAST
 * element of each array — the prototype's three fixtures (clean / at-risk
 * / broken) determine what today's value is by mixing into this baseline.
 */
const BASE_90D: Record<StageName, number[]> = {
  Rebalance: [
    0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 1, 0, 1, 0, 0,
    0, 0, 1, 0, 3, 1, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0,
    0, 0, 1, 2, 0, 0, 1, 0, 0, 1, 0, 1, 0, 2, 1, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0,
    1, 0, 0, 2, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0,
  ],
  Estimates: [
    0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0,
  ],
  Actuals: [
    1, 2, 0, 1, 2, 1, 1, 2, 1, 0, 1, 1, 2, 1, 2, 0, 1, 2, 1, 2, 1, 1, 2, 1, 1,
    2, 1, 0, 1, 1, 3, 1, 2, 1, 0, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 0, 1, 1, 1,
    2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 0, 1, 1, 2, 1, 2, 1, 1, 0, 1, 2, 1, 2, 1, 1,
    2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1,
  ],
  Reporting: new Array(90).fill(0),
};

/** Override today's count to reflect the fixture state currently shown. */
const FIXTURE_TODAY: Record<"clean" | "at-risk" | "broken", Record<StageName, number>> = {
  clean: { Rebalance: 0, Estimates: 0, Actuals: 0, Reporting: 0 },
  // Matches what MandateGrid shows in the at-risk fixture (Vanguard
  // Rebalance, iShares Estimates, Cohen Actuals + JPM Actuals, Reporting 0).
  "at-risk": { Rebalance: 1, Estimates: 1, Actuals: 2, Reporting: 0 },
  broken: { Rebalance: 1, Estimates: 1, Actuals: 2, Reporting: 0 },
};

const TRADING_DAY_MS = 24 * 60 * 60 * 1000;

function dateNDaysAgo(n: number): string {
  // Spec §11.2: holidays should be excluded. For the prototype we skip
  // weekends but keep all weekdays — close enough for the demo. A real
  // implementation pulls from the market calendar.
  let d = new Date();
  let stepped = 0;
  while (stepped < n) {
    d = new Date(d.getTime() - TRADING_DAY_MS);
    const day = d.getDay();
    if (day !== 0 && day !== 6) stepped += 1;
  }
  return d.toISOString().slice(0, 10);
}

export function getStageTrends(
  windowDays: WindowDays,
  fixtureKey: "clean" | "at-risk" | "broken",
  partial: boolean = true,
): StageTrendData[] {
  return STAGE_NAMES.map((stage) => {
    const baseline = BASE_90D[stage];
    const slice = baseline.slice(-windowDays).slice();
    // Replace today (last element) with the fixture-specific count.
    slice[slice.length - 1] = FIXTURE_TODAY[fixtureKey][stage];

    const dailyCounts: DailyCount[] = slice.map((count, i) => ({
      date: dateNDaysAgo(windowDays - 1 - i),
      count,
      isToday: i === slice.length - 1,
      isPartial: i === slice.length - 1 && partial,
    }));

    const todayCount = slice[slice.length - 1];
    const historical = slice.slice(0, -1);
    const rollingAverage =
      historical.length > 0
        ? historical.reduce((a, b) => a + b, 0) / historical.length
        : 0;
    const anomaly = classifyAnomaly(todayCount, historical);

    return {
      stage,
      windowDays,
      dailyCounts,
      todayCount,
      rollingAverage,
      anomaly,
    };
  });
}
