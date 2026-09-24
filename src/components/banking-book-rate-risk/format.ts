import type { Direction, Purpose, Status } from "./model";

/* Colours and formatters for the Banking Book Rate Risk page. The palette
 * is the validated set from the dashboard brief: STATUS carries meaning
 * (limit status, gains and losses), CAT carries identity (the ladder's
 * three series, swap direction), ink is the page accent. */

export const INK = "#171717";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];
export const MUTED_SERIES = "#cbd5e1";

export const STATUS_META: Record<Status, { label: string; color: string; chip: string; text: string }> = {
  good: { label: "Inside", color: STATUS.good, chip: "border-emerald-200 bg-emerald-50 text-emerald-800", text: "text-emerald-700" },
  warn: { label: "Watch", color: STATUS.warn, chip: "border-amber-200 bg-amber-50 text-amber-800", text: "text-amber-700" },
  bad: { label: "Breach", color: STATUS.bad, chip: "border-rose-200 bg-rose-50 text-rose-800", text: "text-rose-700" },
};

/* The gap ladder's three series are identities, not states: assets and
 * liabilities take the warm/cool ends of the categorical set so positive
 * and negative bars read apart, swap legs the teal. */
export const LADDER = { assets: CAT[0], liabilities: CAT[5], swaps: CAT[4] };

/* Receive-fixed adds asset-like duration, pay-fixed removes it, so the
 * hedge table reuses the ladder's asset/liability hues. */
export const DIRECTION_META: Record<Direction, { label: string; color: string }> = {
  receive: { label: "Receive fixed", color: LADDER.assets },
  pay: { label: "Pay fixed", color: LADDER.liabilities },
};

export const PURPOSE_SHORT: Record<Purpose, string> = {
  "NMD hedge": "NMD",
  "Fixed mortgage hedge": "Mortgage",
  Pipeline: "Pipeline",
};

export const MINUS = "−";
const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF = [nf(0), nf(1), nf(2)];

const abs = (v: number, d: number) => NF[d].format(Math.abs(v));
/** Treats −0 and rounding dust as zero so no "−£0m" appears. */
const isZero = (v: number, d: number) => Math.abs(v) < 0.5 / Math.pow(10, d);

/** £358m / −£358m. */
export const gbpM = (v: number, d = 0) => `${v < 0 && !isZero(v, d) ? MINUS : ""}£${abs(v, d)}m`;
/** +£12m / −£4m / £0m. */
export const gbpMSigned = (v: number, d = 0) =>
  isZero(v, d) ? `£${abs(0, d)}m` : `${v < 0 ? MINUS : "+"}£${abs(v, d)}m`;
/** £24.0bn from a £m input. */
export const gbpBn = (vM: number, d = 1) => `${vM < 0 && !isZero(vM / 1000, d) ? MINUS : ""}£${abs(vM / 1000, d)}bn`;
/** £360k from a £k input, for DV01. */
export const gbpK = (v: number) => `${v < 0 && !isZero(v, 0) ? MINUS : ""}£${abs(v, 0)}k`;
export const pct = (v: number, d = 1) => `${v < 0 && !isZero(v, d) ? MINUS : ""}${abs(v, d)}%`;
export const pctSigned = (v: number, d = 1) =>
  isZero(v, d) ? `${abs(0, d)}%` : `${v < 0 ? MINUS : "+"}${abs(v, d)}%`;
export const bp = (v: number) => {
  const r = Math.round(v);
  return r === 0 ? "0bp" : `${r < 0 ? MINUS : "+"}${Math.abs(r)}bp`;
};
export const rate = (v: number, d = 2) => `${abs(v, d)}%`;
export const years = (v: number) => `${NF[1].format(v)}y`;
export const num = (v: number, d = 0) => `${v < 0 && !isZero(v, d) ? MINUS : ""}${abs(v, d)}`;

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLong(t: number) {
  const d = new Date(t);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function monthShort(t: number) {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}
export function monthLong(t: number) {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
