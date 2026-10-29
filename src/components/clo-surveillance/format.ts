import type { DealStatus, QualityTest, RatingBucket } from "./model";

/* Colours and formatters for the CLO Deal Monitor. The palette is the
 * validated set shared by the dashboards: STATUS carries meaning (pass,
 * thin, fail), CAT carries identity, the indigo ramp carries order. The
 * tranche ramp itself lives in the model next to the stack it colours. */

export const INK = "#171717";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];
export const MUTED_SERIES = "#cbd5e1";
/** Indigo sequential ramp, light → dark, for magnitude (spread bins). */
export const SEQ = ["#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5", "#312e81"];
/** Fill for de-emphasised marks while a highlight is active. */
export const DIM = "#e5e5e5";

export const CHIP = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

export const STATUS_META: Record<DealStatus, { label: string; color: string; chip: string }> = {
  pass: { label: "Passing", color: STATUS.good, chip: CHIP.good },
  thin: { label: "Cushion thin", color: STATUS.warn, chip: CHIP.warn },
  fail: { label: "Failing a test", color: STATUS.bad, chip: CHIP.bad },
};

/* Rating buckets are ordered, so Ba → B3 step through the indigo ramp; the
 * two buckets the tests haircut (Caa, defaulted) take the status hues
 * because there they carry meaning. */
export const BUCKET_COLOR: Record<RatingBucket, string> = {
  Ba: SEQ[1],
  B1: SEQ[2],
  B2: SEQ[3],
  B3: SEQ[4],
  Caa: STATUS.warn,
  Defaulted: STATUS.bad,
};
export const BUCKET_LABEL: Record<RatingBucket, string> = {
  Ba: "Ba",
  B1: "B1",
  B2: "B2",
  B3: "B3",
  Caa: "Caa and below",
  Defaulted: "Defaulted",
};

export const SPREAD_BINS: { label: string; lo: number; color: string }[] = [
  { label: "< 325", lo: 0, color: SEQ[0] },
  { label: "325–375", lo: 325, color: SEQ[1] },
  { label: "375–425", lo: 375, color: SEQ[2] },
  { label: "425–475", lo: 425, color: SEQ[3] },
  { label: "475–550", lo: 475, color: SEQ[4] },
  { label: "≥ 550", lo: 550, color: SEQ[5] },
];
export function spreadColor(bps: number): string {
  let c = SPREAD_BINS[0].color;
  for (const b of SPREAD_BINS) if (bps >= b.lo) c = b.color;
  return c;
}

export const TH = "px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";
export const TD = "px-3 py-1.5 font-mono text-[11px] tabular-nums text-neutral-800 whitespace-nowrap";

const MINUS = "−";
const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);

/** €248.0m with a true minus sign. */
export const eurM = (v: number, dp = 1) => `${v < 0 ? MINUS : ""}€${nf(dp).format(Math.abs(v))}m`;
/** €2.4bn for the rail total. */
export const eurBn = (v: number) => `€${NF2.format(v / 1000)}bn`;
export const pct = (v: number, dp = 1) => `${v < 0 ? MINUS : ""}${nf(dp).format(Math.abs(v))}%`;
export const signedPp = (v: number, dp = 1) => `${v < 0 ? MINUS : "+"}${nf(dp).format(Math.abs(v))} pp`;
export const bps = (v: number) => `${v < 0 ? MINUS : "+"}${NF0.format(Math.abs(v))} bps`;
export const num0 = (v: number) => NF0.format(v);
export const num1 = (v: number) => NF1.format(v);
export const num2 = (v: number) => NF2.format(v);
export const spread = (v: number) => `E+${NF0.format(v)}`;

/** A quality test's value in its own unit. */
export function qualityValue(t: QualityTest, v = t.actual): string {
  switch (t.unit) {
    case "pct":
      return pct(v, 2);
    case "num":
      return num0(v);
    case "years":
      return `${NF2.format(v)}y`;
    case "score":
      return NF1.format(v);
  }
}

/** Signed room against the covenant, in the test's unit. */
export function qualityCushion(t: QualityTest): string {
  const s = t.cushion < 0 ? MINUS : "+";
  const a = Math.abs(t.cushion);
  switch (t.unit) {
    case "pct":
      return `${s}${NF2.format(a)} pp`;
    case "num":
      return `${s}${NF0.format(a)}`;
    case "years":
      return `${s}${NF2.format(a)}y`;
    case "score":
      return `${s}${NF1.format(a)}`;
  }
}

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
export function monthYear(t: number) {
  const d = new Date(t);
  return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
