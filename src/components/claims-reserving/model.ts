/* Claims & Reserving: seeded model.
 *
 * One P&C book, five lines of business, accident years 2016–2025 developed on
 * an annual grid (12…120 months). The latest diagonal is 31 Dec 2025; the
 * committee pack is valued at 30 Jun 2026. Every figure on the page derives
 * from the paid and incurred triangles generated here, so the KPIs, the
 * triangle, the dumbbell and the register always agree.
 *
 * Generation: an "intended" ultimate per AY (earned premium × loss ratio) is
 * spread over a development pattern one link at a time, with noise that
 * shrinks with age and a few deliberate calendar/accident-year effects:
 *   - Motor: claims inflation in calendar 2022–23 inflates every link booked
 *     in those years (a diagonal band on the triangle).
 *   - Liability: superimposed inflation from calendar 2023 lifts the late
 *     links, the classic long-tail deterioration.
 *   - Home: Storm Ivor (Nov 2023) and Storm Maren (Feb 2022) develop late.
 *   - Commercial property: the Harwell Mills fire (2021).
 *   - Marine: the MV Northern Tern grounding (2024).
 */

export type LobId = "motor" | "home" | "cprop" | "liab" | "marine";
export type TabId = "all" | LobId;
export type Basis = "paid" | "incurred";

export const AYS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const N = AYS.length;
export const AGES = AYS.map((_, j) => 12 * (j + 1));
export const FIRST_AY = AYS[0];
export const LAST_AY = AYS[N - 1];
/** Age index of the latest diagonal (31 Dec 2025) for AY index i. */
export const lastJ = (i: number) => N - 1 - i;

/* Validated colours (see brief). */
export const CAT = ["#4f46e5", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];
export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48", neutral: "#94a3b8" };
export const MUTED_SERIES = "#cbd5e1";
export const ACCENT = "#0d9488";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/* ------------------------------------------------------------------ */
/* PRNG                                                                */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
function gauss(r: Rng) {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------------ */
/* Lines of business                                                   */
/* ------------------------------------------------------------------ */

interface LobSpec {
  id: LobId;
  label: string;
  code: string;
  /** Earned premium £m per AY. */
  ep: number[];
  /** Intended ultimate loss ratio % per AY (before development effects). */
  lr: number[];
  /** Initial pick: the loss ratio selected at the AY's first year-end. */
  pick: number[];
  /** Expense ratio % per AY (before noise). */
  er: number[];
  /** Claims per 1,000 policies per AY. */
  freq: number[];
  /** Average written premium £ per policy per AY. */
  avgPrem: number[];
  /** Cumulative share of ultimate reached at 12…120 months. */
  pattern: Record<Basis, number[]>;
  planER: [number, number];
  planFreq: number;
  /** Per-risk excess-of-loss retention, £m. */
  retention: number;
}

const LOB_SPECS: LobSpec[] = [
  {
    id: "motor",
    label: "Motor",
    code: "MOT",
    ep: [420, 438, 452, 461, 447, 455, 492, 571, 634, 652],
    lr: [70.5, 69.0, 71.0, 68.0, 60.5, 69.0, 73.5, 76.0, 72.5, 73.0],
    pick: [72.5, 71.5, 72.5, 70.5, 64.0, 70.0, 74.0, 78.5, 77.0, 74.0],
    er: [24.6, 24.4, 24.8, 24.5, 26.9, 25.6, 24.9, 23.8, 23.5, 23.9],
    freq: [104, 102, 101, 99, 74, 88, 95, 97, 94, 92],
    avgPrem: [478, 486, 492, 498, 502, 497, 521, 588, 648, 662],
    pattern: {
      paid: [0.42, 0.7, 0.83, 0.905, 0.945, 0.97, 0.984, 0.992, 0.996, 0.998],
      incurred: [0.8, 0.93, 0.972, 0.988, 0.995, 0.998, 0.999, 1, 1, 1],
    },
    planER: [23.5, 25.5],
    planFreq: 96,
    retention: 1,
  },
  {
    id: "home",
    label: "Home",
    code: "HOM",
    ep: [255, 262, 270, 276, 284, 291, 302, 326, 348, 359],
    lr: [54.0, 57.0, 62.0, 55.0, 59.5, 53.0, 62.5, 78.0, 60.0, 57.5],
    pick: [56.0, 58.0, 61.0, 57.0, 58.0, 55.0, 61.0, 81.0, 61.0, 58.5],
    er: [31.2, 31.0, 30.8, 31.1, 31.6, 31.4, 30.9, 30.2, 30.4, 30.6],
    freq: [48, 50, 58, 49, 55, 47, 61, 79, 52, 50],
    avgPrem: [322, 326, 331, 334, 338, 341, 352, 377, 398, 405],
    pattern: {
      paid: [0.62, 0.89, 0.955, 0.982, 0.993, 0.997, 0.999, 1, 1, 1],
      incurred: [0.9, 0.975, 0.993, 0.998, 1, 1, 1, 1, 1, 1],
    },
    planER: [30, 32],
    planFreq: 52,
    retention: 1.5,
  },
  {
    id: "cprop",
    label: "Commercial property",
    code: "CPR",
    ep: [178, 186, 193, 199, 205, 216, 232, 249, 262, 270],
    lr: [57.0, 59.0, 56.0, 61.0, 58.0, 62.0, 60.0, 63.0, 62.0, 59.0],
    pick: [58.0, 58.0, 58.0, 59.0, 59.0, 62.0, 59.0, 61.0, 61.0, 59.0],
    er: [32.1, 32.0, 31.8, 31.9, 32.4, 32.2, 31.7, 31.5, 31.4, 31.6],
    freq: [72, 74, 70, 73, 71, 76, 72, 75, 73, 71],
    avgPrem: [3450, 3520, 3590, 3650, 3710, 3820, 4010, 4260, 4420, 4510],
    pattern: {
      paid: [0.38, 0.69, 0.84, 0.92, 0.96, 0.98, 0.99, 0.996, 0.999, 1],
      incurred: [0.72, 0.89, 0.95, 0.978, 0.99, 0.996, 0.998, 0.999, 1, 1],
    },
    planER: [31, 33],
    planFreq: 73,
    retention: 2.5,
  },
  {
    id: "liab",
    label: "Liability",
    code: "LIA",
    ep: [148, 154, 161, 166, 168, 177, 189, 204, 216, 223],
    lr: [69.0, 70.0, 71.0, 72.0, 70.0, 73.0, 74.0, 74.5, 74.0, 73.0],
    pick: [70.0, 70.0, 71.0, 71.0, 72.0, 72.0, 74.0, 76.0, 77.0, 76.5],
    er: [27.3, 27.1, 27.0, 26.8, 27.6, 27.2, 26.9, 26.5, 26.4, 26.6],
    freq: [49, 48, 48, 47, 41, 45, 46, 47, 46, 45],
    avgPrem: [2480, 2540, 2610, 2670, 2700, 2810, 2960, 3150, 3290, 3360],
    pattern: {
      paid: [0.07, 0.19, 0.33, 0.47, 0.6, 0.71, 0.8, 0.865, 0.915, 0.95],
      incurred: [0.3, 0.5, 0.645, 0.755, 0.835, 0.89, 0.93, 0.955, 0.972, 0.985],
    },
    planER: [25.5, 27.5],
    planFreq: 46,
    retention: 2,
  },
  {
    id: "marine",
    label: "Marine",
    code: "MAR",
    ep: [68, 71, 72, 74, 73, 78, 84, 90, 94, 96],
    lr: [66.0, 70.0, 63.0, 68.0, 60.0, 64.0, 67.0, 62.0, 68.0, 65.0],
    pick: [65.0, 66.0, 65.0, 66.0, 64.0, 63.0, 65.0, 64.0, 74.0, 65.0],
    er: [28.2, 28.0, 27.9, 28.1, 28.6, 28.3, 27.8, 27.5, 27.4, 27.6],
    freq: [118, 122, 115, 120, 104, 112, 116, 110, 121, 114],
    avgPrem: [13800, 14100, 14200, 14450, 14300, 15000, 15900, 16800, 17300, 17500],
    pattern: {
      paid: [0.3, 0.62, 0.8, 0.9, 0.95, 0.975, 0.988, 0.995, 0.998, 1],
      incurred: [0.66, 0.86, 0.94, 0.975, 0.99, 0.996, 0.999, 1, 1, 1],
    },
    planER: [27, 29],
    planFreq: 116,
    retention: 1.5,
  },
];

export const LOBS = LOB_SPECS.map((l) => ({ id: l.id, label: l.label, code: l.code }));
export const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All lines" },
  ...LOBS.map((l) => ({ id: l.id as TabId, label: l.label })),
];
export const LOB_LABEL: Record<LobId, string> = Object.fromEntries(
  LOB_SPECS.map((l) => [l.id, l.label]),
) as Record<LobId, string>;

/** Development effects beyond the base pattern: a multiplier on the link's increment. */
function effect(id: LobId, basis: Basis, ay: number, j: number, cy: number) {
  const inc = basis === "incurred";
  switch (id) {
    case "motor":
      return cy === 2022 || cy === 2023 ? (inc ? 1.6 : 1.22) : 1;
    case "home":
      if (ay === 2023 && j === 0) return inc ? 2.3 : 1.35;
      if (ay === 2022 && j === 0) return inc ? 1.6 : 1.2;
      if (ay === 2020 && j === 0) return inc ? 1.35 : 1.1;
      return 1;
    case "cprop":
      return ay === 2021 && j <= 1 ? (inc ? 1.6 : 1.2) : 1;
    case "liab":
      return cy >= 2023 && j >= 3 ? (inc ? 1.35 : 1.2) : 1;
    case "marine":
      return ay === 2024 && j === 0 ? (inc ? 1.7 : 1.2) : 1;
  }
}

interface TabData {
  tri: Record<Basis, number[][]>;
  tail: Record<Basis, number>;
  ep: number[];
  er: number[];
  policies: number[];
  claims: number[];
  pick: number[];
  planERlo: number[];
  planERhi: number[];
  planClaims: number[];
}

/** Shared shocks: paid and incurred see the same claims, so their noise is
 *  mostly common (z) with a small basis-specific part. */
interface Shocks {
  z0: number[];
  z: number[][];
}
function genShocks(r: Rng): Shocks {
  return {
    z0: AYS.map(() => gauss(r)),
    z: AYS.map(() => AGES.slice(0, N - 1).map(() => gauss(r))),
  };
}

function genTriangle(spec: LobSpec, basis: Basis, k: Shocks, r: Rng): number[][] {
  const p = spec.pattern[basis];
  const lt = spec.id === "liab";
  const paid = basis === "paid";
  return AYS.map((ay, i) => {
    const U = (spec.ep[i] * spec.lr[i]) / 100;
    const s0 = paid ? (lt ? 0.05 : 0.03) : lt ? 0.035 : 0.025;
    const z0 = 0.85 * k.z0[i] + 0.35 * gauss(r);
    const row = [U * p[0] * (1 + s0 * z0)];
    for (let j = 0; j < N - 1; j++) {
      const inc = p[j + 1] / p[j] - 1;
      const m = effect(spec.id, basis, ay, j, ay + j + 1);
      const sd = (paid ? 0.07 : 0.1) * inc + (paid ? 0.0006 : 0.0012);
      const z = 0.8 * k.z[i][j] + 0.45 * gauss(r);
      let f = 1 + inc * m + sd * z;
      f = paid ? Math.max(f, 1.0002) : Math.max(f, 0.994);
      row.push(row[j] * f);
    }
    return row;
  });
}

function tailFor(spec: LobSpec, basis: Basis) {
  const last = spec.pattern[basis][N - 1];
  return Math.round((1 / last) * 1000) / 1000;
}

const rng = mulberry32(20260630);

const LOB_DATA: Record<LobId, TabData> = Object.fromEntries(
  LOB_SPECS.map((spec) => {
    const shocks = genShocks(rng);
    const incurred = genTriangle(spec, "incurred", shocks, rng);
    const paidRaw = genTriangle(spec, "paid", shocks, rng);
    // Paid never runs ahead of incurred.
    const paid = paidRaw.map((row, i) => row.map((v, j) => Math.min(v, incurred[i][j] * 0.998)));
    const policies = spec.ep.map((ep, i) => (ep * 1e6) / spec.avgPrem[i]);
    const er = spec.er.map((e) => Math.round((e + 0.35 * gauss(rng)) * 10) / 10);
    const claims = policies.map((p, i) => (p * spec.freq[i] * (1 + 0.012 * gauss(rng))) / 1000);
    const data: TabData = {
      tri: { paid, incurred },
      tail: { paid: tailFor(spec, "paid"), incurred: tailFor(spec, "incurred") },
      ep: spec.ep,
      er,
      policies,
      claims,
      pick: spec.pick,
      planERlo: spec.ep.map(() => spec.planER[0]),
      planERhi: spec.ep.map(() => spec.planER[1]),
      planClaims: policies.map((p) => (p * spec.planFreq) / 1000),
    };
    return [spec.id, data];
  }),
) as Record<LobId, TabData>;

function sumTabs(): TabData {
  const all = LOB_SPECS.map((s) => LOB_DATA[s.id]);
  const sumArr = (pick: (d: TabData) => number[]) =>
    AYS.map((_, i) => all.reduce((a, d) => a + pick(d)[i], 0));
  const wAvg = (pick: (d: TabData) => number[]) =>
    AYS.map((_, i) => {
      const w = all.reduce((a, d) => a + d.ep[i], 0);
      return all.reduce((a, d) => a + pick(d)[i] * d.ep[i], 0) / w;
    });
  const sumTri = (b: Basis) =>
    AYS.map((_, i) => AGES.map((__, j) => all.reduce((a, d) => a + d.tri[b][i][j], 0)));
  const tri = { paid: sumTri("paid"), incurred: sumTri("incurred") };
  // Aggregate tail: each line's tail weighted by its oldest fully developed cell.
  const tail = (b: Basis) => {
    const w = all.reduce((a, d) => a + d.tri[b][0][N - 1], 0);
    const t = all.reduce((a, d) => a + d.tri[b][0][N - 1] * d.tail[b], 0) / w;
    return Math.round(t * 1000) / 1000;
  };
  return {
    tri,
    tail: { paid: tail("paid"), incurred: tail("incurred") },
    ep: sumArr((d) => d.ep),
    er: wAvg((d) => d.er),
    policies: sumArr((d) => d.policies),
    claims: sumArr((d) => d.claims),
    pick: wAvg((d) => d.pick),
    planERlo: wAvg((d) => d.planERlo),
    planERhi: wAvg((d) => d.planERhi),
    planClaims: sumArr((d) => d.planClaims),
  };
}

const TAB_DATA: Record<TabId, TabData> = { ...LOB_DATA, all: sumTabs() };

/* ------------------------------------------------------------------ */
/* Chain ladder                                                        */
/* ------------------------------------------------------------------ */

/** Selections are the volume-weighted average, lightly rounded. */
export function selectFactor(v: number) {
  return v - 1 >= 0.05 ? Math.round(v * 200) / 200 : Math.round(v * 1000) / 1000;
}

export interface ChainLadder {
  basis: Basis;
  /** [i][j] cumulative: known on/above the diagonal, projected below it. */
  cum: number[][];
  /** [i][j] observed link j→j+1, or null where not yet observed. */
  link: (number | null)[][];
  /** Volume-weighted average per link (N-1). */
  vwa: number[];
  /** AYs contributing to each link's average. */
  vwaN: number[];
  /** True where no AY in range had the link and all years were used. */
  fallback: boolean[];
  /** Selected factors: N-1 links plus the tail beyond 120 months. */
  sel: number[];
  /** Cumulative development factor from age j to ultimate. */
  cdf: number[];
  ult: number[];
  toDate: number[];
}

function chainLadder(tri: number[][], tail: number, basis: Basis, from: number, to: number): ChainLadder {
  const inRange = (i: number) => AYS[i] >= from && AYS[i] <= to;
  const vwa: number[] = [];
  const vwaN: number[] = [];
  const fallback: boolean[] = [];
  for (let j = 0; j < N - 1; j++) {
    let num = 0, den = 0, n = 0, numAll = 0, denAll = 0;
    for (let i = 0; i < N; i++) {
      if (j + 1 > lastJ(i)) continue;
      numAll += tri[i][j + 1];
      denAll += tri[i][j];
      if (inRange(i)) {
        num += tri[i][j + 1];
        den += tri[i][j];
        n++;
      }
    }
    vwa.push(n ? num / den : numAll / denAll);
    vwaN.push(n);
    fallback.push(n === 0);
  }
  const sel = [...vwa.map(selectFactor), tail];
  const cdf = new Array<number>(N).fill(1);
  cdf[N - 1] = tail;
  for (let j = N - 2; j >= 0; j--) cdf[j] = sel[j] * cdf[j + 1];

  const cum = tri.map((row, i) => {
    const out: number[] = [];
    for (let j = 0; j < N; j++) out.push(j <= lastJ(i) ? row[j] : out[j - 1] * sel[j - 1]);
    return out;
  });
  const link = tri.map((row, i) =>
    AGES.slice(0, N - 1).map((_, j) => (j + 1 <= lastJ(i) ? row[j + 1] / row[j] : null)),
  );
  const toDate = tri.map((row, i) => row[lastJ(i)]);
  const ult = toDate.map((v, i) => v * cdf[lastJ(i)]);
  return { basis, cum, link, vwa, vwaN, fallback, sel, cdf, ult, toDate };
}

/* ------------------------------------------------------------------ */
/* Per-AY view of a tab                                                */
/* ------------------------------------------------------------------ */

export interface AyRow {
  i: number;
  ay: number;
  ep: number;
  ult: number;
  ulr: number;
  toDate: number;
  incurred: number;
  ibnr: number;
  er: number;
  cr: number;
  policies: number;
  claims: number;
  freq: number;
  sev: number;
  pick: number;
  /** Bornhuetter–Ferguson IBNR on the initial pick (the plan view). */
  bfIbnr: number;
  planERlo: number;
  planERhi: number;
  planClaims: number;
}

export interface TabView {
  tab: TabId;
  basis: Basis;
  cl: ChainLadder;
  /** All ten AYs (priors are needed for deltas even outside the range). */
  rows: AyRow[];
  inRange: AyRow[];
}

export function buildView(tab: TabId, basis: Basis, from: number, to: number): TabView {
  const d = TAB_DATA[tab];
  const cl = chainLadder(d.tri[basis], d.tail[basis], basis, from, to);
  const clInc = basis === "incurred" ? cl : chainLadder(d.tri.incurred, d.tail.incurred, "incurred", from, to);
  const rows: AyRow[] = AYS.map((ay, i) => {
    const incurred = d.tri.incurred[i][lastJ(i)];
    const ult = cl.ult[i];
    return {
      i,
      ay,
      ep: d.ep[i],
      ult,
      ulr: (ult / d.ep[i]) * 100,
      toDate: cl.toDate[i],
      incurred,
      ibnr: ult - incurred,
      er: d.er[i],
      cr: (ult / d.ep[i]) * 100 + d.er[i],
      policies: d.policies[i],
      claims: d.claims[i],
      freq: (d.claims[i] / d.policies[i]) * 1000,
      sev: (ult * 1e6) / d.claims[i],
      pick: d.pick[i],
      bfIbnr: ((d.ep[i] * d.pick[i]) / 100) * (1 - 1 / clInc.cdf[lastJ(i)]),
      planERlo: d.planERlo[i],
      planERhi: d.planERhi[i],
      planClaims: d.planClaims[i],
    };
  });
  return { tab, basis, cl, rows, inRange: rows.filter((r) => r.ay >= from && r.ay <= to) };
}

/* ------------------------------------------------------------------ */
/* Calendar quarters (combined ratio)                                  */
/* ------------------------------------------------------------------ */

export const QUARTERS = ["Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26"];
export const QUARTER_LONG = [
  "Q3 2024", "Q4 2024", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026",
];
const Q_LR: Record<LobId, number[]> = {
  motor: [77.8, 76.9, 76.2, 75.4, 74.6, 75.3, 74.1, 73.2],
  home: [56.5, 63.0, 60.5, 55.0, 54.0, 61.5, 92.5, 59.0],
  cprop: [60.0, 62.5, 58.0, 64.5, 57.0, 61.0, 71.5, 59.5],
  liab: [76.0, 78.5, 75.0, 77.5, 79.0, 76.5, 78.5, 80.0],
  marine: [74.0, 81.0, 66.0, 63.0, 65.5, 68.0, 62.0, 67.0],
};

export interface QuarterRow {
  q: string;
  label: string;
  ep: number;
  lr: number;
  er: number;
  cr: number;
}

const Q_DATA: Record<LobId, QuarterRow[]> = Object.fromEntries(
  LOB_SPECS.map((spec) => {
    const rows = QUARTERS.map((q, k) => {
      const yearIdx = k < 2 ? N - 2 : N - 1; // 2024 → AY index 8; 2025/26 → 9
      const growth = k >= 6 ? 1.03 : 1;
      const ep = (spec.ep[yearIdx] / 4) * growth * (1 + 0.015 * gauss(rng));
      const lr = Q_LR[spec.id][k] + 0.6 * gauss(rng);
      const er = (spec.planER[0] + spec.planER[1]) / 2 + 0.45 * gauss(rng);
      return { q, label: QUARTER_LONG[k], ep, lr, er, cr: lr + er };
    });
    return [spec.id, rows];
  }),
) as Record<LobId, QuarterRow[]>;

export function quarterly(tab: TabId): QuarterRow[] {
  if (tab !== "all") return Q_DATA[tab];
  return QUARTERS.map((q, k) => {
    const parts = LOB_SPECS.map((s) => Q_DATA[s.id][k]);
    const ep = parts.reduce((a, p) => a + p.ep, 0);
    const lr = parts.reduce((a, p) => a + p.lr * p.ep, 0) / ep;
    const er = parts.reduce((a, p) => a + p.er * p.ep, 0) / ep;
    return { q, label: QUARTER_LONG[k], ep, lr, er, cr: lr + er };
  });
}

/* ------------------------------------------------------------------ */
/* Large-loss register                                                 */
/* ------------------------------------------------------------------ */

export type ClaimStatus = "Open" | "Litigated" | "Settled";

export interface LargeLoss {
  ref: string;
  lob: LobId;
  ay: number;
  event: string;
  lossDate: string; // ISO
  incurred: number; // £m
  paid: number;
  outstanding: number;
  ri: number;
  net: number;
  status: ClaimStatus;
  riBasis: string;
  /** Quarterly incurred (£m) from notification to settlement or valuation. */
  history: { q: string; v: number }[];
  notes: { date: string; text: string }[];
}

const PERILS: Record<LobId, string[]> = {
  motor: [
    "Catastrophic injury — PPO claimant",
    "Brain injury — pedestrian, Leicester",
    "Coach collision — multiple injuries, A38",
    "Spinal injury — motorcyclist, Cumbria",
    "HGV fire — third-party warehouse",
    "Multi-vehicle collision — M6 J15",
    "Amputation — cyclist, Bristol",
  ],
  home: [
    "Fire — thatched listed cottage, Dorset",
    "Escape of water — high-value apartment",
    "Fire — Georgian townhouse, Bath",
    "Subsidence — Victorian villa, Harrogate",
  ],
  cprop: [
    "Fire — Brackley Foods processing plant",
    "Flood — Aln Valley industrial estate",
    "Explosion — Tamar Chemicals store",
    "Business interruption — Kestrel cold store",
    "Fire — Ouseburn Timber yard",
    "Theft — Linwood bonded warehouse",
    "Fire — Quarry Lane recycling centre",
  ],
  liab: [
    "EL — mesothelioma, former shipyard worker",
    "Product — contaminated animal feed",
    "EL — crane collapse, Leeds site",
    "PL — Legionella outbreak, care home",
    "PI — façade cladding specification",
    "EL — silicosis, stone worktop fabricator",
    "PL — school trip coach injury",
  ],
  marine: [
    "Cargo — container stack collapse, MV Corran Star",
    "Hull — engine-room fire, MV Solway Grace",
    "Cargo — reefer failure, frozen seafood",
    "P&I — oil pollution, Humber estuary",
    "Hull — collision, MV Rathlin Dawn",
  ],
};

const LL_RATE: Record<LobId, number> = { motor: 1.7, home: 0.35, cprop: 1.4, liab: 1.25, marine: 0.8 };
const LL_SCALE: Record<LobId, number> = { motor: 2.1, home: 0.45, cprop: 1.5, liab: 1.7, marine: 1.3 };

interface Injected {
  lob: LobId;
  ay: number;
  event: string;
  date: string;
  incurred: number;
  status?: ClaimStatus;
  cat?: boolean;
}
const INJECTED: Injected[] = [
  { lob: "home", ay: 2023, event: "Storm Ivor — roof collapse, manor house", date: "2023-11-02", incurred: 2.84, cat: true },
  { lob: "home", ay: 2023, event: "Storm Ivor — tidal flood, riverside villa", date: "2023-11-02", incurred: 1.92, cat: true },
  { lob: "home", ay: 2023, event: "Storm Ivor — tree strike, listed farmhouse", date: "2023-11-03", incurred: 1.31, cat: true },
  { lob: "cprop", ay: 2023, event: "Storm Ivor — retail park roofs, Swindon", date: "2023-11-02", incurred: 6.45, cat: true },
  { lob: "cprop", ay: 2023, event: "Storm Ivor — distribution centre, Avonmouth", date: "2023-11-02", incurred: 4.18, cat: true },
  { lob: "home", ay: 2022, event: "Storm Maren — river flood, listed house", date: "2022-02-17", incurred: 1.46, cat: true },
  { lob: "home", ay: 2020, event: "Storm Calder — flood, Calder Valley mill house", date: "2020-02-09", incurred: 1.18, cat: true, status: "Settled" },
  { lob: "cprop", ay: 2021, event: "Fire — Harwell Mills distribution centre", date: "2021-08-14", incurred: 14.8, status: "Litigated" },
  { lob: "marine", ay: 2024, event: "Hull — grounding, MV Northern Tern", date: "2024-03-21", incurred: 9.6 },
  { lob: "liab", ay: 2019, event: "PL — spectator stand collapse, Brookfield Park", date: "2019-10-05", incurred: 11.2, status: "Litigated" },
  { lob: "motor", ay: 2023, event: "Coach collision — M5 J21, multiple injuries", date: "2023-07-29", incurred: 8.7 },
];

const ADJUSTERS = ["Crawley & Finch", "Harrow Loss Services", "Meridian Adjusting", "Pennant Claims"];
const SOLICITORS = ["Aldgate Moore LLP", "Keswick Rowe", "Tanner Holt LLP"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const VAL_Q = 2026 * 4 + 1; // Q2 2026 as a quarter ordinal (year*4 + q-1)

function isoAdd(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function qOrd(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
}
function qLabel(ord: number) {
  return `Q${(ord % 4) + 1} ${String(Math.floor(ord / 4)).slice(2)}`;
}
function qStartIso(ord: number) {
  const m = (ord % 4) * 3 + 1;
  return `${Math.floor(ord / 4)}-${String(m).padStart(2, "0")}-15`;
}
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const m2 = (v: number) => `£${v.toFixed(2)}m`;

function buildLoss(r: Rng, seq: number, base: Injected): LargeLoss {
  const { lob, ay, event, date, incurred, cat } = base;
  const age = 2026.5 - (ay + 0.5);
  let status: ClaimStatus;
  if (base.status) status = base.status;
  else {
    const u = r();
    const pSettle = lob === "liab" ? Math.min(0.7, age * 0.07) : Math.min(0.92, age * 0.17);
    const pLit = lob === "liab" ? 0.4 : lob === "motor" ? 0.22 : 0.1;
    status = u < pSettle ? "Settled" : u < pSettle + pLit * (1 - pSettle) ? "Litigated" : "Open";
  }
  const paidShare =
    status === "Settled"
      ? 1
      : Math.min(0.88, Math.max(0.04, (lob === "liab" ? 0.05 + age * 0.07 : 0.12 + age * 0.13) + 0.08 * gauss(r)));
  const paid = Math.round(incurred * paidShare * 100) / 100;
  const ret = LOB_SPECS.find((s) => s.id === lob)!.retention;
  const ri = cat
    ? Math.round(incurred * 0.45 * 100) / 100
    : Math.round(Math.max(0, incurred - ret) * 100) / 100;
  const riBasis = cat
    ? "Catastrophe XoL: event recovery allocated pro rata (45%)"
    : `Per-risk XoL: retention £${ret.toFixed(1)}m`;

  // Reserve history: an FNOL estimate that is usually light, stepped up (or
  // occasionally down) at two or three review points.
  const q0 = qOrd(isoAdd(date, 7));
  const settleQ = status === "Settled" ? Math.min(VAL_Q - 1, q0 + 3 + Math.floor(r() * (lob === "liab" ? 16 : 9))) : VAL_Q;
  const n = Math.max(2, settleQ - q0 + 1);
  const release = r() < 0.18;
  const start = incurred * (release ? 1.2 + 0.25 * r() : 0.3 + 0.45 * r());
  const nSteps = Math.min(n - 1, 2 + Math.floor(r() * 2));
  const stepAt = new Set<number>();
  while (stepAt.size < nSteps) stepAt.add(1 + Math.floor(r() * (n - 1)));
  const steps = [...stepAt].sort((a, b) => a - b);
  let level = start;
  const levels: number[] = [];
  let s = 0;
  for (let k = 0; k < n; k++) {
    if (steps[s] === k) {
      s++;
      level = s === steps.length ? incurred : level + (incurred - level) * (0.35 + 0.4 * r());
    }
    levels.push(level);
  }
  if (!steps.length) levels[n - 1] = incurred;
  const history = levels.map((v, k) => ({ q: qLabel(q0 + k), v: Math.round(v * 100) / 100 }));

  const notifyDate = isoAdd(date, 2 + Math.floor(r() * 9));
  const who = lob === "liab" ? SOLICITORS[seq % SOLICITORS.length] : ADJUSTERS[seq % ADJUSTERS.length];
  const notes: { date: string; text: string }[] = [
    {
      date: notifyDate,
      text:
        lob === "liab"
          ? `Letter of claim received; ${who} instructed as panel solicitors. Initial reserve ${m2(start)}.`
          : `Notified; ${who} appointed as loss adjuster. Initial reserve ${m2(start)}.`,
    },
  ];
  const reasons: Record<LobId, string[]> = {
    motor: ["care-cost report received", "PPO indexation reviewed", "liability admitted in full"],
    home: ["structural survey completed", "alternative accommodation extended", "listed-building consent costs added"],
    cprop: ["forensic accountant's BI estimate", "debris-removal costs agreed", "sprinkler warranty dispute resolved"],
    liab: ["medical evidence served", "co-defendant contribution disputed", "claimant schedule of loss served"],
    marine: ["salvage award agreed", "general average declared", "surveyor's damage report received"],
  };
  if (steps.length) {
    const midIdx = steps[Math.floor((steps.length - 1) / 2)];
    const v = levels[midIdx];
    notes.push({
      date: qStartIso(q0 + midIdx),
      text: `Reserve ${v >= levels[midIdx - 1] ? "raised" : "reduced"} to ${m2(v)}: ${reasons[lob][seq % reasons[lob].length]}.`,
    });
  }
  if (status === "Settled") {
    notes.push({ date: qStartIso(settleQ), text: `Settled at ${m2(incurred)}; file closed.` });
  } else if (status === "Litigated") {
    notes.push({
      date: qStartIso(Math.min(VAL_Q, q0 + Math.max(2, Math.floor(n * 0.6)))),
      text: `Proceedings issued; ${lob === "liab" ? "trial window listed for 2027" : `${SOLICITORS[(seq + 1) % SOLICITORS.length]} defending`}.`,
    });
  } else {
    notes.push({ date: "2026-05-20", text: `Interim payment made; paid to date ${m2(paid)}.` });
  }

  return {
    ref: `${LOB_SPECS.find((l) => l.id === lob)!.code}-${ay}-${String(1000 + ((seq * 7919) % 90000)).padStart(5, "0")}`,
    lob,
    ay,
    event,
    lossDate: date,
    incurred,
    paid,
    outstanding: Math.round((incurred - paid) * 100) / 100,
    ri,
    net: Math.round((incurred - ri) * 100) / 100,
    status,
    riBasis,
    history,
    notes,
  };
}

function buildLargeLosses(): LargeLoss[] {
  const r = mulberry32(7331);
  const out: LargeLoss[] = [];
  let seq = 1;
  const cursor: Record<LobId, number> = { motor: 0, home: 0, cprop: 0, liab: 0, marine: 0 };
  for (const spec of LOB_SPECS) {
    for (const ay of AYS) {
      const count = Math.max(0, Math.round(LL_RATE[spec.id] + 0.85 * gauss(r)));
      for (let k = 0; k < count; k++) {
        const u = r();
        const size = Math.min(16, 1 + LL_SCALE[spec.id] * (Math.pow(1 - u * 0.97, -1 / 1.5) - 1));
        const perils = PERILS[spec.id];
        const event = perils[cursor[spec.id]++ % perils.length];
        // Periodic payment orders are lifetime care awards: large and open.
        const ppo = event.includes("PPO");
        const doy = 5 + Math.floor(r() * 350);
        const date = isoAdd(`${ay}-01-01`, doy);
        const incurred = Math.round((ppo ? 4.2 + size * 1.4 : size) * 100) / 100;
        out.push(buildLoss(r, seq++, { lob: spec.id, ay, event, date, incurred, status: ppo ? "Open" : undefined }));
      }
    }
  }
  for (const inj of INJECTED) out.push(buildLoss(r, seq++, inj));
  return out;
}

export const LARGE_LOSSES: LargeLoss[] = buildLargeLosses();

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const NF: Record<number, Intl.NumberFormat> = {};
function nf(d: number) {
  return (NF[d] ??= new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
}
export const fmtNum = (v: number, d = 1) => nf(d).format(v);
export const fmtPct = (v: number, d = 1) => `${nf(d).format(v)}%`;
export const fmtFactor = (v: number) => nf(3).format(v);
/** Compact money from £m: £1.43bn, £412m, £38.2m. */
export function fmtMoney(m: number) {
  const a = Math.abs(m);
  const sign = m < 0 ? "−" : "";
  if (a >= 1000) return `${sign}£${nf(2).format(a / 1000)}bn`;
  if (a >= 100) return `${sign}£${nf(0).format(a)}m`;
  return `${sign}£${nf(1).format(a)}m`;
}
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
export const fmtGBP = (v: number) => GBP.format(v);
export function fmtSigned(v: number, d = 1, unit = "") {
  const s = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${s}${nf(d).format(Math.abs(v))}${unit}`;
}
