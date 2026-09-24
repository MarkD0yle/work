/* Formatting and palette for the Capital Adequacy report. */

import type { RatioDef } from "./model";

const nfCache = new Map<number, Intl.NumberFormat>();
function nf(d: number) {
  let f = nfCache.get(d);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    nfCache.set(d, f);
  }
  return f;
}

export const MINUS = "−";

export const num = (v: number, d = 1) => {
  const s = nf(d).format(Math.abs(v));
  return v < 0 && s.replace(/[0.,]/g, "") !== "" ? `${MINUS}${s}` : s;
};
export const pct = (v: number, d = 2) => `${num(v, d)}%`;
export const bn = (v: number, d = 1) => `${v < 0 ? MINUS : ""}£${nf(d).format(Math.abs(v))}bn`;

/** Signed number with a proper minus sign; zero after rounding shows as ±0. */
export function signed(v: number, d = 0, suffix = "") {
  const s = nf(d).format(Math.abs(v));
  const isZero = s.replace(/[0.,]/g, "") === "";
  if (isZero) return `±${s}${suffix}`;
  return `${v > 0 ? "+" : MINUS}${s}${suffix}`;
}
export const signedBn = (v: number, d = 1) => {
  const s = nf(d).format(Math.abs(v));
  if (s.replace(/[0.,]/g, "") === "") return `±£${s}bn`;
  return `${v > 0 ? "+" : MINUS}£${s}bn`;
};

/** Percentage-point difference expressed in basis points. */
export const toBps = (pp: number) => pp * 100;

export type Tone = "good" | "bad" | "flat";
/** Delta colour = direction x whether up is good. `eps` is the flat band. */
export function toneOf(delta: number, upIsGood: boolean, eps = 0): Tone {
  if (Math.abs(delta) <= eps) return "flat";
  return delta > 0 === upIsGood ? "good" : "bad";
}
export const TONE_CLASS: Record<Tone, string> = {
  good: "text-emerald-700",
  bad: "text-rose-700",
  flat: "text-neutral-500",
};

/* --- palette ------------------------------------------------------------- */

export const ACCENT = "#1e3a8a"; // blue-900: chrome + emphasised series
export const ACCENT_WASH = "rgba(30, 58, 138, 0.16)";
export const INK = "#404040"; // neutral-700: waterfall sums
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const MUTED_SERIES = "#cbd5e1";

/** Requirement stack: stepped grays, darkest = hardest floor. */
export const SEG_FILL = {
  p1: "#8a8a8a",
  p2a: "#a8a8a8",
  ccb: "#c4c4c4",
  ccyb: "#d9d9d9",
  sys: "#e9e9e9",
} as const;

/* --- ratio formatting ---------------------------------------------------- */

export const ratioDp = (def: RatioDef) => (def.group === "liquidity" ? 1 : 2);
export const fmtRatio = (def: RatioDef, v: number) => pct(v, ratioDp(def));

/** Headroom over the requirement in bps (capital, leverage) or pp (liquidity). */
export function headroomUnits(def: RatioDef, value: number) {
  const pp = value - def.requirement;
  return def.headroomUnit === "bps" ? pp * 100 : pp;
}
export function fmtUnits(def: RatioDef, v: number, sign = false) {
  const d = def.headroomUnit === "bps" ? 0 : 1;
  const unit = def.headroomUnit === "bps" ? "bps" : "pp";
  return sign ? signed(v, d, unit) : `${num(v, d)}${unit}`;
}

