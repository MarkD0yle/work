/* Fixed Income Terminal — reference data and bond maths.
 *
 * One bond universe shared by all five screens, so a bond picked on the heat
 * map is the same bond on the RFQ, the ticket and the BWIC. Pricing is real
 * street-convention maths (semi-annual, 30/360 accrual, Newton YTM) so the
 * linked price ↔ yield ↔ spread fields on the ticket stay consistent. */

export const TODAY = new Date(Date.UTC(2026, 9, 28)); // Wed 28 Oct 2026
export const SETTLE_T1 = new Date(Date.UTC(2026, 9, 29)); // USD T+1

export type Rating = "AA" | "A" | "BBB" | "BB" | "B";

export type Bond = {
  id: string;
  isin: string;
  ticker: string;
  issuer: string;
  coupon: number; // % p.a.
  maturity: Date;
  sector: string;
  rating: Rating;
  /** Composite mid clean price. */
  mid: number;
  /** Benchmark UST tenor the spread quotes off. */
  bench: string;
  /** Liquidity score 1 (illiquid) – 10 (very liquid). */
  liq: number;
  /** Amount outstanding, $MM. */
  outstanding: number;
};

export type Benchmark = { tenor: string; years: number; yld: number; label: string };

export const BENCHMARKS: Benchmark[] = [
  { tenor: "2Y", years: 2, yld: 3.482, label: "T 3.375 10/28" },
  { tenor: "3Y", years: 3, yld: 3.511, label: "T 3.5 10/29" },
  { tenor: "5Y", years: 5, yld: 3.604, label: "T 3.625 10/31" },
  { tenor: "7Y", years: 7, yld: 3.792, label: "T 3.75 10/33" },
  { tenor: "10Y", years: 10, yld: 4.012, label: "T 4 08/36" },
  { tenor: "20Y", years: 20, yld: 4.488, label: "T 4.5 08/46" },
  { tenor: "30Y", years: 30, yld: 4.571, label: "T 4.625 08/56" },
];

export function benchYield(tenor: string) {
  return BENCHMARKS.find((b) => b.tenor === tenor)?.yld ?? 4;
}

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

export const BONDS: Bond[] = [
  { id: "JPM-35", isin: "US46647PDV55", ticker: "JPM", issuer: "JPMorgan Chase", coupon: 5.012, maturity: d(2035, 1, 23), sector: "Banks", rating: "A", mid: 101.284, bench: "10Y", liq: 9, outstanding: 3500 },
  { id: "BAC-31", isin: "US06051GMA49", ticker: "BAC", issuer: "Bank of America", coupon: 4.571, maturity: d(2031, 4, 27), sector: "Banks", rating: "A", mid: 100.412, bench: "5Y", liq: 9, outstanding: 2750 },
  { id: "GS-34", isin: "US38141GZU17", ticker: "GS", issuer: "Goldman Sachs", coupon: 5.851, maturity: d(2034, 4, 25), sector: "Banks", rating: "A", mid: 104.115, bench: "7Y", liq: 8, outstanding: 2500 },
  { id: "AAPL-33", isin: "US037833EQ15", ticker: "AAPL", issuer: "Apple Inc", coupon: 4.3, maturity: d(2033, 5, 10), sector: "Tech", rating: "AA", mid: 100.982, bench: "7Y", liq: 9, outstanding: 1750 },
  { id: "MSFT-46", isin: "US594918BT09", ticker: "MSFT", issuer: "Microsoft", coupon: 3.7, maturity: d(2046, 8, 8), sector: "Tech", rating: "AA", mid: 84.371, bench: "20Y", liq: 7, outstanding: 4500 },
  { id: "ORCL-34", isin: "US68389XCN38", ticker: "ORCL", issuer: "Oracle Corp", coupon: 5.5, maturity: d(2034, 9, 27), sector: "Tech", rating: "BBB", mid: 101.664, bench: "10Y", liq: 8, outstanding: 2000 },
  { id: "T-36", isin: "US00206RNA53", ticker: "T", issuer: "AT&T Inc", coupon: 5.4, maturity: d(2036, 2, 15), sector: "Telecom", rating: "BBB", mid: 101.207, bench: "10Y", liq: 8, outstanding: 3000 },
  { id: "VZ-32", isin: "US92343VGN82", ticker: "VZ", issuer: "Verizon", coupon: 4.5, maturity: d(2032, 8, 10), sector: "Telecom", rating: "BBB", mid: 99.418, bench: "5Y", liq: 8, outstanding: 2250 },
  { id: "DUK-34", isin: "US26441CBX35", ticker: "DUK", issuer: "Duke Energy", coupon: 5.0, maturity: d(2034, 8, 15), sector: "Utilities", rating: "BBB", mid: 99.876, bench: "10Y", liq: 6, outstanding: 1000 },
  { id: "NEE-29", isin: "US65339KCQ17", ticker: "NEE", issuer: "NextEra Energy Cap", coupon: 4.9, maturity: d(2029, 2, 28), sector: "Utilities", rating: "BBB", mid: 101.032, bench: "3Y", liq: 6, outstanding: 1250 },
  { id: "XOM-40", isin: "US30231GBF81", ticker: "XOM", issuer: "Exxon Mobil", coupon: 4.227, maturity: d(2040, 3, 19), sector: "Energy", rating: "AA", mid: 92.144, bench: "20Y", liq: 7, outstanding: 2000 },
  { id: "OXY-33", isin: "US674599EJ01", ticker: "OXY", issuer: "Occidental Pete", coupon: 5.375, maturity: d(2033, 1, 1), sector: "Energy", rating: "BBB", mid: 100.533, bench: "7Y", liq: 6, outstanding: 1200 },
  { id: "F-30", isin: "US345370DB39", ticker: "F", issuer: "Ford Motor", coupon: 6.1, maturity: d(2030, 8, 19), sector: "Autos", rating: "BB", mid: 102.25, bench: "3Y", liq: 7, outstanding: 1750 },
  { id: "GM-33", isin: "US37045XEN22", ticker: "GM", issuer: "General Motors Fin", coupon: 5.6, maturity: d(2033, 6, 18), sector: "Autos", rating: "BBB", mid: 101.12, bench: "7Y", liq: 7, outstanding: 1500 },
  { id: "UNH-35", isin: "US91324PEP34", ticker: "UNH", issuer: "UnitedHealth", coupon: 5.15, maturity: d(2035, 7, 15), sector: "Healthcare", rating: "A", mid: 101.402, bench: "10Y", liq: 8, outstanding: 2000 },
  { id: "PFE-43", isin: "US716973AF98", ticker: "PFE", issuer: "Pfizer Inv Ent", coupon: 5.11, maturity: d(2043, 5, 19), sector: "Healthcare", rating: "A", mid: 96.77, bench: "20Y", liq: 7, outstanding: 3000 },
  { id: "KO-31", isin: "US191216DQ09", ticker: "KO", issuer: "Coca-Cola", coupon: 4.2, maturity: d(2031, 5, 5), sector: "Consumer", rating: "A", mid: 100.62, bench: "5Y", liq: 6, outstanding: 1000 },
  { id: "CCL-29", isin: "US143658BS04", ticker: "CCL", issuer: "Carnival Corp", coupon: 6.0, maturity: d(2029, 5, 1), sector: "Consumer", rating: "B", mid: 100.875, bench: "3Y", liq: 5, outstanding: 2000 },
  { id: "BA-35", isin: "US097023DH56", ticker: "BA", issuer: "Boeing Co", coupon: 6.528, maturity: d(2034, 5, 1), sector: "Industrials", rating: "BBB", mid: 106.21, bench: "7Y", liq: 8, outstanding: 3500 },
  { id: "CAT-32", isin: "US14913UAL40", ticker: "CAT", issuer: "Caterpillar Fin", coupon: 4.35, maturity: d(2032, 5, 15), sector: "Industrials", rating: "A", mid: 100.18, bench: "5Y", liq: 6, outstanding: 800 },
  { id: "CHTR-34", isin: "US161175CL61", ticker: "CHTR", issuer: "Charter Comms Op", coupon: 6.65, maturity: d(2034, 2, 1), sector: "Media", rating: "BBB", mid: 104.08, bench: "7Y", liq: 7, outstanding: 1500 },
  { id: "PARA-30", isin: "US92556HAB33", ticker: "PARA", issuer: "Paramount Global", coupon: 4.95, maturity: d(2031, 1, 15), sector: "Media", rating: "BB", mid: 96.25, bench: "5Y", liq: 5, outstanding: 1200 },
  { id: "MET-33", isin: "US59156RCF39", ticker: "MET", issuer: "MetLife Inc", coupon: 5.375, maturity: d(2033, 7, 15), sector: "Insurance", rating: "A", mid: 102.76, bench: "7Y", liq: 6, outstanding: 1000 },
  { id: "PLD-34", isin: "US74340XCK59", ticker: "PLD", issuer: "Prologis LP", coupon: 5.0, maturity: d(2034, 3, 15), sector: "REITs", rating: "A", mid: 100.44, bench: "7Y", liq: 5, outstanding: 750 },
];

export function bondById(id: string) {
  return BONDS.find((b) => b.id === id) ?? BONDS[0];
}

/** "JPM 5.012 01/35" — the terminal short name. */
export function shortName(b: Bond) {
  const mm = String(b.maturity.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(b.maturity.getUTCFullYear()).slice(2);
  return `${b.ticker} ${b.coupon.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} ${mm}/${yy}`;
}

export function yearsToMaturity(b: Bond, from = SETTLE_T1) {
  return (b.maturity.getTime() - from.getTime()) / (365.25 * 86400000);
}

/* ---------- Bond maths (semi-annual, 30/360) ---------- */

function addMonths(dt: Date, n: number) {
  const r = new Date(dt.getTime());
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function days30360(a: Date, b: Date) {
  const d1 = Math.min(a.getUTCDate(), 30);
  const d2 = b.getUTCDate() === 31 && d1 === 30 ? 30 : b.getUTCDate();
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 360 +
    (b.getUTCMonth() - a.getUTCMonth()) * 30 +
    (d2 - d1)
  );
}

/** Coupon dates strictly after settlement, plus the previous coupon date. */
function schedule(b: Bond, settle: Date) {
  const future: Date[] = [];
  let k = 0;
  let cd = b.maturity;
  while (cd > settle) {
    future.unshift(cd);
    k += 1;
    cd = addMonths(b.maturity, -6 * k);
  }
  return { prev: cd, future };
}

export function accrued(b: Bond, settle = SETTLE_T1) {
  const { prev } = schedule(b, settle);
  const days = days30360(prev, settle);
  return { days, amount: (b.coupon / 2) * (days / 180) };
}

/** Clean price per 100 from yield (% p.a., semi-annual compounding). */
export function priceFromYield(b: Bond, yld: number, settle = SETTLE_T1) {
  const { prev, future } = schedule(b, settle);
  const w = days30360(settle, future[0]) / days30360(prev, future[0]);
  const r = yld / 200;
  let dirty = 0;
  future.forEach((_, i) => {
    const cf = b.coupon / 2 + (i === future.length - 1 ? 100 : 0);
    dirty += cf / Math.pow(1 + r, w + i);
  });
  return dirty - accrued(b, settle).amount;
}

/** Yield to maturity (%) from clean price via Newton–Raphson. */
export function yieldFromPrice(b: Bond, price: number, settle = SETTLE_T1) {
  let y = b.coupon || 4;
  for (let i = 0; i < 40; i++) {
    const p = priceFromYield(b, y, settle);
    const dp = (priceFromYield(b, y + 0.0001, settle) - p) / 0.0001;
    const step = (p - price) / dp;
    y -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  return y;
}

/** Price value of a basis point, per 100 face. */
export function pv01(b: Bond, yld: number, settle = SETTLE_T1) {
  return priceFromYield(b, yld - 0.005, settle) - priceFromYield(b, yld + 0.005, settle);
}

/** G-spread in bp against the bond's benchmark tenor. */
export function spreadFromYield(b: Bond, yld: number) {
  return (yld - benchYield(b.bench)) * 100;
}

export function yieldFromSpread(b: Bond, bp: number) {
  return benchYield(b.bench) + bp / 100;
}

/** Mid analytics for a bond at its composite mid. */
export function midAnalytics(b: Bond) {
  const yld = yieldFromPrice(b, b.mid);
  return {
    yld,
    spread: spreadFromYield(b, yld),
    pv01: pv01(b, yld),
  };
}

/* ---------- Seeded randomness ---------- */

export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/* ---------- Dealers ---------- */

export type Dealer = { code: string; name: string; hitRate: number; tier: 1 | 2 };

export const DEALERS: Dealer[] = [
  { code: "MSX", name: "Morrow Securities", hitRate: 31, tier: 1 },
  { code: "HLB", name: "Halbrook & Co", hitRate: 27, tier: 1 },
  { code: "CRN", name: "Corran Capital Mkts", hitRate: 24, tier: 1 },
  { code: "VTX", name: "Vantage Rates", hitRate: 22, tier: 1 },
  { code: "BRK", name: "Birchwick Partners", hitRate: 18, tier: 2 },
  { code: "SNT", name: "Sentrel Bank", hitRate: 16, tier: 2 },
  { code: "OKL", name: "Oakline Markets", hitRate: 12, tier: 2 },
  { code: "PRS", name: "Paresh Fixed Income", hitRate: 9, tier: 2 },
];
