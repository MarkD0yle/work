/* Five-step colour buckets for Heatmap cells. Shared so other cell-based
 * views (calendars, matrices) colour values the same way. */

const SEQ = ["bg-neutral-50 text-neutral-600", "bg-blue-100 text-blue-900", "bg-blue-200 text-blue-900", "bg-blue-400 text-white", "bg-blue-600 text-white"];
const NEG = ["bg-red-50 text-red-900", "bg-red-100 text-red-900", "bg-red-300 text-red-950", "bg-red-500 text-white", "bg-red-700 text-white"];
const POS = ["bg-emerald-50 text-emerald-900", "bg-emerald-100 text-emerald-900", "bg-emerald-300 text-emerald-950", "bg-emerald-500 text-white", "bg-emerald-700 text-white"];

export function heatClass(v: number, max: number, scale: "sequential" | "diverging") {
  const m = max || 1;
  const step = Math.min(4, Math.floor((Math.abs(v) / m) * 4.999));
  if (scale === "sequential") return SEQ[Math.max(0, step)];
  if (v === 0) return "bg-white text-neutral-500";
  return v < 0 ? NEG[step] : POS[step];
}
