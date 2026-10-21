/* Severity colour tier system — spec v0.1.1 §1, extended in v0.1.2 §1.3.
 *
 *   "Hue carries severity. Weight carries age and acknowledgement state.
 *    They do not cross-talk."
 *
 * v0.1.2 introduces three breach tiers (Past Typical / Past Required /
 * Past Benchmark) borrowed from Qlik. These map to severities:
 *
 *   typical    cream    pale yellow    informational    "watch this"
 *   required   amber    standard       actionable       "act now"
 *   benchmark  red      saturated      escalation       "page the boss"
 *
 * The pre-v0.1.2 names `atrisk` and `broken` are kept as aliases of
 * `required` and `benchmark` respectively, so legacy callers compile.
 *
 * Hard rules (spec §11 + v0.1.2 §6):
 *   - Hue carries severity; weight carries age/ack state (no cross-talk)
 *   - Green never gets age weight — clean is always flat
 *   - Three tiers — never collapse to two except in the trend strip
 *   - Threshold values come from config, never hardcoded in components
 */

export type Severity =
  | "benchmark"
  | "required"
  | "typical"
  | "broken" // alias of benchmark
  | "atrisk" // alias of required
  | "watch" // pre-breach in-progress with concern (blue) — distinct from typical
  | "working"
  | "expected_absence" // "late" but explained by calendar/human — gray, suppressed
  | "clean";

/** Five tiers carrying decreasing visual weight within a single hue. */
export type Tier = "banner" | "surface" | "muted" | "subtle" | "outline";

export interface ToneClasses {
  bg: string;
  text: string;
  border: string;
}

const BENCHMARK_TONES: Record<Tier, ToneClasses> = {
  // Loudest — L0 banner only
  banner: { bg: "bg-red-50", text: "text-red-800", border: "border-red-300" },
  // Medium — stage cells, pipeline row left stripe
  surface: { bg: "bg-red-500", text: "text-white", border: "border-red-500" },
  // Desaturated — acked rows
  muted: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
  // Near-neutral with a hint — resolved rows
  subtle: { bg: "bg-white", text: "text-red-600", border: "border-red-100" },
  // Border only — filter chips
  outline: {
    bg: "bg-transparent",
    text: "text-red-700",
    border: "border-red-400",
  },
};

const REQUIRED_TONES: Record<Tier, ToneClasses> = {
  // Required banner uses softer amber fill — required-vs-benchmark contrast
  // is the point. We don't want amber-500 banner shouting like a red one.
  banner: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-300",
  },
  surface: {
    bg: "bg-amber-400",
    text: "text-amber-950",
    border: "border-amber-400",
  },
  muted: {
    bg: "bg-amber-50/40",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  subtle: {
    bg: "bg-white",
    text: "text-amber-700",
    border: "border-amber-100",
  },
  outline: {
    bg: "bg-transparent",
    text: "text-amber-800",
    border: "border-amber-400",
  },
};

const TYPICAL_TONES: Record<Tier, ToneClasses> = {
  // Typical — informational cream/yellow. Visible but quiet.
  // Hard rule: must be clearly distinct from required (amber) so a row
  // showing typical → required → benchmark reads as a ladder.
  banner: {
    bg: "bg-yellow-50",
    text: "text-yellow-900",
    border: "border-yellow-200",
  },
  surface: {
    bg: "bg-yellow-200",
    text: "text-yellow-900",
    border: "border-yellow-200",
  },
  muted: {
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-100",
  },
  subtle: {
    bg: "bg-white",
    text: "text-yellow-700",
    border: "border-yellow-100",
  },
  outline: {
    bg: "bg-transparent",
    text: "text-yellow-800",
    border: "border-yellow-300",
  },
};

/* Expected absence — the file is "late" by the clock but a calendar fact
 * (market closed / settlement shifted) or a human action (marked holiday /
 * snoozed) explains it. Deliberately the quietest non-clean tone: neutral
 * gray, no colour pull. This is the "red → gray demotion" target. */
const EXPECTED_ABSENCE_TONES: Record<Tier, ToneClasses> = {
  banner: { bg: "bg-neutral-50", text: "text-neutral-500", border: "border-neutral-200" },
  surface: { bg: "bg-neutral-100", text: "text-neutral-400", border: "border-neutral-200" },
  muted: { bg: "bg-neutral-50", text: "text-neutral-400", border: "border-neutral-100" },
  subtle: { bg: "bg-white", text: "text-neutral-400", border: "border-neutral-100" },
  outline: { bg: "bg-transparent", text: "text-neutral-500", border: "border-neutral-300" },
};

export const SEVERITY_TONES: Record<Severity, Record<Tier, ToneClasses>> = {
  benchmark: BENCHMARK_TONES,
  required: REQUIRED_TONES,
  typical: TYPICAL_TONES,
  expected_absence: EXPECTED_ABSENCE_TONES,
  // Deprecated aliases — kept so v0.1.1 callers compile during migration.
  broken: BENCHMARK_TONES,
  atrisk: REQUIRED_TONES,
  watch: {
    // Watch is "approaching breach" — blue, not amber. Distinct hue helps
    // operator distinguish active work from late work.
    banner: {
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
    },
    surface: {
      bg: "bg-blue-300",
      text: "text-blue-900",
      border: "border-blue-300",
    },
    muted: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    },
    subtle: {
      bg: "bg-white",
      text: "text-blue-600",
      border: "border-blue-100",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-blue-700",
      border: "border-blue-300",
    },
  },
  working: {
    banner: {
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
    },
    surface: {
      bg: "bg-blue-300",
      text: "text-blue-900",
      border: "border-blue-300",
    },
    muted: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    },
    subtle: {
      bg: "bg-white",
      text: "text-blue-600",
      border: "border-blue-100",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-blue-700",
      border: "border-blue-300",
    },
  },
  clean: {
    banner: {
      bg: "bg-white",
      text: "text-neutral-700",
      border: "border-neutral-200",
    },
    surface: {
      bg: "bg-neutral-200",
      text: "text-neutral-500",
      border: "border-neutral-200",
    },
    muted: {
      bg: "bg-neutral-50",
      text: "text-neutral-500",
      border: "border-neutral-100",
    },
    subtle: {
      bg: "bg-white",
      text: "text-neutral-400",
      border: "border-neutral-100",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-neutral-600",
      border: "border-neutral-300",
    },
  },
};

/* Age weight — spec §1.5 and §7.3.
 *
 * Within a single severity tone, age modulates visual weight via:
 *   - Left border thickness  (3px critical / 2px hot / 2px warming / 1px fresh)
 *   - Text weight on age col (bold / semibold / medium / regular)
 *
 * Apply only to red/amber rows. Clean is flat — no age weight (spec §11).
 */

export type AgeBand = "fresh" | "warming" | "hot" | "critical";

export function ageBand(minutes: number): AgeBand {
  if (minutes >= 60) return "critical";
  if (minutes >= 30) return "hot";
  if (minutes >= 10) return "warming";
  return "fresh";
}

interface AgeWeight {
  /** Tailwind border-l-* class */
  borderLeft: string;
  /** Tailwind font-weight class for the age column */
  textWeight: string;
}

export const AGE_WEIGHT: Record<AgeBand, AgeWeight> = {
  fresh: { borderLeft: "border-l", textWeight: "font-normal" },
  warming: { borderLeft: "border-l-2", textWeight: "font-medium" },
  hot: { borderLeft: "border-l-2", textWeight: "font-semibold" },
  critical: { borderLeft: "border-l-4", textWeight: "font-bold" },
};

/* Map various status shapes from the rest of the app to a single Severity. */
export function mandateStatusToSeverity(
  status:
    | "broken"
    | "at_risk"
    | "watch"
    | "working"
    | "clean"
    | "holiday",
): Severity {
  if (status === "at_risk") return "atrisk";
  if (status === "broken") return "broken";
  if (status === "watch") return "watch";
  if (status === "working") return "working";
  // Holiday rows map to the gray "expected absence" tone (the explained,
  // suppressed state) rather than collapsing into clean.
  if (status === "holiday") return "expected_absence";
  return "clean";
}

/** Map an arrival-scheduler state to a severity tone. */
export function arrivalStateToSeverity(
  state: "on_time" | "at_risk" | "late_unexpected" | "expected_absence",
  tier?: "typical" | "required" | "benchmark",
): Severity {
  switch (state) {
    case "on_time":
      return "clean";
    case "at_risk":
      return "required";
    case "expected_absence":
      return "expected_absence";
    case "late_unexpected":
      return tier === "benchmark"
        ? "benchmark"
        : tier === "required"
          ? "required"
          : "typical";
  }
}

export function monitorStatusToSeverity(
  status: "red" | "amber" | "green" | "info",
): Severity {
  if (status === "red") return "benchmark";
  if (status === "amber") return "required";
  return "clean";
}
