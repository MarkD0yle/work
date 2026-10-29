/* Fixed Income Terminal — tokens.
 *
 * One dark, dense, monospace look shared by the five FI terminal screens
 * (credit heat map, RFQ, order ticket, BWIC, rates RV). Every screen reads
 * its colours from here, so the family stays coherent — the Figma variables
 * collection behind the screens.
 *
 * Colour has three jobs only, and each job owns its hue:
 *   · amber   — labels, focus, "the terminal is talking to you"
 *   · sky/rose — trade direction (Buy / Sell), matching FI venue convention
 *   · green/red — market moves (tighter / wider, richer / cheaper)
 * Everything else is neutral grey. If a pixel is coloured, it means something.
 */

export const t = {
  page: "bg-[#07090c]",
  panel: "bg-[#0c1016]",
  raised: "bg-[#121821]",
  inset: "bg-[#05070a]",
  hover: "hover:bg-white/[0.04]",
  selected: "bg-amber-400/10",

  border: "border-[#1c232d]",
  borderStrong: "border-[#2a3340]",
  divide: "divide-[#161c25]",

  label: "text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/90",
  colHead: "text-[10px] font-medium uppercase tracking-wider text-neutral-500",
  value: "text-neutral-100",
  body: "text-neutral-300",
  muted: "text-neutral-500",
  faint: "text-neutral-600",

  up: "text-emerald-400",
  down: "text-rose-400",

  buy: "text-sky-400",
  sell: "text-rose-400",
  buyBg: "bg-sky-500 text-black hover:bg-sky-400",
  sellBg: "bg-rose-500 text-black hover:bg-rose-400",

  action: "bg-amber-400 text-black hover:bg-amber-300",
  ghost: "border border-[#2a3340] text-neutral-300 hover:border-amber-400/60 hover:text-amber-300",
  focus: "focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400",
  input:
    "border border-[#2a3340] bg-[#05070a] px-2 py-1.5 text-neutral-100 placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none",
} as const;

export type Side = "Buy" | "Sell";

export function sideText(side: Side) {
  return side === "Buy" ? t.buy : t.sell;
}

export function sideBg(side: Side) {
  return side === "Buy" ? t.buyBg : t.sellBg;
}

/** Signed change → colour. `goodWhenNegative` for spreads/yields where tighter is "up". */
export function moveText(v: number, goodWhenNegative = false) {
  if (Math.abs(v) < 1e-9) return t.muted;
  const good = goodWhenNegative ? v < 0 : v > 0;
  return good ? t.up : t.down;
}

/* ---------- Heat scales ----------
 * Returned as rgba strings because a heat map is a continuous scale —
 * no finite set of Tailwind classes can express it. Kept here so every
 * heat surface in the family uses the same ramp. */

/** Diverging: -1 (green, tighter / rich) … 0 (neutral) … +1 (red, wider / cheap). */
export function divergingHeat(x: number) {
  const v = Math.max(-1, Math.min(1, x));
  const a = 0.08 + Math.abs(v) * 0.62;
  if (Math.abs(v) < 0.04) return "rgba(148,163,184,0.06)";
  return v < 0 ? `rgba(16,185,129,${a.toFixed(3)})` : `rgba(244,63,94,${a.toFixed(3)})`;
}

/** Rich/cheap in the colour of the trade it suggests: -1 rich (rose, sell) … +1 cheap (sky, buy). */
export function actionHeat(x: number) {
  const v = Math.max(-1, Math.min(1, x));
  if (Math.abs(v) < 0.04) return "rgba(148,163,184,0.06)";
  const a = (0.1 + Math.abs(v) * 0.6).toFixed(3);
  return v > 0 ? `rgba(14,165,233,${a})` : `rgba(244,63,94,${a})`;
}

/** Sequential amber for levels: 0 … 1. */
export function levelHeat(x: number) {
  const v = Math.max(0, Math.min(1, x));
  return `rgba(251,191,36,${(0.05 + v * 0.6).toFixed(3)})`;
}
