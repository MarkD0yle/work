/* Mock cross-asset execution book for the DevExtreme trade blotter
 * (src/pages/devextreme-blotter.tsx).
 *
 * Deliberately self-contained: the AG Grid page (src/pages/blotter.tsx) models
 * money-market *orders*, this one models cross-asset *executions* — different
 * row shape, different lifecycle. Generation is seeded so the demo book is
 * identical on every reload and screenshots stay comparable.
 */

export type Side = "BUY" | "SELL";

export type AssetClass =
  | "Govt"
  | "Credit"
  | "Equity"
  | "ETF"
  | "FX"
  | "Future";

export type TradeStatus =
  | "NEW"
  | "WORKING"
  | "PART-FILL"
  | "FILLED"
  | "ALLOCATED"
  | "CANCELLED"
  | "REJECTED";

export type SettleStatus = "SETTLED" | "MATCHED" | "PENDING" | "FAILED";

export type Venue =
  | "VOICE"
  | "BBG RFQ"
  | "TRADEWEB"
  | "MARKETAXESS"
  | "XETRA"
  | "NYSE"
  | "NASDAQ"
  | "EUREX"
  | "CME"
  | "INTERNAL";

export interface Execution {
  execId: string;
  time: Date;
  qty: number;
  price: number;
  venue: Venue;
  broker: string;
  liquidity: "ADD" | "REMOVE" | "OTC";
}

export interface Allocation {
  allocId: string;
  account: string;
  accountName: string;
  qty: number;
  pct: number;
  custodian: string;
  ssi: SettleStatus;
}

export interface TradeRow {
  tradeId: string;
  orderId: string;
  execTime: Date;
  trader: string;
  desk: string;
  side: Side;
  assetClass: AssetClass;
  ticker: string;
  instrument: string;
  isin: string;
  ccy: string;
  /** Bonds/FX: notional in millions. Equity/ETF: shares. Futures: lots. */
  quantity: number;
  filledQty: number;
  price: number;
  /** Direction of the last price tick — drives the arrow in the price cell. */
  priceDir: 1 | -1 | 0;
  /** Consideration in USD equivalent, so one column totals across assets. */
  notional: number;
  venue: Venue;
  broker: string;
  counterparty: string;
  cptyRating: string;
  status: TradeStatus;
  tradeDate: Date;
  settleDate: Date;
  settleStatus: SettleStatus;
  /** Business days a failing settlement has been outstanding. */
  failDays: number;
  commission: number;
  fees: number;
  netConsideration: number;
  yieldPct: number | null;
  spreadBps: number | null;
  dv01: number;
  mtmPnl: number;
  dayPnl: number;
  limitUtil: number;
  creditOk: boolean;
  executions: Execution[];
  allocations: Allocation[];
}

/* ------------------------------------------------------------------ */
/*  Reference data                                                     */
/* ------------------------------------------------------------------ */

interface Instrument {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  ccy: string;
  px: number;
  yieldPct: number | null;
  spreadBps: number | null;
  isin: string;
}

export const INSTRUMENTS: Instrument[] = [
  // Governments — priced clean, quantity in millions
  { ticker: "T 4¼ 02/34", name: "US Treasury 4.25% Feb-2034", assetClass: "Govt", ccy: "USD", px: 99.42, yieldPct: 4.32, spreadBps: 0, isin: "US91282CJK21" },
  { ticker: "T 3⅞ 08/33", name: "US Treasury 3.875% Aug-2033", assetClass: "Govt", ccy: "USD", px: 96.88, yieldPct: 4.29, spreadBps: 0, isin: "US91282CHT12" },
  { ticker: "DBR 2.6 08/34", name: "Bundesrepublik 2.60% Aug-2034", assetClass: "Govt", ccy: "EUR", px: 101.15, yieldPct: 2.46, spreadBps: 0, isin: "DE000BU2Z023" },
  { ticker: "UKT 4¼ 07/34", name: "UK Gilt 4.25% Jul-2034", assetClass: "Govt", ccy: "GBP", px: 100.62, yieldPct: 4.18, spreadBps: 0, isin: "GB00BQC4XL75" },
  { ticker: "BTP 3.85 07/34", name: "Italy BTP 3.85% Jul-2034", assetClass: "Govt", ccy: "EUR", px: 99.94, yieldPct: 3.86, spreadBps: 140, isin: "IT0005542359" },
  // Credit
  { ticker: "AAPL 4½ 05/33", name: "Apple Inc 4.50% May-2033", assetClass: "Credit", ccy: "USD", px: 101.34, yieldPct: 4.68, spreadBps: 36, isin: "US037833EN25" },
  { ticker: "JPM 5¼ 06/32", name: "JPMorgan Chase 5.25% Jun-2032", assetClass: "Credit", ccy: "USD", px: 103.11, yieldPct: 4.94, spreadBps: 62, isin: "US46647PDA37" },
  { ticker: "GS 4.9 07/30", name: "Goldman Sachs 4.90% Jul-2030", assetClass: "Credit", ccy: "USD", px: 100.72, yieldPct: 4.81, spreadBps: 74, isin: "US38141GYT51" },
  { ticker: "VOD 3⅜ 08/31", name: "Vodafone Group 3.375% Aug-2031", assetClass: "Credit", ccy: "EUR", px: 97.4, yieldPct: 3.82, spreadBps: 118, isin: "XS2394264884" },
  { ticker: "SIE 3.1 09/29", name: "Siemens AG 3.10% Sep-2029", assetClass: "Credit", ccy: "EUR", px: 99.18, yieldPct: 3.29, spreadBps: 58, isin: "XS2679877111" },
  // Equities
  { ticker: "AAPL", name: "Apple Inc.", assetClass: "Equity", ccy: "USD", px: 232.45, yieldPct: null, spreadBps: null, isin: "US0378331005" },
  { ticker: "MSFT", name: "Microsoft Corp.", assetClass: "Equity", ccy: "USD", px: 451.12, yieldPct: null, spreadBps: null, isin: "US5949181045" },
  { ticker: "NVDA", name: "NVIDIA Corp.", assetClass: "Equity", ccy: "USD", px: 138.9, yieldPct: null, spreadBps: null, isin: "US67066G1040" },
  { ticker: "ASML NA", name: "ASML Holding NV", assetClass: "Equity", ccy: "EUR", px: 689.4, yieldPct: null, spreadBps: null, isin: "NL0010273215" },
  { ticker: "SAP GY", name: "SAP SE", assetClass: "Equity", ccy: "EUR", px: 214.85, yieldPct: null, spreadBps: null, isin: "DE0007164600" },
  { ticker: "HSBA LN", name: "HSBC Holdings plc", assetClass: "Equity", ccy: "GBP", px: 7.42, yieldPct: null, spreadBps: null, isin: "GB0005405286" },
  // ETFs
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "ETF", ccy: "USD", px: 583.91, yieldPct: null, spreadBps: null, isin: "US78462F1030" },
  { ticker: "IEF", name: "iShares 7-10Y Treasury ETF", assetClass: "ETF", ccy: "USD", px: 95.18, yieldPct: 4.11, spreadBps: null, isin: "US4642874402" },
  { ticker: "LQD", name: "iShares IG Corporate Bond ETF", assetClass: "ETF", ccy: "USD", px: 109.63, yieldPct: 4.72, spreadBps: null, isin: "US4642872422" },
  // FX
  { ticker: "EURUSD", name: "EUR/USD Spot", assetClass: "FX", ccy: "EUR", px: 1.0842, yieldPct: null, spreadBps: null, isin: "—" },
  { ticker: "GBPUSD", name: "GBP/USD Spot", assetClass: "FX", ccy: "GBP", px: 1.2714, yieldPct: null, spreadBps: null, isin: "—" },
  { ticker: "USDJPY", name: "USD/JPY Spot", assetClass: "FX", ccy: "USD", px: 151.28, yieldPct: null, spreadBps: null, isin: "—" },
  // Futures
  { ticker: "FGBLM6", name: "Euro-Bund Future Jun-26", assetClass: "Future", ccy: "EUR", px: 132.44, yieldPct: null, spreadBps: null, isin: "DE0009652644" },
  { ticker: "TYM6", name: "US 10Y Note Future Jun-26", assetClass: "Future", ccy: "USD", px: 110.72, yieldPct: null, spreadBps: null, isin: "US912810TY00" },
  { ticker: "ESM6", name: "E-mini S&P 500 Future Jun-26", assetClass: "Future", ccy: "USD", px: 5842.5, yieldPct: null, spreadBps: null, isin: "US78378X1072" },
];

/** USD conversion — a fixed snapshot is fine for a demo book. */
const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.0842,
  GBP: 1.2714,
  JPY: 0.0066,
};

const FUTURE_MULTIPLIER: Record<string, number> = {
  FGBLM6: 1000,
  TYM6: 1000,
  ESM6: 50,
};

const VENUES_BY_CLASS: Record<AssetClass, Venue[]> = {
  Govt: ["TRADEWEB", "BBG RFQ", "VOICE", "MARKETAXESS"],
  Credit: ["MARKETAXESS", "BBG RFQ", "TRADEWEB", "VOICE"],
  Equity: ["XETRA", "NYSE", "NASDAQ", "INTERNAL"],
  ETF: ["NYSE", "NASDAQ", "BBG RFQ"],
  FX: ["BBG RFQ", "VOICE", "INTERNAL"],
  Future: ["EUREX", "CME"],
};

const DESK_BY_CLASS: Record<AssetClass, string> = {
  Govt: "Rates",
  Credit: "Credit",
  Equity: "Cash Equities",
  ETF: "ETF Desk",
  FX: "FX Spot",
  Future: "Futures",
};

const TRADERS = [
  "K. Patel",
  "M. Doyle",
  "S. Nguyen",
  "L. Romano",
  "T. Bauer",
  "A. Costa",
  "R. Singh",
  "E. Larsson",
];

const COUNTERPARTIES: Array<[string, string]> = [
  ["JP Morgan", "AA-"],
  ["Goldman Sachs", "A+"],
  ["Morgan Stanley", "A+"],
  ["Citigroup", "A"],
  ["Bank of America", "AA-"],
  ["Barclays", "A"],
  ["Deutsche Bank", "A-"],
  ["BNP Paribas", "AA-"],
  ["HSBC", "AA-"],
  ["UBS", "A+"],
  ["Nomura", "A-"],
  ["Jane Street", "A"],
  ["Citadel Securities", "A"],
  ["RBC", "AA-"],
];

const BROKERS = ["TPICAP", "BGC", "Tradition", "Direct", "Instinet", "Redburn"];

const ACCOUNTS: Array<[string, string, string]> = [
  ["FND-GLB-01", "Global Bond Fund", "BNY Mellon"],
  ["FND-EUR-04", "European Income Fund", "Euroclear"],
  ["SEG-PEN-22", "Pension Segregated 22", "State Street"],
  ["FND-BAL-07", "Balanced Growth Fund", "Citi Custody"],
  ["TRE-FIRM-01", "Firm Treasury", "Internal"],
  ["SEG-INS-09", "Insurance Mandate 09", "Northern Trust"],
];

/* ------------------------------------------------------------------ */
/*  Seeded generation                                                  */
/* ------------------------------------------------------------------ */

let seed = 1337;
function rng() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const round = (v: number, dp = 2) => +v.toFixed(dp);

export const TODAY = new Date("2026-05-19T00:00:00Z");

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Settlement convention per asset class, in business-ish days. */
function settleLag(assetClass: AssetClass) {
  switch (assetClass) {
    case "Govt":
      return 1;
    case "FX":
      return 2;
    case "Future":
      return 0;
    default:
      return 2;
  }
}

function quantityFor(assetClass: AssetClass) {
  switch (assetClass) {
    case "Govt":
      return (1 + Math.floor(rng() * 40)) * 1_000_000;
    case "Credit":
      return (1 + Math.floor(rng() * 15)) * 1_000_000;
    case "FX":
      return (1 + Math.floor(rng() * 60)) * 1_000_000;
    case "Future":
      return (10 + Math.floor(rng() * 490)) * 5;
    default:
      return (1 + Math.floor(rng() * 120)) * 2_500;
  }
}

/** Consideration in the instrument currency, before fees. */
export function grossConsideration(
  assetClass: AssetClass,
  ticker: string,
  qty: number,
  price: number,
) {
  switch (assetClass) {
    case "Govt":
    case "Credit":
      return (qty * price) / 100;
    case "FX":
      return qty;
    case "Future":
      return qty * price * (FUTURE_MULTIPLIER[ticker] ?? 1000);
    default:
      return qty * price;
  }
}

export const usd = (ccy: string, amount: number) =>
  amount * (FX_TO_USD[ccy] ?? 1);

/** Rate products carry DV01; equities and FX do not. */
function dv01For(assetClass: AssetClass, usdNotional: number) {
  switch (assetClass) {
    case "Govt":
      return Math.round((usdNotional / 1e6) * 780);
    case "Credit":
      return Math.round((usdNotional / 1e6) * 540);
    case "Future":
      return Math.round((usdNotional / 1e6) * 610);
    case "ETF":
      return Math.round((usdNotional / 1e6) * 120);
    default:
      return 0;
  }
}

function makeExecutions(
  tradeId: string,
  filledQty: number,
  price: number,
  venue: Venue,
  assetClass: AssetClass,
  execTime: Date,
): Execution[] {
  if (filledQty <= 0) return [];
  const n = 1 + Math.floor(rng() * 4);
  const out: Execution[] = [];
  let remaining = filledQty;
  for (let i = 0; i < n && remaining > 0; i++) {
    const last = i === n - 1;
    const qty = last ? remaining : Math.max(1, Math.round(remaining * (0.25 + rng() * 0.5)));
    remaining -= qty;
    out.push({
      execId: `${tradeId}-E${i + 1}`,
      time: new Date(execTime.getTime() + i * (30_000 + rng() * 240_000)),
      qty,
      price: round(price + (rng() - 0.5) * price * 0.0006, 4),
      venue,
      broker: pick(BROKERS),
      liquidity:
        assetClass === "Equity" || assetClass === "ETF" || assetClass === "Future"
          ? rng() > 0.5
            ? "ADD"
            : "REMOVE"
          : "OTC",
    });
  }
  return out;
}

function makeAllocations(
  tradeId: string,
  filledQty: number,
  settleStatus: SettleStatus,
): Allocation[] {
  if (filledQty <= 0) return [];
  const n = 1 + Math.floor(rng() * 3);
  const out: Allocation[] = [];
  let remaining = filledQty;
  for (let i = 0; i < n && remaining > 0; i++) {
    const last = i === n - 1;
    const qty = last ? remaining : Math.max(1, Math.round(remaining * (0.3 + rng() * 0.4)));
    remaining -= qty;
    const [account, accountName, custodian] = pick(ACCOUNTS);
    out.push({
      allocId: `${tradeId}-A${i + 1}`,
      account,
      accountName,
      qty,
      pct: round((qty / filledQty) * 100, 1),
      custodian,
      // the block's settlement state is the worst of its legs, so keep the
      // failing leg visible and let the rest look healthier
      ssi: i === 0 ? settleStatus : rng() > 0.25 ? "MATCHED" : "PENDING",
    });
  }
  return out;
}

function makeTrade(i: number): TradeRow {
  const inst = pick(INSTRUMENTS);
  const side: Side = rng() > 0.48 ? "BUY" : "SELL";
  const quantity = quantityFor(inst.assetClass);
  const price = round(
    inst.px * (1 + (rng() - 0.5) * 0.004),
    inst.assetClass === "FX" ? 4 : 2,
  );

  const statusRoll = rng();
  let status: TradeStatus;
  let filledQty = 0;
  if (statusRoll < 0.05) status = "NEW";
  else if (statusRoll < 0.22) status = "WORKING";
  else if (statusRoll < 0.36) {
    status = "PART-FILL";
    filledQty = Math.round(quantity * (0.2 + rng() * 0.55));
  } else if (statusRoll < 0.68) {
    status = "FILLED";
    filledQty = quantity;
  } else if (statusRoll < 0.92) {
    status = "ALLOCATED";
    filledQty = quantity;
  } else if (statusRoll < 0.97) status = "CANCELLED";
  else status = "REJECTED";

  const gross = grossConsideration(inst.assetClass, inst.ticker, quantity, price);
  const usdNotional = usd(inst.ccy, gross);
  const commission =
    inst.assetClass === "Equity" || inst.assetClass === "ETF"
      ? Math.round(gross * 0.0004)
      : inst.assetClass === "Future"
        ? Math.round((quantity / 5) * 1.2)
        : 0;
  const fees = Math.round(gross * 0.00002);
  const signed = side === "BUY" ? 1 : -1;

  const settled = status === "ALLOCATED" && rng() > 0.45;
  const failing = !settled && status === "ALLOCATED" && rng() > 0.86;
  const settleStatus: SettleStatus = settled
    ? "SETTLED"
    : failing
      ? "FAILED"
      : filledQty > 0
        ? rng() > 0.3
          ? "MATCHED"
          : "PENDING"
        : "PENDING";

  const execTime = new Date(TODAY.getTime() + (7.5 + rng() * 9.5) * 3_600_000);
  const tradeId = `TRD-${240000 + i}`;
  const [counterparty, cptyRating] = pick(COUNTERPARTIES);
  const venue = pick(VENUES_BY_CLASS[inst.assetClass]);
  const dv01 = dv01For(inst.assetClass, usdNotional) * signed;

  const liveFactor =
    status === "FILLED" || status === "ALLOCATED" || status === "PART-FILL"
      ? 1
      : 0.1;
  const mtmPnl = Math.round((rng() - 0.44) * usdNotional * 0.0012 * liveFactor);
  const dayPnl = Math.round(mtmPnl * (0.2 + rng() * 0.6));
  const limitUtil = Math.round(24 + rng() * 74);

  return {
    tradeId,
    orderId: `ORD-${88000 + Math.floor(i / 2)}`,
    execTime,
    trader: pick(TRADERS),
    desk: DESK_BY_CLASS[inst.assetClass],
    side,
    assetClass: inst.assetClass,
    ticker: inst.ticker,
    instrument: inst.name,
    isin: inst.isin,
    ccy: inst.ccy,
    quantity,
    filledQty,
    price,
    priceDir: 0,
    notional: Math.round(usdNotional),
    venue,
    broker: pick(BROKERS),
    counterparty,
    cptyRating,
    status,
    tradeDate: TODAY,
    settleDate: addDays(TODAY, settleLag(inst.assetClass)),
    settleStatus,
    failDays: settleStatus === "FAILED" ? 1 + Math.floor(rng() * 4) : 0,
    commission,
    fees,
    netConsideration: Math.round(gross + signed * (commission + fees)),
    yieldPct: inst.yieldPct == null ? null : round(inst.yieldPct + (rng() - 0.5) * 0.12, 3),
    spreadBps: inst.spreadBps == null ? null : Math.max(0, Math.round(inst.spreadBps + (rng() - 0.5) * 14)),
    dv01,
    mtmPnl,
    dayPnl,
    limitUtil,
    creditOk: status !== "REJECTED" && limitUtil < 96,
    executions: makeExecutions(tradeId, filledQty, price, venue, inst.assetClass, execTime),
    allocations: makeAllocations(tradeId, filledQty, settleStatus),
  };
}

export function makeBook(size = 180): TradeRow[] {
  return Array.from({ length: size }, (_, i) => makeTrade(i));
}

/** One more trade for the "new print" simulation, keyed past the book. */
export function makeIncomingTrade(sequence: number): TradeRow {
  const row = makeTrade(9000 + sequence);
  row.tradeId = `TRD-${900000 + sequence}`;
  row.execTime = new Date(TODAY.getTime() + (17 + rng()) * 3_600_000);
  row.status = rng() > 0.4 ? "WORKING" : "PART-FILL";
  row.filledQty = row.status === "WORKING" ? 0 : Math.round(row.quantity * 0.35);
  row.settleStatus = "PENDING";
  row.executions = makeExecutions(
    row.tradeId,
    row.filledQty,
    row.price,
    row.venue,
    row.assetClass,
    row.execTime,
  );
  row.allocations = [];
  return row;
}

/**
 * Advance one market tick: re-price a slice of the live book, progress fills,
 * and mark P&L. Returns brand-new row objects for the touched trades only, so
 * the grid's `repaintChangesOnly` diff stays cheap.
 */
export function tickBook(rows: TradeRow[], count = 12): TradeRow[] {
  const live = rows.filter(
    (r) =>
      r.status === "NEW" || r.status === "WORKING" || r.status === "PART-FILL",
  );
  if (!live.length) return [];

  const touched = new Map<string, TradeRow>();
  for (let k = 0; k < Math.min(count, live.length); k++) {
    const src = live[Math.floor(rng() * live.length)];
    if (touched.has(src.tradeId)) continue;
    const r: TradeRow = { ...src };

    const bump = round(r.price * (rng() - 0.5) * 0.0025, r.assetClass === "FX" ? 4 : 2);
    const next = round(r.price + bump, r.assetClass === "FX" ? 4 : 2);
    r.priceDir = next > r.price ? 1 : next < r.price ? -1 : 0;
    r.price = next;

    if (r.yieldPct != null) r.yieldPct = round(r.yieldPct - bump * 0.11, 3);
    if (r.spreadBps != null)
      r.spreadBps = Math.max(0, r.spreadBps + (rng() > 0.5 ? 1 : -1));

    const signed = r.side === "BUY" ? 1 : -1;
    const tickPnl = Math.round(signed * (bump / (r.price || 1)) * r.notional);
    r.mtmPnl += tickPnl;
    r.dayPnl += tickPnl;

    if (r.status === "NEW" && rng() > 0.45) {
      r.status = r.creditOk ? "WORKING" : "REJECTED";
    } else if (r.status === "WORKING" && rng() > 0.76) {
      r.status = "PART-FILL";
      r.filledQty = Math.round(r.quantity * (0.2 + rng() * 0.4));
    } else if (r.status === "PART-FILL" && rng() > 0.7) {
      r.filledQty = Math.min(
        r.quantity,
        r.filledQty + Math.round(r.quantity * (0.2 + rng() * 0.5)),
      );
      if (r.filledQty >= r.quantity) {
        r.filledQty = r.quantity;
        r.status = "FILLED";
        r.settleStatus = rng() > 0.25 ? "MATCHED" : "PENDING";
      }
    }

    if (r.filledQty !== src.filledQty) {
      r.executions = makeExecutions(
        r.tradeId,
        r.filledQty,
        r.price,
        r.venue,
        r.assetClass,
        r.execTime,
      );
      const gross = grossConsideration(r.assetClass, r.ticker, r.quantity, r.price);
      r.netConsideration = Math.round(gross + signed * (r.commission + r.fees));
    }

    touched.set(r.tradeId, r);
  }
  return [...touched.values()];
}
