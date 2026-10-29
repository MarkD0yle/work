/* Bond Order Ticket — screen model.
 *
 * Linked price ↔ yield ↔ spread, allocation, economics, risk, pre-trade
 * checks and the edit → review → sent flow, with no styling. Both skins
 * render from useTicket(). */

import { useState } from "react";
import { accrued, bondById, midAnalytics, priceFromYield, pv01, spreadFromYield, yieldFromPrice, yieldFromSpread, type Bond } from "../bonds";
import { readHandoff, writeHandoff } from "../selection";
import { mm, signed, usd } from "../format";
import type { Side } from "../tokens";

export type Field = "price" | "yield" | "spread";
export type OrdType = "limit" | "market" | "work";
export type Tif = "day" | "gtc" | "ioc";
export type Stage = "edit" | "review" | "sent";

export const ORD_TYPES = [
  { id: "limit", label: "Limit" },
  { id: "market", label: "Market" },
  { id: "work", label: "Work" },
] as const;
export const TIFS = [
  { id: "day", label: "Day" },
  { id: "gtc", label: "GTC" },
  { id: "ioc", label: "IOC" },
] as const;
export const SIZE_PRESETS = [1, 2, 5, 10, 25];
export const ROUTES = ["Auto-RFQ (best of 5)", "All-to-all", "Voice · MSX", "Voice · HLB", "Algo · TWAP"];
/** Arrow-key nudge per field. */
export const FIELD_STEP: Record<Field, number> = { price: 0.125, yield: 0.01, spread: 1 };

export type Fund = { name: string; pct: number; cash: number; pos: number; aum: number };
const FUNDS0: Fund[] = [
  { name: "IG CORE FUND", pct: 60, cash: 42_500_000, pos: 8_000_000, aum: 2_400_000_000 },
  { name: "LONG CREDIT", pct: 40, cash: 6_200_000, pos: 3_000_000, aum: 910_000_000 },
  { name: "MULTI-ASSET INC", pct: 0, cash: 18_900_000, pos: 0, aum: 1_350_000_000 },
];

export type WorkingOrder = { id: string; side: Side; bond: string; face: number; filled: number; px: number; route: string };
const WORKING0: WorkingOrder[] = [
  { id: "ORD-77410", side: "Buy", bond: "AAPL-33", face: 10_000_000, filled: 6_000_000, px: 100.95, route: "Auto-RFQ" },
  { id: "ORD-77406", side: "Sell", bond: "PARA-30", face: 5_000_000, filled: 0, px: 96.4, route: "All-to-all" },
  { id: "ORD-77395", side: "Buy", bond: "UNH-35", face: 3_000_000, filled: 3_000_000, px: 101.38, route: "Voice · HLB" },
];

export type Check = { name: string; status: "pass" | "warn" | "fail"; detail: string };

/** Portfolio-level risk before the trade. */
export const PORTFOLIO = { dv01: 184_300, duration: 6.42, sectorWt: 12.4, ratingWt: 31.8, te: 38.2 };

export function useTicket() {
  const init = readHandoff();
  const [bondId, setBondId] = useState(init.bondId);
  const [side, setSideRaw] = useState<Side>(init.side);
  const [faceMM, setFaceMM] = useState(String(init.face / 1e6));
  const bond = bondById(bondId);
  const comp = midAnalytics(bond);
  const bid = bond.mid - 0.125;
  const ask = bond.mid + 0.125;

  const [px, setPx] = useState(() => (init.side === "Buy" ? bondById(init.bondId).mid + 0.125 : bondById(init.bondId).mid - 0.125));
  const [editing, setEditing] = useState<{ f: Field; text: string } | null>(null);
  const [ordType, setOrdType] = useState<OrdType>("limit");
  const [tif, setTif] = useState<Tif>("day");
  const [route, setRoute] = useState(ROUTES[0]);
  const [funds, setFunds] = useState(FUNDS0);
  const [stage, setStage] = useState<Stage>("edit");
  const [working, setWorking] = useState(WORKING0);
  const [seq, setSeq] = useState(77418);

  const face = Math.max(0, Number(faceMM) || 0) * 1e6;
  const effPx = ordType === "market" ? (side === "Buy" ? ask : bid) : px;
  const yld = yieldFromPrice(bond, effPx);
  const sprd = spreadFromYield(bond, yld);
  const ai = accrued(bond);
  const principal = (effPx / 100) * face;
  const accruedAmt = (ai.amount / 100) * face;
  const net = principal + accruedAmt;
  const dv01 = (pv01(bond, yld) / 100) * face;
  const allocTotal = funds.reduce((a, f) => a + f.pct, 0);

  function resetPx(b: Bond, s: Side) {
    setPx(s === "Buy" ? b.mid + 0.125 : b.mid - 0.125);
    setEditing(null);
  }

  function setSide(s: Side) {
    setSideRaw(s);
    resetPx(bond, s);
    setStage("edit");
  }

  function setBond(id: string) {
    setBondId(id);
    resetPx(bondById(id), side);
    setStage("edit");
  }

  function display(f: Field) {
    if (editing?.f === f) return editing.text;
    if (f === "price") return effPx.toFixed(3);
    if (f === "yield") return yld.toFixed(3);
    return sprd.toFixed(1);
  }

  function onField(f: Field, text: string) {
    setEditing({ f, text });
    const v = Number(text);
    if (!text.trim() || !Number.isFinite(v)) return;
    if (f === "price") setPx(v);
    if (f === "yield") setPx(priceFromYield(bond, v));
    if (f === "spread") setPx(priceFromYield(bond, yieldFromSpread(bond, v)));
  }

  function nudge(f: Field, dir: 1 | -1) {
    const v = Number(display(f)) + dir * FIELD_STEP[f];
    onField(f, f === "spread" ? v.toFixed(1) : v.toFixed(3));
  }

  function focusField(f: Field) {
    setEditing({ f, text: display(f) });
  }

  function blurField() {
    setEditing(null);
  }

  function setFundPct(i: number, raw: string) {
    const v = Math.min(100, Math.max(0, Number(raw.replace(/\D/g, "")) || 0));
    setFunds((fs) => fs.map((x, j) => (j === i ? { ...x, pct: v } : x)));
  }

  /* --- Aggressiveness: where the limit sits against the composite --- */
  // Positive = more aggressive (paying up to buy / giving up to sell).
  const throughMid = (side === "Buy" ? effPx - bond.mid : bond.mid - effPx) * 100;
  const vsTouch = (side === "Buy" ? effPx - ask : bid - effPx) * 100;
  const fillProb = Math.max(3, Math.min(98, 50 + throughMid * 3.2));

  /* --- Pre-trade checks --- */
  const checks: Check[] = [];
  const dev = Math.abs(effPx - bond.mid);
  checks.push(
    dev > 2
      ? { name: "Price tolerance", status: "fail", detail: `Limit is ${dev.toFixed(2)} pts from composite mid. Max 2.00 — check for a fat-finger.` }
      : dev > 0.75
        ? { name: "Price tolerance", status: "warn", detail: `${dev.toFixed(2)} pts from mid. Within tolerance but unusual.` }
        : { name: "Price tolerance", status: "pass", detail: `${dev.toFixed(3)} pts from mid.` },
  );
  checks.push(
    allocTotal !== 100
      ? { name: "Allocation", status: "fail", detail: `Fund split adds to ${allocTotal}%. It must equal 100%.` }
      : { name: "Allocation", status: "pass", detail: `${funds.filter((f) => f.pct > 0).length} funds · 100%.` },
  );
  if (side === "Buy") {
    const short = funds.find((f) => (f.pct / 100) * net > f.cash);
    checks.push(
      short
        ? { name: "Cash available", status: "fail", detail: `${short.name} needs $${usd((short.pct / 100) * net)} but has $${usd(short.cash)}.` }
        : { name: "Cash available", status: "pass", detail: "All funds have cash to settle." },
    );
  } else {
    const short = funds.find((f) => (f.pct / 100) * face > f.pos);
    checks.push(
      short
        ? { name: "Position available", status: "fail", detail: `${short.name} holds ${mm(short.pos)} — selling ${mm((short.pct / 100) * face)} would go short.` }
        : { name: "Position available", status: "pass", detail: "Every fund holds enough to deliver." },
    );
  }
  const issuerUse = 61 + (side === "Buy" ? 1 : -1) * Math.round(face / 1e6);
  checks.push(
    issuerUse > 85
      ? { name: "Issuer limit", status: "fail", detail: `${bond.issuer} would be ${issuerUse}% of limit. Hard cap 85%.` }
      : issuerUse > 70
        ? { name: "Issuer limit", status: "warn", detail: `${issuerUse}% of ${bond.issuer} limit after trade.` }
        : { name: "Issuer limit", status: "pass", detail: `${issuerUse}% of limit after trade.` },
  );
  checks.push({ name: "Restricted list", status: "pass", detail: `${bond.ticker} not restricted · no MNPI flags.` });
  const advPct = (face / 1e6 / (bond.liq * 4)) * 100;
  checks.push(
    advPct > 60
      ? { name: "Liquidity", status: "warn", detail: `Size is ${advPct.toFixed(0)}% of 20-day ADV. Consider working it.` }
      : { name: "Liquidity", status: "pass", detail: `Size is ${advPct.toFixed(0)}% of ADV.` },
  );
  checks.push(
    throughMid > 15
      ? { name: "Best execution", status: "warn", detail: `Paying ${throughMid.toFixed(1)}¢ through mid. Record a reason.` }
      : { name: "Best execution", status: "pass", detail: `${signed(throughMid, 1)}¢ vs mid.` },
  );
  if (face === 0) checks.unshift({ name: "Quantity", status: "fail", detail: "Enter a size above zero." });
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  /* --- Impact --- */
  const dir = side === "Buy" ? 1 : -1;
  const fundImpact = funds.map((f) => {
    const chg = (f.pct / 100) * face * dir;
    return { ...f, after: f.pos + chg, wtBp: ((chg * effPx) / 100 / f.aum) * 10_000 };
  });
  const risk = {
    dv01After: PORTFOLIO.dv01 + dir * dv01,
    durationAfter: PORTFOLIO.duration + dir * (dv01 / PORTFOLIO.dv01) * 0.9,
    sectorWt: PORTFOLIO.sectorWt + dir * (face / 1e6) * 0.02,
    ratingWt: PORTFOLIO.ratingWt + dir * (face / 1e6) * 0.015,
    te: PORTFOLIO.te + (side === "Buy" ? -0.4 : 0.6),
  };

  function submit() {
    const id = `ORD-${seq}`;
    setWorking((w) => [{ id, side, bond: bondId, face, filled: 0, px: effPx, route: route.split(" (")[0] }, ...w]);
    setSeq((n) => n + 1);
    setStage("sent");
    writeHandoff({ bondId, side, face });
  }

  const verbing = side === "Buy" ? "BUYING" : "SELLING";

  return {
    bondId, setBond, side, setSide, faceMM, setFaceMM, bond, comp, bid, ask,
    editing, ordType, setOrdType, tif, setTif, route, setRoute, funds, setFundPct, stage, setStage, working,
    face, effPx, yld, sprd, ai, principal, accruedAmt, net, dv01, allocTotal,
    display, onField, nudge, focusField, blurField,
    throughMid, vsTouch, fillProb, checks, fails, warns, fundImpact, risk, submit, verbing,
  };
}
