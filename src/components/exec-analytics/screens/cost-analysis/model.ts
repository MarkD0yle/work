import { INSTRUMENTS, gauss, rng } from "../../data/mock";
import type { FilterDef } from "../../shell";

export type Stats = { avg: number; median: number; sd: number; sharpe: number; trades: number; min: number; max: number };
export type MetricKey = keyof Stats;
export type CostRow = { id: string; label: string; stats: Record<string, Stats | null>; children?: CostRow[] };

export const POOLS = ["Pool 1", "Pool 2", "Pool 3"];
export const COMPARE = "Compare pools";

export const FILTERS: FilterDef[] = [
  { id: "pool", label: "Data pool", options: [...POOLS, COMPARE] },
  { id: "product", label: "Product", options: ["Spot", "Forward"] },
  { id: "direction", label: "Direction", options: ["Buy", "Sell"] },
  { id: "size", label: "Size (USD)", options: ["< 1M", "1M–10M", "10M–50M", "> 50M", "> 500M"] },
  { id: "session", label: "Session", options: ["Asia", "London", "New York"] },
  { id: "ccy", label: "Ccy", options: ["EUR", "GBP", "JPY", "AUD", "CHF", "CAD", "MXN", "ZAR", "PLN", "TRY", "INR", "BRL", "KRW", "TWD", "IDR"] },
  { id: "algo", label: "Algo style", options: ["TWAP", "VWAP", "Passive", "Aggressive"] },
  { id: "tenor", label: "Tenor", options: ["Spot", "1W", "1M", "3M"] },
  { id: "benchmark", label: "Benchmark", options: ["Include", "Exclude"] },
];

type Eff = { cost: number; count: number };
/** Seeded multiplier per filter value: filters really move the numbers, and stacking them empties the result. */
const EFFECTS: Record<string, Record<string, Eff>> = {
  pool: { "Pool 1": { cost: 1.05, count: 0.62 }, "Pool 2": { cost: 0.94, count: 0.38 }, "Pool 3": { cost: 1.12, count: 0.22 } },
  direction: { Buy: { cost: 0.92, count: 0.52 }, Sell: { cost: 1.09, count: 0.48 } },
  size: { "< 1M": { cost: 1.2, count: 0.3 }, "1M–10M": { cost: 1, count: 0.4 }, "10M–50M": { cost: 0.85, count: 0.25 }, "> 50M": { cost: 0.7, count: 0.05 }, "> 500M": { cost: 1, count: 0 } },
  session: { Asia: { cost: 1.25, count: 0.25 }, London: { cost: 0.9, count: 0.45 }, "New York": { cost: 1, count: 0.3 } },
  algo: { TWAP: { cost: 0.95, count: 0.3 }, VWAP: { cost: 0.9, count: 0.3 }, Passive: { cost: 0.8, count: 0.2 }, Aggressive: { cost: 1.4, count: 0.2 } },
  tenor: { Spot: { cost: 0.9, count: 0.6 }, "1W": { cost: 1.1, count: 0.15 }, "1M": { cost: 1.2, count: 0.15 }, "3M": { cost: 1.35, count: 0.1 } },
  benchmark: { Include: { cost: 1, count: 0.9 }, Exclude: { cost: 1.06, count: 0.8 } },
};
const NDF = ["USD/KRW", "USD/TWD", "USD/IDR"];
const BASE_TRADES = 4820;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const r2 = (n: number) => Math.round(n * 1e4) / 1e4;

function stats(avg: number, sd: number, trades: number, key: string): Stats {
  const r = rng(hash(key));
  const a = avg * (1 + gauss(r) * 0.03);
  const s = sd * (0.92 + r() * 0.16);
  const n = Math.max(1, Math.round(trades));
  return { avg: r2(a), median: r2(a * 0.8 + gauss(r) * 0.04 * s), sd: r2(s), sharpe: r2(a / s), trades: n, min: r2(a - s * (3 + 2 * r())), max: r2(a + s * (3.5 + 2 * r())) };
}

function aggregate(kids: Stats[]): Stats {
  const n = kids.reduce((t, k) => t + k.trades, 0);
  const w = (f: (k: Stats) => number) => kids.reduce((t, k) => t + f(k) * k.trades, 0) / n;
  const avg = r2(w((k) => k.avg)), sd = r2(w((k) => k.sd));
  return { avg, median: r2(w((k) => k.median)), sd, sharpe: r2(avg / sd), trades: n, min: Math.min(...kids.map((k) => k.min)), max: Math.max(...kids.map((k) => k.max)) };
}

export type Model = {
  empty: boolean; compare: boolean; poolKeys: string[]; chip: string;
  totals: CostRow[]; products: CostRow[]; groups: CostRow[];
  dist: { x: number; y: number }[]; impactAvg: number;
};

const TOTAL_DEFS = [
  { id: "impact", label: "Impact", avg: 1.9, sd: 3.1, share: 1 },
  { id: "impact-ae", label: "Impact (Act−Exp)", avg: -0.35, sd: 2.4, share: 1 },
  { id: "spot", label: "Spot spread", avg: 0.95, sd: 1.6, share: 0.64, product: "Spot" },
  { id: "fwd", label: "Forward spread", avg: 1.45, sd: 2.2, share: 0.36, product: "Forward" },
  { id: "total", label: "Total spread", avg: 1.2, sd: 1.9, share: 1 },
  { id: "total-ae", label: "Total (Act−Exp) spread", avg: -0.22, sd: 1.5, share: 1 },
];
const GROUP_DEFS: { id: string; avg: number; pairs: string[]; base: number }[] = [
  { id: "Restricted", avg: 6.2, base: 210, pairs: INSTRUMENTS.filter((i) => i.group === "Restricted").map((i) => i.pair) },
  { id: "NDF", avg: 4.6, base: 150, pairs: NDF },
  { id: "EM", avg: 3.1, base: 380, pairs: INSTRUMENTS.filter((i) => i.group === "EM").map((i) => i.pair) },
  { id: "G10", avg: 0.7, base: 900, pairs: INSTRUMENTS.filter((i) => i.group === "G10").map((i) => i.pair) },
];

export function buildModel(filters: Record<string, string>, tab: "cost" | "benchmark", rangeDays: number): Model {
  const val = (id: string) => filters[id] ?? "All";
  const bench = tab === "benchmark";
  const compare = val("pool") === COMPARE;
  const poolKeys = compare ? POOLS : ["main"];
  const rangeScale = Math.min(4, Math.max(0.05, rangeDays / 90));
  const common: Eff = { cost: 1, count: rangeScale };
  for (const id of ["direction", "size", "session", "algo", "tenor", "benchmark"]) {
    const e = EFFECTS[id][val(id)];
    if (e) { common.cost *= e.cost; common.count *= e.count; }
  }
  const poolEff = (pk: string): Eff => (pk === "main" ? EFFECTS.pool[val("pool")] ?? { cost: 1, count: 1 } : EFFECTS.pool[pk]);
  const effFor = (pk: string): Eff => { const p = poolEff(pk); return { cost: common.cost * p.cost * (bench ? 0.78 : 1), count: common.count * p.count }; };
  const product = val("product");
  const ccy = val("ccy");
  const seed = (k: string, pk: string) => `${tab}|${JSON.stringify(filters)}|${pk}|${k}`;

  const totals: CostRow[] = TOTAL_DEFS.map((d) => ({
    id: d.id, label: d.label,
    stats: Object.fromEntries(poolKeys.map((pk) => {
      const e = effFor(pk);
      const off = d.product && product !== "All" && product !== d.product;
      const count = BASE_TRADES * d.share * e.count * (d.product && product === d.product ? 1 / d.share : 1);
      const avg = bench ? d.avg * 0.7 - 0.15 : d.avg;
      return [pk, off || count < 1 ? null : stats(avg * e.cost, d.sd * (bench ? 1.1 : 1), count, seed(d.id, pk))];
    })),
  }));

  const products: CostRow[] = [{ id: "Forward", share: 0.36, avg: 1.45, sd: 2.2 }, { id: "Spot", share: 0.64, avg: 0.95, sd: 1.6 }]
    .filter((p) => product === "All" || product === p.id)
    .map((p) => ({
      id: p.id, label: p.id,
      stats: Object.fromEntries(poolKeys.map((pk) => {
        const e = effFor(pk);
        const count = BASE_TRADES * (product === p.id ? 1 : p.share) * e.count;
        return [pk, count < 1 ? null : stats((bench ? p.avg * 0.7 - 0.15 : p.avg) * e.cost, p.sd, count, seed(p.id, pk))];
      })),
    }));

  const groups: CostRow[] = [];
  for (const g of GROUP_DEFS) {
    const pairs = g.pairs.filter((p) => ccy === "All" || p.includes(ccy));
    if (!pairs.length) continue;
    const kids: CostRow[] = pairs.map((pair) => ({
      id: pair, label: pair,
      stats: Object.fromEntries(poolKeys.map((pk) => {
        const e = effFor(pk);
        const jr = rng(hash(pair));
        const count = (g.base / g.pairs.length) * 4 * (0.6 + jr()) * e.count * (ccy === "All" ? 1 : 1.5);
        const avg = g.avg * (0.7 + jr() * 0.6) * e.cost * (bench ? 0.7 : 1);
        return [pk, count < 1 ? null : stats(avg, 1.2 + g.avg * 0.45, count, seed(pair, pk))];
      })),
    })).filter((k) => poolKeys.some((pk) => k.stats[pk]));
    if (!kids.length) continue;
    groups.push({
      id: g.id, label: g.id, children: kids,
      stats: Object.fromEntries(poolKeys.map((pk) => {
        const ks = kids.map((k) => k.stats[pk]).filter((s): s is Stats => !!s);
        return [pk, ks.length ? aggregate(ks) : null];
      })),
    });
  }

  const totalTrades = totals[0].stats[poolKeys[0]] ? poolKeys.reduce((t, pk) => t + (totals[0].stats[pk]?.trades ?? 0), 0) : 0;
  const empty = totalTrades < 1 || groups.length === 0;
  const impact = poolKeys.map((pk) => totals[0].stats[pk]).filter((s): s is Stats => !!s);
  const agg = impact.length ? aggregate(impact) : null;
  const dist: { x: number; y: number }[] = [];
  if (agg) {
    const lo = agg.avg - 4 * agg.sd, step = (8 * agg.sd) / 40;
    for (let i = 0; i <= 40; i++) {
      const x = lo + i * step; const z = (x - agg.avg) / agg.sd;
      const skew = 1 + 0.15 * Math.tanh(z);
      dist.push({ x: r2(x), y: Math.round(agg.trades * step / (agg.sd * Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * skew) });
    }
  }
  const chip = compare ? "Data pool: Compare pools" : `Data pool: ${val("pool") === "All" ? "All pools" : val("pool")}`;
  return { empty, compare, poolKeys, chip, totals, products, groups, dist, impactAvg: agg?.avg ?? 0 };
}
