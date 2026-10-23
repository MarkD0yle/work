/* Local mock series for the Liquidity & Cost dashboard. Everything is seeded by trade id so a trade always looks the same. */
import { AS_OF, addDays } from "../../lib/dates";
import { cpName, gauss, rng, type Trade } from "../../data/mock";

const seedOf = (id: string) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2)) + Number(hhmm.slice(3, 5)) / 60;
/** Pair scale: wider for EM / restricted pairs. */
const pairScale = (t: Trade) => 0.6 + t.refValueBps;

export const midHour = (t: Trade) => {
  const s = hourOf(t.start); let e = hourOf(t.end);
  if (e <= s) e += 24;
  return Math.floor(((s + e) / 2) % 24);
};

export function liquidityCurve(t: Trade) {
  const r = rng(seedOf(t.id) + 1);
  const centre = midHour(t);
  const base = t.notional * 0.35;
  const data: [number, number][] = Array.from({ length: 24 }, (_, h) => {
    const d = Math.min(Math.abs(h - centre), 24 - Math.abs(h - centre));
    const v = base * (0.15 + Math.exp(-(d * d) / 40)) * (0.85 + 0.3 * r());
    return [h, Math.round(v)];
  });
  const fvX = centre;
  return { data, fv: { x: fvX, y: data[fvX][1], bps: t.refValueBps } };
}

export function swapProfile(t: Trade) {
  const r = rng(seedOf(t.id) + 2);
  return Array.from({ length: 20 }, (_, i) => {
    const day = i + 1;
    const mid = t.notional * (0.5 + 0.9 * Math.log(1 + day) / Math.log(21)) * (0.9 + 0.2 * r());
    return { day, low: Math.round(mid * (0.55 + 0.1 * r())), high: Math.round(mid * (1.25 + 0.15 * r())) };
  });
}

export const MOMENTUM_FACTORS = ["Price trend", "Volume trend", "Volatility", "Order flow", "Spread pressure"];
export function momentum(t: Trade) {
  const r = rng(seedOf(t.id) + 3);
  return MOMENTUM_FACTORS.map((name) => ({ name, value: Math.round(Math.max(-100, Math.min(100, gauss(r) * 45))) }));
}

export function twapCosts(t: Trade) {
  const r = rng(seedOf(t.id) + 4);
  const k = pairScale(t);
  const rows = Array.from({ length: 18 }, (_, i) => {
    const d = (i + 1) * 10;
    const opportunity = k * 4 * Math.exp(-d / 50) * (0.95 + 0.1 * r());
    const spread = k * (0.3 + 0.012 * d) * (0.95 + 0.1 * r());
    return { minutes: d, opportunity, spread, total: opportunity + spread };
  });
  const min = rows.reduce((m, x, i) => (x.total < rows[m].total ? i : m), 0);
  return { rows, minIndex: min };
}

export const TENORS = [1, 3, 7, 30, 90, 365];
export const TENOR_LABEL: Record<number, string> = { 1: "1D", 3: "3D", 7: "7D", 30: "1M", 90: "3M", 365: "1Y" };
export function forwardCurves(t: Trade) {
  const r = rng(seedOf(t.id) + 5);
  const k = pairScale(t);
  return [0, -7, -30, -90].map((off, i) => ({
    date: addDays(AS_OF, off),
    points: TENORS.map((d): [number, number] => [d, k * 1.4 * Math.log(1 + d) * (1 - i * 0.08) * (0.97 + 0.06 * r())]),
  }));
}

export type AlgoPoint = { minutes: number; cost: number; algo: string; channel: string; counterparty: string; fill: string; postFill: string };
export const ALGO_GROUPS = ["algo", "channel", "counterparty", "fill", "postFill"] as const;
export type AlgoGroup = (typeof ALGO_GROUPS)[number];
export const ALGO_TABS: { id: AlgoGroup; label: string }[] = [
  { id: "algo", label: "Algo name" }, { id: "channel", label: "Channel" }, { id: "counterparty", label: "Counterparty" },
  { id: "fill", label: "Fill position" }, { id: "postFill", label: "Post-fill position" },
];
export function algoPoints(t: Trade): AlgoPoint[] {
  const r = rng(seedOf(t.id) + 6);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const k = pairScale(t);
  return Array.from({ length: 40 }, () => {
    const minutes = Math.round(10 + r() * 170);
    return {
      minutes, cost: k * (0.5 + 3 * Math.exp(-minutes / 70) + gauss(r) * 0.25 + minutes * 0.004),
      algo: pick(["TWAP", "VWAP", "Passive", "Aggressive"]), channel: pick(["Voice", "API", "Portal"]),
      counterparty: cpName(pick(t.counterparties)), fill: pick(["Early", "Mid", "Late"]), postFill: pick(["Reverted", "Continued", "Flat"]),
    };
  });
}

export const tenorText = (t: Trade) => (t.tenor === "Spot" || t.product === "Spot" ? "Spot" : t.tenor);
