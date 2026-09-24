/* Pension Scheme Funding: model and derived statistics.
 *
 * A seeded monthly history of the fictional Northbridge Group Pension
 * Scheme from Jan 2020 to Aug 2026, driven by a 20-year gilt yield path,
 * an inflation-expectations path and seeded asset returns. Liabilities on
 * the technical-provisions (TP) basis roll forward with the yield (a
 * duration that shortens as yields rise), inflation and benefit outgo; the
 * low-dependency and buyout bases are fixed multiples of TP. Assets are
 * tracked by class: a leveraged LDI pool whose value moves with the hedge
 * ratio times the liability move, credit, cash-flow-driven (CDI) bonds,
 * growth, illiquids and cash, with quarterly rebalancing toward a glide
 * path and collateral top-ups when the LDI pool runs short. The Sep–Oct
 * 2022 gilt crisis, the Mar 2024 deficit contribution and the Jun 2025
 * pensioner buy-in are planned events layered over the seeded draws.
 *
 * Everything the page shows comes from one `buildView(basis, month,
 * stressMode)` slice so the stat band, the journey chart, the gauges, the
 * stress table and the allocation dumbbell always agree. */

export type Basis = "tp" | "ld" | "buyout";
export type StressMode = "instant" | "days5";
export type MonthKey = string;
export type AssetClassId = "ldi" | "credit" | "cdi" | "growth" | "illiquid" | "cash";
export type MemberCategory = "pensioners" | "deferreds" | "actives";
export type ActionStatus = "Open" | "In progress" | "Complete";
export type StressStatus = "covered" | "tight" | "shortfall";

export const SCHEME = {
  name: "Northbridge Group Pension Scheme",
  sponsor: "Northbridge Group plc",
};

export interface BasisDef {
  id: Basis;
  label: string;
  short: string;
  /** Liabilities as a multiple of technical provisions. */
  scale: number;
  /** Duration relative to TP: lower discount rates lengthen the liabilities. */
  durationMult: number;
  discount: string;
}

export const BASES: BasisDef[] = [
  { id: "tp", label: "Technical provisions", short: "TP", scale: 1.0, durationMult: 1.0, discount: "gilts + 0.5%" },
  { id: "ld", label: "Low dependency", short: "LD", scale: 1.08, durationMult: 1.03, discount: "gilts + 0.25%" },
  { id: "buyout", label: "Buyout", short: "Buyout", scale: 1.18, durationMult: 1.07, discount: "insurer pricing, gilts − 0.2%" },
];
export const BASIS_BY_ID = Object.fromEntries(BASES.map((b) => [b.id, b])) as Record<Basis, BasisDef>;

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

const START_YEAR = 2020;
/** Jan 2020 … Aug 2026: the seeded history. */
export const HISTORY_MONTHS = 80;
/** Jan 2020 … Dec 2031: history plus the journey-plan horizon. */
export const TOTAL_MONTHS = 144;

export interface MonthDef {
  i: number;
  key: MonthKey;
  /** Month-end, UTC ms. */
  t: number;
  y: number;
  m: number;
}

export const MONTHS: MonthDef[] = Array.from({ length: TOTAL_MONTHS }, (_, i) => {
  const y = START_YEAR + Math.floor(i / 12);
  const m = i % 12;
  return { i, key: `${y}-${String(m + 1).padStart(2, "0")}`, t: Date.UTC(y, m + 1, 0), y, m };
});
const INDEX_BY_KEY = new Map(MONTHS.map((d) => [d.key, d.i]));
export const monthIndex = (key: MonthKey) => INDEX_BY_KEY.get(key) ?? HISTORY_MONTHS - 1;

export const LATEST_MONTH: MonthKey = MONTHS[HISTORY_MONTHS - 1].key;
/** The six month-ends the header select offers. */
export const REPORT_MONTHS: MonthKey[] = MONTHS.slice(HISTORY_MONTHS - 6, HISTORY_MONTHS).map((d) => d.key);

/* ------------------------------------------------------------------ *
 * Drivers: yields, inflation, hedge ratios, the journey plan
 * ------------------------------------------------------------------ */

type Anchor = [MonthKey, number];

/** Piecewise-linear interpolation between month anchors, flat outside. */
function pathFrom(anchors: Anchor[]): number[] {
  const pts = anchors.map(([k, v]) => [monthIndex(k), v] as const);
  return MONTHS.map(({ i }) => {
    if (i <= pts[0][0]) return pts[0][1];
    for (let k = 1; k < pts.length; k++) {
      const [i0, v0] = pts[k - 1];
      const [i1, v1] = pts[k];
      if (i <= i1) return v0 + ((v1 - v0) * (i - i0)) / (i1 - i0);
    }
    return pts[pts.length - 1][1];
  });
}

/* 20-year nominal gilt yield, % at month-end. The Sep 2022 anchor is the
 * mini-budget spike; Oct 2022 is after the Bank of England intervention. */
const YIELD_ANCHORS: Anchor[] = [
  ["2020-01", 1.15], ["2020-03", 0.8], ["2020-08", 0.7], ["2020-12", 0.85],
  ["2021-06", 1.1], ["2021-12", 1.15], ["2022-03", 1.75], ["2022-06", 2.6],
  ["2022-08", 2.95], ["2022-09", 4.3], ["2022-10", 3.95], ["2022-12", 3.75],
  ["2023-06", 4.45], ["2023-10", 4.9], ["2023-12", 4.25], ["2024-06", 4.6],
  ["2024-12", 4.95], ["2025-06", 5.2], ["2025-12", 5.05], ["2026-08", 4.9],
];

/* Market-implied RPI applied to the inflation-linked liabilities, as a
 * factor on the Jan 2020 level. */
const INFLATION_ANCHORS: Anchor[] = [
  ["2020-01", 1.0], ["2020-04", 0.985], ["2021-06", 1.01], ["2021-12", 1.03],
  ["2022-09", 1.06], ["2023-06", 1.05], ["2024-12", 1.04], ["2026-08", 1.035],
];

/* Hedge ratios on the TP basis: PV01 of the hedge over PV01 of the
 * liabilities. Hedging started below the funding level (so rising yields
 * helped) and was stepped up as the deficit closed. The cut in Sep–Oct
 * 2022 is the LDI manager deleveraging when collateral ran short; the
 * rebuild follows the collateral top-ups. */
const RATE_HEDGE_ANCHORS: Anchor[] = [
  ["2020-01", 0.68], ["2022-08", 0.72], ["2022-09", 0.66], ["2022-10", 0.58],
  ["2022-12", 0.7], ["2023-06", 0.8], ["2024-06", 0.86], ["2025-06", 0.92], ["2026-08", 0.92],
];
const INFL_HEDGE_ANCHORS: Anchor[] = [
  ["2020-01", 0.62], ["2022-08", 0.66], ["2022-09", 0.6], ["2022-10", 0.54],
  ["2022-12", 0.64], ["2023-06", 0.74], ["2024-06", 0.8], ["2025-06", 0.88], ["2026-08", 0.88],
];

/* The trustees' journey plan, as a TP funding level: full TP funding by
 * end-2024, low dependency (108% of TP) by end-2029, buyout (118%) by
 * end-2031. The last leg leans on the sponsor's committed final top-up. */
const PLAN_ANCHORS: Anchor[] = [
  ["2020-01", 84], ["2024-12", 100], ["2029-12", 108], ["2031-12", 118],
];

export const YIELD_PATH = pathFrom(YIELD_ANCHORS);
const INFLATION_PATH = pathFrom(INFLATION_ANCHORS);
const RATE_HEDGE_PATH = pathFrom(RATE_HEDGE_ANCHORS);
const INFL_HEDGE_PATH = pathFrom(INFL_HEDGE_ANCHORS);
export const PLAN_TP = pathFrom(PLAN_ANCHORS);

export const LD_TARGET_MONTH: MonthKey = "2029-12";
export const BUYOUT_TARGET_MONTH: MonthKey = "2031-12";

/** Modified duration of the TP liabilities at a given yield (%): it
 *  shortens as yields rise, which is what convexity means in practice. */
export const durationAt = (yieldPct: number) => 14.5 - 0.9 * yieldPct;
/** Convexity haircut on a parallel shock: the loss on +bp is PV01·bp·(1 − k·bp). */
export const CONVEXITY = 0.00045;

/* ------------------------------------------------------------------ *
 * Seeded asset returns
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

/* Planned monthly returns, layered over the seeded draws: Covid, the 2022
 * bear market, the mini-budget month and the Apr 2025 tariff wobble. */
const GROWTH_SHOCKS: Record<MonthKey, number> = {
  "2020-03": -0.13, "2020-04": 0.07, "2022-01": -0.03, "2022-04": -0.03, "2022-06": -0.05,
  "2022-09": -0.06, "2022-10": 0.04, "2022-11": 0.03, "2023-01": 0.04, "2023-06": 0.03,
  "2023-11": 0.05, "2023-12": 0.03, "2024-02": 0.03, "2024-06": 0.03, "2024-11": 0.04,
  "2025-02": 0.02, "2025-04": -0.06, "2025-05": 0.04, "2025-08": 0.03,
};
const CREDIT_SHOCKS: Record<MonthKey, number> = {
  "2020-03": -0.07, "2020-04": 0.03, "2022-03": -0.02, "2022-06": -0.03, "2022-09": -0.035,
  "2022-10": 0.02, "2023-01": 0.012, "2023-11": 0.01, "2024-01": 0.01, "2024-11": 0.008,
  "2025-04": -0.015, "2025-06": 0.01,
};

export interface AssetClassDef {
  id: AssetClassId;
  label: string;
  short: string;
  /** Strategic weight in Jan 2020, after the Oct 2022 collateral review, and today: % of investable assets. */
  saa2020: number;
  saa2022: number;
  saaNow: number;
  /** Tolerance around the strategic weight, ± percentage points. */
  tol: number;
  /** Settlement days when sold for collateral (illiquids cannot be). */
  settle: number | null;
}

export const ASSET_CLASSES: AssetClassDef[] = [
  { id: "ldi", label: "LDI gilts and swaps", short: "LDI", saa2020: 16, saa2022: 24, saaNow: 26, tol: 4, settle: 1 },
  { id: "credit", label: "Investment-grade credit", short: "IG credit", saa2020: 24, saa2022: 22, saaNow: 22, tol: 3, settle: 3 },
  { id: "cdi", label: "Buy-and-maintain CDI", short: "CDI", saa2020: 14, saa2022: 16, saaNow: 24, tol: 3, settle: 3 },
  { id: "growth", label: "Growth", short: "Growth", saa2020: 30, saa2022: 24, saaNow: 15, tol: 3, settle: 5 },
  { id: "illiquid", label: "Illiquids", short: "Illiquids", saa2020: 12, saa2022: 11, saaNow: 10, tol: 3, settle: null },
  { id: "cash", label: "Cash", short: "Cash", saa2020: 4, saa2022: 3, saaNow: 3, tol: 2, settle: 0 },
];
export const ASSET_BY_ID = Object.fromEntries(ASSET_CLASSES.map((a) => [a.id, a])) as Record<AssetClassId, AssetClassDef>;

/* Strategic weights: the 2020 mix until the gilt crisis, a step up in the
 * LDI collateral pool from Oct 2022, then the de-risking glide to today's
 * mix by Dec 2025. */
const COLLATERAL_REVIEW = monthIndex("2022-10");
const GLIDE_TO = monthIndex("2025-12");
export function saaAt(i: number): Record<AssetClassId, number> {
  if (i < COLLATERAL_REVIEW) {
    return Object.fromEntries(ASSET_CLASSES.map((a) => [a.id, a.saa2020])) as Record<AssetClassId, number>;
  }
  const f = Math.min(1, (i - COLLATERAL_REVIEW) / (GLIDE_TO - COLLATERAL_REVIEW));
  return Object.fromEntries(
    ASSET_CLASSES.map((a) => [a.id, a.saa2022 + (a.saaNow - a.saa2022) * f]),
  ) as Record<AssetClassId, number>;
}

/* Planned cash events. */
const LUMP_SUM_MONTH: MonthKey = "2024-03";
const LUMP_SUM = 45;
const BUYIN_MONTH: MonthKey = "2025-06";
/** Premium paid to the insurer and the TP value of the insured pensioners. */
const BUYIN_PREMIUM = 295;
const BUYIN_TP_VALUE = 278;
const RECOVERY_END = monthIndex("2027-12");

/** Deficit-repair contributions due in a month (excluding the lump sum):
 *  £36m a year under the 2019 recovery plan, £12m a year under the 2023 one. */
function regularContribution(i: number): number {
  if (i < monthIndex("2024-04")) return 3.0;
  return i <= RECOVERY_END ? 1.0 : 0;
}

export interface MonthRow {
  i: number;
  key: MonthKey;
  t: number;
  /** 20y gilt yield, %. */
  yield20: number;
  /** TP liabilities, £m. */
  liabTp: number;
  /** Investable assets, £m (excludes the buy-in policy). */
  investable: number;
  /** Buy-in policy at its TP value, £m (0 before Jun 2025). */
  buyinTp: number;
  /** TP-basis hedge ratios. */
  hedgeRate: number;
  hedgeInfl: number;
  /** Hedge PV01, £m per bp. */
  hedgePv01: number;
  /** Assets by class, £m. */
  alloc: Record<AssetClassId, number>;
  /** Eligible collateral by tier, £m. */
  collateral: { cash: number; gilts: number; credit: number };
  /** Yield rise the instant collateral can absorb at month-end, bp. */
  resilienceBp: number;
  /** The same measure at the month's worst point: after the hedge loss, before any top-up or hedge cut. */
  resilienceLowBp: number;
  contributions: number;
  benefits: number;
}

/** Yield rise (bp) at which a collateral amount is exhausted by the call. */
export function resilienceFor(available: number, pv01: number): number {
  if (pv01 <= 0) return 0;
  // Solve pv01·bp·(1 − k·bp) = available for the smaller root.
  const a = -CONVEXITY * pv01;
  const b = pv01;
  const disc = b * b + 4 * a * available;
  if (disc < 0) return 1 / (2 * CONVEXITY);
  return (-b + Math.sqrt(disc)) / (2 * a);
}

function generate(seed: number): MonthRow[] {
  const rng = mulberry32(seed);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };

  let L = 2_000; // TP liabilities, Jan 2020
  // £1,680m of assets on the 2020 strategic mix: 84% funded on TP.
  const a: Record<AssetClassId, number> = {
    ldi: 269, credit: 403, cdi: 235, growth: 504, illiquid: 202, cash: 67,
  };
  let ldiCash = 30; // cash margin inside the LDI pool, part of `ldi`
  let buyinShare = 0; // insured liabilities as a share of TP
  let illiqLag = 0; // illiquids mark with a quarter's lag
  const rows: MonthRow[] = [];

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const def = MONTHS[i];
    const y = YIELD_PATH[i];
    const yPrev = i === 0 ? y : YIELD_PATH[i - 1];
    const infl = INFLATION_PATH[i];
    const inflPrev = i === 0 ? infl : INFLATION_PATH[i - 1];
    const hRate = RATE_HEDGE_PATH[i];
    const hInfl = INFL_HEDGE_PATH[i];

    // Liabilities: market move (rates, then inflation), interest roll-up, benefits out.
    const dY = (y - yPrev) / 100;
    const dur = durationAt((y + yPrev) / 2);
    const rateFactor = Math.exp(-dur * dY);
    const inflFactor = infl / inflPrev;
    const dLRates = L * (rateFactor - 1);
    const dLInfl = L * rateFactor * (inflFactor - 1);
    const benefits = 5.4 * Math.pow(1.0022, i);
    const accrual = L * (yPrev / 100 + 0.005) / 12;
    L = L * rateFactor * inflFactor + accrual - benefits;

    // LDI pool: the hedge earns the hedged share of the liability move, the
    // physical gilts earn the yield and the levered part a 40bp term premium.
    const hPrev = RATE_HEDGE_PATH[Math.max(0, i - 1)];
    a.ldi += hPrev * dLRates + INFL_HEDGE_PATH[Math.max(0, i - 1)] * dLInfl;
    a.ldi += (a.ldi * yPrev) / 100 / 12 + (Math.max(0, hPrev * L - a.ldi) * 0.004) / 12;
    // The month's low point for collateral: the loss has landed, nothing has been sold yet.
    const resilienceLowBp = resilienceFor(
      a.cash + ldiCash + Math.max(0, a.ldi - ldiCash),
      (hPrev * L * durationAt(y)) / 10_000,
    );

    // Carry follows the yield level; spreads and the equity premium sit on top.
    const carry = yPrev / 100 / 12;
    a.credit *= 1 + carry + 0.012 / 12 + 0.009 * gauss() + (CREDIT_SHOCKS[def.key] ?? 0);
    a.cdi *= 1 + carry + 0.01 / 12 + 0.004 * gauss() + 0.6 * (CREDIT_SHOCKS[def.key] ?? 0);
    a.growth *= 1 + carry + 0.035 / 12 + 0.03 * gauss() + (GROWTH_SHOCKS[def.key] ?? 0);
    const illiqTarget = carry + 0.03 / 12 + 0.5 * (GROWTH_SHOCKS[def.key] ?? 0);
    illiqLag = illiqLag * 0.6 + illiqTarget * 0.4;
    a.illiquid *= 1 + illiqLag + 0.003 * gauss();
    a.cash *= 1 + Math.max(0, yPrev - 0.6) / 100 / 12;
    // Illiquids distribute capital back; the programme has been in run-off since the collateral review.
    const distribution = a.illiquid * (i >= COLLATERAL_REVIEW ? 0.016 : 0.004);
    a.illiquid -= distribution;
    a.cash += distribution;

    // Benefits are paid from CDI income and cash; contributions land in cash.
    const contributions = regularContribution(i) + (def.key === LUMP_SUM_MONTH ? LUMP_SUM : 0);
    a.cdi -= benefits * 0.55;
    a.cash += contributions - benefits * 0.45;

    // Pensioner buy-in: premium out of the matching assets, policy in.
    if (def.key === BUYIN_MONTH) {
      a.cdi -= 160;
      a.credit -= 110;
      a.growth -= BUYIN_PREMIUM - 270;
      buyinShare = BUYIN_TP_VALUE / L;
    }

    const investable = () => a.ldi + a.credit + a.cdi + a.growth + a.illiquid + a.cash;
    const saa = saaAt(i);

    // Collateral top-up: when the LDI pool falls below tolerance, sell credit
    // first and growth for the rest, the same month.
    const floor = ((saa.ldi - ASSET_BY_ID.ldi.tol) / 100) * investable();
    if (a.ldi < floor) {
      const need = (saa.ldi / 100) * investable() - a.ldi;
      const fromCredit = Math.min(need * 0.6, a.credit * 0.3);
      a.credit -= fromCredit;
      a.growth -= need - fromCredit;
      a.ldi += need;
    }

    // Quarter-end rebalancing: the liquid classes move halfway to their
    // strategic weights, scaled to whatever the illiquids leave them.
    if (def.m % 3 === 2) {
      const liquid: AssetClassId[] = ["ldi", "credit", "cdi", "growth", "cash"];
      const pool = liquid.reduce((s, id) => s + a[id], 0);
      const saaSum = liquid.reduce((s, id) => s + saa[id], 0);
      for (const id of liquid) {
        const target = (saa[id] / saaSum) * pool;
        a[id] += (target - a[id]) * 0.5;
      }
    }
    // Keep cash inside its band by sweeping to or from the LDI pool.
    const cashTarget = (saa.cash / 100) * investable();
    const sweep = (a.cash - cashTarget) * 0.7;
    a.cash -= sweep;
    a.ldi += sweep;
    ldiCash = Math.max(8, Math.min(a.ldi * 0.15, ldiCash * 0.9 + a.ldi * 0.012));

    const hedgePv01 = (hRate * L * durationAt(y)) / 10_000;
    const collateral = {
      cash: a.cash + ldiCash,
      gilts: Math.max(0, a.ldi - ldiCash),
      credit: a.credit * 0.85,
    };
    rows.push({
      i,
      key: def.key,
      t: def.t,
      yield20: y,
      liabTp: L,
      investable: investable(),
      buyinTp: buyinShare * L,
      hedgeRate: hRate,
      hedgeInfl: hInfl,
      hedgePv01,
      alloc: { ...a },
      collateral,
      resilienceBp: resilienceFor(collateral.cash + collateral.gilts, hedgePv01),
      resilienceLowBp: Math.min(resilienceLowBp, resilienceFor(collateral.cash + collateral.gilts, hedgePv01)),
      contributions,
      benefits,
    });
  }
  return rows;
}

export const SEED = 20260831;
export const HISTORY: MonthRow[] = generate(SEED);

/* ------------------------------------------------------------------ *
 * Events annotated on the journey chart
 * ------------------------------------------------------------------ */

export interface SchemeEvent {
  key: MonthKey;
  /** End month for a band; omitted for a point event. */
  to?: MonthKey;
  title: string;
  text: string;
}

export const EVENTS: SchemeEvent[] = [
  {
    key: "2022-09",
    to: "2022-10",
    title: "Gilt crisis",
    text: "20y gilts +135bp in September 2022 after the mini-budget; the LDI manager called collateral and cut the hedge before the Bank's intervention.",
  },
  {
    key: LUMP_SUM_MONTH,
    title: "£45m contribution",
    text: "Deficit contribution paid by the sponsor under the 2023 recovery plan.",
  },
  {
    key: BUYIN_MONTH,
    title: "Pensioner buy-in",
    text: `£${BUYIN_PREMIUM}m premium insured pensioners with a TP value of £${BUYIN_TP_VALUE}m; tranche 2 is being priced.`,
  },
];

/* ------------------------------------------------------------------ *
 * Projection fan (lognormal on the funding level)
 * ------------------------------------------------------------------ */

/** Expected outperformance of assets over liabilities and its volatility, p.a. */
export const FAN = { mu: 0.022, sigma: 0.042 };
const Z = { p5: -1.6449, p25: -0.6745, p75: 0.6745, p95: 1.6449 };

/** Complementary error function (Numerical Recipes erfcc, |rel err| < 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}
const normCdf = (z: number) => 0.5 * erfc(-z / Math.SQRT2);

export interface FanPoint {
  t: number;
  key: MonthKey;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

function fanFrom(start: number, fromIdx: number): FanPoint[] {
  const { mu, sigma } = FAN;
  const drift = mu - (sigma * sigma) / 2;
  const out: FanPoint[] = [];
  for (let i = fromIdx; i < TOTAL_MONTHS; i++) {
    const years = (i - fromIdx) / 12;
    const s = sigma * Math.sqrt(years);
    const q = (z: number) => start * Math.exp(drift * years + s * z);
    out.push({ t: MONTHS[i].t, key: MONTHS[i].key, p5: q(Z.p5), p25: q(Z.p25), p50: q(0), p75: q(Z.p75), p95: q(Z.p95) });
  }
  return out;
}

/** P(funding level ≥ target at month `toIdx`) under the fan. */
function reachProbability(start: number, target: number, fromIdx: number, toIdx: number): number {
  const years = Math.max(1 / 12, (toIdx - fromIdx) / 12);
  const { mu, sigma } = FAN;
  const z = (Math.log(target / start) - (mu - (sigma * sigma) / 2) * years) / (sigma * Math.sqrt(years));
  return 1 - normCdf(z);
}

/* ------------------------------------------------------------------ *
 * Liability cash flows (annual, nominal, £m)
 * ------------------------------------------------------------------ */

export const CASHFLOW_FROM = 2026;
export const CASHFLOW_TO = 2090;

export interface CashflowYear {
  year: number;
  pensioners: number;
  deferreds: number;
  actives: number;
  total: number;
  /** Buy-and-maintain CDI portfolio cash flows, £m. */
  cdi: number;
}

export const MEMBER_CATEGORIES: { id: MemberCategory; label: string; note: string }[] = [
  { id: "pensioners", label: "Pensioners", note: "in payment, including dependants" },
  { id: "deferreds", label: "Deferreds", note: "left service, pension not yet in payment" },
  { id: "actives", label: "Actives", note: "still accruing, scheme closed to new entrants in 2012" },
];

export const CASHFLOWS: CashflowYear[] = Array.from({ length: CASHFLOW_TO - CASHFLOW_FROM + 1 }, (_, k) => {
  const year = CASHFLOW_FROM + k;
  const t = k;
  const pensioners = 58 * Math.exp(-Math.pow(t / 26, 1.9));
  const deferreds = (8 + 34 * Math.exp(-Math.pow((year - 2047) / 13, 2))) * Math.exp(-Math.pow(t / 56, 5));
  const actives = (0.9 + 8.5 * Math.exp(-Math.pow((year - 2052) / 14, 2))) * Math.exp(-Math.pow(t / 60, 6));
  const total = pensioners + deferreds + actives;
  // The CDI portfolio matches ~88% of the first decade of benefits and runs off by 2046.
  const taper = Math.max(0, 1 - Math.max(0, year - 2036) / 10);
  const cdi = 0.88 * total * taper;
  return { year, pensioners, deferreds, actives, total, cdi };
});

/* ------------------------------------------------------------------ *
 * Covenant and actions
 * ------------------------------------------------------------------ */

export interface CovenantMetric {
  label: string;
  value: string;
  prior: string;
  note: string;
  tone: "good" | "warn" | "neutral";
}

export const COVENANT = {
  grade: "CG2",
  gradeLabel: "Tending to strong",
  assessed: "Independent covenant review, March 2026",
  rating: "BBB (stable) · S&P",
  metrics: [
    { label: "Net debt / EBITDA", value: "1.9×", prior: "2.2× FY24", note: "Covenant limit 3.0×", tone: "good" },
    { label: "EBITDA", value: "£412m", prior: "£386m FY24", note: "FY25, +6.7%", tone: "good" },
    { label: "Interest cover", value: "6.8×", prior: "5.9× FY24", note: "EBITDA ÷ net interest", tone: "good" },
    { label: "Free cash flow", value: "£190m", prior: "£164m FY24", note: "After capex and tax", tone: "good" },
    { label: "Dividends ÷ contributions", value: "7.9×", prior: "2.1× FY24", note: "£95m paid vs £12m DRCs", tone: "warn" },
    { label: "Affordability", value: "£60m p.a.", prior: "£45m FY24", note: "Reasonable-affordability test", tone: "neutral" },
  ] as CovenantMetric[],
  guarantee: "£60m parent-company guarantee (Northbridge Holdings B.V.), expires Dec 2029",
};

export interface ScheduleRow {
  due: number;
  label: string;
  amount: number;
  status: "Paid" | "Due" | "Scheduled";
}

export const CONTRIBUTION_SCHEDULE: ScheduleRow[] = [
  { due: Date.UTC(2024, 2, 31), label: "2019 recovery plan · £36m p.a. to Mar 2024", amount: 153, status: "Paid" },
  { due: Date.UTC(2024, 2, 31), label: "Lump-sum deficit contribution", amount: 45, status: "Paid" },
  { due: Date.UTC(2025, 11, 31), label: "2023 recovery plan · Apr 2024 to Dec 2025", amount: 21, status: "Paid" },
  { due: Date.UTC(2026, 2, 31), label: "Deficit repair · Q1 2026", amount: 3, status: "Paid" },
  { due: Date.UTC(2026, 5, 30), label: "Deficit repair · Q2 2026", amount: 3, status: "Paid" },
  { due: Date.UTC(2026, 8, 30), label: "Deficit repair · Q3 2026", amount: 3, status: "Due" },
  { due: Date.UTC(2026, 11, 31), label: "Deficit repair · Q4 2026", amount: 3, status: "Scheduled" },
  { due: Date.UTC(2027, 11, 31), label: "Deficit repair · 2027 (4 × £3m)", amount: 12, status: "Scheduled" },
  { due: Date.UTC(2031, 11, 31), label: "Final buyout top-up (contingent)", amount: 80, status: "Scheduled" },
];

export interface TrusteeAction {
  id: string;
  title: string;
  detail: string;
  owner: ActionOwner;
  due: number;
  status: ActionStatus;
}

export const ACTION_OWNERS = [
  "Trustee board",
  "Investment sub-committee",
  "Scheme actuary",
  "Covenant adviser",
  "Administrator",
  "Risk transfer adviser",
] as const;
export type ActionOwner = (typeof ACTION_OWNERS)[number];

export const ACTIONS: TrusteeAction[] = [
  { id: "A-141", title: "Agree 2026 valuation assumptions", detail: "Discount rate, RPI/CPI wedge and the post-buy-in mortality basis for the 31 Dec 2026 valuation.", owner: "Scheme actuary", due: Date.UTC(2026, 9, 30), status: "In progress" },
  { id: "A-142", title: "Review LDI collateral waterfall", detail: "Confirm tier order and the 250bp minimum resilience after the Q2 gilt volatility.", owner: "Investment sub-committee", due: Date.UTC(2026, 9, 15), status: "Open" },
  { id: "A-138", title: "Buy-in tranche 2 pricing", detail: "Run the second pensioner tranche (c.£210m) to three insurers; compare against the buyout reserve.", owner: "Risk transfer adviser", due: Date.UTC(2026, 10, 30), status: "In progress" },
  { id: "A-133", title: "Data cleanse for buy-in tranche 2", detail: "GMP equalisation and spouse data for the tranche 2 population.", owner: "Administrator", due: Date.UTC(2026, 7, 14), status: "Open" },
  { id: "A-145", title: "Approve low-dependency investment strategy", detail: "Endgame portfolio for the 2029 low-dependency target: CDI weight and residual growth.", owner: "Investment sub-committee", due: Date.UTC(2026, 11, 15), status: "Open" },
  { id: "A-127", title: "Covenant review refresh", detail: "Update the independent assessment for FY25 results and the refinancing.", owner: "Covenant adviser", due: Date.UTC(2026, 6, 31), status: "Complete" },
  { id: "A-136", title: "Sign off Q2 cash-flow matching report", detail: "CDI coverage of the next ten years of benefits.", owner: "Trustee board", due: Date.UTC(2026, 7, 31), status: "Complete" },
  { id: "A-146", title: "Review deleveraging trigger with LDI manager", detail: "Agree the hedge cut schedule if instant resilience falls below 250bp.", owner: "Investment sub-committee", due: Date.UTC(2026, 9, 15), status: "Open" },
  { id: "A-147", title: "Update statement of funding principles", detail: "Reflect the low-dependency target and the new funding code.", owner: "Scheme actuary", due: Date.UTC(2027, 0, 31), status: "Open" },
  { id: "A-143", title: "Member communication on buy-in", detail: "Letter to insured pensioners ahead of tranche 2.", owner: "Administrator", due: Date.UTC(2026, 10, 30), status: "Open" },
  { id: "A-139", title: "Q3 contribution reconciliation", detail: "Match the £3m September DRC against the schedule of contributions.", owner: "Trustee board", due: Date.UTC(2026, 9, 5), status: "Open" },
  { id: "A-130", title: "Climate (TCFD) report", detail: "Scheme-year TCFD report including the CDI portfolio's implied temperature rise.", owner: "Investment sub-committee", due: Date.UTC(2026, 11, 31), status: "In progress" },
  { id: "A-125", title: "Adopt updated SIP", detail: "Statement of investment principles updated for the buy-in and the LDI mandate change.", owner: "Trustee board", due: Date.UTC(2026, 4, 31), status: "Complete" },
];

/* ------------------------------------------------------------------ *
 * The view
 * ------------------------------------------------------------------ */

export interface FundingPoint {
  i: number;
  key: MonthKey;
  t: number;
  assets: number;
  liabilities: number;
  /** Funding level on the selected basis, %. */
  fl: number;
  /** Journey plan on the selected basis, %. */
  plan: number;
  surplus: number;
}

export interface StatDelta {
  value: number;
  /** Change vs the prior quarter-end, in the value's own unit. */
  delta: number;
}

export interface JourneyBar {
  /** Funding level at Jan 2020 on this basis, %. */
  start: number;
  today: number;
  planToday: number;
  ldTarget: number;
  buyoutTarget: number;
  /** Axis maximum, %. */
  max: number;
}

export interface StressRow {
  bp: number;
  /** Collateral call, £m. */
  call: number;
  tiers: { cash: number; gilts: number; credit: number };
  /** Tiers that count in this stress mode. */
  available: number;
  headroom: number;
  /** Settlement day of the last tier drawn; null when the call cannot be met. */
  daysToCure: number | null;
  /** Which tiers the waterfall draws on, in order. */
  drawn: ("cash" | "gilts" | "credit")[];
  status: StressStatus;
  /** Position after the shock on the selected basis: the hedge loss on the asset side, the liability fall on the other. */
  assetsAfter: number;
  liabAfter: number;
  flAfter: number;
}

export interface AllocationRow {
  id: AssetClassId;
  label: string;
  value: number;
  actual: number;
  strategic: number;
  tol: number;
  deviation: number;
  inRange: boolean;
}

export interface SchemeView {
  basis: BasisDef;
  month: MonthDef;
  stressMode: StressMode;
  /** Jan 2020 … selected month. */
  history: FundingPoint[];
  /** Jan 2020 … Dec 2031. */
  plan: { t: number; key: MonthKey; v: number }[];
  fan: FanPoint[];
  current: FundingPoint;
  prior: FundingPoint;
  stats: { assets: StatDelta; liabilities: StatDelta; fl: StatDelta; surplus: StatDelta };
  vsPlan: number;
  journey: JourneyBar;
  probability: { ld: number; buyout: number };
  hedge: {
    rate: number;
    infl: number;
    band: { lo: number; hi: number };
    liabPv01: number;
    hedgePv01: number;
    /** Hedge ratio the LDI manager would cut to once instant collateral is exhausted. */
    afterCut: number;
  };
  stress: {
    rows: StressRow[];
    tiers: { cash: number; gilts: number; credit: number };
    /** Yield rise at which the mode's collateral is exhausted, bp. */
    triggerBp: number;
    /** Instant resilience regardless of mode, bp (what the policy minimum is tested on). */
    instantBp: number;
    policyMinBp: number;
    /** Buffer below which a covered row is flagged "tight": the call from a +100bp move. */
    tightBuffer: number;
  };
  resilienceHistory: { t: number; key: MonthKey; bp: number; low: number }[];
  /** Hedge ratios each month, re-expressed on the selected basis. */
  hedgeHistory: { t: number; key: MonthKey; rate: number; infl: number }[];
  allocation: AllocationRow[];
  investable: number;
  buyin: number;
}

export const STRESS_SHOCKS = [50, 100, 150, 200, 300];
export const HEDGE_BAND = { lo: 85, hi: 95 };
export const POLICY_MIN_BP = 250;

/** Liabilities after a parallel +bp shock on a basis. */
function liabAfterShock(liab: number, durationTp: number, basis: BasisDef, bp: number) {
  const d = durationTp * basis.durationMult;
  return liab * (1 - ((d * bp) / 10_000) * (1 - CONVEXITY * bp));
}

export function buildView(basisId: Basis, monthKey: MonthKey, stressMode: StressMode): SchemeView {
  const basis = BASIS_BY_ID[basisId];
  const idx = Math.min(HISTORY_MONTHS - 1, monthIndex(monthKey));
  const s = basis.scale;

  const point = (r: MonthRow): FundingPoint => {
    const liabilities = r.liabTp * s;
    const assets = r.investable + r.buyinTp * s;
    return {
      i: r.i,
      key: r.key,
      t: r.t,
      assets,
      liabilities,
      fl: (assets / liabilities) * 100,
      plan: PLAN_TP[r.i] / s,
      surplus: assets - liabilities,
    };
  };

  const history = HISTORY.slice(0, idx + 1).map(point);
  const current = history[idx];
  const prior = history[Math.max(0, idx - 3)];
  const row = HISTORY[idx];

  const plan = MONTHS.map((d) => ({ t: d.t, key: d.key, v: PLAN_TP[d.i] / s }));
  const fan = fanFrom(current.fl, idx);
  const ldIdx = monthIndex(LD_TARGET_MONTH);
  const boIdx = monthIndex(BUYOUT_TARGET_MONTH);
  const ldTarget = PLAN_TP[ldIdx] / s;
  const buyoutTarget = PLAN_TP[boIdx] / s;

  // Hedge ratios re-expressed on the selected basis: the same hedge PV01
  // over a larger, longer liability.
  const durTp = durationAt(row.yield20);
  const liabPv01 = (current.liabilities * durTp * basis.durationMult) / 10_000;
  const hedgePv01 = row.hedgePv01;
  const rate = (hedgePv01 / liabPv01) * 100;
  const infl = rate * (row.hedgeInfl / row.hedgeRate);

  const tiers = row.collateral;
  const instantAvail = tiers.cash + tiers.gilts;
  const modeAvail = stressMode === "instant" ? instantAvail : instantAvail + tiers.credit;
  const tightBuffer = hedgePv01 * 100 * (1 - CONVEXITY * 100);
  const stressRows: StressRow[] = STRESS_SHOCKS.map((bp) => {
    const call = hedgePv01 * bp * (1 - CONVEXITY * bp);
    const order: { id: "cash" | "gilts" | "credit"; v: number; days: number }[] = [
      { id: "cash", v: tiers.cash, days: 0 },
      { id: "gilts", v: tiers.gilts, days: 1 },
    ];
    if (stressMode === "days5") order.push({ id: "credit", v: tiers.credit, days: 3 });
    const drawn: ("cash" | "gilts" | "credit")[] = [];
    let remaining = call;
    let days: number | null = 0;
    for (const tier of order) {
      if (remaining <= 0) break;
      drawn.push(tier.id);
      days = tier.days;
      remaining -= tier.v;
    }
    if (remaining > 0) days = null;
    const headroom = modeAvail - call;
    const status: StressStatus = headroom < 0 ? "shortfall" : headroom < tightBuffer ? "tight" : "covered";
    const liabAfter = liabAfterShock(current.liabilities, durTp, basis, bp);
    const assetsAfter = row.investable - call + row.buyinTp * s * (liabAfter / current.liabilities);
    return {
      bp,
      call,
      tiers,
      available: modeAvail,
      headroom,
      daysToCure: days,
      drawn,
      status,
      assetsAfter,
      liabAfter,
      flAfter: (assetsAfter / liabAfter) * 100,
    };
  });

  const alloc = row.alloc;
  const saa = saaAt(idx);
  const allocation: AllocationRow[] = ASSET_CLASSES.map((c) => {
    const actual = (alloc[c.id] / row.investable) * 100;
    const deviation = actual - saa[c.id];
    return {
      id: c.id,
      label: c.label,
      value: alloc[c.id],
      actual,
      strategic: saa[c.id],
      tol: c.tol,
      deviation,
      inRange: Math.abs(deviation) <= c.tol,
    };
  });

  const journeyMax = Math.ceil((buyoutTarget + 2) / 5) * 5;

  return {
    basis,
    month: MONTHS[idx],
    stressMode,
    history,
    plan,
    fan,
    current,
    prior,
    stats: {
      assets: { value: current.assets, delta: current.assets - prior.assets },
      liabilities: { value: current.liabilities, delta: current.liabilities - prior.liabilities },
      fl: { value: current.fl, delta: current.fl - prior.fl },
      surplus: { value: current.surplus, delta: current.surplus - prior.surplus },
    },
    vsPlan: current.fl - current.plan,
    journey: {
      start: history[0].fl,
      today: current.fl,
      planToday: current.plan,
      ldTarget,
      buyoutTarget,
      max: journeyMax,
    },
    probability: {
      ld: reachProbability(current.fl, ldTarget, idx, ldIdx),
      buyout: reachProbability(current.fl, buyoutTarget, idx, boIdx),
    },
    hedge: {
      rate,
      infl,
      band: HEDGE_BAND,
      liabPv01,
      hedgePv01,
      // With the instant collateral gone, the pool can only support the
      // hedge its remaining (credit) collateral covers at the policy minimum.
      afterCut: Math.min(rate, ((tiers.credit / (POLICY_MIN_BP * (1 - CONVEXITY * POLICY_MIN_BP))) / liabPv01) * 100),
    },
    stress: {
      rows: stressRows,
      tiers,
      triggerBp: resilienceFor(modeAvail, hedgePv01),
      instantBp: row.resilienceBp,
      policyMinBp: POLICY_MIN_BP,
      tightBuffer,
    },
    resilienceHistory: HISTORY.slice(0, idx + 1).map((r) => ({ t: r.t, key: r.key, bp: r.resilienceBp, low: r.resilienceLowBp })),
    // The basis rescales the liability PV01 by scale × duration multiple; the hedge PV01 is what it is.
    hedgeHistory: HISTORY.slice(0, idx + 1).map((r) => ({
      t: r.t,
      key: r.key,
      rate: (r.hedgeRate / (s * basis.durationMult)) * 100,
      infl: (r.hedgeInfl / (s * basis.durationMult)) * 100,
    })),
    allocation,
    investable: row.investable,
    buyin: row.buyinTp * s,
  };
}

/** Quarter-end rows of the history (plus the selected month if it is not one), newest first. */
export function quarterlyRows(view: SchemeView): FundingPoint[] {
  const last = view.current;
  const rows = view.history.filter((p) => MONTHS[p.i].m % 3 === 2 || p.i === last.i);
  return rows.reverse();
}

/** Five-year buckets of the cash-flow profile for the table view. */
export function cashflowBuckets(): (CashflowYear & { label: string })[] {
  const out: (CashflowYear & { label: string })[] = [];
  for (let from = CASHFLOW_FROM; from <= CASHFLOW_TO; from += 5) {
    const to = Math.min(CASHFLOW_TO, from + 4);
    const rows = CASHFLOWS.filter((c) => c.year >= from && c.year <= to);
    const sum = (k: keyof Omit<CashflowYear, "year">) => rows.reduce((a, r) => a + r[k], 0);
    out.push({
      year: from,
      label: `${from}–${String(to).slice(2)}`,
      pensioners: sum("pensioners"),
      deferreds: sum("deferreds"),
      actives: sum("actives"),
      total: sum("total"),
      cdi: sum("cdi"),
    });
  }
  return out;
}

/** An action is overdue when it is not complete and its due date has passed the reporting month-end. */
export const isOverdue = (a: TrusteeAction, asOf: number) => a.status !== "Complete" && a.due < asOf;
