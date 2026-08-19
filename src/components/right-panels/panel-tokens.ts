/* Non-component tokens shared by the right-panel kit.
 *
 * Split out of PanelKit so that file exports components only — mixing
 * constants into a component module breaks React Fast Refresh, and the panels
 * are exactly the kind of stateful surface you want to edit without losing the
 * state you were testing.
 */

export type Tone = "positive" | "negative" | "warn" | "info" | "neutral";

export const TONES: Record<
  Tone,
  { bg: string; text: string; border: string; dot: string; solid: string }
> = {
  positive: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    solid: "bg-emerald-500",
  },
  negative: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    solid: "bg-rose-500",
  },
  warn: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    solid: "bg-amber-500",
  },
  info: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
    solid: "bg-sky-500",
  },
  neutral: {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
    dot: "bg-neutral-400",
    solid: "bg-neutral-400",
  },
};

/** Stroke colours for MiniSpark — SVG needs literals, not utility classes. */
export const SPARK_STROKE: Record<Tone, string> = {
  positive: "#10b981",
  negative: "#f43f5e",
  warn: "#f59e0b",
  info: "#0ea5e9",
  neutral: "#a3a3a3",
};

export const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm tabular-nums text-neutral-900 outline-none focus:border-neutral-900";
