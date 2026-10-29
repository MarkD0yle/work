import type { Cause, SignOff, Zone } from "./model";

/* Colours and formatters shared by the VaR Backtesting page. The palette is
 * the validated set from the dashboard brief: STATUS carries meaning (here
 * the Basel zones and exceptions), CAT carries identity (root causes), and
 * ink is the page accent. */

export const INK = "#171717";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const MUTED_SERIES = "#cbd5e1";
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];

export const ZONE_META: Record<Zone, { label: string; color: string; chip: string }> = {
  green: { label: "Green", color: STATUS.good, chip: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  amber: { label: "Amber", color: STATUS.warn, chip: "border-amber-200 bg-amber-50 text-amber-800" },
  red: { label: "Red", color: STATUS.bad, chip: "border-rose-200 bg-rose-50 text-rose-800" },
};

/* Root causes are categories, so they take categorical hues in fixed order. */
export const CAUSE_COLOR: Record<Cause, string> = {
  "Market move": CAT[0],
  "Model limitation": CAT[1],
  "Data issue": CAT[2],
  "Intraday position change": CAT[3],
};

export const SIGNOFF_META: Record<SignOff, { color: string; text: string }> = {
  "Pending MRM": { color: STATUS.warn, text: "text-amber-800" },
  Approved: { color: STATUS.good, text: "text-emerald-800" },
  Challenged: { color: STATUS.bad, text: "text-rose-800" },
};

const MINUS = "−";
const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF1 = nf(1);
const NF2 = nf(2);

/** £m with one decimal and a true minus sign: −£14.2m. */
export const gbpM = (v: number) => `${v < 0 ? MINUS : ""}£${NF1.format(Math.abs(v))}m`;
/** Signed £m for deltas: +£1.2m / −£0.4m. */
export const gbpMSigned = (v: number) => `${v < 0 ? MINUS : "+"}£${NF1.format(Math.abs(v))}m`;
/** Multiple of VaR: −1.46× */
export const times = (v: number) => `${v < 0 ? MINUS : ""}${NF2.format(Math.abs(v))}×`;
export const num2 = (v: number) => NF2.format(v);
export const pval = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3));

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLong(t: number) {
  const d = new Date(t);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function dateShort(t: number) {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function dateMid(t: number) {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function monthYear(t: number) {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}
