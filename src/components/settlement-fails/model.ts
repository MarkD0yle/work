/* Settlement Fails: model.
 *
 * A seeded intraday snapshot of a custodian's failing settlement
 * instructions across six markets as at Tue 22 Sep 2026 10:40, plus a
 * 60-business-day history kept at market × asset class × direction grain so
 * the header filters slice the history exactly as they slice the snapshot.
 * Today's history cell is built from the instruction list itself, so the
 * KPI tiles, the last column of the timeline, the ageing matrix, the market
 * table and the blotter can never disagree.
 *
 * Penalties follow the CSDR cash-penalty schedule: basis points of value per
 * business day failing, by instrument type. CSDR applies at the EU CSDs
 * (Euroclear Bank, Clearstream); the JASDEC and ASX fails charges are mapped
 * onto the same schedule for comparability; UK CREST and DTC have no
 * cash-penalty regime, so their instructions accrue nothing. The failing
 * party pays and its counterparty receives, so every instruction carries a
 * fault side and a signed accrual. */

export type MarketId = "crest" | "eb" | "cbl" | "dtc" | "jasdec" | "asx";
export type AssetClass = "Equity" | "Fixed income" | "ETF";
export type Direction = "Deliver" | "Receive";
export type Cause =
  | "Counterparty short"
  | "Instruction mismatch"
  | "Late instruction"
  | "Inventory short"
  | "Corporate action"
  | "SSI issue";
export type Status = "Matched-failing" | "Unmatched" | "Partial";
export type Regime = "csdr" | "local" | "none";
export type Fault = "us" | "cpty";
/** Age bucket index: T+0, T+1, T+2–3, T+4–7, T+8+. */
export type Bucket = 0 | 1 | 2 | 3 | 4;
export type Tone = "good" | "warn" | "bad" | "neutral";

export const ASSET_CLASSES: AssetClass[] = ["Equity", "Fixed income", "ETF"];
export const DIRECTIONS: Direction[] = ["Deliver", "Receive"];
export const CAUSES: Cause[] = [
  "Counterparty short",
  "Instruction mismatch",
  "Late instruction",
  "Inventory short",
  "Corporate action",
  "SSI issue",
];
export const BUCKETS: { label: string; from: number; to: number | null }[] = [
  { label: "T+0", from: 0, to: 0 },
  { label: "T+1", from: 1, to: 1 },
  { label: "T+2–3", from: 2, to: 3 },
  { label: "T+4–7", from: 4, to: 7 },
  { label: "T+8+", from: 8, to: null },
];
export const bucketOf = (age: number): Bucket => (age <= 0 ? 0 : age === 1 ? 1 : age <= 3 ? 2 : age <= 7 ? 3 : 4);

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

export const AS_OF = Date.UTC(2026, 8, 22); // Tue 22 Sep 2026
export const AS_OF_TIME = Date.UTC(2026, 8, 22, 10, 40);
const DAY_MS = 86_400_000;
const N_DAYS = 60;

function businessDays(): number[] {
  const out: number[] = [];
  for (let t = AS_OF; out.length < N_DAYS; t -= DAY_MS) {
    const wd = new Date(t).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    out.push(t);
  }
  return out.reverse();
}

/** 60 business days (weekdays) ending today; index TODAY is the snapshot. */
export const DAYS = businessDays();
export const TODAY = N_DAYS - 1;
/** The illustrative CSDR penalty-rate revision took effect on 1 Sep 2026. */
export const REVISION_T = Date.UTC(2026, 8, 1);
const SEP_START = DAYS.indexOf(REVISION_T);
const AUG_START = DAYS.findIndex((t) => new Date(t).getUTCMonth() === 7);
/** Business days month-to-date, including today. */
export const MTD_DAYS = N_DAYS - SEP_START;
/** Fails-rate sparkline window and the "usual range" reference window. */
export const SPARK_DAYS = 30;

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

export interface Market {
  id: MarketId;
  label: string;
  ccy: string;
  /** GBP per unit of local currency: a fixed illustrative rate. */
  fx: number;
  regime: Regime;
  /** Typical value due to settle per day, £m. */
  due: number;
  /** Failing instructions in today's snapshot. */
  count: number;
  /** Equity / fixed income / ETF mix of the market's instructions. */
  acMix: [number, number, number];
  /** Share of penalty accrual where we are the failing party. */
  faultUs: number;
  isinPrefix: string;
}

export const MARKETS: Market[] = [
  { id: "crest", label: "UK CREST", ccy: "GBP", fx: 1, regime: "none", due: 3000, count: 84, acMix: [0.6, 0.28, 0.12], faultUs: 0.41, isinPrefix: "GB" },
  { id: "eb", label: "Euroclear Bank", ccy: "EUR", fx: 0.86, regime: "csdr", due: 2000, count: 54, acMix: [0.25, 0.7, 0.05], faultUs: 0.36, isinPrefix: "BE" },
  { id: "cbl", label: "Clearstream", ccy: "EUR", fx: 0.86, regime: "csdr", due: 1400, count: 40, acMix: [0.35, 0.55, 0.1], faultUs: 0.52, isinPrefix: "DE" },
  { id: "dtc", label: "DTC", ccy: "USD", fx: 0.78, regime: "none", due: 1700, count: 46, acMix: [0.6, 0.25, 0.15], faultUs: 0.41, isinPrefix: "US" },
  { id: "jasdec", label: "JASDEC", ccy: "JPY", fx: 0.0052, regime: "local", due: 600, count: 21, acMix: [0.55, 0.4, 0.05], faultUs: 0.4, isinPrefix: "JP" },
  { id: "asx", label: "ASX", ccy: "AUD", fx: 0.51, regime: "local", due: 480, count: 18, acMix: [0.7, 0.2, 0.1], faultUs: 0.45, isinPrefix: "AU" },
];
export const MARKET_BY_ID = Object.fromEntries(MARKETS.map((m) => [m.id, m])) as Record<MarketId, Market>;
export const REGIME_LABEL: Record<Regime, string> = {
  csdr: "CSDR penalties",
  local: "Local fails charge",
  none: "No cash penalty regime",
};

/** CSDR cash-penalty rates, basis points of value per business day failing. */
export const RATE_BP = { liquid: 1.0, illiquid: 0.5, govt: 0.1, other: 0.2, etf: 0.5 } as const;
type Kind = keyof typeof RATE_BP;

interface Security {
  market: MarketId;
  name: string;
  ac: AssetClass;
  kind: Kind;
  /** Local-currency price per share / unit, or per 100 nominal for bonds. */
  price: number;
  isin: string;
}

/* Fictional issuers. Government bonds are the only real-sounding names, and
 * they are generic. */
const SECURITY_SEED: [MarketId, string, AssetClass, Kind, number][] = [
  ["crest", "Brackenfield plc", "Equity", "liquid", 4.12],
  ["crest", "Northgate Utilities", "Equity", "liquid", 11.8],
  ["crest", "Fellside Engineering", "Equity", "liquid", 27.4],
  ["crest", "Ashcombe Retail Group", "Equity", "illiquid", 2.35],
  ["crest", "Tarn Water Holdings", "Equity", "illiquid", 6.1],
  ["crest", "UK Treasury 4¼% 2034", "Fixed income", "govt", 98.6],
  ["crest", "UK Treasury 1½% 2047", "Fixed income", "govt", 61.2],
  ["crest", "Northgate Utilities 5.1% 2031", "Fixed income", "other", 101.3],
  ["crest", "Halcyon Homes 6¾% 2029", "Fixed income", "other", 97.9],
  ["crest", "Albion FTSE Core ETF", "ETF", "etf", 74.2],
  ["crest", "Albion Gilt Ladder ETF", "ETF", "etf", 48.3],
  ["eb", "Solvan Pharma NV", "Equity", "liquid", 58.4],
  ["eb", "Ardenne Logistics", "Equity", "illiquid", 17.25],
  ["eb", "Bund 2.6% 2036", "Fixed income", "govt", 99.1],
  ["eb", "OAT 3% 2034", "Fixed income", "govt", 100.4],
  ["eb", "OLO 3.3% 2033", "Fixed income", "govt", 102.1],
  ["eb", "Elstar Energie 4.4% 2030", "Fixed income", "other", 99.7],
  ["eb", "Meuse Chemie 5% 2028", "Fixed income", "other", 101.9],
  ["eb", "Lowlands Euro Bond ETF", "ETF", "etf", 112.6],
  ["cbl", "Rheinwerk Industrie AG", "Equity", "liquid", 84.1],
  ["cbl", "Nordsee Windkraft SE", "Equity", "liquid", 31.7],
  ["cbl", "Alpenbahn Holding", "Equity", "illiquid", 145.0],
  ["cbl", "Bobl 2.2% 2031", "Fixed income", "govt", 98.2],
  ["cbl", "Ostrava Metall 5¼% 2029", "Fixed income", "other", 98.8],
  ["cbl", "Rheinwerk 3.9% 2032", "Fixed income", "other", 100.6],
  ["cbl", "Lux Euro Govt ETF", "ETF", "etf", 141.2],
  ["dtc", "Cedar Ridge Software Inc", "Equity", "liquid", 212.5],
  ["dtc", "Pinnacle Freight Corp", "Equity", "liquid", 67.9],
  ["dtc", "Blue Mesa Biotech", "Equity", "illiquid", 14.3],
  ["dtc", "Delta Harbor Realty", "Equity", "illiquid", 22.6],
  ["dtc", "US Treasury 4⅜% 2033", "Fixed income", "govt", 99.3],
  ["dtc", "US Treasury 3⅞% 2044", "Fixed income", "govt", 91.4],
  ["dtc", "Pinnacle Freight 5.6% 2031", "Fixed income", "other", 100.2],
  ["dtc", "Cedar Ridge 4.9% 2029", "Fixed income", "other", 99.6],
  ["dtc", "Beacon Broad Market ETF", "ETF", "etf", 512.0],
  ["dtc", "Beacon Treasury 7–10y ETF", "ETF", "etf", 96.4],
  ["jasdec", "Kawano Electric", "Equity", "liquid", 4180],
  ["jasdec", "Shirakawa Motors", "Equity", "liquid", 2310],
  ["jasdec", "Hoshino Foods", "Equity", "illiquid", 1640],
  ["jasdec", "JGB 0.8% 2035", "Fixed income", "govt", 97.5],
  ["jasdec", "JGB 1.7% 2046", "Fixed income", "govt", 92.8],
  ["jasdec", "Kawano Electric 0.9% 2030", "Fixed income", "other", 99.9],
  ["jasdec", "Tokai Nikkei Core ETF", "ETF", "etf", 36200],
  ["asx", "Coolabah Minerals", "Equity", "liquid", 42.15],
  ["asx", "Southbank Banking Corp", "Equity", "liquid", 29.8],
  ["asx", "Wattle Health", "Equity", "illiquid", 3.42],
  ["asx", "Kimberley Lithium", "Equity", "illiquid", 1.18],
  ["asx", "ACGB 3.75% 2034", "Fixed income", "govt", 99.2],
  ["asx", "ACGB 4.25% 2036", "Fixed income", "govt", 101.5],
  ["asx", "Southbank Banking 5.2% 2030", "Fixed income", "other", 100.8],
  ["asx", "Wattle ASX 200 ETF", "ETF", "etf", 88.6],
];

interface Counterparty {
  name: string;
  weight: number;
  /** Markets where the counterparty is most active. */
  home: MarketId[];
}

const COUNTERPARTIES: Counterparty[] = [
  { name: "Meridian Prime Brokers", weight: 11, home: ["crest", "dtc"] },
  { name: "Castellan Securities", weight: 9, home: ["crest"] },
  { name: "Halvard & Roe", weight: 8, home: ["eb", "cbl"] },
  { name: "Oakhurst Capital Markets", weight: 7, home: ["dtc"] },
  { name: "Tessaract Bank", weight: 6.5, home: ["eb", "cbl"] },
  { name: "Vantera AG", weight: 6, home: ["cbl"] },
  { name: "Nordlicht Partners", weight: 5.5, home: ["cbl", "eb"] },
  { name: "Brightwater Broking", weight: 5, home: ["crest"] },
  { name: "Solano Securities", weight: 4.5, home: ["dtc"] },
  { name: "Kestrel Global Markets", weight: 4, home: ["crest", "asx"] },
  { name: "Alderway Custody", weight: 4, home: ["crest", "eb"] },
  { name: "Marlowe & Finch", weight: 3.5, home: ["crest"] },
  { name: "Pellucid Asset Servicing", weight: 3.5, home: ["jasdec", "asx"] },
  { name: "Ironbridge Capital", weight: 3, home: ["dtc"] },
  { name: "Quillon Bank", weight: 3, home: ["jasdec"] },
  { name: "Sable Point Securities", weight: 2.5, home: ["asx"] },
  { name: "Harrowgate Investments", weight: 2.5, home: ["crest"] },
  { name: "Windmere Global", weight: 2, home: ["dtc", "jasdec"] },
];
/** Migrated its SSIs last week: the source of this week's mismatch run. */
export const SSI_MIGRATION_CPTY = "Meridian Prime Brokers";

const OWNERS: Record<MarketId, string[]> = {
  crest: ["A. Okafor", "D. Byrne", "H. Sørensen"],
  eb: ["R. Lindqvist", "J. Moreau"],
  cbl: ["J. Moreau", "R. Lindqvist"],
  dtc: ["M. Chen", "S. Patel"],
  jasdec: ["K. Tanaka"],
  asx: ["L. Fernandes"],
};

/* Fail propensities. Cause weights by age bucket: young fails are mostly
 * instruction problems, old fails are stock and corporate-action problems. */
const CAUSE_BASE = [27, 20, 15, 14, 12, 12];
const CAUSE_BY_BUCKET: number[][] = [
  [0.6, 1.5, 2.0, 0.8, 0.5, 1.2],
  [1.0, 1.2, 1.2, 1.0, 0.8, 1.1],
  [1.2, 0.9, 0.7, 1.1, 1.1, 0.9],
  [1.3, 0.6, 0.4, 1.2, 1.6, 0.8],
  [1.2, 0.4, 0.2, 1.0, 2.5, 0.7],
];
/** Probability we are the failing party, by cause. */
const P_US = [0, 0.45, 0.4, 1, 0.5, 0.5];
const P_UNMATCHED = [0.04, 0.85, 0.3, 0.04, 0.05, 0.6];
const P_PARTIAL = [0.15, 0.01, 0.02, 0.2, 0.05, 0.02];
const MEAN_AGE = [3.2, 1.1, 0.6, 2.8, 5.5, 1.6];
/** Age (business days since ISD) weights, index = age. */
const AGE_W = [34, 24, 12, 9, 5, 4.5, 3.5, 3, 2, 1.6, 1.3, 1.0, 0.8, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1];
/** Log-normal value medians by asset class, £. */
const VALUE_MEDIAN = [360_000, 1_400_000, 280_000];
/** Mean of that distribution (median × e^0.5), used by the history generator. */
const VALUE_MEAN = VALUE_MEDIAN.map((m) => m * Math.exp(0.5));
/** Value-weighted average penalty rate by asset class, for the history. */
const AVG_BP = [0.8, 0.14, 0.5];
const DIR_SHARE = [0.52, 0.48];

/* ------------------------------------------------------------------ *
 * Seeded generation helpers
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
type Rng = () => number;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normal(rng: Rng): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickW(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Knuth's Poisson sampler; the cell rates here are all small. */
function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function binomial(rng: Rng, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

/* ISIN check digit: letters expand to two digits, then Luhn. */
const NSIN_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function isinCheck(body: string): string {
  const digits = body
    .split("")
    .map((ch) => (ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55)))
    .join("");
  let sum = 0;
  let dbl = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let v = Number(digits[i]);
    if (dbl) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    dbl = !dbl;
  }
  return String((10 - (sum % 10)) % 10);
}

function makeSecurities(): Security[] {
  const rng = mulberry32(0x15a1);
  return SECURITY_SEED.map(([market, name, ac, kind, price]) => {
    let nsin = "";
    for (let i = 0; i < 9; i++) nsin += NSIN_ALPHABET[Math.floor(rng() * NSIN_ALPHABET.length)];
    const body = MARKET_BY_ID[market].isinPrefix + nsin;
    return { market, name, ac, kind, price, isin: body + isinCheck(body) };
  });
}
const SECURITIES = makeSecurities();

/* ------------------------------------------------------------------ *
 * The snapshot: failing instructions
 * ------------------------------------------------------------------ */

export interface Instruction {
  /** Trade reference. */
  id: string;
  isin: string;
  security: string;
  market: MarketId;
  assetClass: AssetClass;
  direction: Direction;
  counterparty: string;
  quantity: number;
  /** Settlement value, £. */
  value: number;
  /** Intended settlement date (UTC midnight). */
  isd: number;
  /** Business days since ISD; 0 is due today. */
  age: number;
  bucket: Bucket;
  cause: Cause;
  status: Status;
  fault: Fault;
  rateBp: number;
  /** Penalty accrual per business day, £, signed: negative when we pay. */
  perDay: number;
  /** Accrued to date, £, signed (age × perDay; nothing yet for T+0). */
  cum: number;
  owner: string;
}

function pickCounterparty(rng: Rng, market: MarketId): string {
  const w = COUNTERPARTIES.map((c) => c.weight * (c.home.includes(market) ? 2.5 : 1));
  return COUNTERPARTIES[pickW(rng, w)].name;
}

function generateInstructions(): Instruction[] {
  const rng = mulberry32(0x5e771e);
  const out: Instruction[] = [];
  let ref = 4_471_000;
  for (const mkt of MARKETS) {
    for (let k = 0; k < mkt.count; k++) {
      ref += 1 + Math.floor(rng() * 37);
      const age = pickW(rng, AGE_W);
      const bucket = bucketOf(age);
      const acIx = pickW(rng, mkt.acMix);
      const assetClass = ASSET_CLASSES[acIx];
      const pool = SECURITIES.filter((s) => s.market === mkt.id && s.ac === assetClass);
      const sec = pool[Math.floor(rng() * pool.length)];
      const counterparty = pickCounterparty(rng, mkt.id);
      const skew = counterparty === SSI_MIGRATION_CPTY ? [1, 3, 1, 1, 1, 2] : [1, 1, 1, 1, 1, 1];
      const causeIx = pickW(rng, CAUSE_BASE.map((b, c) => b * CAUSE_BY_BUCKET[bucket][c] * skew[c]));
      const cause = CAUSES[causeIx];
      // We can only be short stock on a delivery; a short counterparty only hurts a receipt.
      const direction: Direction =
        cause === "Inventory short" ? "Deliver" : cause === "Counterparty short" ? "Receive" : rng() < DIR_SHARE[0] ? "Deliver" : "Receive";
      const status: Status =
        rng() < P_UNMATCHED[causeIx] ? "Unmatched" : rng() < P_PARTIAL[causeIx] ? "Partial" : "Matched-failing";
      const pUs = clamp(P_US[causeIx] * (mkt.faultUs / 0.41), 0, 1);
      const fault: Fault = rng() < pUs ? "us" : "cpty";
      const value = Math.round(clamp(VALUE_MEDIAN[acIx] * Math.exp(normal(rng)), 20_000, 25_000_000) / 100) * 100;
      const local = value / mkt.fx;
      const quantity =
        assetClass === "Fixed income"
          ? Math.max(1000, Math.round(local / (sec.price / 100) / 1000) * 1000)
          : assetClass === "ETF"
            ? Math.max(10, Math.round(local / sec.price / 10) * 10)
            : Math.max(100, Math.round(local / sec.price / 100) * 100);
      const rateBp = RATE_BP[sec.kind];
      const perDayAbs = mkt.regime === "none" ? 0 : Math.round((value * rateBp) / 1e4);
      const sign = fault === "us" ? -1 : 1;
      const owners = OWNERS[mkt.id];
      out.push({
        id: `TR-${ref}`,
        isin: sec.isin,
        security: sec.name,
        market: mkt.id,
        assetClass,
        direction,
        counterparty,
        quantity,
        value,
        isd: DAYS[TODAY - age],
        age,
        bucket,
        cause,
        status,
        fault,
        rateBp,
        perDay: sign * perDayAbs || 0,
        cum: sign * perDayAbs * age || 0,
        owner: owners[Math.floor(rng() * owners.length)],
      });
    }
  }
  return out;
}

export const INSTRUCTIONS = generateInstructions();

/* ------------------------------------------------------------------ *
 * The history cube: day × market × asset class × direction
 * ------------------------------------------------------------------ */

export interface Cell {
  /** Failing instructions by cause (CAUSES order). */
  fails: number[];
  n: number;
  /** Failing value, £. */
  value: number;
  /** Value due to settle, £. */
  due: number;
  unmatched: number;
  /** Sum of ages, so avg age can be re-derived after aggregation. */
  ageSum: number;
  /** Penalty accrual for the day, £ (today: projected for open fails). */
  paid: number;
  received: number;
}

const N_CELLS = MARKETS.length * 3 * 2;
const cellIx = (m: number, a: number, r: number) => (m * 3 + a) * 2 + r;

/* Activity level relative to today's snapshot, plus the cause-specific
 * episodes that give the timeline a story: a stock-loan recall in mid July,
 * the late-August dividend season, a run of counterparty shorts, and the SSI
 * migration that is driving this week's mismatches. */
const level = (d: number) => 0.72 + 0.1 * (d / (N_DAYS - 1)) + 0.04 * Math.sin(d / 4.5);
const CAUSE_EPISODES: ((d: number) => number)[] = [
  (d) => (d >= 49 && d <= 55 ? 1.5 : 1),
  (d) => (d >= 55 ? 1.5 : 1),
  (d) => (d >= SEP_START ? 0.85 : 1),
  (d) => (d >= 12 && d <= 16 ? 1.7 : 1),
  (d) => (d >= 39 && d <= 47 ? 2.2 : 1),
  (d) => (d >= 55 ? 1.3 : 1),
];
/* The same direction rule as the instruction generator: we can only be short
 * stock on a delivery, and a short counterparty only hurts a receipt. */
const dirShare = (c: number, r: number) => (c === 0 ? (r === 1 ? 1 : 0) : c === 3 ? (r === 0 ? 1 : 0) : DIR_SHARE[r]);
/** Penalty rates were a quarter lower before the 1 Sep revision. */
const rateScale = (d: number) => (d < SEP_START ? 0.75 : 1);

function emptyCell(due: number): Cell {
  return { fails: new Array<number>(CAUSES.length).fill(0), n: 0, value: 0, due, unmatched: 0, ageSum: 0, paid: 0, received: 0 };
}

function todayCell(mkt: Market, a: number, r: number, due: number): Cell {
  const cell = emptyCell(due);
  for (const i of INSTRUCTIONS) {
    if (i.market !== mkt.id || i.assetClass !== ASSET_CLASSES[a] || i.direction !== DIRECTIONS[r]) continue;
    cell.fails[CAUSES.indexOf(i.cause)]++;
    cell.n++;
    cell.value += i.value;
    if (i.status === "Unmatched") cell.unmatched++;
    cell.ageSum += i.age;
    if (i.perDay < 0) cell.paid -= i.perDay;
    else cell.received += i.perDay;
  }
  return cell;
}

function generateCube(): Cell[][] {
  const rng = mulberry32(0xc5d8);
  const cube: Cell[][] = [];
  for (let d = 0; d < N_DAYS; d++) {
    const wd = new Date(DAYS[d]).getUTCDay();
    const dow = wd === 1 ? 0.95 : wd === 5 ? 1.08 : 1;
    const cells: Cell[] = new Array<Cell>(N_CELLS);
    MARKETS.forEach((mkt, m) => {
      for (let a = 0; a < 3; a++) {
        for (let r = 0; r < 2; r++) {
          const due = mkt.due * 1e6 * mkt.acMix[a] * DIR_SHARE[r] * dow * (0.92 + rng() * 0.16);
          if (d === TODAY) {
            cells[cellIx(m, a, r)] = todayCell(mkt, a, r, due);
            continue;
          }
          const expected = mkt.count * mkt.acMix[a] * level(d);
          const cell = emptyCell(due);
          CAUSE_BASE.forEach((base, c) => {
            const k = poisson(rng, expected * (base / 100) * dirShare(c, r) * CAUSE_EPISODES[c](d) * (0.85 + rng() * 0.3));
            cell.fails[c] = k;
            cell.n += k;
            cell.value += k * VALUE_MEAN[a] * Math.exp(0.3 * normal(rng));
            cell.unmatched += binomial(rng, k, P_UNMATCHED[c]);
            cell.ageSum += k * MEAN_AGE[c] * (0.8 + rng() * 0.4);
          });
          if (mkt.regime !== "none") {
            const gross = ((cell.value * AVG_BP[a]) / 1e4) * rateScale(d);
            cell.paid = gross * clamp(mkt.faultUs * (0.85 + rng() * 0.3), 0, 1);
            cell.received = gross - cell.paid;
          }
          cells[cellIx(m, a, r)] = cell;
        }
      }
    });
    cube.push(cells);
  }
  return cube;
}

const CUBE = generateCube();

/* ------------------------------------------------------------------ *
 * The view: everything the page shows, from one filter set
 * ------------------------------------------------------------------ */

export interface Filters {
  markets: MarketId[];
  assetClass: AssetClass | "All";
  direction: Direction | "All";
}

export const ALL_MARKETS: MarketId[] = MARKETS.map((m) => m.id);
export const DEFAULT_FILTERS: Filters = { markets: ALL_MARKETS, assetClass: "All", direction: "All" };

export interface DayAgg {
  t: number;
  byCause: number[];
  n: number;
  value: number;
  due: number;
  /** Fails rate by value, per cent. */
  rate: number;
  unmatched: number;
  avgAge: number;
  paid: number;
  received: number;
}

export interface Stat {
  v: number;
  /** The comparison figure: 30-business-day average (previous month for penalties). */
  ref: number;
  tone: Tone;
}

export interface Kpis {
  failing: Stat;
  value: Stat;
  rate: Stat & { spark: number[]; p10: number; p90: number; aboveBand: boolean };
  age: Stat;
  penalties: Stat & { paid: number; received: number };
  unmatched: Stat;
}

export interface MarketRow {
  market: Market;
  n: number;
  value: number;
  due: number;
  rate: number;
  avgAge: number;
  unmatched: number;
  /** Month-to-date penalties, £. */
  paid: number;
  received: number;
  net: number;
  /** Net over the same number of business days of the previous month. */
  prevNet: number;
}

export interface MatrixRow {
  counterparty: string;
  cells: { n: number; value: number }[];
  n: number;
  value: number;
}

export interface Matrix {
  rows: MatrixRow[];
  colTotals: number[];
  total: number;
  /** Distinct counterparties in the slice, before the top-12 cut. */
  counterparties: number;
}

/** A cross-filter from the ageing matrix: a counterparty, an age bucket, or both. */
export type Focus = { counterparty: string | null; bucket: Bucket | null };

export interface View {
  filters: Filters;
  rows: Instruction[];
  days: DayAgg[];
  kpis: Kpis;
  markets: MarketRow[];
  matrix: Matrix;
  empty: boolean;
}

function sumCells(cells: Cell[], idx: number[], t: number): DayAgg {
  const byCause = new Array<number>(CAUSES.length).fill(0);
  let n = 0;
  let value = 0;
  let due = 0;
  let unmatched = 0;
  let ageSum = 0;
  let paid = 0;
  let received = 0;
  for (const i of idx) {
    const c = cells[i];
    for (let k = 0; k < byCause.length; k++) byCause[k] += c.fails[k];
    n += c.n;
    value += c.value;
    due += c.due;
    unmatched += c.unmatched;
    ageSum += c.ageSum;
    paid += c.paid;
    received += c.received;
  }
  return {
    t,
    byCause,
    n,
    value,
    due,
    rate: due > 0 ? (100 * value) / due : 0,
    unmatched,
    avgAge: n > 0 ? ageSum / n : 0,
    paid,
    received,
  };
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Tone from a "how much worse" ratio: positive means worse. */
function toneFrom(worse: number, warnAt: number, badAt: number): Tone {
  if (!Number.isFinite(worse)) return "neutral";
  if (worse >= badAt) return "bad";
  if (worse >= warnAt) return "warn";
  if (worse <= -warnAt) return "good";
  return "neutral";
}
const relWorse = (cur: number, ref: number) => (ref > 0 ? (cur - ref) / ref : cur > 0 ? 1 : 0);

function cellIndexes(f: Filters): number[] {
  const idx: number[] = [];
  MARKETS.forEach((mkt, m) => {
    if (!f.markets.includes(mkt.id)) return;
    for (let a = 0; a < 3; a++) {
      if (f.assetClass !== "All" && ASSET_CLASSES[a] !== f.assetClass) continue;
      for (let r = 0; r < 2; r++) {
        if (f.direction !== "All" && DIRECTIONS[r] !== f.direction) continue;
        idx.push(cellIx(m, a, r));
      }
    }
  });
  return idx;
}

const netOver = (days: DayAgg[], from: number, to: number) => {
  let paid = 0;
  let received = 0;
  for (let d = from; d < to; d++) {
    paid += days[d].paid;
    received += days[d].received;
  }
  return { net: received - paid, paid, received };
};

export function buildView(f: Filters): View {
  const rows = INSTRUCTIONS.filter(
    (i) =>
      f.markets.includes(i.market) &&
      (f.assetClass === "All" || i.assetClass === f.assetClass) &&
      (f.direction === "All" || i.direction === f.direction),
  );
  const idx = cellIndexes(f);
  const days = DAYS.map((t, d) => sumCells(CUBE[d], idx, t));
  const today = days[TODAY];
  const prior30 = days.slice(TODAY - SPARK_DAYS, TODAY);

  const rates = prior30.map((d) => d.rate).sort((a, b) => a - b);
  const p10 = quantile(rates, 0.1);
  const p90 = quantile(rates, 0.9);
  const avgRate = mean(prior30.map((d) => d.rate));
  const avgN = mean(prior30.map((d) => d.n));
  const avgValue = mean(prior30.map((d) => d.value));
  const avgAge = mean(prior30.filter((d) => d.n > 0).map((d) => d.avgAge));
  const avgUnmatched = mean(prior30.map((d) => d.unmatched));

  const mtd = netOver(days, SEP_START, N_DAYS);
  const prev = netOver(days, AUG_START, AUG_START + MTD_DAYS);
  const gross = mtd.paid + mtd.received;

  const kpis: Kpis = {
    failing: { v: today.n, ref: avgN, tone: toneFrom(relWorse(today.n, avgN), 0.05, 0.15) },
    value: { v: today.value, ref: avgValue, tone: toneFrom(relWorse(today.value, avgValue), 0.05, 0.15) },
    rate: {
      v: today.rate,
      ref: avgRate,
      tone: toneFrom(today.rate - avgRate, 0.15, 0.4),
      spark: days.slice(TODAY - SPARK_DAYS + 1).map((d) => d.rate),
      p10,
      p90,
      aboveBand: today.rate > p90,
    },
    age: { v: today.avgAge, ref: avgAge, tone: toneFrom(relWorse(today.avgAge, avgAge), 0.05, 0.15) },
    penalties: {
      v: mtd.net,
      ref: prev.net,
      paid: mtd.paid,
      received: mtd.received,
      tone: toneFrom(gross > 0 ? (prev.net - mtd.net) / gross : 0, 0.05, 0.15),
    },
    unmatched: { v: today.unmatched, ref: avgUnmatched, tone: toneFrom(relWorse(today.unmatched, avgUnmatched), 0.05, 0.15) },
  };

  // Per-market rows use the same cube slice restricted to one market.
  const markets: MarketRow[] = MARKETS.filter((m) => f.markets.includes(m.id)).map((market) => {
    const mIdx = cellIndexes({ ...f, markets: [market.id] });
    const mDays = DAYS.map((t, d) => sumCells(CUBE[d], mIdx, t));
    const t = mDays[TODAY];
    const m = netOver(mDays, SEP_START, N_DAYS);
    const p = netOver(mDays, AUG_START, AUG_START + MTD_DAYS);
    return {
      market,
      n: t.n,
      value: t.value,
      due: t.due,
      rate: t.rate,
      avgAge: t.avgAge,
      unmatched: t.unmatched,
      paid: m.paid,
      received: m.received,
      net: m.net,
      prevNet: p.net,
    };
  });

  // Ageing matrix: the 12 counterparties with the most fails in the slice.
  const byCpty = new Map<string, MatrixRow>();
  for (const i of rows) {
    let row = byCpty.get(i.counterparty);
    if (!row) {
      row = { counterparty: i.counterparty, cells: BUCKETS.map(() => ({ n: 0, value: 0 })), n: 0, value: 0 };
      byCpty.set(i.counterparty, row);
    }
    row.cells[i.bucket].n++;
    row.cells[i.bucket].value += i.value;
    row.n++;
    row.value += i.value;
  }
  const ranked = [...byCpty.values()].sort((a, b) => b.n - a.n || b.value - a.value || a.counterparty.localeCompare(b.counterparty));
  const top = ranked.slice(0, 12);
  const colTotals = BUCKETS.map((_, b) => rows.filter((i) => i.bucket === b).length);
  const matrix: Matrix = { rows: top, colTotals, total: rows.length, counterparties: ranked.length };

  return { filters: f, rows, days, kpis, markets, matrix, empty: rows.length === 0 };
}

/** Business days in the current month before today, for the "Sep MTD" copy. */
export const MTD_LABEL = `${MTD_DAYS} business days`;
export const PREV_MONTH_FROM = DAYS[AUG_START];
export const PREV_MONTH_TO = DAYS[AUG_START + MTD_DAYS - 1];
