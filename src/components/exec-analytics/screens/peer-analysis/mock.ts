import { COUNTERPARTIES, INSTRUMENTS, gauss, rng } from "../../data/mock";

export type PeerStat = {
  id: string;
  name: string;
  /** Short label for bubble data labels. */
  short: string;
  tier: string;
  notional: number;
  /** Win rate, 0-100. */
  winRate: number;
  /** Par-adjusted win rate, bps (signed). */
  pawr: number;
  /** 30s reval, bps (signed). */
  reval: number;
  trades: number;
  /** Rank last period, for rank-change arrows. */
  prevRank: number;
};

export const TIERS = ["Tier 1", "Tier 2", "Tier 3"];
export const TENORS = ["Spot", "1W", "1M", "2M", "3M", "6M", "1Y"];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Coherent stats: bigger flow wins slightly more, reval tracks PAWR. `scale` stretches volume with the date range. */
export function buildPeerStats(scale: number, count = 20): PeerStat[] {
  const r = rng(4501);
  const raw = COUNTERPARTIES.slice(0, count).map((cp) => {
    const size = Math.exp(gauss(r) * 0.7);
    const skill = gauss(r);
    const notional = Math.round((9e8 * size * scale) / 1e6) * 1e6;
    const winRate = clamp(50 + skill * 4.5 + (Math.log(size) * 1.6), 34, 68);
    const pawr = (winRate - 50) * 0.16 + gauss(r) * 0.22;
    const reval = pawr * 0.55 + gauss(r) * 0.28;
    const trades = Math.max(12, Math.round((notional / 2.4e7) * (0.8 + r() * 0.5)));
    return { id: cp.id, name: cp.name, short: cp.name.split(" ")[1] ?? cp.name, notional, winRate, pawr, reval, trades, shift: Math.round((r() - 0.5) * 8) };
  });
  const byNotional = [...raw].sort((a, b) => b.notional - a.notional).map((s) => s.id);
  const byPawr = [...raw].sort((a, b) => b.pawr - a.pawr).map((s) => s.id);
  return raw.map((s) => {
    const n = byNotional.indexOf(s.id);
    const rank = byPawr.indexOf(s.id) + 1;
    return {
      id: s.id, name: s.name, short: s.short, tier: n < 7 ? TIERS[0] : n < 14 ? TIERS[1] : TIERS[2],
      notional: s.notional, winRate: s.winRate, pawr: s.pawr, reval: s.reval, trades: s.trades,
      prevRank: clamp(rank + s.shift, 1, count),
    };
  });
}

export type MatrixRow = { id: string; name: string; values: Record<string, number | null> };

/** Counterparty x column PAWR matrix; ~6% of cells have no trades. */
export function buildMatrix(stats: PeerStat[], dim: "instrument" | "tenor"): { columns: string[]; rows: MatrixRow[] } {
  const columns = dim === "instrument" ? INSTRUMENTS.slice(0, 10).map((i) => i.pair) : TENORS;
  const r = rng(dim === "instrument" ? 77 : 78);
  const rows = stats.map((s) => ({
    id: s.id, name: s.name,
    values: Object.fromEntries(columns.map((c) => [c, r() < 0.06 ? null : s.pawr + gauss(r) * 0.45])) as Record<string, number | null>,
  }));
  return { columns, rows };
}

export const SIZE_BUCKETS = ["Under 1M", "1M to 5M", "5M to 10M", "10M to 25M", "Over 25M"];

/** Win rate by trade-size bucket for quotes under / at / above par. Par is the dashed 50% reference. */
export function buildParCurve(s: PeerStat): { under: number[]; par: number[]; above: number[] } {
  const r = rng(900 + Number(s.id.replace("cp", "")));
  const under = SIZE_BUCKETS.map((_, i) => clamp(s.winRate + 6 - i * 1.6 + gauss(r) * 0.9, 20, 80));
  const above = SIZE_BUCKETS.map((_, i) => clamp(s.winRate - 7 + i * 0.8 + gauss(r) * 0.9, 20, 80));
  return { under, par: SIZE_BUCKETS.map(() => 50), above };
}
