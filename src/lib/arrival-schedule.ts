/* ------------------------------------------------------------------ *
 * Arrival scheduler
 *
 * Reframes "late" from a raw clock comparison into:
 *
 *     severity = lateness − explanation
 *
 * A file is only ever RED ("late, unexpected") when it is past its deadline
 * AND nothing explains the lateness. An explanation is either a calendar
 * fact (the source market is shut, or a dependency closure shifted the
 * deadline) or a human action (acknowledged / snoozed / marked-as-holiday).
 * Either one demotes red → gray ("expected absence").
 *
 * The four states this produces:
 *   on_time            arrived within tolerance, or not yet due
 *   at_risk            approaching the deadline, not yet arrived (predictive)
 *   late_unexpected    past deadline, no explanation — the real alert (red)
 *   expected_absence   "late" by the clock but explained — suppressed (gray)
 * ------------------------------------------------------------------ */

import {
  CURRENCY_SETTLEMENT_CALENDAR,
  REGION_CALENDAR,
  closureOn,
  earlyCloseOn,
  isMarketClosed,
  nextOpenDay,
} from "./calendars";
import type { PipelineState } from "./qlik";
import type { BreachTier } from "./severity-tiers";

type Region = PipelineState["region"];
type Currency = "USD" | "EUR" | "GBP" | "JPY";

export type Cadence = "daily" | "weekly" | "monthly" | "adhoc";

export interface ArrivalTolerance {
  /** drift that's informational only (cream) */
  typicalMin: number;
  /** past internal SLA (amber) */
  requiredMin: number;
  /** past contractual benchmark (red) */
  benchmarkMin: number;
}

export interface ArrivalContract {
  /** how often the feed is expected */
  cadence: Cadence;
  /** weekly: 1=Mon..5=Fri; monthly: nth business day of month. Ignored for daily/adhoc. */
  schedule?: { weekday?: number; nthBusinessDay?: number };
  /** local clock time the file is due, "HH:MM" (e.g. "11:15") */
  expectedTime: string;
  /** region whose exchange calendar decides whether the feed runs at all */
  region: Region;
  /** currency whose settlement calendar can shift the deadline */
  currency: Currency;
  tolerance: ArrivalTolerance;
}

/* Human overrides, normally derived from the monitor action log. Kept as a
 * plain value so the classifier stays pure and testable. */
export type ArrivalOverride =
  | { kind: "none" }
  | { kind: "holiday"; actor: string }
  | { kind: "snooze"; untilMin: number; actor: string }
  | { kind: "acknowledged"; actor: string };

export type ArrivalState =
  | "on_time"
  | "at_risk"
  | "late_unexpected"
  | "expected_absence";

export type ArrivalReason =
  | "on-time"
  | "not-yet-due"
  | "due-soon"
  | "not-scheduled" // cadence says today isn't a run day
  | "adhoc" // no schedule — can never be late
  | "source-holiday" // source market closed
  | "dependency-closed" // settlement closure shifted the deadline
  | "marked-holiday" // human marked it
  | "snoozed"
  | "acknowledged"
  | "late";

export interface DueResolution {
  /** is the feed expected on this business date at all? */
  due: boolean;
  /** resolved deadline in minutes-since-local-midnight (only when due) */
  dueAtMin?: number;
  /** resolved deadline as "HH:MM" (only when due) */
  dueAt?: string;
  /** the business date the deadline lands on — shifts on dependency closure */
  dueDate?: string;
  /** true when a dependency closure moved the deadline off the source date */
  shifted: boolean;
  /** why the feed is not due, when due === false */
  notDueReason?: Extract<ArrivalReason, "not-scheduled" | "adhoc" | "source-holiday">;
}

export interface ArrivalAssessment {
  state: ArrivalState;
  reason: ArrivalReason;
  /** present when state === "late_unexpected" — which breach tier */
  tier?: BreachTier;
  /** true when a calendar fact or human action suppressed escalation */
  explained: boolean;
  /** minutes past the deadline (positive = late), when computable */
  minutesLate?: number;
  due: DueResolution;
  /** short human label for the UI, e.g. "Due 11:15 · 22m late" */
  label: string;
}

/* ------------------------------------------------------------------ */

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function weekdayOf(date: string): number {
  // 1=Mon .. 7=Sun
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Build a default contract from a pipeline's region/cadence/currency. */
export function contractFromPipeline(
  p: Pick<PipelineState, "region" | "cadence">,
  currency: Currency,
  expectedTime: string,
  tolerance: ArrivalTolerance = DEFAULT_TOLERANCE,
): ArrivalContract {
  const cadence: Cadence =
    p.cadence === "Daily" ? "daily" : p.cadence === "Weekly" ? "weekly" : "monthly";
  return { cadence, expectedTime, region: p.region, currency, tolerance };
}

export const DEFAULT_TOLERANCE: ArrivalTolerance = {
  typicalMin: 10,
  requiredMin: 25,
  benchmarkMin: 60,
};

/* ------------------------------------------------------------------ *
 * resolveDueTime — does the feed run today, and by when?
 * ------------------------------------------------------------------ */

export function resolveDueTime(
  contract: ArrivalContract,
  businessDate: string,
): DueResolution {
  if (contract.cadence === "adhoc") {
    return { due: false, shifted: false, notDueReason: "adhoc" };
  }

  // Cadence gating — is today even a scheduled run day?
  if (contract.cadence === "weekly") {
    const wanted = contract.schedule?.weekday ?? 1; // default Monday
    if (weekdayOf(businessDate) !== wanted) {
      return { due: false, shifted: false, notDueReason: "not-scheduled" };
    }
  }
  // (monthly nth-business-day gating omitted in the prototype; daily always runs)

  const sourceCal = REGION_CALENDAR[contract.region];

  // Source market shut → the feed isn't produced. Absence is expected.
  if (isMarketClosed(sourceCal, businessDate)) {
    return { due: false, shifted: false, notDueReason: "source-holiday" };
  }

  // Deadline starts at the contract's expected time on the source date.
  let dueDate = businessDate;
  let dueAtMin = toMin(contract.expectedTime);
  let shifted = false;

  // Dependency (settlement) closure → the cash leg can't settle today, so
  // the deadline shifts to the next day settlement is open.
  const settlementCal = CURRENCY_SETTLEMENT_CALENDAR[contract.currency];
  if (settlementCal !== sourceCal && isMarketClosed(settlementCal, businessDate)) {
    dueDate = nextOpenDay(settlementCal, businessDate);
    shifted = true;
  }

  // Early close on the source (or shifted) date pulls the deadline forward.
  const early = earlyCloseOn(sourceCal, dueDate);
  if (early) {
    dueAtMin = Math.min(dueAtMin, toMin(early));
  }

  return { due: true, dueAtMin, dueAt: fromMin(dueAtMin), dueDate, shifted };
}

/* ------------------------------------------------------------------ *
 * classifyArrival — the four-state assessment.
 *
 * @param nowMin            minutes since local midnight on the business date
 * @param actualArrivalMin  minutes since local midnight if the file arrived,
 *                          else null
 * ------------------------------------------------------------------ */

export function classifyArrival(
  contract: ArrivalContract,
  businessDate: string,
  nowMin: number,
  actualArrivalMin: number | null,
  override: ArrivalOverride = { kind: "none" },
): ArrivalAssessment {
  const due = resolveDueTime(contract, businessDate);

  // --- Not due: absence is expected, never escalates -----------------
  if (!due.due) {
    const reason: ArrivalReason =
      due.notDueReason === "source-holiday"
        ? "source-holiday"
        : due.notDueReason === "adhoc"
          ? "adhoc"
          : "not-scheduled";
    const sourceCal = REGION_CALENDAR[contract.region];
    const holidayName = closureOn(sourceCal, businessDate)?.name;
    return {
      state: "expected_absence",
      reason,
      explained: true,
      due,
      label:
        reason === "source-holiday"
          ? `Not expected — ${holidayName ?? "market closed"}`
          : reason === "adhoc"
            ? "Ad-hoc — no schedule"
            : "Not scheduled today",
    };
  }

  // --- Human overrides demote escalation -----------------------------
  if (override.kind === "holiday") {
    return {
      state: "expected_absence",
      reason: "marked-holiday",
      explained: true,
      due,
      label: `Marked holiday by ${override.actor}`,
    };
  }
  if (override.kind === "snooze" && nowMin < override.untilMin) {
    return {
      state: "expected_absence",
      reason: "snoozed",
      explained: true,
      due,
      label: `Snoozed until ${fromMin(override.untilMin)}`,
    };
  }

  const dueAtMin = due.dueAtMin!;

  // A dependency closure shifted the deadline to a future day — today's
  // absence is expected against the shifted schedule.
  if (due.shifted && due.dueDate !== businessDate) {
    return {
      state: "expected_absence",
      reason: "dependency-closed",
      explained: true,
      due,
      label: `Settlement shifted — due ${due.dueDate} ${due.dueAt}`,
    };
  }

  // --- File already arrived ------------------------------------------
  if (actualArrivalMin != null) {
    const lateBy = actualArrivalMin - dueAtMin;
    if (lateBy <= contract.tolerance.typicalMin) {
      return {
        state: "on_time",
        reason: "on-time",
        explained: false,
        minutesLate: Math.max(0, lateBy),
        due,
        label: `Arrived ${fromMin(actualArrivalMin)} · due ${due.dueAt}`,
      };
    }
    // Arrived but beyond tolerance, with no explanation → late.
    const tier = tierFor(lateBy, contract.tolerance);
    const acked = override.kind === "acknowledged";
    return {
      state: acked ? "at_risk" : "late_unexpected",
      reason: acked ? "acknowledged" : "late",
      tier,
      explained: acked,
      minutesLate: lateBy,
      due,
      label: acked
        ? `Late, acknowledged by ${override.actor}`
        : `Arrived ${fromMin(actualArrivalMin)} · ${lateBy}m late`,
    };
  }

  // --- File not yet arrived ------------------------------------------
  const lateBy = nowMin - dueAtMin;

  if (lateBy < -contract.tolerance.requiredMin) {
    // Comfortably before the deadline.
    return {
      state: "on_time",
      reason: "not-yet-due",
      explained: false,
      due,
      label: `Due ${due.dueAt}`,
    };
  }
  if (lateBy < contract.tolerance.typicalMin) {
    // Inside the run-up window — predictive amber.
    return {
      state: "at_risk",
      reason: "due-soon",
      explained: false,
      minutesLate: Math.max(0, lateBy),
      due,
      label: lateBy >= 0 ? `Due ${due.dueAt} · ${lateBy}m over` : `Due ${due.dueAt} · in ${-lateBy}m`,
    };
  }

  // Past tolerance, not arrived, nothing explains it → the real alert.
  const acked = override.kind === "acknowledged";
  const tier = tierFor(lateBy, contract.tolerance);
  return {
    state: acked ? "at_risk" : "late_unexpected",
    reason: acked ? "acknowledged" : "late",
    tier,
    explained: acked,
    minutesLate: lateBy,
    due,
    label: acked
      ? `${lateBy}m late, acknowledged by ${override.actor}`
      : `Due ${due.dueAt} · ${lateBy}m late, not received`,
  };
}

function tierFor(lateByMin: number, t: ArrivalTolerance): BreachTier {
  if (lateByMin >= t.benchmarkMin) return "benchmark";
  if (lateByMin >= t.requiredMin) return "required";
  return "typical";
}
