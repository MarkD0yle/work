import type { ActionStatus, MemberCategory, StressStatus } from "./model";

/* Colours and formatters for the Pension Scheme Funding page. The palette
 * is the validated set from the dashboard brief: STATUS carries meaning
 * (covered / tight / shortfall, on plan / behind, overdue), CAT carries
 * identity (collateral tiers, member categories), MUTED_SERIES is the
 * journey plan and other reference lines, and ink is the page accent. */

export const INK = "#171717";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const MUTED_SERIES = "#cbd5e1";
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];

export const MINUS = "−";

/* Collateral tiers are identities, in waterfall order. */
export const TIER_COLOR = { cash: CAT[4], gilts: CAT[0], credit: CAT[1] } as const;
export const TIER_LABEL = { cash: "Cash", gilts: "Gilts", credit: "Eligible credit" } as const;

/* Member categories are identities too. */
export const MEMBER_COLOR: Record<MemberCategory, string> = {
  pensioners: CAT[0],
  deferreds: CAT[1],
  actives: CAT[3],
};

export type Tone = "good" | "warn" | "bad" | "neutral";
export const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  neutral: "text-neutral-500",
};
export const TONE_CHIP: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

export const STRESS_META: Record<StressStatus, { label: string; tone: Tone }> = {
  covered: { label: "Covered", tone: "good" },
  tight: { label: "Tight", tone: "warn" },
  shortfall: { label: "Shortfall", tone: "bad" },
};

export const ACTION_META: Record<ActionStatus | "Overdue", { tone: Tone }> = {
  Open: { tone: "neutral" },
  "In progress": { tone: "warn" },
  Complete: { tone: "good" },
  Overdue: { tone: "bad" },
};

/** Direction tone: `upGood` says whether a positive change is welcome. */
export function toneOf(delta: number, upGood: boolean, eps = 1e-9): Tone {
  if (Math.abs(delta) <= eps) return "neutral";
  return delta > 0 === upGood ? "good" : "bad";
}

const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);

export const num = (v: number, dp = 0) => (dp === 0 ? NF0 : dp === 1 ? NF1 : NF2).format(v);

/** £1,288m, −£35m: whole millions for stat values. */
export const gbpM = (v: number, dp = 0) => `${v < 0 ? MINUS : ""}£${num(Math.abs(v), dp)}m`;
/** Signed £m for deltas: +£4m / −£2m. */
export const gbpMSigned = (v: number, dp = 0) => `${v < 0 ? MINUS : "+"}£${num(Math.abs(v), dp)}m`;
/** 103.4% */
export const pct = (v: number, dp = 1) => `${v < 0 ? MINUS : ""}${num(Math.abs(v), dp)}%`;
/** +0.7pp / −0.4pp */
export const pp = (v: number, dp = 1) => `${v < 0 ? MINUS : "+"}${num(Math.abs(v), dp)}pp`;
/** +100bp */
export const bpSigned = (v: number) => `${v < 0 ? MINUS : "+"}${num(Math.abs(v))}bp`;
/** 299bp */
export const bp = (v: number) => `${num(Math.max(0, v))}bp`;
/** 1.9× */
export const times = (v: number, dp = 2) => `${num(v, dp)}×`;

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 31 Aug 2026 */
export function dateMid(t: number) {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** Aug 2026 */
export function monthYear(t: number) {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** Aug 26 */
export function monthShort(t: number) {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}
/** Q3 2026 */
export function quarterLabel(t: number) {
  const d = new Date(t);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}
