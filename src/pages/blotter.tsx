import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ColGroupDef,
  type GridApi,
  type GridReadyEvent,
  type IAggFuncParams,
  type ICellRendererParams,
  type IRowNode,
  type SideBarDef,
  type StatusPanelDef,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";

// Enterprise bundle (includes Community). No license key is set, so the grid
// runs in evaluation mode and logs the standard watermark notice — expected
// for an internal design workspace.
ModuleRegistry.registerModules([AllEnterpriseModule]);

export const title = "MM Order Blotter";
export const fullWidth = true;

/* ------------------------------------------------------------------ */
/*  Domain model                                                       */
/* ------------------------------------------------------------------ */

type Side = "BORROW" | "LEND" | "BUY" | "SELL";
type Product =
  | "DEPO"
  | "CD"
  | "CP"
  | "REPO"
  | "REV REPO"
  | "T-BILL"
  | "FX SWAP"
  | "EQUITY";
type Tenor =
  | "O/N"
  | "T/N"
  | "S/N"
  | "1W"
  | "2W"
  | "1M"
  | "2M"
  | "3M"
  | "6M"
  | "9M"
  | "1Y"
  | "SPOT";
type Status =
  | "NEW"
  | "PENDING-CREDIT"
  | "WORKING"
  | "PART-FILL"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED";
type Venue = "VOICE" | "BBG RFQ" | "TRADEWEB" | "360T" | "ECN" | "INTERNAL";
type SsiState = "MATCHED" | "PENDING" | "FAILED";

interface Fill {
  fillId: string;
  time: string;
  qty: number;
  rate: number;
  venue: Venue;
  account: string;
  broker: string;
}

interface OrderRow {
  orderId: string;
  ticket: string;
  time: string;
  trader: string;
  desk: string;
  side: Side;
  product: Product;
  ccy: string;
  notional: number;
  filled: number;
  tenor: Tenor;
  dealtRate: number;
  rateDir: 1 | -1 | 0;
  benchmark: string;
  spreadBps: number;
  basis: string;
  tradeDate: string;
  valueDate: string;
  maturityDate: string;
  days: number;
  counterparty: string;
  cptyRating: string;
  venue: Venue;
  status: Status;
  creditOk: boolean;
  limitUtil: number;
  dv01: number;
  pnl: number;
  ssi: SsiState;
  fills: Fill[];
}

/* ------------------------------------------------------------------ */
/*  Reference data + mock order generation                             */
/* ------------------------------------------------------------------ */

const CCY = ["USD", "EUR", "GBP", "JPY", "CHF"] as const;
const BENCHMARK: Record<string, string> = {
  USD: "SOFR",
  EUR: "ESTR",
  GBP: "SONIA",
  JPY: "TONA",
  CHF: "SARON",
};
const BASE_RATE: Record<string, number> = {
  USD: 4.31,
  EUR: 2.4,
  GBP: 4.12,
  JPY: 0.48,
  CHF: 0.97,
};
const BASIS: Record<string, string> = {
  USD: "ACT/360",
  EUR: "ACT/360",
  GBP: "ACT/365",
  JPY: "ACT/360",
  CHF: "ACT/360",
};
const TENOR_DAYS: Record<Tenor, number> = {
  "O/N": 1,
  "T/N": 1,
  "S/N": 1,
  "1W": 7,
  "2W": 14,
  "1M": 30,
  "2M": 61,
  "3M": 91,
  "6M": 182,
  "9M": 273,
  "1Y": 365,
  SPOT: 0,
};
const PRODUCTS: Product[] = [
  "DEPO",
  "CD",
  "CP",
  "REPO",
  "REV REPO",
  "T-BILL",
  "FX SWAP",
];
const TENORS: Tenor[] = ["O/N", "1W", "2W", "1M", "2M", "3M", "6M", "9M", "1Y"];
const VENUES: Venue[] = [
  "VOICE",
  "BBG RFQ",
  "TRADEWEB",
  "360T",
  "ECN",
  "INTERNAL",
];
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
const DESKS = ["MM Funding", "Repo Desk", "CD/CP Desk", "Liquidity", "XCcy"];
const COUNTERPARTIES: Array<[string, string]> = [
  ["JP Morgan", "AA-"],
  ["Goldman Sachs", "A+"],
  ["Morgan Stanley", "A+"],
  ["Citigroup", "A"],
  ["Bank of America", "AA-"],
  ["Barclays", "A"],
  ["Deutsche Bank", "A-"],
  ["BNP Paribas", "AA-"],
  ["Société Générale", "A"],
  ["HSBC", "AA-"],
  ["UBS", "A+"],
  ["Nomura", "A-"],
  ["RBC", "AA-"],
  ["Wells Fargo", "A+"],
  ["Santander", "A"],
  ["ING", "A+"],
  ["MUFG", "A"],
  ["Standard Chartered", "A-"],
  ["Rabobank", "A+"],
  ["Crédit Agricole", "A"],
];

let seed = 42;
function rng() {
  // deterministic pseudo-random so the demo blotter is stable across reloads
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const TODAY = new Date("2026-05-19T00:00:00Z");

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

function basisDenom(ccy: string) {
  return BASIS[ccy] === "ACT/365" ? 365 : 360;
}

function makeFills(
  parent: Pick<OrderRow, "orderId" | "filled" | "dealtRate" | "ccy">,
): Fill[] {
  if (parent.filled <= 0) return [];
  const n = 1 + Math.floor(rng() * 3);
  const fills: Fill[] = [];
  let remaining = parent.filled;
  for (let i = 0; i < n; i++) {
    const qty =
      i === n - 1
        ? remaining
        : Math.round((remaining * (0.3 + rng() * 0.5)) / 1e6) * 1e6 || 1e6;
    remaining -= qty;
    fills.push({
      fillId: `${parent.orderId}-F${i + 1}`,
      time: new Date(
        TODAY.getTime() + (8 + rng() * 9) * 3600_000,
      ).toISOString(),
      qty,
      rate: +(parent.dealtRate + (rng() - 0.5) * 0.01).toFixed(4),
      venue: pick(VENUES),
      account: pick(["FIRM-MAIN", "LIQ-BUF", "CLIENT-OMNI", "TREAS-01"]),
      broker: pick(["TPICAP", "BGC", "Tradition", "Direct", "—"]),
    });
    if (remaining <= 0) break;
  }
  return fills;
}

function makeOrder(i: number): OrderRow {
  const ccy = pick(CCY);
  const product = pick(PRODUCTS);
  const tenor = pick(TENORS);
  const days = TENOR_DAYS[tenor];
  const isCash = product === "DEPO" || product === "REPO" || product === "CD";
  const side: Side = isCash
    ? rng() > 0.5
      ? "BORROW"
      : "LEND"
    : rng() > 0.5
      ? "BUY"
      : "SELL";
  const spreadBps = Math.round((rng() - 0.45) * 18);
  const dealtRate = +(BASE_RATE[ccy] + spreadBps / 100).toFixed(4);
  const notional = (5 + Math.floor(rng() * 95)) * 1e6;
  const [counterparty, cptyRating] = pick(COUNTERPARTIES);

  const statusRoll = rng();
  let status: Status;
  let filled = 0;
  if (statusRoll < 0.08) status = "NEW";
  else if (statusRoll < 0.13) status = "PENDING-CREDIT";
  else if (statusRoll < 0.46) {
    status = "WORKING";
  } else if (statusRoll < 0.62) {
    status = "PART-FILL";
    filled = Math.round((notional * (0.2 + rng() * 0.5)) / 1e6) * 1e6;
  } else if (statusRoll < 0.9) {
    status = "FILLED";
    filled = notional;
  } else if (statusRoll < 0.96) status = "CANCELLED";
  else status = "REJECTED";

  const valueDate = addDays(TODAY, tenor === "O/N" ? 0 : 2);
  const maturityDate = addDays(valueDate, days);
  const dv01 = +((notional * days) / 360 / 1e4 / 100).toFixed(0);
  const pnl = +(
    (rng() - 0.42) *
    notional *
    0.00018 *
    (status === "FILLED" || status === "PART-FILL" ? 1 : 0.15)
  ).toFixed(0);
  const limitUtil = Math.round(28 + rng() * 70);

  const base: OrderRow = {
    orderId: `MM-${(100000 + i).toString()}`,
    ticket: `TKT${(48210 + i).toString()}`,
    time: new Date(TODAY.getTime() + (7 + rng() * 10) * 3600_000).toISOString(),
    trader: pick(TRADERS),
    desk: pick(DESKS),
    side,
    product,
    ccy,
    notional,
    filled,
    tenor,
    dealtRate,
    rateDir: 0,
    benchmark: BENCHMARK[ccy],
    spreadBps,
    basis: BASIS[ccy],
    tradeDate: iso(TODAY),
    valueDate: iso(valueDate),
    maturityDate: iso(maturityDate),
    days,
    counterparty,
    cptyRating,
    venue: pick(VENUES),
    status,
    creditOk: status !== "REJECTED" && limitUtil < 97,
    limitUtil,
    dv01,
    pnl,
    ssi:
      status === "FILLED"
        ? rng() > 0.15
          ? "MATCHED"
          : "PENDING"
        : status === "PART-FILL"
          ? "PENDING"
          : rng() > 0.9
            ? "FAILED"
            : "PENDING",
    fills: [],
  };
  base.fills = makeFills(base);
  return base;
}

const INITIAL_ROWS: OrderRow[] = Array.from({ length: 140 }, (_, i) =>
  makeOrder(i),
);

/* ------------------------------------------------------------------ */
/*  New-order ticket: economics + pre-trade credit                     */
/* ------------------------------------------------------------------ */

type Ccy = (typeof CCY)[number];

interface OrderTicket {
  product: Product;
  side: Side;
  ccy: Ccy;
  notional: number;
  tenor: Tenor;
  dealtRate: number;
  counterparty: string;
  trader: string;
  desk: string;
  venue: Venue;
}

const isCashProduct = (p: Product) =>
  p === "DEPO" || p === "REPO" || p === "CD";
const sidesFor = (p: Product): Side[] =>
  isCashProduct(p) ? ["LEND", "BORROW"] : ["BUY", "SELL"];

const RATING_OF: Record<string, string> = Object.fromEntries(COUNTERPARTIES);
const CPTY_NAMES = COUNTERPARTIES.map(([n]) => n);
const LINE_SIZE: Record<string, number> = {
  "AA-": 3e9,
  "A+": 2e9,
  A: 1.2e9,
  "A-": 8e8,
};

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type CreditStatus = "PASS" | "WARN" | "FAIL";

function assessCredit(counterparty: string, notional: number) {
  const rating = RATING_OF[counterparty] ?? "A";
  const lineSize = LINE_SIZE[rating] ?? 1e9;
  const used = (((hashStr(counterparty) % 46) + 20) / 100) * lineSize;
  const postUtil = ((used + notional) / lineSize) * 100;
  const status: CreditStatus =
    postUtil > 100 ? "FAIL" : postUtil > 85 ? "WARN" : "PASS";
  return { rating, lineSize, used, postUtil, status };
}

function previewEconomics(t: OrderTicket) {
  const days = TENOR_DAYS[t.tenor];
  const valueDate = addDays(TODAY, t.tenor === "O/N" ? 0 : 2);
  const maturityDate = addDays(valueDate, days);
  const denom = basisDenom(t.ccy);
  const interest = Math.round((t.notional * (t.dealtRate / 100) * days) / denom);
  const dv01 = +((t.notional * days) / 360 / 1e4 / 100).toFixed(0);
  const spreadBps = Math.round((t.dealtRate - BASE_RATE[t.ccy]) * 100);
  return {
    days,
    valueDate: iso(valueDate),
    maturityDate: iso(maturityDate),
    basis: BASIS[t.ccy],
    benchmark: BENCHMARK[t.ccy],
    interest,
    redemption: t.notional + interest,
    dv01,
    spreadBps,
  };
}

function buildManualOrder(
  t: OrderTicket,
  seq: number,
  route: "NEW" | "WORKING",
): OrderRow {
  const e = previewEconomics(t);
  const c = assessCredit(t.counterparty, t.notional);
  const blocked = c.status === "FAIL";
  return {
    orderId: `MM-${seq}`,
    ticket: `TKT${seq}`,
    time: new Date().toISOString(),
    trader: t.trader,
    desk: t.desk,
    side: t.side,
    product: t.product,
    ccy: t.ccy,
    notional: t.notional,
    filled: 0,
    tenor: t.tenor,
    dealtRate: +t.dealtRate.toFixed(4),
    rateDir: 0,
    benchmark: e.benchmark,
    spreadBps: e.spreadBps,
    basis: e.basis,
    tradeDate: iso(TODAY),
    valueDate: e.valueDate,
    maturityDate: e.maturityDate,
    days: e.days,
    counterparty: t.counterparty,
    cptyRating: c.rating,
    venue: t.venue,
    status: blocked ? "PENDING-CREDIT" : route,
    creditOk: !blocked,
    limitUtil: Math.round(Math.min(100, c.postUtil)),
    dv01: e.dv01,
    pnl: 0,
    ssi: "PENDING",
    fills: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Securities search-and-buy (cash equities / ETFs)                   */
/* ------------------------------------------------------------------ */

interface Security {
  ticker: string;
  name: string;
  assetClass: "Equity" | "ETF";
  ccy: string;
  exchange: string;
  isin: string;
  last: number;
  changePct: number;
}

const SECURITIES: Security[] = [
  { ticker: "AAPL", name: "Apple Inc.", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US0378331005", last: 232.45, changePct: 0.84 },
  { ticker: "MSFT", name: "Microsoft Corp.", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US5949181045", last: 451.12, changePct: -0.32 },
  { ticker: "NVDA", name: "NVIDIA Corp.", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US67066G1040", last: 138.9, changePct: 2.41 },
  { ticker: "AMZN", name: "Amazon.com Inc.", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US0231351067", last: 201.34, changePct: 0.12 },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US02079K3059", last: 176.58, changePct: -0.58 },
  { ticker: "META", name: "Meta Platforms Inc.", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US30303M1027", last: 612.7, changePct: 1.07 },
  { ticker: "TSLA", name: "Tesla Inc.", assetClass: "Equity", ccy: "USD", exchange: "NASDAQ", isin: "US88160R1014", last: 348.22, changePct: -1.84 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", assetClass: "Equity", ccy: "USD", exchange: "NYSE", isin: "US46625H1005", last: 248.61, changePct: 0.44 },
  { ticker: "BRK.B", name: "Berkshire Hathaway Inc. B", assetClass: "Equity", ccy: "USD", exchange: "NYSE", isin: "US0846707026", last: 478.05, changePct: 0.21 },
  { ticker: "XOM", name: "Exxon Mobil Corp.", assetClass: "Equity", ccy: "USD", exchange: "NYSE", isin: "US30231G1022", last: 117.83, changePct: -0.66 },
  { ticker: "ASML", name: "ASML Holding NV", assetClass: "Equity", ccy: "EUR", exchange: "AEX", isin: "NL0010273215", last: 689.4, changePct: 1.52 },
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "ETF", ccy: "USD", exchange: "ARCA", isin: "US78462F1030", last: 583.91, changePct: 0.39 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", assetClass: "ETF", ccy: "USD", exchange: "NASDAQ", isin: "US46090E1038", last: 502.18, changePct: 0.55 },
  { ticker: "BIL", name: "SPDR 1-3 Month T-Bill ETF", assetClass: "ETF", ccy: "USD", exchange: "ARCA", isin: "US78468R6634", last: 91.66, changePct: 0.01 },
];

function searchSecurities(q: string): Security[] {
  const s = q.trim().toUpperCase();
  if (!s) return SECURITIES.slice(0, 6);
  return SECURITIES.filter(
    (x) =>
      x.ticker.includes(s) || x.name.toUpperCase().includes(s),
  ).slice(0, 8);
}

interface SecurityOrderParams {
  side: "BUY" | "SELL";
  qty: number;
  orderType: "MARKET" | "LIMIT";
  limitPx: number;
}

function buildSecurityOrder(
  sec: Security,
  p: SecurityOrderParams,
  seq: number,
  route: "NEW" | "WORKING",
): OrderRow {
  const px = p.orderType === "LIMIT" ? p.limitPx : sec.last;
  const consideration = Math.round(p.qty * px);
  const c = assessCredit(sec.name, consideration);
  const blocked = c.status === "FAIL";
  return {
    orderId: `MM-${seq}`,
    ticket: `TKT${seq}`,
    time: new Date().toISOString(),
    trader: "M. Doyle",
    desk: "Securities",
    side: p.side,
    product: "EQUITY",
    ccy: sec.ccy,
    notional: consideration,
    filled: 0,
    tenor: "SPOT",
    dealtRate: +px.toFixed(4),
    rateDir: 0,
    benchmark: sec.ticker,
    spreadBps: 0,
    basis: sec.assetClass === "ETF" ? "ETF" : "EQ",
    tradeDate: iso(TODAY),
    valueDate: iso(addDays(TODAY, 1)),
    maturityDate: "",
    days: 0,
    counterparty: sec.name,
    cptyRating: c.rating,
    venue: "ECN",
    status: blocked ? "PENDING-CREDIT" : route,
    creditOk: !blocked,
    limitUtil: Math.round(Math.min(100, c.postUtil)),
    dv01: 0,
    pnl: 0,
    ssi: "PENDING",
    fills: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */

const nfInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nfSignedInt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "always",
});

const fmtNotional = (p: ValueFormatterParams) =>
  p.value == null ? "" : nfInt.format(p.value);
const fmtRate = (p: ValueFormatterParams) =>
  p.value == null ? "" : Number(p.value).toFixed(4);
const fmtBps = (p: ValueFormatterParams) =>
  p.value == null ? "" : `${p.value > 0 ? "+" : ""}${p.value}`;
const fmtSignedInt = (p: ValueFormatterParams) =>
  p.value == null ? "" : nfSignedInt.format(p.value);
const fmtTime = (p: ValueFormatterParams) =>
  p.value ? new Date(p.value).toISOString().slice(11, 19) : "";

/* ------------------------------------------------------------------ */
/*  Cell renderers                                                     */
/* ------------------------------------------------------------------ */

const chip =
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide leading-none";

function SideBadge({ value }: ICellRendererParams<OrderRow, Side>) {
  if (!value) return null;
  const long = value === "BUY" || value === "LEND";
  return (
    <span
      className={`${chip} ${
        long
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      }`}
    >
      {value}
    </span>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  NEW: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  "PENDING-CREDIT": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  WORKING: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  "PART-FILL": "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  FILLED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CANCELLED: "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function StatusPill({ value }: ICellRendererParams<OrderRow, Status>) {
  if (!value) return null;
  const live =
    value === "WORKING" || value === "PART-FILL" || value === "NEW";
  return (
    <span className={`${chip} gap-1 ${STATUS_STYLE[value]}`}>
      {live && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {value}
    </span>
  );
}

function RateCell({ data, value }: ICellRendererParams<OrderRow, number>) {
  if (value == null) return null;
  const dir = data?.rateDir ?? 0;
  return (
    <span className="flex items-center justify-end gap-1 font-mono tabular-nums">
      {Number(value).toFixed(4)}
      {dir !== 0 && (
        <span className={dir > 0 ? "text-emerald-600" : "text-rose-600"}>
          {dir > 0 ? "▲" : "▼"}
        </span>
      )}
    </span>
  );
}

function PnlCell({ value }: ICellRendererParams<OrderRow, number>) {
  if (value == null) return null;
  const v = Number(value);
  const flat = v === 0;
  return (
    <span
      className={`font-mono tabular-nums ${
        flat
          ? "text-neutral-500"
          : v > 0
            ? "text-emerald-600"
            : "text-rose-600"
      }`}
    >
      {nfSignedInt.format(v)}
    </span>
  );
}

function FillBar({ data }: ICellRendererParams<OrderRow>) {
  if (!data) return null;
  const pct = data.notional > 0 ? data.filled / data.notional : 0;
  const done = pct >= 1;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full ${
            done ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(100, pct * 100)}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-neutral-600">
        {(pct * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function LimitGauge({ value }: ICellRendererParams<OrderRow, number>) {
  if (value == null) return null;
  const v = Number(value);
  const tone =
    v >= 90
      ? "bg-rose-500"
      : v >= 75
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, v)}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-neutral-600">
        {v}%
      </span>
    </div>
  );
}

function CreditDot({ data }: ICellRendererParams<OrderRow>) {
  if (!data) return null;
  const ok = data.creditOk;
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${
          ok ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      <span className="text-[11px] text-neutral-600">
        {ok ? "Cleared" : "Blocked"}
      </span>
    </span>
  );
}

const SSI_STYLE: Record<SsiState, string> = {
  MATCHED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  FAILED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};
function SsiPill({ value }: ICellRendererParams<OrderRow, SsiState>) {
  if (!value) return null;
  return <span className={`${chip} ${SSI_STYLE[value]}`}>{value}</span>;
}

function CptyCell({ data }: ICellRendererParams<OrderRow>) {
  if (!data) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{data.counterparty}</span>
      <span className="rounded bg-neutral-100 px-1 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
        {data.cptyRating}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Master / detail — fills sub-grid                                   */
/* ------------------------------------------------------------------ */

const detailColumnDefs: ColDef<Fill>[] = [
  { field: "fillId", headerName: "Fill ID", flex: 1 },
  {
    field: "time",
    headerName: "Exec Time",
    valueFormatter: fmtTime,
    flex: 1,
  },
  {
    field: "qty",
    headerName: "Qty",
    type: "rightAligned",
    valueFormatter: fmtNotional,
    flex: 1,
  },
  {
    field: "rate",
    headerName: "Exec Rate",
    type: "rightAligned",
    valueFormatter: (p) => (p.value == null ? "" : Number(p.value).toFixed(4)),
    flex: 1,
  },
  { field: "venue", headerName: "Venue", flex: 1 },
  { field: "broker", headerName: "Broker", flex: 1 },
  { field: "account", headerName: "Allocation", flex: 1 },
];

/* ------------------------------------------------------------------ */
/*  Computed value getters                                             */
/* ------------------------------------------------------------------ */

const interestGetter = (p: ValueGetterParams<OrderRow>) => {
  const d = p.data;
  if (!d) return null;
  return Math.round(
    (d.notional * (d.dealtRate / 100) * d.days) / basisDenom(d.ccy),
  );
};
const remainingGetter = (p: ValueGetterParams<OrderRow>) =>
  p.data ? p.data.notional - p.data.filled : null;

/* Notional-weighted average rate aggregation for group rows */
function wavgRate(params: IAggFuncParams<OrderRow>) {
  const leaves = params.rowNode.allLeafChildren ?? [];
  let wsum = 0;
  let nsum = 0;
  for (const n of leaves) {
    const d = n.data;
    if (!d) continue;
    wsum += d.dealtRate * d.notional;
    nsum += d.notional;
  }
  return nsum > 0 ? +(wsum / nsum).toFixed(4) : null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type GroupBy = "none" | "ccy" | "product" | "trader" | "counterparty";

const GROUP_FIELD: Record<Exclude<GroupBy, "none">, string> = {
  ccy: "ccy",
  product: "product",
  trader: "trader",
  counterparty: "counterparty",
};

export default function Blotter() {
  const apiRef = useRef<GridApi<OrderRow> | null>(null);
  const rowsRef = useRef<OrderRow[]>(INITIAL_ROWS);
  const liveRef = useRef(true);
  const productFilterRef = useRef<Product | "ALL">("ALL");
  const tickRef = useRef(0);
  const seqRef = useRef(900000);

  const [quickFilter, setQuickFilter] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [productFilter, setProductFilter] = useState<Product | "ALL">("ALL");
  const [live, setLive] = useState(true);
  const [compact, setCompact] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kpis, setKpis] = useState(() => computeKpis(INITIAL_ROWS));

  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  useEffect(() => {
    productFilterRef.current = productFilter;
    apiRef.current?.onFilterChanged();
  }, [productFilter]);

  /* ---- theme ------------------------------------------------------ */
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

  /* ---- order actions --------------------------------------------- */
  const syncRow = useCallback((row: OrderRow) => {
    rowsRef.current = rowsRef.current.map((r) =>
      r.orderId === row.orderId ? row : r,
    );
  }, []);

  const pullOrder = useCallback(
    (orderId?: string) => {
      if (!orderId) return;
      const api = apiRef.current;
      const node = api?.getRowNode(orderId);
      if (!node?.data) return;
      if (node.data.status === "FILLED" || node.data.status === "CANCELLED")
        return;
      const updated: OrderRow = { ...node.data, status: "CANCELLED" };
      syncRow(updated);
      api?.applyTransaction({ update: [updated] });
      api?.flashCells({ rowNodes: [node] });
      setKpis(computeKpis(rowsRef.current));
    },
    [syncRow],
  );

  const bookOrder = useCallback((o: OrderRow) => {
    rowsRef.current = [o, ...rowsRef.current];
    const api = apiRef.current;
    api?.applyTransaction({ add: [o], addIndex: 0 });
    setKpis(computeKpis(rowsRef.current));
    // make sure the trader can actually see the order they just booked
    if (
      productFilterRef.current !== "ALL" &&
      productFilterRef.current !== o.product
    ) {
      setProductFilter("ALL");
    }
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      const node = api?.getRowNode(o.orderId);
      if (!node) return;
      node.setSelected(true, true);
      api?.ensureNodeVisible(node, "top");
      api?.flashCells({ rowNodes: [node] });
    });
  }, []);

  const submitOrder = useCallback(
    (t: OrderTicket, route: "NEW" | "WORKING") => {
      bookOrder(buildManualOrder(t, ++seqRef.current, route));
    },
    [bookOrder],
  );

  const buySecurity = useCallback(
    (sec: Security, p: SecurityOrderParams, route: "NEW" | "WORKING") => {
      bookOrder(buildSecurityOrder(sec, p, ++seqRef.current, route));
    },
    [bookOrder],
  );

  /* ---- column definitions ---------------------------------------- */
  const columnDefs = useMemo<(ColDef<OrderRow> | ColGroupDef<OrderRow>)[]>(
    () => [
      {
        headerName: "Order",
        children: [
          {
            field: "status",
            headerName: "Status",
            pinned: "left",
            width: 138,
            cellRenderer: StatusPill,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
            cellClass: "flex items-center",
          },
          {
            field: "orderId",
            headerName: "Order ID",
            pinned: "left",
            width: 116,
            cellRenderer: "agGroupCellRenderer",
            cellClass: "font-mono text-[11px]",
            filter: "agTextColumnFilter",
          },
          {
            field: "side",
            headerName: "Side",
            pinned: "left",
            width: 92,
            cellRenderer: SideBadge,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
            cellClass: "flex items-center",
          },
          {
            field: "product",
            headerName: "Product",
            width: 100,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
          },
          {
            field: "tenor",
            headerName: "Tenor",
            width: 78,
            filter: "agSetColumnFilter",
            cellClass: "font-mono",
          },
          {
            field: "time",
            headerName: "Entered",
            width: 92,
            valueFormatter: fmtTime,
            cellClass: "font-mono text-[11px] text-neutral-500",
          },
        ],
      },
      {
        headerName: "Counterparty",
        children: [
          {
            field: "counterparty",
            headerName: "Counterparty",
            width: 180,
            cellRenderer: CptyCell,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
            tooltipField: "counterparty",
          },
          {
            field: "venue",
            headerName: "Venue",
            width: 104,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
          },
          {
            field: "trader",
            headerName: "Trader",
            width: 110,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
          },
          {
            field: "desk",
            headerName: "Book",
            width: 116,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
          },
        ],
      },
      {
        headerName: "Economics",
        children: [
          {
            field: "ccy",
            headerName: "CCY",
            width: 70,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
            cellClass: "font-mono font-medium",
          },
          {
            field: "notional",
            headerName: "Notional",
            width: 130,
            type: "rightAligned",
            valueFormatter: fmtNotional,
            aggFunc: "sum",
            enableValue: true,
            cellClass: "font-mono tabular-nums",
            filter: "agNumberColumnFilter",
          },
          {
            colId: "filled",
            headerName: "Fill",
            width: 120,
            cellRenderer: FillBar,
            sortable: false,
            valueGetter: (p) =>
              p.data && p.data.notional > 0
                ? p.data.filled / p.data.notional
                : 0,
          },
          {
            colId: "remaining",
            headerName: "Remaining",
            width: 122,
            type: "rightAligned",
            valueGetter: remainingGetter,
            valueFormatter: fmtNotional,
            aggFunc: "sum",
            cellClass: "font-mono tabular-nums text-neutral-500",
          },
          {
            field: "dealtRate",
            headerName: "Dealt Rate",
            width: 110,
            type: "rightAligned",
            cellRenderer: RateCell,
            valueFormatter: fmtRate,
            enableCellChangeFlash: true,
            aggFunc: "wavgRate",
            filter: "agNumberColumnFilter",
            headerTooltip: "Notional-weighted average rate at group level",
          },
          {
            field: "benchmark",
            headerName: "Bmk",
            width: 80,
            cellClass: "font-mono text-[11px] text-neutral-500",
          },
          {
            field: "spreadBps",
            headerName: "Spr (bps)",
            width: 96,
            type: "rightAligned",
            valueFormatter: fmtBps,
            enableCellChangeFlash: true,
            cellClass: "font-mono tabular-nums",
            filter: "agNumberColumnFilter",
          },
          {
            colId: "interest",
            headerName: "Interest",
            width: 122,
            type: "rightAligned",
            valueGetter: interestGetter,
            valueFormatter: fmtNotional,
            aggFunc: "sum",
            cellClass: "font-mono tabular-nums",
          },
          {
            field: "basis",
            headerName: "Basis",
            width: 86,
            cellClass: "font-mono text-[11px] text-neutral-500",
          },
        ],
      },
      {
        headerName: "Schedule",
        children: [
          {
            field: "tradeDate",
            headerName: "Trade",
            width: 110,
            cellClass: "font-mono text-[11px]",
          },
          {
            field: "valueDate",
            headerName: "Value",
            width: 110,
            cellClass: "font-mono text-[11px]",
          },
          {
            field: "maturityDate",
            headerName: "Maturity",
            width: 112,
            cellClass: "font-mono text-[11px]",
          },
          {
            field: "days",
            headerName: "Days",
            width: 74,
            type: "rightAligned",
            cellClass: "font-mono tabular-nums",
          },
        ],
      },
      {
        headerName: "Risk & P&L",
        children: [
          {
            field: "dv01",
            headerName: "DV01",
            width: 100,
            type: "rightAligned",
            valueFormatter: fmtSignedInt,
            aggFunc: "sum",
            cellClass: "font-mono tabular-nums",
          },
          {
            field: "pnl",
            headerName: "MTM P&L",
            width: 116,
            type: "rightAligned",
            cellRenderer: PnlCell,
            aggFunc: "sum",
            enableCellChangeFlash: true,
            filter: "agNumberColumnFilter",
          },
          {
            field: "limitUtil",
            headerName: "Line Util",
            width: 126,
            cellRenderer: LimitGauge,
            filter: "agNumberColumnFilter",
          },
          {
            colId: "credit",
            headerName: "Credit",
            width: 104,
            cellRenderer: CreditDot,
            sortable: false,
          },
          {
            field: "ssi",
            headerName: "SSI",
            width: 96,
            cellRenderer: SsiPill,
            filter: "agSetColumnFilter",
            cellClass: "flex items-center",
          },
        ],
      },
      {
        headerName: "",
        children: [
          {
            colId: "actions",
            headerName: "",
            pinned: "right",
            width: 116,
            sortable: false,
            filter: false,
            resizable: false,
            cellClass: "flex items-center",
            cellRenderer: (p: ICellRendererParams<OrderRow>) => (
              <ActionsCell
                data={p.data}
                onPull={() => pullOrder(p.data?.orderId)}
              />
            ),
          },
        ],
      },
    ],
    [pullOrder],
  );

  const defaultColDef = useMemo<ColDef<OrderRow>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      floatingFilter: true,
      enableCellChangeFlash: false,
      minWidth: 64,
    }),
    [],
  );

  /* group state is driven declaratively from `groupBy` */
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const fields = Object.values(GROUP_FIELD);
    api.applyColumnState({
      state: fields.map((f) => ({
        colId: f,
        rowGroup: groupBy !== "none" && GROUP_FIELD[groupBy as keyof typeof GROUP_FIELD] === f,
        hide:
          groupBy !== "none" &&
          GROUP_FIELD[groupBy as keyof typeof GROUP_FIELD] === f,
      })),
      defaultState: { rowGroup: false },
    });
  }, [groupBy]);

  /* ---- external (chip) filter for product ------------------------ */
  const isExternalFilterPresent = useCallback(
    () => productFilterRef.current !== "ALL",
    [],
  );
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<OrderRow>) =>
      !node.data || node.data.product === productFilterRef.current,
    [],
  );

  /* ---- live market simulation ------------------------------------ */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!liveRef.current) return;
      const api = apiRef.current;
      if (!api) return;
      tickRef.current += 1;

      const updates: OrderRow[] = [];
      const candidates = rowsRef.current.filter(
        (r) =>
          r.status === "WORKING" ||
          r.status === "PART-FILL" ||
          r.status === "NEW",
      );
      // re-price + progress a slice of the live book each tick
      for (let k = 0; k < Math.min(14, candidates.length); k++) {
        const src = candidates[Math.floor(rng() * candidates.length)];
        const r: OrderRow = { ...src };
        const isEquity = r.product === "EQUITY";
        // equities tick on price (~±0.15%); MM instruments tick on rate
        const bump = isEquity
          ? +(r.dealtRate * (rng() - 0.5) * 0.003).toFixed(4)
          : +((rng() - 0.5) * 0.006).toFixed(4);
        const newRate = +(r.dealtRate + bump).toFixed(4);
        r.rateDir = newRate > r.dealtRate ? 1 : newRate < r.dealtRate ? -1 : 0;
        r.dealtRate = newRate;
        r.spreadBps = isEquity
          ? 0
          : Math.round((newRate - BASE_RATE[r.ccy]) * 100);
        r.pnl = Math.round(
          r.pnl + (rng() - 0.48) * r.notional * 0.00012 - bump * r.dv01 * 100,
        );

        if (r.status === "NEW" && rng() > 0.4) {
          r.status = r.creditOk ? "WORKING" : "PENDING-CREDIT";
        } else if (r.status === "WORKING" && rng() > 0.78) {
          r.status = "PART-FILL";
          r.filled = Math.round((r.notional * (0.2 + rng() * 0.4)) / 1e6) * 1e6;
          r.fills = makeFills(r);
          r.ssi = "PENDING";
        } else if (r.status === "PART-FILL" && rng() > 0.7) {
          const add =
            Math.round((r.notional * (0.2 + rng() * 0.5)) / 1e6) * 1e6;
          r.filled = Math.min(r.notional, r.filled + add);
          if (r.filled >= r.notional) {
            r.status = "FILLED";
            r.filled = r.notional;
            r.ssi = rng() > 0.2 ? "MATCHED" : "PENDING";
          }
          r.fills = makeFills(r);
        }
        syncRow(r);
        updates.push(r);
      }

      api.applyTransaction({ update: updates });
      if (tickRef.current % 7 === 0) {
        const o = makeOrder(100000 + Math.floor(rng() * 5000));
        o.status = "NEW";
        o.filled = 0;
        o.fills = [];
        rowsRef.current = [o, ...rowsRef.current];
        api.applyTransaction({ add: [o], addIndex: 0 });
      }
      api.refreshClientSideRowModel("aggregate");
      setKpis(computeKpis(rowsRef.current));
    }, 1300);
    return () => window.clearInterval(id);
  }, [syncRow]);

  /* ---- pinned blotter total -------------------------------------- */
  const onGridReady = useCallback((e: GridReadyEvent<OrderRow>) => {
    apiRef.current = e.api;
  }, []);

  const statusBar = useMemo<{ statusPanels: StatusPanelDef[] }>(
    () => ({
      statusPanels: [
        { statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" },
        { statusPanel: "agFilteredRowCountComponent" },
        { statusPanel: "agSelectedRowCountComponent" },
        { statusPanel: "agAggregationComponent", align: "right" },
      ],
    }),
    [],
  );

  const sideBar = useMemo<SideBarDef>(
    () => ({
      toolPanels: ["columns", "filters"],
    }),
    [],
  );

  const autoGroupColumnDef = useMemo<ColDef<OrderRow>>(
    () => ({
      headerName: "Group",
      minWidth: 240,
      pinned: "left",
      cellRendererParams: { suppressCount: false },
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
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                Money Market Execution
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    live ? "animate-pulse bg-emerald-500" : "bg-neutral-300"
                  }`}
                />
                {live ? "Live market data" : "Feed paused"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
              Order Blotter
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi label="Live orders" value={kpis.liveCount.toString()} />
            <Kpi
              label="Working notional"
              value={`$${(kpis.workingNotional / 1e9).toFixed(2)}bn`}
            />
            <Kpi
              label="Filled today"
              value={`$${(kpis.filledNotional / 1e9).toFixed(2)}bn`}
            />
            <Kpi
              label="Net DV01"
              value={nfSignedInt.format(kpis.netDv01)}
              tone={kpis.netDv01 >= 0 ? "pos" : "neg"}
            />
            <Kpi
              label="Desk P&L"
              value={`$${nfSignedInt.format(kpis.netPnl)}`}
              tone={kpis.netPnl >= 0 ? "pos" : "neg"}
            />
          </div>
        </div>

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search orders, cpty, trader…"
              className="h-8 w-64 rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-2.5 top-2 h-4 w-4 text-neutral-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5">
            {(["ALL", ...PRODUCTS] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProductFilter(p)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                  productFilter === p
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
              Group
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="none">None</option>
                <option value="ccy">Currency</option>
                <option value="product">Product</option>
                <option value="trader">Trader</option>
                <option value="counterparty">Counterparty</option>
              </select>
            </label>
            <ToolbarBtn onClick={() => setCompact((c) => !c)}>
              {compact ? "Comfortable" : "Compact"}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => setLive((l) => !l)}>
              {live ? "Pause feed" : "Resume feed"}
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() =>
                apiRef.current?.exportDataAsCsv({
                  fileName: "mm-blotter.csv",
                })
              }
            >
              Export
            </ToolbarBtn>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="h-8 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              + New order
            </button>
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="min-h-0 flex-1 px-4 py-4">
        <AgGridReact<OrderRow>
          theme={theme}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          autoGroupColumnDef={autoGroupColumnDef}
          rowData={INITIAL_ROWS}
          getRowId={(p) => p.data.orderId}
          onGridReady={onGridReady}
          quickFilterText={quickFilter}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
          aggFuncs={{ wavgRate }}
          rowGroupPanelShow="always"
          groupDefaultExpanded={0}
          suppressAggFuncInHeader
          masterDetail
          isRowMaster={(d) => !!d && d.fills.length > 0}
          detailRowAutoHeight
          detailCellRendererParams={{
            detailGridOptions: {
              columnDefs: detailColumnDefs,
              defaultColDef: { sortable: true, resizable: true, flex: 1 },
              headerHeight: 30,
            },
            getDetailRowData: (p: {
              data: OrderRow;
              successCallback: (rows: Fill[]) => void;
            }) => p.successCallback(p.data.fills),
          }}
          rowSelection={{
            mode: "multiRow",
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
          }}
          cellSelection
          sideBar={sideBar}
          statusBar={statusBar}
          animateRows
          rowHeight={compact ? 34 : 42}
          headerHeight={compact ? 32 : 38}
          tooltipShowDelay={300}
          getRowClass={(p) =>
            p.data?.status === "REJECTED"
              ? "bg-rose-50/60"
              : p.data?.status === "CANCELLED"
                ? "opacity-55"
                : ""
          }
          pinnedBottomRowData={[buildTotalRow(kpis)]}
        />
      </div>

      <NewOrderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={submitOrder}
        onBuySecurity={buySecurity}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
          tone === "pos"
            ? "text-emerald-600"
            : tone === "neg"
              ? "text-rose-600"
              : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
    >
      {children}
    </button>
  );
}

function ActionsCell({
  data,
  onPull,
}: {
  data?: OrderRow;
  onPull: () => void;
}) {
  if (!data) return null;
  const terminal =
    data.status === "FILLED" ||
    data.status === "CANCELLED" ||
    data.status === "REJECTED";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 disabled:text-neutral-300 disabled:hover:bg-transparent"
        disabled={terminal}
      >
        Amend
      </button>
      <button
        type="button"
        onClick={onPull}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:text-neutral-300 disabled:hover:bg-transparent"
        disabled={terminal}
      >
        Pull
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New Order drawer                                                   */
/* ------------------------------------------------------------------ */

const DEFAULT_TICKET: OrderTicket = {
  product: "DEPO",
  side: "LEND",
  ccy: "USD",
  notional: 25_000_000,
  tenor: "3M",
  dealtRate: BASE_RATE.USD,
  counterparty: CPTY_NAMES[0],
  trader: "M. Doyle",
  desk: DESKS[0],
  venue: "VOICE",
};

const NOTIONAL_CHIPS = [5, 10, 25, 50, 100, 250];

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition ${
            o === value
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold tracking-wide uppercase text-neutral-500">
          {label}
        </label>
        {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <span
        className={`font-mono text-xs font-semibold tabular-nums ${
          tone === "pos"
            ? "text-emerald-600"
            : tone === "neg"
              ? "text-rose-600"
              : "text-neutral-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const CREDIT_STYLE: Record<CreditStatus, string> = {
  PASS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  WARN: "bg-amber-50 text-amber-700 ring-amber-200",
  FAIL: "bg-rose-50 text-rose-700 ring-rose-200",
};

function SecuritiesPanel({
  onBuy,
  onCancel,
}: {
  onBuy: (
    sec: Security,
    p: SecurityOrderParams,
    route: "NEW" | "WORKING",
  ) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Security | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [qty, setQty] = useState(500);
  const [limitPx, setLimitPx] = useState(0);

  const results = useMemo(() => searchSecurities(query), [query]);

  const choose = (s: Security) => {
    setSel(s);
    setLimitPx(s.last);
  };

  const px = sel ? (orderType === "LIMIT" ? limitPx : sel.last) : 0;
  const consideration = sel ? Math.round(qty * px) : 0;
  const credit = useMemo(
    () => (sel ? assessCredit(sel.name, consideration) : null),
    [sel, consideration],
  );

  const qtyValid = Number.isInteger(qty) && qty > 0 && qty <= 1_000_000;
  const limitValid =
    orderType === "MARKET" || (Number.isFinite(limitPx) && limitPx > 0);
  const canPlace =
    !!sel && qtyValid && limitValid && credit?.status !== "FAIL";
  const route: "NEW" | "WORKING" =
    orderType === "MARKET" ? "WORKING" : "NEW";

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker or name — e.g. AAPL"
            autoFocus
            className="h-10 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="absolute left-3 top-3 h-4 w-4 text-neutral-400"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {!sel ? (
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-400">
                No instruments match “{query}”.
              </div>
            ) : (
              results.map((s) => (
                <button
                  key={s.ticker}
                  type="button"
                  onClick={() => choose(s)}
                  className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2.5 text-left last:border-0 hover:bg-neutral-50"
                >
                  <span className="w-16 font-mono text-sm font-semibold text-neutral-900">
                    {s.ticker}
                  </span>
                  <span className="flex-1 truncate text-sm text-neutral-600">
                    {s.name}
                  </span>
                  <span
                    className={`${chip} bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200`}
                  >
                    {s.assetClass}
                  </span>
                  <span className="w-20 text-right font-mono text-sm tabular-nums">
                    {s.last.toFixed(2)}
                  </span>
                  <span
                    className={`w-16 text-right font-mono text-xs tabular-nums ${
                      s.changePct >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {s.changePct >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(s.changePct).toFixed(2)}%
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-neutral-200 px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-semibold text-neutral-950">
                      {sel.ticker}
                    </span>
                    <span
                      className={`${chip} bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200`}
                    >
                      {sel.assetClass}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-600">{sel.name}</div>
                  <div className="mt-1 text-[11px] text-neutral-400">
                    {sel.exchange} · {sel.isin} · {sel.ccy}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg font-semibold tabular-nums">
                    {sel.last.toFixed(2)}
                  </div>
                  <div
                    className={`font-mono text-xs tabular-nums ${
                      sel.changePct >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {sel.changePct >= 0 ? "+" : ""}
                    {sel.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSel(null)}
                className="mt-2 text-[11px] font-medium text-indigo-600 hover:underline"
              >
                ← Back to results
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Side">
                <Seg
                  value={side}
                  options={["BUY", "SELL"] as const}
                  onChange={setSide}
                />
              </FieldRow>
              <FieldRow label="Order type">
                <Seg
                  value={orderType}
                  options={["MARKET", "LIMIT"] as const}
                  onChange={setOrderType}
                />
              </FieldRow>
            </div>

            <FieldRow
              label="Quantity"
              hint={qtyValid ? "shares" : "1 – 1,000,000 shares"}
            >
              <div className="space-y-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) =>
                    setQty(Math.floor(Number(e.target.value)))
                  }
                  className={`h-9 w-full rounded-md border bg-white px-3 font-mono text-sm tabular-nums outline-none focus:ring-2 ${
                    qtyValid
                      ? "border-neutral-200 focus:border-indigo-400 focus:ring-indigo-100"
                      : "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  }`}
                />
                <div className="flex flex-wrap gap-1">
                  {[100, 500, 1000, 5000].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQty(n)}
                      className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </FieldRow>

            {orderType === "LIMIT" && (
              <FieldRow
                label="Limit price"
                hint={`Last ${sel.last.toFixed(2)}`}
              >
                <input
                  type="number"
                  step="0.01"
                  value={limitPx}
                  onChange={(e) => setLimitPx(Number(e.target.value))}
                  className={`h-9 w-full rounded-md border bg-white px-3 font-mono text-sm tabular-nums outline-none focus:ring-2 ${
                    limitValid
                      ? "border-neutral-200 focus:border-indigo-400 focus:ring-indigo-100"
                      : "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  }`}
                />
              </FieldRow>
            )}

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="mb-1 text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Order preview
              </div>
              <Stat
                label="Order"
                value={`${side} ${qty.toLocaleString()} ${sel.ticker} @ ${
                  orderType === "MARKET" ? "MKT" : limitPx.toFixed(2)
                }`}
              />
              <Stat
                label="Reference price"
                value={`${sel.ccy} ${px.toFixed(2)}`}
              />
              <Stat
                label="Est. consideration"
                value={`${sel.ccy} ${nfInt.format(consideration)}`}
              />
              <Stat
                label="Settlement"
                value={`T+1 · ${iso(addDays(TODAY, 1))}`}
              />
            </div>

            {credit && (
              <div className="rounded-lg border border-neutral-200 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                    Credit &amp; limits
                  </span>
                  <span
                    className={`${chip} ring-1 ${CREDIT_STYLE[credit.status]}`}
                  >
                    {credit.status}
                  </span>
                </div>
                <Stat
                  label={`Issuer line (${credit.rating})`}
                  value={`${sel.ccy} ${(credit.lineSize / 1e9).toFixed(1)}bn`}
                />
                <Stat
                  label="Post-trade utilisation"
                  value={`${Math.min(999, credit.postUtil).toFixed(0)}%`}
                  tone={
                    credit.status === "FAIL"
                      ? "neg"
                      : credit.status === "PASS"
                        ? "pos"
                        : undefined
                  }
                />
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={`h-full rounded-full ${
                      credit.status === "FAIL"
                        ? "bg-rose-500"
                        : credit.status === "WARN"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, credit.postUtil)}%` }}
                  />
                </div>
                {credit.status === "FAIL" && (
                  <p className="mt-2 text-[11px] text-rose-600">
                    Order value exceeds the issuer limit.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-neutral-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canPlace}
            onClick={() =>
              sel && onBuy(sel, { side, qty, orderType, limitPx }, route)
            }
            className={`ml-auto h-9 rounded-md px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              side === "BUY"
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-rose-600 hover:bg-rose-500"
            }`}
          >
            {sel
              ? `${side === "BUY" ? "Buy" : "Sell"} ${sel.ticker} · ${
                  orderType === "MARKET" ? "Market" : "Limit"
                }`
              : "Select an instrument"}
          </button>
        </div>
      </div>
    </>
  );
}

function NewOrderDrawer({
  open,
  onClose,
  onSubmit,
  onBuySecurity,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (t: OrderTicket, route: "NEW" | "WORKING") => void;
  onBuySecurity: (
    sec: Security,
    p: SecurityOrderParams,
    route: "NEW" | "WORKING",
  ) => void;
}) {
  const [mode, setMode] = useState<"mm" | "securities">("mm");
  const [ticket, setTicket] = useState<OrderTicket>(DEFAULT_TICKET);
  const [rateTouched, setRateTouched] = useState(false);

  // reset to a clean ticket on the way out, so every open starts fresh
  // without driving state from an effect
  const close = () => {
    setTicket(DEFAULT_TICKET);
    setRateTouched(false);
    setMode("mm");
    onClose();
  };
  const buySecurity = (
    sec: Security,
    p: SecurityOrderParams,
    route: "NEW" | "WORKING",
  ) => {
    onBuySecurity(sec, p, route);
    setMode("mm");
  };
  const submit = (route: "NEW" | "WORKING") => {
    onSubmit(ticket, route);
    setTicket(DEFAULT_TICKET);
    setRateTouched(false);
  };

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (p: Partial<OrderTicket>) =>
    setTicket((prev) => {
      const next = { ...prev, ...p };
      // keep side consistent with the product class
      if (p.product && !sidesFor(next.product).includes(next.side)) {
        next.side = sidesFor(next.product)[0];
      }
      // follow the mid when the rate hasn't been hand-set
      if (p.ccy && !rateTouched) next.dealtRate = BASE_RATE[next.ccy];
      return next;
    });

  const econ = useMemo(() => previewEconomics(ticket), [ticket]);
  const credit = useMemo(
    () => assessCredit(ticket.counterparty, ticket.notional),
    [ticket.counterparty, ticket.notional],
  );

  const notionalValid =
    Number.isFinite(ticket.notional) &&
    ticket.notional >= 1_000_000 &&
    ticket.notional <= 5_000_000_000;
  const rateValid =
    Number.isFinite(ticket.dealtRate) &&
    ticket.dealtRate > -1 &&
    ticket.dealtRate < 25;
  const canPark = notionalValid && rateValid;
  const canSend = canPark && credit.status !== "FAIL";

  const spreadTone =
    econ.spreadBps > 0 ? "pos" : econ.spreadBps < 0 ? "neg" : undefined;
  const longCash = ticket.side === "LEND" || ticket.side === "BUY";

  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close new order"
        onClick={close}
        className={`absolute inset-0 bg-neutral-950/30 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* panel */}
      <div
        role="dialog"
        aria-label="New order"
        aria-modal="true"
        className={`absolute right-0 top-0 flex h-full w-[460px] max-w-[92vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
              {mode === "mm"
                ? "Money Market · New Order"
                : "Securities · Search & Trade"}
            </div>
            {mode === "mm" ? (
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-neutral-950">
                <span
                  className={`${chip} ${
                    longCash
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  }`}
                >
                  {ticket.side}
                </span>
                {ticket.product}
                <span className="text-neutral-300">·</span>
                <span className="font-mono text-base">
                  {ticket.ccy} {(ticket.notional / 1e6).toFixed(0)}mm
                </span>
                <span className="text-neutral-300">·</span>
                <span className="text-base">{ticket.tenor}</span>
              </div>
            ) : (
              <div className="mt-1 text-lg font-semibold text-neutral-950">
                Buy &amp; sell equities / ETFs
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* mode tabs */}
        <div className="flex gap-1 border-b border-neutral-200 px-5 pt-3">
          {(
            [
              ["mm", "Money Market"],
              ["securities", "Securities"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                mode === m
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "securities" ? (
          <SecuritiesPanel onBuy={buySecurity} onCancel={close} />
        ) : (
          <>
            {/* body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <FieldRow label="Product">
            <Seg
              value={ticket.product}
              options={PRODUCTS}
              onChange={(product) => patch({ product })}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Side">
              <Seg
                value={ticket.side}
                options={sidesFor(ticket.product)}
                onChange={(side) => patch({ side })}
              />
            </FieldRow>
            <FieldRow label="Currency">
              <Seg
                value={ticket.ccy}
                options={CCY}
                onChange={(ccy) => patch({ ccy })}
              />
            </FieldRow>
          </div>

          <FieldRow label="Tenor" hint={`Value ${econ.valueDate}`}>
            <Seg
              value={ticket.tenor}
              options={TENORS}
              onChange={(tenor) => patch({ tenor })}
            />
          </FieldRow>

          <FieldRow
            label="Notional"
            hint={notionalValid ? "" : "1mm – 5,000mm"}
          >
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={ticket.notional}
                  onChange={(e) =>
                    patch({ notional: Number(e.target.value) })
                  }
                  className={`h-9 w-full rounded-md border bg-white pl-3 pr-12 font-mono text-sm tabular-nums outline-none focus:ring-2 ${
                    notionalValid
                      ? "border-neutral-200 focus:border-indigo-400 focus:ring-indigo-100"
                      : "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  }`}
                />
                <span className="absolute right-3 top-2 text-xs font-medium text-neutral-400">
                  {ticket.ccy}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {NOTIONAL_CHIPS.map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => patch({ notional: mm * 1e6 })}
                    className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            </div>
          </FieldRow>

          <FieldRow
            label="Dealt rate"
            hint={`Mid ${econ.benchmark} ${BASE_RATE[ticket.ccy].toFixed(2)}%`}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  value={ticket.dealtRate}
                  onChange={(e) => {
                    setRateTouched(true);
                    patch({ dealtRate: Number(e.target.value) });
                  }}
                  className={`h-9 w-full rounded-md border bg-white pl-3 pr-7 font-mono text-sm tabular-nums outline-none focus:ring-2 ${
                    rateValid
                      ? "border-neutral-200 focus:border-indigo-400 focus:ring-indigo-100"
                      : "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  }`}
                />
                <span className="absolute right-3 top-2 text-xs font-medium text-neutral-400">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRateTouched(false);
                  patch({ dealtRate: BASE_RATE[ticket.ccy] });
                }}
                className="h-9 rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Use mid
              </button>
              <span
                className={`${chip} ${
                  spreadTone === "pos"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : spreadTone === "neg"
                      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                      : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"
                }`}
              >
                {econ.spreadBps > 0 ? "+" : ""}
                {econ.spreadBps} bps
              </span>
            </div>
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Counterparty">
              <select
                value={ticket.counterparty}
                onChange={(e) => patch({ counterparty: e.target.value })}
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none focus:border-indigo-400"
              >
                {CPTY_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n} ({RATING_OF[n]})
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Venue">
              <select
                value={ticket.venue}
                onChange={(e) =>
                  patch({ venue: e.target.value as Venue })
                }
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none focus:border-indigo-400"
              >
                {VENUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Trader">
              <select
                value={ticket.trader}
                onChange={(e) => patch({ trader: e.target.value })}
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none focus:border-indigo-400"
              >
                {TRADERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Book">
              <select
                value={ticket.desk}
                onChange={(e) => patch({ desk: e.target.value })}
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none focus:border-indigo-400"
              >
                {DESKS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>

          {/* pre-trade economics */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="mb-1 text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
              Pre-trade economics
            </div>
            <Stat label="Value date" value={econ.valueDate} />
            <Stat label="Maturity date" value={econ.maturityDate} />
            <Stat
              label="Tenor / basis"
              value={`${econ.days}d · ${econ.basis}`}
            />
            <Stat
              label="Interest"
              value={`${ticket.ccy} ${nfInt.format(econ.interest)}`}
            />
            <Stat
              label={longCash ? "Redemption (P+I)" : "Consideration"}
              value={`${ticket.ccy} ${nfInt.format(econ.redemption)}`}
            />
            <Stat
              label="DV01"
              value={nfSignedInt.format(econ.dv01)}
              tone={econ.dv01 >= 0 ? "pos" : "neg"}
            />
          </div>

          {/* credit & limits */}
          <div className="rounded-lg border border-neutral-200 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Credit &amp; limits
              </span>
              <span
                className={`${chip} ring-1 ${CREDIT_STYLE[credit.status]}`}
              >
                {credit.status}
              </span>
            </div>
            <Stat
              label={`Line (${credit.rating})`}
              value={`${ticket.ccy} ${(credit.lineSize / 1e9).toFixed(1)}bn`}
            />
            <Stat
              label="Post-trade utilisation"
              value={`${Math.min(999, credit.postUtil).toFixed(0)}%`}
              tone={
                credit.status === "FAIL"
                  ? "neg"
                  : credit.status === "PASS"
                    ? "pos"
                    : undefined
              }
            />
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full ${
                  credit.status === "FAIL"
                    ? "bg-rose-500"
                    : credit.status === "WARN"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, credit.postUtil)}%` }}
              />
            </div>
            {credit.status === "FAIL" && (
              <p className="mt-2 text-[11px] text-rose-600">
                Exceeds the counterparty credit line — can be parked pending
                credit but not sent to market.
              </p>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="border-t border-neutral-200 px-5 py-4">
          {!notionalValid && (
            <p className="mb-2 text-[11px] text-rose-600">
              Notional must be between 1mm and 5,000mm.
            </p>
          )}
          {notionalValid && !rateValid && (
            <p className="mb-2 text-[11px] text-rose-600">
              Dealt rate looks out of range.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="h-9 rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                disabled={!canPark}
                onClick={() => submit("NEW")}
                className="h-9 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Park (NEW)
              </button>
              <button
                type="button"
                disabled={!canSend}
                onClick={() => submit("WORKING")}
                className="h-9 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send to market
              </button>
            </div>
          </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI + totals computation                                           */
/* ------------------------------------------------------------------ */

function computeKpis(rows: OrderRow[]) {
  let liveCount = 0;
  let workingNotional = 0;
  let filledNotional = 0;
  let netDv01 = 0;
  let netPnl = 0;
  let totalNotional = 0;
  let totalInterest = 0;
  for (const r of rows) {
    const isLive =
      r.status === "WORKING" ||
      r.status === "PART-FILL" ||
      r.status === "NEW" ||
      r.status === "PENDING-CREDIT";
    if (isLive) {
      liveCount++;
      workingNotional += r.notional - r.filled;
    }
    filledNotional += r.filled;
    const dir = r.side === "LEND" || r.side === "BUY" ? 1 : -1;
    netDv01 += dir * r.dv01;
    netPnl += r.pnl;
    totalNotional += r.notional;
    totalInterest += Math.round(
      (r.notional * (r.dealtRate / 100) * r.days) / basisDenom(r.ccy),
    );
  }
  return {
    liveCount,
    workingNotional,
    filledNotional,
    netDv01,
    netPnl,
    totalNotional,
    totalInterest,
  };
}

function buildTotalRow(k: ReturnType<typeof computeKpis>): OrderRow {
  return {
    orderId: "BLOTTER TOTAL",
    ticket: "",
    time: "",
    trader: "",
    desk: "",
    side: "BUY",
    product: "DEPO",
    ccy: "",
    notional: k.totalNotional,
    filled: k.filledNotional,
    tenor: "1M",
    dealtRate: 0,
    rateDir: 0,
    benchmark: "",
    spreadBps: 0,
    basis: "",
    tradeDate: "",
    valueDate: "",
    maturityDate: "",
    days: 0,
    counterparty: "",
    cptyRating: "",
    venue: "VOICE",
    status: "FILLED",
    creditOk: true,
    limitUtil: 0,
    dv01: k.netDv01,
    pnl: k.netPnl,
    ssi: "MATCHED",
    fills: [],
  };
}
