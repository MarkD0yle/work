/* BWIC List Sale — screen model.
 *
 * The list, the dealer bids, best/cover ranking, the reserve rule with PM
 * overrides, the decide-by countdown and the award flow, with no styling.
 * Both skins render from useBwic(). */

import { useEffect, useState } from "react";
import { BONDS, DEALERS, seeded, type Bond } from "../bonds";

export const DEALER_CODES = DEALERS.slice(0, 6).map((d) => d.code);

export type Line = {
  n: number;
  bond: Bond;
  face: number;
  mark: number;
  reserve: number;
  bids: (number | null)[]; // per dealer; null = did not bid
};

function buildLines(): Line[] {
  const pick = ["CHTR-34", "PARA-30", "F-30", "GM-33", "T-36", "VZ-32", "ORCL-34", "OXY-33", "DUK-34", "NEE-29", "CCL-29", "BA-35", "PLD-34", "MET-33"];
  return pick.map((id, i) => {
    const bond = BONDS.find((b) => b.id === id)!;
    const r = seeded(i * 977 + 13);
    const mark = Math.round((bond.mid - 0.05) * 1000) / 1000;
    const softness = (10 - bond.liq) * 0.06;
    const bids = DEALER_CODES.map((_, di) => {
      // Some dealers skip illiquid lines; the axed one is aggressive.
      if (r() < 0.12 + softness * 0.35) return null;
      const axe = (i + di) % 5 === 0 ? 0.18 : 0;
      const bid = mark - 0.12 - softness * 1.3 + axe + (r() - 0.45) * 0.4;
      return Math.round(bid * 1000) / 1000;
    });
    return {
      n: i + 1,
      bond,
      face: [10, 5, 15, 20, 10, 25, 15, 8, 6, 12, 10, 20, 5, 25][i] * 1_000_000,
      mark,
      reserve: Math.round((mark - 0.15 - softness * 0.2) * 1000) / 1000,
      bids,
    };
  });
}

export const LINES = buildLines();
/** Bid − mark (pts) that maps to full heat. */
export const MAX_DEV = 0.6;

export type View = "px" | "vsmark";
export type Filter = "all" | "trade" | "dnt";
export type BwicStage = "deciding" | "confirm" | "awarded";
type Ranked = { b: number; i: number };

function rank(l: Line) {
  const sorted = l.bids
    .map((b, i) => ({ b, i }))
    .filter((x): x is Ranked => x.b !== null)
    .sort((a, b) => b.b - a.b);
  return { best: sorted[0] as Ranked | undefined, cover: sorted[1] as Ranked | undefined, count: sorted.length };
}

export function useBwic() {
  const [view, setView] = useState<View>("vsmark");
  const [filter, setFilter] = useState<Filter>("all");
  const [override, setOverride] = useState<Record<number, boolean>>({});
  const [stage, setStage] = useState<BwicStage>("deciding");
  const [left, setLeft] = useState(9 * 60 + 42);
  const [focus, setFocus] = useState(1);

  useEffect(() => {
    if (stage === "awarded") return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [stage]);

  const rows = LINES.map((l) => {
    const { best, cover, count } = rank(l);
    const clears = !!best && best.b >= l.reserve;
    const trade = override[l.n] ?? clears;
    return { l, best, cover, count, clears, trade: trade && !!best, overridden: override[l.n] !== undefined };
  });

  /** Flip one line between Trade and DNT; returning to the rule's default clears the override. */
  function toggleTrade(n: number) {
    const row = rows.find((r) => r.l.n === n);
    if (!row) return;
    setOverride((o) => {
      const next = { ...o };
      const want = !row.trade;
      if (want === row.clears) delete next[n];
      else next[n] = want;
      return next;
    });
  }

  const shown = rows.filter((r) => filter === "all" || (filter === "trade" ? r.trade : !r.trade));
  const trading = rows.filter((r) => r.trade);
  const totalFace = LINES.reduce((a, l) => a + l.face, 0);
  const tradingFace = trading.reduce((a, r) => a + r.l.face, 0);
  const proceeds = trading.reduce((a, r) => a + (r.best!.b / 100) * r.l.face, 0);
  const vsMark = trading.reduce((a, r) => a + ((r.best!.b - r.l.mark) / 100) * r.l.face, 0);
  const bidsIn = LINES.reduce((a, l) => a + l.bids.filter((b) => b !== null).length, 0);
  const bidsMax = LINES.length * DEALER_CODES.length;
  const belowReserve = rows.filter((r) => !r.clears).length;
  const winners = new Set(trading.map((r) => r.best!.i)).size;

  const dealerStats = DEALER_CODES.map((code, di) => {
    const wins = trading.filter((r) => r.best!.i === di);
    const bidsGiven = LINES.filter((l) => l.bids[di] !== null);
    const avg = bidsGiven.reduce((a, l) => a + (l.bids[di]! - l.mark), 0) / (bidsGiven.length || 1);
    return { code, wins: wins.length, face: wins.reduce((a, r) => a + r.l.face, 0), resp: bidsGiven.length, avg: avg * 100 };
  }).sort((a, b) => b.face - a.face);
  const maxFace = Math.max(...dealerStats.map((d) => d.face), 1);

  const fr = rows.find((r) => r.l.n === focus) ?? rows[0];
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  /** One-line read on the focused line. */
  const focusAdvice = !fr.best
    ? "No dealer bid. Hold it back and try an all-to-all session."
    : fr.clears
      ? fr.cover && fr.best.b - fr.cover.b > 0.25
        ? "Best is well clear of cover — the winner is likely axed. Good line to trade."
        : "Clears reserve with a tight cover. Fair, competitive level."
      : "Best bid is below reserve. Default is do-not-trade; override only with a reason.";

  return {
    view, setView, filter, setFilter, override, stage, setStage, left, focus, setFocus,
    rows, toggleTrade, shown, trading, totalFace, tradingFace, proceeds, vsMark, bidsIn, bidsMax, belowReserve, winners,
    dealerStats, maxFace, fr, mmss, focusAdvice,
  };
}
