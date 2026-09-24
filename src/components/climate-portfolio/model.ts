/* Climate & Transition — the data model.
 *
 * Sixty fictional issuers, three funds and three benchmarks, all generated
 * from a seeded PRNG so the page is stable across reloads. Nothing headline is
 * hard-coded: financed emissions, WACI, implied temperature rise, SBTi
 * coverage, the decarbonisation pathway and the sector attribution are all
 * computed from the issuer rows and the holdings of whichever slice the
 * filters select.
 *
 * Methodology (simplified, but the shape a stewardship team would recognise):
 *  - Financed emissions follow PCAF Part A for listed equity and corporate
 *    bonds: attribution factor = holding value ÷ EVIC, times the issuer's
 *    emissions for the chosen scope.
 *  - WACI (TCFD) = Σ portfolio weight × emissions ÷ revenue, in tCO₂e / $m.
 *  - Implied temperature rise is the weight-averaged issuer temperature
 *    score (target-based; issuers without targets carry a ~3.2°C default).
 *  - The pathway indexes the carbon footprint (financed emissions ÷ £m
 *    invested) to the 2019 baseline, so AUM growth doesn't flatter it; the
 *    EVIC effect (market cap inflation lowering attribution) is modelled.
 *
 * Plain TypeScript with erasable syntax only, so it can also be run directly
 * under Node for calibration. */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type PortfolioId = "gef" | "scf" | "mab";
export type BenchmarkId = "acwi" | "pab" | "iboxx";
export type Scope = "s12" | "s123";
export type AssetClass = "equity" | "bond";
export type AssetClassFilter = "all" | AssetClass;
export type Sbti = "Validated" | "Committed" | "None";
export type Engagement =
  | "Engaging"
  | "Escalated"
  | "Voted against"
  | "Divestment review";

export type SectorId =
  | "UTL"
  | "ENE"
  | "MAT"
  | "IND"
  | "CD"
  | "CS"
  | "HC"
  | "FIN"
  | "IT"
  | "COM"
  | "RE";

export const SECTORS: { id: SectorId; label: string; short: string }[] = [
  { id: "UTL", label: "Utilities", short: "Utilities" },
  { id: "ENE", label: "Energy", short: "Energy" },
  { id: "MAT", label: "Materials", short: "Materials" },
  { id: "IND", label: "Industrials", short: "Industrials" },
  { id: "CD", label: "Consumer Discretionary", short: "Cons. Disc." },
  { id: "CS", label: "Consumer Staples", short: "Cons. Staples" },
  { id: "HC", label: "Health Care", short: "Health Care" },
  { id: "FIN", label: "Financials", short: "Financials" },
  { id: "IT", label: "Information Technology", short: "Info. Tech." },
  { id: "COM", label: "Communication Services", short: "Comm. Services" },
  { id: "RE", label: "Real Estate", short: "Real Estate" },
];
export const SECTOR_LABEL = Object.fromEntries(
  SECTORS.map((s) => [s.id, s.label]),
) as Record<SectorId, string>;
export const SECTOR_SHORT = Object.fromEntries(
  SECTORS.map((s) => [s.id, s.short]),
) as Record<SectorId, string>;

export interface Issuer {
  id: string;
  name: string;
  sector: SectorId;
  industry: string;
  /** Business-model archetype key (drives intensity ranges and index weight). */
  arche: string;
  country: string;
  /** Revenue, $m (WACI is quoted per $m revenue, the TCFD convention). */
  revenue: number;
  /** Enterprise value including cash, £m. */
  evic: number;
  /** Latest reported emissions, tCO₂e. */
  s1: number;
  s2: number;
  s3: number;
  tempS12: number;
  tempS123: number;
  sbti: Sbti;
  engagement: Engagement | null;
  milestone: { date: string; text: string } | null;
  controversy: string | null;
  /** PCAF data-quality score, 1 (verified) … 5 (sector estimate). */
  pcaf: number;
  /** Realised annual change in absolute emissions, 2019→2026. */
  histRate: number;
  /** Planned annual change 2026→2030 (from targets, or trend if none). */
  fwdRate: number;
  /** Issuer-specific EVIC drift on top of the market factor. */
  evicDrift: number;
}

/* ------------------------------------------------------------------ *
 * PRNG
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

type Rng = () => number;
const between = (r: Rng, [lo, hi]: [number, number]) => lo + (hi - lo) * r();
const gauss = (r: Rng) => {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/* ------------------------------------------------------------------ *
 * Archetypes — intensity per $m revenue by business model
 * ------------------------------------------------------------------ */

interface Archetype {
  industry: string;
  s1: [number, number];
  s2: [number, number];
  /** Scope 3 as a multiple of scope 1+2. */
  s3x: [number, number];
  /** EVIC ÷ revenue. */
  evicRev: [number, number];
  /** Revenue range, $bn. */
  rev: [number, number];
  /** Extra °C on the scope 1+2+3 temperature score. */
  s3Temp: number;
  /** Share of its sector's index weight a name of this type typically has
   * (a 60-name universe stands in for thousands, so heavy emitters must not
   * get a full 1/n of their sector). */
  idx?: number;
}

const ARCHE: Record<string, Archetype> = {
  coal: { industry: "Coal & gas generation", s1: [3200, 4300], s2: [30, 60], s3x: [0.25, 0.4], evicRev: [2.2, 2.8], rev: [9, 16], s3Temp: 0.1, idx: 0.6 },
  gasutil: { industry: "Integrated utility", s1: [1350, 1900], s2: [25, 45], s3x: [0.7, 1.0], evicRev: [2.6, 3.2], rev: [14, 26], s3Temp: 0.15, idx: 1.5 },
  renew: { industry: "Renewable generation", s1: [90, 180], s2: [10, 25], s3x: [0.5, 0.8], evicRev: [4, 5.5], rev: [5, 10], s3Temp: 0.05, idx: 0.8 },
  grid: { industry: "Electricity networks", s1: [50, 90], s2: [110, 180], s3x: [0.8, 1.2], evicRev: [3.2, 4.4], rev: [7, 14], s3Temp: 0.05, idx: 1.3 },
  oil: { industry: "Integrated oil & gas", s1: [310, 430], s2: [20, 35], s3x: [11, 15], evicRev: [0.9, 1.1], rev: [70, 160], s3Temp: 0.35, idx: 1.8 },
  enp: { industry: "Exploration & production", s1: [480, 700], s2: [15, 30], s3x: [9, 13], evicRev: [1.8, 2.6], rev: [9, 22], s3Temp: 0.4, idx: 0.7 },
  refine: { industry: "Refining & marketing", s1: [320, 440], s2: [40, 70], s3x: [14, 18], evicRev: [0.35, 0.5], rev: [35, 80], s3Temp: 0.35, idx: 0.5 },
  mid: { industry: "Midstream pipelines", s1: [480, 720], s2: [30, 60], s3x: [5, 7], evicRev: [2.2, 3.0], rev: [9, 18], s3Temp: 0.3, idx: 0.8 },
  cement: { industry: "Cement & aggregates", s1: [3200, 4200], s2: [160, 240], s3x: [0.3, 0.45], evicRev: [1.3, 1.7], rev: [12, 24], s3Temp: 0.05, idx: 0.7 },
  steel: { industry: "Steel", s1: [1700, 2300], s2: [180, 280], s3x: [0.5, 0.8], evicRev: [0.6, 0.9], rev: [22, 45], s3Temp: 0.1, idx: 0.6 },
  alu: { industry: "Aluminium", s1: [700, 1000], s2: [1300, 1900], s3x: [0.35, 0.5], evicRev: [1.0, 1.3], rev: [9, 16], s3Temp: 0.1, idx: 0.45 },
  chem: { industry: "Chemicals", s1: [380, 560], s2: [130, 210], s3x: [2, 3.5], evicRev: [1.3, 1.7], rev: [20, 45], s3Temp: 0.15, idx: 1.2 },
  mining: { industry: "Diversified mining", s1: [260, 420], s2: [160, 260], s3x: [6, 11], evicRev: [2.0, 2.8], rev: [25, 55], s3Temp: 0.25, idx: 1.6 },
  pack: { industry: "Packaging", s1: [150, 240], s2: [60, 110], s3x: [1.5, 2.5], evicRev: [1.2, 1.6], rev: [8, 14], s3Temp: 0.1, idx: 0.6 },
  airline: { industry: "Airlines", s1: [820, 1050], s2: [5, 10], s3x: [0.2, 0.3], evicRev: [0.8, 1.1], rev: [18, 38], s3Temp: 0.05, idx: 0.35 },
  ship: { industry: "Container shipping", s1: [640, 900], s2: [3, 8], s3x: [0.15, 0.25], evicRev: [1.2, 1.8], rev: [10, 22], s3Temp: 0.05, idx: 0.3 },
  rail: { industry: "Freight rail", s1: [160, 240], s2: [20, 45], s3x: [0.4, 0.6], evicRev: [3.5, 4.8], rev: [11, 22], s3Temp: 0.05, idx: 0.9 },
  logis: { industry: "Logistics", s1: [90, 150], s2: [10, 25], s3x: [1.2, 1.8], evicRev: [1.0, 1.4], rev: [18, 40], s3Temp: 0.1, idx: 0.8 },
  aero: { industry: "Aerospace & defence", s1: [8, 14], s2: [8, 14], s3x: [30, 55], evicRev: [2.0, 2.8], rev: [20, 45], s3Temp: 0.3, idx: 1.6 },
  eng: { industry: "Industrial machinery", s1: [6, 12], s2: [8, 14], s3x: [20, 35], evicRev: [1.8, 2.6], rev: [15, 35], s3Temp: 0.2, idx: 1.6 },
  build: { industry: "Building products", s1: [12, 22], s2: [10, 18], s3x: [10, 18], evicRev: [1.6, 2.4], rev: [8, 16], s3Temp: 0.15, idx: 1.1 },
  auto: { industry: "Automobiles", s1: [8, 14], s2: [10, 18], s3x: [45, 70], evicRev: [0.7, 1.1], rev: [80, 160], s3Temp: 0.3, idx: 1.2 },
  home: { industry: "Homebuilding", s1: [3, 6], s2: [2, 4], s3x: [30, 55], evicRev: [1.0, 1.4], rev: [9, 18], s3Temp: 0.2 },
  retail: { industry: "Apparel retail", s1: [5, 9], s2: [10, 18], s3x: [15, 28], evicRev: [1.0, 1.6], rev: [18, 34], s3Temp: 0.15 },
  leisure: { industry: "Cruise & leisure", s1: [120, 200], s2: [10, 20], s3x: [1.5, 3], evicRev: [2.2, 3.0], rev: [8, 15], s3Temp: 0.1, idx: 0.4 },
  food: { industry: "Packaged foods", s1: [25, 45], s2: [12, 25], s3x: [15, 28], evicRev: [1.6, 2.4], rev: [22, 50], s3Temp: 0.2 },
  dairy: { industry: "Dairy & protein", s1: [60, 110], s2: [15, 30], s3x: [12, 20], evicRev: [0.9, 1.3], rev: [14, 30], s3Temp: 0.25, idx: 0.5 },
  bev: { industry: "Beverages", s1: [12, 24], s2: [8, 15], s3x: [10, 18], evicRev: [3.2, 4.4], rev: [18, 36], s3Temp: 0.1 },
  hh: { industry: "Household products", s1: [8, 15], s2: [6, 12], s3x: [20, 35], evicRev: [3.0, 4.0], rev: [20, 40], s3Temp: 0.1 },
  pharma: { industry: "Pharmaceuticals", s1: [6, 12], s2: [5, 10], s3x: [6, 11], evicRev: [4.2, 5.8], rev: [30, 60], s3Temp: 0.1 },
  medtech: { industry: "Medical devices", s1: [3, 6], s2: [5, 10], s3x: [5, 9], evicRev: [4.5, 6.5], rev: [10, 30], s3Temp: 0.05 },
  bank: { industry: "Banks", s1: [0.6, 1.4], s2: [1.2, 2.8], s3x: [3, 7], evicRev: [7, 11], rev: [25, 55], s3Temp: 0.1 },
  insure: { industry: "Insurance", s1: [0.4, 0.9], s2: [0.9, 1.8], s3x: [3, 5], evicRev: [1.2, 1.9], rev: [18, 45], s3Temp: 0.1 },
  pay: { industry: "Payments", s1: [0.4, 0.9], s2: [1.2, 2.6], s3x: [4, 6], evicRev: [12, 18], rev: [12, 30], s3Temp: 0.05 },
  am: { industry: "Asset management", s1: [0.3, 0.7], s2: [0.9, 1.8], s3x: [4, 6], evicRev: [3.5, 5.5], rev: [6, 14], s3Temp: 0.05 },
  semis: { industry: "Semiconductors", s1: [45, 80], s2: [70, 120], s3x: [3, 5], evicRev: [5, 8], rev: [30, 70], s3Temp: 0.1 },
  cloud: { industry: "Cloud infrastructure", s1: [2, 5], s2: [18, 34], s3x: [3, 5], evicRev: [7, 10], rev: [30, 70], s3Temp: 0.05 },
  soft: { industry: "Software", s1: [1, 3], s2: [3, 6], s3x: [8, 14], evicRev: [9, 14], rev: [15, 45], s3Temp: 0.05 },
  hw: { industry: "Hardware & devices", s1: [2, 5], s2: [5, 10], s3x: [15, 28], evicRev: [3.5, 6], rev: [40, 110], s3Temp: 0.15 },
  telco: { industry: "Telecoms", s1: [5, 10], s2: [25, 45], s3x: [3, 6], evicRev: [2.6, 3.4], rev: [25, 50], s3Temp: 0.1 },
  media: { industry: "Media & entertainment", s1: [1, 3], s2: [3, 6], s3x: [5, 10], evicRev: [3.5, 6], rev: [12, 30], s3Temp: 0.05 },
  reit: { industry: "Real estate (REIT)", s1: [12, 24], s2: [35, 60], s3x: [1, 2.5], evicRev: [12, 17], rev: [2.5, 6], s3Temp: 0.1 },
};

/* ------------------------------------------------------------------ *
 * Issuers — fictional names, hand-placed so the storylines cohere
 * ------------------------------------------------------------------ */

type Seed = [
  name: string,
  sector: SectorId,
  arche: keyof typeof ARCHE,
  country: string,
  sbti: Sbti,
  engagement: Engagement | null,
  milestone: [date: string, text: string] | null,
  controversy: string | null,
];

const SEEDS: Seed[] = [
  ["Harrowmere Power", "UTL", "coal", "PL", "None", "Divestment review", ["2026-03-19", "Coal revenue above 25% threshold"], "Coal capacity expansion"],
  ["Vantor Energy", "UTL", "gasutil", "US", "Committed", "Escalated", ["2026-07-09", "Collaborative letter to the board"], null],
  ["Kestrel Grid", "UTL", "grid", "GB", "Validated", "Engaging", ["2026-06-23", "Call with CFO on grid capex"], null],
  ["Solvane Renewables", "UTL", "renew", "DK", "Validated", null, null, null],
  ["Brightwater Energie", "UTL", "gasutil", "DE", "Validated", "Engaging", ["2026-08-27", "Transition plan review meeting"], null],
  ["Tasman Generation", "UTL", "coal", "AU", "None", "Voted against", ["2026-05-21", "AGM: voted against chair"], "Coal plant life extension"],

  ["Corvid Petroleum", "ENE", "oil", "GB", "Committed", "Voted against", ["2026-05-07", "AGM: voted against climate plan"], "Methane flaring"],
  ["Halvard Offshore", "ENE", "enp", "NO", "Committed", "Engaging", ["2026-09-03", "Methane intensity workshop"], null],
  ["Sableridge Oil & Gas", "ENE", "enp", "US", "None", "Divestment review", ["2026-04-22", "Referred to investment committee"], "Arctic drilling licence"],
  ["Petrolux Refining", "ENE", "refine", "SG", "None", "Divestment review", ["2026-06-30", "Sell-down review after failed escalation"], null],
  ["Northreach Midstream", "ENE", "mid", "CA", "None", "Escalated", ["2026-08-12", "Escalated to lead independent director"], "Pipeline leak (2025)"],
  ["Ironbark Energy", "ENE", "oil", "AU", "None", "Voted against", ["2026-05-28", "AGM: voted against chair"], null],

  ["Granitefield Cement", "MAT", "cement", "CH", "Validated", "Engaging", ["2026-07-22", "CCS pilot site visit"], null],
  ["Aurelian Steel", "MAT", "steel", "KR", "Committed", "Escalated", ["2026-06-11", "Co-filed resolution on EAF capex"], null],
  ["Cobaltine Mining", "MAT", "mining", "AU", "Committed", "Engaging", ["2026-08-19", "Scope 3 target consultation"], "Tailings dam safety"],
  ["Veridian Chemicals", "MAT", "chem", "DE", "Validated", "Engaging", ["2026-03-26", "Company meeting: heat electrification"], null],
  ["Dunmore Aluminium", "MAT", "alu", "CA", "None", "Voted against", ["2026-04-30", "AGM: voted against remuneration"], null],
  ["Pellico Packaging", "MAT", "pack", "IE", "Validated", null, null, null],

  ["Arden Aerospace", "IND", "aero", "GB", "Committed", null, null, null],
  ["Lowther Rail", "IND", "rail", "US", "Validated", null, null, null],
  ["Stratus Airways", "IND", "airline", "US", "Committed", "Engaging", ["2026-07-15", "SAF offtake briefing"], null],
  ["Kellmoor Logistics", "IND", "logis", "DE", "Validated", "Engaging", ["2026-05-06", "Fleet electrification update"], null],
  ["Brevik Shipping", "IND", "ship", "DK", "Validated", "Engaging", ["2026-06-04", "Dual-fuel fleet update"], null],
  ["Talon Engineering", "IND", "eng", "SE", "None", null, null, null],
  ["Orsino Building Systems", "IND", "build", "US", "None", null, null, null],

  ["Veltro Motors", "CD", "auto", "DE", "Validated", "Engaging", ["2026-09-10", "EV mix and scope 3 target call"], null],
  ["Quint Automotive", "CD", "auto", "JP", "Committed", "Escalated", ["2026-06-25", "Letter on ICE phase-out date"], null],
  ["Halcyon Homes", "CD", "home", "US", "None", null, null, null],
  ["Marisol Retail", "CD", "retail", "ES", "Validated", null, null, null],
  ["Lumen Leisure", "CD", "leisure", "US", "None", "Escalated", ["2026-05-19", "Escalated after port emissions fine"], "Port emissions fine"],

  ["Greenacre Foods", "CS", "food", "NL", "Validated", null, null, null],
  ["Tillbrook Dairy", "CS", "dairy", "NZ", "Committed", "Engaging", ["2026-08-05", "FLAG target consultation"], "Deforestation-linked feed"],
  ["Morrow Beverages", "CS", "bev", "US", "Committed", null, null, null],
  ["Pellham Consumer Brands", "CS", "hh", "GB", "Validated", null, null, null],
  ["Agrova Protein", "CS", "dairy", "BR", "None", "Escalated", ["2026-07-01", "Supply-chain traceability letter"], "Deforestation link"],

  ["Castellan Pharma", "HC", "pharma", "CH", "Validated", null, null, null],
  ["Medivance", "HC", "medtech", "US", "Committed", null, null, null],
  ["Orrin Diagnostics", "HC", "medtech", "US", "None", null, null, null],
  ["Sorrel Health", "HC", "pharma", "JP", "None", null, null, null],

  ["Ashgrove Bank", "FIN", "bank", "GB", "Validated", null, null, null],
  ["Portland Mutual", "FIN", "insure", "US", "None", null, null, null],
  ["Thameside Insurance", "FIN", "insure", "GB", "Validated", null, null, null],
  ["Crestline Capital", "FIN", "am", "US", "None", null, null, null],
  ["Barnard Life", "FIN", "insure", "CA", "None", null, null, null],
  ["Everline Payments", "FIN", "pay", "US", "Committed", null, null, null],
  ["Norrland Bank", "FIN", "bank", "SE", "Validated", null, null, null],

  ["Quantis Semiconductor", "IT", "semis", "TW", "Committed", "Engaging", ["2026-07-28", "Renewable PPA progress call"], null],
  ["Tessellate Cloud", "IT", "cloud", "US", "Validated", null, null, null],
  ["Brightmark Software", "IT", "soft", "US", "Committed", null, null, null],
  ["Nimbusly", "IT", "soft", "US", "None", null, null, null],
  ["Coralis Systems", "IT", "hw", "US", "Validated", null, null, null],
  ["Vireo Devices", "IT", "hw", "KR", "Committed", null, null, null],
  ["Parallax Micro", "IT", "semis", "US", "None", null, null, null],

  ["Beacon Telecom", "COM", "telco", "ES", "Validated", null, null, null],
  ["Marlowe Studios", "COM", "media", "US", "None", null, null, null],
  ["Signalpoint", "COM", "telco", "US", "None", null, null, null],
  ["Loomis Interactive", "COM", "media", "US", "Committed", null, null, null],

  ["Ashby REIT", "RE", "reit", "GB", "Validated", null, null, null],
  ["Harbourline Properties", "RE", "reit", "HK", "None", "Engaging", ["2026-04-09", "Building retrofit plan request"], null],
  ["Kingsgate Logistics Parks", "RE", "reit", "US", "Committed", null, null, null],
];

const USD_GBP = 0.79;

export const ISSUERS: Issuer[] = (() => {
  const r = mulberry32(20260630);
  return SEEDS.map(([name, sector, archeKey, country, sbti, engagement, milestone, controversy], i) => {
    const a = ARCHE[archeKey];
    const revenue = Math.round(between(r, a.rev) * 1000);
    const s1i = between(r, a.s1);
    const s2i = between(r, a.s2);
    const s1 = Math.round(s1i * revenue);
    const s2 = Math.round(s2i * revenue);
    const s3 = Math.round((s1 + s2) * between(r, a.s3x));
    const evic = Math.round(revenue * between(r, a.evicRev) * USD_GBP);
    const coalish = archeKey === "coal" || archeKey === "enp";
    const tempS12 =
      sbti === "Validated"
        ? between(r, [1.5, 2.1])
        : sbti === "Committed"
          ? between(r, [2.45, 3.0])
          : between(r, [3.15, 3.7]) + (coalish ? 0.15 : 0);
    const s3Bump =
      a.s3Temp + (sbti === "Validated" ? between(r, [0.02, 0.12]) : between(r, [0.1, 0.3]));
    const tempS123 = Math.min(3.95, tempS12 + s3Bump);
    const histRate =
      sbti === "Validated"
        ? between(r, [-0.055, -0.03])
        : sbti === "Committed"
          ? between(r, [-0.028, -0.01])
          : between(r, [-0.01, 0.012]);
    const fwdRate =
      sbti === "Validated"
        ? between(r, [-0.085, -0.058])
        : sbti === "Committed"
          ? between(r, [-0.05, -0.03])
          : between(r, [-0.015, -0.003]);
    const large = revenue > 25000;
    const pcaf =
      sbti === "Validated"
        ? large ? 1 : 2
        : sbti === "Committed"
          ? 2
          : r() < 0.5 ? 3 : 4;
    return {
      id: `I${String(i + 1).padStart(2, "0")}`,
      name,
      sector,
      industry: a.industry,
      arche: archeKey,
      country,
      revenue,
      evic,
      s1,
      s2,
      s3,
      tempS12: Math.round(tempS12 * 100) / 100,
      tempS123: Math.round(tempS123 * 100) / 100,
      sbti,
      engagement,
      milestone: milestone ? { date: milestone[0], text: milestone[1] } : null,
      controversy,
      pcaf,
      histRate,
      fwdRate,
      evicDrift: between(r, [-0.015, 0.015]),
    };
  });
})();

export const ISSUER_BY_ID = new Map(ISSUERS.map((i) => [i.id, i]));

/* ------------------------------------------------------------------ *
 * Emissions, intensity, temperature by scope
 * ------------------------------------------------------------------ */

export const emissionsOf = (i: Issuer, scope: Scope) =>
  scope === "s12" ? i.s1 + i.s2 : i.s1 + i.s2 + i.s3;
export const intensityOf = (i: Issuer, scope: Scope) =>
  emissionsOf(i, scope) / i.revenue;
export const tempOf = (i: Issuer, scope: Scope) =>
  scope === "s12" ? i.tempS12 : i.tempS123;

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const BASE_YEAR = 2019;
export const REPORT_YEAR = 2026;

/* Covid dip and rebound in operating emissions. */
const ACTIVITY: Record<number, number> = { 2020: 0.92, 2021: 0.98 };
/* Market-wide EVIC factor (2019 = 1): the "EVIC effect" — equity rallies
 * lower attribution factors without anyone cutting a tonne. */
const MARKET: Record<number, number> = {
  2019: 1.0,
  2020: 1.01,
  2021: 1.13,
  2022: 1.02,
  2023: 1.06,
  2024: 1.11,
  2025: 1.13,
  2026: 1.15,
};

function emissionsAt(i: Issuer, scope: Scope, y: number) {
  return emissionsOf(i, scope) * Math.pow(1 + i.histRate, y - REPORT_YEAR) * (ACTIVITY[y] ?? 1);
}
function evicAt(i: Issuer, y: number) {
  return i.evic * (MARKET[y] / MARKET[REPORT_YEAR]) * Math.pow(1 + i.evicDrift, y - REPORT_YEAR);
}

/* ------------------------------------------------------------------ *
 * Benchmarks
 * ------------------------------------------------------------------ */

const ACWI_SECTOR: Record<SectorId, number> = {
  IT: 24, FIN: 17, IND: 11, CD: 10.5, HC: 9.5, COM: 8, CS: 6, ENE: 4.5, MAT: 4, UTL: 3, RE: 2.5,
};
const IBOXX_SECTOR: Record<SectorId, number> = {
  FIN: 38, UTL: 12, RE: 8, COM: 8, IND: 8, CS: 7, ENE: 5, CD: 5, HC: 5, MAT: 2, IT: 2,
};

function sectorSplit(
  sectorWeights: Record<SectorId, number>,
  size: (i: Issuer) => number,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of SECTORS) {
    const members = ISSUERS.filter((i) => i.sector === s.id);
    const sizes = members.map(size);
    const total = sizes.reduce((a, b) => a + b, 0);
    if (!total) continue;
    members.forEach((m, k) => {
      if (sizes[k] > 0) out.set(m.id, (sectorWeights[s.id] / 100) * (sizes[k] / total));
    });
  }
  return normalise(out);
}

function normalise(m: Map<string, number>) {
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  const out = new Map<string, number>();
  for (const [k, v] of m) if (v > 0) out.set(k, v / total);
  return out;
}

const ACWI_W = (() => {
  const r = mulberry32(1970);
  return sectorSplit(
    ACWI_SECTOR,
    (i) => Math.pow(i.evic, 0.85) * (ARCHE[i.arche].idx ?? 1) * Math.exp(0.3 * gauss(r)),
  );
})();

/* Paris-aligned: EU PAB exclusions (coal, oil & gas above revenue caps), then
 * a tilt to validated targets and away from intensity. */
const PAB_EXCLUDED = new Set(["coal", "oil", "enp", "refine"]);
const PAB_W = (() => {
  const w = new Map<string, number>();
  for (const i of ISSUERS) {
    const base = ACWI_W.get(i.id) ?? 0;
    if (PAB_EXCLUDED.has(i.arche)) continue;
    // Tilt towards ambitious, credible targets and away from intensity.
    const tilt = Math.exp(-2.4 * (i.tempS12 - 1.5));
    const penalty = Math.pow(1 + intensityOf(i, "s12") / 300, -0.8);
    w.set(i.id, base * tilt * penalty);
  }
  return normalise(w);
})();

const IBOXX_W = (() => {
  const r = mulberry32(8080);
  return sectorSplit(IBOXX_SECTOR, (i) =>
    // Not every issuer has sterling paper outstanding; coal generators don't.
    (r() < 0.72 || i.sector === "UTL") && i.arche !== "coal"
      ? Math.pow(i.evic, 0.8) *
        (ARCHE[i.arche].idx ?? 1) *
        // Networks are the sterling market's biggest utility issuers.
        (i.arche === "grid" ? 2.4 : 1) *
        Math.exp(0.45 * gauss(r))
      : 0,
  );
})();

export const BENCHMARKS: {
  id: BenchmarkId;
  label: string;
  short: string;
  kind: string;
  weights: Map<string, number>;
}[] = [
  { id: "acwi", label: "MSCI ACWI", short: "ACWI", kind: "Equity", weights: ACWI_W },
  { id: "pab", label: "MSCI ACWI Climate Paris Aligned", short: "ACWI PAB", kind: "Equity", weights: PAB_W },
  { id: "iboxx", label: "iBoxx £ Corporates", short: "iBoxx £ Corp", kind: "Credit", weights: IBOXX_W },
];
export const BENCHMARK_BY_ID = Object.fromEntries(BENCHMARKS.map((b) => [b.id, b])) as Record<
  BenchmarkId,
  (typeof BENCHMARKS)[number]
>;

/* ------------------------------------------------------------------ *
 * Funds and their sleeves
 * ------------------------------------------------------------------ */

interface Sleeve {
  ac: AssetClass;
  share: number;
  base: Map<string, number>;
  tilt: Record<Sbti, number>;
  /** Exponent on (1 + intensity/300): how hard the PM leans off carbon. */
  penalty: number;
  holdProb: number;
  exclude: string[];
  /** How much heavier the carbon-intensive names were in 2019 (per year). */
  histK: number;
  seed: number;
}

interface Fund {
  id: PortfolioId;
  label: string;
  policyBenchmark: BenchmarkId;
  /** AUM in £m, 2019 … 2026. */
  aum: number[];
  sleeves: Sleeve[];
}

const FUND_DEFS: Fund[] = [
  {
    id: "gef",
    label: "Global Equity Fund",
    policyBenchmark: "acwi",
    aum: [3620, 3390, 4060, 3730, 4020, 4390, 4610, 4820],
    sleeves: [
      {
        ac: "equity",
        share: 1,
        base: ACWI_W,
        tilt: { Validated: 1.45, Committed: 1.0, None: 0.62 },
        penalty: 0.42,
        holdProb: 0.8,
        exclude: [],
        histK: 0.03,
        seed: 11,
      },
    ],
  },
  {
    id: "scf",
    label: "Sustainable Credit Fund",
    policyBenchmark: "iboxx",
    aum: [1240, 1310, 1520, 1470, 1650, 1840, 2010, 2140],
    sleeves: [
      {
        ac: "bond",
        share: 1,
        base: IBOXX_W,
        tilt: { Validated: 1.7, Committed: 1.1, None: 0.45 },
        penalty: 0.45,
        holdProb: 0.85,
        exclude: ["Harrowmere Power", "Tasman Generation", "Sableridge Oil & Gas", "Petrolux Refining"],
        histK: 0.035,
        seed: 22,
      },
    ],
  },
  {
    id: "mab",
    label: "Multi-Asset Balanced",
    policyBenchmark: "acwi",
    aum: [3050, 2940, 3260, 3010, 3150, 3290, 3360, 3410],
    sleeves: [
      {
        ac: "equity",
        share: 0.58,
        base: ACWI_W,
        tilt: { Validated: 1.1, Committed: 1.0, None: 0.95 },
        penalty: 0.05,
        holdProb: 0.7,
        exclude: [],
        histK: 0.02,
        seed: 33,
      },
      {
        ac: "bond",
        share: 0.42,
        base: IBOXX_W,
        tilt: { Validated: 1.1, Committed: 1.0, None: 0.9 },
        penalty: 0.05,
        holdProb: 0.75,
        exclude: [],
        histK: 0.02,
        seed: 44,
      },
    ],
  },
];

export const PORTFOLIOS = FUND_DEFS.map((f) => ({
  id: f.id,
  label: f.label,
  policyBenchmark: f.policyBenchmark,
  assetClasses: f.sleeves.map((s) => s.ac),
}));

/* Current (2026) weights within each sleeve. */
const SLEEVE_W: Map<string, number>[][] = FUND_DEFS.map((f) =>
  f.sleeves.map((s) => {
    const r = mulberry32(s.seed * 7919);
    const w = new Map<string, number>();
    for (const i of ISSUERS) {
      const base = s.base.get(i.id) ?? 0;
      const held = r() < s.holdProb || i.engagement !== null;
      const noise = Math.exp(0.35 * gauss(r));
      if (!base || !held || s.exclude.includes(i.name)) continue;
      w.set(
        i.id,
        base * s.tilt[i.sbti] * Math.pow(1 + intensityOf(i, "s12") / 300, -s.penalty) * noise,
      );
    }
    return normalise(w);
  }),
);

/** Weights within a sleeve in year y: carbon-heavy names were larger holdings
 * in the past, which is how turnover shows up in the pathway. */
function sleeveWeightsAt(fi: number, si: number, y: number) {
  const s = FUND_DEFS[fi].sleeves[si];
  const now = SLEEVE_W[fi][si];
  if (y === REPORT_YEAR) return now;
  const out = new Map<string, number>();
  for (const [id, w] of now) {
    const i = ISSUER_BY_ID.get(id)!;
    const int = intensityOf(i, "s12");
    const k = int > 500 ? s.histK : int > 100 ? s.histK * 0.5 : -s.histK * 0.12;
    out.set(id, w * Math.exp(k * (REPORT_YEAR - y)));
  }
  return normalise(out);
}

/* ------------------------------------------------------------------ *
 * Slice computation
 * ------------------------------------------------------------------ */

export interface Filters {
  portfolio: PortfolioId;
  benchmark: BenchmarkId;
  scope: Scope;
  assetClass: AssetClassFilter;
}

export interface HoldingRow {
  issuer: Issuer;
  /** £m */
  value: number;
  weight: number;
  assetClasses: AssetClass[];
  /** Financed emissions, tCO₂e. */
  fe: number;
  feShare: number;
  intensity: number;
  temp: number;
}

export interface SectorRow {
  id: SectorId;
  weight: number;
  benchWeight: number;
  fe: number;
  feShare: number;
  /** WACI within the sector (tCO₂e / $m revenue). */
  intensity: number;
  benchIntensity: number;
  allocation: number;
  selection: number;
  net: number;
  holdings: HoldingRow[];
}

export interface Slice {
  empty: boolean;
  aum: number;
  holdings: HoldingRow[];
  fe: number;
  feByYear: { year: number; fe: number; aum: number }[];
  feYoY: number;
  feVsBase: number;
  footprint: number;
  waci: number;
  itr: number;
  pcaf: number;
  sbti: Record<Sbti, number>;
  bench: {
    label: string;
    short: string;
    waci: number;
    itr: number;
    footprint: number;
    sbtiValidated: number;
    sbtiCommitted: number;
  };
  sectors: SectorRow[];
  pathway: {
    portfolio: [number, number][];
    bench: [number, number][];
    target: [number, number][];
    projection: [number, number][];
    band: [number, number, number][];
    targetAt2026: number;
    targetAt2030: number;
  };
}

/** £m held per issuer in year y for the fund slice. */
function valuesAt(p: PortfolioId, ac: AssetClassFilter, y: number) {
  const fi = FUND_DEFS.findIndex((f) => f.id === p);
  const f = FUND_DEFS[fi];
  const aum = f.aum[YEARS.indexOf(y)];
  const out = new Map<string, { value: number; acs: Set<AssetClass> }>();
  f.sleeves.forEach((s, si) => {
    if (ac !== "all" && s.ac !== ac) return;
    for (const [id, w] of sleeveWeightsAt(fi, si, y)) {
      const cur = out.get(id) ?? { value: 0, acs: new Set<AssetClass>() };
      cur.value += aum * s.share * w;
      cur.acs.add(s.ac);
      out.set(id, cur);
    }
  });
  return out;
}

/* Net-zero target path: −50% by 2030, net zero by 2050, linear legs. */
export function targetIndex(y: number) {
  if (y <= 2030) return 100 - (50 * (y - BASE_YEAR)) / (2030 - BASE_YEAR);
  return Math.max(0, 50 - (50 * (y - 2030)) / (2050 - 2030));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computeSlice(f: Filters): Slice {
  const bm = BENCHMARK_BY_ID[f.benchmark];
  const { scope } = f;

  // ---- benchmark (its own constituents; not scoped by the asset-class filter)
  let bWaci = 0;
  let bItr = 0;
  let bVal = 0;
  let bCom = 0;
  for (const [id, w] of bm.weights) {
    const i = ISSUER_BY_ID.get(id)!;
    bWaci += w * intensityOf(i, scope);
    bItr += w * tempOf(i, scope);
    if (i.sbti === "Validated") bVal += w;
    if (i.sbti === "Committed") bCom += w;
  }
  const benchFootprintAt = (y: number) => {
    let s = 0;
    for (const [id, w] of bm.weights) {
      const i = ISSUER_BY_ID.get(id)!;
      s += (w * emissionsAt(i, scope, y)) / evicAt(i, y);
    }
    return s;
  };

  // ---- portfolio, current year
  const now = valuesAt(f.portfolio, f.assetClass, REPORT_YEAR);
  const aum = sum([...now.values()].map((v) => v.value));

  const bench = {
    label: bm.label,
    short: bm.short,
    waci: bWaci,
    itr: bItr,
    footprint: benchFootprintAt(REPORT_YEAR),
    sbtiValidated: bVal,
    sbtiCommitted: bCom,
  };

  if (!aum) {
    return {
      empty: true,
      aum: 0,
      holdings: [],
      fe: 0,
      feByYear: [],
      feYoY: 0,
      feVsBase: 0,
      footprint: 0,
      waci: 0,
      itr: 0,
      pcaf: 0,
      sbti: { Validated: 0, Committed: 0, None: 0 },
      bench,
      sectors: [],
      pathway: { portfolio: [], bench: [], target: [], projection: [], band: [], targetAt2026: 0, targetAt2030: 0 },
    };
  }

  const holdings: HoldingRow[] = [...now.entries()].map(([id, v]) => {
    const i = ISSUER_BY_ID.get(id)!;
    return {
      issuer: i,
      value: v.value,
      weight: v.value / aum,
      assetClasses: [...v.acs],
      fe: (v.value / i.evic) * emissionsOf(i, scope),
      feShare: 0,
      intensity: intensityOf(i, scope),
      temp: tempOf(i, scope),
    };
  });
  const fe = sum(holdings.map((h) => h.fe));
  holdings.forEach((h) => (h.feShare = h.fe / fe));
  holdings.sort((a, b) => b.fe - a.fe);

  const waci = sum(holdings.map((h) => h.weight * h.intensity));
  const itr = sum(holdings.map((h) => h.weight * h.temp));
  const pcaf = sum(holdings.map((h) => h.feShare * h.issuer.pcaf));
  const sbti: Record<Sbti, number> = { Validated: 0, Committed: 0, None: 0 };
  holdings.forEach((h) => (sbti[h.issuer.sbti] += h.weight));

  // ---- history: financed emissions and footprint by year
  const feByYear = YEARS.map((y) => {
    const vals = valuesAt(f.portfolio, f.assetClass, y);
    let e = 0;
    let a = 0;
    for (const [id, v] of vals) {
      const i = ISSUER_BY_ID.get(id)!;
      e += (v.value / evicAt(i, y)) * emissionsAt(i, scope, y);
      a += v.value;
    }
    return { year: y, fe: e, aum: a };
  });
  const feLast = feByYear[feByYear.length - 1].fe;
  const fePrev = feByYear[feByYear.length - 2].fe;
  const feBase = feByYear[0].fe;
  const fpBase = feByYear[0].fe / feByYear[0].aum;
  const bBase = benchFootprintAt(BASE_YEAR);

  const portfolioPath: [number, number][] = feByYear.map((r) => [
    r.year,
    ((r.fe / r.aum) / fpBase) * 100,
  ]);
  const benchPath: [number, number][] = YEARS.map((y) => [y, (benchFootprintAt(y) / bBase) * 100]);

  // ---- projection 2026 → 2030 from issuer targets, with a delivery band
  const fp2026 = fe / aum;
  const project = (t: number, delivery: (i: Issuer) => number, evicGrowth: number) => {
    let s = 0;
    for (const h of holdings) {
      const i = h.issuer;
      s += h.weight * (emissionsOf(i, scope) * Math.pow(1 + i.fwdRate * delivery(i), t)) /
        (i.evic * Math.pow(1 + evicGrowth, t));
    }
    return s;
  };
  const projYears = [2026, 2027, 2028, 2029, 2030];
  const central = projYears.map((y) => project(y - 2026, () => 1, 0.02));
  const slow = projYears.map((y) =>
    project(y - 2026, (i) => (i.sbti === "Validated" ? 0.6 : i.sbti === "Committed" ? 0.3 : 0), 0),
  );
  const fast = projYears.map((y) => project(y - 2026, () => 1.35, 0.035));
  const scale = (v: number) => (v / fp2026) * portfolioPath[portfolioPath.length - 1][1];

  const pathway = {
    portfolio: portfolioPath,
    bench: benchPath,
    target: Array.from({ length: 2035 - 2019 + 1 }, (_, k) => 2019 + k).map(
      (y) => [y, targetIndex(y)] as [number, number],
    ),
    projection: projYears.map((y, k) => [y, scale(central[k])] as [number, number]),
    band: projYears.map((y, k) => [y, scale(fast[k]), scale(slow[k])] as [number, number, number]),
    targetAt2026: targetIndex(2026),
    targetAt2030: targetIndex(2030),
  };

  // ---- sector attribution of WACI vs benchmark (allocation / selection)
  const sectors: SectorRow[] = SECTORS.map((s) => {
    const hs = holdings.filter((h) => h.issuer.sector === s.id);
    const w = sum(hs.map((h) => h.weight));
    const intensity = w ? sum(hs.map((h) => h.weight * h.intensity)) / w : 0;
    let bw = 0;
    let bi = 0;
    for (const [id, wt] of bm.weights) {
      const i = ISSUER_BY_ID.get(id)!;
      if (i.sector !== s.id) continue;
      bw += wt;
      bi += wt * intensityOf(i, scope);
    }
    const benchIntensity = bw ? bi / bw : intensity;
    const allocation = (w - bw) * (benchIntensity - bWaci);
    const selection = w ? w * (intensity - benchIntensity) : 0;
    const secFe = sum(hs.map((h) => h.fe));
    return {
      id: s.id,
      weight: w,
      benchWeight: bw,
      fe: secFe,
      feShare: secFe / fe,
      intensity,
      benchIntensity,
      allocation,
      selection,
      net: allocation + selection,
      holdings: hs,
    };
  });

  return {
    empty: false,
    aum,
    holdings,
    fe,
    feByYear,
    feYoY: feLast / fePrev - 1,
    feVsBase: feLast / feBase - 1,
    footprint: fe / aum,
    waci,
    itr,
    pcaf,
    sbti,
    bench,
    sectors,
    pathway,
  };
}
