import { BUCKETS, type Bucket, type Cause, type Focus, type Regime, type Status, type Tone } from "./model";

/* Colours and formatters for the Settlement Fails console. The palette is
 * the validated set from the dashboard brief: STATUS carries meaning (tones,
 * paid vs received, age severity), CAT carries identity (root causes), and
 * ink is the page accent. */

export const INK = "#171717";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const MUTED_SERIES = "#cbd5e1";
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];

/* Root causes are categories, so they take categorical hues in fixed order. */
export const CAUSE_COLOR: Record<Cause, string> = {
  "Counterparty short": CAT[0],
  "Instruction mismatch": CAT[1],
  "Late instruction": CAT[2],
  "Inventory short": CAT[3],
  "Corporate action": CAT[4],
  "SSI issue": CAT[5],
};

/* Age is severity, so buckets run neutral → amber → rose. */
export const BUCKET_COLOR: Record<Bucket, string> = {
  0: "#a3a3a3",
  1: "#fbbf24",
  2: STATUS.warn,
  3: "#f43f5e",
  4: "#be123c",
};

export const STATUS_CHIP: Record<Status, string> = {
  "Matched-failing": "border-amber-200 bg-amber-50 text-amber-800",
  Unmatched: "border-rose-200 bg-rose-50 text-rose-800",
  Partial: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export const REGIME_CHIP: Record<Regime, string> = {
  csdr: "border-indigo-200 bg-indigo-50 text-indigo-800",
  local: "border-sky-200 bg-sky-50 text-sky-800",
  none: "border-neutral-200 bg-neutral-50 text-neutral-500",
};
export const REGIME_SHORT: Record<Regime, string> = { csdr: "CSDR", local: "Fails charge", none: "No penalties" };

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  neutral: "text-neutral-500",
};
export const TONE_COLOR: Record<Tone, string> = {
  good: STATUS.good,
  warn: STATUS.warn,
  bad: STATUS.bad,
  neutral: STATUS.neutral,
};

/* Sequential indigo ramp for the ageing heatmap, #eef2ff → #312e81. */
const HEAT_LO = [0xee, 0xf2, 0xff];
const HEAT_HI = [0x31, 0x2e, 0x81];
export function heat(t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const ch = HEAT_LO.map((lo, i) => Math.round(lo + (HEAT_HI[i] - lo) * k));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}
/** Ink for text sitting on heat(t). */
export const inkOn = (t: number) => (t > 0.5 ? "#ffffff" : INK);

/* ---- numbers ------------------------------------------------------ */

export const MINUS = "−";
const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);
/** Squash −0 and float dust so nothing formats as "−0". */
const z = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);

export const num0 = (v: number) => NF0.format(z(v));
export const num1 = (v: number) => NF1.format(z(v));

/** £1,234 with a true minus sign. */
export function gbp0(v: number) {
  const x = z(v);
  return `${x < 0 ? MINUS : ""}£${NF0.format(Math.abs(x))}`;
}
/** +£35 / −£140 / £0 for accruals that carry direction. */
export function gbp0Signed(v: number) {
  const x = z(v);
  return `${x < 0 ? MINUS : x > 0 ? "+" : ""}£${NF0.format(Math.abs(x))}`;
}
/** £m with one decimal: £387.6m. */
export function gbpM(v: number) {
  const x = z(v);
  return `${x < 0 ? MINUS : ""}£${NF1.format(Math.abs(x) / 1e6)}m`;
}
/** Compact money: £43.2k below a million, £1.2m above; signed on request. */
export function gbpC(v: number, signed = false) {
  const x = z(v);
  const s = x < 0 ? MINUS : signed && x > 0 ? "+" : "";
  const a = Math.abs(x);
  if (a >= 1e6) return `${s}£${NF1.format(a / 1e6)}m`;
  if (a >= 1e3) return `${s}£${NF1.format(a / 1e3)}k`;
  return `${s}£${NF0.format(a)}`;
}
/** Axis ticks: £30k, £1.2m, £500, no decimals below a million. */
export function gbpTick(v: number) {
  const x = z(v);
  const s = x < 0 ? MINUS : "";
  const a = Math.abs(x);
  if (a >= 1e6) return `${s}£${NF1.format(a / 1e6)}m`;
  if (a >= 1e3) return `${s}£${NF0.format(a / 1e3)}k`;
  return `${s}£${NF0.format(a)}`;
}
export const pct = (v: number, dp = 1) => `${nf(dp).format(z(v))}%`;
/** Percentage-point delta: +0.98 pp. */
export function pp(v: number) {
  const x = z(v);
  return `${x < 0 ? MINUS : "+"}${NF2.format(Math.abs(x))} pp`;
}
export function signedPct(v: number) {
  const x = z(v);
  return `${x < 0 ? MINUS : "+"}${NF1.format(Math.abs(x))}%`;
}
export const days1 = (v: number) => `${NF1.format(z(v))}d`;
export function signedDays(v: number) {
  const x = z(v);
  return `${x < 0 ? MINUS : "+"}${NF2.format(Math.abs(x))}d`;
}

/* ---- dates -------------------------------------------------------- */

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
export function timeHM(t: number) {
  const d = new Date(t);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "Meridian Prime Brokers · T+2–3" for a matrix cross-filter. */
export function focusLabel(f: Focus): string {
  const parts: string[] = [];
  if (f.counterparty) parts.push(f.counterparty);
  if (f.bucket !== null) parts.push(BUCKETS[f.bucket].label);
  return parts.join(" · ");
}
