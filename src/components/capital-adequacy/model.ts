/* Capital Adequacy: deterministic mock data and every derivation.
 *
 * The raw data is quarterly amounts per legal entity: CET1 capital (built up
 * from quarterly flows so the bridge reconciles by construction), AT1, T2,
 * RWAs by business line x risk type, leverage exposure, HQLA and net cash
 * outflows, and available/required stable funding. Nothing below stores a
 * ratio: every ratio, headroom and bridge bar is derived from the amounts.
 *
 * The group is the sum of its three subsidiaries. Foreign-currency books are
 * held in "local" terms and translated at each quarter's FX index, so the
 * bridge can split RWA growth into underlying and FX.
 */

export type EntityId = "grp" | "rfb" | "nrfb" | "eu";
type SubId = Exclude<EntityId, "grp">;
export type Basis = "transitional" | "fully";
export type CompareMode = "qoq" | "yoy";
export type RiskType = "credit" | "ccr" | "cva" | "market" | "op";
export type LeafId =
  | "mortgages"
  | "cards"
  | "sme"
  | "midcorp"
  | "cibLending"
  | "cibMarkets"
  | "wealth"
  | "central";
export type RatioKey = "cet1" | "t1" | "tc" | "lev" | "lcr" | "nsfr";
export type SegKey = "p1" | "p2a" | "ccb" | "ccyb" | "sys";

/* --- calendar ------------------------------------------------------------ */

export const QUARTERS = [
  { label: "Q3 2024", short: "Q3 24", date: "30 Sep 2024" },
  { label: "Q4 2024", short: "Q4 24", date: "31 Dec 2024" },
  { label: "Q1 2025", short: "Q1 25", date: "31 Mar 2025" },
  { label: "Q2 2025", short: "Q2 25", date: "30 Jun 2025" },
  { label: "Q3 2025", short: "Q3 25", date: "30 Sep 2025" },
  { label: "Q4 2025", short: "Q4 25", date: "31 Dec 2025" },
  { label: "Q1 2026", short: "Q1 26", date: "31 Mar 2026" },
  { label: "Q2 2026", short: "Q2 26", date: "30 Jun 2026" },
] as const;
export const LATEST_Q = QUARTERS.length - 1;
const NQ = QUARTERS.length;

/** Quarter index of the comparison period, or null when it precedes history. */
export function compareIndex(reportQ: number, mode: CompareMode): number | null {
  const q = reportQ - (mode === "qoq" ? 1 : 4);
  return q >= 0 ? q : null;
}

/** Label of the comparison quarter even when it has no data (for messages). */
export function compareLabel(reportQ: number, mode: CompareMode): string {
  const q = reportQ - (mode === "qoq" ? 1 : 4);
  if (q >= 0) return QUARTERS[q].label;
  // Walk back from Q3 2024 for the empty-state copy.
  const quarter = ((2 + q) % 4 + 4) % 4; // 0-based quarter-of-year: Q3 = 2
  const year = 2024 + Math.floor((2 + q) / 4);
  return `Q${quarter + 1} ${year}`;
}

/* --- reference lists ----------------------------------------------------- */

export const ENTITIES: {
  id: EntityId;
  label: string;
  legal: string;
  parts: SubId[];
}[] = [
  { id: "grp", label: "Group consolidated", legal: "Pelham Bridge Group plc", parts: ["rfb", "nrfb", "eu"] },
  { id: "rfb", label: "Ring-fenced bank", legal: "Pelham Bridge Bank UK plc", parts: ["rfb"] },
  { id: "nrfb", label: "Non-ring-fenced bank", legal: "Pelham Bridge Markets plc", parts: ["nrfb"] },
  { id: "eu", label: "EU subsidiary", legal: "Pelham Bridge Europe AG", parts: ["eu"] },
];

export const RISK_TYPES: { id: RiskType; label: string; short: string }[] = [
  { id: "credit", label: "Credit", short: "Credit" },
  { id: "ccr", label: "Counterparty credit", short: "CCR" },
  { id: "cva", label: "CVA", short: "CVA" },
  { id: "market", label: "Market", short: "Market" },
  { id: "op", label: "Operational", short: "Op" },
];
const CREDIT_LIKE: RiskType[] = ["credit", "ccr", "cva"];
const MKT_OP: RiskType[] = ["market", "op"];

export const LEAVES: { id: LeafId; label: string }[] = [
  { id: "mortgages", label: "Mortgages" },
  { id: "cards", label: "Cards & loans" },
  { id: "sme", label: "SME" },
  { id: "midcorp", label: "Mid-corporate" },
  { id: "cibLending", label: "Lending" },
  { id: "cibMarkets", label: "Markets" },
  { id: "wealth", label: "Wealth" },
  { id: "central", label: "Central items" },
];

export const BUSINESS_GROUPS: { id: string; label: string; leaves: LeafId[] }[] = [
  { id: "retail", label: "Retail", leaves: ["mortgages", "cards"] },
  { id: "commercial", label: "Commercial", leaves: ["sme", "midcorp"] },
  { id: "cib", label: "CIB", leaves: ["cibLending", "cibMarkets"] },
  { id: "wealth", label: "Wealth", leaves: ["wealth"] },
  { id: "central", label: "Central items", leaves: ["central"] },
];

/* --- PRNG ---------------------------------------------------------------- */

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand: () => number) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* --- raw specification --------------------------------------------------- */

/** Foreign-currency index: value of the non-sterling basket in GBP (Q3 24 = 1). */
const FX = [1, 1.018, 1.006, 0.982, 0.991, 1.012, 1.024, 1.009];

interface LeafSpec {
  exposure: number; // £bn at Q3 2024, local terms
  rwa: Partial<Record<RiskType, number>>;
  drift: number; // quarterly credit RWA drift
  vol: number; // quarterly credit RWA volatility
}

interface SubSpec {
  seed: number;
  fxShare: number; // share of RWAs/exposure in foreign currency
  capFxShare: number; // share of CET1 in foreign currency (after hedging)
  cet1Start: number;
  at1: number[];
  t2: number[];
  relief: [number, number]; // IFRS 9 transitional add-back, first -> last quarter
  pat: [number, number]; // mean, vol per quarter
  buybackShare: number;
  other: [number, number];
  levMult: number; // leverage exposure per £ of EAD (derivatives, SFTs, off-B/S)
  cbExclusion: number; // share of central items excluded (central bank claims)
  hqla: number;
  nco: number;
  asf: number;
  rsf: number;
  leaves: Partial<Record<LeafId, LeafSpec>>;
}

const SUBS: Record<SubId, SubSpec> = {
  rfb: {
    seed: 11,
    fxShare: 0.02,
    capFxShare: 0.01,
    cet1Start: 22.75,
    at1: [3.1, 3.1, 3.1, 3.1, 3.1, 3.1, 3.1, 3.1],
    t2: [4.4, 4.35, 4.3, 4.25, 4.2, 4.15, 4.85, 4.8],
    relief: [0.78, 0.24],
    pat: [1.02, 0.07],
    buybackShare: 0.62,
    other: [-0.07, 0.04],
    levMult: 1.03,
    cbExclusion: 0.62,
    hqla: 127,
    nco: 82,
    asf: 468,
    rsf: 341,
    leaves: {
      mortgages: { exposure: 318, rwa: { credit: 52.0, op: 6.5 }, drift: 0.008, vol: 0.005 },
      cards: { exposure: 46, rwa: { credit: 26.0, op: 5.2 }, drift: 0.014, vol: 0.01 },
      sme: { exposure: 36, rwa: { credit: 17.5, ccr: 0.2, op: 2.4 }, drift: 0.004, vol: 0.01 },
      midcorp: { exposure: 54, rwa: { credit: 30.5, ccr: 0.8, cva: 0.2, op: 3.1 }, drift: 0.01, vol: 0.011 },
      wealth: { exposure: 21, rwa: { credit: 5.2, op: 1.1 }, drift: 0.008, vol: 0.008 },
      central: { exposure: 92, rwa: { credit: 7.8, ccr: 1.1, cva: 0.3, market: 1.2, op: 0.9 }, drift: 0, vol: 0.025 },
    },
  },
  nrfb: {
    seed: 23,
    fxShare: 0.45,
    capFxShare: 0.3,
    cet1Start: 16.2,
    at1: [2.4, 2.4, 2.4, 2.4, 3.15, 3.15, 3.15, 3.15],
    t2: [3.2, 3.2, 2.7, 2.7, 3.3, 3.3, 3.25, 3.25],
    relief: [0.26, 0.08],
    pat: [0.6, 0.12],
    buybackShare: 0.38,
    other: [-0.03, 0.07],
    levMult: 1.4,
    cbExclusion: 0.4,
    hqla: 74,
    nco: 51,
    asf: 231,
    rsf: 179,
    leaves: {
      midcorp: { exposure: 14, rwa: { credit: 8.2, ccr: 0.4, cva: 0.1, op: 0.9 }, drift: 0.01, vol: 0.012 },
      cibLending: { exposure: 78, rwa: { credit: 34.0, ccr: 1.2, cva: 0.4, op: 3.8 }, drift: 0.012, vol: 0.014 },
      cibMarkets: { exposure: 152, rwa: { credit: 4.5, ccr: 15.5, cva: 4.2, market: 19.5, op: 6.8 }, drift: 0.004, vol: 0.035 },
      wealth: { exposure: 18, rwa: { credit: 4.1, ccr: 0.2, op: 1.0 }, drift: 0.008, vol: 0.009 },
      central: { exposure: 36, rwa: { credit: 3.8, ccr: 0.6, cva: 0.2, market: 1.5, op: 0.6 }, drift: 0, vol: 0.03 },
    },
  },
  eu: {
    seed: 37,
    fxShare: 1,
    capFxShare: 1,
    cet1Start: 4.5,
    at1: [0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55],
    t2: [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75],
    relief: [0.05, 0.015],
    pat: [0.1, 0.025],
    buybackShare: 0,
    other: [-0.01, 0.01],
    levMult: 1.2,
    cbExclusion: 0,
    hqla: 13.4,
    nco: 8.6,
    asf: 60,
    rsf: 45,
    leaves: {
      cibLending: { exposure: 28, rwa: { credit: 11.2, ccr: 0.3, cva: 0.1, op: 1.1 }, drift: 0.013, vol: 0.015 },
      cibMarkets: { exposure: 41, rwa: { credit: 1.2, ccr: 3.8, cva: 1.1, market: 4.4, op: 1.6 }, drift: 0.005, vol: 0.035 },
      wealth: { exposure: 7, rwa: { credit: 1.9, op: 0.4 }, drift: 0.009, vol: 0.01 },
      central: { exposure: 9, rwa: { credit: 1.0, ccr: 0.1, market: 0.3, op: 0.2 }, drift: 0, vol: 0.03 },
    },
  },
};

/** Group buyback announced at the half-year and full-year results (£bn). */
const BUYBACK = [0, 1.25, 0, 0.9, 0, 1.5, 0, 1.05];

/** Deterministic one-off RWA moves layered on the random walks. */
const SHOCKS: { q: number; leaf: LeafId; risk: RiskType; mult: number }[] = [
  { q: 7, leaf: "cibMarkets", risk: "market", mult: 1.12 },
  { q: 7, leaf: "midcorp", risk: "credit", mult: 1.03 },
  { q: 7, leaf: "cards", risk: "credit", mult: 1.025 },
  { q: 4, leaf: "cibMarkets", risk: "ccr", mult: 0.9 },
  { q: 3, leaf: "mortgages", risk: "credit", mult: 0.97 }, // model recalibration
];

/* --- raw generation ------------------------------------------------------ */

type RiskRec = Record<RiskType, number>;
const zeroRisk = (): RiskRec => ({ credit: 0, ccr: 0, cva: 0, market: 0, op: 0 });

interface CapitalFlows {
  pat: number;
  div: number;
  buyback: number;
  other: number;
  fx: number;
}

interface SubRaw {
  /** Local-terms RWA per quarter / leaf / risk type. */
  rwa: Record<LeafId, RiskRec>[];
  exposure: Record<LeafId, number>[];
  cet1: number[]; // fully loaded, GBP
  flows: CapitalFlows[]; // flows[q] moves cet1[q-1] -> cet1[q]
  relief: number[];
  at1: number[];
  t2: number[];
  hqla: number[];
  nco: number[];
  asf: number[];
  rsf: number[];
}

function fxFactor(sub: SubId, q: number) {
  const f = SUBS[sub].fxShare;
  return 1 - f + f * FX[q];
}
function capFxFactor(sub: SubId, q: number) {
  const f = SUBS[sub].capFxShare;
  return 1 - f + f * FX[q];
}

function buildSub(id: SubId): SubRaw {
  const spec = SUBS[id];
  const rand = mulberry32(spec.seed * 7919 + 17);
  const n = () => gauss(rand);

  const rwa: Record<LeafId, RiskRec>[] = [];
  const exposure: Record<LeafId, number>[] = [];
  for (let q = 0; q < NQ; q++) {
    const r = {} as Record<LeafId, RiskRec>;
    const e = {} as Record<LeafId, number>;
    for (const { id: leaf } of LEAVES) {
      const ls = spec.leaves[leaf];
      r[leaf] = zeroRisk();
      e[leaf] = 0;
      if (!ls) continue;
      if (q === 0) {
        for (const rt of RISK_TYPES) r[leaf][rt.id] = ls.rwa[rt.id] ?? 0;
        e[leaf] = ls.exposure;
        continue;
      }
      const prev = rwa[q - 1][leaf];
      const creditStep = ls.drift + ls.vol * n();
      for (const { id: rt } of RISK_TYPES) {
        if (!prev[rt]) continue;
        let step: number;
        if (rt === "credit") step = creditStep;
        else if (rt === "op") step = q % 4 === 2 ? 0.035 + 0.01 * n() : 0; // annual Q1 recalibration
        else if (rt === "market") step = 0.005 + 0.07 * n();
        else if (rt === "ccr") step = 0.005 + 0.045 * n();
        else step = 0.06 * n();
        let v = prev[rt] * (1 + step);
        for (const s of SHOCKS) if (s.q === q && s.leaf === leaf && s.risk === rt) v *= s.mult;
        r[leaf][rt] = v;
      }
      const expStep =
        leaf === "cibMarkets" || leaf === "central"
          ? 0.004 + 0.03 * n()
          : creditStep - 0.0015 + 0.004 * n();
      e[leaf] = exposure[q - 1][leaf] * (1 + expStep);
    }
    rwa.push(r);
    exposure.push(e);
  }

  const cet1: number[] = [spec.cet1Start];
  const flows: CapitalFlows[] = [{ pat: 0, div: 0, buyback: 0, other: 0, fx: 0 }];
  for (let q = 1; q < NQ; q++) {
    // Q4 2025: conduct remediation provision in the ring-fenced bank.
    const conduct = id === "rfb" && q === 5 ? -0.38 : 0;
    const pat = Math.max(0.01, spec.pat[0] + spec.pat[1] * n() + conduct);
    const div = -0.4 * pat;
    const buyback = -BUYBACK[q] * spec.buybackShare;
    const other = spec.other[0] + spec.other[1] * n();
    const fx = spec.capFxShare * cet1[q - 1] * (FX[q] / FX[q - 1] - 1);
    flows.push({ pat, div, buyback, other, fx });
    cet1.push(cet1[q - 1] + pat + div + buyback + other + fx);
  }

  const relief = QUARTERS.map(
    (_, q) => spec.relief[0] + ((spec.relief[1] - spec.relief[0]) * q) / (NQ - 1),
  );
  const at1 = spec.at1.map((v, q) => v * capFxFactor(id, q));
  const t2 = spec.t2.map((v, q) => v * capFxFactor(id, q));

  const walk = (start: number, drift: number, vol: number) => {
    const out = [start];
    for (let q = 1; q < NQ; q++) out.push(out[q - 1] * (1 + drift + vol * n()));
    return out;
  };
  const hqla = walk(spec.hqla, 0.004, 0.018);
  const nco = walk(spec.nco, 0.007, 0.012);
  const asf = walk(spec.asf, 0.006, 0.008);
  const rsf = walk(spec.rsf, 0.008, 0.008);

  return { rwa, exposure, cet1, flows, relief, at1, t2, hqla, nco, asf, rsf };
}

const RAW: Record<SubId, SubRaw> = {
  rfb: buildSub("rfb"),
  nrfb: buildSub("nrfb"),
  eu: buildSub("eu"),
};

/* --- requirements -------------------------------------------------------- */

interface EntityReq {
  p2a: number; // total Pillar 2A, % of RWA
  ccyb: number; // institution-specific countercyclical buffer rate
  sys: number; // O-SII / systemic buffer
  levMin: number;
  levBuffers: boolean; // UK leverage buffers apply
  target: Record<RatioKey, number>;
}

const REQ: Record<EntityId, EntityReq> = {
  grp: { p2a: 2.4, ccyb: 1.6, sys: 1.0, levMin: 3.25, levBuffers: true, target: { cet1: 13.5, t1: 15.0, tc: 18.0, lev: 4.5, lcr: 130, nsfr: 120 } },
  rfb: { p2a: 1.9, ccyb: 2.0, sys: 1.0, levMin: 3.25, levBuffers: true, target: { cet1: 13.5, t1: 15.0, tc: 18.0, lev: 4.6, lcr: 130, nsfr: 120 } },
  nrfb: { p2a: 3.2, ccyb: 1.3, sys: 0, levMin: 3.25, levBuffers: true, target: { cet1: 13.0, t1: 14.75, tc: 17.5, lev: 4.5, lcr: 130, nsfr: 115 } },
  eu: { p2a: 2.25, ccyb: 0.8, sys: 0.5, levMin: 3.0, levBuffers: false, target: { cet1: 12.5, t1: 14.0, tc: 16.5, lev: 4.0, lcr: 125, nsfr: 115 } },
};

export const SEG_LABEL: Record<SegKey, string> = {
  p1: "Pillar 1 minimum",
  p2a: "Pillar 2A",
  ccb: "Capital conservation buffer",
  ccyb: "Countercyclical buffer",
  sys: "O-SII buffer",
};

export interface StackSeg {
  key: SegKey;
  label: string;
  value: number;
}

export interface RatioDef {
  key: RatioKey;
  label: string;
  group: "capital" | "leverage" | "liquidity";
  stack: StackSeg[];
  requirement: number;
  reqLabel: string; // "MDA", "Min + buffers", "Minimum"
  target: number;
  headroomUnit: "bps" | "pp";
}

export function ratioDefs(entity: EntityId): RatioDef[] {
  const r = REQ[entity];
  const buffers = (): StackSeg[] =>
    [
      { key: "ccb" as const, label: SEG_LABEL.ccb, value: 2.5 },
      { key: "ccyb" as const, label: SEG_LABEL.ccyb, value: r.ccyb },
      { key: "sys" as const, label: SEG_LABEL.sys, value: r.sys },
    ].filter((s) => s.value > 0);
  const capital = (
    key: RatioKey,
    label: string,
    p1: number,
    p2aShare: number,
  ): RatioDef => {
    const stack: StackSeg[] = [
      { key: "p1", label: SEG_LABEL.p1, value: p1 },
      { key: "p2a", label: `Pillar 2A (${p2aShare * 100}% of ${r.p2a.toFixed(2)}%)`, value: r.p2a * p2aShare },
      ...buffers(),
    ];
    return {
      key,
      label,
      group: "capital",
      stack,
      requirement: stack.reduce((a, s) => a + s.value, 0),
      reqLabel: "MDA",
      target: r.target[key],
      headroomUnit: "bps",
    };
  };
  const levStack: StackSeg[] = [
    { key: "p1" as const, label: "Leverage ratio minimum", value: r.levMin },
    ...(r.levBuffers
      ? [
          { key: "ccyb" as const, label: "Countercyclical leverage buffer (35% of CCyB)", value: 0.35 * r.ccyb },
          { key: "sys" as const, label: "Additional leverage ratio buffer (35% of O-SII)", value: 0.35 * r.sys },
        ]
      : []),
  ].filter((s) => s.value > 0);
  const liq = (key: RatioKey, label: string): RatioDef => ({
    key,
    label,
    group: "liquidity",
    stack: [{ key: "p1", label: "Regulatory minimum", value: 100 }],
    requirement: 100,
    reqLabel: "Minimum",
    target: r.target[key],
    headroomUnit: "pp",
  });
  return [
    capital("cet1", "CET1 ratio", 4.5, 0.5625),
    capital("t1", "Tier 1 ratio", 6, 0.75),
    capital("tc", "Total capital ratio", 8, 1),
    {
      key: "lev",
      label: "Leverage ratio",
      group: "leverage",
      stack: levStack,
      requirement: levStack.reduce((a, s) => a + s.value, 0),
      reqLabel: r.levBuffers ? "Min + buffers" : "Minimum",
      target: r.target.lev,
      headroomUnit: "bps",
    },
    liq("lcr", "Liquidity coverage ratio"),
    liq("nsfr", "Net stable funding ratio"),
  ];
}

/* --- snapshots ----------------------------------------------------------- */

export interface LeafValues {
  exposure: number;
  rwa: RiskRec;
  total: number;
}

export interface Snapshot {
  q: number;
  leaves: Record<LeafId, LeafValues>;
  present: Record<LeafId, boolean>;
  rwaByRisk: RiskRec;
  rwa: number;
  exposure: number;
  cet1: number;
  at1: number;
  t2: number;
  t1: number;
  tc: number;
  relief: number;
  levExposure: number;
  hqla: number;
  nco: number;
  asf: number;
  rsf: number;
  ratio: Record<RatioKey, number>;
}

const partsOf = (entity: EntityId) => ENTITIES.find((e) => e.id === entity)!.parts;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** RWA by risk type for the entity at quarter q, translated at quarter fxQ's rates. */
function rwaByRiskAt(entity: EntityId, q: number, fxQ: number): RiskRec {
  const out = zeroRisk();
  for (const sub of partsOf(entity)) {
    const k = fxFactor(sub, fxQ);
    for (const { id: leaf } of LEAVES)
      for (const { id: rt } of RISK_TYPES) out[rt] += RAW[sub].rwa[q][leaf][rt] * k;
  }
  return out;
}

const cache = new Map<string, Snapshot>();

export function snapshot(entity: EntityId, basis: Basis, q: number): Snapshot {
  const key = `${entity}|${basis}|${q}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const parts = partsOf(entity);
  const leaves = {} as Record<LeafId, LeafValues>;
  const present = {} as Record<LeafId, boolean>;
  for (const { id: leaf } of LEAVES) {
    const rwa = zeroRisk();
    let exposure = 0;
    for (const sub of parts) {
      const k = fxFactor(sub, q);
      exposure += RAW[sub].exposure[q][leaf] * k;
      for (const { id: rt } of RISK_TYPES) rwa[rt] += RAW[sub].rwa[q][leaf][rt] * k;
    }
    const total = sum(Object.values(rwa));
    leaves[leaf] = { exposure, rwa, total };
    present[leaf] = exposure > 0;
  }
  const rwaByRisk = rwaByRiskAt(entity, q, q);
  const rwa = sum(Object.values(rwaByRisk));
  const exposure = sum(LEAVES.map((l) => leaves[l.id].exposure));

  const relief = sum(parts.map((s) => RAW[s].relief[q]));
  const cet1 = sum(parts.map((s) => RAW[s].cet1[q])) + (basis === "transitional" ? relief : 0);
  const at1 = sum(parts.map((s) => RAW[s].at1[q]));
  const t2 = sum(parts.map((s) => RAW[s].t2[q]));
  const t1 = cet1 + at1;
  const tc = t1 + t2;

  const levExposure = sum(
    parts.map((s) => {
      const spec = SUBS[s];
      const k = fxFactor(s, q);
      const ead = sum(LEAVES.map((l) => RAW[s].exposure[q][l.id])) * k;
      const excluded = RAW[s].exposure[q].central * k * spec.cbExclusion;
      return ead * spec.levMult - excluded;
    }),
  );
  const hqla = sum(parts.map((s) => RAW[s].hqla[q]));
  const nco = sum(parts.map((s) => RAW[s].nco[q]));
  const asf = sum(parts.map((s) => RAW[s].asf[q]));
  const rsf = sum(parts.map((s) => RAW[s].rsf[q]));

  const snap: Snapshot = {
    q,
    leaves,
    present,
    rwaByRisk,
    rwa,
    exposure,
    cet1,
    at1,
    t2,
    t1,
    tc,
    relief,
    levExposure,
    hqla,
    nco,
    asf,
    rsf,
    ratio: {
      cet1: (cet1 / rwa) * 100,
      t1: (t1 / rwa) * 100,
      tc: (tc / rwa) * 100,
      lev: (t1 / levExposure) * 100,
      lcr: (hqla / nco) * 100,
      nsfr: (asf / rsf) * 100,
    },
  };
  cache.set(key, snap);
  return snap;
}

/** Headroom over the requirement in £bn: the capital or liquidity surplus. */
export function headroomBn(def: RatioDef, s: Snapshot): number {
  const over = (s.ratio[def.key] - def.requirement) / 100;
  switch (def.key) {
    case "cet1":
    case "t1":
    case "tc":
      return over * s.rwa;
    case "lev":
      return over * s.levExposure;
    case "lcr":
      return s.hqla - (s.nco * def.requirement) / 100;
    case "nsfr":
      return s.asf - (s.rsf * def.requirement) / 100;
  }
}

/* --- CET1 bridge --------------------------------------------------------- */

export type BridgeKey = "pat" | "div" | "buyback" | "rwaCredit" | "rwaMktOp" | "fx" | "other";

export interface BridgeItem {
  key: BridgeKey;
  label: string;
  bps: number;
  capital: number; // £bn CET1 movement (0 for RWA items)
  rwa: number; // £bn RWA movement (0 for capital-only items)
}

export interface Bridge {
  from: number;
  to: number;
  opening: number; // CET1 ratio %, comparison period
  closing: number;
  items: BridgeItem[];
  c0: number;
  c1: number;
  r0: number;
  r1: number;
}

export const BRIDGE_LABEL: Record<BridgeKey, string> = {
  pat: "Profit after tax",
  div: "Dividend accrual",
  buyback: "Share buyback",
  rwaCredit: "RWA growth (credit)",
  rwaMktOp: "RWA growth (market/op)",
  fx: "FX",
  other: "Intangibles & other deductions",
};

/* r1 - r0 = sum(dC_i) / R1 + C0 * (1/R1 - 1/R0)
 * Capital items are divided by closing RWAs; the RWA effect is apportioned by
 * driver as -C0 * dR_k / (R0 * R1). The bars therefore sum exactly. */
export function cet1Bridge(entity: EntityId, basis: Basis, from: number, to: number): Bridge {
  const s0 = snapshot(entity, basis, from);
  const s1 = snapshot(entity, basis, to);
  const parts = partsOf(entity);
  const cap = { pat: 0, div: 0, buyback: 0, other: 0, fx: 0 };
  for (const sub of parts)
    for (let q = from + 1; q <= to; q++) {
      const f = RAW[sub].flows[q];
      cap.pat += f.pat;
      cap.div += f.div;
      cap.buyback += f.buyback;
      cap.other += f.other;
      cap.fx += f.fx;
    }
  if (basis === "transitional") cap.other += s1.relief - s0.relief;

  const R0 = s0.rwa;
  const R1 = s1.rwa;
  const C0 = s0.cet1;
  const atOpenFx = rwaByRiskAt(entity, to, from);
  const dCredit = sum(CREDIT_LIKE.map((rt) => atOpenFx[rt] - s0.rwaByRisk[rt]));
  const dMktOp = sum(MKT_OP.map((rt) => atOpenFx[rt] - s0.rwaByRisk[rt]));
  const dFx = R1 - sum(Object.values(atOpenFx));
  const rwaBps = (dR: number) => ((-C0 * dR) / (R0 * R1)) * 10000;
  const capBps = (dC: number) => (dC / R1) * 10000;

  const items: BridgeItem[] = [
    { key: "pat", label: BRIDGE_LABEL.pat, bps: capBps(cap.pat), capital: cap.pat, rwa: 0 },
    { key: "div", label: BRIDGE_LABEL.div, bps: capBps(cap.div), capital: cap.div, rwa: 0 },
    { key: "buyback", label: BRIDGE_LABEL.buyback, bps: capBps(cap.buyback), capital: cap.buyback, rwa: 0 },
    { key: "rwaCredit", label: BRIDGE_LABEL.rwaCredit, bps: rwaBps(dCredit), capital: 0, rwa: dCredit },
    { key: "rwaMktOp", label: BRIDGE_LABEL.rwaMktOp, bps: rwaBps(dMktOp), capital: 0, rwa: dMktOp },
    { key: "fx", label: BRIDGE_LABEL.fx, bps: capBps(cap.fx) + rwaBps(dFx), capital: cap.fx, rwa: dFx },
    { key: "other", label: BRIDGE_LABEL.other, bps: capBps(cap.other), capital: cap.other, rwa: 0 },
  ];
  return {
    from,
    to,
    opening: s0.ratio.cet1,
    closing: s1.ratio.cet1,
    items,
    c0: C0,
    c1: s1.cet1,
    r0: R0,
    r1: R1,
  };
}
