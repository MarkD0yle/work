/* Fund Connect — status colour mapping.
 *
 * Handoff note in the spec: reuse the severity-as-colour tokens from the
 * ccymgmt dashboard rather than inventing a second colour vocabulary for
 * the same meaning. So nothing here picks a colour — it picks a severity,
 * and `severity-tokens` owns what that severity looks like.
 *
 *   error      benchmark   red      blocks submission
 *   flag       required    amber    a reviewer wants this changed
 *   warning    typical     cream    look at this before you submit
 *   neutral    clean       grey     nothing to say
 *
 * Record state is structural, not severity, so state pills stay in ink and
 * never borrow a hue — a draft is not a mild error.
 */

import {
  SEVERITY_TONES,
  type Severity,
  type ToneClasses,
} from "../severity-tokens";
import type { IssueLevel } from "./schema";
import type { RecordState, SectionStatus } from "./types";

export type FieldTone = "error" | "flag" | "warning" | "none";

export function toneFor(kind: FieldTone, tier: "surface" | "muted" | "subtle" | "outline" = "muted"): ToneClasses {
  const severity: Severity =
    kind === "error"
      ? "benchmark"
      : kind === "flag"
        ? "required"
        : kind === "warning"
          ? "typical"
          : "clean";
  return SEVERITY_TONES[severity][tier];
}

export function issueTone(level: IssueLevel | null | undefined): FieldTone {
  if (level === "error") return "error";
  if (level === "warning") return "warning";
  return "none";
}

/** Section rail dot. Complete is deliberately neutral — done is the absence
 *  of severity, and the tick carries the meaning. */
export const SECTION_DOT: Record<SectionStatus, string> = {
  not_started: "bg-neutral-300",
  in_progress: "bg-blue-400",
  complete: "bg-neutral-900",
  error: "bg-red-500",
};

export const SECTION_LABEL: Record<SectionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  error: "Error",
};

/** State pills — ink only. See the note at the top of the file. */
export const STATE_PILL: Record<RecordState, string> = {
  draft: "border-neutral-300 bg-white text-neutral-600",
  submitted: "border-neutral-900 bg-white text-neutral-900",
  in_review: "border-blue-300 bg-blue-50 text-blue-800",
  approved: "border-neutral-900 bg-neutral-900 text-white",
  amendment: "border-neutral-400 bg-neutral-100 text-neutral-800",
};

/** Reviewer-queue SLA — waiting time against the review target. */
export function slaTone(waitingMinutes: number, sla: { target: number; breach: number }): FieldTone {
  if (waitingMinutes >= sla.breach) return "error";
  if (waitingMinutes >= sla.target) return "flag";
  return "none";
}
