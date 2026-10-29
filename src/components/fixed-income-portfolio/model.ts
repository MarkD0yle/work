/* Fixed Income Portfolio: data model.
 *
 * Three sterling bond funds, each generated against its own benchmark from a
 * seeded PRNG so every reload shows the same book. The benchmark is modelled
 * as a list of constituents (not just headline numbers) so that any slice the
 * page cross-filters to (a tenor bucket, a rating, a sector) can be measured
 * on both sides the same way: portfolio slice against benchmark slice.
 *
 * Conventions
 *  - Close of business Mon 21 Sep 2026.
 *  - OAS is measured against the fitted gilt par curve, so gilts sit at ~0bp
 *    and carry no spread duration; credit spread risk lives in everything else.
 *  - Weights are % of NAV (portfolio) or % of index (benchmark).
 *  - DV01 is £k per bp. Benchmark DV01 is scaled to the fund's NAV, so the
 *    active DV01 is the rate risk the fund carries that the index would not.
 *  - Convexity is shown /100 (the market-screen convention).
 *
 * No imports: this file is pure data + arithmetic and can be run under Node
 * directly to sanity-check the calibration.
 */

/* ================================================================== */
/*  Dimensions                                                         */
/* ================================================================== */

export type FundId = "agg" | "corp" | "sdg";

export type Sector =
  | "Gilts"
  | "Supranational"
  | "Financials"
  | "Utilities"
  | "Industrials"
  | "Consumer"
  | "Real estate"
  | "Securitised";

export const SECTORS: readonly Sector[] = [
  "Gilts",
  "Supranational",
  "Financials",
  "Utilities",
  "Industrials",
  "Consumer",
  "Real estate",
  "Securitised",
];

export type RatingBucket = "AAA" | "AA" | "A" | "BBB" | "BB" | "NR";
export const RATING_BUCKETS: readonly RatingBucket[] = ["AAA", "AA", "A", "BBB", "BB", "NR"];

export type TenorBucket = "0–2y" | "2–5y" | "5–10y" | "10–20y" | "20–30y" | "30y+";
export const TENOR_BUCKETS: readonly TenorBucket[] = ["0–2y", "2–5y", "5–10y", "10–20y", "20–30y", "30y+"];

export const AS_OF = Date.UTC(2026, 8, 21);
export const AS_OF_LABEL = "Mon 21 Sep 2026";

/* ================================================================== */
/*  Gilt par curve                                                     */
/* ================================================================== */

export type CompareKey = "1W" | "1M" | "3M";
export const COMPARE_KEYS: readonly CompareKey[] = ["1W", "1M", "3M"];
export const COMPARE_LABEL: Record<CompareKey, string> = { "1W": "1W ago", "1M": "1M ago", "3M": "3M ago" };
export const COMPARE_DATE: Record<CompareKey, string> = {
  "1W": "14 Sep 2026",
  "1M": "21 Aug 2026",
  "3M": "22 Jun 2026",
};

export const CURVE_TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50];
export const CURVE_LABELS = ["3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "15Y", "20Y", "25Y", "30Y", "40Y", "50Y"];

// Today: a shallow dip through 2Y (cuts priced), then a steady steepening to
// a hump around 20–25Y and a gentle roll-down into the ultra-longs.
export const CURVE_TODAY = [3.97, 3.93, 3.86, 3.83, 3.87, 4.01, 4.19, 4.42, 4.67, 4.79, 4.82, 4.78, 4.63, 4.49];
export const CURVE_PAST: Record<CompareKey, number[]> = {
  // long end cheapened ~6bp on the week
  "1W": [3.97, 3.94, 3.88, 3.86, 3.9, 4.03, 4.18, 4.37, 4.61, 4.73, 4.76, 4.72, 4.57, 4.43],
  // bull steepener: front end rallied, long end sold off
  "1M": [4.07, 4.03, 3.97, 3.95, 3.98, 4.09, 4.24, 4.43, 4.62, 4.72, 4.74, 4.7, 4.55, 4.42],
  // three months ago the curve was ~25bp flatter in 2s10s
  "3M": [4.26, 4.2, 4.13, 4.09, 4.1, 4.17, 4.28, 4.44, 4.6, 4.68, 4.7, 4.66, 4.52, 4.38],
};

/** Par yield at `t` years, linearly interpolated between curve nodes. */
export function parYield(t: number, curve: number[] = CURVE_TODAY): number {
  if (t <= CURVE_TENORS[0]) return curve[0];
  for (let i = 1; i < CURVE_TENORS.length; i++) {
    if (t <= CURVE_TENORS[i]) {
      const a = CURVE_TENORS[i - 1];
      const b = CURVE_TENORS[i];
      return curve[i - 1] + ((t - a) / (b - a)) * (curve[i] - curve[i - 1]);
    }
  }
  return curve[curve.length - 1];
}

/* ================================================================== */
/*  Ratings                                                            */
/* ================================================================== */

// Notch scale: 1 = AAA … 13 = BB-. 0 = not rated (excluded from averages).
const NOTCH_LABELS = ["NR", "AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB", "BB-"];

export function notchLabel(n: number | null): string {
  if (n == null || n <= 0) return "NR";
  return NOTCH_LABELS[Math.max(1, Math.min(13, Math.round(n)))];
}

export function bucketOf(notch: number): RatingBucket {
  if (notch <= 0) return "NR";
  if (notch === 1) return "AAA";
  if (notch <= 4) return "AA";
  if (notch <= 7) return "A";
  if (notch <= 10) return "BBB";
  return "BB";
}

export function tenorOf(years: number): TenorBucket {
  if (years < 2) return "0–2y";
  if (years < 5) return "2–5y";
  if (years < 10) return "5–10y";
  if (years < 20) return "10–20y";
  if (years < 30) return "20–30y";
  return "30y+";
}

/* ================================================================== */
/*  Bond maths                                                         */
/* ================================================================== */

/** Dirty price per 100 of a semi-annual bullet, yield in % (s.a.). */
function price(coupon: number, y: number, T: number): number {
  const v = (t: number) => Math.pow(1 + y / 200, -2 * t);
  let p = 100 * v(T);
  for (let t = T; t > 0; t -= 0.5) p += (coupon / 2) * v(t);
  return p;
}

/** Modified duration (years) and convexity (/100) by a ±1bp bump. */
function analytics(coupon: number, y: number, T: number) {
  const h = 0.01; // 1bp in % terms
  const p0 = price(coupon, y, T);
  const pDn = price(coupon, y - h, T);
  const pUp = price(coupon, y + h, T);
  const dy = h / 100;
  const modDur = (pDn - pUp) / (2 * p0 * dy);
  const convexity = (pDn + pUp - 2 * p0) / (p0 * dy * dy) / 100;
  return { modDur, convexity, price: p0 };
}

/* ================================================================== */
/*  Instruments                                                        */
/* ================================================================== */

export interface Bond {
  id: string; // ISIN
  issuer: string;
  sector: Sector;
  coupon: number; // %
  maturity: string; // ISO date
  years: number; // years to maturity at AS_OF
  notch: number; // 0 = NR
  rating: string; // e.g. "A-"
  bucket: RatingBucket;
  tenor: TenorBucket;
  ytw: number; // %
  oas: number; // bp vs gilt par curve
  modDur: number;
  sprDur: number;
  convexity: number;
  benchWeight: number; // % of index; 0 when off-benchmark
}

export interface Holding extends Bond {
  mv: number; // £m
  weight: number; // % of NAV
  active: number; // weight − benchWeight, pp
  dv01: number; // £k per bp
}

export interface Fund {
  id: FundId;
  name: string;
  benchmark: string;
  benchmarkShort: string;
  nav: number; // £m
  holdings: Holding[];
  bench: Bond[];
}

/* ---- deterministic PRNG ----------------------------------------- */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;

/* ---- issuers ----------------------------------------------------- */

interface Issuer {
  name: string;
  sector: Sector;
  notch: number;
}

// Fictional corporates. Supranationals are real public bodies (allowed).
const ISSUERS: Issuer[] = [
  { name: "EIB", sector: "Supranational", notch: 1 },
  { name: "KfW", sector: "Supranational", notch: 1 },
  { name: "IBRD", sector: "Supranational", notch: 1 },
  { name: "Asian Development Bank", sector: "Supranational", notch: 1 },
  { name: "Council of Europe Dev. Bank", sector: "Supranational", notch: 2 },
  { name: "Nordic Investment Bank", sector: "Supranational", notch: 1 },

  { name: "Thamesbridge Bank", sector: "Financials", notch: 6 },
  { name: "Albion Mutual Bank", sector: "Financials", notch: 7 },
  { name: "Northgate Building Society", sector: "Financials", notch: 6 },
  { name: "Castlemere Insurance", sector: "Financials", notch: 8 },
  { name: "Harbourline Capital", sector: "Financials", notch: 9 },
  { name: "Kestrel Life Assurance", sector: "Financials", notch: 7 },
  { name: "Ludgate Banking Group", sector: "Financials", notch: 8 },

  { name: "Highmoor Water", sector: "Utilities", notch: 8 },
  { name: "Southmere Energy Networks", sector: "Utilities", notch: 7 },
  { name: "Ridgeway Gas Distribution", sector: "Utilities", notch: 8 },
  { name: "Carrick Power", sector: "Utilities", notch: 9 },
  { name: "Tamar Water Services", sector: "Utilities", notch: 10 },

  { name: "Brackenfield Engineering", sector: "Industrials", notch: 9 },
  { name: "Merrow Aerospace", sector: "Industrials", notch: 8 },
  { name: "Tollgate Infrastructure", sector: "Industrials", notch: 7 },
  { name: "Orwell Logistics", sector: "Industrials", notch: 10 },
  { name: "Kingsway Telecom", sector: "Industrials", notch: 9 },

  { name: "Hartwell Foods", sector: "Consumer", notch: 7 },
  { name: "Linden Retail Group", sector: "Consumer", notch: 9 },
  { name: "Ashby Brewing", sector: "Consumer", notch: 8 },
  { name: "Fairholme Pharma", sector: "Consumer", notch: 6 },

  { name: "Greystone Property", sector: "Real estate", notch: 7 },
  { name: "Mercia Estates", sector: "Real estate", notch: 8 },
  { name: "Canalside Land", sector: "Real estate", notch: 9 },
  { name: "Northbank Housing Trust", sector: "Real estate", notch: 6 },

  { name: "Holloway Mortgages 2025-1", sector: "Securitised", notch: 1 },
  { name: "Fenchurch Covered Bond", sector: "Securitised", notch: 1 },
  { name: "Stanmore RMBS 2024-2", sector: "Securitised", notch: 1 },
  { name: "Petersham Auto ABS 2025-1", sector: "Securitised", notch: 3 },
];

// Off-index names: sub-investment grade and unrated private placements.
const OFF_INDEX: Issuer[] = [
  { name: "Calder Home Stores", sector: "Consumer", notch: 11 },
  { name: "Pellow Leisure", sector: "Consumer", notch: 12 },
  { name: "Quayside Ports", sector: "Industrials", notch: 0 },
  { name: "Rushford Healthcare", sector: "Real estate", notch: 0 },
  { name: "Ember Renewables", sector: "Utilities", notch: 0 },
  { name: "Wexcombe Bank AT1", sector: "Financials", notch: 11 },
];

// Conventional gilts: [maturity ISO, coupon %].
const GILTS: [string, number][] = [
  ["2026-10-22", 0.375],
  ["2027-01-29", 4.125],
  ["2027-07-22", 1.25],
  ["2027-12-07", 4.25],
  ["2028-01-31", 0.125],
  ["2028-03-07", 4.5],
  ["2028-10-22", 1.625],
  ["2029-01-31", 0.5],
  ["2029-05-22", 4.125],
  ["2029-12-07", 6.0],
  ["2030-03-07", 4.75],
  ["2030-10-22", 0.375],
  ["2031-07-31", 0.25],
  ["2031-10-22", 4.0],
  ["2032-06-07", 4.25],
  ["2033-01-31", 1.0],
  ["2033-07-31", 3.25],
  ["2034-06-07", 4.5],
  ["2035-03-07", 4.5],
  ["2035-07-31", 0.625],
  ["2036-03-07", 4.25],
  ["2037-09-07", 1.75],
  ["2038-12-07", 4.75],
  ["2039-09-07", 1.125],
  ["2040-12-07", 4.25],
  ["2041-01-31", 0.625],
  ["2042-12-07", 4.5],
  ["2044-01-22", 3.25],
  ["2045-10-22", 3.5],
  ["2046-01-22", 0.875],
  ["2047-12-07", 4.25],
  ["2049-01-22", 1.5],
  ["2050-10-22", 0.625],
  ["2051-07-31", 1.25],
  ["2053-10-22", 3.75],
  ["2054-10-22", 4.25],
  ["2055-12-07", 4.25],
  ["2057-07-22", 1.75],
  ["2060-01-22", 4.0],
  ["2061-10-22", 0.5],
  ["2063-10-22", 4.0],
  ["2065-07-22", 2.5],
  ["2068-07-22", 3.5],
  ["2071-10-22", 1.625],
  ["2073-07-22", 1.125],
];

/* ---- builders ---------------------------------------------------- */

const DAY = 86_400_000;
const yearsTo = (iso: string) => (Date.parse(iso) - AS_OF) / (365.25 * DAY);
const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

const ALNUM = "ABCDEFGHJKLMNPQRSTVWXYZ0123456789";
function makeIsin(rng: Rng, kind: "gilt" | "xs" | "gb", used: Set<string>): string {
  for (;;) {
    let body: string;
    if (kind === "gilt") {
      body = "GB00B";
      for (let i = 0; i < 6; i++) body += ALNUM[Math.floor(rng() * ALNUM.length)];
    } else if (kind === "gb") {
      body = "GB00";
      for (let i = 0; i < 7; i++) body += ALNUM[Math.floor(rng() * ALNUM.length)];
    } else {
      body = rng() < 0.7 ? "XS2" : "XS1";
      for (let i = 0; i < 8; i++) body += Math.floor(rng() * 10);
    }
    const id = body + Math.floor(rng() * 10);
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
}

// OAS (bp) by notch for a 10y senior bond; the credit curve and sector
// adjustments are layered on top.
const OAS_BY_NOTCH = [195, 44, 56, 64, 72, 90, 100, 114, 138, 156, 180, 206, 222, 236];
const SECTOR_OAS: Record<Sector, number> = {
  Gilts: 0,
  Supranational: 0,
  Financials: 10,
  Utilities: 6,
  Industrials: 0,
  Consumer: -6,
  "Real estate": 14,
  Securitised: 8,
};

function finish(
  b: Omit<Bond, "years" | "rating" | "bucket" | "tenor" | "ytw" | "modDur" | "sprDur" | "convexity">,
  rng: Rng,
): Bond {
  const years = yearsTo(b.maturity);
  const ytw = round(parYield(years) + b.oas / 100 + (rng() - 0.5) * 0.03, 3);
  const a = analytics(b.coupon, ytw, years);
  return {
    ...b,
    years,
    rating: b.sector === "Gilts" ? "AA" : notchLabel(b.notch),
    bucket: b.sector === "Gilts" ? "AA" : bucketOf(b.notch),
    tenor: tenorOf(years),
    ytw,
    modDur: round(a.modDur, 2),
    sprDur: b.sector === "Gilts" ? 0 : round(a.modDur * (0.97 + rng() * 0.02), 2),
    convexity: round(a.convexity, 2),
  };
}

function giltBond(iso: string, coupon: number, rng: Rng, used: Set<string>): Bond {
  return finish(
    {
      id: makeIsin(rng, "gilt", used),
      issuer: "UK Treasury",
      sector: "Gilts",
      coupon,
      maturity: iso,
      notch: 3,
      oas: round((rng() - 0.5) * 7, 1),
      benchWeight: 0,
    },
    rng,
  );
}

function corpBond(issuer: Issuer, yrs: [number, number, number], rng: Rng, used: Set<string>): Bond {
  const [lo, hi, skew] = yrs;
  const years = lo + (hi - lo) * Math.pow(rng(), skew);
  const d = new Date(AS_OF + years * 365.25 * DAY);
  d.setUTCDate(1 + Math.floor(rng() * 28));
  const maturity = d.toISOString().slice(0, 10);
  // Subordinated bank/insurer paper sits two notches below senior, but an
  // investment-grade issuer's Tier 2 stays investment grade here.
  const sub = issuer.sector === "Financials" && issuer.notch > 0 && issuer.notch < 11 && rng() < 0.3;
  const notch = issuer.notch === 0 ? 0 : sub ? Math.min(10, issuer.notch + 2) : issuer.notch;
  let oas: number;
  if (issuer.sector === "Supranational") {
    oas = 16 + rng() * 14 + Math.min(years, 20) * 0.7;
  } else {
    oas =
      OAS_BY_NOTCH[notch] +
      SECTOR_OAS[issuer.sector] +
      (Math.min(years, 15) - 10) * 1.6 +
      (rng() - 0.5) * 18;
  }
  oas = round(Math.max(12, oas), 0);
  const par = parYield(years) + oas / 100;
  // Most coupons were set near today's level; a minority are 2020-21 vintage.
  const coupon =
    rng() < 0.18
      ? round(Math.floor((1 + rng() * 1.75) * 8) / 8, 3)
      : round(Math.round((par + (rng() - 0.5) * 1.2) * 8) / 8, 3);
  const kind = issuer.sector === "Supranational" || rng() < 0.75 ? "xs" : "gb";
  return finish(
    { id: makeIsin(rng, kind, used), issuer: issuer.name, sector: issuer.sector, coupon, maturity, notch, oas, benchWeight: 0 },
    rng,
  );
}

/* ---- fund specs -------------------------------------------------- */

interface SectorPlan {
  sector: Sector;
  bench: number; // % of index
  port: number; // % of NAV
  benchN: number; // index constituents in this sector
  holdN: number; // holdings drawn from the index
  offN?: number; // off-index holdings in this sector
  offPct?: number; // % of NAV in those off-index holdings
  years: [number, number, number]; // min, max, skew (>1 = shorter)
}

interface FundSpec {
  id: FundId;
  name: string;
  benchmark: string;
  benchmarkShort: string;
  nav: number;
  seed: number;
  giltWindow: [number, number];
  giltScale: (years: number) => number; // index weight multiplier by gilt maturity
  plans: SectorPlan[];
  tilt: (years: number) => number; // portfolio preference by maturity
  ratingTilt: (notch: number) => number;
}

const SPECS: FundSpec[] = [
  {
    id: "agg",
    name: "Sterling Aggregate Fund",
    benchmark: "iBoxx £ Overall Index",
    benchmarkShort: "iBoxx £ Overall",
    nav: 1242,
    seed: 0xa66,
    giltWindow: [0, 60],
    giltScale: (y) => (y > 30 ? 0.3 : y > 20 ? 0.55 : 1),
    plans: [
      { sector: "Gilts", bench: 55, port: 39, benchN: 0, holdN: 15, years: [0, 0, 1] },
      { sector: "Supranational", bench: 8, port: 6, benchN: 16, holdN: 6, years: [1, 18, 1.5] },
      { sector: "Financials", bench: 12.5, port: 17.5, benchN: 26, holdN: 15, offN: 1, offPct: 1.2, years: [1, 16, 1.6] },
      { sector: "Utilities", bench: 7, port: 10, benchN: 16, holdN: 9, offN: 1, offPct: 0.9, years: [3, 34, 1.4] },
      { sector: "Industrials", bench: 6, port: 7.5, benchN: 14, holdN: 7, offN: 1, offPct: 0.8, years: [2, 22, 1.5] },
      { sector: "Consumer", bench: 5, port: 7, benchN: 12, holdN: 6, offN: 2, offPct: 1.8, years: [2, 16, 1.4] },
      { sector: "Real estate", bench: 3.5, port: 6.5, benchN: 10, holdN: 6, offN: 1, offPct: 0.7, years: [3, 30, 1.3] },
      { sector: "Securitised", bench: 3, port: 6.5, benchN: 6, holdN: 4, years: [2, 7, 1] },
    ],
    // Overweight the belly, light in the long end.
    tilt: (y) => (y < 2 ? 0.7 : y < 5 ? 1 : y < 10 ? 1.6 : y < 20 ? 1.05 : y < 30 ? 0.75 : 0.45),
    ratingTilt: (n) => (n >= 8 ? 1.6 : n >= 5 ? 1 : 0.8),
  },
  {
    id: "corp",
    name: "Sterling Corporate Bond Fund",
    benchmark: "iBoxx £ Non-Gilts Index",
    benchmarkShort: "iBoxx £ Non-Gilts",
    nav: 864,
    seed: 0xc02f,
    giltWindow: [4, 12],
    giltScale: () => 1,
    plans: [
      { sector: "Gilts", bench: 0, port: 3.5, benchN: 0, holdN: 0, offN: 3, offPct: 3.5, years: [0, 0, 1] },
      { sector: "Supranational", bench: 15, port: 8, benchN: 22, holdN: 7, years: [1, 20, 1.5] },
      { sector: "Financials", bench: 30, port: 33, benchN: 44, holdN: 19, offN: 1, offPct: 1.4, years: [1, 16, 1.5] },
      { sector: "Utilities", bench: 15, port: 17, benchN: 24, holdN: 11, offN: 1, offPct: 1.1, years: [3, 34, 1.3] },
      { sector: "Industrials", bench: 12, port: 11.5, benchN: 20, holdN: 8, offN: 1, offPct: 0.9, years: [2, 22, 1.4] },
      { sector: "Consumer", bench: 11, port: 11, benchN: 18, holdN: 7, offN: 2, offPct: 2, years: [2, 16, 1.4] },
      { sector: "Real estate", bench: 10, port: 8, benchN: 16, holdN: 6, offN: 1, offPct: 0.8, years: [3, 30, 1.2] },
      { sector: "Securitised", bench: 7, port: 8, benchN: 9, holdN: 5, years: [2, 7, 1] },
    ],
    tilt: (y) => (y < 2 ? 0.8 : y < 5 ? 1.15 : y < 10 ? 1.45 : y < 20 ? 0.9 : y < 30 ? 0.6 : 0.4),
    ratingTilt: (n) => (n >= 8 ? 1.35 : n >= 5 ? 1 : 0.75),
  },
  {
    id: "sdg",
    name: "Short Duration Gilt Fund",
    benchmark: "FTSE Actuaries UK Conventional Gilts up to 5 Years",
    benchmarkShort: "FTSE Gilts up to 5Y",
    nav: 538,
    seed: 0x5d6,
    giltWindow: [0, 5],
    giltScale: () => 1,
    plans: [
      { sector: "Gilts", bench: 100, port: 78, benchN: 0, holdN: 11, years: [0, 0, 1] },
      { sector: "Supranational", bench: 0, port: 12.5, benchN: 0, holdN: 0, offN: 14, offPct: 12.5, years: [0.4, 4.6, 1.2] },
      { sector: "Securitised", bench: 0, port: 6, benchN: 0, holdN: 0, offN: 6, offPct: 6, years: [1, 4.5, 1] },
      { sector: "Financials", bench: 0, port: 3.5, benchN: 0, holdN: 0, offN: 5, offPct: 3.5, years: [0.5, 3.5, 1] },
    ],
    // Short of the index: favours sub-2y paper and trims the 4–5y end.
    tilt: (y) => (y < 1 ? 1.2 : y < 2 ? 1.35 : y < 3.5 ? 1 : 0.55),
    ratingTilt: () => 1,
  },
];

/** Weighted sample without replacement. */
function sample<T>(items: T[], n: number, weight: (t: T) => number, rng: Rng): T[] {
  const pool = items.map((t) => ({ t, w: Math.max(1e-6, weight(t)) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r <= 0) break;
    }
    out.push(pool[i].t);
    pool.splice(i, 1);
  }
  return out;
}

function normalise<T>(items: T[], raw: (t: T) => number, total: number): number[] {
  const r = items.map(raw);
  const s = r.reduce((a, v) => a + v, 0) || 1;
  return r.map((v) => (v / s) * total);
}

function buildFund(spec: FundSpec): Fund {
  const rng = mulberry32(spec.seed);
  const used = new Set<string>();
  const bench: Bond[] = [];
  const held: { bond: Bond; raw: number; plan: SectorPlan; off: boolean }[] = [];

  // Every gilt in the fund's universe is created once, so a held gilt and its
  // index line share an ISIN.
  const giltPool = GILTS.map(([iso, c]) => giltBond(iso, c, rng, used));

  for (const plan of spec.plans) {
    /* index constituents */
    let constituents: Bond[] = [];
    if (plan.bench > 0) {
      if (plan.sector === "Gilts") {
        constituents = giltPool.filter((g) => g.years >= spec.giltWindow[0] && g.years < spec.giltWindow[1]);
        const w = normalise(
          constituents,
          (g) => (0.75 + rng() * 0.5) * spec.giltScale(g.years) * (g.coupon < 1.5 ? 0.85 : 1),
          plan.bench,
        );
        constituents = constituents.map((g, i) => ({ ...g, benchWeight: w[i] }));
      } else {
        const names = ISSUERS.filter((i) => i.sector === plan.sector);
        for (let k = 0; k < plan.benchN; k++) {
          constituents.push(corpBond(names[Math.floor(rng() * names.length)], plan.years, rng, used));
        }
        const w = normalise(constituents, () => 0.4 + Math.pow(rng(), 1.5) * 1.6, plan.bench);
        constituents = constituents.map((b, i) => ({ ...b, benchWeight: w[i] }));
      }
      bench.push(...constituents);
    }

    /* holdings drawn from the index */
    const picks = sample(
      constituents,
      plan.holdN,
      (b) => spec.tilt(b.years) * spec.ratingTilt(b.notch) * Math.sqrt(b.benchWeight),
      rng,
    );
    for (const b of picks) {
      held.push({ bond: b, raw: spec.tilt(b.years) * (0.55 + rng()) * Math.pow(b.benchWeight, 0.35), plan, off: false });
    }

    /* off-index holdings */
    const offN = plan.offN ?? 0;
    if (offN > 0) {
      if (plan.sector === "Gilts") {
        const pool = giltPool.filter((g) => !constituents.some((c) => c.id === g.id) && g.years >= spec.giltWindow[0] && g.years < spec.giltWindow[1]);
        for (const g of sample(pool, offN, (x) => spec.tilt(x.years), rng)) {
          held.push({ bond: { ...g, benchWeight: 0 }, raw: 0.6 + rng(), plan, off: true });
        }
      } else {
        // In a fund with an index presence, off-index names are HY / unrated;
        // otherwise (short gilt fund) they are the sector's usual IG issuers.
        const hy = OFF_INDEX.filter((i) => i.sector === plan.sector);
        const names = plan.bench > 0 && hy.length ? hy : ISSUERS.filter((i) => i.sector === plan.sector);
        for (let k = 0; k < offN; k++) {
          const b = corpBond(names[k % names.length], plan.years, rng, used);
          held.push({ bond: b, raw: spec.tilt(b.years) * (0.6 + rng()), plan, off: true });
        }
      }
    }
  }

  /* weights: each sector's on/off-index sleeves sum to its planned % */
  const holdings: Holding[] = [];
  for (const plan of spec.plans) {
    for (const off of [false, true]) {
      const sleeve = held.filter((h) => h.plan === plan && h.off === off);
      if (!sleeve.length) continue;
      const total = off ? (plan.offPct ?? 0) : plan.port - (plan.offPct ?? 0);
      const w = normalise(sleeve, (h) => h.raw, total);
      sleeve.forEach((h, i) => {
        const weight = w[i];
        const mv = (weight / 100) * spec.nav;
        holdings.push({
          ...h.bond,
          weight,
          mv,
          active: weight - h.bond.benchWeight,
          dv01: mv * h.bond.modDur * 0.1,
        });
      });
    }
  }
  holdings.sort((a, b) => b.mv - a.mv);

  return {
    id: spec.id,
    name: spec.name,
    benchmark: spec.benchmark,
    benchmarkShort: spec.benchmarkShort,
    nav: spec.nav,
    holdings,
    bench,
  };
}

export const FUNDS: Fund[] = SPECS.map(buildFund);
export const FUND_BY_ID = Object.fromEntries(FUNDS.map((f) => [f.id, f])) as Record<FundId, Fund>;

/* ================================================================== */
/*  Cross-filter                                                       */
/* ================================================================== */

export interface XFilter {
  tenor: TenorBucket | null;
  rating: RatingBucket | null;
  sector: Sector | null;
}
export type XDim = keyof XFilter;
export const NO_FILTER: XFilter = { tenor: null, rating: null, sector: null };
export const DIM_LABEL: Record<XDim, string> = { tenor: "Tenor", rating: "Rating", sector: "Sector" };

/** AND of every active dimension, optionally ignoring one (for the chart that owns it). */
export function inSlice(b: Bond, f: XFilter, skip?: XDim): boolean {
  if (skip !== "tenor" && f.tenor && b.tenor !== f.tenor) return false;
  if (skip !== "rating" && f.rating && b.bucket !== f.rating) return false;
  if (skip !== "sector" && f.sector && b.sector !== f.sector) return false;
  return true;
}

export const isFiltered = (f: XFilter) => Boolean(f.tenor || f.rating || f.sector);

/* ================================================================== */
/*  Aggregation                                                        */
/* ================================================================== */

export interface Side {
  count: number;
  weight: number; // % of NAV / % of index inside the slice
  ytw: number | null;
  modDur: number | null;
  sprDur: number | null;
  oas: number | null;
  convexity: number | null;
  notch: number | null;
  dv01: number; // £k/bp, benchmark scaled to NAV
}

function side(items: { w: number; b: Bond }[], nav: number): Side {
  const W = items.reduce((a, x) => a + x.w, 0);
  const avg = (get: (b: Bond) => number) => (W > 0 ? items.reduce((a, x) => a + x.w * get(x.b), 0) / W : null);
  const rated = items.filter((x) => x.b.notch > 0);
  const Wr = rated.reduce((a, x) => a + x.w, 0);
  return {
    count: items.length,
    weight: W,
    ytw: avg((b) => b.ytw),
    modDur: avg((b) => b.modDur),
    sprDur: avg((b) => b.sprDur),
    oas: avg((b) => b.oas),
    convexity: avg((b) => b.convexity),
    notch: Wr > 0 ? rated.reduce((a, x) => a + x.w * x.b.notch, 0) / Wr : null,
    dv01: items.reduce((a, x) => a + (x.w / 100) * x.b.modDur, 0) * nav * 0.1,
  };
}

export function sliceStats(fund: Fund, f: XFilter) {
  const hs = fund.holdings.filter((h) => inSlice(h, f));
  const bs = fund.bench.filter((b) => inSlice(b, f));
  return {
    holdings: hs,
    mv: hs.reduce((a, h) => a + h.mv, 0),
    port: side(
      hs.map((h) => ({ w: h.weight, b: h })),
      fund.nav,
    ),
    bench: side(
      bs.map((b) => ({ w: b.benchWeight, b })),
      fund.nav,
    ),
  };
}
export type SliceStats = ReturnType<typeof sliceStats>;

/** Contribution to duration (years) by tenor bucket; the tenor dimension itself is not applied. */
export function keyRateRows(fund: Fund, f: XFilter) {
  return TENOR_BUCKETS.map((t) => {
    const port = fund.holdings
      .filter((h) => h.tenor === t && inSlice(h, f, "tenor"))
      .reduce((a, h) => a + (h.weight / 100) * h.modDur, 0);
    const bench = fund.bench
      .filter((b) => b.tenor === t && inSlice(b, f, "tenor"))
      .reduce((a, b) => a + (b.benchWeight / 100) * b.modDur, 0);
    return { key: t, port, bench, active: port - bench };
  });
}

/** % of NAV vs % of index by rating bucket. */
export function creditRows(fund: Fund, f: XFilter) {
  return RATING_BUCKETS.map((r) => ({
    key: r,
    port: fund.holdings.filter((h) => h.bucket === r && inSlice(h, f, "rating")).reduce((a, h) => a + h.weight, 0),
    bench: fund.bench.filter((b) => b.bucket === r && inSlice(b, f, "rating")).reduce((a, b) => a + b.benchWeight, 0),
  }));
}

/** Contribution to spread duration (years) by sector. */
export function sectorRows(fund: Fund, f: XFilter) {
  return SECTORS.map((s) => ({
    key: s,
    port: fund.holdings
      .filter((h) => h.sector === s && inSlice(h, f, "sector"))
      .reduce((a, h) => a + (h.weight / 100) * h.sprDur, 0),
    bench: fund.bench
      .filter((b) => b.sector === s && inSlice(b, f, "sector"))
      .reduce((a, b) => a + (b.benchWeight / 100) * b.sprDur, 0),
    held: fund.holdings.some((h) => h.sector === s),
    indexed: fund.bench.some((b) => b.sector === s),
  }));
}

/* ================================================================== */
/*  Formatting                                                         */
/* ================================================================== */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nf = (dp: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);
const NF3 = nf(3);

export const fmt = {
  n0: (v: number) => NF0.format(v),
  n1: (v: number) => NF1.format(v),
  n2: (v: number) => NF2.format(v),
  n3: (v: number) => NF3.format(v),
  pct2: (v: number) => `${NF2.format(v)}%`,
  pct1: (v: number) => `${NF1.format(v)}%`,
  /** Signed with a real minus sign. */
  signed: (v: number, dp: number, unit = "") => {
    const s = (dp === 0 ? NF0 : dp === 1 ? NF1 : dp === 2 ? NF2 : NF3).format(Math.abs(v));
    const zero = Number(s.replace(/,/g, "")) === 0;
    return `${zero ? "±" : v > 0 ? "+" : "−"}${s}${unit}`;
  },
  gbp: (m: number) => (m >= 1000 ? `£${NF2.format(m / 1000)}bn` : `£${NF0.format(m)}m`),
  /** "07 Mar 2034": fixed three-letter months so the column stays aligned. */
  date: (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
  },
};

/* ================================================================== */
/*  Colour (validated set from the dashboard brief)                    */
/* ================================================================== */

export const COLORS = {
  accent: "#2563eb", // blue-600: today's curve, selection, focus
  accentWash: "#eff6ff", // blue-50: selected category band
  over: "#4f46e5", // diverging pole: above benchmark
  under: "#f97316", // diverging pole: below benchmark
  mid: "#e5e5e5",
  cat1: "#4f46e5",
  cat2: "#0ea5e9",
  compare: "#a3a3a3",
  muted: "#cbd5e1",
  ink: "#171717",
  ink2: "#525252",
  ink3: "#737373",
};

/** Hex → rgba, for dimming unselected marks without changing their hue. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
