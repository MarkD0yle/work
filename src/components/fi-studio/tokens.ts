/* FI Studio — tokens.
 *
 * The friendly skin for the five fixed income screens. Same features as the
 * FI Terminal (both render from src/components/fi-terminal/model), different
 * personality: light, roomy, plain-spoken.
 *
 * Colour jobs, one hue each:
 *   · indigo — "you can act here": primary actions, selection, focus
 *   · blue / orange — Buy / Sell. Orange, not red, so a sell never reads as
 *     an error and the pair stays distinct for colour-blind users
 *   · green / red — market moves, always paired with an arrow and a word
 * Square corners everywhere (repo rule: --radius 0). Pills and dots stay round. */

export const s = {
  page: "bg-[#f6f5f1]",
  // Soft edge: a faint border plus a gentle shadow does the separating, not a hard line.
  card: "bg-white border border-stone-200/50 shadow-[0_1px_3px_rgba(28,25,23,0.05),0_1px_2px_rgba(28,25,23,0.03)]",
  sunken: "bg-stone-50",
  hover: "hover:bg-stone-50",
  selected: "bg-indigo-50",
  border: "border-stone-200",
  divide: "divide-stone-100",

  h1: "text-[22px] font-semibold tracking-tight text-stone-900",
  h2: "text-[13px] font-semibold text-stone-900",
  lead: "text-[13px] text-stone-500",
  label: "text-[11px] font-medium text-stone-500",
  body: "text-[13px] text-stone-700",
  muted: "text-stone-500",
  faint: "text-stone-400",
  value: "text-stone-900",
  num: "tabular-nums",

  up: "text-emerald-600",
  down: "text-rose-600",

  buy: "text-blue-600",
  sell: "text-orange-600",
  buyBg: "bg-blue-600 text-white hover:bg-blue-500",
  sellBg: "bg-orange-600 text-white hover:bg-orange-500",
  buySoft: "bg-blue-50 text-blue-700 border-blue-200",
  sellSoft: "bg-orange-50 text-orange-700 border-orange-200",

  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  secondary: "border border-stone-300 bg-white text-stone-700 hover:border-indigo-400 hover:text-indigo-700",
  focus: "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
  input:
    "border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
} as const;

export type { Side } from "../fi-terminal/tokens";
import type { Side } from "../fi-terminal/tokens";

export const sideText = (side: Side) => (side === "Buy" ? s.buy : s.sell);
export const sideBg = (side: Side) => (side === "Buy" ? s.buyBg : s.sellBg);
export const sideSoft = (side: Side) => (side === "Buy" ? s.buySoft : s.sellSoft);

/** Signed change → colour. `goodWhenNegative` for spreads/yields where tighter is good. */
export function moveText(v: number, goodWhenNegative = false) {
  if (Math.abs(v) < 1e-9) return s.muted;
  const good = goodWhenNegative ? v < 0 : v > 0;
  return good ? s.up : s.down;
}

/* ---------- Heat scales for a light page ----------
 * rgba strings because a heat map is a continuous scale. */

/** -1 (green, tighter) … 0 (paper) … +1 (red, wider). */
export function divergingHeat(x: number) {
  const v = Math.max(-1, Math.min(1, x));
  if (Math.abs(v) < 0.04) return "rgba(245,245,244,1)";
  const a = (0.1 + Math.abs(v) * 0.55).toFixed(3);
  return v < 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})`;
}

/** Sequential indigo for levels: 0 … 1. */
export function levelHeat(x: number) {
  const v = Math.max(0, Math.min(1, x));
  return `rgba(99,102,241,${(0.06 + v * 0.55).toFixed(3)})`;
}

/** Rich/cheap in the colour of the trade it suggests: -1 rich (orange, sell) … +1 cheap (blue, buy). */
export function actionHeat(x: number) {
  const v = Math.max(-1, Math.min(1, x));
  if (Math.abs(v) < 0.04) return "rgba(245,245,244,1)";
  const a = (0.12 + Math.abs(v) * 0.55).toFixed(3);
  return v > 0 ? `rgba(37,99,235,${a})` : `rgba(234,88,12,${a})`;
}

/** Text colour that stays readable on a heat cell. */
export function onHeat(x: number) {
  return Math.abs(x) > 0.75 ? "text-stone-900 font-semibold" : "text-stone-800";
}
