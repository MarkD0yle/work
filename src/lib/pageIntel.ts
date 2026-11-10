import { intel } from "virtual:page-intel";

/* Typed access to the build-time source scan (scripts/pageIntel.ts).
 *
 * "Drift" is how far a screen's source has moved from the house rules:
 * rounded corners, raw hex colours and inline styles. The counts are regex
 * estimates, so the levels below are prompts to review, not verdicts. */

export type Drift = { radius: number; hex: number; inlineStyle: number };

export type DriftLevel = "clean" | "low" | "medium" | "high";

export type PageDrift = {
  files: number;
  lines: number;
  drift: Drift;
  /** Weighted total. Radius breaks a hard rule, so it weighs most. */
  points: number;
  /** Points per 100 lines, so big screens are not punished for their size. */
  density: number;
  level: DriftLevel;
};

export const DRIFT_WEIGHT: Drift = { radius: 3, hex: 2, inlineStyle: 1 };

export const DRIFT_LEVELS: { id: DriftLevel; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "clean", label: "Clean" },
];

function levelFor(points: number, density: number): DriftLevel {
  if (points === 0) return "clean";
  if (density < 2) return "low";
  if (density < 6) return "medium";
  return "high";
}

export function driftForSlug(slug: string): PageDrift | null {
  const page = intel.pages[slug];
  if (!page) return null;
  const points =
    page.drift.radius * DRIFT_WEIGHT.radius +
    page.drift.hex * DRIFT_WEIGHT.hex +
    page.drift.inlineStyle * DRIFT_WEIGHT.inlineStyle;
  const density = page.lines > 0 ? (points / page.lines) * 100 : 0;
  return { ...page, points, density, level: levelFor(points, density) };
}

/** Component names exported by the pattern library. */
export const PATTERN_NAMES: string[] = intel.patterns;
