/* CLO Deal Monitor: model.
 *
 * Six fictional European CLOs, each with a tranche stack and a seeded pool of
 * 160–200 obligors. Everything on the page — the over-collateralisation and
 * interest-coverage tests, the collateral quality tests, the capital stack,
 * the industry treemap and the next-payment-date waterfall — is computed
 * from that pool and stack by one `dealView` function, so the numbers agree.
 *
 * Calibration: the generator draws par *weights* and then scales the pool so
 * the Class E OC ratio lands exactly on each deal's target. The haircut
 * fraction (CCC excess, defaulted assets, discount obligations) is scale
 * invariant, so this is a closed-form scaling rather than a search. It is
 * what lets one deal fail its Class E OC test and another sit 40 bps above
 * the trigger by construction, while every derived figure still comes from
 * the obligor level. */

export type DealId = "harlow4" | "meridian231" | "aldgate2" | "corvina3" | "tarn1" | "sable222";
export type RateScenario = "fixing" | "forward" | "up100";
export type TrancheClass = "A" | "B" | "C" | "D" | "E" | "F" | "Sub";
export type Rating = "Ba2" | "Ba3" | "B1" | "B2" | "B3" | "Caa1" | "Caa2" | "Caa3";
export type RatingBucket = "Ba" | "B1" | "B2" | "B3" | "Caa" | "Defaulted";
export type OcId = "ocAB" | "ocC" | "ocD" | "ocE";
export type IcId = "icAB" | "icC" | "icD";
export type CoverageId = OcId | IcId;
export type QualityId =
  | "warf"
  | "was"
  | "wal"
  | "diversity"
  | "warr"
  | "ccc"
  | "defaulted"
  | "secondLien"
  | "fixed"
  | "obligor"
  | "industry";
export type DealStatus = "pass" | "thin" | "fail";
export type WaterfallScenario = "current" | "stress";

export const AS_OF = Date.UTC(2026, 8, 21); // Mon 21 Sep 2026: latest trustee report
export const NEXT_PAYMENT = Date.UTC(2026, 9, 15); // 15 Oct 2026
/** Interest accrual days in the 15 Jul → 15 Oct 2026 period, actual/360. */
const PERIOD_DAYS = 92;
const YEAR_FRAC = PERIOD_DAYS / 360;
const DAY_MS = 86_400_000;
export const CCC_LIMIT = 7.5;
/** Cushion below which a passing coverage test is flagged as thin. */
export const THIN_BPS = 50;

export const RATES: Record<RateScenario, { label: string; euribor: number; note: string }> = {
  fixing: { label: "Fixing 2.10%", euribor: 2.1, note: "3M Euribor as fixed on 15 Jul 2026" },
  forward: { label: "Forward 1.85%", euribor: 1.85, note: "3M Euribor forward for the next period" },
  up100: { label: "+100 bps", euribor: 3.1, note: "3M Euribor 100 bps above the fixing" },
};

/* ------------------------------------------------------------------ *
 * Static reference data
 * ------------------------------------------------------------------ */

export interface Industry {
  id: string;
  name: string;
  short: string;
  /** Base weight in the pool, % of par before the per-deal tilt. */
  weight: number;
  /** Words used to build fictional obligor names in this industry. */
  words: string[];
}

export const INDUSTRIES: Industry[] = [
  { id: "health", name: "Healthcare & Pharmaceuticals", short: "Healthcare", weight: 9.5, words: ["Health", "Medical", "Pharma", "Clinics"] },
  { id: "bizsvc", name: "Services: Business", short: "Business svcs", weight: 8.5, words: ["Services", "Outsourcing", "Consulting", "Facilities"] },
  { id: "tech", name: "High Tech Industries", short: "High tech", weight: 8, words: ["Software", "Systems", "Digital", "Technologies"] },
  { id: "chem", name: "Chemicals, Plastics & Rubber", short: "Chemicals", weight: 6, words: ["Chemicals", "Polymers", "Coatings", "Materials"] },
  { id: "leisure", name: "Hotel, Gaming & Leisure", short: "Leisure", weight: 5.5, words: ["Hotels", "Resorts", "Leisure", "Gaming"] },
  { id: "media", name: "Media: Broadcasting & Subscription", short: "Media", weight: 5, words: ["Media", "Broadcasting", "Studios", "Networks"] },
  { id: "telco", name: "Telecommunications", short: "Telecoms", weight: 4.5, words: ["Telecom", "Fibre", "Mobile", "Connect"] },
  { id: "food", name: "Beverage, Food & Tobacco", short: "Food & bev", weight: 4.5, words: ["Foods", "Beverages", "Dairy", "Bakeries"] },
  { id: "constr", name: "Construction & Building", short: "Construction", weight: 4, words: ["Construction", "Building Products", "Cement", "Infrastructure"] },
  { id: "capeq", name: "Capital Equipment", short: "Capital equip", weight: 4, words: ["Engineering", "Machinery", "Industrial", "Equipment"] },
  { id: "retail", name: "Retail", short: "Retail", weight: 4, words: ["Retail", "Stores", "Fashion", "Home"] },
  { id: "nondur", name: "Consumer Goods: Non-Durable", short: "Non-durables", weight: 3.5, words: ["Consumer", "Personal Care", "Household", "Brands"] },
  { id: "dur", name: "Consumer Goods: Durable", short: "Durables", weight: 3, words: ["Appliances", "Furniture", "Sporting", "Home Products"] },
  { id: "cargo", name: "Transportation: Cargo", short: "Cargo", weight: 3, words: ["Logistics", "Freight", "Shipping", "Transport"] },
  { id: "auto", name: "Automotive", short: "Automotive", weight: 3, words: ["Automotive", "Components", "Motors", "Mobility"] },
  { id: "pack", name: "Containers, Packaging & Glass", short: "Packaging", weight: 3, words: ["Packaging", "Containers", "Glass", "Labels"] },
  { id: "consvc", name: "Services: Consumer", short: "Consumer svcs", weight: 3, words: ["Education", "Fitness", "Care", "Childcare"] },
  { id: "fire", name: "Banking, Finance, Insurance & Real Estate", short: "FIRE", weight: 3, words: ["Financial", "Insurance Services", "Property", "Capital"] },
  { id: "energy", name: "Energy: Oil & Gas", short: "Oil & gas", weight: 2.5, words: ["Energy", "Oilfield Services", "Midstream", "Gas"] },
  { id: "aero", name: "Aerospace & Defense", short: "Aerospace", weight: 2, words: ["Aerospace", "Defence", "Aviation", "Avionics"] },
  { id: "env", name: "Environmental Industries", short: "Environmental", weight: 2, words: ["Environmental", "Waste", "Recycling", "Water"] },
  { id: "util", name: "Utilities: Electric", short: "Utilities", weight: 2, words: ["Power", "Renewables", "Grid", "Energy Networks"] },
  { id: "print", name: "Media: Advertising, Printing & Publishing", short: "Publishing", weight: 2, words: ["Publishing", "Advertising", "Print", "Marketing"] },
  { id: "metals", name: "Metals & Mining", short: "Metals", weight: 2, words: ["Metals", "Mining", "Steel", "Alloys"] },
];
export const INDUSTRY_BY_ID = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i])) as Record<string, Industry>;

const STEMS = [
  "Aldermoor", "Ashgrove", "Bellhaven", "Brenwick", "Calloway", "Castellan", "Corran", "Dalquist",
  "Delvaux", "Dunmore", "Ebbtide", "Elstrom", "Falkenberg", "Fenmarch", "Garrow", "Grisedale",
  "Halden", "Harcourt", "Ilvaro", "Isenberg", "Jorvik", "Juno", "Kestrel", "Kirkwall",
  "Lindqvist", "Lorne", "Marrow", "Montrose", "Nordvell", "Norrland", "Ostrava", "Orvano",
  "Pellucid", "Penrose", "Quarrenden", "Quill", "Rosmarin", "Ravensworth", "Stellaris", "Sorrel",
  "Thorne", "Tessaly", "Umbral", "Ulvesund", "Valtorre", "Vanterpool", "Wexcombe", "Wystan",
  "Xanten", "Yarrow", "Zellweger", "Zephyr", "Abelard", "Bramwell", "Cordova", "Drummond",
  "Everard", "Fairlie", "Gaskell", "Holloway", "Ingram", "Jessop", "Kavanagh", "Lockhart",
  "Merrion", "Nettleton", "Oakhurst", "Prideaux", "Redfern", "Sayer", "Tremayne", "Underhill",
  "Veracruz", "Whitlock", "Amberley", "Birkett", "Clemence", "Dorrian", "Eskdale", "Fennimore",
];
const FORMS = ["SA", "BV", "GmbH", "SpA", "Ltd", "AB", "SAS", "Holdings", "Group", "AG", "Oy", "plc"];

export const RATINGS: Rating[] = ["Ba2", "Ba3", "B1", "B2", "B3", "Caa1", "Caa2", "Caa3"];
/** Moody's idealised rating factors. */
export const RATING_FACTOR: Record<Rating, number> = {
  Ba2: 1350, Ba3: 1766, B1: 2220, B2: 2720, B3: 3490, Caa1: 4770, Caa2: 6500, Caa3: 8070,
};
const SPREAD_MEAN: Record<Rating, number> = {
  Ba2: 285, Ba3: 305, B1: 340, B2: 380, B3: 430, Caa1: 500, Caa2: 560, Caa3: 620,
};
const PRICE_MEAN: Record<Rating, [number, number]> = {
  Ba2: [99.4, 0.6], Ba3: [99.3, 0.6], B1: [99.1, 0.7], B2: [98.4, 1.0], B3: [96.2, 2.2],
  Caa1: [86, 6], Caa2: [74, 8], Caa3: [62, 10],
};

export function ratingBucket(o: { rating: Rating; defaulted: boolean }): RatingBucket {
  if (o.defaulted) return "Defaulted";
  if (o.rating.startsWith("Caa")) return "Caa";
  if (o.rating.startsWith("Ba")) return "Ba";
  return o.rating as "B1" | "B2" | "B3";
}
export const BUCKETS: RatingBucket[] = ["Ba", "B1", "B2", "B3", "Caa", "Defaulted"];

/* ------------------------------------------------------------------ *
 * Deal specifications
 * ------------------------------------------------------------------ */

export interface TrancheSpec {
  cls: TrancheClass;
  rating: string;
  /** Original balance, €m. */
  orig: number;
  /** Current balance, €m (Class A amortises once reinvestment ends). */
  bal: number;
  /** Margin over 3M Euribor, bps. Subordinated notes carry no coupon. */
  spread: number;
}

interface Triggers {
  oc: Record<OcId, number>;
  ic: Record<IcId, number>;
}

interface Covenants {
  warf: number;
  was: number;
  wal: number;
  diversity: number;
  warr: number;
  defaulted: number;
  secondLien: number;
  fixed: number;
  obligor: number;
  industry: number;
}

export interface DealSpec {
  id: DealId;
  name: string;
  short: string;
  manager: string;
  trustee: string;
  vintage: number;
  closing: number;
  reinvestEnd: number;
  nonCallEnd: number;
  /** First payment date; periods before it carry no data. */
  firstPayment: number;
  tranches: TrancheSpec[];
  triggers: Triggers;
  covenants: Covenants;
  /** Where the Class E OC ratio is calibrated to land, %. */
  targetOcE: number;
  seed: number;
  n: number;
  /** Count shares of Ba / B1 / B2 / B3 among the performing, non-Caa assets. */
  mix: [number, number, number, number];
  /** CCC-and-below and defaulted buckets as % of par: hit exactly by construction. */
  cccShare: number;
  defaultShare: number;
  spreadShift: number;
  matRange: [number, number];
  /** Class E OC ratio offsets for the 11 prior periods, pp above current. */
  ocPath: number[];
  /** CCC and defaulted % of par for the 11 prior periods. */
  cccPath: number[];
  defPath: number[];
  /** Typical quarterly cash-on-cash for the equity, %. */
  cocBase: number;
  /** Whether the equity has cleared the incentive-fee IRR hurdle. */
  incentiveMet: boolean;
}

const d = (y: number, m: number, day: number) => Date.UTC(y, m - 1, day);

export const DEALS: DealSpec[] = [
  {
    id: "harlow4",
    name: "Harlow Park CLO IV",
    short: "Harlow Park IV",
    manager: "Harlow Park Capital",
    trustee: "Northgate Trustee Services",
    vintage: 2023,
    closing: d(2023, 6, 15),
    reinvestEnd: d(2027, 7, 15),
    nonCallEnd: d(2025, 7, 15),
    firstPayment: d(2024, 1, 15),
    tranches: [
      { cls: "A", rating: "AAA", orig: 248, bal: 248, spread: 150 },
      { cls: "B", rating: "AA", orig: 40, bal: 40, spread: 225 },
      { cls: "C", rating: "A", orig: 26, bal: 26, spread: 290 },
      { cls: "D", rating: "BBB−", orig: 26, bal: 26, spread: 430 },
      { cls: "E", rating: "BB−", orig: 20, bal: 20, spread: 700 },
      { cls: "F", rating: "B−", orig: 10, bal: 10, spread: 950 },
      { cls: "Sub", rating: "NR", orig: 36, bal: 36, spread: 0 },
    ],
    triggers: {
      oc: { ocAB: 128.9, ocC: 118.4, ocD: 111.2, ocE: 105.6 },
      ic: { icAB: 120, icC: 110, icD: 105 },
    },
    covenants: { warf: 3000, was: 3.6, wal: 5.75, diversity: 58, warr: 43, defaulted: 2.5, secondLien: 10, fixed: 10, obligor: 2.5, industry: 15 },
    targetOcE: 111.4,
    seed: 7401,
    n: 178,
    mix: [0.08, 0.22, 0.44, 0.26],
    cccShare: 5.2,
    defaultShare: 0.9,
    spreadShift: 0,
    matRange: [3.5, 7],
    ocPath: [-0.6, -0.4, -0.3, -0.1, 0.1, 0.3, 0.3, 0.4, 0.3, 0.2, 0.1],
    cccPath: [2.1, 2.4, 2.8, 3.1, 3.3, 3.6, 4.0, 4.3, 4.6, 4.9, 5.1],
    defPath: [0, 0, 0, 0, 0.4, 0.4, 0.4, 0.8, 0.8, 0.9, 0.9],
    cocBase: 4.0,
    incentiveMet: false,
  },
  {
    id: "meridian231",
    name: "Meridian Euro CLO 2023-1",
    short: "Meridian 2023-1",
    manager: "Meridian Credit Partners",
    trustee: "Elbe Corporate Trust",
    vintage: 2023,
    closing: d(2023, 10, 20),
    reinvestEnd: d(2028, 1, 15),
    nonCallEnd: d(2025, 10, 15),
    firstPayment: d(2024, 4, 15),
    tranches: [
      { cls: "A", rating: "AAA", orig: 279, bal: 279, spread: 165 },
      { cls: "B", rating: "AA", orig: 45, bal: 45, spread: 245 },
      { cls: "C", rating: "A", orig: 29, bal: 29, spread: 310 },
      { cls: "D", rating: "BBB−", orig: 29.5, bal: 29.5, spread: 460 },
      { cls: "E", rating: "BB−", orig: 22.5, bal: 22.5, spread: 740 },
      { cls: "F", rating: "B−", orig: 11, bal: 11, spread: 980 },
      { cls: "Sub", rating: "NR", orig: 40, bal: 40, spread: 0 },
    ],
    triggers: {
      oc: { ocAB: 129.4, ocC: 118.9, ocD: 111.6, ocE: 105.9 },
      ic: { icAB: 120, icC: 110, icD: 105 },
    },
    covenants: { warf: 2950, was: 3.75, wal: 6.25, diversity: 60, warr: 43.5, defaulted: 2.5, secondLien: 10, fixed: 10, obligor: 2.5, industry: 15 },
    targetOcE: 112.1,
    seed: 7402,
    n: 192,
    mix: [0.09, 0.24, 0.43, 0.24],
    cccShare: 3.9,
    defaultShare: 0.5,
    spreadShift: 5,
    matRange: [3.5, 7.5],
    ocPath: [-0.3, -0.2, -0.1, 0, 0.1, 0.1, 0.2, 0.2, 0.1, 0.1, 0],
    cccPath: [1.6, 1.8, 2.1, 2.3, 2.6, 2.9, 3.0, 3.3, 3.6, 3.8, 3.9],
    defPath: [0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5],
    cocBase: 3.7,
    incentiveMet: false,
  },
  {
    id: "aldgate2",
    name: "Aldgate Loan Partners II",
    short: "Aldgate II",
    manager: "Aldgate Loan Partners",
    trustee: "Lyndon Trust (Dublin)",
    vintage: 2021,
    closing: d(2021, 9, 30),
    reinvestEnd: d(2025, 10, 15),
    nonCallEnd: d(2023, 10, 15),
    firstPayment: d(2024, 1, 15),
    tranches: [
      { cls: "A", rating: "AAA", orig: 232.5, bal: 214, spread: 95 },
      { cls: "B", rating: "AA", orig: 37.5, bal: 37.5, spread: 165 },
      { cls: "C", rating: "A", orig: 24, bal: 24, spread: 205 },
      { cls: "D", rating: "BBB", orig: 25, bal: 25, spread: 300 },
      { cls: "E", rating: "BB−", orig: 19.5, bal: 19.5, spread: 590 },
      { cls: "F", rating: "B−", orig: 9.5, bal: 9.5, spread: 850 },
      { cls: "Sub", rating: "NR", orig: 33, bal: 33, spread: 0 },
    ],
    triggers: {
      oc: { ocAB: 127.6, ocC: 117.8, ocD: 110.6, ocE: 105.4 },
      ic: { icAB: 120, icC: 110, icD: 105 },
    },
    covenants: { warf: 3050, was: 3.3, wal: 4.0, diversity: 55, warr: 42, defaulted: 2.5, secondLien: 10, fixed: 10, obligor: 2.5, industry: 15 },
    targetOcE: 105.8,
    seed: 7403,
    n: 166,
    mix: [0.05, 0.19, 0.43, 0.33],
    cccShare: 6.8,
    defaultShare: 2.1,
    spreadShift: -20,
    matRange: [2, 5],
    ocPath: [2.4, 2.3, 2.1, 2.0, 1.8, 1.5, 1.3, 1.0, 0.7, 0.4, 0.2],
    cccPath: [3.4, 3.8, 4.1, 4.6, 5.0, 5.3, 5.8, 6.1, 6.4, 6.6, 6.8],
    defPath: [0.4, 0.4, 0.9, 0.9, 1.2, 1.2, 1.6, 1.6, 2.0, 2.0, 2.1],
    cocBase: 3.6,
    incentiveMet: true,
  },
  {
    id: "corvina3",
    name: "Corvina Euro CLO III",
    short: "Corvina III",
    manager: "Corvina Asset Management",
    trustee: "Havelock Fiduciary",
    vintage: 2019,
    closing: d(2019, 7, 25),
    reinvestEnd: d(2023, 10, 15),
    nonCallEnd: d(2021, 7, 15),
    firstPayment: d(2024, 1, 15),
    tranches: [
      { cls: "A", rating: "AAA", orig: 217, bal: 96, spread: 110 },
      { cls: "B", rating: "AA", orig: 35, bal: 35, spread: 170 },
      { cls: "C", rating: "A", orig: 22.5, bal: 22.5, spread: 240 },
      { cls: "D", rating: "BBB", orig: 22, bal: 22, spread: 360 },
      { cls: "E", rating: "BB", orig: 18, bal: 18, spread: 640 },
      { cls: "F", rating: "B−", orig: 9, bal: 9, spread: 900 },
      { cls: "Sub", rating: "NR", orig: 32, bal: 32, spread: 0 },
    ],
    triggers: {
      oc: { ocAB: 127, ocC: 117.5, ocD: 109.8, ocE: 104.9 },
      ic: { icAB: 120, icC: 110, icD: 105 },
    },
    covenants: { warf: 3100, was: 3.25, wal: 3.0, diversity: 50, warr: 41.5, defaulted: 2.5, secondLien: 10, fixed: 10, obligor: 2.5, industry: 15 },
    targetOcE: 102.4,
    seed: 7404,
    n: 161,
    mix: [0.03, 0.13, 0.43, 0.41],
    cccShare: 12.4,
    defaultShare: 4.3,
    spreadShift: -25,
    matRange: [1.2, 3.8],
    ocPath: [6.1, 5.9, 5.6, 5.4, 5.0, 4.6, 4.1, 3.4, 2.6, 1.6, 0.7],
    cccPath: [5.2, 5.8, 6.4, 7.0, 7.7, 8.4, 9.1, 9.9, 10.8, 11.7, 12.4],
    defPath: [1.1, 1.1, 1.6, 1.9, 2.3, 2.6, 2.9, 3.3, 3.7, 4.0, 4.3],
    cocBase: 3.2,
    incentiveMet: false,
  },
  {
    id: "tarn1",
    name: "Tarn Bridge CLO I",
    short: "Tarn Bridge I",
    manager: "Tarn Bridge Advisors",
    trustee: "Northgate Trustee Services",
    vintage: 2024,
    closing: d(2024, 3, 14),
    reinvestEnd: d(2029, 4, 15),
    nonCallEnd: d(2026, 4, 15),
    firstPayment: d(2024, 10, 15),
    tranches: [
      { cls: "A", rating: "AAA", orig: 263.5, bal: 263.5, spread: 140 },
      { cls: "B", rating: "AA", orig: 42.5, bal: 42.5, spread: 205 },
      { cls: "C", rating: "A", orig: 27.5, bal: 27.5, spread: 265 },
      { cls: "D", rating: "BBB−", orig: 28, bal: 28, spread: 395 },
      { cls: "E", rating: "BB−", orig: 21, bal: 21, spread: 670 },
      { cls: "F", rating: "B−", orig: 10.5, bal: 10.5, spread: 925 },
      { cls: "Sub", rating: "NR", orig: 38.5, bal: 38.5, spread: 0 },
    ],
    triggers: {
      oc: { ocAB: 129.1, ocC: 118.7, ocD: 111.4, ocE: 105.7 },
      ic: { icAB: 120, icC: 110, icD: 105 },
    },
    covenants: { warf: 2900, was: 3.55, wal: 6.75, diversity: 62, warr: 44, defaulted: 2.5, secondLien: 10, fixed: 10, obligor: 2.5, industry: 15 },
    targetOcE: 112.8,
    seed: 7405,
    n: 198,
    mix: [0.1, 0.25, 0.44, 0.21],
    cccShare: 2.8,
    defaultShare: 0,
    spreadShift: 10,
    matRange: [4, 7.5],
    ocPath: [0, 0, 0, -0.5, -0.3, -0.2, 0, 0.1, 0.1, 0.1, 0],
    cccPath: [0, 0, 0, 0.8, 1.1, 1.4, 1.7, 2.0, 2.3, 2.6, 2.8],
    defPath: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    cocBase: 4.5,
    incentiveMet: false,
  },
  {
    id: "sable222",
    name: "Sable Ridge Euro CLO 2022-2",
    short: "Sable Ridge 2022-2",
    manager: "Sable Ridge Capital",
    trustee: "Elbe Corporate Trust",
    vintage: 2022,
    closing: d(2022, 11, 10),
    reinvestEnd: d(2026, 11, 15),
    nonCallEnd: d(2024, 11, 15),
    firstPayment: d(2024, 1, 15),
    tranches: [
      { cls: "A", rating: "AAA", orig: 244, bal: 244, spread: 190 },
      { cls: "B", rating: "AA", orig: 40, bal: 40, spread: 290 },
      { cls: "C", rating: "A", orig: 26, bal: 26, spread: 370 },
      { cls: "D", rating: "BBB−", orig: 26, bal: 26, spread: 520 },
      { cls: "E", rating: "BB−", orig: 20, bal: 20, spread: 800 },
      { cls: "F", rating: "B−", orig: 10, bal: 10, spread: 1050 },
      { cls: "Sub", rating: "NR", orig: 37, bal: 37, spread: 0 },
    ],
    triggers: {
      oc: { ocAB: 128.2, ocC: 118.1, ocD: 110.9, ocE: 105.5 },
      ic: { icAB: 120, icC: 110, icD: 105 },
    },
    covenants: { warf: 3200, was: 3.9, wal: 5.0, diversity: 56, warr: 42.5, defaulted: 2.5, secondLien: 10, fixed: 10, obligor: 2.5, industry: 15 },
    targetOcE: 108.2,
    seed: 7406,
    n: 172,
    mix: [0.04, 0.17, 0.44, 0.35],
    cccShare: 8.6,
    defaultShare: 1.8,
    spreadShift: 40,
    matRange: [3, 6.5],
    ocPath: [1.9, 1.8, 1.7, 1.5, 1.3, 1.1, 0.9, 0.7, 0.5, 0.3, 0.1],
    cccPath: [2.8, 3.2, 3.7, 4.2, 4.8, 5.4, 6.1, 6.8, 7.4, 8.1, 8.6],
    defPath: [0, 0, 0.5, 0.5, 0.9, 0.9, 1.3, 1.3, 1.7, 1.7, 1.8],
    cocBase: 4.1,
    incentiveMet: false,
  },
];
export const DEAL_BY_ID = Object.fromEntries(DEALS.map((x) => [x.id, x])) as Record<DealId, DealSpec>;

/* ------------------------------------------------------------------ *
 * Seeded generation
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

/** FNV-1a: a stable per-key uniform in [0, 1) for values that must not move. */
export function hash01(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export interface Obligor {
  id: string;
  name: string;
  industry: string;
  rating: Rating;
  defaulted: boolean;
  /** Margin over Euribor, bps (floating) or the fixed coupon in bps. */
  spread: number;
  fixed: boolean;
  lien: 1 | 2;
  /** Par, €m. */
  par: number;
  /** Market price, % of par. */
  price: number;
  purchasePrice: number;
  maturity: number;
  /** Moody's assumed recovery rate, %. */
  recovery: number;
}

const pickWeighted = (u: number, weights: number[]) => {
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (u * total < acc) return i;
  }
  return weights.length - 1;
};

function generatePool(spec: DealSpec): Obligor[] {
  const rng = mulberry32(spec.seed);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const indWeights = INDUSTRIES.map((i) => i.weight * Math.exp(0.22 * gauss()));
  const used = new Set<string>();

  // Pass 1: identity, size and terms that do not depend on the rating.
  type Draft = Omit<Obligor, "rating" | "defaulted" | "spread" | "price" | "recovery"> & { u: number };
  const drafts: Draft[] = [];
  for (let i = 0; i < spec.n; i++) {
    const ind = INDUSTRIES[pickWeighted(rng(), indWeights)];
    let stem = STEMS[Math.floor(rng() * STEMS.length)];
    let word = ind.words[Math.floor(rng() * ind.words.length)];
    while (used.has(`${stem}|${word}`)) {
      stem = STEMS[Math.floor(rng() * STEMS.length)];
      word = ind.words[Math.floor(rng() * ind.words.length)];
    }
    used.add(`${stem}|${word}`);
    const form = FORMS[Math.floor(rng() * FORMS.length)];
    const lien: 1 | 2 = rng() < 0.035 ? 2 : 1;
    const fixed = rng() < 0.03;
    const purchasePrice = rng() < 0.03 ? 72 + rng() * 7 : Math.min(100.5, 99 + 0.8 * gauss());
    const [m0, m1] = spec.matRange;
    // lognormal position sizes, clamped: a few names run to ~3× the average
    const weight = Math.min(3, Math.max(0.35, Math.exp(0.45 * gauss()))) * (lien === 2 ? 0.6 : 1);
    drafts.push({
      id: `${spec.id}-${i + 1}`,
      name: `${stem} ${word} ${form}`,
      industry: ind.id,
      fixed,
      lien,
      par: weight,
      purchasePrice: Math.round(purchasePrice * 100) / 100,
      maturity: Math.round((m0 + rng() * (m1 - m0)) * 100) / 100,
      u: rng(),
    });
  }

  // Pass 2: fill the defaulted and CCC buckets to their par-share targets in
  // a seeded order, trimming the last position so the share is exact.
  const order = [...drafts].sort((a, b) => a.u - b.u);
  const total = () => drafts.reduce((s, o) => s + o.par, 0);
  const fill = (share: number, skip: Set<string>): Set<string> => {
    const picked = new Set<string>();
    if (share <= 0) return picked;
    const target = share / 100;
    let cum = 0;
    for (const o of order) {
      if (skip.has(o.id) || o.fixed) continue;
      const T = total();
      if (cum + o.par >= target * T) {
        const w = (target * (T - o.par) - cum) / (1 - target);
        if (w >= 0.15) {
          o.par = w;
          picked.add(o.id);
        }
        break;
      }
      cum += o.par;
      picked.add(o.id);
    }
    return picked;
  };
  const defaulted = fill(spec.defaultShare, new Set());
  const caa = fill(spec.cccShare, defaulted);

  const [ba, b1, b2, b3] = spec.mix;
  const ratingWeights = [ba * 0.4, ba * 0.6, b1, b2, b3];
  const out: Obligor[] = drafts.map((o) => {
    const isDef = defaulted.has(o.id);
    const rating: Rating = isDef
      ? (["B3", "Caa1", "Caa2", "Caa3"] as Rating[])[Math.floor(rng() * 4)]
      : caa.has(o.id)
        ? (["Caa1", "Caa1", "Caa1", "Caa2", "Caa2", "Caa3"] as Rating[])[Math.floor(rng() * 6)]
        : RATINGS[pickWeighted(rng(), ratingWeights)];
    const spread = o.fixed
      ? Math.round((550 + rng() * 225) / 5) * 5
      : Math.max(200, Math.round((SPREAD_MEAN[rating] + spec.spreadShift + 30 * gauss() + (o.lien === 2 ? 250 : 0)) / 5) * 5);
    const [pm, ps] = PRICE_MEAN[rating];
    const price = isDef
      ? Math.min(60, Math.max(12, 34 + 12 * gauss()))
      : Math.min(101, Math.max(30, pm + ps * gauss() - (o.lien === 2 ? 1.5 : 0)));
    const recovery =
      o.lien === 2 ? 27 + 4 * gauss() : 50 + 5 * gauss() - (rating.startsWith("Caa") ? 3 : 0);
    return {
      id: o.id,
      name: o.name,
      industry: o.industry,
      rating,
      defaulted: isDef,
      spread,
      fixed: o.fixed,
      lien: o.lien,
      par: o.par,
      price: Math.round(price * 100) / 100,
      purchasePrice: o.purchasePrice,
      maturity: o.maturity,
      recovery: Math.round(Math.min(65, Math.max(15, recovery)) * 10) / 10,
    };
  });

  // Pass 3: scale par so the Class E OC ratio lands on the calibration target.
  const unit = out.reduce((s, o) => s + o.par, 0);
  for (const o of out) o.par /= unit;
  const h = haircuts(out).total; // fraction of unit par
  const debtAtoE = spec.tranches.filter((t) => "ABCDE".includes(t.cls)).reduce((s, t) => s + t.bal, 0);
  const scale = ((spec.targetOcE / 100) * debtAtoE) / (1 - h);
  for (const o of out) o.par = Math.round(o.par * scale * 1000) / 1000;
  return out;
}

/* ------------------------------------------------------------------ *
 * Haircuts and the adjusted collateral balance
 * ------------------------------------------------------------------ */

export interface Haircuts {
  /** Par of the CCC bucket over the 7.5% limit, taken at the lowest-priced assets. */
  cccExcessPar: number;
  ccc: number;
  defaulted: number;
  discount: number;
  total: number;
}

export function haircuts(pool: Obligor[]): Haircuts {
  const par = pool.reduce((s, o) => s + o.par, 0);
  const cccAssets = pool.filter((o) => !o.defaulted && o.rating.startsWith("Caa")).sort((a, b) => a.price - b.price);
  const cccPar = cccAssets.reduce((s, o) => s + o.par, 0);
  let excess = Math.max(0, cccPar - (CCC_LIMIT / 100) * par);
  const cccExcessPar = excess;
  let ccc = 0;
  for (const o of cccAssets) {
    if (excess <= 0) break;
    const take = Math.min(excess, o.par);
    ccc += take * (1 - o.price / 100);
    excess -= take;
  }
  let defaulted = 0;
  let discount = 0;
  for (const o of pool) {
    if (o.defaulted) defaulted += o.par * (1 - Math.min(o.price, o.recovery) / 100);
    else if (o.purchasePrice < 80) discount += o.par * (1 - o.purchasePrice / 100);
  }
  return { cccExcessPar, ccc, defaulted, discount, total: ccc + defaulted + discount };
}

/* ------------------------------------------------------------------ *
 * Diversity score (Moody's industry method)
 * ------------------------------------------------------------------ */

const IDS_TABLE = [0, 1, 1.5, 2, 2.33, 2.67, 3, 3.25, 3.5, 3.75, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.1, 5.2, 5.3, 5.4, 5.5];

function industryDiversity(aieus: number): number {
  if (aieus <= 0) return 0;
  if (aieus >= 20) return 5.5 + 0.1 * (aieus - 20);
  const lo = Math.floor(aieus);
  const frac = aieus - lo;
  return IDS_TABLE[lo] + frac * (IDS_TABLE[lo + 1] - IDS_TABLE[lo]);
}

function diversityScore(pool: Obligor[]): number {
  const performing = pool.filter((o) => !o.defaulted);
  const avg = performing.reduce((s, o) => s + o.par, 0) / performing.length;
  const byInd = new Map<string, number>();
  for (const o of performing) byInd.set(o.industry, (byInd.get(o.industry) ?? 0) + Math.min(1, o.par / avg));
  let ds = 0;
  for (const v of byInd.values()) ds += industryDiversity(v);
  return ds;
}

/* ------------------------------------------------------------------ *
 * View types
 * ------------------------------------------------------------------ */

export interface TrancheView extends TrancheSpec {
  /** Current ÷ original balance. */
  factor: number;
  /** Interest due this period at the chosen Euribor, €m. */
  interest: number;
  /** OC ratio at this class (adjusted par ÷ balance at and above), %. */
  oc: number | null;
  ocTrigger: number | null;
  ocPass: boolean | null;
  /** Cumulative balance of this class and everything senior to it, €m. */
  cumBal: number;
  color: string;
}

export interface CoverageTest {
  id: CoverageId;
  label: string;
  kind: "OC" | "IC";
  actual: number;
  trigger: number;
  cushionBps: number;
  pass: boolean;
  thin: boolean;
  /** Prior period's ratio, when the deal was outstanding. */
  prior: number | null;
  numerator: number;
  denominator: number;
  /** 12-period history of the ratio (null before the first payment date). */
  history: (number | null)[];
}

export type FocusKind =
  | "ccc"
  | "defaulted"
  | "secondLien"
  | "fixed"
  | "obligor"
  | "industry"
  | "topIndustries"
  | "longDated"
  | "lowRecovery"
  | "highSpread"
  | "b3AndBelow";

export interface CompositionFocus {
  kind: FocusKind;
  /** Obligor or industry id for the single-entity kinds. */
  id?: string;
  label: string;
}

export interface QualityTest {
  id: QualityId;
  label: string;
  actual: number;
  covenant: number;
  sense: "max" | "min";
  unit: "pct" | "num" | "years" | "score";
  /** Signed room against the covenant in the test's units: positive passes. */
  cushion: number;
  pass: boolean;
  /** 8-period history, last = actual. */
  history: number[];
  detail?: string;
  focus: CompositionFocus;
}

export interface IndustrySlice {
  id: string;
  name: string;
  short: string;
  par: number;
  share: number;
  count: number;
  was: number;
  warf: number;
  cccShare: number;
  defaultedShare: number;
  obligors: Obligor[];
}

export interface Period {
  idx: number;
  payDate: number;
  detDate: number;
  label: string;
  projected: boolean;
  oc: Record<OcId, number>;
  ic: Record<IcId, number>;
  ccc: number;
  defaulted: number;
  /** Estimated CCC excess haircut that period, €m (0 when under the limit). */
  cccHaircut: number;
  /** Distribution to the subordinated notes, €m, and as quarterly cash-on-cash %. */
  equity: number;
  coc: number;
  diverted: boolean;
}

export interface WaterfallStep {
  id: string;
  label: string;
  /** Signed amount, €m: the start is positive, payments negative, the residual is the sum. */
  amount: number;
  kind: "start" | "step" | "sum";
  /** Remaining proceeds after this step. */
  remaining: number;
  note: string;
  color: string;
  /** True where a payment could not be met and is deferred. */
  deferred?: boolean;
}

export interface Waterfall {
  scenario: WaterfallScenario;
  steps: WaterfallStep[];
  proceeds: number;
  equity: number;
  coc: number;
  diversion: number;
  cure: number;
  /** Class E OC after the diversion is applied, %. */
  ocEAfter: number;
  note: string;
}

export interface DealView {
  deal: DealSpec;
  rate: RateScenario;
  euribor: number;
  pool: Obligor[];
  par: number;
  performingPar: number;
  adjustedPar: number;
  haircuts: Haircuts;
  tranches: TrancheView[];
  notesOutstanding: number;
  coverage: CoverageTest[];
  tightest: CoverageTest;
  quality: QualityTest[];
  industries: IndustrySlice[];
  periods: (Period | null)[];
  waterfalls: Record<WaterfallScenario, Waterfall>;
  status: DealStatus;
  statusDetail: string;
  /** Last actual quarterly distribution to the equity, cash-on-cash %. */
  lastCoc: number | null;
  reinvestDaysLeft: number;
  daysToPayment: number;
  proceeds: number;
  interestDue: number;
}

/* ------------------------------------------------------------------ *
 * Colours that belong to the model: the tranche ramp is ordinal
 * (seniority), so it is a single indigo hue from dark to light, with the
 * subordinated notes in neutral because they are not debt.
 * ------------------------------------------------------------------ */

export const TRANCHE_COLOR: Record<TrancheClass, string> = {
  A: "#312e81",
  B: "#3730a3",
  C: "#4338ca",
  D: "#4f46e5",
  E: "#6366f1",
  F: "#818cf8",
  Sub: "#a3a3a3",
};

const FEE_COLOR = "#a3a3a3";
const DIVERSION_COLOR = "#d97706";
const EQUITY_COLOR = "#171717";

/* ------------------------------------------------------------------ *
 * Periods
 * ------------------------------------------------------------------ */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The 12 quarterly payment dates ending with the projected 15 Oct 2026. */
export const PAY_DATES: number[] = (() => {
  const out: number[] = [];
  let y = 2026;
  let m = 9; // October (0-based)
  for (let i = 0; i < 12; i++) {
    out.unshift(Date.UTC(y, m, 15));
    m -= 3;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
  }
  return out;
})();

const periodLabel = (t: number) => {
  const dt = new Date(t);
  return `${MON[dt.getUTCMonth()]} ${String(dt.getUTCFullYear()).slice(2)}`;
};

/* ------------------------------------------------------------------ *
 * Interest and the waterfall
 * ------------------------------------------------------------------ */

function interestProceeds(pool: Obligor[], euribor: number): number {
  let s = 0;
  for (const o of pool) {
    if (o.defaulted) continue;
    const rate = o.fixed ? o.spread / 100 : Math.max(0, euribor) + o.spread / 100;
    s += (o.par * rate * YEAR_FRAC) / 100;
  }
  return s;
}

const trancheInterest = (t: TrancheSpec, euribor: number) =>
  t.cls === "Sub" ? 0 : (t.bal * (Math.max(0, euribor) + t.spread / 100) * YEAR_FRAC) / 100;

function buildWaterfall(
  spec: DealSpec,
  tranches: TrancheView[],
  par: number,
  adjustedPar: number,
  proceeds: number,
  scenario: WaterfallScenario,
  ocEFailsNow: boolean,
): Waterfall {
  const subOrig = tranches.find((t) => t.cls === "Sub")!.orig;
  const debtAtoE = tranches.filter((t) => "ABCDE".includes(t.cls)).reduce((s, t) => s + t.bal, 0);
  const trigger = spec.triggers.oc.ocE / 100;
  const stressed = scenario === "stress";
  // A hypothetical failure assumes the ratio 100 bps under the trigger; the
  // current projection uses the reported ratio.
  const adjForCure = stressed && !ocEFailsNow ? (trigger - 0.01) * debtAtoE : adjustedPar;
  const failing = ocEFailsNow || stressed;
  const cure = failing ? Math.max(0, debtAtoE - adjForCure / trigger) : 0;

  const steps: WaterfallStep[] = [];
  let remaining = proceeds;
  const push = (id: string, label: string, due: number, note: string, color: string) => {
    const paid = Math.min(remaining, Math.max(0, due));
    remaining -= paid;
    steps.push({
      id,
      label,
      amount: -paid,
      kind: "step",
      remaining,
      note,
      color,
      deferred: paid < due - 1e-9,
    });
  };

  steps.push({
    id: "proceeds",
    label: "Interest proceeds",
    amount: proceeds,
    kind: "start",
    remaining,
    note: "Scheduled interest on performing assets, 15 Jul to 15 Oct 2026",
    color: TRANCHE_COLOR.A,
  });
  push("admin", "Trustee & admin", 0.04 + par * 0.0001, "Trustee fee, agents and administrative expenses (capped)", FEE_COLOR);
  push("seniorFee", "Senior mgmt fee", (par * 0.0015 * YEAR_FRAC), "0.15% p.a. on collateral par", FEE_COLOR);
  for (const t of tranches) {
    if (t.cls === "Sub" || t.cls === "F") continue;
    push(
      `int${t.cls}`,
      `Class ${t.cls} interest`,
      t.interest,
      `€${t.bal.toFixed(1)}m at E+${t.spread} bps`,
      t.color,
    );
  }
  let diversion = 0;
  if (failing) {
    diversion = Math.min(remaining, cure);
    remaining -= diversion;
    steps.push({
      id: "diversion",
      label: "Diverted to Class A principal",
      amount: -diversion,
      kind: "step",
      remaining,
      note: `Class E OC test ${ocEFailsNow ? "is failing" : "assumed to fail"}: proceeds redeem Class A until cured (cure €${cure.toFixed(1)}m)`,
      color: DIVERSION_COLOR,
    });
  }
  const f = tranches.find((t) => t.cls === "F")!;
  push("intF", "Class F interest", f.interest, `€${f.bal.toFixed(1)}m at E+${f.spread} bps · deferrable`, f.color);
  push("subFee", "Sub mgmt fee", par * 0.0035 * YEAR_FRAC, "0.35% p.a. on collateral par, deferrable", FEE_COLOR);
  const incentive = spec.incentiveMet ? remaining * 0.2 : 0;
  push(
    "incentive",
    "Incentive fee",
    incentive,
    spec.incentiveMet ? "20% of residual once the 12% equity IRR hurdle is met" : "Not payable: 12% equity IRR hurdle not yet met",
    FEE_COLOR,
  );
  const equity = remaining;
  steps.push({
    id: "equity",
    label: "Residual to equity",
    amount: equity,
    kind: "sum",
    remaining: 0,
    note: `Subordinated notes €${subOrig.toFixed(1)}m original balance`,
    color: EQUITY_COLOR,
  });
  const ocEAfter = (adjustedPar / (debtAtoE - diversion)) * 100;
  const note = !failing
    ? "All coverage tests pass at this determination date: no interest is diverted."
    : ocEFailsNow
      ? `Class E OC is failing. €${diversion.toFixed(2)}m of proceeds redeem Class A, against a cure amount of €${cure.toFixed(1)}m; junior payments are deferred.`
      : `Hypothetical: Class E OC assumed 100 bps under the trigger. Cure amount €${cure.toFixed(1)}m exceeds one period's excess interest, so €${diversion.toFixed(2)}m is diverted and the equity receives nothing.`;
  return {
    scenario,
    steps,
    proceeds,
    equity,
    coc: (equity / subOrig) * 100,
    diversion,
    cure,
    ocEAfter,
    note,
  };
}

/* ------------------------------------------------------------------ *
 * The deal view
 * ------------------------------------------------------------------ */

const POOLS = Object.fromEntries(DEALS.map((s) => [s.id, generatePool(s)])) as Record<DealId, Obligor[]>;

export function dealView(id: DealId, rate: RateScenario): DealView {
  const spec = DEAL_BY_ID[id];
  const pool = POOLS[id];
  const euribor = RATES[rate].euribor;

  const par = pool.reduce((s, o) => s + o.par, 0);
  const performing = pool.filter((o) => !o.defaulted);
  const performingPar = performing.reduce((s, o) => s + o.par, 0);
  const hc = haircuts(pool);
  const adjustedPar = par - hc.total;

  // --- stack and OC/IC ---------------------------------------------------
  let cum = 0;
  const ocFor: Partial<Record<TrancheClass, OcId>> = { B: "ocAB", C: "ocC", D: "ocD", E: "ocE" };
  const tranches: TrancheView[] = spec.tranches.map((t) => {
    cum += t.bal;
    const ocId = ocFor[t.cls];
    const oc = t.cls === "Sub" ? null : (adjustedPar / cum) * 100;
    return {
      ...t,
      factor: t.bal / t.orig,
      interest: trancheInterest(t, euribor),
      oc,
      ocTrigger: ocId ? spec.triggers.oc[ocId] : null,
      ocPass: ocId && oc !== null ? oc >= spec.triggers.oc[ocId] : null,
      cumBal: cum,
      color: TRANCHE_COLOR[t.cls],
    };
  });
  const notesOutstanding = cum;
  const balThrough = (cls: TrancheClass) => tranches.find((t) => t.cls === cls)!.cumBal;
  const proceeds = interestProceeds(pool, euribor);
  const seniorFees = 0.04 + par * 0.0001 + par * 0.0015 * YEAR_FRAC;
  const interestThrough = (cls: TrancheClass) =>
    seniorFees + tranches.filter((t) => t.cumBal <= balThrough(cls)).reduce((s, t) => s + t.interest, 0);

  const ocDefs: { id: OcId; label: string; cls: TrancheClass }[] = [
    { id: "ocAB", label: "Class A/B OC", cls: "B" },
    { id: "ocC", label: "Class C OC", cls: "C" },
    { id: "ocD", label: "Class D OC", cls: "D" },
    { id: "ocE", label: "Class E OC", cls: "E" },
  ];
  const icDefs: { id: IcId; label: string; cls: TrancheClass }[] = [
    { id: "icAB", label: "Class A/B IC", cls: "B" },
    { id: "icC", label: "Class C IC", cls: "C" },
    { id: "icD", label: "Class D IC", cls: "D" },
  ];

  // --- periods (history) -------------------------------------------------
  const ocNow = Object.fromEntries(ocDefs.map((o) => [o.id, (adjustedPar / balThrough(o.cls)) * 100])) as Record<OcId, number>;
  const icNow = Object.fromEntries(icDefs.map((o) => [o.id, (proceeds / interestThrough(o.cls)) * 100])) as Record<IcId, number>;
  const cccParNow = performing.filter((o) => o.rating.startsWith("Caa")).reduce((s, o) => s + o.par, 0);
  const cccShareNow = (cccParNow / par) * 100;
  const defShareNow = ((par - performingPar) / par) * 100;
  const cccAvgPrice =
    cccParNow > 0
      ? performing.filter((o) => o.rating.startsWith("Caa")).reduce((s, o) => s + o.par * o.price, 0) / cccParNow
      : 80;
  const subOrig = spec.tranches.find((t) => t.cls === "Sub")!.orig;
  const ocEFailsNow = ocNow.ocE < spec.triggers.oc.ocE;

  const waterfalls: Record<WaterfallScenario, Waterfall> = {
    current: buildWaterfall(spec, tranches, par, adjustedPar, proceeds, "current", ocEFailsNow),
    stress: buildWaterfall(spec, tranches, par, adjustedPar, proceeds, "stress", ocEFailsNow),
  };

  const periods: (Period | null)[] = PAY_DATES.map((payDate, idx) => {
    if (payDate < spec.firstPayment) return null;
    const detDate = payDate - 24 * DAY_MS;
    const label = periodLabel(payDate);
    if (idx === 11) {
      const w = waterfalls.current;
      return {
        idx,
        payDate,
        detDate: AS_OF,
        label,
        projected: true,
        oc: ocNow,
        ic: icNow,
        ccc: cccShareNow,
        defaulted: defShareNow,
        cccHaircut: hc.ccc,
        equity: w.equity,
        coc: w.coc,
        diverted: w.diversion > 0,
      };
    }
    const off = spec.ocPath[idx];
    const scale = (ocNow.ocE + off) / ocNow.ocE;
    const oc = Object.fromEntries(ocDefs.map((o) => [o.id, ocNow[o.id] * scale])) as Record<OcId, number>;
    // IC ratios ran higher while Euribor was higher in 2024; seeded wobble on top
    const icDrift = 1 + 0.018 * (11 - idx) + 0.03 * (hash01(`ic|${id}|${idx}`) - 0.5);
    const ic = Object.fromEntries(icDefs.map((o) => [o.id, icNow[o.id] * icDrift])) as Record<IcId, number>;
    const ccc = spec.cccPath[idx];
    const defaulted = spec.defPath[idx];
    const cccHaircut = ccc > CCC_LIMIT ? ((ccc - CCC_LIMIT) / 100) * par * (1 - cccAvgPrice / 100) : 0;
    const diverted = oc.ocE < spec.triggers.oc.ocE;
    const coc = diverted ? 0 : Math.max(0, spec.cocBase + 0.9 * (hash01(`coc|${id}|${idx}`) - 0.5) - 0.06 * (ccc - spec.cccPath[0]));
    return {
      idx,
      payDate,
      detDate,
      label,
      projected: false,
      oc,
      ic,
      ccc,
      defaulted,
      cccHaircut,
      equity: (coc / 100) * subOrig,
      coc,
      diverted,
    };
  });
  const prior = periods[10];

  const coverage: CoverageTest[] = [
    ...ocDefs.map((o) => {
      const actual = ocNow[o.id];
      const trigger = spec.triggers.oc[o.id];
      const cushionBps = Math.round((actual - trigger) * 100);
      return {
        id: o.id,
        label: o.label,
        kind: "OC" as const,
        actual,
        trigger,
        cushionBps,
        pass: cushionBps >= 0,
        thin: cushionBps >= 0 && cushionBps < THIN_BPS,
        prior: prior ? prior.oc[o.id] : null,
        numerator: adjustedPar,
        denominator: balThrough(o.cls),
        history: periods.map((p) => (p ? p.oc[o.id] : null)),
      };
    }),
    ...icDefs.map((o) => {
      const actual = icNow[o.id];
      const trigger = spec.triggers.ic[o.id];
      const cushionBps = Math.round((actual - trigger) * 100);
      return {
        id: o.id,
        label: o.label,
        kind: "IC" as const,
        actual,
        trigger,
        cushionBps,
        pass: cushionBps >= 0,
        thin: cushionBps >= 0 && cushionBps < THIN_BPS,
        prior: prior ? prior.ic[o.id] : null,
        numerator: proceeds,
        denominator: interestThrough(o.cls),
        history: periods.map((p) => (p ? p.ic[o.id] : null)),
      };
    }),
  ];
  const tightest = coverage.reduce((a, b) => (b.cushionBps < a.cushionBps ? b : a));

  // --- collateral quality ------------------------------------------------
  const floating = performing.filter((o) => !o.fixed);
  const floatingPar = floating.reduce((s, o) => s + o.par, 0);
  const was = floating.reduce((s, o) => s + o.par * o.spread, 0) / floatingPar / 100;
  const warf = performing.reduce((s, o) => s + o.par * RATING_FACTOR[o.rating], 0) / performingPar;
  const wal = performing.reduce((s, o) => s + o.par * o.maturity, 0) / performingPar;
  const warr = performing.reduce((s, o) => s + o.par * o.recovery, 0) / performingPar;
  const diversity = diversityScore(pool);
  const secondLien = (pool.filter((o) => o.lien === 2).reduce((s, o) => s + o.par, 0) / par) * 100;
  const fixedShare = (pool.filter((o) => o.fixed).reduce((s, o) => s + o.par, 0) / par) * 100;
  const largest = [...pool].sort((a, b) => b.par - a.par)[0];

  const byInd = new Map<string, Obligor[]>();
  for (const o of pool) byInd.set(o.industry, [...(byInd.get(o.industry) ?? []), o]);
  const industries: IndustrySlice[] = [...byInd.entries()]
    .map(([iid, obligors]) => {
      const ind = INDUSTRY_BY_ID[iid];
      const ipar = obligors.reduce((s, o) => s + o.par, 0);
      const perf = obligors.filter((o) => !o.defaulted);
      const perfPar = perf.reduce((s, o) => s + o.par, 0);
      return {
        id: iid,
        name: ind.name,
        short: ind.short,
        par: ipar,
        share: (ipar / par) * 100,
        count: obligors.length,
        was: perfPar ? perf.reduce((s, o) => s + o.par * o.spread, 0) / perfPar / 100 : 0,
        warf: perfPar ? perf.reduce((s, o) => s + o.par * RATING_FACTOR[o.rating], 0) / perfPar : 0,
        cccShare: (perf.filter((o) => o.rating.startsWith("Caa")).reduce((s, o) => s + o.par, 0) / ipar) * 100,
        defaultedShare: (obligors.filter((o) => o.defaulted).reduce((s, o) => s + o.par, 0) / ipar) * 100,
        obligors: [...obligors].sort((a, b) => b.par - a.par),
      };
    })
    .sort((a, b) => b.par - a.par);
  const topInd = industries[0];

  const cov = spec.covenants;
  // Eight-period histories: CCC and defaults follow their paths; the others
  // drift with the CCC bucket (WARF, WAS) or wobble around the current value.
  const cccHist = [...spec.cccPath.slice(4), cccShareNow];
  const defHist = [...spec.defPath.slice(4), defShareNow];
  const wobble = (key: string, base: number, amp: number, drift = 0) =>
    Array.from({ length: 8 }, (_, i) =>
      i === 7 ? base : base + drift * (7 - i) + amp * (hash01(`${key}|${id}|${i}`) - 0.5),
    );
  const qTest = (
    qid: QualityId,
    label: string,
    actual: number,
    covenant: number,
    sense: "max" | "min",
    unit: QualityTest["unit"],
    history: number[],
    focus: CompositionFocus,
    detail?: string,
  ): QualityTest => {
    const cushion = sense === "max" ? covenant - actual : actual - covenant;
    return { id: qid, label, actual, covenant, sense, unit, cushion, pass: cushion >= 0, history, focus, detail };
  };
  const quality: QualityTest[] = [
    qTest("warf", "Weighted average rating factor", warf, cov.warf, "max", "num",
      cccHist.map((c, i) => (i === 7 ? warf : warf + (c - cccShareNow) * 85 + 30 * (hash01(`warf|${id}|${i}`) - 0.5))),
      { kind: "b3AndBelow", label: "B3 and below" }),
    qTest("was", "Weighted average spread", was, cov.was, "min", "pct",
      wobble("was", was, 0.06, 0.012),
      { kind: "highSpread", label: "Spread ≥ 450 bps" }),
    qTest("wal", "Weighted average life", wal, cov.wal, "max", "years",
      wobble("wal", wal, 0.05, spec.reinvestEnd < AS_OF ? 0.22 : 0.06),
      { kind: "longDated", label: `Maturing after ${new Date(AS_OF).getUTCFullYear() + 5}` }),
    qTest("diversity", "Diversity score", diversity, cov.diversity, "min", "score",
      wobble("div", diversity, 1.4, spec.reinvestEnd < AS_OF ? 0.9 : -0.1),
      { kind: "topIndustries", label: "Three largest industries" }),
    qTest("warr", "Weighted average recovery rate", warr, cov.warr, "min", "pct",
      wobble("warr", warr, 0.3, 0.05),
      { kind: "lowRecovery", label: "Recovery below 40%" }),
    qTest("ccc", "CCC and below", cccShareNow, CCC_LIMIT, "max", "pct", cccHist,
      { kind: "ccc", label: "Caa-rated assets" }),
    qTest("defaulted", "Defaulted obligations", defShareNow, cov.defaulted, "max", "pct", defHist,
      { kind: "defaulted", label: "Defaulted assets" }),
    qTest("secondLien", "Second lien", secondLien, cov.secondLien, "max", "pct",
      wobble("lien", secondLien, 0.3),
      { kind: "secondLien", label: "Second-lien loans" }),
    qTest("fixed", "Fixed rate", fixedShare, cov.fixed, "max", "pct",
      wobble("fixed", fixedShare, 0.3),
      { kind: "fixed", label: "Fixed-rate assets" }),
    qTest("obligor", "Largest single obligor", (largest.par / par) * 100, cov.obligor, "max", "pct",
      wobble("oblig", (largest.par / par) * 100, 0.12),
      { kind: "obligor", id: largest.id, label: largest.name }, largest.name),
    qTest("industry", "Largest industry", topInd.share, cov.industry, "max", "pct",
      wobble("ind", topInd.share, 0.5),
      { kind: "industry", id: topInd.id, label: topInd.name }, topInd.name),
  ];

  // --- status ------------------------------------------------------------
  const failingCov = coverage.filter((t) => !t.pass);
  const failingQ = quality.filter((t) => !t.pass);
  let status: DealStatus = "pass";
  let statusDetail = `All tests pass · tightest ${tightest.label} +${tightest.cushionBps} bps`;
  if (failingCov.length) {
    status = "fail";
    statusDetail = `${failingCov.map((t) => t.label).join(", ")} failing (${tightest.cushionBps} bps)`;
  } else if (failingQ.length) {
    status = "fail";
    statusDetail = `${failingQ.map((t) => t.label).join(", ")} failing`;
  } else if (tightest.thin) {
    status = "thin";
    statusDetail = `${tightest.label} only +${tightest.cushionBps} bps over trigger`;
  }

  const lastActual = [...periods].reverse().find((p) => p && !p.projected) ?? null;

  return {
    deal: spec,
    rate,
    euribor,
    pool,
    par,
    performingPar,
    adjustedPar,
    haircuts: hc,
    tranches,
    notesOutstanding,
    coverage,
    tightest,
    quality,
    industries,
    periods,
    waterfalls,
    status,
    statusDetail,
    lastCoc: lastActual ? lastActual.coc : null,
    reinvestDaysLeft: Math.round((spec.reinvestEnd - AS_OF) / DAY_MS),
    daysToPayment: Math.round((NEXT_PAYMENT - AS_OF) / DAY_MS),
    proceeds,
    interestDue: tranches.reduce((s, t) => s + t.interest, 0),
  };
}

/** One view per deal on the fixing, for the rail and cross-deal summaries. */
export const RAIL_VIEWS: Record<DealId, DealView> = Object.fromEntries(
  DEALS.map((s) => [s.id, dealView(s.id, "fixing")]),
) as Record<DealId, DealView>;

/* ------------------------------------------------------------------ *
 * Composition focus predicate (quality-table row → treemap highlight)
 * ------------------------------------------------------------------ */

export function matchesFocus(o: Obligor, f: CompositionFocus, view: DealView): boolean {
  switch (f.kind) {
    case "ccc":
      return !o.defaulted && o.rating.startsWith("Caa");
    case "defaulted":
      return o.defaulted;
    case "secondLien":
      return o.lien === 2;
    case "fixed":
      return o.fixed;
    case "obligor":
      return o.id === f.id;
    case "industry":
      return o.industry === f.id;
    case "topIndustries":
      return view.industries.slice(0, 3).some((i) => i.id === o.industry);
    case "longDated":
      return o.maturity > 5;
    case "lowRecovery":
      return o.recovery < 40;
    case "highSpread":
      return !o.fixed && o.spread >= 450;
    case "b3AndBelow":
      return o.defaulted || o.rating === "B3" || o.rating.startsWith("Caa");
  }
}

