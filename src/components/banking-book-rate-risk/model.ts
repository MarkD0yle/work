/* Banking Book Rate Risk (IRRBB / ALM): model.
 *
 * A fictional UK bank's banking book as of Mon 21 Sep 2026 close: ~£58bn
 * of assets and the liabilities that fund them, each with a contractual
 * repricing profile across thirteen buckets, plus the swap hedge programme
 * and a committed mortgage pipeline. Everything the page shows is derived
 * here from one `buildView(entity, horizon, assumptions)` call:
 *
 *  - ΔEVE per Basel shock = Σ notional repricing cash flow × (DF shocked −
 *    DF base) on a run-off balance sheet, with core non-maturity deposits
 *    spread over their behavioural life and fixed mortgages prepaying at
 *    the CPR.
 *  - ΔNII per shock = a month-by-month repricing simulation on a constant
 *    balance sheet: each tranche re-fixes at base + shock when it reprices,
 *    deposits pass through at the beta, administered rates floor at zero.
 *  - The repricing gap ladder, the ΔEVE waterfall, the hedge table and the
 *    limits table all read the same slotted tranches, so they agree with
 *    the scenario cards to the pound.
 *
 * Nothing here is random at run time: the one seeded PRNG is used once at
 * module load to disperse back-book coupons by vintage. */

export type Entity = "group" | "retail" | "corporate" | "treasury";
export type Horizon = "12" | "24" | "36";
export type ScenarioId = "par_up" | "par_dn" | "steep" | "flat" | "short_up" | "short_dn";
export type Status = "good" | "warn" | "bad";
export type Side = "asset" | "liability";
export type Purpose = "NMD hedge" | "Fixed mortgage hedge" | "Pipeline";
export type Direction = "receive" | "pay";
export type BucketId =
  | "on" | "1m" | "3m" | "6m" | "12m" | "2y" | "3y" | "5y" | "7y" | "10y" | "15y" | "15y+" | "nmd";

export const AS_OF = Date.UTC(2026, 8, 21); // Mon 21 Sep 2026 close
/** Tier 1 capital, £m. ΔEVE is expressed against it at every entity. */
export const TIER1 = 3200;

export const ENTITIES: { id: Entity; label: string }[] = [
  { id: "group", label: "Group" },
  { id: "retail", label: "UK Retail" },
  { id: "corporate", label: "Corporate" },
  { id: "treasury", label: "Treasury" },
];
export const ENTITY_LABEL = Object.fromEntries(ENTITIES.map((e) => [e.id, e.label])) as Record<Entity, string>;

/* ------------------------------------------------------------------ *
 * Assumptions (the right-rail sliders)
 * ------------------------------------------------------------------ */

export interface Assumptions {
  /** Deposit beta: share of a rate move passed to instant-access savings. 0–1. */
  beta: number;
  /** Core share of non-maturity deposits treated as stable. 0–1. */
  core: number;
  /** Behavioural life of core NMDs, years. Core is spread evenly to this point. */
  life: number;
  /** Fixed-mortgage conditional prepayment rate, per year. 0–0.25. */
  cpr: number;
  /** Share of the committed mortgage pipeline hedged with pay-fixed swaps. 0–1. */
  hedge: number;
}

export type AssumptionKey = keyof Assumptions;
export const ASSUMPTION_KEYS: AssumptionKey[] = ["beta", "core", "life", "cpr", "hedge"];

export const APPROVED: Assumptions = { beta: 0.45, core: 0.7, life: 4.5, cpr: 0.08, hedge: 0.6 };

export interface AssumptionMeta {
  key: AssumptionKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Which measures the assumption can move. */
  affects: { eve: boolean; nii: boolean };
}

export const ASSUMPTION_META: AssumptionMeta[] = [
  { key: "beta", label: "Deposit beta", hint: "Pass-through to instant-access savings", min: 0, max: 1, step: 0.01, affects: { eve: false, nii: true } },
  { key: "core", label: "NMD core share", hint: "Stable share of non-maturity deposits", min: 0, max: 1, step: 0.01, affects: { eve: true, nii: true } },
  { key: "life", label: "NMD behavioural life", hint: "Core spread evenly to this tenor", min: 1, max: 10, step: 0.1, affects: { eve: true, nii: false } },
  { key: "cpr", label: "Mortgage prepayment (CPR)", hint: "Fixed-rate book, per year", min: 0, max: 0.25, step: 0.005, affects: { eve: true, nii: true } },
  { key: "hedge", label: "Pipeline hedge ratio", hint: "Pay-fixed cover on committed offers", min: 0, max: 1, step: 0.01, affects: { eve: true, nii: true } },
];

/* ------------------------------------------------------------------ *
 * Limits
 * ------------------------------------------------------------------ */

export const LIMITS = {
  /** Supervisory outlier test: ΔEVE loss as % of Tier 1. */
  outlier: 15,
  /** Board limit on the same measure. */
  internal: 12,
  /** Early-warning trigger. */
  early: 10,
  /** |Cumulative 1y gap| as % of rate-sensitive assets. */
  gap1y: 20,
  gap1yEarly: 15,
  /** NII-at-risk over the horizon, £m loss. */
  nii: { "12": 150, "24": 400, "36": 700 } as Record<Horizon, number>,
};

/* ------------------------------------------------------------------ *
 * Buckets
 * ------------------------------------------------------------------ */

export interface Bucket {
  id: BucketId;
  label: string;
  /** Repricing window in years. The NMD core bucket has none. */
  lo: number;
  hi: number;
  /** Discounting point for EVE, years. */
  mid: number;
  /** Repricing point for the NII simulation, months. */
  months: number;
}

const B = (id: BucketId, label: string, lo: number, hi: number, months: number): Bucket => ({
  id, label, lo, hi, mid: (lo + hi) / 2, months,
});

/** The twelve time buckets plus the behaviouralised NMD core. */
export const BUCKETS: Bucket[] = [
  B("on", "O/N", 0, 1 / 365, 0),
  B("1m", "≤1m", 1 / 365, 1 / 12, 0.5),
  B("3m", "1–3m", 1 / 12, 0.25, 2),
  B("6m", "3–6m", 0.25, 0.5, 4.5),
  B("12m", "6–12m", 0.5, 1, 9),
  B("2y", "1–2y", 1, 2, 18),
  B("3y", "2–3y", 2, 3, 30),
  B("5y", "3–5y", 3, 5, 48),
  B("7y", "5–7y", 5, 7, 72),
  B("10y", "7–10y", 7, 10, 102),
  B("15y", "10–15y", 10, 15, 150),
  B("15y+", ">15y", 15, 25, 240),
  { id: "nmd", label: "NMD core", lo: NaN, hi: NaN, mid: NaN, months: 0 },
];
export const TIME_BUCKETS = BUCKETS.filter((b) => b.id !== "nmd");
export const BUCKET_BY_ID = Object.fromEntries(BUCKETS.map((b) => [b.id, b])) as Record<BucketId, Bucket>;

/** Coarse tenor groups for the ΔEVE waterfall. */
export interface Coarse { id: string; label: string; buckets: BucketId[] }
export const COARSE: Coarse[] = [
  { id: "le1y", label: "≤1y", buckets: ["on", "1m", "3m", "6m", "12m"] },
  { id: "1_3y", label: "1–3y", buckets: ["2y", "3y"] },
  { id: "3_5y", label: "3–5y", buckets: ["5y"] },
  { id: "5_10y", label: "5–10y", buckets: ["7y", "10y"] },
  { id: "gt10y", label: ">10y", buckets: ["15y", "15y+"] },
];
const COARSE_OF = new Map<BucketId, string>();
for (const c of COARSE) for (const b of c.buckets) COARSE_OF.set(b, c.id);

/* ------------------------------------------------------------------ *
 * Base curve and shocks
 * ------------------------------------------------------------------ */

/** SONIA / gilt zero curve, % continuously compounded, by tenor in years. */
export const CURVE: { t: number; rate: number; label: string }[] = [
  { t: 1 / 365, rate: 3.7, label: "O/N" },
  { t: 1 / 12, rate: 3.68, label: "1m" },
  { t: 0.25, rate: 3.62, label: "3m" },
  { t: 0.5, rate: 3.55, label: "6m" },
  { t: 1, rate: 3.48, label: "1y" },
  { t: 2, rate: 3.42, label: "2y" },
  { t: 3, rate: 3.45, label: "3y" },
  { t: 5, rate: 3.58, label: "5y" },
  { t: 7, rate: 3.72, label: "7y" },
  { t: 10, rate: 3.95, label: "10y" },
  { t: 15, rate: 4.2, label: "15y" },
  { t: 20, rate: 4.32, label: "20y" },
  { t: 30, rate: 4.3, label: "30y" },
];

export function baseRate(t: number): number {
  if (t <= CURVE[0].t) return CURVE[0].rate;
  for (let i = 1; i < CURVE.length; i++) {
    const a = CURVE[i - 1];
    const b = CURVE[i];
    if (t <= b.t) return a.rate + ((b.rate - a.rate) * (t - a.t)) / (b.t - a.t);
  }
  return CURVE[CURVE.length - 1].rate;
}

const discount = (t: number, shockBp: number) => Math.exp((-(baseRate(t) + shockBp / 100) / 100) * t);

/* Basel IRRBB standardised shock shapes (illustrative GBP calibration:
 * parallel 200bp, short 250bp, long 100bp, decay constant 4 years). */
const PAR_BP = 200;
const SHORT_BP = 250;
const LONG_BP = 100;
const DECAY = 4;
const shortShape = (t: number) => Math.exp(-t / DECAY);
const longShape = (t: number) => 1 - Math.exp(-t / DECAY);

export interface Scenario {
  id: ScenarioId;
  label: string;
  short: string;
  /** Shock in basis points at tenor t (years). */
  shock: (t: number) => number;
}

export const SCENARIOS: Scenario[] = [
  { id: "par_up", label: "Parallel up", short: "Par +200", shock: () => PAR_BP },
  { id: "par_dn", label: "Parallel down", short: "Par −200", shock: () => -PAR_BP },
  { id: "steep", label: "Steepener", short: "Steepener", shock: (t) => -0.65 * SHORT_BP * shortShape(t) + 0.9 * LONG_BP * longShape(t) },
  { id: "flat", label: "Flattener", short: "Flattener", shock: (t) => 0.8 * SHORT_BP * shortShape(t) - 0.6 * LONG_BP * longShape(t) },
  { id: "short_up", label: "Short rates up", short: "Short up", shock: (t) => SHORT_BP * shortShape(t) },
  { id: "short_dn", label: "Short rates down", short: "Short down", shock: (t) => -SHORT_BP * shortShape(t) },
];
export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s])) as Record<ScenarioId, Scenario>;

/** Tenors at which the cards sketch each shock's shape. */
export const SHAPE_TENORS = [0, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 30];

/* ------------------------------------------------------------------ *
 * Balance sheet
 * ------------------------------------------------------------------ */

type Shares = Record<Exclude<Entity, "group">, number>;
const RETAIL: Shares = { retail: 1, corporate: 0, treasury: 0 };
const CORPORATE: Shares = { retail: 0, corporate: 1, treasury: 0 };
const TREASURY: Shares = { retail: 0, corporate: 0, treasury: 1 };

type Kind = "fixed" | "float" | "nmd" | "pipeline";

interface Product {
  id: string;
  label: string;
  side: Side;
  kind: Kind;
  /** £m. */
  balance: number;
  /** Contractual repricing weights over the time buckets (not used for NMDs). */
  profile: Partial<Record<BucketId, number>>;
  /** Tenor whose shocked rate the tranche re-fixes at; "bucket" = its own bucket. */
  ref: number | "bucket" | ((b: Bucket) => number);
  /** Reinvestment spread over the reference rate, %. */
  margin: number;
  /** Current rate, %, flat or by bucket (back-book vintages). */
  coupon: number | Partial<Record<BucketId, number>>;
  /** Administered-rate floor, % (NMDs only). */
  floor?: number;
  /** Non-interest-bearing: no pass-through in either direction. */
  nib?: boolean;
  shares: Shares;
}

const ON = 1 / 365;
/* Fixed mortgages re-fix onto a 2y product when they reprice inside two
 * years (the 2y-fix cohorts), otherwise onto a 5y product. */
const mortgageRef = (b: Bucket) => (b.hi <= 2 ? 2 : 5);

const PRODUCTS: Product[] = [
  {
    id: "fixed_mtg", label: "Fixed-rate mortgages", side: "asset", kind: "fixed", balance: 24000,
    profile: { "3m": 0.02, "6m": 0.04, "12m": 0.08, "2y": 0.2, "3y": 0.2, "5y": 0.34, "7y": 0.08, "10y": 0.04 },
    ref: mortgageRef, margin: 0.9,
    coupon: { "3m": 2.35, "6m": 2.5, "12m": 2.9, "2y": 3.95, "3y": 4.7, "5y": 4.55, "7y": 4.6, "10y": 4.85 },
    shares: RETAIL,
  },
  {
    id: "tracker", label: "Tracker & variable mortgages", side: "asset", kind: "float", balance: 9000,
    profile: { on: 0.15, "1m": 0.85 }, ref: ON, margin: 1.4, coupon: 5.1, shares: RETAIL,
  },
  {
    id: "unsecured", label: "Unsecured loans & cards", side: "asset", kind: "fixed", balance: 4500,
    profile: { "3m": 0.05, "6m": 0.1, "12m": 0.2, "2y": 0.3, "3y": 0.2, "5y": 0.15 },
    ref: 2, margin: 5.6, coupon: 8.9, shares: RETAIL,
  },
  {
    id: "corp", label: "Corporate loans (floating)", side: "asset", kind: "float", balance: 8500,
    profile: { "1m": 0.1, "3m": 0.85, "6m": 0.05 }, ref: 0.25, margin: 2.4, coupon: 6.02, shares: CORPORATE,
  },
  {
    id: "hqla", label: "HQLA securities (gilts)", side: "asset", kind: "fixed", balance: 9000,
    profile: { "3m": 0.1, "6m": 0.1, "12m": 0.15, "2y": 0.2, "3y": 0.15, "5y": 0.15, "7y": 0.08, "10y": 0.05, "15y": 0.02 },
    ref: "bucket", margin: 0,
    coupon: { "3m": 3.9, "6m": 3.8, "12m": 3.6, "2y": 3.1, "3y": 2.6, "5y": 2.9, "7y": 3.3, "10y": 3.7, "15y": 3.9 },
    shares: TREASURY,
  },
  {
    id: "cash", label: "Cash & central bank reserves", side: "asset", kind: "float", balance: 3000,
    profile: { on: 1 }, ref: ON, margin: 0.05, coupon: 3.75, shares: TREASURY,
  },
  {
    id: "pipeline", label: "Mortgage pipeline (committed offers)", side: "asset", kind: "pipeline", balance: 4000,
    profile: { "3y": 0.45, "5y": 0.55 }, ref: 5, margin: 0.9, coupon: 4.4, shares: RETAIL,
  },
  {
    id: "nmd_ca", label: "Current accounts (NMD)", side: "liability", kind: "nmd", balance: 14000,
    profile: {}, ref: ON, margin: 0, coupon: 0, floor: 0, nib: true,
    shares: { retail: 0.7, corporate: 0.3, treasury: 0 },
  },
  {
    id: "nmd_sav", label: "Instant-access savings (NMD)", side: "liability", kind: "nmd", balance: 20000,
    profile: {}, ref: ON, margin: 0, coupon: 1.55, floor: 0.1,
    shares: { retail: 0.9, corporate: 0.1, treasury: 0 },
  },
  {
    id: "term", label: "Term deposits", side: "liability", kind: "fixed", balance: 8000,
    profile: { "1m": 0.1, "3m": 0.2, "6m": 0.25, "12m": 0.3, "2y": 0.15 },
    ref: 1, margin: 0.3, coupon: { "1m": 4.3, "3m": 4.2, "6m": 4.1, "12m": 3.95, "2y": 3.9 },
    shares: { retail: 0.75, corporate: 0.25, treasury: 0 },
  },
  {
    id: "wholesale", label: "Wholesale funding (floating)", side: "liability", kind: "float", balance: 5500,
    profile: { "1m": 0.2, "3m": 0.6, "6m": 0.2 }, ref: 0.25, margin: 0.35, coupon: 3.97, shares: TREASURY,
  },
  {
    id: "covered", label: "Covered bonds (fixed)", side: "liability", kind: "fixed", balance: 6000,
    profile: { "2y": 0.15, "3y": 0.2, "5y": 0.3, "7y": 0.2, "10y": 0.15 },
    ref: 5, margin: 0.45, coupon: { "2y": 1.15, "3y": 1.6, "5y": 3.4, "7y": 3.9, "10y": 4.1 },
    shares: TREASURY,
  },
];

/** Equity, £m: funds the book but carries no repricing, so it sits outside the ladder. */
export const EQUITY = 4500;
export const PIPELINE_BAL = PRODUCTS.find((p) => p.id === "pipeline")!.balance;

export const BALANCE_SHEET = {
  assets: PRODUCTS.filter((p) => p.side === "asset" && p.kind !== "pipeline").reduce((s, p) => s + p.balance, 0),
  liabilities: PRODUCTS.filter((p) => p.side === "liability").reduce((s, p) => s + p.balance, 0),
  nmd: PRODUCTS.filter((p) => p.kind === "nmd").reduce((s, p) => s + p.balance, 0),
};

/* ------------------------------------------------------------------ *
 * Hedge programme
 * ------------------------------------------------------------------ */

interface Swap {
  id: string;
  purpose: Purpose;
  direction: Direction;
  bucket: BucketId;
  /** £m; for pipeline swaps this is the notional at a 100% hedge ratio. */
  notional: number;
  /** Fixed rate, %. */
  fixed: number;
  forward?: boolean;
  shares: Shares;
}

const NMD_HEDGE: Shares = { retail: 0.8, corporate: 0.2, treasury: 0 };

const SWAPS: Swap[] = [
  { id: "nmd-2y", purpose: "NMD hedge", direction: "receive", bucket: "2y", notional: 2500, fixed: 1.35, shares: NMD_HEDGE },
  { id: "nmd-3y", purpose: "NMD hedge", direction: "receive", bucket: "3y", notional: 3000, fixed: 2.1, shares: NMD_HEDGE },
  { id: "nmd-5y", purpose: "NMD hedge", direction: "receive", bucket: "5y", notional: 4000, fixed: 3.35, shares: NMD_HEDGE },
  { id: "nmd-7y", purpose: "NMD hedge", direction: "receive", bucket: "7y", notional: 2500, fixed: 3.7, shares: NMD_HEDGE },
  { id: "mtg-3y", purpose: "Fixed mortgage hedge", direction: "pay", bucket: "3y", notional: 3000, fixed: 4.1, shares: RETAIL },
  { id: "mtg-5y", purpose: "Fixed mortgage hedge", direction: "pay", bucket: "5y", notional: 4500, fixed: 3.65, shares: RETAIL },
  { id: "mtg-7y", purpose: "Fixed mortgage hedge", direction: "pay", bucket: "7y", notional: 1500, fixed: 3.55, shares: RETAIL },
  { id: "pipe-3y", purpose: "Pipeline", direction: "pay", bucket: "3y", notional: 1800, fixed: 3.55, forward: true, shares: RETAIL },
  { id: "pipe-5y", purpose: "Pipeline", direction: "pay", bucket: "5y", notional: 2200, fixed: 3.62, forward: true, shares: RETAIL },
];

/* ------------------------------------------------------------------ *
 * Seeded coupon dispersion
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Back-book coupons are a vintage average; a few basis points of seeded
 * dispersion per tranche stops every table row ending in the same digit. */
const COUPON_JITTER = new Map<string, number>();
{
  const rng = mulberry32(20260921);
  for (const p of PRODUCTS)
    for (const b of TIME_BUCKETS) COUPON_JITTER.set(`${p.id}|${b.id}`, (rng() * 2 - 1) * 0.06);
}

/* ------------------------------------------------------------------ *
 * Tranches
 * ------------------------------------------------------------------ */

export interface Tranche {
  key: string;
  product: string;
  label: string;
  side: Side;
  /** On-balance-sheet position (incl. pipeline) or a swap leg. */
  group: "book" | "hedge";
  /** Contractual repricing bucket; "nmd" for the behaviouralised core. */
  bucket: BucketId;
  /** £m after entity scaling. */
  notional: number;
  /** Current rate, %. */
  coupon: number;
  /** Rate the tranche re-fixes at under the base curve, %. */
  reinvest: number;
  /** Tenor (years) whose shock applies at re-fix. */
  ref: number;
  /** Repricing point, months. */
  reprice: number;
  /** Pass-through of the shock at re-fix, 0–1. */
  pass: number;
  /** Administered floor, % (null = market-priced). */
  floor: number | null;
  prepay: boolean;
  /** Pipeline offers are off balance sheet: EVE only. */
  inNii: boolean;
}

const entityShare = (s: Shares, e: Entity) => (e === "group" ? 1 : s[e]);

function annuity(T: number): number {
  let s = 0;
  for (let k = 1; k <= Math.ceil(T); k++) s += discount(Math.min(k, T), 0) * Math.min(1, T - (k - 1));
  return s;
}
/** Par swap rate for tenor T off the base curve, %. */
export function parRate(T: number): number {
  return (100 * (1 - discount(T, 0))) / annuity(T);
}

function tranches(entity: Entity, a: Assumptions): Tranche[] {
  const out: Tranche[] = [];
  for (const p of PRODUCTS) {
    const scale = entityShare(p.shares, entity);
    if (scale === 0) continue;
    const bal = p.balance * scale;
    if (p.kind === "nmd") {
      // Non-core reprices overnight at full pass-through; core carries the
      // beta and, for EVE, the behavioural life.
      const pass = p.nib ? 0 : 1;
      const passCore = p.nib ? 0 : a.beta;
      const floor = p.floor ?? null;
      out.push({
        key: `${p.id}|on`, product: p.id, label: p.label, side: p.side, group: "book", bucket: "on",
        notional: bal * (1 - a.core), coupon: p.coupon as number, reinvest: p.coupon as number,
        ref: ON, reprice: 0, pass, floor, prepay: false, inNii: true,
      });
      out.push({
        key: `${p.id}|nmd`, product: p.id, label: p.label, side: p.side, group: "book", bucket: "nmd",
        notional: bal * a.core, coupon: p.coupon as number, reinvest: p.coupon as number,
        ref: ON, reprice: 0, pass: passCore, floor, prepay: false, inNii: true,
      });
      continue;
    }
    for (const b of TIME_BUCKETS) {
      const w = p.profile[b.id];
      if (!w) continue;
      const ref = typeof p.ref === "function" ? p.ref(b) : p.ref === "bucket" ? b.mid : p.ref;
      const c = typeof p.coupon === "number" ? p.coupon : (p.coupon[b.id] ?? 0);
      const jitter = p.kind === "float" ? 0 : (COUPON_JITTER.get(`${p.id}|${b.id}`) ?? 0);
      out.push({
        key: `${p.id}|${b.id}`, product: p.id, label: p.label, side: p.side, group: "book", bucket: b.id,
        notional: bal * w, coupon: c + jitter, reinvest: baseRate(ref) + p.margin, ref, reprice: b.months,
        pass: 1, floor: null, prepay: p.kind === "fixed" && p.id === "fixed_mtg", inNii: p.kind !== "pipeline",
      });
    }
  }
  for (const s of SWAPS) {
    const scale = entityShare(s.shares, entity) * (s.purpose === "Pipeline" ? a.hedge : 1);
    if (scale === 0) continue;
    const n = s.notional * scale;
    const b = BUCKET_BY_ID[s.bucket];
    const fixedSide: Side = s.direction === "receive" ? "asset" : "liability";
    const floatSide: Side = s.direction === "receive" ? "liability" : "asset";
    // A swap is a fixed leg at its maturity against a floating leg at the next 3m reset.
    out.push({
      key: `${s.id}|fixed`, product: s.id, label: `${s.purpose} swap (fixed leg)`, side: fixedSide, group: "hedge",
      bucket: s.bucket, notional: n, coupon: s.fixed, reinvest: parRate(b.mid), ref: b.mid, reprice: b.months,
      pass: 1, floor: null, prepay: false, inNii: true,
    });
    out.push({
      key: `${s.id}|float`, product: s.id, label: `${s.purpose} swap (floating leg)`, side: floatSide, group: "hedge",
      bucket: "3m", notional: n, coupon: baseRate(0.25), reinvest: baseRate(0.25), ref: 0.25, reprice: 2,
      pass: 1, floor: null, prepay: false, inNii: true,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Slotting for the ladder and EVE
 * ------------------------------------------------------------------ */

interface Slot {
  tranche: Tranche;
  bucket: BucketId;
  /** Discounting point, years. */
  t: number;
  amount: number;
}

/** Repricing cash flows of one tranche. Core NMDs spread evenly to the
 *  behavioural life when `spreadCore`; otherwise they stay in the NMD
 *  column so the ladder can show them as one block. */
function slots(tr: Tranche, a: Assumptions, spreadCore: boolean): Slot[] {
  if (tr.bucket === "nmd") {
    if (!spreadCore) return [{ tranche: tr, bucket: "nmd", t: a.life / 2, amount: tr.notional }];
    const out: Slot[] = [];
    for (const b of TIME_BUCKETS) {
      if (b.lo >= a.life) break;
      const hi = Math.min(b.hi, a.life);
      out.push({ tranche: tr, bucket: b.id, t: (b.lo + hi) / 2, amount: (tr.notional * (hi - b.lo)) / a.life });
    }
    return out;
  }
  const own = BUCKET_BY_ID[tr.bucket];
  if (!tr.prepay || a.cpr === 0) return [{ tranche: tr, bucket: tr.bucket, t: own.mid, amount: tr.notional }];
  // Prepayments before the contractual re-fix land in the bucket they occur in.
  const surv = (t: number) => Math.pow(1 - a.cpr, t);
  const out: Slot[] = [];
  for (const b of TIME_BUCKETS) {
    if (b.id === tr.bucket) {
      out.push({ tranche: tr, bucket: b.id, t: own.mid, amount: tr.notional * surv(b.lo) });
      break;
    }
    const amt = tr.notional * (surv(b.lo) - surv(b.hi));
    if (amt > 1e-9) out.push({ tranche: tr, bucket: b.id, t: b.mid, amount: amt });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

export interface LadderRow {
  bucket: BucketId;
  label: string;
  assets: number;
  liabilities: number;
  /** Swap legs booked to the bucket, net (fixed − floating), £m. */
  swapNet: number;
  gap: number;
  cum: number;
  /** Cumulative gap as % of total rate-sensitive assets. */
  cumPct: number;
}

export interface WaterfallStep {
  id: string;
  label: string;
  kind: "asset" | "liability" | "nmd" | "hedge" | "subtotal" | "total";
  /** £m; for subtotals and the total this is the running value. */
  value: number;
}

export interface NiiMonth {
  m: number;
  /** UTC ms of the month. */
  t: number;
  base: number;
  shocked: number;
  delta: number;
}

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  short: string;
  /** Shock in bp at the sketch tenors. */
  shape: number[];
  /** Shock at O/N, 5y and 20y for the caption. */
  bpOn: number;
  bp5y: number;
  bp20y: number;
  /** ΔEVE, £m (negative = loss). */
  dEve: number;
  /** ΔEVE as % of Tier 1 (signed). */
  dEvePct: number;
  status: Status;
  waterfall: WaterfallStep[];
  /** Month-by-month NII over the horizon. */
  nii: NiiMonth[];
  /** Cumulative ΔNII over the horizon, £m and % of base NII over the horizon. */
  dNii: number;
  dNiiPct: number;
  /** Worst single month's ΔNII, £m. */
  dNiiWorstMonth: number;
}

export interface HedgeRow {
  id: string;
  purpose: Purpose;
  direction: Direction;
  bucket: BucketId;
  bucketLabel: string;
  forward: boolean;
  notional: number;
  fixed: number;
  /** Par rate for the same tenor today, %. */
  par: number;
  /** £k per bp; positive when the swap gains as rates fall (receive fixed). */
  dv01: number;
  /** Mark-to-market, £m. */
  pv: number;
}

export interface LimitRow {
  id: string;
  label: string;
  scenario?: ScenarioId;
  /** The measured value, in the row's unit (positive = usage). */
  value: number;
  unit: "pct" | "gbpm";
  limit: number;
  early: number;
  /** Internal limit for the ΔEVE rows (12%). */
  internal?: number;
  /** value ÷ limit. */
  usage: number;
  status: Status;
}

export interface View {
  entity: Entity;
  entityLabel: string;
  horizon: Horizon;
  months: number;
  assumptions: Assumptions;
  tier1: number;
  ladder: LadderRow[];
  totals: { assets: number; liabilities: number; gap1y: number; gap1yPct: number; coreNmd: number; nonCoreNmd: number };
  scenarios: ScenarioResult[];
  worst: ScenarioResult;
  /** Worst cumulative ΔNII over the horizon (most negative), £m. */
  niiAtRisk: { value: number; scenario: ScenarioId };
  baseNiiAnnual: number;
  baseNiiHorizon: number;
  /** Group base NII over the horizon: the denominator for every ΔNII %. */
  groupNiiHorizon: number;
  hedges: HedgeRow[];
  hedgeTotals: { notional: number; dv01: number; pv: number; receive: number; pay: number };
  limits: LimitRow[];
  outlierBreach: boolean;
}

export function eveStatus(dEvePct: number): Status {
  const loss = -dEvePct;
  if (loss >= LIMITS.outlier) return "bad";
  if (loss > LIMITS.early) return "warn";
  return "good";
}

const sign = (side: Side) => (side === "asset" ? 1 : -1);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function niiSeries(trs: Tranche[], months: number, a: Assumptions, shock: ((t: number) => number) | null): number[] {
  const out = new Array<number>(months).fill(0);
  for (const tr of trs) {
    if (!tr.inNii) continue;
    const s = sign(tr.side) * tr.notional / 1200; // £m per month per 1% of rate
    let dEff = 0;
    if (shock) {
      dEff = (tr.pass * shock(tr.ref)) / 100;
      if (tr.floor !== null) dEff = Math.max(dEff, tr.floor - tr.coupon);
    }
    for (let m = 1; m <= months; m++) {
      const contractual = clamp01(m - tr.reprice);
      const prepaid = tr.prepay ? 1 - Math.pow(1 - a.cpr, (m - 0.5) / 12) : 0;
      const f = 1 - (1 - contractual) * (1 - prepaid);
      out[m - 1] += s * (tr.coupon + f * (tr.reinvest - tr.coupon + dEff));
    }
  }
  return out;
}

const MONTH0 = Date.UTC(2026, 9, 1); // Oct 2026 is the first simulated month
export const monthStart = (m: number) => Date.UTC(2026, 9 + (m - 1), 1);

export function buildView(entity: Entity, horizon: Horizon, a: Assumptions): View {
  const months = Number(horizon);
  const trs = tranches(entity, a);

  /* Ladder: contractual buckets, core NMD as its own column. */
  const ladderSlots = trs.flatMap((tr) => slots(tr, a, false));
  const ladder: LadderRow[] = BUCKETS.map((b) => ({
    bucket: b.id, label: b.label, assets: 0, liabilities: 0, swapNet: 0, gap: 0, cum: 0, cumPct: 0,
  }));
  const rowOf = Object.fromEntries(ladder.map((r) => [r.bucket, r])) as Record<BucketId, LadderRow>;
  for (const sl of ladderSlots) {
    const r = rowOf[sl.bucket];
    if (sl.tranche.group === "hedge") r.swapNet += sign(sl.tranche.side) * sl.amount;
    else if (sl.tranche.side === "asset") r.assets += sl.amount;
    else r.liabilities += sl.amount;
  }
  const totalAssets = ladder.reduce((s, r) => s + r.assets, 0);
  const totalLiabs = ladder.reduce((s, r) => s + r.liabilities, 0);
  let cum = 0;
  for (const r of ladder) {
    r.gap = r.assets - r.liabilities + r.swapNet;
    cum += r.gap;
    r.cum = cum;
    r.cumPct = totalAssets ? (100 * cum) / totalAssets : 0;
  }
  const gap1y = rowOf["12m"].cum;
  const gap1yPct = totalAssets ? (100 * gap1y) / totalAssets : 0;
  const coreNmd = rowOf.nmd.liabilities;
  const nonCoreNmd = trs.filter((t) => t.product.startsWith("nmd_") && t.bucket === "on").reduce((s, t) => s + t.notional, 0);

  /* EVE: the same tranches, core NMD spread to its behavioural life. */
  const eveSlots = trs.flatMap((tr) => slots(tr, a, true));
  const baseDf = new Map<number, number>();
  const dfBase = (t: number) => {
    let v = baseDf.get(t);
    if (v === undefined) {
      v = discount(t, 0);
      baseDf.set(t, v);
    }
    return v;
  };

  const baseNii = niiSeries(trs, months, a, null);
  const baseNiiHorizon = baseNii.reduce((s, v) => s + v, 0);
  const baseNiiAnnual = niiSeries(trs, 12, a, null).reduce((s, v) => s + v, 0);
  // ΔNII is expressed against group NII at every entity, as ΔEVE is against
  // group Tier 1: a segment's own NII can be near zero (Treasury) and would
  // make the percentage meaningless.
  const groupNiiHorizon =
    entity === "group" ? baseNiiHorizon : niiSeries(tranches("group", a), months, a, null).reduce((s, v) => s + v, 0);

  const scenarios: ScenarioResult[] = SCENARIOS.map((sc) => {
    const assetsBy = new Map<string, number>(COARSE.map((c) => [c.id, 0]));
    const liabsBy = new Map<string, number>(COARSE.map((c) => [c.id, 0]));
    let nmd = 0;
    let hedge = 0;
    for (const sl of eveSlots) {
      const d = sign(sl.tranche.side) * sl.amount * (discount(sl.t, sc.shock(sl.t)) - dfBase(sl.t));
      if (sl.tranche.group === "hedge") hedge += d;
      else if (sl.tranche.bucket === "nmd") nmd += d;
      else {
        const c = COARSE_OF.get(sl.bucket)!;
        const map = sl.tranche.side === "asset" ? assetsBy : liabsBy;
        map.set(c, map.get(c)! + d);
      }
    }
    const assetsTotal = [...assetsBy.values()].reduce((s, v) => s + v, 0);
    const liabsTotal = [...liabsBy.values()].reduce((s, v) => s + v, 0) + nmd;
    const dEve = assetsTotal + liabsTotal + hedge;
    const waterfall: WaterfallStep[] = [
      ...COARSE.map((c) => ({ id: `a-${c.id}`, label: `Assets ${c.label}`, kind: "asset" as const, value: assetsBy.get(c.id)! })),
      { id: "assets", label: "Assets", kind: "subtotal", value: assetsTotal },
      ...COARSE.map((c) => ({ id: `l-${c.id}`, label: `Liabilities ${c.label}`, kind: "liability" as const, value: liabsBy.get(c.id)! })),
      { id: "nmd", label: "NMD core", kind: "nmd", value: nmd },
      { id: "liabilities", label: "Liabilities", kind: "subtotal", value: liabsTotal },
      { id: "hedges", label: "Hedges", kind: "hedge", value: hedge },
      { id: "net", label: "Net ΔEVE", kind: "total", value: dEve },
    ];

    const shocked = niiSeries(trs, months, a, sc.shock);
    const nii: NiiMonth[] = baseNii.map((b, i) => ({
      m: i + 1, t: monthStart(i + 1), base: b, shocked: shocked[i], delta: shocked[i] - b,
    }));
    const dNii = nii.reduce((s, r) => s + r.delta, 0);
    const dEvePct = (100 * dEve) / TIER1;
    return {
      id: sc.id,
      label: sc.label,
      short: sc.short,
      shape: SHAPE_TENORS.map((t) => sc.shock(Math.max(t, ON))),
      bpOn: sc.shock(ON),
      bp5y: sc.shock(5),
      bp20y: sc.shock(20),
      dEve,
      dEvePct,
      status: eveStatus(dEvePct),
      waterfall,
      nii,
      dNii,
      dNiiPct: groupNiiHorizon ? (100 * dNii) / groupNiiHorizon : 0,
      dNiiWorstMonth: Math.min(0, ...nii.map((r) => r.delta)),
    };
  });

  const worst = scenarios.reduce((w, s) => (s.dEve < w.dEve ? s : w), scenarios[0]);
  const niiWorst = scenarios.reduce((w, s) => (s.dNii < w.dNii ? s : w), scenarios[0]);

  /* Hedge table: valuation off the base curve. */
  const hedges: HedgeRow[] = [];
  for (const s of SWAPS) {
    const scale = entityShare(s.shares, entity) * (s.purpose === "Pipeline" ? a.hedge : 1);
    if (scale === 0) continue;
    const b = BUCKET_BY_ID[s.bucket];
    const n = s.notional * scale;
    const ann = annuity(b.mid);
    const par = parRate(b.mid);
    const dir = s.direction === "receive" ? 1 : -1;
    hedges.push({
      id: s.id,
      purpose: s.purpose,
      direction: s.direction,
      bucket: s.bucket,
      bucketLabel: b.label,
      forward: !!s.forward,
      notional: n,
      fixed: s.fixed,
      par,
      dv01: (dir * n * ann * 1000) / 10000,
      pv: (dir * n * (s.fixed - par) * ann) / 100,
    });
  }
  const hedgeTotals = {
    notional: hedges.reduce((s, h) => s + h.notional, 0),
    dv01: hedges.reduce((s, h) => s + h.dv01, 0),
    pv: hedges.reduce((s, h) => s + h.pv, 0),
    receive: hedges.filter((h) => h.direction === "receive").reduce((s, h) => s + h.notional, 0),
    pay: hedges.filter((h) => h.direction === "pay").reduce((s, h) => s + h.notional, 0),
  };

  /* Limits. */
  const usageStatus = (usage: number, earlyUsage: number): Status =>
    usage >= 1 ? "bad" : usage >= earlyUsage ? "warn" : "good";
  const limits: LimitRow[] = [
    ...scenarios.map((s): LimitRow => {
      const loss = Math.max(0, -s.dEvePct);
      return {
        id: `eve-${s.id}`,
        label: `ΔEVE · ${s.label}`,
        scenario: s.id,
        value: loss,
        unit: "pct",
        limit: LIMITS.outlier,
        early: LIMITS.early,
        internal: LIMITS.internal,
        usage: loss / LIMITS.outlier,
        status: s.status,
      };
    }),
    (() => {
      const loss = Math.max(0, -niiWorst.dNii);
      const lim = LIMITS.nii[horizon];
      return {
        id: "nii",
        label: `NII-at-risk · ${months}m`,
        scenario: niiWorst.id,
        value: loss,
        unit: "gbpm" as const,
        limit: lim,
        early: lim * 0.8,
        usage: loss / lim,
        status: usageStatus(loss / lim, 0.8),
      };
    })(),
    (() => {
      const v = Math.abs(gap1yPct);
      return {
        id: "gap1y",
        label: "Cumulative 1y gap ÷ RSA",
        value: v,
        unit: "pct" as const,
        limit: LIMITS.gap1y,
        early: LIMITS.gap1yEarly,
        usage: v / LIMITS.gap1y,
        status: usageStatus(v / LIMITS.gap1y, LIMITS.gap1yEarly / LIMITS.gap1y),
      };
    })(),
  ];

  return {
    entity,
    entityLabel: ENTITY_LABEL[entity],
    horizon,
    months,
    assumptions: a,
    tier1: TIER1,
    ladder,
    totals: { assets: totalAssets, liabilities: totalLiabs, gap1y, gap1yPct, coreNmd, nonCoreNmd },
    scenarios,
    worst,
    niiAtRisk: { value: niiWorst.dNii, scenario: niiWorst.id },
    baseNiiAnnual,
    baseNiiHorizon,
    groupNiiHorizon,
    hedges,
    hedgeTotals,
    limits,
    outlierBreach: scenarios.some((s) => s.status === "bad"),
  };
}

/** The first simulated month, for captions. */
export const FIRST_MONTH = MONTH0;
