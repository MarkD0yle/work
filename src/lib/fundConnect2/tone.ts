/* Fund Connect 2 — status colours. Same doctrine as Fund Connect: state is
 * structural, severity is colour. The one addition is `active`, which is the
 * only state allowed a green — it marks "in force", not a severity. */

import type { RecordState2 } from "./types";

export const STATE_PILL: Record<RecordState2, string> = {
  draft: "border-neutral-300 bg-white text-neutral-600",
  submitted: "border-neutral-900 bg-white text-neutral-900",
  in_review: "border-blue-300 bg-blue-50 text-blue-800",
  approved: "border-neutral-900 bg-neutral-900 text-white",
  active: "border-emerald-400 bg-emerald-50 text-emerald-800",
};

/** Dot next to the pill in lists — same hue vocabulary, smaller footprint. */
export const STATE_DOT: Record<RecordState2, string> = {
  draft: "bg-neutral-300",
  submitted: "bg-neutral-900",
  in_review: "bg-blue-400",
  approved: "bg-neutral-900",
  active: "bg-emerald-500",
};
