/* Pattern tokens — the one place the pattern library takes its look from.
 *
 * Every pattern in this folder reads its surface, border, type and tone
 * classes from here instead of writing its own. Change a value here and
 * every pattern (and every screen built from them) follows. Think of it as
 * the Figma variables collection behind the components.
 *
 * Values are Tailwind class strings, not raw colours, so nothing in a
 * pattern hardcodes a hex value or an inline style. When the SSDS
 * `--ssds-*` tokens land, swap these strings for classes that point at them;
 * the patterns don't change.
 *
 * Radius follows the zero-radius rule in index.css: square corners.
 * Pills and dots stay round because they are shapes, not containers.
 */

export const surface = {
  page: "bg-neutral-50",
  card: "bg-white",
  sunken: "bg-neutral-50",
  hover: "hover:bg-neutral-50",
  selected: "bg-neutral-100",
} as const;

export const border = {
  default: "border border-neutral-200",
  subtle: "border-neutral-100",
  divider: "border-neutral-200",
  /** Row separators for lists (divide-y needs its own colour class). */
  divide: "divide-neutral-100",
} as const;

export const radius = {
  container: "rounded-none",
  control: "rounded-none",
  pill: "rounded-full",
} as const;

/* Spacing rhythm: one gap between cards, one padding inside them. */
export const space = {
  gap: "gap-4",
  cardPad: "p-4",
  cardPadX: "px-4",
  cardPadY: "py-3",
  pageX: "px-6",
} as const;

export const text = {
  /** Small uppercase label above a value or a section — the "eyebrow". */
  eyebrow: "text-[10px] font-semibold tracking-widest text-neutral-500 uppercase",
  /** Field / column label. */
  label: "text-[11px] font-medium text-neutral-500",
  title: "text-sm font-semibold text-neutral-900",
  pageTitle: "text-xl font-semibold tracking-tight text-neutral-900",
  body: "text-xs text-neutral-700",
  muted: "text-xs text-neutral-500",
  value: "text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums",
  numeric: "tabular-nums",
} as const;

export const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

/* Tones: what a state means, not what colour it is.
 * Severity in Ops Overview uses lib/severity-tokens (three breach tiers).
 * These tones are the simpler, general set every other screen needs. */
export type Tone =
  | "neutral"
  | "positive"
  | "negative"
  | "warning"
  | "info"
  | "critical";

export const tone: Record<
  Tone,
  {
    /** Soft fill + text + border, for pills and banners. */
    soft: string;
    /** Solid fill, for dots, bars and rails. */
    solid: string;
    /** Text only, for deltas and inline values. */
    text: string;
    /** SVG stroke/fill, for sparklines and bars. */
    stroke: string;
    fill: string;
    /** Left accent border for cards. */
    rail: string;
  }
> = {
  neutral: {
    soft: "bg-neutral-100 text-neutral-700 border-neutral-200",
    solid: "bg-neutral-400",
    text: "text-neutral-600",
    stroke: "stroke-neutral-500",
    fill: "fill-neutral-400",
    rail: "border-l-neutral-300",
  },
  positive: {
    soft: "bg-emerald-50 text-emerald-800 border-emerald-200",
    solid: "bg-emerald-500",
    text: "text-emerald-700",
    stroke: "stroke-emerald-600",
    fill: "fill-emerald-500",
    rail: "border-l-emerald-500",
  },
  negative: {
    soft: "bg-red-50 text-red-800 border-red-200",
    solid: "bg-red-500",
    text: "text-red-700",
    stroke: "stroke-red-600",
    fill: "fill-red-500",
    rail: "border-l-red-500",
  },
  warning: {
    soft: "bg-amber-50 text-amber-900 border-amber-200",
    solid: "bg-amber-400",
    text: "text-amber-700",
    stroke: "stroke-amber-500",
    fill: "fill-amber-400",
    rail: "border-l-amber-400",
  },
  info: {
    soft: "bg-blue-50 text-blue-800 border-blue-200",
    solid: "bg-blue-500",
    text: "text-blue-700",
    stroke: "stroke-blue-600",
    fill: "fill-blue-500",
    rail: "border-l-blue-500",
  },
  critical: {
    soft: "bg-red-600 text-white border-red-600",
    solid: "bg-red-700",
    text: "text-red-800",
    stroke: "stroke-red-700",
    fill: "fill-red-700",
    rail: "border-l-red-700",
  },
};

/* Buttons used inside patterns (toolbar actions, banner actions, empty
 * states). Screens should use the same three so actions read alike. */
export const button = {
  primary: `inline-flex items-center gap-1.5 ${radius.control} bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40 ${focus}`,
  secondary: `inline-flex items-center gap-1.5 ${radius.control} border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 ${focus}`,
  ghost: `inline-flex items-center gap-1.5 ${radius.control} px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 ${focus}`,
} as const;

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
