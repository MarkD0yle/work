/* Credit Heat Map — screen model.
 *
 * All the data and state behind the credit heat map, with no styling. Both
 * skins (the Bloomberg-style terminal and the friendly studio) render from
 * this one hook, so they can never drift apart in what they can do. */

import { useMemo, useState } from "react";
import { BONDS, midAnalytics, seeded, yearsToMaturity, type Bond } from "../bonds";
import { signed } from "../format";

export const SECTORS = ["Banks", "Insurance", "REITs", "Tech", "Telecom", "Media", "Utilities", "Energy", "Autos", "Healthcare", "Consumer", "Industrials"] as const;
export const TENORS = ["1–3Y", "3–5Y", "5–7Y", "7–10Y", "10–20Y", "20Y+"] as const;
const TENOR_EDGES = [0, 3, 5, 7, 10, 20, 99];

export type Metric = "oas" | "d1" | "d1w" | "d1m" | "z";
export const METRICS = [
  { id: "oas", label: "OAS" },
  { id: "d1", label: "Δ1D" },
  { id: "d1w", label: "Δ1W" },
  { id: "d1m", label: "Δ1M" },
  { id: "z", label: "Z 3M" },
] as const;

export type Universe = "ig" | "a" | "bbb" | "hy";
export const UNIVERSES = [
  { id: "ig", label: "IG" },
  { id: "a", label: "A & up" },
  { id: "bbb", label: "BBB" },
  { id: "hy", label: "HY" },
] as const;
const UNIVERSE_MULT: Record<Universe, number> = { ig: 1, a: 0.72, bbb: 1.28, hy: 3.7 };

export type Cell = { oas: number; d1: number; d1w: number; d1m: number; z: number; issues: number; vol: number; hist: number[] };
export type Pos = { s: number; t: number };
export type Mover = { si: number; ti: number; d1: number; z: number; oas: number };

const SECTOR_BASE: Record<string, number> = {
  Banks: 92, Insurance: 98, REITs: 118, Tech: 71, Telecom: 112, Media: 156, Utilities: 104, Energy: 109, Autos: 131, Healthcare: 79, Consumer: 84, Industrials: 88,
};
// A risk-off day concentrated in Media, Autos and the long end.
const SECTOR_STRESS: Record<string, number> = {
  Banks: 0.4, Insurance: 0.2, REITs: 0.9, Tech: -0.6, Telecom: 0.7, Media: 2.6, Utilities: 0.1, Energy: -0.3, Autos: 1.9, Healthcare: -0.4, Consumer: 0.2, Industrials: 0.3,
};

function buildGrid(universe: Universe): Cell[][] {
  const mult = UNIVERSE_MULT[universe];
  return SECTORS.map((s, si) =>
    TENORS.map((_, ti) => {
      const r = seeded(si * 31 + ti * 7 + universe.length * 101);
      const curve = [0.62, 0.8, 0.95, 1.08, 1.22, 1.3][ti];
      const oas = SECTOR_BASE[s] * curve * mult + (r() - 0.5) * 8;
      const stress = SECTOR_STRESS[s] * (0.7 + ti * 0.12);
      const d1 = (stress + (r() - 0.5) * 1.6) * Math.sqrt(mult);
      const d1w = d1 * 2.4 + (r() - 0.5) * 5;
      const d1m = d1w * 1.6 + (r() - 0.5) * 9;
      const z = Math.max(-3.2, Math.min(3.2, d1w / (3.2 * Math.sqrt(mult)) + (r() - 0.5) * 0.6));
      // 64 sessions of history ending at today's level.
      const hist: number[] = [];
      let v = oas - d1m * 2.2;
      for (let i = 0; i < 63; i++) {
        v += (oas - v) * 0.04 + (r() - 0.5) * 2.4;
        hist.push(v);
      }
      hist.push(oas);
      return { oas, d1, d1w, d1m, z, issues: 6 + Math.floor(r() * 60), vol: 40 + Math.floor(r() * 900), hist };
    }),
  );
}

export function tenorIndex(b: Bond) {
  const y = yearsToMaturity(b);
  return TENOR_EDGES.findIndex((e, i) => y >= e && y < TENOR_EDGES[i + 1]);
}

export function metricValue(c: Cell, m: Metric) {
  return c[m];
}

export function fmtMetric(v: number, m: Metric) {
  if (m === "oas") return v.toFixed(0);
  if (m === "z") return signed(v, 2);
  return signed(v, 1);
}

export function useCreditMap() {
  const [metric, setMetric] = useState<Metric>("d1");
  const [universe, setUniverse] = useState<Universe>("ig");
  const [sel, setSel] = useState<Pos>({ s: 5, t: 3 });
  const [hover, setHover] = useState<Pos | null>(null);

  const grid = useMemo(() => buildGrid(universe), [universe]);

  const values = grid.flat().map((c) => metricValue(c, metric));
  const maxAbs = Math.max(...values.map(Math.abs));
  const minLvl = Math.min(...values);
  const maxLvl = Math.max(...values);

  const rowAvg = grid.map((row) => row.reduce((a, c) => a + metricValue(c, metric), 0) / row.length);
  const colAvg = TENORS.map((_, ti) => grid.reduce((a, row) => a + metricValue(row[ti], metric), 0) / grid.length);

  const focus = hover ?? sel;
  const fc = grid[focus.s][focus.t];
  const sc = grid[sel.s][sel.t];

  const movers = useMemo(() => {
    const all: Mover[] = grid.flatMap((row, si) => row.map((c, ti) => ({ si, ti, d1: c.d1, z: c.z, oas: c.oas })));
    const sorted = [...all].sort((a, b) => b.d1 - a.d1);
    return { wider: sorted.slice(0, 5), tighter: sorted.slice(-5).reverse() };
  }, [grid]);

  const sectorBonds = BONDS.filter((b) => b.sector === SECTORS[sel.s]).map((b) => {
    const a = midAnalytics(b);
    const r = seeded(b.isin.charCodeAt(5) * 13 + b.coupon * 100);
    return { b, ...a, d1: sc.d1 * (0.6 + r() * 0.8) + (r() - 0.5), inBucket: tenorIndex(b) === sel.t };
  });

  const z = sc.z;
  const zVerdict = Math.abs(z) >= 2 ? "Unusual" : Math.abs(z) >= 1 ? "Notable" : "Normal";
  const percentile = Math.round((sc.hist.filter((h) => h <= sc.oas).length / sc.hist.length) * 100);

  return {
    metric, setMetric, universe, setUniverse, sel, setSel, hover, setHover,
    grid, maxAbs, minLvl, maxLvl, rowAvg, colAvg, focus, fc, sc, movers, sectorBonds, z, zVerdict, percentile,
  };
}

/** Static market-tone tiles shown beside the movers. */
export const MARKET_TONE = [
  { label: "IG index OAS", value: "82", sub: "+1 bp · 3M range 74–88", tone: "flat" },
  { label: "HY index OAS", value: "318", sub: "+9 bp · widest since Aug", tone: "bad" },
  { label: "TRACE IG vol", value: "$38.4bn", sub: "112% of 20D avg", tone: "flat" },
  { label: "New issue", value: "$14.2bn", sub: "9 deals · NIC 4.1 bp", tone: "flat" },
  { label: "Adv / dec", value: "141 / 389", sub: "tighter / wider issuers", tone: "bad" },
  { label: "Dealer axes", value: "62% bid", sub: "street wants to buy", tone: "flat" },
] as const;
