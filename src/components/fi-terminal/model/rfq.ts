/* Multi-Dealer RFQ — screen model.
 *
 * The request, the dealer competition, the countdown and the execution,
 * with no styling. Both skins render from useRfq(). */

import { useEffect, useState } from "react";
import { DEALERS, bondById, midAnalytics, seeded, type Bond } from "../bonds";
import { readHandoff, writeHandoff } from "../selection";
import type { Side } from "../tokens";

export type Phase = "draft" | "live" | "done" | "expired";

export type Quote = {
  dealer: string;
  delay: number; // seconds until the dealer responds
  pass: boolean;
  price: number;
  size: number;
};

export const SIZES = [1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000];
export const TIMERS = [
  { id: "15", label: "15s" },
  { id: "30", label: "30s" },
  { id: "60", label: "60s" },
] as const;
export type TimerId = (typeof TIMERS)[number]["id"];
export const FUNDS = ["IG CORE FUND", "LONG CREDIT", "MULTI-ASSET INC"];
export const MAX_DEALERS = 5;
export const POSITION = 8_000_000;

export function axesFor(b: Bond) {
  const r = seeded(b.id.length * 97 + Math.round(b.coupon * 1000));
  const axes = DEALERS.filter(() => r() < 0.3).map((d) => ({ code: d.code, side: (r() < 0.5 ? "Buy" : "Sell") as Side, size: 2 + Math.floor(r() * 20) }));
  // Every bond has at least one axed dealer — the street always has a view.
  return axes.length ? axes : [{ code: DEALERS[3].code, side: "Sell" as Side, size: 10 }];
}

function buildQuotes(b: Bond, side: Side, face: number, dealers: string[], seed: number): Quote[] {
  const r = seeded(seed);
  const axes = axesFor(b);
  const half = 0.06 + (10 - b.liq) * 0.025 + (face >= 10_000_000 ? 0.04 : 0);
  return dealers.map((code) => {
    // An axe that matches our flow (they want to sell when we buy) means a sharper price.
    const axed = axes.some((a) => a.code === code && a.side !== side);
    const edge = (axed ? -0.05 : 0) + r() * 0.09 - 0.02;
    const px = side === "Buy" ? b.mid + half + edge : b.mid - half - edge;
    return {
      dealer: code,
      delay: 1.2 + r() * 9,
      pass: !axed && r() < 0.16,
      price: Math.round(px * 1000) / 1000,
      size: face,
    };
  });
}

/** Mock TRACE prints for a bond, newest first. */
export function tracePrints(bond: Bond) {
  const r = seeded(bond.outstanding + bond.id.length);
  return Array.from({ length: 12 }, () => {
    const side = r() < 0.5 ? "B" : "S";
    const px = bond.mid + (side === "B" ? 0.08 : -0.08) + (r() - 0.5) * 0.18;
    const size = r() < 0.3 ? "5MM+" : `${(0.25 + Math.floor(r() * 18) * 0.25).toFixed(2)}MM`;
    return { side, px, size };
  }).map((p, i) => {
    // Newest first: walk back from 15:58 in uneven steps.
    const mins = 15 * 60 + 58 - Math.round(i * 23 + r() * 15);
    return { ...p, time: `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}` };
  });
}

export function useRfq() {
  const init = readHandoff();
  const [bondId, setBondId] = useState(init.bondId);
  const [side, setSide] = useState<Side>(init.side);
  const [face, setFace] = useState(init.face);
  const [fund, setFund] = useState(FUNDS[0]);
  const [timer, setTimer] = useState<TimerId>("30");
  const [picked, setPicked] = useState<string[]>(["MSX", "HLB", "CRN", "VTX", "BRK"]);

  const [phase, setPhase] = useState<Phase>("draft");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [filled, setFilled] = useState<{ q: Quote; at: number } | null>(null);
  const [rfqNo, setRfqNo] = useState(40217);

  const bond = bondById(bondId);
  const comp = midAnalytics(bond);
  const axes = axesFor(bond);
  const limit = Number(timer);
  const remaining = Math.max(0, limit - elapsed);

  useEffect(() => {
    if (phase !== "live") return;
    // The clock starts when the RFQ goes live; reading it here keeps render pure.
    const startedAt = Date.now();
    const id = setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      setElapsed(e);
      if (e >= limit) setPhase("expired");
    }, 100);
    return () => clearInterval(id);
  }, [phase, limit]);

  // Escape cancels a live RFQ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "live") setPhase("expired");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const visible = quotes.filter((q) => elapsed >= q.delay || phase === "done" || phase === "expired");
  const responded = quotes.filter((q) => elapsed >= q.delay);
  const live = visible
    .filter((q) => !q.pass && elapsed >= q.delay)
    .sort((a, b) => (side === "Buy" ? a.price - b.price : b.price - a.price));
  const best = live[0];
  const cover = live[1];
  /** Quotes in display order: ranked live quotes first, then the rest by arrival. */
  const ordered = [...quotes].sort((a, b) => {
    const ra = live.indexOf(a);
    const rb = live.indexOf(b);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || a.delay - b.delay;
  });

  const editable = phase === "draft";

  function send() {
    setQuotes(buildQuotes(bond, side, face, picked, rfqNo + face / 1e6 + (side === "Buy" ? 1 : 2)));
    setElapsed(0);
    setFilled(null);
    setPhase("live");
    writeHandoff({ bondId, side, face });
  }

  function execute(q: Quote) {
    setFilled({ q, at: elapsed });
    setPhase("done");
  }

  function reset() {
    setPhase("draft");
    setQuotes([]);
    setElapsed(0);
    setFilled(null);
    setRfqNo((n) => n + 1);
  }

  function toggleDealer(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length >= MAX_DEALERS ? p : [...p, code]));
  }

  const verb = side === "Buy" ? "Lift" : "Hit";
  const compSide = side === "Buy" ? bond.mid + 0.125 : bond.mid - 0.125;
  /** Quote vs composite in cents; positive = better than composite for us. */
  const vsComp = (price: number) => (side === "Buy" ? compSide - price : price - compSide) * 100;
  const fillCover = filled ? (cover && cover !== filled.q ? cover : live.find((l) => l !== filled.q)) : undefined;
  const positionAfter = side === "Buy" ? POSITION + face : Math.max(0, POSITION - face);
  const goesShort = side === "Sell" && face > POSITION;
  const issuerUse = side === "Buy" ? 61 + Math.round(face / 1e6) : 61 - Math.round(face / 1e6);

  return {
    bondId, setBondId, side, setSide, face, setFace, fund, setFund, timer, setTimer, picked,
    phase, quotes, elapsed, filled, rfqNo, bond, comp, axes, limit, remaining,
    visible, responded, live, best, cover, ordered, editable,
    send, execute, reset, toggleDealer, verb, compSide, vsComp, fillCover, positionAfter, goesShort, issuerUse,
  };
}
