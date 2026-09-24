/* Loan Book Health: colours, number formatting and delta tone. */

export const ACCENT = "#4f46e5";
export const MUTED_SERIES = "#cbd5e1";
export const SPARK_INK = "#94a3b8";
export const REF_INK = "#525252";
/** Ordinal DPD ramp, one hue: light = mild, dark = severe (1–29 … 90+). */
export const BUCKET_COLOURS = ["#c7d2fe", "#818cf8", "#4f46e5", "#312e81"];

/** Sequential indigo bins for the roll matrix (upper bound, fill, ink). */
export const HEAT: { max: number; bg: string; ink: string }[] = [
  { max: 0.005, bg: "#eef2ff", ink: "#404040" },
  { max: 0.02, bg: "#e0e7ff", ink: "#262626" },
  { max: 0.05, bg: "#c7d2fe", ink: "#171717" },
  { max: 0.1, bg: "#a5b4fc", ink: "#171717" },
  { max: 0.2, bg: "#818cf8", ink: "#0a0a0a" },
  { max: 0.4, bg: "#6366f1", ink: "#ffffff" },
  { max: 0.6, bg: "#4f46e5", ink: "#ffffff" },
  { max: 0.8, bg: "#4338ca", ink: "#ffffff" },
  { max: 1.01, bg: "#3730a3", ink: "#ffffff" },
];
export const heatOf = (v: number) => HEAT.find((h) => v < h.max) ?? HEAT[HEAT.length - 1];

export const NF = new Map<number, Intl.NumberFormat>();
export function nf(d: number) {
  let f = NF.get(d);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    NF.set(d, f);
  }
  return f;
}
export const MINUS = "−";
export function gbp(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  if (a >= 1e9) return `${sign}£${nf(2).format(a / 1e9)}bn`;
  if (a >= 1e8) return `${sign}£${nf(0).format(a / 1e6)}m`;
  if (a >= 1e6) return `${sign}£${nf(1).format(a / 1e6)}m`;
  return `${sign}£${nf(0).format(a / 1e3)}k`;
}
export const pct = (x: number, d = 2) => `${nf(d).format(x * 100)}%`;
export function countCompact(n: number) {
  if (n >= 1e6) return `${nf(2).format(n / 1e6)}m`;
  if (n >= 1e4) return `${nf(1).format(n / 1e3)}k`;
  return nf(0).format(n);
}
/** Signed percentage-point delta of two fractions: ▲ +0.07pp. */
export function signedPp(d: number, dp = 2) {
  const v = Math.abs(d * 100);
  if (v < 0.5 * 10 ** -dp) return `±${nf(dp).format(0)}pp`;
  return `${d > 0 ? "▲ +" : `▼ ${MINUS}`}${nf(dp).format(v)}pp`;
}

export type Tone = "good" | "bad" | "flat";
export const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-600",
  bad: "text-rose-600",
  flat: "text-neutral-500",
};
/** Delta colour = direction × whether up is good. */
export function toneOf(delta: number, upGood: boolean, eps: number): Tone {
  if (Math.abs(delta) < eps) return "flat";
  return delta > 0 === upGood ? "good" : "bad";
}

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1";

export type View = "chart" | "table";
export const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "chart", label: "Chart" },
  { value: "table", label: "Table" },
];
