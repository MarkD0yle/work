/* Climate & Transition — colour tokens and number formatting.
 *
 * Colour jobs on this page:
 *  - Olive accent (lime-700/800) is chrome and portfolio identity: active
 *    toggles, the portfolio line, the WACI bar, the validated arc. It is
 *    deliberately not the STATUS good green, which only ever means "good".
 *  - Orange is heat: the temperature bands, the intensity ramp on the
 *    treemap, and "worse than benchmark" on the diverging bars. Indigo is
 *    the opposite pole ("better than benchmark").
 *  - Gray is the benchmark. Status colours carry verdicts only, with icons. */

import type { Engagement, Scope } from "./model";

export const ACCENT = "#4d7c0f"; // lime-700
export const ACCENT_DARK = "#3f6212"; // lime-800
export const ACCENT_LIGHT = "#bef264"; // lime-300 (committed step)
export const ACCENT_TRACK = "#ecfccb"; // lime-100 (meter track)

export const BENCH_INK = "#737373"; // neutral-500 benchmark line
export const TARGET_INK = "#404040"; // neutral-700 target path
export const SURFACE = "#ffffff";

export const DIVERGE = { worse: "#f97316", better: "#4f46e5", mid: "#e5e5e5" };
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };

/* Temperature bands, drawn as a stepped sequential ramp (not a traffic
 * light): lighter = cooler. Shared by the gauge and the table swatches. */
export const TEMP_BANDS = [
  { from: 1.0, to: 1.5, color: "#ffedd5", label: "≤1.5°C" },
  { from: 1.5, to: 2.0, color: "#fed7aa", label: "1.5–2°C" },
  { from: 2.0, to: 3.0, color: "#fdba74", label: "2–3°C" },
  { from: 3.0, to: 4.0, color: "#f97316", label: ">3°C" },
];
export const tempBand = (t: number) =>
  TEMP_BANDS.find((b) => t < b.to) ?? TEMP_BANDS[TEMP_BANDS.length - 1];

/* Sequential intensity ramp for the treemap (orange 50 → 900). */
export const HEAT_STOPS: [number, string][] = [
  [0, "#fff7ed"],
  [0.35, "#fed7aa"],
  [0.62, "#fdba74"],
  [0.8, "#f97316"],
  [1, "#9a3412"],
];

export const SBTI_GOAL_2030 = 0.6;

export const SCOPE_LABEL: Record<Scope, string> = {
  s12: "Scope 1+2",
  s123: "Scope 1+2+3",
};

export const ENGAGEMENTS: Engagement[] = [
  "Engaging",
  "Escalated",
  "Voted against",
  "Divestment review",
];

/* ------------------------------------------------------------------ */

const nfCache = new Map<number, Intl.NumberFormat>();
export function nf(v: number, dp = 0) {
  let f = nfCache.get(dp);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });
    nfCache.set(dp, f);
  }
  return f.format(v);
}

/** £4.82bn / £412m from a £m value. */
export function money(m: number) {
  return m >= 1000 ? `£${nf(m / 1000, 2)}bn` : `£${nf(m, 0)}m`;
}

/** Percentage from a fraction. */
export function pct(x: number, dp = 1) {
  return `${nf(x * 100, dp)}%`;
}

/** Signed, with a true minus sign. */
export function signed(v: number, dp = 1, suffix = "") {
  const r = Number(v.toFixed(dp));
  const s = r > 0 ? "+" : r < 0 ? "−" : "±";
  return `${s}${nf(Math.abs(v), dp)}${suffix}`;
}
export function signedPct(x: number, dp = 1) {
  return signed(x * 100, dp, "%");
}

/** ktCO₂e from tonnes, with sensible precision. */
export function kt(t: number) {
  const k = t / 1000;
  return nf(k, k >= 100 ? 0 : 1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** A nice rounded ceiling for axis/meter maxima. */
export function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
  return step * p;
}

/* 2030 verdict from the projected index against the target path. A ±2
 * index-point band around the target counts as "at risk", not "on track". */
export type Verdict = { key: "on" | "risk" | "off"; label: string; color: string };
export function verdictFor(projected: number, target: number): Verdict {
  if (projected <= target - 2) return { key: "on", label: "On track", color: STATUS.good };
  if (projected <= target + 2) return { key: "risk", label: "At risk", color: STATUS.warn };
  return { key: "off", label: "Off track", color: STATUS.bad };
}
