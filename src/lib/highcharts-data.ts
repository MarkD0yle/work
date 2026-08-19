/* Mock data for the Highcharts gallery.
 *
 * Everything on that page hangs off one book selector, so the datasets are
 * generated rather than hand-written: pick a book, get a coherent set of ten
 * views of the same desk. Generation is seeded (mulberry32) and anchored to a
 * fixed end date, so the numbers are stable across reloads and builds — a
 * prototype that reshuffles itself on every refresh is impossible to review.
 */

export type BookId = "rates" | "credit" | "equity";

export type Book = {
  id: BookId;
  label: string;
  desk: string;
  seed: number;
  base: string;
};

export const BOOKS: Book[] = [
  { id: "rates", label: "EMEA Rates", desk: "Macro Trading", seed: 20260317, base: "EUR" },
  { id: "credit", label: "Global Credit", desk: "Flow Credit", seed: 771021, base: "USD" },
  { id: "equity", label: "Equity L/S", desk: "Delta One", seed: 480915, base: "USD" },
];

/* mulberry32 — small, fast, good enough for mock data and fully reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform draw in [lo, hi], rounded to `dp` decimals. */
function between(r: () => number, lo: number, hi: number, dp = 2) {
  const v = lo + r() * (hi - lo);
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/** Box–Muller normal draw, used where a uniform would look obviously fake. */
function gauss(r: () => number, mean = 0, sd = 1) {
  const u = Math.max(r(), 1e-9);
  const v = Math.max(r(), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const MONTHS = [
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
];

export const ASSET_CLASSES = [
  "Sovereign",
  "Investment Grade",
  "High Yield",
  "Equity",
  "FX & Cash",
];

export const CORR_ASSETS = [
  "UST 10y", "Bund 10y", "IG Credit", "HY Credit",
  "S&P 500", "EuroStoxx", "EURUSD", "Brent", "Gold",
];

export const CORR_WINDOWS = ["1M", "3M", "1Y"] as const;
export type CorrWindow = (typeof CORR_WINDOWS)[number];

export const FACTORS = [
  "Duration", "Credit", "Equity beta", "FX", "Carry", "Liquidity", "Volatility",
];

const SECTOR_NAMES = [
  "Sovereigns", "Financials", "Technology", "Energy",
  "Industrials", "Consumer", "Utilities", "Healthcare",
];

const ISSUER_POOL: Record<string, string[]> = {
  Sovereigns: ["DBR 2.6 34", "OAT 3.0 34", "BTPS 3.8 34", "UKT 4.25 34", "UST 4.0 34"],
  Financials: ["JPM 5.3 31", "HSBC 5.9 30", "BNP 4.7 32", "GS 5.1 33", "SAN 4.4 29"],
  Technology: ["MSFT 4.2 33", "AAPL 3.9 32", "ORCL 5.6 34", "NVDA 4.8 31", "SAP 3.4 30"],
  Energy: ["SHEL 4.1 32", "TTE 3.8 31", "BP 4.6 30", "XOM 4.3 33", "ENI 4.0 29"],
  Industrials: ["SIE 3.5 31", "HON 4.4 32", "CAT 4.9 30", "AIR 3.2 33", "GE 5.0 29"],
  Consumer: ["NESN 3.1 32", "PG 4.0 31", "LVMH 3.6 30", "KO 4.2 33", "AD 3.9 29"],
  Utilities: ["ENEL 3.9 32", "IBE 3.7 31", "EDF 4.5 30", "NEE 4.8 33", "SSE 4.1 29"],
  Healthcare: ["NOVN 3.3 32", "PFE 4.6 31", "AZN 4.0 30", "SAN 3.8 33", "MRK 4.4 29"],
};

const PIPELINE_STAGES = [
  "Booked", "Matched", "Affirmed", "Settled", "Failed", "Repaired", "Escalated",
];

export type SectorNode = {
  name: string;
  exposure: number;
  pnl: number;
  holdings: { name: string; exposure: number; pnl: number; rating: string }[];
};

export type RiskReturnPoint = {
  name: string;
  sector: string;
  vol: number;
  ret: number;
  aum: number;
  sharpe: number;
};

export type LimitRow = {
  name: string;
  used: number;
  limit: number;
  unit: string;
  headroomNote: string;
};

export type WaterfallStep = {
  name: string;
  value: number;
  kind: "step" | "subtotal" | "total";
  note: string;
};

export type Dataset = {
  book: Book;
  headline: {
    aum: number;
    dayPnl: number;
    mtdPnl: number;
    var95: number;
    utilisation: number;
    breaches: number;
    settledPct: number;
  };
  sectors: SectorNode[];
  aum: { months: string[]; series: { name: string; data: number[] }[] };
  riskReturn: RiskReturnPoint[];
  correlation: Record<CorrWindow, number[][]>;
  flows: { from: string; to: string; weight: number }[];
  limits: LimitRow[];
  factors: { portfolio: number[]; benchmark: number[] };
  waterfall: WaterfallStep[];
  ohlc: [number, number, number, number, number][];
  volume: [number, number][];
};

const RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B"];

/* Candlestick history is anchored rather than relative to "now" so the axis
 * doesn't drift between sessions. */
const SERIES_END = Date.UTC(2026, 5, 30);
const DAY = 24 * 3600 * 1000;

function buildOhlc(r: () => number, start: number, bars: number) {
  const ohlc: [number, number, number, number, number][] = [];
  const volume: [number, number][] = [];
  let price = start;
  // Walk backwards from the anchor so the last bar is always SERIES_END.
  let t = SERIES_END - bars * DAY;
  for (let i = 0; i < bars; i += 1) {
    t += DAY;
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) continue; // business days only
    const drift = 0.0004;
    const shock = gauss(r, 0, 0.011);
    const open = price;
    const close = Math.max(1, open * (1 + drift + shock));
    const wick = Math.abs(gauss(r, 0, 0.006)) * open;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick;
    const round = (v: number) => Math.round(v * 100) / 100;
    ohlc.push([t, round(open), round(high), round(low), round(close)]);
    // Volume leans heavier on down days, the way it usually does.
    const lean = close < open ? 1.45 : 1;
    volume.push([t, Math.round((0.8 + r() * 0.9) * lean * 1_200_000)]);
    price = close;
  }
  return { ohlc, volume };
}

/* Each asset gets a loading on two latent factors — duration and risk
 * appetite — in the same order as CORR_ASSETS. Correlations are then the
 * cosine between loadings, which is what makes the negatives fall where a
 * reader expects them (govvies against equities, gold against risk) instead of
 * appearing at random. A diverging colour scale is only worth having if the
 * data actually crosses zero. */
const FACTOR_LOADINGS: [number, number][] = [
  [1.0, -0.15], // UST 10y
  [0.95, -0.1], // Bund 10y
  [0.55, 0.5], // IG Credit
  [0.15, 0.85], // HY Credit
  [-0.1, 1.0], // S&P 500
  [-0.12, 0.95], // EuroStoxx
  [0.1, 0.45], // EURUSD
  [-0.3, 0.6], // Brent
  [0.6, -0.25], // Gold
];

function buildCorrelation(r: () => number, n: number, tightness: number) {
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const norm = (v: [number, number]) => Math.hypot(v[0], v[1]);
  for (let i = 0; i < n; i += 1) {
    m[i][i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      const a = FACTOR_LOADINGS[i];
      const b = FACTOR_LOADINGS[j];
      const cosine = (a[0] * b[0] + a[1] * b[1]) / (norm(a) * norm(b));
      // Shorter lookbacks run hotter: crowding pushes everything toward ±1.
      const v = Math.max(
        -0.95,
        Math.min(0.98, cosine * tightness + gauss(r, 0, 0.12)),
      );
      m[i][j] = Math.round(v * 100) / 100;
      m[j][i] = m[i][j];
    }
  }
  return m;
}

export function buildDataset(bookId: BookId): Dataset {
  const book = BOOKS.find((b) => b.id === bookId) ?? BOOKS[0];
  const r = rng(book.seed);

  /* --- sector exposure + issuer drilldown ------------------------------- */
  const sectors: SectorNode[] = SECTOR_NAMES.map((name) => {
    const holdings = ISSUER_POOL[name].map((issuer) => ({
      name: issuer,
      exposure: between(r, 40, 420, 1),
      pnl: between(r, -3.4, 4.6, 2),
      rating: RATINGS[Math.floor(r() * RATINGS.length)],
    }));
    return {
      name,
      exposure: Math.round(holdings.reduce((s, h) => s + h.exposure, 0) * 10) / 10,
      pnl: Math.round(holdings.reduce((s, h) => s + h.pnl, 0) * 100) / 100,
      holdings,
    };
  });

  /* --- AUM by asset class, monthly -------------------------------------- */
  const aumSeries = ASSET_CLASSES.map((name, idx) => {
    let level = 300 + idx * 90 + r() * 160;
    const data = MONTHS.map(() => {
      level = Math.max(60, level * (1 + gauss(r, 0.008, 0.045)));
      return Math.round(level);
    });
    return { name, data };
  });

  /* --- risk / return bubbles -------------------------------------------- */
  const riskReturn: RiskReturnPoint[] = sectors.map((s) => {
    const vol = between(r, 3.2, 18.5, 1);
    const ret = between(r, -4, 16, 1);
    return {
      name: s.name,
      sector: s.name,
      vol,
      ret,
      aum: Math.round(s.exposure),
      sharpe: Math.round((ret / Math.max(vol, 0.1)) * 100) / 100,
    };
  });

  /* --- correlation, three lookbacks ------------------------------------- */
  const correlation = {
    "1M": buildCorrelation(r, CORR_ASSETS.length, 0.92),
    "3M": buildCorrelation(r, CORR_ASSETS.length, 0.78),
    "1Y": buildCorrelation(r, CORR_ASSETS.length, 0.64),
  } as Record<CorrWindow, number[][]>;

  /* --- settlement pipeline flows (sankey) ------------------------------- */
  const booked = Math.round(between(r, 1600, 2400, 0));
  const matched = Math.round(booked * between(r, 0.86, 0.94, 3));
  const unmatched = booked - matched;
  const affirmed = Math.round(matched * between(r, 0.9, 0.97, 3));
  const settled = Math.round(affirmed * between(r, 0.9, 0.96, 3));
  const failed = affirmed - settled;
  const repaired = Math.round(failed * between(r, 0.55, 0.8, 3));
  const escalated = failed - repaired;
  const flows = [
    { from: PIPELINE_STAGES[0], to: PIPELINE_STAGES[1], weight: matched },
    { from: PIPELINE_STAGES[0], to: "Unmatched", weight: unmatched },
    { from: "Unmatched", to: PIPELINE_STAGES[1], weight: Math.round(unmatched * 0.7) },
    { from: "Unmatched", to: PIPELINE_STAGES[6], weight: unmatched - Math.round(unmatched * 0.7) },
    { from: PIPELINE_STAGES[1], to: PIPELINE_STAGES[2], weight: affirmed },
    { from: PIPELINE_STAGES[2], to: PIPELINE_STAGES[3], weight: settled },
    { from: PIPELINE_STAGES[2], to: PIPELINE_STAGES[4], weight: failed },
    { from: PIPELINE_STAGES[4], to: PIPELINE_STAGES[5], weight: repaired },
    { from: PIPELINE_STAGES[5], to: PIPELINE_STAGES[3], weight: repaired },
    { from: PIPELINE_STAGES[4], to: PIPELINE_STAGES[6], weight: escalated },
  ];

  /* --- limit utilisation ------------------------------------------------ */
  const limits: LimitRow[] = [
    {
      name: "VaR (1d, 95%)",
      used: between(r, 5.4, 9.6, 2),
      limit: 10,
      unit: "m",
      headroomNote: "Market risk, refreshed 06:15 London",
    },
    {
      name: "Gross notional",
      used: between(r, 620, 940, 0),
      limit: 1000,
      unit: "m",
      headroomNote: "Includes pending allocations",
    },
    {
      name: "Single-name concentration",
      used: between(r, 3.1, 8.8, 2),
      limit: 9,
      unit: "%",
      headroomNote: "Largest issuer as % of book",
    },
    {
      name: "Overnight FX",
      used: between(r, 12, 44, 1),
      limit: 60,
      unit: "m",
      headroomNote: "Net of the hedge programme",
    },
  ];

  /* --- factor exposure vs benchmark ------------------------------------- */
  const portfolio = FACTORS.map(() => between(r, 0.15, 1, 2));
  const benchmark = portfolio.map((v) =>
    Math.max(0.05, Math.min(1, Math.round((v + gauss(r, -0.08, 0.18)) * 100) / 100)),
  );

  /* --- P&L waterfall ---------------------------------------------------- */
  const carry = between(r, 1.6, 4.2, 2);
  const curve = between(r, -2.6, 3.1, 2);
  const spread = between(r, -1.9, 2.8, 2);
  const fx = between(r, -1.2, 1.4, 2);
  const financing = between(r, -1.4, -0.2, 2);
  const fees = between(r, -0.9, -0.15, 2);
  const waterfall: WaterfallStep[] = [
    { name: "Carry", value: carry, kind: "step", note: "Accrual and roll-down" },
    { name: "Curve", value: curve, kind: "step", note: "Parallel + slope moves" },
    { name: "Spread", value: spread, kind: "step", note: "Issuer spread change" },
    { name: "Gross", value: 0, kind: "subtotal", note: "Before funding" },
    { name: "FX", value: fx, kind: "step", note: `Translation to ${book.base}` },
    { name: "Financing", value: financing, kind: "step", note: "Repo and collateral" },
    { name: "Fees", value: fees, kind: "step", note: "Brokerage and clearing" },
    { name: "Net", value: 0, kind: "total", note: "Attributed daily P&L" },
  ];

  /* --- price history ---------------------------------------------------- */
  const { ohlc, volume } = buildOhlc(r, book.id === "equity" ? 184 : 98, 300);

  const gross = sectors.reduce((s, x) => s + x.exposure, 0);
  const dayPnl = waterfall
    .filter((s) => s.kind === "step")
    .reduce((s, x) => s + x.value, 0);
  const varLimit = limits[0];

  return {
    book,
    headline: {
      aum: Math.round(gross),
      dayPnl: Math.round(dayPnl * 100) / 100,
      mtdPnl: Math.round(dayPnl * between(r, 4, 11, 2) * 100) / 100,
      var95: varLimit.used,
      utilisation: Math.round((varLimit.used / varLimit.limit) * 1000) / 10,
      breaches: limits.filter((l) => l.used / l.limit > 0.9).length,
      settledPct: Math.round((settled / booked) * 1000) / 10,
    },
    sectors,
    aum: { months: MONTHS, series: aumSeries },
    riskReturn,
    correlation,
    flows,
    limits,
    factors: { portfolio, benchmark },
    waterfall,
    ohlc,
    volume,
  };
}
