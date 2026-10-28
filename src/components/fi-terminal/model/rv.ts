/* Rates Relative Value — screen model.
 *
 * Fitted Treasury curve, rich/cheap residuals, curve-spread matrix,
 * butterflies and the DV01-neutral switch builder, with no styling.
 * Both skins render from useRv(). */

import { useState } from "react";
import { BENCHMARKS, SETTLE_T1, priceFromYield, pv01, seeded, type Bond } from "../bonds";
import { usd } from "../format";

/* Nelson–Siegel fit to today's curve (β0, β1, β2, τ). */
const NS = { b0: 4.937, b1: -1.287, b2: -2.38, tau: 3 };
export function fitted(tYears: number) {
  const x = tYears / NS.tau;
  const f1 = (1 - Math.exp(-x)) / x;
  const f2 = f1 - Math.exp(-x);
  return NS.b0 + NS.b1 * f1 + NS.b2 * f2;
}

export type Issue = { bond: Bond; years: number; resid: number; yld: number; price: number; pv01: number; otr: boolean };

const ISSUE_DEFS: [number, number, number, number, number, boolean][] = [
  // coupon, year, month, day, residual bp (+ = cheap), on-the-run
  [3.375, 2028, 10, 31, 0.4, true],
  [4.625, 2028, 6, 15, 1.9, false],
  [3.5, 2029, 10, 31, -0.6, true],
  [4.0, 2030, 2, 28, 2.6, false],
  [3.625, 2031, 10, 31, -1.1, true],
  [4.125, 2032, 11, 15, 3.4, false],
  [2.875, 2032, 5, 15, -2.7, false],
  [3.75, 2033, 10, 31, -0.8, true],
  [4.5, 2034, 11, 15, 2.2, false],
  [4.25, 2035, 8, 15, 1.1, false],
  [4.0, 2036, 8, 15, -1.6, true],
  [1.125, 2040, 5, 15, 4.8, false],
  [4.375, 2043, 8, 15, -3.1, false],
  [4.5, 2046, 8, 15, -0.9, true],
  [3.0, 2049, 2, 15, 3.7, false],
  [4.25, 2053, 5, 15, 1.3, false],
  [4.625, 2056, 8, 15, -1.9, true],
];

export const ISSUES: Issue[] = ISSUE_DEFS.map(([cpn, y, m, d, resid, otr], i) => {
  const maturity = new Date(Date.UTC(y, m - 1, d));
  const years = (maturity.getTime() - SETTLE_T1.getTime()) / (365.25 * 86400000);
  const bond: Bond = {
    id: `UST-${i}`,
    isin: `US91282C${String(1000 + i * 37).padStart(4, "0")}`,
    ticker: "T",
    issuer: "US Treasury",
    coupon: cpn,
    maturity,
    sector: "Govt",
    rating: "AA",
    mid: 100,
    bench: "10Y",
    liq: otr ? 10 : 8,
    outstanding: 60_000,
  };
  const yld = fitted(years) + resid / 100;
  return { bond, years, resid, yld, price: priceFromYield(bond, yld), pv01: pv01(bond, yld), otr };
});

export function label(i: Issue) {
  const mmn = String(i.bond.maturity.getUTCMonth() + 1).padStart(2, "0");
  return `T ${i.bond.coupon.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} ${mmn}/${String(i.bond.maturity.getUTCFullYear()).slice(2)}`;
}

/* ---- Curve spreads (bp) between benchmark tenors ---- */
export const TENORS = BENCHMARKS.map((b) => b.tenor);
/** "2s10s" — trader shorthand for the 2Y–10Y spread. */
export const curveName = (i: number, j: number) => `${TENORS[i].replace("Y", "")}s${TENORS[j].replace("Y", "")}s`;
export const money = (v: number) => `${v >= 0 ? "+" : "−"}$${usd(Math.abs(v))}`;
export type SpreadMetric = "lvl" | "d1" | "z";
export const SPREAD_METRICS = [
  { id: "lvl", label: "Level" },
  { id: "d1", label: "Δ1D" },
  { id: "z", label: "Z 3M" },
] as const;
export function spreadCell(i: number, j: number) {
  const r = seeded(i * 17 + j * 101);
  const lvl = (BENCHMARKS[j].yld - BENCHMARKS[i].yld) * 100;
  const d1 = (r() - 0.55) * 3.2;
  const z = (r() - 0.5) * 4.4;
  return { lvl, d1, z, pct: Math.round(50 + z * 17) };
}

export const FLIES = [
  { name: "2s5s10s", w: [2, 5, 10] },
  { name: "5s10s30s", w: [5, 10, 30] },
  { name: "2s10s30s", w: [2, 10, 30] },
  { name: "10s20s30s", w: [10, 20, 30] },
  { name: "3s7s10s", w: [3, 7, 10] },
].map((f, k) => {
  const y = (yrs: number) => BENCHMARKS.find((b) => b.years === yrs)!.yld;
  const lvl = (2 * y(f.w[1]) - y(f.w[0]) - y(f.w[2])) * 100;
  const r = seeded(k * 59 + 7);
  return { ...f, lvl, d1: (r() - 0.5) * 2.4, z: (r() - 0.5) * 4.2 };
});

export type RvStage = "build" | "confirm" | "sent";

export function useRv() {
  const richest = [...ISSUES].sort((a, b) => a.resid - b.resid)[0];
  const cheapest = [...ISSUES].filter((i) => Math.abs(i.years - richest.years) < 8).sort((a, b) => b.resid - a.resid)[0];

  const [sellIdx, setSellIdx] = useState(ISSUES.indexOf(richest));
  const [buyIdx, setBuyIdx] = useState(ISSUES.indexOf(cheapest));
  const [sellFace, setSellFace] = useState("50");
  const [metric, setMetric] = useState<SpreadMetric>("z");
  const [cell, setCell] = useState<{ i: number; j: number }>({ i: 0, j: 4 });
  const [stage, setStage] = useState<RvStage>("build");
  const [hover, setHover] = useState<number | null>(null);

  const sell = ISSUES[sellIdx];
  const buy = ISSUES[buyIdx];
  const sFace = Math.max(0, Number(sellFace) || 0) * 1e6;
  const dv01Sell = (sell.pv01 / 100) * sFace;
  // DV01-neutral: buy enough face that the risk bought equals the risk sold.
  const bFace = Math.round(((dv01Sell / (buy.pv01 / 100)) / 1e5)) * 1e5;
  const dv01Buy = (buy.pv01 / 100) * bFace;
  const pickupYield = (buy.yld - sell.yld) * 100;
  const pickupRv = buy.resid - sell.resid;
  const cashSell = (sell.price / 100) * sFace;
  const cashBuy = (buy.price / 100) * bFace;
  const carry = ((buy.yld - 3.58) - (sell.yld - 3.58)) * 25 + (buy.years > sell.years ? 0.6 : -0.4);
  const sameIssue = sellIdx === buyIdx;

  const sc = spreadCell(cell.i, cell.j);
  const hi = hover !== null ? ISSUES[hover] : null;

  function swapLegs() {
    setSellIdx(buyIdx);
    setBuyIdx(sellIdx);
  }

  /** Curve click: plain click sets the sell leg, shift-click the buy leg. */
  function pick(i: number, asBuy: boolean) {
    if (asBuy) setBuyIdx(i);
    else setSellIdx(i);
  }

  return {
    sellIdx, setSellIdx, buyIdx, setBuyIdx, sellFace, setSellFace, metric, setMetric, cell, setCell, stage, setStage, hover, setHover,
    sell, buy, sFace, dv01Sell, bFace, dv01Buy, pickupYield, pickupRv, cashSell, cashBuy, carry, sameIssue, sc, hi, swapLegs, pick,
  };
}
