import type { Channel, HoldReason } from "./model";

/* Colours and formatters shared by the Mortgage Pipeline page. The palette
 * is the validated set from the dashboard brief: STATUS carries meaning
 * (inside or past SLA, on or off pace), CAT carries identity (the six
 * stages in the stacked distribution), and ink is the page accent. */

export const INK = "#171717";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const MUTED_SERIES = "#cbd5e1";
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];

/** One-hue indigo ramp, light to dark, for the cohort heatmap. */
export const HEAT = ["#eef2ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#3730a3", "#312e81"];
/** The de-emphasis step of the same hue for funnel bands outside the selection. */
export const INDIGO_FADE = "#c7d2fe";

export type Tone = "good" | "warn" | "bad" | "neutral";

export const CHIP: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  neutral: "text-neutral-500",
};

/** Hold reasons are categories; the chip stays neutral and the text carries identity. */
export const HOLD_SHORT: Record<HoldReason, string> = {
  "Awaiting valuation": "Awaiting valuation",
  "Documents outstanding": "Docs outstanding",
  "Referred to senior underwriter": "Referred to senior UW",
  "Awaiting solicitor": "Awaiting solicitor",
  "Broker query": "Broker query",
  "Income verification": "Income verification",
};

export const CHANNEL_SHORT: Record<Channel, string> = { Broker: "Broker", Direct: "Direct", Digital: "Digital" };

export const MINUS = "−";
const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);

export const int = (v: number) => NF0.format(v);

/** Full pounds: £248,000. */
export const gbp = (v: number) => `${v < 0 ? MINUS : ""}£${NF0.format(Math.abs(v))}`;
/** £m with one decimal: £101.1m. */
export const gbpM = (v: number) => `${v < 0 ? MINUS : ""}£${NF1.format(Math.abs(v) / 1e6)}m`;
/** Compact money for tight cells: £248k, £1.2m. */
export function gbpCompact(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (a >= 1e6) return `${sign}£${NF1.format(a / 1e6)}m`;
  if (a >= 1e3) return `${sign}£${NF0.format(Math.round(a / 1e3))}k`;
  return `${sign}£${NF0.format(a)}`;
}

export const pct = (v: number, dp = 0) => `${v < 0 ? MINUS : ""}${nf(dp).format(Math.abs(v))}%`;
/** Business days with one decimal: 4.4d. */
export const days = (v: number) => `${v < 0 ? MINUS : ""}${NF1.format(Math.abs(v))}d`;
/** Signed days for over/under SLA: +2.3d / −0.6d. */
export const daysSigned = (v: number) => `${v < 0 ? MINUS : "+"}${NF1.format(Math.abs(v))}d`;
export const rate1 = (v: number) => NF1.format(v);

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLong(t: number) {
  const d = new Date(t);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function dateMid(t: number) {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function dateShort(t: number) {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function dateDay(t: number) {
  const d = new Date(t);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function timeShort(t: number) {
  const d = new Date(t);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
