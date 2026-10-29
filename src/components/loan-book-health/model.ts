/* Loan Book Health: the segment cube behind the page.
 *
 * The book is a cube of product × region × score band × channel segments
 * (point-of-sale finance is only written through retail partners, so its
 * Direct and Broker cells don't exist). Each segment is run through a monthly
 * Markov chain over arrears buckets: the transition matrix is the roll-rate
 * model, the month-end bucket balances are what it leaves behind, charge-offs
 * are the flows out of the book, and provisions are bucket balances times a
 * loss rate. Because every published number is a sum over segments of the
 * same simulated flows, any filter slice aggregates honestly: the KPIs, the
 * bucket chart, the roll matrix and the league table all agree.
 *
 * Vintage curves are modelled separately per product × band (with region and
 * channel multipliers per segment) and weighted by each segment's originated
 * balance, so the filters reshape those too.
 *
 * Everything is seeded; nothing here calls Math.random().
 */

export type ProductId = "PL" | "CF" | "CC" | "POS";
export type RegionId = "LDN" | "SE" | "MID" | "NW" | "SCO" | "WSW";
export type BandId = "A" | "B" | "C" | "D" | "E";
export type ChannelId = "DIR" | "BRK" | "PTN";

export const PRODUCTS: { id: ProductId; label: string }[] = [
  { id: "PL", label: "Personal loan" },
  { id: "CF", label: "Car finance" },
  { id: "CC", label: "Credit card" },
  { id: "POS", label: "Point-of-sale" },
];
export const REGIONS: { id: RegionId; label: string }[] = [
  { id: "LDN", label: "London" },
  { id: "SE", label: "South East" },
  { id: "MID", label: "Midlands" },
  { id: "NW", label: "North West" },
  { id: "SCO", label: "Scotland" },
  { id: "WSW", label: "Wales & SW" },
];
export const BANDS: { id: BandId; label: string; range: string }[] = [
  { id: "A", label: "A", range: "800+" },
  { id: "B", label: "B", range: "740–799" },
  { id: "C", label: "C", range: "670–739" },
  { id: "D", label: "D", range: "560–669" },
  { id: "E", label: "E", range: "<560" },
];
export const CHANNELS: { id: ChannelId; label: string }[] = [
  { id: "DIR", label: "Direct" },
  { id: "BRK", label: "Broker" },
  { id: "PTN", label: "Partner" },
];

/** Arrears buckets at month end (the Markov states). */
export const BUCKETS = ["Current", "1–29", "30–59", "60–89", "90+"] as const;
/** Month-end destinations in the roll matrix (the states plus the exit). */
export const DESTS = [
  "Cure / Current",
  "1–29",
  "30–59",
  "60–89",
  "90+",
  "Charged off",
] as const;

/* ------------------------------------------------------------------ *
 * Calendar: 30 month-ends, Mar 2024 … Aug 2026. The as-of select offers
 * the last six, and every as-of month still has 24 months of history.
 * ------------------------------------------------------------------ */

export const N_MONTHS = 30;
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Calendar parts of month index i (0 = Mar 2024). */
function ym(i: number) {
  const n = 2024 * 12 + 2 + i;
  return { y: Math.floor(n / 12), m: n % 12 };
}
export function monthShort(i: number) {
  const { y, m } = ym(i);
  return `${MONTH_ABBR[m]} ${String(y).slice(2)}`;
}
export function monthLong(i: number) {
  const { y, m } = ym(i);
  return `${MONTH_ABBR[m]} ${y}`;
}
export function monthEnd(i: number) {
  const { y, m } = ym(i);
  const d = m === 1 && y % 4 === 0 ? 29 : MONTH_DAYS[m];
  return `${d} ${MONTH_ABBR[m]} ${y}`;
}
export const AS_OF_OPTIONS = [24, 25, 26, 27, 28, 29];
export const LATEST = N_MONTHS - 1;

/* ------------------------------------------------------------------ *
 * Seeded PRNG
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260831);
/** Uniform jitter around 1: 1 ± amp. */
const jit = (amp: number) => 1 + (rand() * 2 - 1) * amp;

/* ------------------------------------------------------------------ *
 * Book shape (balance weights) — total ≈ £7.4bn at Aug 2026
 * ------------------------------------------------------------------ */

const BOOK_GBP = 7.4e9;
const PROD_SHARE = [0.33, 0.27, 0.29, 0.11];
const REGION_SHARE = [0.17, 0.19, 0.17, 0.16, 0.12, 0.19];
const BAND_SHARE = [
  [0.2, 0.28, 0.3, 0.16, 0.06], // PL
  [0.24, 0.3, 0.28, 0.13, 0.05], // CF
  [0.12, 0.22, 0.32, 0.23, 0.11], // CC
  [0.1, 0.2, 0.33, 0.25, 0.12], // POS
];
const CHAN_SHARE = [
  [0.55, 0.3, 0.15], // PL
  [0.18, 0.62, 0.2], // CF
  [0.68, 0.22, 0.1], // CC
  [0, 0, 1], // POS: retail partners only
];
/** Monthly balance growth by product. */
const GROWTH = [0.0045, 0.003, 0.0035, 0.011];
/** Average balance per account (£) by product, scaled by band. */
const AVG_BAL = [7600, 13200, 1850, 1150];
const BAND_AVG = [1.25, 1.1, 1, 0.88, 0.72];

/* ------------------------------------------------------------------ *
 * Roll-rate model parameters (monthly, by balance)
 * ------------------------------------------------------------------ */

/** Current → 1–29 entry rate before multipliers. */
const E0 = 0.0105;
const BAND_E = [0.22, 0.5, 1, 2.1, 4.2];
const PROD_E = [0.95, 0.62, 1.2, 1.3];
const CHAN_E = [0.9, 1.14, 1.04];
const REGION_E = [0.96, 0.9, 1.05, 1.12, 1.0, 1.02];
/** Roll-forward multipliers by product (cards roll harder). */
const PROD_R = [1, 0.85, 1.08, 1.12];

// 1–29
const C1 = [0.64, 0.6, 0.54, 0.46, 0.37];
const R1 = [0.17, 0.2, 0.24, 0.29, 0.35];
// 30–59
const C2 = [0.24, 0.21, 0.17, 0.13, 0.09];
const C2B1 = [0.1, 0.1, 0.09, 0.08, 0.07];
const R2 = [0.21, 0.24, 0.28, 0.32, 0.37];
// 60–89
const C3 = [0.09, 0.08, 0.065, 0.05, 0.035];
const R3 = [0.5, 0.54, 0.58, 0.63, 0.68];
// 90+
const C4 = [0.03, 0.025, 0.02, 0.015, 0.01];
/** 90+ → charged off per month, by product. */
const CO_RATE = [0.11, 0.14, 0.125, 0.12];
/** Share of charged-off balance recovered (car finance: the vehicle). */
const RECOVERY = [0.17, 0.5, 0.11, 0.09];

/** Provision loss rate by bucket, by product; Current scaled by band PD. */
const LOSS_CURRENT = [0.014, 0.008, 0.028, 0.022];
const BAND_PD = [0.3, 0.6, 1, 1.8, 3.1];
const LOSS_ARREARS = [0.14, 0.33, 0.52];
const LOSS_NPL = [0.74, 0.46, 0.82, 0.84];

/* Stress sensitivity: where the deterioration lands. */
const SENS_P = [0.8, 0.35, 1.25, 1.5];
const SENS_B = [0.4, 0.6, 1, 1.45, 1.85];
const SENS_C = [0.8, 1.3, 1.1];
const SENS_R = [0.9, 0.8, 1.15, 1.45, 0.9, 1.0];

/** Calendar seasonality on arrears entry (post-Christmas bump). */
const SEASON = [1.1, 1.06, 0.98, 0.96, 0.97, 0.98, 1.0, 1.02, 1.01, 1.0, 0.99, 1.03];

/** Book-wide stress drift by month index: benign 2024, worsening from 2025. */
function drift(k: number) {
  if (k < 0) return -0.02;
  return -0.02 + 0.005 * Math.max(0, k - 8) + 0.0006 * Math.max(0, k - 20) ** 2;
}
/** Collections strain in the last two months pushes 30–59 and 60–89 rolls. */
const STRAIN2 = (k: number) => (k === 29 ? 1.035 : k === 28 ? 1.01 : 1);
const STRAIN3 = (k: number) => (k === 29 ? 1.03 : 1);

const MACRO_NOISE = Array.from({ length: N_MONTHS }, () => jit(0.022));

/* ------------------------------------------------------------------ *
 * Segments
 * ------------------------------------------------------------------ */

export interface Segment {
  id: string;
  p: number;
  r: number;
  b: number;
  c: number;
  /** Month-end balance, £. */
  bal: Float64Array;
  /** Month-end bucket balances, [month * 5 + bucket]. */
  bk: Float64Array;
  /** Flows in the month, start bucket → end destination, [month * 30 + i * 6 + j]. */
  fl: Float64Array;
  /** Gross charge-offs in the month, £. */
  co: Float64Array;
  /** Net charge-offs (after recoveries), £. */
  nco: Float64Array;
  /** Provision allowance at month end, £. */
  allow: Float64Array;
  /** Open accounts at month end. */
  acc: Float64Array;
  /** Stress sensitivity (shared with the vintage model). */
  sens: number;
}

const BURN = 36;

function simulate(p: number, r: number, b: number, c: number, weight: number): Segment {
  const segJit = jit(0.12);
  const cureJit = jit(0.06);
  const rollJit = jit(0.06);
  const sens = SENS_P[p] * SENS_B[b] * SENS_C[c] * SENS_R[r];

  const bal = new Float64Array(N_MONTHS);
  const bk = new Float64Array(N_MONTHS * 5);
  const fl = new Float64Array(N_MONTHS * 30);
  const co = new Float64Array(N_MONTHS);
  const nco = new Float64Array(N_MONTHS);
  const allow = new Float64Array(N_MONTHS);
  const acc = new Float64Array(N_MONTHS);

  // Balance path, anchored at Aug 2026 and grown forward.
  const growth = new Float64Array(N_MONTHS);
  for (let k = 0; k < N_MONTHS; k++) {
    const m = ym(k).m;
    const seasonal = p === 2 ? (m === 11 ? 0.012 : m === 0 ? -0.009 : 0) : 0;
    growth[k] = GROWTH[p] * jit(0.35) + seasonal;
  }
  let end = BOOK_GBP * weight;
  for (let k = N_MONTHS - 1; k >= 0; k--) {
    bal[k] = end;
    end /= 1 + growth[k];
  }
  const startBal0 = end;

  let s = [0.965, 0.014, 0.008, 0.005, 0.008];
  const T = Array.from({ length: 5 }, () => new Array<number>(6).fill(0));
  const accFactor = AVG_BAL[p] * BAND_AVG[b] * jit(0.08);

  for (let k = -BURN; k < N_MONTHS; k++) {
    const kk = Math.max(k, 0);
    const st = Math.max(0.85, 1 + drift(k) * sens);
    const season = SEASON[ym(k).m];
    const macro = k < 0 ? 1 : MACRO_NOISE[k];
    const noise = k < 0 ? 1 : jit(0.035);

    const e = Math.min(
      0.2,
      E0 * BAND_E[b] * PROD_E[p] * CHAN_E[c] * REGION_E[r] * segJit * st * season * macro * noise,
    );
    const rollSt = st ** 0.6;
    const cureSt = 1 / Math.sqrt(st);

    // Current
    T[0][0] = 1 - e;
    T[0][1] = e;
    // 1–29
    const c1 = C1[b] * cureSt * cureJit;
    const r1 = Math.min(0.6, R1[b] * PROD_R[p] * rollSt * rollJit * noise);
    T[1][0] = c1;
    T[1][2] = r1;
    T[1][1] = 1 - c1 - r1;
    // 30–59
    const c2 = C2[b] * cureSt * cureJit;
    const c2b1 = C2B1[b];
    const r2 = Math.min(0.7, R2[b] * PROD_R[p] * rollSt * rollJit * (k < 0 ? 1 : STRAIN2(k)) * macro);
    T[2][0] = c2;
    T[2][1] = c2b1;
    T[2][3] = r2;
    T[2][4] = 0.004;
    T[2][2] = 1 - c2 - c2b1 - r2 - 0.004;
    // 60–89
    const c3 = C3[b] * cureSt;
    const r3 = Math.min(0.8, R3[b] * st ** 0.4 * rollJit * (k < 0 ? 1 : STRAIN3(k)));
    T[3][0] = c3;
    T[3][1] = 0.03;
    T[3][2] = 0.07;
    T[3][4] = r3;
    T[3][5] = 0.008;
    T[3][3] = 1 - c3 - 0.03 - 0.07 - r3 - 0.008;
    // 90+
    const c4 = C4[b] * cureSt;
    const co4 = CO_RATE[p] * (k < 0 ? 1 : jit(0.05));
    T[4][0] = c4;
    T[4][1] = 0.004;
    T[4][2] = 0.008;
    T[4][3] = 0.012;
    T[4][5] = co4;
    T[4][4] = 1 - c4 - 0.024 - co4;

    // Step the chain on shares.
    const next = [0, 0, 0, 0, 0];
    let coShare = 0;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) next[j] += s[i] * T[i][j];
      coShare += s[i] * T[i][5];
    }
    // Charged-off balance is replaced by new lending, which lands in Current;
    // growth dilutes arrears the same way.
    next[0] += coShare;
    const g = k < 0 ? GROWTH[p] : growth[kk];
    for (let j = 0; j < 5; j++) next[j] /= 1 + g;
    next[0] += g / (1 + g);

    if (k >= 0) {
      const startBal = k === 0 ? startBal0 : bal[k - 1];
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 6; j++) fl[k * 30 + i * 6 + j] = startBal * s[i] * T[i][j];
      for (let j = 0; j < 5; j++) bk[k * 5 + j] = bal[k] * next[j];
      co[k] = startBal * coShare;
      nco[k] = co[k] * (1 - RECOVERY[p]);
      // Model recalibration overlay drifts up slowly through 2026.
      const overlay = 1 + Math.max(0, k - 20) * 0.004;
      allow[k] =
        overlay *
        (bk[k * 5] * LOSS_CURRENT[p] * BAND_PD[b] +
          bk[k * 5 + 1] * LOSS_ARREARS[0] +
          bk[k * 5 + 2] * LOSS_ARREARS[1] +
          bk[k * 5 + 3] * LOSS_ARREARS[2] +
          bk[k * 5 + 4] * LOSS_NPL[p]);
      acc[k] = Math.round(bal[k] / accFactor);
    }
    s = next;
  }

  return {
    id: `${p}${r}${b}${c}`,
    p,
    r,
    b,
    c,
    bal,
    bk,
    fl,
    co,
    nco,
    allow,
    acc,
    sens,
  };
}

export const SEGMENTS: Segment[] = [];
for (let p = 0; p < 4; p++)
  for (let r = 0; r < 6; r++)
    for (let b = 0; b < 5; b++)
      for (let c = 0; c < 3; c++) {
        if (CHAN_SHARE[p][c] === 0) continue;
        const w = PROD_SHARE[p] * REGION_SHARE[r] * BAND_SHARE[p][b] * CHAN_SHARE[p][c] * jit(0.15);
        SEGMENTS.push(simulate(p, r, b, c, w));
      }

/* ------------------------------------------------------------------ *
 * Aggregation
 * ------------------------------------------------------------------ */

export interface Agg {
  n: number;
  bal: Float64Array;
  bk: Float64Array;
  fl: Float64Array;
  co: Float64Array;
  nco: Float64Array;
  allow: Float64Array;
  acc: Float64Array;
}

export function aggregate(segs: Segment[]): Agg {
  const a: Agg = {
    n: segs.length,
    bal: new Float64Array(N_MONTHS),
    bk: new Float64Array(N_MONTHS * 5),
    fl: new Float64Array(N_MONTHS * 30),
    co: new Float64Array(N_MONTHS),
    nco: new Float64Array(N_MONTHS),
    allow: new Float64Array(N_MONTHS),
    acc: new Float64Array(N_MONTHS),
  };
  for (const s of segs) {
    for (let k = 0; k < N_MONTHS; k++) {
      a.bal[k] += s.bal[k];
      a.co[k] += s.co[k];
      a.nco[k] += s.nco[k];
      a.allow[k] += s.allow[k];
      a.acc[k] += s.acc[k];
    }
    for (let i = 0; i < N_MONTHS * 5; i++) a.bk[i] += s.bk[i];
    for (let i = 0; i < N_MONTHS * 30; i++) a.fl[i] += s.fl[i];
  }
  return a;
}

const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

export const metrics = {
  dpd30: (a: Agg, k: number) => safe(a.bk[k * 5 + 2] + a.bk[k * 5 + 3] + a.bk[k * 5 + 4], a.bal[k]),
  npl: (a: Agg, k: number) => safe(a.bk[k * 5 + 4], a.bal[k]),
  nco: (a: Agg, k: number) =>
    safe(a.nco[k] * 12, k === 0 ? a.bal[0] : (a.bal[k] + a.bal[k - 1]) / 2),
  coverage: (a: Agg, k: number) => safe(a.allow[k], a.bk[k * 5 + 4]),
  bucketShare: (a: Agg, k: number, j: number) => safe(a.bk[k * 5 + j], a.bal[k]),
  /** Roll rate i → j in month k, as a share of the start-of-month bucket balance. */
  roll: (a: Agg, k: number, i: number, j: number) => {
    let row = 0;
    for (let d = 0; d < 6; d++) row += a.fl[k * 30 + i * 6 + d];
    return safe(a.fl[k * 30 + i * 6 + j], row);
  },
  flow: (a: Agg, k: number, i: number, j: number) => a.fl[k * 30 + i * 6 + j],
  rowStart: (a: Agg, k: number, i: number) => {
    let row = 0;
    for (let d = 0; d < 6; d++) row += a.fl[k * 30 + i * 6 + d];
    return row;
  },
};

/* ------------------------------------------------------------------ *
 * Vintages: quarterly originations 2023 Q3 … 2026 Q1
 * ------------------------------------------------------------------ */

export interface Vintage {
  id: string;
  label: string;
  short: string;
  /** Origination month index (middle month of the quarter; 0 = Mar 2024). */
  orig: number;
  /** Credit-quality factor vs a neutral vintage (2024 was tightened). */
  factor: number;
  /** In the 2023–24 reference set. */
  ref: boolean;
}

export const MAX_MOB = 36;

export const VINTAGES: Vintage[] = [
  ["2023 Q3", -7, 1.05],
  ["2023 Q4", -4, 1.03],
  ["2024 Q1", -1, 0.97],
  ["2024 Q2", 2, 0.95],
  ["2024 Q3", 5, 0.955],
  ["2024 Q4", 8, 0.98],
  ["2025 Q1", 11, 1.03],
  ["2025 Q2", 14, 1.07],
  ["2025 Q3", 17, 1.1],
  ["2025 Q4", 20, 1.13],
  ["2026 Q1", 23, 1.15],
].map(([label, orig, factor]) => {
  const l = label as string;
  return {
    id: l.replace(" ", ""),
    label: l,
    short: `${l.slice(2, 4)}${l.slice(5)}`,
    orig: orig as number,
    factor: factor as number,
    ref: l.startsWith("2023") || l.startsWith("2024"),
  };
});

export const mobAt = (v: Vintage, asOf: number) => Math.min(MAX_MOB, asOf - v.orig);

/** Ultimate (36 MOB) ever-30+ and cumulative charge-off, % of originated balance. */
const L30_BAND = [0.016, 0.03, 0.055, 0.1, 0.18];
const L30_PROD = [1, 0.75, 1.22, 1.32];
const LCO_BAND = [0.007, 0.014, 0.028, 0.055, 0.105];
const LCO_PROD = [1, 0.42, 1.3, 1.35];
/** Curve speed (months): POS and cards season faster than car finance. */
const TAU = [13, 15.5, 10.5, 8.5];
/** Quarterly growth of originations by product (POS scaling fastest). */
const VOL_GROWTH = [0.012, 0.008, 0.01, 0.055];

function shape(m: number, tau: number, k: number) {
  if (m <= 0) return 0;
  const f = (x: number) => 1 - Math.exp(-((x / tau) ** k));
  return f(m) / f(MAX_MOB);
}

/** curves[metric][v][p][b] → Float64Array(37). metric 0 = ever 30+, 1 = cum. charge-off. */
const CURVES: Float64Array[][][][] = [0, 1].map((metric) =>
  VINTAGES.map(() =>
    [0, 1, 2, 3].map((p) =>
      [0, 1, 2, 3, 4].map((b) => {
        const arr = new Float64Array(MAX_MOB + 1);
        const L =
          metric === 0 ? L30_BAND[b] * L30_PROD[p] : LCO_BAND[b] * LCO_PROD[p];
        let level = 0;
        let prevTarget = 0;
        for (let m = 1; m <= MAX_MOB; m++) {
          const target =
            metric === 0
              ? L * shape(m, TAU[p], 1.55)
              : L * shape(m - 5, TAU[p] * 1.15, 1.7);
          // Noisy but monotone: jitter the increment, never the level.
          level += Math.max(0, target - prevTarget) * jit(0.12);
          arr[m] = level;
          prevTarget = target;
        }
        return arr;
      }),
    ),
  ),
);

/** Originated balance per vintage per segment, and the segment's curve multiplier. */
const VOL = VINTAGES.map((_, vi) =>
  SEGMENTS.map((s) => s.bal[0] * (1 + VOL_GROWTH[s.p]) ** vi * 0.06 * jit(0.1)),
);
const MULT = VINTAGES.map((v) =>
  SEGMENTS.map((s) => {
    const base = CHAN_E[s.c] * REGION_E[s.r];
    const vf = 1 + (v.factor - 1) * Math.min(2.5, 0.45 + 0.55 * s.sens);
    return base * vf;
  }),
);
const SEG_INDEX = new Map(SEGMENTS.map((s, i) => [s, i]));

export interface VintageCurve {
  vintage: Vintage;
  /** Originated balance in the slice, £. */
  volume: number;
  /** Values by MOB 0..mob (fractions). */
  values: number[];
  mob: number;
}

/** Vintage curves for a slice of segments, truncated at the as-of month. */
export function vintageCurves(segs: Segment[], metric: 0 | 1, asOf: number): VintageCurve[] {
  const out: VintageCurve[] = [];
  VINTAGES.forEach((v, vi) => {
    const mob = mobAt(v, asOf);
    if (mob < 0) return;
    const w = new Float64Array(20);
    let vol = 0;
    for (const s of segs) {
      const si = SEG_INDEX.get(s)!;
      const volume = VOL[vi][si];
      vol += volume;
      w[s.p * 5 + s.b] += volume * MULT[vi][si];
    }
    const values: number[] = [];
    for (let m = 0; m <= mob; m++) {
      let acc = 0;
      for (let pb = 0; pb < 20; pb++) {
        if (w[pb] === 0) continue;
        acc += w[pb] * CURVES[metric][vi][Math.floor(pb / 5)][pb % 5][m];
      }
      values.push(safe(acc, vol));
    }
    out.push({ vintage: v, volume: vol, values, mob });
  });
  return out;
}

/** Volume-weighted average of the 2023–24 vintages, by MOB. */
export function referenceCurve(curves: VintageCurve[]): (number | null)[] {
  const ref = curves.filter((c) => c.vintage.ref);
  const out: (number | null)[] = [];
  for (let m = 0; m <= MAX_MOB; m++) {
    let num = 0;
    let den = 0;
    for (const c of ref) {
      if (m > c.mob) continue;
      num += c.values[m] * c.volume;
      den += c.volume;
    }
    out.push(den > 0 ? num / den : null);
  }
  return out;
}

export const DIMS = {
  product: { key: "p", options: PRODUCTS },
  region: { key: "r", options: REGIONS },
  band: { key: "b", options: BANDS },
  channel: { key: "c", options: CHANNELS },
} as const;
