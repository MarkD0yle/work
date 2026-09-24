/* Private Markets model: a seeded LP programme.
 *
 * Twenty-two fund commitments, each simulated quarter by quarter from its
 * first capital call to the 30 Jun 2026 NAV date with a Takahashi–Alexander
 * style J-curve: calls draw down the unfunded commitment (plus management
 * fees during the investment period), NAV compounds at a strategy- and
 * manager-specific rate that ramps in after the first year or two, and
 * distributions pay out a rising share of NAV as the fund ages (with an income
 * yield for credit, infrastructure and property). Venture gets lumpier
 * distributions and a wider manager spread.
 *
 * Nothing downstream is hard-coded: DPI, RVPI, TVPI, net IRR (XIRR on the
 * dated flows with NAV as a terminal value), KS-PME, vintage peer quartiles
 * and the 8-quarter call projection are all computed from these flows.
 */

export type StrategyId =
  | "buyout"
  | "growth"
  | "venture"
  | "infra"
  | "credit"
  | "realestate";

export const STRATEGIES: { id: StrategyId; label: string }[] = [
  { id: "buyout", label: "Buyout" },
  { id: "growth", label: "Growth" },
  { id: "venture", label: "Venture" },
  { id: "infra", label: "Infrastructure" },
  { id: "credit", label: "Private credit" },
  { id: "realestate", label: "Real estate" },
];

export const STRATEGY_LABEL = Object.fromEntries(
  STRATEGIES.map((s) => [s.id, s.label]),
) as Record<StrategyId, string>;

/* Quarter index = year * 4 + (quarter - 1). Q2 2026 is the NAV date. */
export const LATEST_Q = 2026 * 4 + 1;
export const VINTAGE_MIN = 2014;
export const VINTAGE_MAX = 2024;
export const VINTAGES = Array.from(
  { length: VINTAGE_MAX - VINTAGE_MIN + 1 },
  (_, i) => VINTAGE_MIN + i,
);
export const HORIZON = 8;
const PATHS = 400;

/** Scheme-level cash earmarked for private-markets calls, £m per quarter. */
export const LIQUIDITY_BUDGET = 12;

/* Chart colours: validated set from the brief, keyed by meaning. */
export const COLOR = {
  accent: "#a21caf",
  accentLight: "#f0abfc",
  calls: "#f97316",
  dists: "#0ea5e9",
  band: "#e5e5e5",
  median: "#404040",
  other: "#a3a3a3",
  ink: "#262626",
  muted: "#737373",
};

export const qLabel = (q: number) => `Q${(q % 4) + 1} ${Math.floor(q / 4)}`;
export const qShort = (q: number) =>
  `Q${(q % 4) + 1} ${String(Math.floor(q / 4)).slice(2)}`;
const qEndMs = (q: number) => Date.UTC(Math.floor(q / 4), 3 * ((q % 4) + 1), 0);

/* --- seeded randomness -------------------------------------------------- */

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

function normal(rand: () => number) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/* --- J-curve model -------------------------------------------------------- */

interface Profile {
  r0: number; // years before valuation gains start
  rLen: number; // years for gains to reach full pace
  mu: number; // annual NAV growth for a median manager
  sd: number; // manager dispersion (1 skill unit)
  qVol: number; // quarterly valuation noise
  fee: number; // annual management fee on commitment during the IP
  ip: number; // investment period, years
  call: number; // quarterly call rate on unfunded during the IP
  life: number; // distribution bow horizon
  bow: number;
  yld: number; // income yield distributed from early on
  distVol: number;
  distProb: number;
  postFee: number;
}

const PROFILE: Record<StrategyId, Profile> = {
  buyout: { r0: 1, rLen: 2.5, mu: 0.23, sd: 0.07, qVol: 0.035, fee: 0.0175, ip: 5, call: 0.07, life: 10, bow: 2.3, yld: 0, distVol: 0.55, distProb: 0.8, postFee: 0.01 },
  growth: { r0: 1, rLen: 2.5, mu: 0.21, sd: 0.08, qVol: 0.05, fee: 0.02, ip: 5, call: 0.085, life: 10, bow: 2.3, yld: 0, distVol: 0.7, distProb: 0.65, postFee: 0.012 },
  venture: { r0: 1.25, rLen: 3, mu: 0.2, sd: 0.1, qVol: 0.075, fee: 0.025, ip: 5, call: 0.07, life: 12, bow: 2.6, yld: 0, distVol: 1.0, distProb: 0.45, postFee: 0.015 },
  infra: { r0: 1, rLen: 1.5, mu: 0.12, sd: 0.025, qVol: 0.018, fee: 0.0125, ip: 4, call: 0.08, life: 12, bow: 2.0, yld: 0.045, distVol: 0.25, distProb: 1, postFee: 0.008 },
  credit: { r0: 0.1, rLen: 0.5, mu: 0.11, sd: 0.012, qVol: 0.01, fee: 0.01, ip: 3, call: 0.14, life: 7, bow: 1.6, yld: 0.075, distVol: 0.15, distProb: 1, postFee: 0.006 },
  realestate: { r0: 0.75, rLen: 1.5, mu: 0.11, sd: 0.04, qVol: 0.025, fee: 0.015, ip: 4, call: 0.09, life: 9, bow: 2.2, yld: 0.03, distVol: 0.35, distProb: 0.9, postFee: 0.01 },
};

interface Flow {
  q: number;
  call: number;
  dist: number;
  nav: number;
}

/** One quarter's capital call: investment drawdown plus IP fees. */
function quarterCall(
  p: Profile,
  commitment: number,
  unfunded: number,
  age: number,
  z: number,
) {
  const inIp = age < p.ip;
  const rate = inIp ? p.call : 0.025;
  const fee = inIp ? (commitment * p.fee) / 4 : 0;
  let invest = unfunded * rate * Math.exp(0.45 * z - 0.1);
  invest = Math.min(invest, Math.max(0, unfunded - fee));
  return { invest, call: invest + Math.min(fee, unfunded) };
}

function simulate(
  strategy: StrategyId,
  startQ: number,
  commitment: number,
  skill: number,
  seed: number,
): Flow[] {
  const p = PROFILE[strategy];
  const rand = mulberry32(seed);
  const muQ = Math.pow(1 + p.mu + skill * p.sd, 0.25) - 1;
  let nav = 0;
  let paid = 0;
  const out: Flow[] = [];
  for (let q = startQ; q <= LATEST_Q; q++) {
    const age = (q - startQ) / 4;
    const inIp = age < p.ip;
    let { invest, call } = quarterCall(p, commitment, commitment - paid, age, normal(rand));
    if (q === startQ) {
      // First close: an initial deal plus the first fee call.
      invest = commitment * (0.06 + 0.06 * rand());
      call = invest + (commitment * p.fee) / 4;
    }
    paid += call;
    const ramp = Math.min(1, Math.max(0, (age - p.r0) / p.rLen));
    const r =
      muQ * ramp -
      (inIp ? 0 : p.postFee / 4) +
      p.qVol * normal(rand) * Math.max(0.35, ramp);
    let grown = nav * (1 + r) + invest;
    const rdYear = Math.min(
      0.42,
      Math.max(p.yld * Math.min(1, age / 0.75), Math.pow(age / p.life, p.bow)),
    );
    const rdQ = 1 - Math.pow(1 - rdYear, 0.25);
    let dist = 0;
    if (rand() < p.distProb) {
      dist =
        ((grown * rdQ) / p.distProb) *
        Math.exp(p.distVol * normal(rand) - (p.distVol * p.distVol) / 2);
    }
    dist = Math.min(dist, grown * 0.6);
    grown -= dist;
    nav = Math.max(0, grown);
    out.push({ q, call, dist, nav });
  }
  return out;
}

/* --- IRR ------------------------------------------------------------------ */

/** XIRR on dated flows (ms timestamps). Newton first, bisection fallback. */
export function xirr(dates: number[], amounts: number[]): number | null {
  if (!amounts.some((a) => a > 0) || !amounts.some((a) => a < 0)) return null;
  const t0 = dates[0];
  const yrs = dates.map((d) => (d - t0) / (365 * 864e5));
  const npv = (r: number) =>
    amounts.reduce((s, a, i) => s + a / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r: number) =>
    amounts.reduce((s, a, i) => s - (yrs[i] * a) / Math.pow(1 + r, yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 60; i++) {
    const f = npv(r);
    const d = dnpv(r);
    if (!Number.isFinite(f) || !Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.99) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  let lo = -0.99;
  let hi = 10;
  let flo = npv(lo);
  if (Math.sign(flo) === Math.sign(npv(hi))) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Since-inception IRR of flows[0..upto] with that quarter's NAV as terminal value. */
function irrOf(flows: Flow[], upto = flows.length - 1) {
  const dates: number[] = [];
  const amts: number[] = [];
  for (let i = 0; i <= upto; i++) {
    dates.push(qEndMs(flows[i].q));
    amts.push(flows[i].dist - flows[i].call);
  }
  amts[upto] += flows[upto].nav;
  return xirr(dates, amts);
}

/* --- public market equivalent ------------------------------------------- */

/* MSCI World (GBP, net) quarterly total returns, Q1 2014 to Q2 2026, %.
 * A modelled series for the prototype, shaped like the index's path. */
const INDEX_RETURNS = [
  3.0, 1.5, 2.5, 4.5, 4.5, -4.5, -6.5, 7.0, 1.0, 6.5, 8.0, 6.0, 4.5, 1.0,
  2.5, 5.0, -4.0, 6.0, 5.5, -11.0, 9.5, 5.5, 4.0, 0.5, -16.0, 15.0, 3.5,
  6.5, 5.0, 6.0, 2.0, 5.5, -3.0, -10.0, 2.0, -1.5, 4.5, 3.0, 0.0, 5.0, 6.0,
  3.0, 0.5, 5.5, -4.5, 4.0, 5.5, 2.5, 2.0, 2.5,
];
const INDEX_Q0 = 2014 * 4;
const INDEX_LEVEL: number[] = [];
{
  let lvl = 100;
  for (const r of INDEX_RETURNS) {
    lvl *= 1 + r / 100;
    INDEX_LEVEL.push(lvl);
  }
}
const indexAt = (q: number) =>
  INDEX_LEVEL[Math.max(0, Math.min(INDEX_LEVEL.length - 1, q - INDEX_Q0))];

/* --- peers ---------------------------------------------------------------- */

export interface PeerBand {
  vintage: number;
  /** 25th percentile: the Q3/Q4 boundary. */
  lower: number;
  median: number;
  /** 75th percentile: the Q1/Q2 boundary. */
  upper: number;
  n: number;
}

export type Universe = StrategyId | "all";

function quantile(sorted: ArrayLike<number>, p: number) {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function toBand(vintage: number, irrs: number[]): PeerBand {
  const s = [...irrs].sort((a, b) => a - b);
  return {
    vintage,
    lower: quantile(s, 0.25),
    median: quantile(s, 0.5),
    upper: quantile(s, 0.75),
    n: s.length,
  };
}

export const PEERS: Record<Universe, Map<number, PeerBand>> = (() => {
  const out = {
    all: new Map(),
    buyout: new Map(),
    growth: new Map(),
    venture: new Map(),
    infra: new Map(),
    credit: new Map(),
    realestate: new Map(),
  } as Record<Universe, Map<number, PeerBand>>;
  const pooled = new Map<number, number[]>();
  STRATEGIES.forEach((s, si) => {
    for (const v of VINTAGES) {
      const irrs: number[] = [];
      for (let k = 0; k < 30; k++) {
        const seed = 50000 + si * 10000 + (v - VINTAGE_MIN) * 300 + k * 7;
        const rand = mulberry32(seed);
        const skill = normal(rand);
        const startQ = v * 4 + Math.floor(rand() * 4);
        if (startQ > LATEST_Q - 2) continue;
        const irr = irrOf(simulate(s.id, startQ, 50, skill, seed + 1));
        if (irr !== null) irrs.push(irr);
      }
      out[s.id].set(v, toBand(v, irrs));
      pooled.set(v, [...(pooled.get(v) ?? []), ...irrs]);
    }
  });
  for (const v of VINTAGES) out.all.set(v, toBand(v, pooled.get(v) ?? []));
  return out;
})();

export type Quartile = 1 | 2 | 3 | 4;

export function quartileOf(irr: number | null, band: PeerBand): Quartile {
  if (irr === null) return 4;
  if (irr >= band.upper) return 1;
  if (irr >= band.median) return 2;
  if (irr >= band.lower) return 3;
  return 4;
}

/* --- the programme ------------------------------------------------------- */

export interface StatementRow {
  q: number;
  call: number;
  dist: number;
  nav: number;
  paidIn: number;
  distributed: number;
  cumNet: number;
  tvpi: number;
  /** Since-inception net IRR; null in the first year, where it is not meaningful. */
  irr: number | null;
}

export interface Fund {
  id: string;
  name: string;
  gp: string;
  strategy: StrategyId;
  vintage: number;
  commitment: number;
  firstQ: number;
  flows: Flow[];
  statement: StatementRow[];
  paidIn: number;
  distributed: number;
  nav: number;
  unfunded: number;
  dpi: number;
  rvpi: number;
  tvpi: number;
  irr: number | null;
  peer: PeerBand;
  quartile: Quartile;
  /** Projected calls: HORIZON × PATHS, index h * PATHS + path. */
  proj: Float64Array;
}

const DEFS: [string, string, StrategyId, number, number, number][] = [
  ["Halvorsen Buyout Fund IV", "Halvorsen Partners", "buyout", 2014, 60, 0.6],
  ["Kiln Lane Ventures V", "Kiln Lane Capital", "venture", 2015, 25, 0.2],
  ["Wexcombe Real Estate Partners VI", "Wexcombe Property", "realestate", 2015, 45, -0.4],
  ["Tessary Equity Partners V", "Tessary", "buyout", 2016, 75, 0.2],
  ["Meridale Infrastructure III", "Meridale Asset Management", "infra", 2016, 70, 0.3],
  ["Brightcastle Growth Equity III", "Brightcastle", "growth", 2017, 40, -0.8],
  ["Marlowe Quince Capital III", "Marlowe Quince", "buyout", 2018, 50, -0.9],
  ["Seedwell Ventures III", "Seedwell", "venture", 2018, 20, -1.2],
  ["Ashcombe Value-Add Property III", "Ashcombe", "realestate", 2018, 40, 0.1],
  ["Ardent Capital Partners VII", "Ardent Capital", "buyout", 2019, 80, 1.1],
  ["Saltmarsh Core Infrastructure II", "Saltmarsh", "infra", 2019, 60, -0.2],
  ["Aldersey Direct Lending III", "Aldersey Credit", "credit", 2019, 60, 0.5],
  ["Corvane Growth Partners II", "Corvane", "growth", 2020, 45, 0.4],
  ["Quillon Venture Partners VIII", "Quillon", "venture", 2020, 30, 0.2],
  ["Pellham Buyout Fund X", "Pellham", "buyout", 2021, 90, -0.3],
  ["Caldwater Senior Credit II", "Caldwater", "credit", 2021, 50, 0],
  ["Lumenfield Growth IV", "Lumenfield", "growth", 2022, 50, -0.5],
  ["Orrery Ventures II", "Orrery", "venture", 2023, 25, 0.8],
  ["Harrowgate Logistics Property II", "Harrowgate", "realestate", 2022, 35, 0.6],
  ["Ardent Capital Partners VIII", "Ardent Capital", "buyout", 2023, 100, 0.5],
  ["Stonecroft Infrastructure IV", "Stonecroft", "infra", 2024, 80, 0],
  ["Redmere Mezzanine Partners V", "Redmere", "credit", 2024, 40, 0.3],
];

const DEAL_PACE = (() => {
  const rand = mulberry32(424242);
  return Float64Array.from({ length: HORIZON * PATHS }, () => normal(rand));
})();

function buildFund(
  [name, gp, strategy, vintage, commitment, skill]: (typeof DEFS)[number],
  i: number,
): Fund {
  const firstQ = vintage * 4 + Math.floor(mulberry32(1000 + i * 17)() * 3);
  const flows = simulate(strategy, firstQ, commitment, skill, 7000 + i * 131);

  let paidIn = 0;
  let distributed = 0;
  const statement: StatementRow[] = flows.map((f, k) => {
    paidIn += f.call;
    distributed += f.dist;
    return {
      ...f,
      paidIn,
      distributed,
      cumNet: distributed - paidIn,
      tvpi: (distributed + f.nav) / paidIn,
      irr: k < 4 ? null : irrOf(flows, k),
    };
  });
  const nav = flows[flows.length - 1].nav;
  const irr = irrOf(flows);
  const peer = PEERS[strategy].get(vintage)!;

  // Forward calls: PATHS seeded paths over the next HORIZON quarters. Each
  // path shares a market-wide deal-pace shock with every other fund, so the
  // programme's band doesn't diversify away to nothing.
  const p = PROFILE[strategy];
  const rand = mulberry32(9000 + i * 97);
  const proj = new Float64Array(HORIZON * PATHS);
  for (let path = 0; path < PATHS; path++) {
    let unfunded = commitment - paidIn;
    for (let h = 0; h < HORIZON; h++) {
      const age = (LATEST_Q + 1 + h - firstQ) / 4;
      const z = 0.7 * DEAL_PACE[h * PATHS + path] + 0.71 * normal(rand);
      const { call } = quarterCall(p, commitment, unfunded, age, z);
      unfunded -= call;
      proj[h * PATHS + path] = call;
    }
  }

  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    gp,
    strategy,
    vintage,
    commitment,
    firstQ,
    flows,
    statement,
    paidIn,
    distributed,
    nav,
    unfunded: commitment - paidIn,
    dpi: distributed / paidIn,
    rvpi: nav / paidIn,
    tvpi: (distributed + nav) / paidIn,
    irr,
    peer,
    quartile: quartileOf(irr, peer),
    proj,
  };
}

export const FUNDS: Fund[] = DEFS.map(buildFund);

/* --- aggregation --------------------------------------------------------- */

export interface SeriesPoint {
  q: number;
  call: number;
  dist: number;
  net: number;
  cum: number;
  nav: number;
}

export interface Aggregate {
  commitment: number;
  paidIn: number;
  distributed: number;
  nav: number;
  navPrev: number;
  unfunded: number;
  callsLast: number;
  distLast: number;
  dpi: number;
  rvpi: number;
  tvpi: number;
  irr: number | null;
  pme: number | null;
  firstQ: number;
  series: SeriesPoint[];
  trough: { q: number; value: number };
  breakeven: number | null;
  proj: { q: number; p25: number; mean: number; p75: number }[];
  projTotal: { p25: number; mean: number; p75: number };
}

/** Pools the funds' dated flows. For one fund this reproduces its own figures. */
export function aggregate(funds: Fund[]): Aggregate | null {
  if (funds.length === 0) return null;
  const firstQ = Math.min(...funds.map((f) => f.firstQ));
  const n = LATEST_Q - firstQ + 1;
  const call = new Array<number>(n).fill(0);
  const dist = new Array<number>(n).fill(0);
  const nav = new Array<number>(n).fill(0);
  for (const f of funds) {
    for (const fl of f.flows) {
      const k = fl.q - firstQ;
      call[k] += fl.call;
      dist[k] += fl.dist;
      nav[k] += fl.nav;
    }
  }

  let cum = 0;
  let trough = { q: firstQ, value: 0 };
  const series: SeriesPoint[] = [];
  const dates: number[] = [];
  const amts: number[] = [];
  let pmeDist = 0;
  let pmeCall = 0;
  const indexT = indexAt(LATEST_Q);
  for (let k = 0; k < n; k++) {
    const q = firstQ + k;
    const net = dist[k] - call[k];
    cum += net;
    if (cum < trough.value) trough = { q, value: cum };
    series.push({ q, call: call[k], dist: dist[k], net, cum, nav: nav[k] });
    dates.push(qEndMs(q));
    amts.push(net);
    const grow = indexT / indexAt(q);
    pmeDist += dist[k] * grow;
    pmeCall += call[k] * grow;
  }
  amts[n - 1] += nav[n - 1];

  let breakeven: number | null = null;
  for (const s of series) {
    if (s.q > trough.q && s.cum >= 0) {
      breakeven = s.q;
      break;
    }
  }

  const sum = (key: "paidIn" | "distributed" | "nav" | "commitment") =>
    funds.reduce((s, f) => s + f[key], 0);
  const paidIn = sum("paidIn");
  const distributed = sum("distributed");
  const navT = sum("nav");
  const commitment = sum("commitment");

  // Projection: sum the funds path by path, then take quantiles of the sums.
  const proj: Aggregate["proj"] = [];
  const totals = new Float64Array(PATHS);
  for (let h = 0; h < HORIZON; h++) {
    const qs = new Float64Array(PATHS);
    for (const f of funds) {
      for (let p = 0; p < PATHS; p++) qs[p] += f.proj[h * PATHS + p];
    }
    let mean = 0;
    for (let p = 0; p < PATHS; p++) {
      mean += qs[p];
      totals[p] += qs[p];
    }
    qs.sort();
    proj.push({
      q: LATEST_Q + 1 + h,
      p25: quantile(qs, 0.25),
      mean: mean / PATHS,
      p75: quantile(qs, 0.75),
    });
  }
  const totalMean = totals.reduce((s, v) => s + v, 0) / PATHS;
  totals.sort();

  return {
    commitment,
    paidIn,
    distributed,
    nav: navT,
    navPrev: n > 1 ? nav[n - 2] : 0,
    unfunded: commitment - paidIn,
    callsLast: call[n - 1],
    distLast: dist[n - 1],
    dpi: distributed / paidIn,
    rvpi: navT / paidIn,
    tvpi: (distributed + navT) / paidIn,
    irr: xirr(dates, amts),
    pme: pmeCall > 0 ? (pmeDist + navT) / pmeCall : null,
    firstQ,
    series,
    trough,
    breakeven,
    proj,
    projTotal: {
      p25: quantile(totals, 0.25),
      mean: totalMean,
      p75: quantile(totals, 0.75),
    },
  };
}

/* --- formatting ------------------------------------------------------------ */

const NF = new Map<number, Intl.NumberFormat>();
function nf(v: number, dp: number) {
  let f = NF.get(dp);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });
    NF.set(dp, f);
  }
  return f.format(v);
}

export const MINUS = "−";

/** Compact sterling from £m: £1.17bn, £412m, £38.4m. */
export function gbp(m: number, dp?: number, signed = false) {
  const a = Math.abs(m);
  const sign = m < 0 ? MINUS : signed && m > 0 ? "+" : "";
  if (a >= 1000) return `${sign}£${nf(a / 1000, 2)}bn`;
  return `${sign}£${nf(a, dp ?? (a >= 100 ? 0 : 1))}m`;
}

/** Plain £m figure for table columns (header carries the unit). */
export function num(m: number, dp = 1) {
  const s = nf(Math.abs(m), dp);
  return m < 0 && Math.abs(m) >= 0.5 * Math.pow(10, -dp) ? `${MINUS}${s}` : s;
}

export const mult = (x: number) => `${nf(x, 2)}×`;

export function pct(x: number | null, dp = 1, signed = false) {
  if (x === null || !Number.isFinite(x)) return "n.m.";
  const v = Math.abs(x * 100) < 0.5 * Math.pow(10, -dp) ? 0 : x * 100;
  const sign = v < 0 ? MINUS : signed && v > 0 ? "+" : "";
  return `${sign}${nf(Math.abs(v), dp)}%`;
}

export function pp(x: number, dp = 1) {
  const v = x * 100;
  return `${v < 0 ? MINUS : "+"}${nf(Math.abs(v), dp)}pp`;
}
