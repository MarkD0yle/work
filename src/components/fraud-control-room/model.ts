/* Fraud Control Room: the seeded stream model.
 *
 * Everything here is a pure function of time and a seed, so the page can be
 * "live" without ever calling Math.random(): the clock advances, and the
 * numbers for any 5-minute bucket, any 2-second KPI tick and any flagged
 * transaction are simply looked up.
 *
 *  - Expected flow per (5-min bucket of day × channel × scheme × MCC group):
 *    volume from a diurnal curve and mix shares, ticket sizes, fraud bps and
 *    decline rates by channel and MCC, with an overnight fraud lift.
 *  - Today (and yesterday afternoon, for the rolling 24h) is generated at full
 *    cell grain with noise and three attack overlays.
 *  - The 30 previous days are generated at channel × scheme grain; they feed
 *    the same-time-of-day normal band (p10–p90) and the "same time last week"
 *    deltas.
 *  - The flagged-transaction feed is a transaction-level stream: row k arrives
 *    at a seeded time 2–3 s after row k−1 and is generated from k alone.
 *
 * Time is seconds since 00:00 on Tue 22 Sep 2026 (BST); negative is yesterday.
 */

export type ChannelId = "cp" | "cnp" | "wallet";
export type SchemeId = "visa" | "mc" | "amex";
export type WindowId = "15m" | "1h" | "24h";

export const CHANNELS: { id: ChannelId; label: string; short: string }[] = [
  { id: "cp", label: "Card present", short: "CP" },
  { id: "cnp", label: "Card not present", short: "CNP" },
  { id: "wallet", label: "Wallet", short: "Wallet" },
];

export const SCHEMES: { id: SchemeId; label: string; short: string }[] = [
  { id: "visa", label: "Visa", short: "Visa" },
  { id: "mc", label: "Mastercard", short: "MC" },
  { id: "amex", label: "Amex", short: "Amex" },
];

export const MCCS = [
  "Travel",
  "Electronics",
  "Gaming & digital",
  "Grocery",
  "Fuel",
  "Fashion",
  "Crypto & FX",
  "Gift cards",
] as const;

export const WINDOWS: { id: WindowId; label: string; sec: number; long: string }[] = [
  { id: "15m", label: "15m", sec: 900, long: "15 min" },
  { id: "1h", label: "1h", sec: 3600, long: "1 hour" },
  { id: "24h", label: "24h", sec: 86400, long: "24 hours" },
];

export const DAY_SEC = 86400;
export const BUCKET_SEC = 300;
export const BPD = 288; // 5-min buckets per day
/** "Now" when the page opens: Tue 22 Sep 2026, 14:39:20 BST. */
export const ANCHOR_SEC = 14 * 3600 + 39 * 60 + 20;
/** Wall-clock ms for 00:00 today, used as a UTC stamp so Highcharts prints BST. */
export const TODAY_MS = Date.UTC(2026, 8, 22);

const NC = 3; // channels
const NS = 3; // schemes
const NM = 8; // MCC groups
export const NCELL = NC * NS * NM;
const NCOMBO = NC * NS;
const NMET = 5;
/** Metric slots in every cell vector. */
export const N = 0; // transactions
export const V = 1; // sales value £
export const F = 2; // fraud value £ (losses on approved sales)
export const D = 3; // declined transactions
export const B = 4; // value auto-blocked by rules £

export const cellIndex = (ch: number, sch: number, m: number) => (ch * NS + sch) * NM + m;

/* --- seeded noise ------------------------------------------------------ */

/** Counter-based PRNG: the same inputs always give the same number in [0, 1). */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = 0x811c9dc5 ^ Math.imul(a | 0, 0x9e3779b1);
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (c | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ (d | 0), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x165667b1);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** ≈ N(0, 1) from four seeded uniforms. */
export function gauss(a: number, b = 0, c = 0, d = 0): number {
  return (
    (hash(a, b, c, d) +
      hash(a + 7919, b, c, d) +
      hash(a, b + 104729, c, d) +
      hash(a, b, c + 1299709, d) -
      2) *
    1.732
  );
}

/** Mean-reverting walk for tick k: a decayed sum of seeded shocks, sd ≈ 1. */
export function walk(k: number, stream: number): number {
  let s = 0;
  let w = 1;
  for (let i = 0; i < 16; i += 1) {
    s += w * gauss(k - i + 100000, stream, 91);
    w *= 0.8;
  }
  return s * 0.6;
}

/* --- expected flow ---------------------------------------------------- */

/** Wrapped gaussian bump on the 24h clock. */
const bump = (t: number, mu: number, s: number) =>
  Math.exp(-0.5 * ((t - mu) / s) ** 2) +
  Math.exp(-0.5 * ((t - mu - 24) / s) ** 2) +
  Math.exp(-0.5 * ((t - mu + 24) / s) ** 2);

const rawDiurnal = (t: number) =>
  0.07 + 0.72 * bump(t, 12.8, 3.3) + 0.55 * bump(t, 18.6, 2.3) + 0.22 * bump(t, 8.4, 1.2);
const DIURNAL_MAX = Math.max(...Array.from({ length: 288 }, (_, i) => rawDiurnal(i / 12)));
const diurnal = (t: number) => rawDiurnal(t) / DIURNAL_MAX;

const MCC_TIME: ((t: number) => number)[] = [
  (t) => 1 + 0.3 * bump(t, 10, 3),
  (t) => 1 + 0.2 * bump(t, 20, 3),
  (t) => 0.6 + 1.3 * bump(t, 21.5, 3.2),
  (t) => 0.7 + 0.6 * bump(t, 11, 3.5) + 0.3 * bump(t, 17.5, 1.5),
  (t) => 0.8 + 0.5 * bump(t, 7.8, 1.3) + 0.4 * bump(t, 17.2, 1.5),
  (t) => 0.9 + 0.3 * bump(t, 20.5, 2.5),
  (t) => 0.8 + 0.5 * bump(t, 22, 4),
  (t) => 1 + 0.2 * bump(t, 19, 3),
];

const PEAK_PER_BUCKET = 3400 * 5; // ~3.4k transactions a minute at the lunchtime peak
const CH_SHARE = [0.52, 0.33, 0.15];
const SCH_SHARE = [0.64, 0.31, 0.05];
const MCC_SHARE_RAW = [
  [2, 4, 1, 44, 20, 24, 1, 4],
  [7, 9, 18, 12, 1, 30, 6, 17],
  [3, 6, 10, 38, 14, 24, 1, 4],
];
const MCC_SHARE = MCC_SHARE_RAW.map((row) => {
  const s = row.reduce((a, b) => a + b, 0);
  return row.map((x) => x / s);
});
const TICKET = [280, 190, 22, 38, 58, 72, 340, 60];
const CH_TICKET = [0.92, 1.1, 0.8];
const SCH_TICKET = [0.96, 1.0, 1.55];
/** Fraud losses, bps of sales value, before the overnight lift. */
const BPS = [
  [1.9, 2.5, 3.7, 0.5, 1.6, 1.2, 7.4, 5.6],
  [8.7, 13.6, 18.6, 2.5, 5, 6.8, 34, 30],
  [3.7, 5.6, 7.4, 0.7, 1.9, 2.5, 15.5, 12.4],
];
const SCH_FRAUD = [1.0, 1.12, 0.72];
const DECL = [0.021, 0.064, 0.017];
const DECL_MCC = [1.3, 1.2, 1.6, 0.9, 1.0, 1.0, 2.4, 1.8];
/** Share of sales value blocked as false positives. */
const FP_RATE = [0.0005, 0.0019, 0.0007];
/** Blocked true-fraud value per £1 of fraud that got through (~65% catch). */
const CATCH = 1.85;

const nightFraud = (t: number) => 1 + 1.1 * bump(t, 3, 2.2);
const nightDecl = (t: number) => 1 + 0.4 * bump(t, 3, 2.5);

/* EXP[(b * NCELL + cell) * NMET + metric]: expected flow for a normal weekday.
 * Slot B holds only the false-positive part of blocked value; the fraud part
 * is added after noise so it tracks realised fraud. */
const EXP = new Float64Array(BPD * NCELL * NMET);
const EXPC = new Float64Array(BPD * NCOMBO * NMET);
for (let b = 0; b < BPD; b += 1) {
  const t = (b + 0.5) / 12;
  const di = diurnal(t);
  for (let ch = 0; ch < NC; ch += 1) {
    for (let sch = 0; sch < NS; sch += 1) {
      for (let m = 0; m < NM; m += 1) {
        const n = PEAK_PER_BUCKET * di * CH_SHARE[ch] * SCH_SHARE[sch] * MCC_SHARE[ch][m] * MCC_TIME[m](t);
        const v = n * TICKET[m] * CH_TICKET[ch] * SCH_TICKET[sch];
        const f = (v * BPS[ch][m] * SCH_FRAUD[sch] * nightFraud(t)) / 10000;
        const d = n * DECL[ch] * DECL_MCC[m] * nightDecl(t);
        const fp = v * FP_RATE[ch];
        const o = (b * NCELL + cellIndex(ch, sch, m)) * NMET;
        EXP[o] = n;
        EXP[o + 1] = v;
        EXP[o + 2] = f;
        EXP[o + 3] = d;
        EXP[o + 4] = fp;
        const oc = (b * NCOMBO + ch * NS + sch) * NMET;
        for (let k = 0; k < NMET; k += 1) EXPC[oc + k] += EXP[o + k];
      }
    }
  }
}

/* --- attacks -------------------------------------------------------------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Trapezoid intensity: ramps in over `rampIn`, holds, ramps out over `rampOut`. */
const trapezoid = (s: number, start: number, end: number, rampIn: number, rampOut: number) =>
  Math.min(clamp01((s - start) / rampIn), clamp01((end - s) / rampOut));

export const ATTACKS = [
  {
    id: "gift",
    label: "Gift-card BIN attack",
    detail: "CNP · Gift cards",
    channels: [1, 2],
    start: 13 * 3600 + 40 * 60,
    end: Infinity,
  },
  {
    id: "ato",
    label: "Account takeover run",
    detail: "CNP · Electronics",
    channels: [1, 2],
    start: 1 * 3600 + 10 * 60,
    end: 3 * 3600 + 45 * 60,
  },
  {
    id: "testing",
    label: "Card-testing burst",
    detail: "CNP · Gaming",
    channels: [1],
    start: -(1 * 3600 + 40 * 60),
    end: 40 * 60,
  },
] as const;

/** Intensity 0..1 of each attack at time s. */
export function attackIntensity(s: number) {
  const gift =
    s < ATTACKS[0].start ? 0 : clamp01((s - ATTACKS[0].start) / 1800) * (0.82 + 0.18 * Math.sin(s / 700));
  const ato = trapezoid(s, ATTACKS[1].start, ATTACKS[1].end, 1500, 1800);
  const testing = trapezoid(s, ATTACKS[2].start, ATTACKS[2].end, 900, 1500);
  return { gift, ato, testing };
}

/* --- today & live: full cell grain ------------------------------------- */

const dayOf = (bucket: number) => -Math.floor(bucket / BPD); // 0 today, 1 yesterday…
const bucketOfDay = (bucket: number) => bucket - Math.floor(bucket / BPD) * BPD;
const isWeekend = (d: number) => {
  const dow = (((2 - d) % 7) + 7) % 7; // Tue 22 Sep = 2
  return dow === 0 || dow === 6;
};
const dayVol = (d: number) => (isWeekend(d) ? 0.9 : 1) * (1 + 0.035 * gauss(d, 11));
const dayFraud = (d: number) => 1 + 0.1 * gauss(d, 12);

const cellCache = new Map<number, Float64Array>();

/** All 72 cell vectors for a 5-min bucket (relative to today). */
export function cellsAt(bucket: number): Float64Array {
  const hit = cellCache.get(bucket);
  if (hit) return hit;
  if (cellCache.size > 1200) cellCache.clear();
  const d = dayOf(bucket);
  const b = bucketOfDay(bucket);
  const mid = bucket * BUCKET_SEC + BUCKET_SEC / 2;
  const atk = attackIntensity(mid);
  // Today and yesterday afternoon are the live stream: a normal day's level.
  const dv = dayVol(d);
  const df = d === 0 ? 1.02 : 0.99;
  const out = new Float64Array(NCELL * NMET);
  const key = bucket + 50000;
  for (let ch = 0; ch < NC; ch += 1) {
    for (let sch = 0; sch < NS; sch += 1) {
      for (let m = 0; m < NM; m += 1) {
        const c = cellIndex(ch, sch, m);
        const e = (b * NCELL + c) * NMET;
        let volK = dv * (1 + 0.05 * gauss(key, c, 31));
        let fraudK = df * Math.exp(0.2 * gauss(key, c, 32) - 0.02);
        let declK = 1 + 0.07 * gauss(key, c, 33);
        // Attack overlays, all card-not-present with a smaller wallet echo.
        if (m === 7 && ch !== 0) {
          const w = ch === 1 ? 1 : 0.35;
          volK *= 1 + 0.3 * atk.gift * w;
          fraudK *= 1 + 3.4 * atk.gift * w;
          declK *= 1 + 1.7 * atk.gift * w;
        }
        if (m === 1 && ch !== 0) {
          const w = ch === 1 ? 1 : 0.5;
          fraudK *= 1 + 3.2 * atk.ato * w + 0.5 * atk.gift * w;
          declK *= 1 + 0.6 * atk.ato * w;
        }
        if (m === 2 && ch === 1) {
          volK *= 1 + 0.9 * atk.testing;
          fraudK *= 1 + 1.6 * atk.testing;
          declK *= 1 + 3.5 * atk.testing;
        }
        const o = c * NMET;
        const n = EXP[e] * volK;
        const v = EXP[e + 1] * volK;
        const f = EXP[e + 2] * volK * fraudK;
        out[o] = n;
        out[o + 1] = v;
        out[o + 2] = f;
        out[o + 3] = EXP[e + 3] * volK * declK;
        out[o + 4] = EXP[e + 4] * volK * (1 + 0.1 * gauss(key, c, 34)) + f * CATCH;
      }
    }
  }
  cellCache.set(bucket, out);
  return out;
}

/* --- 30-day history: channel × scheme grain ------------------------------ */

const HIST_DAYS = 30;
/* HIST[((d - 1) * BPD + b) * NCOMBO + combo) * NMET + metric], d = 1..30 */
const HIST = new Float32Array(HIST_DAYS * BPD * NCOMBO * NMET);
for (let d = 1; d <= HIST_DAYS; d += 1) {
  const dv = dayVol(d);
  const df = dayFraud(d);
  for (let b = 0; b < BPD; b += 1) {
    for (let k = 0; k < NCOMBO; k += 1) {
      const e = (b * NCOMBO + k) * NMET;
      const volK = dv * (1 + 0.03 * gauss(d, b, k, 21));
      const fraudK = df * Math.exp(0.16 * gauss(d, b, k, 22) - 0.013);
      const declK = 1 + 0.06 * gauss(d, b, k, 23);
      const o = (((d - 1) * BPD + b) * NCOMBO + k) * NMET;
      const f = EXPC[e + 2] * volK * fraudK;
      HIST[o] = EXPC[e] * volK;
      HIST[o + 1] = EXPC[e + 1] * volK;
      HIST[o + 2] = f;
      HIST[o + 3] = EXPC[e + 3] * volK * declK;
      HIST[o + 4] = EXPC[e + 4] * volK + f * CATCH;
    }
  }
}

/* --- selection & aggregation ----------------------------------------------- */

export type Selection = {
  ch: boolean[]; // by channel index
  sch: boolean[]; // by scheme index
  key: string; // stable id for seeding
  cells: number[];
  combos: number[];
};

export function makeSelection(channel: ChannelId | "all", schemes: Record<SchemeId, boolean>): Selection {
  const ch = CHANNELS.map((c) => channel === "all" || c.id === channel);
  const sch = SCHEMES.map((s) => schemes[s.id]);
  const cells: number[] = [];
  const combos: number[] = [];
  for (let c = 0; c < NC; c += 1) {
    for (let s = 0; s < NS; s += 1) {
      if (!ch[c] || !sch[s]) continue;
      combos.push(c * NS + s);
      for (let m = 0; m < NM; m += 1) cells.push(cellIndex(c, s, m));
    }
  }
  const key = ch.map((x) => (x ? 1 : 0)).join("") + sch.map((x) => (x ? 1 : 0)).join("");
  return { ch, sch, key, cells, combos };
}

export type Agg = { n: number; v: number; f: number; d: number; b: number };
const emptyAgg = (): Agg => ({ n: 0, v: 0, f: 0, d: 0, b: 0 });

/** Per (channel, MCC) sums over [from, to), weighting part-covered buckets. */
export function breakdown(from: number, to: number, sel: Selection): Float64Array {
  const out = new Float64Array(NC * NM * NMET);
  const b0 = Math.floor(from / BUCKET_SEC);
  const b1 = Math.ceil(to / BUCKET_SEC) - 1;
  for (let bk = b0; bk <= b1; bk += 1) {
    const s = bk * BUCKET_SEC;
    const w = (Math.min(to, s + BUCKET_SEC) - Math.max(from, s)) / BUCKET_SEC;
    if (w <= 0) continue;
    const cells = cellsAt(bk);
    for (const c of sel.cells) {
      const ch = Math.floor(c / (NS * NM));
      const m = c % NM;
      const o = (ch * NM + m) * NMET;
      const i = c * NMET;
      for (let k = 0; k < NMET; k += 1) out[o + k] += cells[i + k] * w;
    }
  }
  return out;
}

export function totalOf(bd: Float64Array): Agg {
  const a = emptyAgg();
  for (let i = 0; i < bd.length; i += NMET) {
    a.n += bd[i];
    a.v += bd[i + 1];
    a.f += bd[i + 2];
    a.d += bd[i + 3];
    a.b += bd[i + 4];
  }
  return a;
}

/** History sums over [from, to) (seconds relative to today, must be ≥ 1 day back). */
export function histSum(from: number, to: number, sel: Selection): Agg {
  const a = emptyAgg();
  const b0 = Math.floor(from / BUCKET_SEC);
  const b1 = Math.ceil(to / BUCKET_SEC) - 1;
  for (let bk = b0; bk <= b1; bk += 1) {
    const s = bk * BUCKET_SEC;
    const w = (Math.min(to, s + BUCKET_SEC) - Math.max(from, s)) / BUCKET_SEC;
    const d = dayOf(bk);
    if (w <= 0 || d < 1 || d > HIST_DAYS) continue;
    const b = bucketOfDay(bk);
    for (const k of sel.combos) {
      const o = (((d - 1) * BPD + b) * NCOMBO + k) * NMET;
      a.n += HIST[o] * w;
      a.v += HIST[o + 1] * w;
      a.f += HIST[o + 2] * w;
      a.d += HIST[o + 3] * w;
      a.b += HIST[o + 4] * w;
    }
  }
  return a;
}

/** Fraud bps for one bucket across the selection. */
export function bucketBps(bucket: number, sel: Selection): number {
  const cells = cellsAt(bucket);
  let v = 0;
  let f = 0;
  for (const c of sel.cells) {
    v += cells[c * NMET + 1];
    f += cells[c * NMET + 2];
  }
  return v > 0 ? (f / v) * 10000 : 0;
}

/** 30-day same-time-of-day normal range (p10–p90) of fraud bps, by bucket of day. */
export function normalBand(sel: Selection): { lo: Float64Array; hi: Float64Array } {
  const lo = new Float64Array(BPD);
  const hi = new Float64Array(BPD);
  const vals = new Float64Array(HIST_DAYS);
  const q = (sorted: Float64Array, p: number) => {
    const x = p * (sorted.length - 1);
    const i = Math.floor(x);
    return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (x - i);
  };
  for (let b = 0; b < BPD; b += 1) {
    for (let d = 1; d <= HIST_DAYS; d += 1) {
      let v = 0;
      let f = 0;
      for (const k of sel.combos) {
        const o = (((d - 1) * BPD + b) * NCOMBO + k) * NMET;
        v += HIST[o + 1];
        f += HIST[o + 2];
      }
      vals[d - 1] = v > 0 ? (f / v) * 10000 : 0;
    }
    vals.sort();
    lo[b] = q(vals, 0.1);
    hi[b] = q(vals, 0.9);
  }
  // Light circular smoothing: the band is a reference, not a second signal.
  const smooth = (a: Float64Array) =>
    a.map((_, i) => {
      let s = 0;
      for (let j = -2; j <= 2; j += 1) s += a[(i + j + BPD) % BPD];
      return s / 5;
    });
  return { lo: smooth(lo), hi: smooth(hi) };
}

export const bandIndex = bucketOfDay;

/** Fraud bps by hour of day × MCC over the rolling 24h ending in `bucketNow`. */
export function hourMccBps(bucketNow: number, sel: Selection): number[][] {
  const out: number[][] = [];
  const nowB = bucketOfDay(bucketNow);
  const dayStart = bucketNow - nowB; // bucket index of today 00:00
  for (let h = 0; h < 24; h += 1) {
    const f = new Float64Array(NM);
    const v = new Float64Array(NM);
    for (let i = 0; i < 12; i += 1) {
      const b = h * 12 + i;
      const bk = b <= nowB ? dayStart + b : dayStart - BPD + b;
      const cells = cellsAt(bk);
      for (const c of sel.cells) {
        const m = c % NM;
        v[m] += cells[c * NMET + 1];
        f[m] += cells[c * NMET + 2];
      }
    }
    out.push(Array.from(v, (vv, m) => (vv > 0 ? (f[m] / vv) * 10000 : 0)));
  }
  return out;
}

/* --- chargebacks --------------------------------------------------------- */

/** Fraud chargebacks received per day, by channel, and average value £. */
const CB_PER_DAY = [34, 128, 22];
const CB_AVG = [180, 342, 210];
const DAY_OF_MONTH = 22;

/** Chargebacks month to date at data time `s`, plus the same point last month. */
export function chargebacks(s: number, sel: Selection, anchorTick: number, tick: number) {
  let count = 0;
  let value = 0;
  let prior = 0;
  const elapsedDays = DAY_OF_MONTH - 1 + Math.min(ANCHOR_SEC, s) / DAY_SEC;
  for (const k of sel.combos) {
    const ch = Math.floor(k / NS);
    const sch = k % NS;
    const rate = CB_PER_DAY[ch] * SCH_SHARE[sch] * (sch === 2 ? 1.3 : 1);
    const c = rate * elapsedDays * (1 + 0.04 * gauss(k, 61));
    count += c;
    value += c * CB_AVG[ch] * SCH_TICKET[sch];
    prior += rate * elapsedDays * (0.93 + 0.05 * gauss(k, 62));
  }
  // Live arrivals: each 2s tick a chargeback file line may land on one combo.
  for (let j = anchorTick + 1; j <= tick; j += 1) {
    if (hash(j, 63) < 0.16) {
      const combo = Math.floor(hash(j, 64) * NCOMBO);
      if (sel.combos.includes(combo)) {
        count += 1;
        value += CB_AVG[Math.floor(combo / NS)];
      }
    }
  }
  return { count: Math.round(count), value, prior: Math.round(prior) };
}

/* --- rules ------------------------------------------------------------------ */

export type Rule = {
  id: string;
  name: string;
  mode: "live" | "shadow";
  /** Alerts per 10k transactions in a fully-affine cell. */
  rate: number;
  chAff: [number, number, number];
  mccAff: number[];
  prec: number;
  attack?: "gift" | "ato";
};

const ALL = [1, 1, 1, 1, 1, 1, 1, 1];
const only = (m: number, w = 1) => ALL.map((_, i) => (i === m ? w : 0));

export const RULES: Rule[] = [
  { id: "R-104", name: "CNP velocity 5 in 10 min", mode: "live", rate: 18, chAff: [0, 1, 0], mccAff: ALL, prec: 0.22 },
  { id: "R-112", name: "New device + high value", mode: "live", rate: 9, chAff: [0, 1, 0.6], mccAff: [1.5, 1.8, 0.4, 0.2, 0.1, 1, 1.6, 1], prec: 0.34, attack: "ato" },
  { id: "R-127", name: "Gift-card burst", mode: "live", rate: 120, chAff: [0.2, 1, 0.5], mccAff: only(7), prec: 0.41, attack: "gift" },
  { id: "R-131", name: "Crypto first use", mode: "live", rate: 260, chAff: [0, 1, 0.5], mccAff: only(6), prec: 0.18 },
  { id: "R-140", name: "IP / BIN country mismatch", mode: "live", rate: 30, chAff: [0, 1, 0.2], mccAff: ALL, prec: 0.07 },
  { id: "R-152", name: "Card testing under £2", mode: "live", rate: 25, chAff: [0, 1, 0], mccAff: [0.1, 0.1, 1.5, 0.1, 0, 0.1, 0.2, 0.5], prec: 0.52 },
  { id: "R-163", name: "Travel cross-border first use", mode: "live", rate: 150, chAff: [0.6, 1, 0.5], mccAff: only(0), prec: 0.12 },
  { id: "R-178", name: "Night electronics over £500", mode: "live", rate: 80, chAff: [0.3, 1, 0.8], mccAff: only(1), prec: 0.29, attack: "ato" },
  { id: "R-185", name: "Fuel pre-auth split", mode: "live", rate: 40, chAff: [1, 0, 0.6], mccAff: only(4), prec: 0.09 },
  { id: "R-190", name: "New wallet token, first spend", mode: "live", rate: 22, chAff: [0, 0, 1], mccAff: ALL, prec: 0.31 },
  { id: "M-01", name: "Neural score ≥ 850", mode: "live", rate: 11, chAff: [0.4, 1, 1], mccAff: ALL, prec: 0.58, attack: "gift" },
  { id: "R-196", name: "Contactless chain over £100/day", mode: "live", rate: 6, chAff: [1, 0, 0.4], mccAff: [0, 0, 0, 1, 1, 1, 0, 0], prec: 0.15 },
  { id: "S-207", name: "Gift card + new payee v2", mode: "shadow", rate: 70, chAff: [0, 1, 0.3], mccAff: only(7), prec: 0.55, attack: "gift" },
  { id: "S-212", name: "GBM score v4 ≥ 800", mode: "shadow", rate: 14, chAff: [0.5, 1, 1], mccAff: ALL, prec: 0.47 },
  { id: "S-219", name: "ATO session anomaly", mode: "shadow", rate: 10, chAff: [0, 1, 0.7], mccAff: [1, 1.5, 0.3, 0, 0, 0.6, 1, 0.3], prec: 0.38, attack: "ato" },
  { id: "S-224", name: "Merchant cluster risk", mode: "shadow", rate: 20, chAff: [0.3, 1, 0.6], mccAff: [0, 0, 1, 0, 0, 0, 1.2, 1], prec: 0.21 },
  { id: "S-230", name: "Mule account hop", mode: "shadow", rate: 8, chAff: [0, 0.8, 1], mccAff: [0, 0, 0, 0, 0, 0, 2, 1], prec: 0.44 },
  { id: "S-236", name: "Geo-velocity v2", mode: "shadow", rate: 9, chAff: [1, 1, 1], mccAff: ALL, prec: 0.11 },
];

export type RulePerf = Rule & { alerts: number; precision: number; confirmed: number };

/** Alert volume and precision per rule over the window, for the selection. */
export function rulePerformance(bd: Float64Array, from: number, to: number, sel: Selection, windowIdx: number): RulePerf[] {
  // Mean attack intensity over the window (sampled).
  let gift = 0;
  let ato = 0;
  for (let i = 0; i < 12; i += 1) {
    const a = attackIntensity(from + ((to - from) * (i + 0.5)) / 12);
    gift += a.gift / 12;
    ato += a.ato / 12;
  }
  return RULES.map((r, ri) => {
    let alerts = 0;
    for (let ch = 0; ch < NC; ch += 1) {
      for (let m = 0; m < NM; m += 1) {
        alerts += bd[(ch * NM + m) * NMET] * (r.rate / 10000) * r.chAff[ch] * r.mccAff[m];
      }
    }
    const lift = r.attack === "gift" ? gift : r.attack === "ato" ? ato : 0;
    alerts *= 1 + 1.6 * lift;
    alerts = Math.round(alerts);
    const noise = gauss(ri, Number.parseInt(sel.key, 2), windowIdx, 55);
    const spread = alerts < 30 ? 0.22 : 0.1;
    const precision = Math.max(0.02, Math.min(0.92, r.prec * (1 + 0.35 * lift) * Math.exp(spread * noise)));
    return { ...r, alerts, precision, confirmed: Math.round(alerts * precision) };
  });
}

/* --- flagged-transaction feed ---------------------------------------------- */

export type FeedRow = {
  id: number;
  t: number;
  ch: number;
  sch: number;
  m: number;
  merchant: string;
  country: string;
  amount: number;
  score: number;
  rule: Rule;
  pan: string;
};

const MERCHANTS: string[][] = [
  ["Aerolume Travel", "Brightfare Air", "Kestrel Holidays", "Portolan Rail"],
  ["Voltaic Direct", "Circuit Harbour", "Nimbus Tech Store", "Ohmstead"],
  ["PixelMint Games", "Arcadia Credits", "Quillsoft Digital", "Ember Arcade"],
  ["Greenbasket Market", "Hollow Oak Grocers", "Daily Crate", "Parsley & Co"],
  ["Northgate Fuel", "Petrolux", "Kinetic Forecourt"],
  ["Maison Verre", "Threadline", "Copper & Kin", "Atelier Nove"],
  ["Coinwharf", "Ledgerly FX", "Blockhaven Exchange", "Meridian Remit"],
  ["GiftVault", "Carddrop", "Presently Codes", "TokenTill"],
];
const ABROAD = ["US", "NG", "RO", "BR", "NL", "LT", "IN", "AE", "ID", "ES", "FR", "PH", "UA", "TR", "MY"];
const ALERT_MIX = [
  [0.08, 0.12, 0.02, 0.2, 0.22, 0.16, 0.05, 0.15],
  [0.14, 0.16, 0.16, 0.04, 0.01, 0.14, 0.14, 0.21],
  [0.1, 0.2, 0.1, 0.15, 0.1, 0.15, 0.08, 0.12],
];
const LIVE_RULES = RULES.filter((r) => r.mode === "live");

const pick = (weights: number[], u: number) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = u * total;
  for (let i = 0; i < weights.length; i += 1) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
};

const FEED_T0 = ANCHOR_SEC - 3 * 3600;
const feedTime = (k: number) => FEED_T0 + Math.floor(k * 2.5 + (hash(k, 401) - 0.5) * 0.9);
const feedCache = new Map<number, FeedRow>();

function feedRow(k: number): FeedRow {
  const hit = feedCache.get(k);
  if (hit) return hit;
  const t = feedTime(k);
  const u = (salt: number) => hash(k, 400 + salt);
  const gift = attackIntensity(t).gift;
  let ch: number;
  let m: number;
  let country: string;
  let amount: number;
  let score: number;
  let rule: Rule;
  if (u(1) < 0.32 * gift) {
    // The live BIN attack: round-value gift cards bought card-not-present abroad.
    ch = 1;
    m = 7;
    country = ["RO", "LT", "MD", "RO", "BG"][Math.floor(u(2) * 5)];
    amount = [50, 100, 150, 200, 250][Math.floor(u(3) * 5)];
    score = Math.round(820 + 175 * u(4));
    rule = RULES[u(5) < 0.8 ? 2 : 10];
  } else {
    ch = pick([0.17, 0.68, 0.15], u(1));
    m = pick(ALERT_MIX[ch], u(6));
    country = u(2) < 0.58 ? "GB" : ABROAD[Math.floor(u(7) * ABROAD.length)];
    amount = Math.max(1, Math.round(TICKET[m] * 1.3 * Math.exp(0.75 * gauss(k, 408)) * 100) / 100);
    score = Math.round(540 + 459 * Math.pow(u(4), 0.6));
    const weights = LIVE_RULES.map((r) => r.rate * r.chAff[ch] * r.mccAff[m] * (r.id === "R-163" || r.id === "R-131" ? 0.25 : 1));
    rule = weights.some((w) => w > 0) ? LIVE_RULES[pick(weights, u(5))] : RULES[10];
  }
  const sch = pick([0.6, 0.33, 0.07], u(8));
  const list = MERCHANTS[m];
  const row: FeedRow = {
    id: k,
    t,
    ch,
    sch,
    m,
    merchant: list[Math.floor(u(9) * list.length)],
    country,
    amount,
    score,
    rule,
    pan: String(Math.floor(u(10) * 10000)).padStart(4, "0"),
  };
  if (feedCache.size > 20000) feedCache.clear();
  feedCache.set(k, row);
  return row;
}

/** Newest-first flagged transactions visible at time `s` within the window. */
export function feedRows(s: number, windowSec: number, sel: Selection, limit: number) {
  const rows: FeedRow[] = [];
  let inWindow = 0;
  let k = Math.floor((s - FEED_T0) / 2.5) + 1;
  while (k >= 0 && feedTime(k) > s) k -= 1;
  const from = Math.max(s - windowSec, FEED_T0);
  for (; k >= 0; k -= 1) {
    const r = feedRow(k);
    if (r.t <= from) break;
    if (!sel.ch[r.ch] || !sel.sch[r.sch]) continue;
    inWindow += 1;
    if (rows.length < limit) rows.push(r);
  }
  return { rows, inWindow };
}
