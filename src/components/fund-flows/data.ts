/* Fund Flows: model, mock data and aggregation.
 *
 * The book is a fictional UK asset manager with sixteen funds across five
 * asset classes, distributed through four channels into five regions. Flows
 * are simulated monthly at fund × channel × region grain (320 cells), from a
 * 12-day stub (19–30 Sep 2025) through September 2026 month-to-date (1–18
 * Sep), so the rolling 12M window is exactly 365 days.
 *
 * Each cell carries its own AUM, so the bridge (opening + sales − redemptions
 * + markets = closing) holds for any filter slice. Large client tickets are
 * generated first and folded into the cells as they are simulated, which is
 * what lets the "biggest client moves" table sit inside the same totals the
 * KPIs, sankey and fund bars read from.
 *
 * Everything is seeded (mulberry32), so the numbers are stable across reloads.
 * Amounts are £m throughout.
 */

/* --- palette (validated; see the shared brief) -------------------------- */

export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"] as const;
export const INFLOW = "#4f46e5";
export const OUTFLOW = "#f97316";
export const MIDPOINT = "#e5e5e5";
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" } as const;
export const MUTED_SERIES = "#cbd5e1";
export const ACCENT = "#0284c7";
export const INK = "#171717";

/* --- dimensions ---------------------------------------------------------- */

export type AssetClass = "equity" | "fixed" | "multi" | "alts" | "mm";
export type Channel = "inst" | "wholesale" | "platforms" | "retail";
export type Region = "uk" | "europe" | "americas" | "apac" | "me";
export type PeriodKey = "MTD" | "QTD" | "YTD" | "12M";

export const ASSET_CLASSES: { id: AssetClass; label: string; color: string }[] = [
  { id: "equity", label: "Equity", color: CAT[0] },
  { id: "fixed", label: "Fixed income", color: CAT[1] },
  { id: "multi", label: "Multi-asset", color: CAT[2] },
  { id: "alts", label: "Alternatives", color: CAT[3] },
  { id: "mm", label: "Money market", color: CAT[4] },
];

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "inst", label: "Institutional" },
  { id: "wholesale", label: "Wholesale / IFA" },
  { id: "platforms", label: "Platforms" },
  { id: "retail", label: "Retail direct" },
];

export const REGIONS: { id: Region; label: string }[] = [
  { id: "uk", label: "UK" },
  { id: "europe", label: "Europe" },
  { id: "americas", label: "Americas" },
  { id: "apac", label: "APAC" },
  { id: "me", label: "Middle East" },
];

export const AC_BY_ID = Object.fromEntries(ASSET_CLASSES.map((a) => [a.id, a])) as Record<
  AssetClass,
  (typeof ASSET_CLASSES)[number]
>;
export const CH_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c])) as Record<
  Channel,
  (typeof CHANNELS)[number]
>;
export const RG_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<
  Region,
  (typeof REGIONS)[number]
>;

/* --- calendar ------------------------------------------------------------ */

export interface Bucket {
  /** "Oct 25" */
  label: string;
  year: number;
  /** 0-based month */
  month: number;
  firstDay: number;
  days: number;
  partial: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const BUCKETS: Bucket[] = (() => {
  const out: Bucket[] = [
    { label: "Sep 25", year: 2025, month: 8, firstDay: 19, days: 12, partial: true },
  ];
  for (let i = 0; i < 12; i++) {
    const month = (9 + i) % 12;
    const year = 9 + i >= 12 ? 2026 : 2025;
    const full = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const last = i === 11;
    out.push({
      label: `${MONTHS[month]} ${String(year).slice(2)}`,
      year,
      month,
      firstDay: 1,
      days: last ? 18 : full,
      partial: last,
    });
  }
  return out;
})();

/** Index of the latest bucket (Sep 26, month-to-date). */
export const LAST = BUCKETS.length - 1;

export const PERIODS: {
  id: PeriodKey;
  label: string;
  long: string;
  range: string;
  /** date of the opening AUM */
  opened: string;
  from: number;
}[] = [
  { id: "MTD", label: "MTD", long: "Month to date", range: "1–18 Sep 2026", opened: "31 Aug", from: LAST },
  { id: "QTD", label: "QTD", long: "Quarter to date", range: "1 Jul – 18 Sep 2026", opened: "30 Jun", from: LAST - 2 },
  { id: "YTD", label: "YTD", long: "Year to date", range: "1 Jan – 18 Sep 2026", opened: "31 Dec", from: 4 },
  { id: "12M", label: "12M", long: "Rolling 12 months", range: "19 Sep 2025 – 18 Sep 2026", opened: "18 Sep 25", from: 0 },
];

export const PERIOD_BY_ID = Object.fromEntries(PERIODS.map((p) => [p.id, p])) as Record<
  PeriodKey,
  (typeof PERIODS)[number]
>;

/* --- seeded randomness --------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260918);
const gauss = () => {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const lognoise = (sigma: number) => Math.exp(sigma * gauss() - (sigma * sigma) / 2);
function pickWeighted<T>(items: T[], weight: (t: T) => number): T {
  const ws = items.map(weight);
  const total = ws.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/* --- funds --------------------------------------------------------------- */

export interface Fund {
  id: string;
  name: string;
  ac: AssetClass;
  /** AUM at 19 Sep 2025, £m */
  aum0: number;
  /** annual gross sales / redemptions as a share of AUM */
  sRate: number;
  rRate: number;
  chMix: Record<Channel, number>;
  rgMix: Record<Region, number>;
}

type Mix4 = [number, number, number, number];
type Mix5 = [number, number, number, number, number];

const FUND_DEFS: [string, string, AssetClass, number, number, number, Mix4, Mix5][] = [
  ["ngei", "Northgate Global Equity Income", "equity", 7800, 0.14, 0.21, [0.34, 0.3, 0.26, 0.1], [0.52, 0.2, 0.08, 0.12, 0.08]],
  ["nguk", "Northgate UK Equity Alpha", "equity", 6400, 0.1, 0.27, [0.4, 0.28, 0.22, 0.1], [0.8, 0.08, 0.03, 0.05, 0.04]],
  ["ngeo", "Northgate European Opportunities", "equity", 4900, 0.12, 0.22, [0.36, 0.3, 0.24, 0.1], [0.42, 0.4, 0.05, 0.08, 0.05]],
  ["ngem", "Northgate Emerging Markets Leaders", "equity", 3600, 0.17, 0.19, [0.42, 0.28, 0.22, 0.08], [0.36, 0.2, 0.1, 0.22, 0.12]],
  ["ngus", "Northgate US Equity Index", "equity", 5200, 0.3, 0.17, [0.3, 0.14, 0.46, 0.1], [0.58, 0.14, 0.08, 0.12, 0.08]],
  ["ngsu", "Northgate Global Sustainable Equity", "equity", 3300, 0.14, 0.21, [0.3, 0.3, 0.3, 0.1], [0.48, 0.32, 0.06, 0.09, 0.05]],
  ["hsdc", "Harbour Short Duration Credit", "fixed", 8900, 0.3, 0.19, [0.55, 0.2, 0.2, 0.05], [0.5, 0.2, 0.08, 0.13, 0.09]],
  ["hscb", "Harbour Sterling Corporate Bond", "fixed", 7100, 0.27, 0.18, [0.56, 0.2, 0.19, 0.05], [0.78, 0.08, 0.03, 0.06, 0.05]],
  ["hgab", "Harbour Global Aggregate Bond", "fixed", 5600, 0.25, 0.17, [0.58, 0.18, 0.19, 0.05], [0.4, 0.24, 0.12, 0.14, 0.1]],
  ["hstr", "Harbour Strategic Bond", "fixed", 4200, 0.16, 0.21, [0.3, 0.34, 0.28, 0.08], [0.6, 0.16, 0.06, 0.1, 0.08]],
  ["fbal", "Fenwick Balanced Portfolio", "multi", 4600, 0.15, 0.21, [0.12, 0.4, 0.36, 0.12], [0.72, 0.12, 0.04, 0.07, 0.05]],
  ["fcau", "Fenwick Cautious Income", "multi", 3100, 0.23, 0.18, [0.1, 0.38, 0.4, 0.12], [0.74, 0.1, 0.03, 0.08, 0.05]],
  ["agin", "Ashcombe Global Infrastructure", "alts", 3800, 0.22, 0.12, [0.62, 0.24, 0.12, 0.02], [0.4, 0.2, 0.1, 0.14, 0.16]],
  ["aabr", "Ashcombe Absolute Return", "alts", 2600, 0.11, 0.25, [0.56, 0.3, 0.12, 0.02], [0.5, 0.26, 0.08, 0.1, 0.06]],
  ["hsli", "Harbour Sterling Liquidity", "mm", 5900, 0.6, 0.52, [0.84, 0.08, 0.07, 0.01], [0.8, 0.06, 0.03, 0.05, 0.06]],
  ["heli", "Harbour Euro Liquidity", "mm", 2500, 0.5, 0.46, [0.86, 0.08, 0.05, 0.01], [0.18, 0.66, 0.04, 0.04, 0.08]],
];

const CH_IDS: Channel[] = ["inst", "wholesale", "platforms", "retail"];
const RG_IDS: Region[] = ["uk", "europe", "americas", "apac", "me"];

export const FUNDS: Fund[] = FUND_DEFS.map(([id, name, ac, aum0, sRate, rRate, ch, rg]) => ({
  id,
  name,
  ac,
  aum0,
  sRate,
  rRate,
  chMix: Object.fromEntries(CH_IDS.map((c, i) => [c, ch[i]])) as Record<Channel, number>,
  rgMix: Object.fromEntries(RG_IDS.map((r, i) => [r, rg[i]])) as Record<Region, number>,
}));

export const FUND_BY_ID = Object.fromEntries(FUNDS.map((f) => [f.id, f])) as Record<string, Fund>;

/* Channel and region tilts on the base sales / redemption rates: platforms
 * and the Gulf are growing, wholesale and Europe are bleeding. */
const TILT_S: Record<Channel | Region, number> = {
  inst: 0.95, wholesale: 0.9, platforms: 1.3, retail: 0.85,
  uk: 1, europe: 0.9, americas: 1, apac: 1.22, me: 1.28,
};
const TILT_R: Record<Channel | Region, number> = {
  inst: 1, wholesale: 1.15, platforms: 0.9, retail: 1.12,
  uk: 1.02, europe: 1.1, americas: 1, apac: 0.9, me: 0.85,
};

/* Calendar-month seasonality (0 = Jan). */
const SEASON_S = [1.08, 1, 1.05, 1.08, 0.97, 1, 0.96, 0.82, 1.02, 1.04, 1, 0.8];
const SEASON_R = [1.05, 1, 1.12, 0.98, 1, 1.02, 0.98, 0.85, 1, 1, 1, 0.95];

/* Market return by asset class per bucket, in %. The stub and MTD buckets are
 * already scaled to their days. March 2026 is the risk-off month. */
const MKT: Record<AssetClass, number[]> = {
  equity: [0.9, 2.3, 1.1, 0.6, 2.0, -1.4, -3.2, 2.9, 1.6, 0.7, 1.8, -0.9, 1.1],
  fixed: [0.2, 0.6, 0.4, 0.5, 0.3, 0.4, -0.6, 0.7, 0.2, 0.5, 0.3, 0.4, 0.2],
  multi: [],
  alts: [0.3, 0.7, 0.5, 0.4, 0.6, 0.1, -0.8, 0.9, 0.5, 0.4, 0.6, 0.2, 0.3],
  mm: BUCKETS.map((b) => (4.3 * b.days) / 365),
};
MKT.multi = MKT.equity.map((e, i) => 0.55 * e + 0.45 * MKT.fixed[i]);
const IDIO: Record<AssetClass, number> = { equity: 0.7, fixed: 0.25, multi: 0.3, alts: 0.5, mm: 0.01 };

/* --- clients --------------------------------------------------------------- */

export type ClientType =
  | "DB pension"
  | "Local authority"
  | "Public pension"
  | "Insurer"
  | "Endowment"
  | "DC master trust"
  | "Provident fund"
  | "Superannuation"
  | "Sovereign fund"
  | "Corporate treasury"
  | "Discretionary"
  | "Private bank"
  | "Fund of funds"
  | "IFA network"
  | "Family office"
  | "Wealth platform"
  | "D2C platform"
  | "Model portfolios";

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  ch: Channel;
  rg: Region;
  size: number;
  rm: string;
}

/* Affinity by asset class: [equity, fixed, multi, alts, mm]. */
const AFFINITY: Record<ClientType, Mix5> = {
  "DB pension": [1, 1.6, 0.3, 1.2, 0.3],
  "Local authority": [1.2, 1, 0.3, 1.4, 0.4],
  "Public pension": [1.2, 1, 0.3, 1.3, 0.3],
  Insurer: [0.5, 2, 0.2, 0.8, 1],
  Endowment: [1.2, 0.6, 0.8, 1.4, 0.3],
  "DC master trust": [1.6, 0.8, 1.4, 0.3, 0.2],
  "Provident fund": [1.2, 1.2, 0.6, 1, 0.3],
  Superannuation: [1.2, 1.2, 0.6, 1, 0.3],
  "Sovereign fund": [1, 1.3, 0.2, 1.5, 1],
  "Corporate treasury": [0, 0.3, 0, 0, 3],
  Discretionary: [1.2, 1, 1.2, 0.8, 0.2],
  "Private bank": [1, 1.2, 0.8, 1, 0.5],
  "Fund of funds": [1.3, 0.9, 0.6, 1, 0],
  "IFA network": [1, 1, 1.5, 0.4, 0.1],
  "Family office": [1, 0.8, 0.6, 1.5, 0.6],
  "Wealth platform": [1.3, 1, 1.3, 0.3, 0.1],
  "D2C platform": [1.5, 0.7, 1, 0.2, 0.1],
  "Model portfolios": [1.3, 1, 0.8, 0.4, 0.1],
};
const AC_INDEX: Record<AssetClass, number> = { equity: 0, fixed: 1, multi: 2, alts: 3, mm: 4 };

const CLIENT_DEFS: [string, ClientType, Channel, Region, number, string][] = [
  ["Pennine LGPS", "Local authority", "inst", "uk", 1.4, "P. Natarajan"],
  ["Thameside Rail Pension Trust", "DB pension", "inst", "uk", 1.6, "T. Ellery"],
  ["Albion Mutual Assurance", "Insurer", "inst", "uk", 1.8, "P. Natarajan"],
  ["Severn Water Pension Plan", "DB pension", "inst", "uk", 0.9, "T. Ellery"],
  ["Caldermoor University Fund", "Endowment", "inst", "uk", 0.6, "T. Ellery"],
  ["Blackfriars Life & Pensions", "Insurer", "inst", "uk", 1.5, "P. Natarajan"],
  ["Wessex Master Trust", "DC master trust", "inst", "uk", 1.2, "T. Ellery"],
  ["Northumbria Fire Pension Fund", "Local authority", "inst", "uk", 0.7, "P. Natarajan"],
  ["Arden Logistics Treasury", "Corporate treasury", "inst", "uk", 1.1, "T. Ellery"],
  ["Vale & Tamar Utilities", "Corporate treasury", "inst", "uk", 1.0, "P. Natarajan"],
  ["Pensioenfonds Zeeland Havens", "DB pension", "inst", "europe", 1.3, "S. Marchetti"],
  ["Versorgungswerk Moselland", "DB pension", "inst", "europe", 1.0, "L. Brenner"],
  ["Caisse de Retraite Alpine", "DB pension", "inst", "europe", 0.8, "S. Marchetti"],
  ["Nordvik Pensjonskasse", "DB pension", "inst", "europe", 0.9, "L. Brenner"],
  ["Lakeshore Teachers' Pension", "Public pension", "inst", "americas", 1.4, "D. Reyes"],
  ["Great Plains Municipal Fund", "Public pension", "inst", "americas", 1.0, "D. Reyes"],
  ["Hudson Ridge Foundation", "Endowment", "inst", "americas", 0.7, "D. Reyes"],
  ["Pacific Crest Provident", "Provident fund", "inst", "apac", 1.5, "M. L. Tan"],
  ["Tasman Coast Super", "Superannuation", "inst", "apac", 1.2, "M. L. Tan"],
  ["Meranti Life Assurance", "Insurer", "inst", "apac", 1.0, "M. L. Tan"],
  ["Sandhaven Sovereign Reserve", "Sovereign fund", "inst", "me", 2.0, "O. Haddad"],
  ["Dunecrest Investment Office", "Sovereign fund", "inst", "me", 1.6, "O. Haddad"],
  ["Al Saraab Takaful", "Insurer", "inst", "me", 0.8, "O. Haddad"],
  ["Holloway & Pryce DFM", "Discretionary", "wholesale", "uk", 1.2, "H. Lindqvist"],
  ["Ludgate Private Bank", "Private bank", "wholesale", "uk", 1.0, "J. Okafor"],
  ["Cairnbrook Fund of Funds", "Fund of funds", "wholesale", "uk", 1.1, "H. Lindqvist"],
  ["Stonebridge IFA Network", "IFA network", "wholesale", "uk", 0.8, "J. Okafor"],
  ["Marlow Crescent Family Office", "Family office", "wholesale", "uk", 0.6, "J. Okafor"],
  ["Banque Privée du Lac", "Private bank", "wholesale", "europe", 1.0, "S. Marchetti"],
  ["Van Oorschot Vermogensbeheer", "Discretionary", "wholesale", "europe", 0.9, "L. Brenner"],
  ["Casa Torrenova Wealth", "Discretionary", "wholesale", "europe", 0.7, "S. Marchetti"],
  ["Tanjong Pearl Private Bank", "Private bank", "wholesale", "apac", 1.2, "M. L. Tan"],
  ["Crescent Dune Family Office", "Family office", "wholesale", "me", 1.0, "O. Haddad"],
  ["Westmere Advisory Group", "Discretionary", "wholesale", "americas", 0.8, "D. Reyes"],
  ["Kestrel Wealth Platform", "Wealth platform", "platforms", "uk", 1.4, "C. Ashworth"],
  ["Ribbonway Investor Platform", "Wealth platform", "platforms", "uk", 1.2, "C. Ashworth"],
  ["Clearline Wrap", "Wealth platform", "platforms", "uk", 1.0, "C. Ashworth"],
  ["Pebblestone Invest", "D2C platform", "platforms", "uk", 0.9, "C. Ashworth"],
  ["Fondsbrücke Plattform", "Wealth platform", "platforms", "europe", 0.8, "L. Brenner"],
  ["Lotus Gate Digital Wealth", "Wealth platform", "platforms", "apac", 0.9, "M. L. Tan"],
  ["Summit Ridge Models", "Model portfolios", "platforms", "americas", 0.6, "D. Reyes"],
];

export const CLIENTS: Client[] = CLIENT_DEFS.map(([name, type, ch, rg, size, rm], i) => ({
  id: `c${i}`,
  name,
  type,
  ch,
  rg,
  size,
  rm,
}));

/* --- simulation ------------------------------------------------------------ */

export interface Cell {
  fund: Fund;
  ch: Channel;
  rg: Region;
  /** per bucket, £m */
  open: number[];
  sales: number[];
  red: number[];
  mkt: number[];
}

export interface Ticket {
  client: Client;
  fund: Fund;
  bucket: number;
  /** ISO yyyy-mm-dd */
  date: string;
  /** signed £m: + subscription, − redemption */
  amount: number;
}

const cellKey = (f: string, c: Channel, r: Region) => `${f}|${c}|${r}`;
const BASE_SHARE = 0.58;
const TICKET_MEDIAN: Record<Channel, number> = { inst: 85, wholesale: 32, platforms: 40, retail: 0 };
const REDEMPTION_CAP = 0.3;

function businessDay(b: Bucket): string {
  const lastDay = b.firstDay + b.days - 1;
  let d = b.firstDay + Math.floor(rand() * b.days);
  const dow = (day: number) => new Date(Date.UTC(b.year, b.month, day)).getUTCDay();
  if (dow(d) === 6) d = d - 1 >= b.firstDay ? d - 1 : d + 2;
  else if (dow(d) === 0) d = d + 1 <= lastDay ? d + 1 : d - 2;
  return `${b.year}-${String(b.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function simulate() {
  // 1. Intended client tickets, keyed by cell and bucket.
  const intents = new Map<string, { client: Client; fund: Fund; date: string; amount: number }[]>();
  for (const client of CLIENTS) {
    const n = 3 + Math.floor(rand() * 5);
    for (let k = 0; k < n; k++) {
      const bucket = pickWeighted(
        BUCKETS.map((_, i) => i),
        (i) => BUCKETS[i].days,
      );
      const fund = pickWeighted(
        FUNDS,
        (f) => f.aum0 * f.chMix[client.ch] * f.rgMix[client.rg] * AFFINITY[client.type][AC_INDEX[f.ac]],
      );
      const s = fund.sRate * TILT_S[client.ch] * TILT_S[client.rg];
      const r = fund.rRate * TILT_R[client.ch] * TILT_R[client.rg];
      const inflow = rand() < s / (s + r);
      const size =
        TICKET_MEDIAN[client.ch] * client.size * lognoise(0.55) * (fund.ac === "mm" ? 1.5 : 1);
      const key = `${cellKey(fund.id, client.ch, client.rg)}#${bucket}`;
      const list = intents.get(key) ?? [];
      list.push({ client, fund, date: businessDay(BUCKETS[bucket]), amount: inflow ? size : -size });
      intents.set(key, list);
    }
  }

  // 2. Walk every cell forward bucket by bucket.
  const cells: Cell[] = [];
  const tickets: Ticket[] = [];
  const idio = new Map<string, number>();
  for (const f of FUNDS) {
    BUCKETS.forEach((b, i) => {
      idio.set(`${f.id}#${i}`, gauss() * IDIO[f.ac] * Math.sqrt(b.days / 30.4));
    });
  }

  for (const fund of FUNDS) {
    for (const ch of CH_IDS) {
      for (const rg of RG_IDS) {
        const cell: Cell = { fund, ch, rg, open: [], sales: [], red: [], mkt: [] };
        let aum = fund.aum0 * fund.chMix[ch] * fund.rgMix[rg];
        BUCKETS.forEach((b, i) => {
          const t = b.days / 365;
          const isa = rg === "uk" && ch !== "inst" ? (b.month === 2 ? 1.35 : b.month === 3 ? 1.25 : 1) : 1;
          const riskOff = b.year === 2026 && b.month === 2;
          const sStress = riskOff && fund.ac === "mm" ? 1.3 : 1;
          const rStress = riskOff ? (fund.ac === "equity" ? 1.3 : fund.ac === "multi" ? 1.15 : 1) : 1;

          let sales =
            aum * fund.sRate * BASE_SHARE * TILT_S[ch] * TILT_S[rg] * SEASON_S[b.month] * isa * sStress * t * lognoise(0.22);
          let red =
            aum * fund.rRate * BASE_SHARE * TILT_R[ch] * TILT_R[rg] * SEASON_R[b.month] * rStress * t * lognoise(0.22);

          for (const tk of intents.get(`${cellKey(fund.id, ch, rg)}#${i}`) ?? []) {
            let amount = tk.amount;
            if (amount < 0) amount = -Math.min(-amount, aum * REDEMPTION_CAP);
            amount = Math.round(amount * 10) / 10;
            if (Math.abs(amount) < 10) continue;
            if (amount > 0) sales += amount;
            else red += -amount;
            tickets.push({ client: tk.client, fund, bucket: i, date: tk.date, amount });
          }

          const r = (MKT[fund.ac][i] + (idio.get(`${fund.id}#${i}`) ?? 0)) / 100;
          const mkt = (aum + 0.5 * (sales - red)) * r;
          cell.open.push(aum);
          cell.sales.push(sales);
          cell.red.push(red);
          cell.mkt.push(mkt);
          aum = Math.max(0, aum + sales - red + mkt);
        });
        cells.push(cell);
      }
    }
  }
  return { cells, tickets };
}

export const { cells: CELLS, tickets: TICKETS } = simulate();

/* --- aggregation ------------------------------------------------------------ */

export interface Filters {
  ac: AssetClass[];
  ch: Channel[];
  rg: Region[];
}

export interface Flow {
  opening: number;
  sales: number;
  red: number;
  mkt: number;
  closing: number;
  net: number;
}

export interface ClientMove {
  key: string;
  client: Client;
  fund: Fund;
  net: number;
  trades: number;
  last: string;
}

export interface Summary extends Flow {
  empty: boolean;
  days: number;
  /** annualised net flows / opening AUM, % */
  organic: number;
  /** annualised redemptions / average AUM, % */
  redRate: number;
  /** annualised gross sales / average AUM, % */
  salesRate: number;
  byFund: (Flow & { fund: Fund })[];
  byRegion: (Flow & { rg: Region; organic: number })[];
  byChannel: (Flow & { ch: Channel })[];
  byAc: (Flow & { ac: AssetClass })[];
  /** gross sales, channel → asset class */
  sankey: { ch: Channel; ac: AssetClass; sales: number }[];
  /** buckets 1…12 (Oct 25 – Sep 26 MTD), independent of the period */
  monthly: { bucket: number; label: string; sales: number; red: number; net: number }[];
  /** every client × fund move in the period, largest first */
  moves: ClientMove[];
}

const zero = (): Flow => ({ opening: 0, sales: 0, red: 0, mkt: 0, closing: 0, net: 0 });

function finish(f: Flow) {
  f.closing = f.opening + f.sales - f.red + f.mkt;
  f.net = f.sales - f.red;
  return f;
}

export function daysIn(period: PeriodKey) {
  let d = 0;
  for (let i = PERIOD_BY_ID[period].from; i <= LAST; i++) d += BUCKETS[i].days;
  return d;
}

export function summarise(filters: Filters, period: PeriodKey): Summary {
  const from = PERIOD_BY_ID[period].from;
  const days = daysIn(period);
  const ac = new Set(filters.ac);
  const ch = new Set(filters.ch);
  const rg = new Set(filters.rg);

  const total = zero();
  const byFund = new Map<string, Flow>();
  const byRegion = new Map<Region, Flow>();
  const byChannel = new Map<Channel, Flow>();
  const byAc = new Map<AssetClass, Flow>();
  const sankey = new Map<string, number>();
  const monthly = BUCKETS.map(() => ({ sales: 0, red: 0 }));
  let any = false;

  const bump = <K>(m: Map<K, Flow>, k: K, open: number, s: number, r: number, mk: number) => {
    const f = m.get(k) ?? zero();
    f.opening += open;
    f.sales += s;
    f.red += r;
    f.mkt += mk;
    m.set(k, f);
  };

  for (const c of CELLS) {
    if (!ac.has(c.fund.ac) || !ch.has(c.ch) || !rg.has(c.rg)) continue;
    any = true;
    let s = 0;
    let r = 0;
    let mk = 0;
    for (let i = from; i <= LAST; i++) {
      s += c.sales[i];
      r += c.red[i];
      mk += c.mkt[i];
    }
    const open = c.open[from];
    total.opening += open;
    total.sales += s;
    total.red += r;
    total.mkt += mk;
    bump(byFund, c.fund.id, open, s, r, mk);
    bump(byRegion, c.rg, open, s, r, mk);
    bump(byChannel, c.ch, open, s, r, mk);
    bump(byAc, c.fund.ac, open, s, r, mk);
    const sk = `${c.ch}|${c.fund.ac}`;
    sankey.set(sk, (sankey.get(sk) ?? 0) + s);
    for (let i = 1; i <= LAST; i++) {
      monthly[i].sales += c.sales[i];
      monthly[i].red += c.red[i];
    }
  }
  finish(total);

  const annual = 365 / days;
  const avgAum = (total.opening + total.closing) / 2;

  const moveMap = new Map<string, ClientMove>();
  for (const t of TICKETS) {
    if (t.bucket < from) continue;
    if (!ac.has(t.fund.ac) || !ch.has(t.client.ch) || !rg.has(t.client.rg)) continue;
    const key = `${t.client.id}|${t.fund.id}`;
    const m = moveMap.get(key) ?? { key, client: t.client, fund: t.fund, net: 0, trades: 0, last: "" };
    m.net += t.amount;
    m.trades += 1;
    if (t.date > m.last) m.last = t.date;
    moveMap.set(key, m);
  }

  return {
    ...total,
    empty: !any,
    days,
    organic: total.opening > 0 ? (total.net / total.opening) * annual * 100 : 0,
    redRate: avgAum > 0 ? (total.red / avgAum) * annual * 100 : 0,
    salesRate: avgAum > 0 ? (total.sales / avgAum) * annual * 100 : 0,
    byFund: FUNDS.filter((f) => byFund.has(f.id))
      .map((fund) => ({ fund, ...finish(byFund.get(fund.id)!) }))
      .sort((a, b) => b.net - a.net),
    byRegion: REGIONS.filter((r) => byRegion.has(r.id)).map((r) => {
      const f = finish(byRegion.get(r.id)!);
      return { rg: r.id, ...f, organic: f.opening > 0 ? (f.net / f.opening) * annual * 100 : 0 };
    }),
    byChannel: CHANNELS.filter((c) => byChannel.has(c.id)).map((c) => ({
      ch: c.id,
      ...finish(byChannel.get(c.id)!),
    })),
    byAc: ASSET_CLASSES.filter((a) => byAc.has(a.id)).map((a) => ({
      ac: a.id,
      ...finish(byAc.get(a.id)!),
    })),
    sankey: [...sankey.entries()]
      .map(([k, sales]) => {
        const [c, a] = k.split("|") as [Channel, AssetClass];
        return { ch: c, ac: a, sales };
      })
      .filter((l) => l.sales > 0),
    monthly: monthly.slice(1).map((m, j) => ({
      bucket: j + 1,
      label: BUCKETS[j + 1].label,
      sales: m.sales,
      red: m.red,
      net: m.sales - m.red,
    })),
    moves: [...moveMap.values()]
      .filter((m) => Math.abs(m.net) >= 10)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
  };
}

/* --- formatting --------------------------------------------------------------- */

const nfCache = new Map<number, Intl.NumberFormat>();
function nf(dp: number) {
  let f = nfCache.get(dp);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
    nfCache.set(dp, f);
  }
  return f;
}

export const MINUS = "−";

/** £m in, compact money out: £4.82bn, £412m, £8.4m. */
export function money(m: number, opts: { signed?: boolean; bnDp?: number } = {}) {
  const { signed = false, bnDp = 2 } = opts;
  const abs = Math.abs(m);
  const sign = abs < 0.05 ? "" : m < 0 ? MINUS : signed ? "+" : "";
  if (abs >= 1000) return `${sign}£${nf(bnDp).format(abs / 1000)}bn`;
  if (abs >= 10) return `${sign}£${nf(0).format(abs)}m`;
  return `${sign}£${nf(1).format(abs)}m`;
}

export function pct(v: number, dp = 1, signed = false) {
  const sign = v < 0 ? MINUS : signed && v > 0 ? "+" : "";
  return `${sign}${nf(dp).format(Math.abs(v))}%`;
}

/** "2026-09-14" → "14 Sep 26" (fixed abbreviations; ICU would give "Sept"). */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}
