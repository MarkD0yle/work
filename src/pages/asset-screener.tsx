/* This page co-locates the shared screener engine (universes, factor configs,
   filters) which the sibling "Asset Screener — Upgrade" page imports. That mix
   of value + component exports trips react-refresh's single-export rule; the
   only cost is a full reload on edit here, which is acceptable for a shared
   module in this design workspace. */
/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type SideBarDef,
  type StatusPanelDef,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";

// Enterprise bundle (includes Community). No license key is set, so the grid
// runs in evaluation mode and logs the standard watermark notice — expected
// for an internal design workspace.
ModuleRegistry.registerModules([AllEnterpriseModule]);

export const title = "Asset Screener";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* ================================================================== */
/*  Shared model                                                       */
/* ================================================================== */

export type AssetClass = "equity" | "bond" | "commodity";
type Signal = "BUY" | "HOLD" | "SELL";

// One flat row shape carries every asset class; class-specific fields are
// optional and only populated for the relevant universe.
export interface Row {
  id: string;
  assetClass: AssetClass;
  ticker: string;
  name: string;
  category: string; // sector (equity/bond) or group (commodity)
  price: number;
  chg: number; // 1d %
  score: number; // composite 0-100
  signal: Signal;
  // equity
  region?: string;
  mktCap?: number;
  pe?: number;
  evEbitda?: number;
  divYield?: number;
  beta?: number;
  mom12?: number;
  vol30?: number;
  roe?: number;
  ndEbitda?: number;
  esg?: number;
  // bond
  rating?: string;
  ratingRank?: number; // 0=AAA … 5=B
  coupon?: number;
  maturity?: number;
  duration?: number;
  ytm?: number;
  gSpread?: number;
  oas?: number;
  convexity?: number;
  liquidity?: number;
  issuerType?: string;
  couponType?: string;
  couponFreq?: string;
  outstanding?: number; // $mm face outstanding
  issueCurrency?: string;
  source?: string;
  // commodity
  mom3?: number;
  vol?: number;
  rollYield?: number;
  openInterest?: number; // k contracts
  curve?: "Backwardation" | "Contango";
  seasonality?: number;
}

/* ---- deterministic PRNG ----------------------------------------- */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Percentile rank (0..1); higher = better.
function ranker<T>(rows: T[], get: (t: T) => number, higherBetter: boolean) {
  const sorted = [...rows].sort((a, b) => get(a) - get(b));
  const m = new Map<T, number>();
  sorted.forEach((r, i) => {
    const p = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
    m.set(r, higherBetter ? p : 1 - p);
  });
  return m;
}

function signalFor(score: number): Signal {
  return score >= 68 ? "BUY" : score >= 45 ? "HOLD" : "SELL";
}

/* ================================================================== */
/*  Equity universe                                                    */
/* ================================================================== */

type EqSector =
  | "Technology"
  | "Communication"
  | "Consumer Disc"
  | "Consumer Staples"
  | "Health Care"
  | "Financials"
  | "Industrials"
  | "Energy"
  | "Materials"
  | "Utilities"
  | "Real Estate";

const EQ_SECTORS: EqSector[] = [
  "Technology",
  "Communication",
  "Consumer Disc",
  "Consumer Staples",
  "Health Care",
  "Financials",
  "Industrials",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
];

const EQ_PROFILE: Record<EqSector, { pe: number; beta: number; vol: number; div: number; roe: number; mom: number; nd: number }> = {
  Technology: { pe: 32, beta: 1.25, vol: 34, div: 0.6, roe: 28, mom: 24, nd: 0.6 },
  Communication: { pe: 22, beta: 1.1, vol: 30, div: 0.9, roe: 20, mom: 18, nd: 1.2 },
  "Consumer Disc": { pe: 26, beta: 1.2, vol: 32, div: 0.9, roe: 22, mom: 14, nd: 1.4 },
  "Consumer Staples": { pe: 22, beta: 0.6, vol: 16, div: 2.8, roe: 24, mom: 6, nd: 1.6 },
  "Health Care": { pe: 20, beta: 0.8, vol: 22, div: 1.8, roe: 22, mom: 10, nd: 1.1 },
  Financials: { pe: 13, beta: 1.15, vol: 26, div: 2.6, roe: 14, mom: 12, nd: 0.5 },
  Industrials: { pe: 20, beta: 1.05, vol: 24, div: 1.6, roe: 18, mom: 12, nd: 1.5 },
  Energy: { pe: 11, beta: 1.1, vol: 34, div: 3.8, roe: 16, mom: 8, nd: 1.2 },
  Materials: { pe: 15, beta: 1.1, vol: 28, div: 2.2, roe: 15, mom: 6, nd: 1.6 },
  Utilities: { pe: 18, beta: 0.5, vol: 16, div: 3.6, roe: 10, mom: 4, nd: 3.2 },
  "Real Estate": { pe: 30, beta: 0.9, vol: 24, div: 3.4, roe: 9, mom: 2, nd: 3.6 },
};

const EQ_INSTRUMENTS: [string, string, EqSector, string][] = [
  ["AAPL", "Apple Inc.", "Technology", "US"],
  ["MSFT", "Microsoft Corp.", "Technology", "US"],
  ["NVDA", "NVIDIA Corp.", "Technology", "US"],
  ["AVGO", "Broadcom Inc.", "Technology", "US"],
  ["ORCL", "Oracle Corp.", "Technology", "US"],
  ["ASML", "ASML Holding NV", "Technology", "Europe"],
  ["TSM", "Taiwan Semiconductor", "Technology", "EM"],
  ["GOOGL", "Alphabet Inc.", "Communication", "US"],
  ["META", "Meta Platforms Inc.", "Communication", "US"],
  ["NFLX", "Netflix Inc.", "Communication", "US"],
  ["AMZN", "Amazon.com Inc.", "Consumer Disc", "US"],
  ["TSLA", "Tesla Inc.", "Consumer Disc", "US"],
  ["HD", "Home Depot Inc.", "Consumer Disc", "US"],
  ["MC", "LVMH", "Consumer Disc", "Europe"],
  ["7203", "Toyota Motor Corp.", "Consumer Disc", "Japan"],
  ["PG", "Procter & Gamble", "Consumer Staples", "US"],
  ["KO", "Coca-Cola Co.", "Consumer Staples", "US"],
  ["COST", "Costco Wholesale", "Consumer Staples", "US"],
  ["NESN", "Nestlé SA", "Consumer Staples", "Europe"],
  ["UNH", "UnitedHealth Group", "Health Care", "US"],
  ["JNJ", "Johnson & Johnson", "Health Care", "US"],
  ["LLY", "Eli Lilly & Co.", "Health Care", "US"],
  ["NVO", "Novo Nordisk A/S", "Health Care", "Europe"],
  ["JPM", "JPMorgan Chase & Co.", "Financials", "US"],
  ["BAC", "Bank of America", "Financials", "US"],
  ["GS", "Goldman Sachs Group", "Financials", "US"],
  ["V", "Visa Inc.", "Financials", "US"],
  ["HSBA", "HSBC Holdings plc", "Financials", "UK"],
  ["CAT", "Caterpillar Inc.", "Industrials", "US"],
  ["HON", "Honeywell Intl.", "Industrials", "US"],
  ["GE", "GE Aerospace", "Industrials", "US"],
  ["XOM", "Exxon Mobil Corp.", "Energy", "US"],
  ["CVX", "Chevron Corp.", "Energy", "US"],
  ["SHEL", "Shell plc", "Energy", "UK"],
  ["LIN", "Linde plc", "Materials", "US"],
  ["FCX", "Freeport-McMoRan", "Materials", "US"],
  ["NEE", "NextEra Energy", "Utilities", "US"],
  ["DUK", "Duke Energy Corp.", "Utilities", "US"],
  ["SO", "Southern Co.", "Utilities", "US"],
  ["PLD", "Prologis Inc.", "Real Estate", "US"],
  ["AMT", "American Tower Corp.", "Real Estate", "US"],
];

function buildEquity(): Row[] {
  const rng = mulberry32(0x5a17e);
  const j = (b: number, s: number) => b + (rng() - 0.5) * s;
  const base = EQ_INSTRUMENTS.map(([ticker, name, sector, region]) => {
    const p = EQ_PROFILE[sector];
    const pe = Math.max(5, j(p.pe, p.pe));
    const vol30 = Math.max(10, j(p.vol, 14));
    return {
      id: `EQ-${ticker}`,
      assetClass: "equity" as const,
      ticker,
      name,
      category: sector,
      region,
      price: Math.round(j(300, 540) * 100) / 100,
      chg: Math.round((rng() - 0.48) * (vol30 / 9) * 100) / 100,
      mktCap: Math.round((15 + Math.pow(rng(), 1.7) * 2800) * 10) / 10,
      pe: Math.round(pe * 10) / 10,
      evEbitda: Math.round(Math.max(3, pe * 0.6 + (rng() - 0.5) * 6) * 10) / 10,
      divYield: Math.round(Math.max(0, j(p.div, 2)) * 100) / 100,
      beta: Math.round(Math.max(0.3, j(p.beta, 0.5)) * 100) / 100,
      mom12: Math.round(j(p.mom, 60) * 10) / 10,
      vol30: Math.round(vol30 * 10) / 10,
      roe: Math.round(Math.max(-6, j(p.roe, 16)) * 10) / 10,
      ndEbitda: Math.round(Math.max(-1, j(p.nd, 2)) * 10) / 10,
      esg: Math.round(j(60, 52)),
      score: 0,
      signal: "HOLD" as Signal,
    };
  });

  const rV1 = ranker(base, (s) => s.pe!, false);
  const rV2 = ranker(base, (s) => s.evEbitda!, false);
  const rQ1 = ranker(base, (s) => s.roe!, true);
  const rQ2 = ranker(base, (s) => s.ndEbitda!, false);
  const rM = ranker(base, (s) => s.mom12!, true);
  const rY = ranker(base, (s) => s.divYield!, true);
  const rVol = ranker(base, (s) => s.vol30!, false);
  const rB = ranker(base, (s) => s.beta!, false);

  return base.map((s) => {
    const value = ((rV1.get(s)! + rV2.get(s)!) / 2) * 100;
    const quality = ((rQ1.get(s)! + rQ2.get(s)!) / 2) * 100;
    const momentum = rM.get(s)! * 100;
    const yield_ = rY.get(s)! * 100;
    const lowVol = ((rVol.get(s)! + rB.get(s)!) / 2) * 100;
    const score = Math.round(value * 0.25 + quality * 0.25 + momentum * 0.2 + yield_ * 0.15 + lowVol * 0.15);
    return { ...s, score, signal: signalFor(score) };
  });
}

/* ================================================================== */
/*  Bond universe                                                      */
/* ================================================================== */

const RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B"] as const;
type BondSector = "Sovereign" | "Financials" | "Energy" | "Utilities" | "Tech" | "Industrials" | "Consumer" | "Health Care";

const BOND_SECTORS: BondSector[] = ["Sovereign", "Financials", "Energy", "Utilities", "Tech", "Industrials", "Consumer", "Health Care"];

const BOND_ISSUERS: [string, string, BondSector, number][] = [
  // ticker, name, sector, ratingRank(anchor)
  ["UST", "US Treasury", "Sovereign", 0],
  ["BUND", "German Bund", "Sovereign", 0],
  ["JGB", "Japan Govt Bond", "Sovereign", 1],
  ["JPM", "JPMorgan Chase", "Financials", 2],
  ["GS", "Goldman Sachs", "Financials", 2],
  ["BAC", "Bank of America", "Financials", 2],
  ["HSBC", "HSBC Holdings", "Financials", 2],
  ["XOM", "Exxon Mobil", "Energy", 1],
  ["SHEL", "Shell plc", "Energy", 2],
  ["OXY", "Occidental Pet.", "Energy", 3],
  ["DUK", "Duke Energy", "Utilities", 3],
  ["NEE", "NextEra Energy", "Utilities", 2],
  ["AAPL", "Apple Inc.", "Tech", 1],
  ["ORCL", "Oracle Corp.", "Tech", 3],
  ["CAT", "Caterpillar", "Industrials", 2],
  ["BA", "Boeing Co.", "Industrials", 4],
  ["F", "Ford Motor", "Consumer", 4],
  ["KO", "Coca-Cola Co.", "Consumer", 2],
  ["CVS", "CVS Health", "Health Care", 3],
  ["TMUS", "T-Mobile US", "Consumer", 3],
];

function buildBond(): Row[] {
  const rng = mulberry32(0xb04d);
  const base: Row[] = [];
  for (const [ticker, name, sector, anchorRank] of BOND_ISSUERS) {
    const nMat = 2 + Math.floor(rng() * 2); // 2-3 maturities
    for (let k = 0; k < nMat; k++) {
      const matYear = 2027 + Math.floor(rng() * 24); // 2027..2050
      const duration = Math.round(Math.min(matYear - 2025, 20) * 0.9 * 10) / 10;
      const ratingRank = Math.max(0, Math.min(5, anchorRank + (rng() > 0.7 ? 1 : 0)));
      const rating = RATINGS[ratingRank];
      // higher credit risk & longer duration => higher yield
      const ytm = Math.round((3.8 + ratingRank * 0.55 + duration * 0.05 + (rng() - 0.5) * 0.4) * 100) / 100;
      const gSpread = Math.round(30 + ratingRank * 55 + (rng() - 0.5) * 40 + duration * 1.5);
      const liquidity = Math.round(35 + (5 - ratingRank) * 8 + rng() * 30);
      const ctPick = rng();
      const couponType = ctPick < 0.08 ? "Zero" : ctPick < 0.22 ? "Floating" : "Fixed";
      const coupon = couponType === "Zero" ? 0 : Math.round((ytm - 0.4 + (rng() - 0.5) * 0.8) * 8) / 8;
      const curPick = rng();
      const issueCurrency =
        curPick < 0.4 ? "USD" : curPick < 0.7 ? "EUR" : curPick < 0.82 ? "GBP" : curPick < 0.9 ? "JPY" : curPick < 0.96 ? "CAD" : "DKK";
      const issuerType =
        sector === "Sovereign"
          ? rng() < 0.5
            ? "Sovereign"
            : rng() < 0.75
              ? "Agency"
              : "Supranational"
          : rng() < 0.85
            ? "Corporate"
            : "Municipal";
      const couponFreq = issueCurrency === "EUR" ? "Annual" : rng() < 0.8 ? "Semi-Annual" : "Quarterly";
      const source = ["SWB", "MUN", "DUS", "OTCB", "FWB"][Math.floor(rng() * 5)];
      const outstanding = Math.round(200 + rng() * 4800);
      base.push({
        id: `BD-${ticker}-${matYear}`,
        assetClass: "bond",
        ticker,
        name,
        category: sector,
        price: Math.round((100 - (ytm - coupon) * duration * 0.6 + (rng() - 0.5) * 3) * 100) / 100,
        chg: Math.round((rng() - 0.5) * 0.4 * 100) / 100,
        rating,
        ratingRank,
        coupon,
        maturity: matYear,
        duration,
        ytm,
        gSpread,
        oas: gSpread - Math.round(4 + rng() * 10),
        convexity: Math.round((duration * duration * 0.04 + rng()) * 100) / 100,
        liquidity,
        issuerType,
        couponType,
        couponFreq,
        outstanding,
        issueCurrency,
        source,
        score: 0,
        signal: "HOLD",
      });
    }
  }

  const rCarry = ranker(base, (b) => b.ytm!, true);
  const rValue = ranker(base, (b) => b.gSpread!, true);
  const rQual = ranker(base, (b) => b.ratingRank!, false);
  const rLiq = ranker(base, (b) => b.liquidity!, true);
  const rDur = ranker(base, (b) => b.duration!, false);

  return base.map((b) => {
    const score = Math.round(
      rCarry.get(b)! * 100 * 0.3 +
        rValue.get(b)! * 100 * 0.25 +
        rQual.get(b)! * 100 * 0.2 +
        rLiq.get(b)! * 100 * 0.15 +
        rDur.get(b)! * 100 * 0.1,
    );
    return { ...b, score, signal: signalFor(score) };
  });
}

/* ================================================================== */
/*  Commodity universe                                                 */
/* ================================================================== */

type CmdGroup = "Energy" | "Precious Metals" | "Base Metals" | "Agriculture" | "Livestock";
const CMD_GROUPS: CmdGroup[] = ["Energy", "Precious Metals", "Base Metals", "Agriculture", "Livestock"];

const CMD_LIST: [string, string, CmdGroup, number][] = [
  // ticker, name, group, anchorPrice
  ["CL", "WTI Crude Oil", "Energy", 78],
  ["CO", "Brent Crude", "Energy", 82],
  ["NG", "Natural Gas", "Energy", 2.9],
  ["RB", "RBOB Gasoline", "Energy", 2.4],
  ["HO", "Heating Oil", "Energy", 2.6],
  ["GC", "Gold", "Precious Metals", 2350],
  ["SI", "Silver", "Precious Metals", 29],
  ["PL", "Platinum", "Precious Metals", 980],
  ["PA", "Palladium", "Precious Metals", 1010],
  ["HG", "Copper", "Base Metals", 4.4],
  ["ALI", "Aluminum", "Base Metals", 2500],
  ["ZS", "Zinc", "Base Metals", 2800],
  ["NI", "Nickel", "Base Metals", 17500],
  ["C", "Corn", "Agriculture", 4.3],
  ["W", "Wheat", "Agriculture", 5.6],
  ["S", "Soybeans", "Agriculture", 11.8],
  ["SB", "Sugar", "Agriculture", 0.19],
  ["KC", "Coffee", "Agriculture", 2.3],
  ["CT", "Cotton", "Agriculture", 0.72],
  ["CC", "Cocoa", "Agriculture", 7800],
  ["LC", "Live Cattle", "Livestock", 1.85],
  ["LH", "Lean Hogs", "Livestock", 0.9],
  ["FC", "Feeder Cattle", "Livestock", 2.5],
];

const CMD_VOL: Record<CmdGroup, number> = {
  Energy: 38,
  "Precious Metals": 18,
  "Base Metals": 26,
  Agriculture: 24,
  Livestock: 20,
};

function buildCommodity(): Row[] {
  const rng = mulberry32(0xc0ffee);
  const j = (b: number, s: number) => b + (rng() - 0.5) * s;
  const base: Row[] = CMD_LIST.map(([ticker, name, group, anchor]) => {
    const vol = Math.max(10, j(CMD_VOL[group], 12));
    const rollYield = Math.round(j(0, 14) * 10) / 10; // +ve backwardation
    return {
      id: `CM-${ticker}`,
      assetClass: "commodity" as const,
      ticker,
      name,
      category: group,
      price: Math.round(anchor * (1 + (rng() - 0.5) * 0.05) * 100) / 100,
      chg: Math.round((rng() - 0.5) * (vol / 8) * 100) / 100,
      mom3: Math.round(j(4, 50) * 10) / 10,
      vol: Math.round(vol * 10) / 10,
      rollYield,
      openInterest: Math.round(50 + rng() * 900),
      curve: (rollYield >= 0 ? "Backwardation" : "Contango") as Row["curve"],
      seasonality: Math.round((rng() - 0.5) * 200),
      score: 0,
      signal: "HOLD" as Signal,
    };
  });

  const rMom = ranker(base, (c) => c.mom3!, true);
  const rCarry = ranker(base, (c) => c.rollYield!, true);
  const rVol = ranker(base, (c) => c.vol!, false);
  const rLiq = ranker(base, (c) => c.openInterest!, true);

  return base.map((c) => {
    const score = Math.round(
      rMom.get(c)! * 100 * 0.35 + rCarry.get(c)! * 100 * 0.25 + rVol.get(c)! * 100 * 0.2 + rLiq.get(c)! * 100 * 0.2,
    );
    return { ...c, score, signal: signalFor(score) };
  });
}

export const UNIVERSES: Record<AssetClass, Row[]> = {
  equity: buildEquity(),
  bond: buildBond(),
  commodity: buildCommodity(),
};

/* ================================================================== */
/*  Formatters + renderers                                             */
/* ================================================================== */

const nf1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type VFP = ValueFormatterParams<Row, number>;
const fCap = (p: VFP) => (p.value == null ? "" : `$${p.value >= 100 ? Math.round(p.value) : nf1.format(p.value)}bn`);
const fX = (p: VFP) => (p.value == null ? "" : `${nf1.format(p.value)}×`);
const fPct = (p: VFP) => (p.value == null ? "" : `${nf1.format(p.value)}%`);
const fBps = (p: VFP) => (p.value == null ? "" : `${Math.round(p.value)}bp`);
const fNum2 = (p: VFP) => (p.value == null ? "" : nf2.format(p.value));
const fInt = (p: VFP) => (p.value == null ? "" : Math.round(p.value).toLocaleString());

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide";

const CAT_STYLE: Record<string, string> = {
  Technology: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  Tech: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  Communication: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  "Consumer Disc": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "Consumer Staples": "bg-lime-50 text-lime-700 ring-1 ring-lime-200",
  Consumer: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "Health Care": "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  Financials: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  Industrials: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  Energy: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  Materials: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
  Utilities: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  "Real Estate": "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  Sovereign: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  "Precious Metals": "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  "Base Metals": "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
  Agriculture: "bg-green-50 text-green-700 ring-1 ring-green-200",
  Livestock: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function CatCell({ value }: ICellRendererParams<Row, string>) {
  if (!value) return null;
  return <span className={`${chip} ${CAT_STYLE[value] ?? "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"}`}>{value}</span>;
}

function InstrumentCell({ data }: ICellRendererParams<Row>) {
  if (!data) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[13px] font-semibold text-neutral-900">{data.ticker}</span>
      <span className="truncate text-[11px] text-neutral-500">{data.name}</span>
    </div>
  );
}

function ColoredNum({ value, suffix = "%", digits = 1 }: { value: number | null | undefined; suffix?: string; digits?: number }) {
  if (value == null) return null;
  const cls = value === 0 ? "text-neutral-500" : value > 0 ? "text-emerald-600" : "text-rose-600";
  return (
    <span className={`font-mono tabular-nums ${cls}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(digits)}
      {suffix}
    </span>
  );
}
const ChgCell = (p: ICellRendererParams<Row, number>) => <ColoredNum value={p.value} digits={2} />;
const MomCell = (p: ICellRendererParams<Row, number>) => <ColoredNum value={p.value} digits={1} />;
const RollCell = (p: ICellRendererParams<Row, number>) => <ColoredNum value={p.value} digits={1} />;

function ScoreCell({ value }: ICellRendererParams<Row, number>) {
  if (value == null) return null;
  const tone = value >= 68 ? "bg-emerald-500" : value >= 45 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[12px] tabular-nums text-neutral-700">{value}</span>
    </div>
  );
}

const SIGNAL_STYLE: Record<Signal, string> = {
  BUY: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  HOLD: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  SELL: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};
function SignalCell({ value }: ICellRendererParams<Row, Signal>) {
  if (!value) return null;
  return <span className={`${chip} ${SIGNAL_STYLE[value]}`}>{value}</span>;
}

const RATING_STYLE = (r?: string) => {
  if (!r) return "bg-neutral-100 text-neutral-600";
  if (r === "AAA" || r === "AA") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (r === "A" || r === "BBB") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200"; // HY
};
function RatingCell({ value }: ICellRendererParams<Row, string>) {
  if (!value) return null;
  return <span className={`${chip} ${RATING_STYLE(value)}`}>{value}</span>;
}
function CurveCell({ value }: ICellRendererParams<Row, string>) {
  if (!value) return null;
  const back = value === "Backwardation";
  return <span className={`${chip} ${back ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{back ? "Backwardtn" : "Contango"}</span>;
}

const priceCell = { valueFormatter: fNum2 as (p: VFP) => string, cellClass: "font-mono tabular-nums" };

/* ================================================================== */
/*  Filters + presets per class                                        */
/* ================================================================== */

export interface FilterDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number; // neutral (passes all)
  format: (v: number) => string;
  apply: (r: Row, v: number) => boolean;
}

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  nums: Record<string, number>;
  minScore?: number;
}

// A categorical constraint (issuer type, currency, coupon type…): user picks
// any subset of `options`; empty selection passes everything.
export interface CatFilter {
  id: string;
  label: string;
  get: (r: Row) => string;
  options: string[];
}

export interface ClassConfig {
  id: AssetClass;
  label: string;
  icon: string;
  categoryLabel: string;
  categories: string[];
  columns: ColDef<Row>[];
  filters: FilterDef[];
  catFilters?: CatFilter[];
  presets: Preset[];
  weightsNote: string;
  kpiExtra: (rows: Row[]) => { label: string; value: string };
}

/* ---- equity config ---------------------------------------------- */

const EQUITY_CONFIG: ClassConfig = {
  id: "equity",
  label: "Equity",
  icon: "📈",
  categoryLabel: "Sector",
  categories: EQ_SECTORS,
  columns: [
    { headerName: "Instrument", field: "ticker", pinned: "left", minWidth: 230, cellRenderer: InstrumentCell },
    { headerName: "Sector", field: "category", width: 150, cellRenderer: CatCell, enableRowGroup: true },
    { headerName: "Region", field: "region", width: 100, enableRowGroup: true },
    { headerName: "Price", field: "price", type: "numericColumn", width: 100, ...priceCell },
    { headerName: "1D", field: "chg", type: "numericColumn", width: 90, cellRenderer: ChgCell },
    { headerName: "Mkt Cap", field: "mktCap", type: "numericColumn", width: 110, valueFormatter: fCap, cellClass: "font-mono tabular-nums" },
    { headerName: "P/E", field: "pe", type: "numericColumn", width: 90, valueFormatter: fX, cellClass: "font-mono tabular-nums" },
    { headerName: "EV/EBITDA", field: "evEbitda", type: "numericColumn", width: 110, valueFormatter: fX, cellClass: "font-mono tabular-nums" },
    { headerName: "Div Yld", field: "divYield", type: "numericColumn", width: 100, valueFormatter: fPct, cellClass: "font-mono tabular-nums" },
    { headerName: "Beta", field: "beta", type: "numericColumn", width: 90, valueFormatter: fNum2, cellClass: "font-mono tabular-nums" },
    { headerName: "12M Mom", field: "mom12", type: "numericColumn", width: 110, cellRenderer: MomCell },
    { headerName: "Vol 30D", field: "vol30", type: "numericColumn", width: 100, valueFormatter: fPct, cellClass: "font-mono tabular-nums" },
    { headerName: "ROE", field: "roe", type: "numericColumn", width: 90, valueFormatter: fPct, cellClass: "font-mono tabular-nums" },
    { headerName: "ESG", field: "esg", type: "numericColumn", width: 80, cellClass: "font-mono tabular-nums" },
    { headerName: "Composite", field: "score", width: 150, sort: "desc", cellRenderer: ScoreCell },
    { headerName: "Signal", field: "signal", width: 100, cellRenderer: SignalCell },
  ],
  filters: [
    { key: "minMktCap", label: "Min market cap", min: 0, max: 1000, step: 10, def: 0, format: (v) => (v === 0 ? "Any" : `$${v}bn`), apply: (r, v) => (r.mktCap ?? 0) >= v },
    { key: "maxPE", label: "Max P/E", min: 5, max: 60, step: 1, def: 60, format: (v) => (v >= 60 ? "Any" : `${v}×`), apply: (r, v) => (r.pe ?? 0) <= v },
    { key: "minDivYield", label: "Min div yield", min: 0, max: 6, step: 0.25, def: 0, format: (v) => (v === 0 ? "Any" : `${nf1.format(v)}%`), apply: (r, v) => (r.divYield ?? 0) >= v },
    { key: "maxBeta", label: "Max beta", min: 0.4, max: 2.2, step: 0.05, def: 2.2, format: (v) => (v >= 2.2 ? "Any" : nf2.format(v)), apply: (r, v) => (r.beta ?? 0) <= v },
    { key: "minMom", label: "Min 12M momentum", min: -40, max: 60, step: 5, def: -40, format: (v) => (v <= -40 ? "Any" : `${v > 0 ? "+" : ""}${v}%`), apply: (r, v) => (r.mom12 ?? 0) >= v },
    { key: "maxVol", label: "Max 30D vol", min: 12, max: 60, step: 1, def: 60, format: (v) => (v >= 60 ? "Any" : `${v}%`), apply: (r, v) => (r.vol30 ?? 0) <= v },
    { key: "minROE", label: "Min ROE", min: -10, max: 40, step: 1, def: -10, format: (v) => (v <= -10 ? "Any" : `${v}%`), apply: (r, v) => (r.roe ?? 0) >= v },
  ],
  presets: [
    { id: "quality-value", label: "Quality Value", blurb: "Cheap multiples, strong ROE", nums: { maxPE: 20, minROE: 15 }, minScore: 55 },
    { id: "high-momentum", label: "High Momentum", blurb: "12m leaders, contained vol", nums: { minMom: 25, maxVol: 40 }, minScore: 55 },
    { id: "dividend-income", label: "Dividend Income", blurb: "Yield ≥ 3%, lower beta", nums: { minDivYield: 3, maxBeta: 1.1 } },
    { id: "low-vol", label: "Low Vol Defensive", blurb: "Beta ≤ 0.9, muted vol", nums: { maxBeta: 0.9, maxVol: 24 } },
    { id: "deep-value", label: "Deep Value", blurb: "P/E ≤ 12", nums: { maxPE: 12, minDivYield: 1.5 } },
  ],
  weightsNote: "Composite: value 25% · quality 25% · momentum 20% · yield 15% · low-vol 15%.",
  kpiExtra: (rows) => {
    if (!rows.length) return { label: "Median P/E", value: "—" };
    const pes = rows.map((r) => r.pe ?? 0).sort((a, b) => a - b);
    return { label: "Median P/E", value: `${nf1.format(pes[Math.floor((rows.length - 1) / 2)])}×` };
  },
};

/* ---- bond config ------------------------------------------------ */

const BOND_CONFIG: ClassConfig = {
  id: "bond",
  label: "Bond",
  icon: "🏦",
  categoryLabel: "Sector",
  categories: BOND_SECTORS,
  columns: [
    { headerName: "Issuer", field: "ticker", pinned: "left", minWidth: 220, cellRenderer: InstrumentCell },
    { headerName: "Sector", field: "category", width: 130, cellRenderer: CatCell, enableRowGroup: true },
    { headerName: "Issuer Type", field: "issuerType", width: 130, enableRowGroup: true },
    { headerName: "Rating", field: "rating", width: 100, cellRenderer: RatingCell, enableRowGroup: true },
    { headerName: "Ccy", field: "issueCurrency", width: 80, enableRowGroup: true },
    { headerName: "Coupon", field: "coupon", type: "numericColumn", width: 100, valueFormatter: fPct, cellClass: "font-mono tabular-nums" },
    { headerName: "Maturity", field: "maturity", type: "numericColumn", width: 100, cellClass: "font-mono tabular-nums" },
    { headerName: "Duration", field: "duration", type: "numericColumn", width: 100, valueFormatter: fNum2, cellClass: "font-mono tabular-nums" },
    { headerName: "YTM", field: "ytm", type: "numericColumn", width: 100, valueFormatter: fPct, cellClass: "font-mono tabular-nums" },
    { headerName: "G-Spread", field: "gSpread", type: "numericColumn", width: 110, valueFormatter: fBps, cellClass: "font-mono tabular-nums" },
    { headerName: "OAS", field: "oas", type: "numericColumn", width: 90, valueFormatter: fBps, cellClass: "font-mono tabular-nums" },
    { headerName: "Convex", field: "convexity", type: "numericColumn", width: 100, valueFormatter: fNum2, cellClass: "font-mono tabular-nums" },
    { headerName: "$ Price", field: "price", type: "numericColumn", width: 100, ...priceCell },
    { headerName: "Coupon Type", field: "couponType", width: 120 },
    { headerName: "Freq", field: "couponFreq", width: 120 },
    { headerName: "Outst ($mm)", field: "outstanding", type: "numericColumn", width: 120, valueFormatter: fInt, cellClass: "font-mono tabular-nums" },
    { headerName: "Source", field: "source", width: 90 },
    { headerName: "Liq", field: "liquidity", type: "numericColumn", width: 80, cellClass: "font-mono tabular-nums" },
    { headerName: "Composite", field: "score", width: 150, sort: "desc", cellRenderer: ScoreCell },
    { headerName: "Signal", field: "signal", width: 100, cellRenderer: SignalCell },
  ],
  filters: [
    { key: "minYTM", label: "Min YTW", min: 3, max: 9, step: 0.1, def: 3, format: (v) => (v <= 3 ? "Any" : `${nf1.format(v)}%`), apply: (r, v) => (r.ytm ?? 0) >= v },
    { key: "maxDuration", label: "Max duration", min: 1, max: 20, step: 0.5, def: 20, format: (v) => (v >= 20 ? "Any" : `${nf1.format(v)}y`), apply: (r, v) => (r.duration ?? 0) <= v },
    { key: "minCoupon", label: "Min coupon", min: 0, max: 8, step: 0.25, def: 0, format: (v) => (v === 0 ? "Any" : `${nf1.format(v)}%`), apply: (r, v) => (r.coupon ?? 0) >= v },
    { key: "maxMaturity", label: "Max maturity year", min: 2027, max: 2050, step: 1, def: 2050, format: (v) => (v >= 2050 ? "Any" : `≤ ${v}`), apply: (r, v) => (r.maturity ?? 0) <= v },
    { key: "maxPrice", label: "Max price %", min: 80, max: 110, step: 1, def: 110, format: (v) => (v >= 110 ? "Any" : `≤ ${v}%`), apply: (r, v) => (r.price ?? 0) <= v },
    { key: "minGSpread", label: "Min G-spread", min: 0, max: 400, step: 10, def: 0, format: (v) => (v === 0 ? "Any" : `${v}bp`), apply: (r, v) => (r.gSpread ?? 0) >= v },
    { key: "maxRating", label: "Credit floor", min: 0, max: 5, step: 1, def: 5, format: (v) => (v >= 5 ? "Any (≥B)" : `≥ ${RATINGS[v]}`), apply: (r, v) => (r.ratingRank ?? 5) <= v },
    { key: "minOutstanding", label: "Min outstanding", min: 0, max: 4000, step: 100, def: 0, format: (v) => (v === 0 ? "Any" : `$${v}mm`), apply: (r, v) => (r.outstanding ?? 0) >= v },
    { key: "minLiquidity", label: "Min liquidity", min: 0, max: 80, step: 5, def: 0, format: (v) => (v === 0 ? "Any" : `${v}`), apply: (r, v) => (r.liquidity ?? 0) >= v },
  ],
  catFilters: [
    { id: "issuerType", label: "Issuer type", get: (r) => r.issuerType ?? "", options: ["Sovereign", "Agency", "Supranational", "Corporate", "Municipal"] },
    { id: "issueCurrency", label: "Issue currency", get: (r) => r.issueCurrency ?? "", options: ["USD", "EUR", "GBP", "JPY", "CAD", "DKK"] },
    { id: "couponType", label: "Coupon type", get: (r) => r.couponType ?? "", options: ["Fixed", "Floating", "Zero"] },
    { id: "couponFreq", label: "Coupon freq", get: (r) => r.couponFreq ?? "", options: ["Annual", "Semi-Annual", "Quarterly"] },
    { id: "source", label: "Source", get: (r) => r.source ?? "", options: ["SWB", "MUN", "DUS", "OTCB", "FWB"] },
  ],
  presets: [
    { id: "short-dur", label: "Short Duration", blurb: "≤ 5y, quality tilt", nums: { maxDuration: 5, maxRating: 3 } },
    { id: "high-carry", label: "High Carry", blurb: "YTM ≥ 6%", nums: { minYTM: 6 }, minScore: 50 },
    { id: "quality-ig", label: "Quality IG", blurb: "≥ A rated", nums: { maxRating: 2 } },
    { id: "spread-value", label: "Spread Value", blurb: "Wide spread, liquid", nums: { minGSpread: 150, minLiquidity: 45 }, minScore: 50 },
    { id: "liquid-core", label: "Liquid Core", blurb: "Most liquid names", nums: { minLiquidity: 55 } },
  ],
  weightsNote: "Composite: carry 30% · spread-value 25% · quality 20% · liquidity 15% · low-duration 10%.",
  kpiExtra: (rows) => {
    if (!rows.length) return { label: "Avg YTM", value: "—" };
    return { label: "Avg YTM", value: `${nf1.format(rows.reduce((a, r) => a + (r.ytm ?? 0), 0) / rows.length)}%` };
  },
};

/* ---- commodity config ------------------------------------------- */

const COMMODITY_CONFIG: ClassConfig = {
  id: "commodity",
  label: "Commodity",
  icon: "🛢️",
  categoryLabel: "Group",
  categories: CMD_GROUPS,
  columns: [
    { headerName: "Instrument", field: "ticker", pinned: "left", minWidth: 220, cellRenderer: InstrumentCell },
    { headerName: "Group", field: "category", width: 150, cellRenderer: CatCell, enableRowGroup: true },
    { headerName: "Price", field: "price", type: "numericColumn", width: 110, ...priceCell },
    { headerName: "1D", field: "chg", type: "numericColumn", width: 90, cellRenderer: ChgCell },
    { headerName: "3M Mom", field: "mom3", type: "numericColumn", width: 110, cellRenderer: MomCell },
    { headerName: "Vol (ann.)", field: "vol", type: "numericColumn", width: 110, valueFormatter: fPct, cellClass: "font-mono tabular-nums" },
    { headerName: "Roll Yld", field: "rollYield", type: "numericColumn", width: 110, cellRenderer: RollCell },
    { headerName: "Curve", field: "curve", width: 120, cellRenderer: CurveCell },
    { headerName: "Open Int (k)", field: "openInterest", type: "numericColumn", width: 120, valueFormatter: fInt, cellClass: "font-mono tabular-nums" },
    { headerName: "Composite", field: "score", width: 150, sort: "desc", cellRenderer: ScoreCell },
    { headerName: "Signal", field: "signal", width: 100, cellRenderer: SignalCell },
  ],
  filters: [
    { key: "minMom", label: "Min 3M momentum", min: -30, max: 40, step: 2, def: -30, format: (v) => (v <= -30 ? "Any" : `${v > 0 ? "+" : ""}${v}%`), apply: (r, v) => (r.mom3 ?? 0) >= v },
    { key: "maxVol", label: "Max volatility", min: 10, max: 60, step: 2, def: 60, format: (v) => (v >= 60 ? "Any" : `${v}%`), apply: (r, v) => (r.vol ?? 0) <= v },
    { key: "minRoll", label: "Min roll yield", min: -8, max: 8, step: 0.5, def: -8, format: (v) => (v <= -8 ? "Any" : `${nf1.format(v)}%`), apply: (r, v) => (r.rollYield ?? 0) >= v },
    { key: "minOI", label: "Min open interest", min: 0, max: 600, step: 25, def: 0, format: (v) => (v === 0 ? "Any" : `${v}k`), apply: (r, v) => (r.openInterest ?? 0) >= v },
  ],
  presets: [
    { id: "momentum", label: "Momentum", blurb: "Trend leaders", nums: { minMom: 10 }, minScore: 55 },
    { id: "positive-carry", label: "Positive Carry", blurb: "Backwardation, roll > 0", nums: { minRoll: 0.5 } },
    { id: "low-vol", label: "Low Vol", blurb: "Vol ≤ 22%", nums: { maxVol: 22 } },
    { id: "liquid-majors", label: "Liquid Majors", blurb: "Deep open interest", nums: { minOI: 300 } },
  ],
  weightsNote: "Composite: momentum 35% · carry 25% · low-vol 20% · liquidity 20%.",
  kpiExtra: (rows) => {
    if (!rows.length) return { label: "Avg roll yld", value: "—" };
    return { label: "Avg roll yld", value: `${nf1.format(rows.reduce((a, r) => a + (r.rollYield ?? 0), 0) / rows.length)}%` };
  },
};

export const CONFIGS: Record<AssetClass, ClassConfig> = {
  equity: EQUITY_CONFIG,
  bond: BOND_CONFIG,
  commodity: COMMODITY_CONFIG,
};

/* ================================================================== */
/*  Filter state helpers                                               */
/* ================================================================== */

export interface FilterState {
  nums: Record<string, number>;
  cats: Set<string>;
  catSel?: Record<string, Set<string>>; // extra categorical constraints
  minScore: number;
}

export function defaultState(cfg: ClassConfig): FilterState {
  return {
    nums: Object.fromEntries(cfg.filters.map((f) => [f.key, f.def])),
    cats: new Set(),
    catSel: Object.fromEntries((cfg.catFilters ?? []).map((cf) => [cf.id, new Set<string>()])),
    minScore: 0,
  };
}

export function passes(r: Row, cfg: ClassConfig, s: FilterState): boolean {
  for (const f of cfg.filters) if (!f.apply(r, s.nums[f.key])) return false;
  if (s.cats.size > 0 && !s.cats.has(r.category)) return false;
  for (const cf of cfg.catFilters ?? []) {
    const sel = s.catSel?.[cf.id];
    if (sel && sel.size > 0 && !sel.has(cf.get(r))) return false;
  }
  if (r.score < s.minScore) return false;
  return true;
}

/* ================================================================== */
/*  Small UI                                                           */
/* ================================================================== */

export function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : "text-neutral-900"}`}>{value}</div>
    </div>
  );
}

export function ToolbarBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
      {children}
    </button>
  );
}

export function RangeRow({ label, min, max, step, value, onChange, format }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-neutral-600">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-neutral-900">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer accent-indigo-600" />
    </div>
  );
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

function AssetScreener() {
  const [assetClass, setAssetClass] = useState<AssetClass>("equity");
  const [state, setState] = useState<FilterState>(() => defaultState(EQUITY_CONFIG));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [compact, setCompact] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const apiRef = useRef<GridApi<Row> | null>(null);

  const cfg = CONFIGS[assetClass];
  const universe = UNIVERSES[assetClass];

  const switchClass = useCallback((c: AssetClass) => {
    setAssetClass(c);
    setState(defaultState(CONFIGS[c]));
    setActivePreset(null);
    setQuickFilter("");
  }, []);

  const filtered = useMemo(() => universe.filter((r) => passes(r, cfg, state)), [universe, cfg, state]);

  const kpis = useMemo(() => {
    const n = filtered.length;
    const avgScore = n ? filtered.reduce((a, r) => a + r.score, 0) / n : 0;
    const buys = filtered.filter((r) => r.signal === "BUY").length;
    return { n, avgScore, buys, extra: cfg.kpiExtra(filtered) };
  }, [filtered, cfg]);

  const patchNum = useCallback((key: string, val: number) => {
    setState((s) => ({ ...s, nums: { ...s.nums, [key]: val } }));
    setActivePreset(null);
  }, []);

  const toggleCat = useCallback((item: string) => {
    setState((s) => {
      const next = new Set(s.cats);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return { ...s, cats: next };
    });
    setActivePreset(null);
  }, []);

  const applyPreset = useCallback(
    (p: Preset) => {
      setState({ nums: { ...defaultState(cfg).nums, ...p.nums }, cats: new Set(), minScore: p.minScore ?? 0 });
      setActivePreset(p.id);
    },
    [cfg],
  );

  const resetFilters = useCallback(() => {
    setState(defaultState(cfg));
    setActivePreset(null);
  }, [cfg]);

  const onGridReady = useCallback((e: GridReadyEvent<Row>) => {
    apiRef.current = e.api;
  }, []);

  const theme = useMemo(
    () =>
      themeQuartz.withParams({
        accentColor: "#4f46e5",
        backgroundColor: "#ffffff",
        foregroundColor: "#171717",
        borderColor: "#e5e5e5",
        chromeBackgroundColor: "#fafafa",
        headerBackgroundColor: "#f5f5f5",
        headerTextColor: "#525252",
        headerFontWeight: 600,
        oddRowBackgroundColor: "#fcfcfc",
        rowHoverColor: "#eef2ff",
        selectedRowBackgroundColor: "#e0e7ff",
        fontFamily: "inherit",
        fontSize: compact ? 12 : 13,
        headerFontSize: 11,
        cellHorizontalPadding: 10,
        spacing: compact ? 5 : 8,
        wrapperBorderRadius: 10,
        rowBorder: true,
        columnBorder: true,
      }),
    [compact],
  );

  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, filter: "agNumberColumnFilter" }), []);

  const statusBar = useMemo<{ statusPanels: StatusPanelDef[] }>(
    () => ({
      statusPanels: [
        { statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" },
        { statusPanel: "agSelectedRowCountComponent", align: "center" },
        { statusPanel: "agAggregationComponent", align: "right" },
      ],
    }),
    [],
  );

  const sideBar = useMemo<SideBarDef>(
    () => ({
      toolPanels: [
        { id: "columns", labelDefault: "Columns", labelKey: "columns", iconKey: "columns", toolPanel: "agColumnsToolPanel" },
        { id: "filters", labelDefault: "Filters", labelKey: "filters", iconKey: "filter", toolPanel: "agFiltersToolPanel" },
      ],
    }),
    [],
  );

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* header */}
      <div className="border-b border-neutral-200 bg-white px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500">Cross-Asset Research</span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Factor model live
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Asset Screener</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi label="Universe" value={universe.length.toString()} />
            <Kpi label="Matches" value={kpis.n.toString()} />
            <Kpi label="Buy signals" value={kpis.buys.toString()} tone={kpis.buys > 0 ? "pos" : undefined} />
            <Kpi label="Avg score" value={kpis.n ? kpis.avgScore.toFixed(0) : "—"} />
            <Kpi label={kpis.extra.label} value={kpis.extra.value} />
          </div>
        </div>

        {/* asset class toggle */}
        <div className="mt-4 flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 w-fit">
          {(Object.keys(CONFIGS) as AssetClass[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => switchClass(c)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${assetClass === c ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800"}`}
            >
              <span>{CONFIGS[c].icon}</span>
              {CONFIGS[c].label}
            </button>
          ))}
        </div>

        {/* toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search ticker, name…"
              className="h-8 w-56 rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-2 h-4 w-4 text-neutral-400">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {cfg.presets.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.blurb}
                onClick={() => applyPreset(p)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${activePreset === p.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ToolbarBtn onClick={() => setPanelOpen((o) => !o)}>{panelOpen ? "Hide factors" : "Show factors"}</ToolbarBtn>
            <ToolbarBtn onClick={() => setCompact((c) => !c)}>{compact ? "Comfortable" : "Compact"}</ToolbarBtn>
            <ToolbarBtn onClick={resetFilters}>Reset</ToolbarBtn>
            <ToolbarBtn onClick={() => apiRef.current?.exportDataAsCsv({ fileName: `asset-screener-${assetClass}.csv` })}>Export</ToolbarBtn>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        {panelOpen && (
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">Factor thresholds</div>
            <div className="mt-3 space-y-4">
              {cfg.filters.map((f) => (
                <RangeRow key={f.key} label={f.label} min={f.min} max={f.max} step={f.step} value={state.nums[f.key]} onChange={(v) => patchNum(f.key, v)} format={f.format} />
              ))}
              <RangeRow label="Min composite score" min={0} max={90} step={5} value={state.minScore} onChange={(v) => { setState((s) => ({ ...s, minScore: v })); setActivePreset(null); }} format={(v) => (v === 0 ? "Any" : `${v}`)} />
            </div>

            <div className="mt-5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">{cfg.categoryLabel}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {cfg.categories.map((c) => {
                const on = state.cats.has(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCat(c)} className={`rounded px-1.5 py-1 text-[10px] font-medium transition ${on ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                    {c}
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-[10px] leading-relaxed text-neutral-400">{cfg.weightsNote}</p>
          </aside>
        )}

        <div className="min-h-0 flex-1 px-4 py-4">
          <AgGridReact<Row>
            theme={theme}
            columnDefs={cfg.columns}
            defaultColDef={defaultColDef}
            rowData={filtered}
            getRowId={(p) => p.data.id}
            onGridReady={onGridReady}
            quickFilterText={quickFilter}
            rowGroupPanelShow="onlyWhenGrouping"
            groupDefaultExpanded={1}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
            cellSelection
            sideBar={sideBar}
            statusBar={statusBar}
            animateRows
            rowHeight={compact ? 32 : 40}
            headerHeight={compact ? 32 : 38}
            tooltipShowDelay={300}
          />
        </div>
      </div>
    </div>
  );
}

export default AssetScreener;
