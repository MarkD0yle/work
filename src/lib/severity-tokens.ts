/* Severity colour tier system — spec v0.1.1 §1.
 *
 *   "Hue carries severity. Weight carries age and acknowledgement state.
 *    They do not cross-talk."
 *
 * In production these map to SSDS tokens like `color.state.broken.banner`.
 * This workspace doesn't have SSDS, so we map each (severity, tier) pair
 * to a Tailwind class triple here. The component contract is identical —
 * swap this file for SSDS token references when porting.
 *
 * Hard rules (spec §11):
 *   - Hue carries severity; weight carries age/ack state (no cross-talk)
 *   - Green never gets age weight — clean is always flat
 *   - No invented colour values — only the tones below
 */

export type Severity = "broken" | "atrisk" | "watch" | "working" | "clean";

/** Five tiers carrying decreasing visual weight within a single hue. */
export type Tier = "banner" | "surface" | "muted" | "subtle" | "outline";

export interface ToneClasses {
  bg: string;
  text: string;
  border: string;
}

export const SEVERITY_TONES: Record<Severity, Record<Tier, ToneClasses>> = {
  broken: {
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
  },
  atrisk: {
    // At-risk banner uses softer amber fill — broken-vs-atrisk contrast is
    // the point. We don't want amber-500 banner shouting like a red one.
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
  },
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
): Severity | "holiday" {
  if (status === "at_risk") return "atrisk";
  if (status === "broken") return "broken";
  if (status === "watch") return "watch";
  if (status === "working") return "working";
  return "clean";
}

export function monitorStatusToSeverity(
  status: "red" | "amber" | "green" | "info",
): Severity {
  if (status === "red") return "broken";
  if (status === "amber") return "atrisk";
  return "clean";
}
