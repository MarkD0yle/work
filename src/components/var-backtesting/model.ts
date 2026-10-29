/* VaR Backtesting: model and statistics.
 *
 * Seeded daily data for six trading desks over 520 business days to Mon
 * 21 Sep 2026: a 1-day 99% VaR per desk (slowly varying, with a regime
 * shift once the March 2026 rates shock enters the historical-simulation
 * window), hypothetical P&L drawn from a multivariate Student-t scaled by
 * that VaR, and actual P&L (hypothetical plus fees and intraday trading).
 * Firm-wide P&L is the sum of the desks; firm-wide VaR is the diversified
 * figure sqrt(v' R v), so it is always less than the sum of the desks.
 *
 * The backtest statistics (Basel zones, the plus-factor, Kupiec POF and
 * Christoffersen independence) are computed here from first principles so
 * every number on the page comes from the same slice. */

export type DeskId = "rates" | "credit" | "fx" | "equities" | "commodities" | "em";
export type Scope = "firm" | DeskId;
export type Basis = "hypo" | "actual";
export type Confidence = "99" | "97.5";
export type WindowLen = "250" | "500";
export type Zone = "green" | "amber" | "red";
export type Cause = "Market move" | "Model limitation" | "Data issue" | "Intraday position change";
export type SignOff = "Pending MRM" | "Approved" | "Challenged";

export const CAUSES: Cause[] = [
  "Market move",
  "Model limitation",
  "Data issue",
  "Intraday position change",
];

export interface Desk {
  id: DeskId;
  label: string;
  /** 1-day 99% VaR anchor, £m. */
  baseVar: number;
  /** Stressed VaR as a multiple of VaR (2008-09 calibration window). */
  svarMult: number;
  /** VaR uplift once the March 2026 shock sits in the lookback window. */
  regimeLift: number;
  /** True volatility relative to model during the shock, before VaR caught up. */
  shockVol: number;
}

export const DESKS: Desk[] = [
  { id: "rates", label: "Rates", baseVar: 11.8, svarMult: 2.6, regimeLift: 1.3, shockVol: 1.55 },
  { id: "credit", label: "Credit", baseVar: 7.9, svarMult: 2.9, regimeLift: 1.14, shockVol: 1.25 },
  { id: "fx", label: "FX", baseVar: 5.4, svarMult: 2.2, regimeLift: 1.05, shockVol: 1.1 },
  { id: "equities", label: "Equities", baseVar: 9.3, svarMult: 2.5, regimeLift: 1.06, shockVol: 1.1 },
  { id: "commodities", label: "Commodities", baseVar: 4.2, svarMult: 2.8, regimeLift: 1.08, shockVol: 1.05 },
  { id: "em", label: "EM macro", baseVar: 6.1, svarMult: 3.1, regimeLift: 1.2, shockVol: 1.4 },
];

export const DESK_BY_ID = Object.fromEntries(DESKS.map((d) => [d.id, d])) as Record<DeskId, Desk>;

export const SCOPE_LABEL: Record<Scope, string> = {
  firm: "Firm-wide",
  rates: "Rates",
  credit: "Credit",
  fx: "FX",
  equities: "Equities",
  commodities: "Commodities",
  em: "EM macro",
};

/* Desk P&L correlation (order as DESKS). Used for the P&L draws and for the
 * diversified firm-wide VaR, so the two agree. */
const CORR = [
  [1.0, 0.45, 0.25, 0.15, 0.1, 0.35],
  [0.45, 1.0, 0.2, 0.5, 0.15, 0.4],
  [0.25, 0.2, 1.0, 0.2, 0.15, 0.5],
  [0.15, 0.5, 0.2, 1.0, 0.25, 0.3],
  [0.1, 0.15, 0.15, 0.25, 1.0, 0.2],
  [0.35, 0.4, 0.5, 0.3, 0.2, 1.0],
];
/* Stressed correlations run higher: everything moves together in 2008. */
const CORR_STRESS = CORR.map((row, i) =>
  row.map((c, j) => (i === j ? 1 : Math.min(0.9, c + 0.2))),
);

/** 97.5% VaR from 99% under normality: z(0.975) / z(0.99). */
export const SCALE_975 = 1.959964 / 2.326348;

export const AS_OF = Date.UTC(2026, 8, 21); // Mon 21 Sep 2026 close
const DAY_MS = 86_400_000;
const N_DAYS = 520;

/* UK bank holidays in range: no P&L is struck, so they are not business days. */
const HOLIDAYS = new Set([
  "2024-08-26", "2024-12-25", "2024-12-26", "2025-01-01", "2025-04-18",
  "2025-04-21", "2025-05-05", "2025-05-26", "2025-08-25", "2025-12-25",
  "2025-12-26", "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
  "2026-05-25", "2026-08-31",
]);

export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const isHoliday = (t: number) => HOLIDAYS.has(isoDay(t));

function businessDays(): number[] {
  const out: number[] = [];
  for (let t = AS_OF; out.length < N_DAYS; t -= DAY_MS) {
    const wd = new Date(t).getUTCDay();
    if (wd === 0 || wd === 6 || HOLIDAYS.has(isoDay(t))) continue;
    out.push(t);
  }
  return out.reverse();
}

export const DAYS = businessDays();

/* ------------------------------------------------------------------ *
 * Seeded generation
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cholesky(m: number[][]): number[][] {
  const n = m.length;
  const L = m.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
    }
  }
  return L;
}

function diversified(v: number[], corr: number[][]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++)
    for (let j = 0; j < v.length; j++) s += corr[i][j] * v[i] * v[j];
  return Math.sqrt(s);
}

/** FNV-1a: a stable per-key uniform in [0, 1) for labels that must not move. */
export function hash01(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export interface DayRow {
  t: number;
  iso: string;
  /** 1-day 99% VaR, £m (positive). */
  var99: number;
  /** Stressed VaR 99%, £m. */
  svar99: number;
  hypo: number;
  actual: number;
}

/* Planned events: the story the random draws are built around. Ratios are
 * P&L ÷ 99% VaR. The March 2026 rates shock clusters its exceptions, which
 * is what the Christoffersen test and the calendar are there to catch. */
interface Planned {
  desk: DeskId;
  iso: string;
  /** Omit to keep the random draw and only attach the narrative. */
  hypo?: number;
  /** actual − hypothetical, as a multiple of VaR. */
  gap?: number;
  cause?: Cause;
  note?: string;
  signoff?: SignOff;
}

const PLANNED: Planned[] = [
  { desk: "rates", iso: "2026-03-11", hypo: -1.46, gap: 0.04, cause: "Market move", note: "2y gilt +31bp after the UK CPI beat; front-end receivers and SONIA futures longs hit." },
  { desk: "em", iso: "2026-03-11", hypo: -1.14, gap: -0.02, cause: "Market move", note: "EM local rates sold off in sympathy; MXN and ZAR receivers repriced." },
  { desk: "credit", iso: "2026-03-11", hypo: -0.88, gap: 0.03 },
  { desk: "rates", iso: "2026-03-12", hypo: -1.18, gap: 0.05, cause: "Market move", note: "Follow-through sell-off; SONIA strip priced two further hikes by year end." },
  { desk: "credit", iso: "2026-03-12", hypo: -0.95, gap: 0.02 },
  { desk: "em", iso: "2026-03-12", hypo: -0.91, gap: -0.01 },
  { desk: "fx", iso: "2026-03-12", hypo: -0.62, gap: 0.03 },
  { desk: "equities", iso: "2026-03-12", hypo: -0.35, gap: 0.03 },
  { desk: "rates", iso: "2025-10-16", hypo: -0.45, gap: 0.02 },
  { desk: "commodities", iso: "2025-10-16", hypo: -0.5, gap: 0.01 },
  { desk: "rates", iso: "2026-03-17", hypo: -1.04, gap: 0.03, cause: "Market move", note: "Third session of the gilt sell-off; 10y +12bp with the swap spread tighter." },
  { desk: "equities", iso: "2025-10-16", hypo: -0.97, gap: 0.03 },
  { desk: "credit", iso: "2025-10-16", hypo: -0.92, gap: 0.02 },
  { desk: "em", iso: "2025-10-16", hypo: -0.84, gap: 0.01 },
  { desk: "rates", iso: "2026-06-10", hypo: -0.84, gap: -0.33, cause: "Intraday position change", note: "Syndicated gilt allocation taken and hedged intraday; actual P&L carries the concession." },
  { desk: "rates", iso: "2026-03-16", hypo: -1.31, gap: 0.02, cause: "Market move", note: "Gilt curve bear-flattened 18bp after hawkish MPC minutes." },
  { desk: "credit", iso: "2026-03-16", hypo: -1.09, gap: 0.01, cause: "Market move", note: "iTraxx Crossover 41bp wider on the rates shock; short-protection hedges lagged." },
  { desk: "em", iso: "2026-03-16", hypo: -1.26, gap: -0.03, cause: "Market move", note: "EM carry basket unwound; BRL and ZAR both down more than 2%." },
  { desk: "fx", iso: "2026-03-16", hypo: -0.84, gap: 0.02 },
  { desk: "equities", iso: "2026-03-16", hypo: -0.78, gap: 0.04 },
  { desk: "rates", iso: "2026-03-18", hypo: -1.07, gap: 0.03, cause: "Model limitation", note: "Curve moves beyond anything in the 2-year lookback until the window caught up.", signoff: "Challenged" },
  { desk: "equities", iso: "2025-11-05", hypo: -0.61, gap: -0.64, cause: "Intraday position change", note: "Block facilitation trade added and hedged intraday; only actual P&L carries the discount." },
  { desk: "fx", iso: "2026-01-14", hypo: -1.16, gap: 0.03, cause: "Data issue", note: "USD/TRY vol surface stale for two days after a vendor outage; VaR understated.", signoff: "Challenged" },
  { desk: "commodities", iso: "2026-06-23", hypo: -1.38, gap: 0.02, cause: "Model limitation", note: "TTF front-month gas spike beyond any day in the 2-year lookback window." },
  { desk: "em", iso: "2026-08-04", hypo: -1.21, gap: -0.05, cause: "Market move", note: "BRL down 3.1% on the fiscal-framework announcement; long local-rates position." },
  { desk: "em", iso: "2026-08-05", hypo: -0.93, gap: -0.2 },
  { desk: "em", iso: "2026-01-09", cause: "Data issue", note: "Holiday-calendar mismatch after New Year: local close used for one leg, London for the other.", signoff: "Challenged" },
  { desk: "rates", iso: "2026-08-05", cause: "Model limitation", note: "Swap-spread risk mapped to a single tenor; the 30y spread gapped and VaR did not see it." },
  { desk: "credit", iso: "2026-09-15", hypo: -1.08, gap: 0.02, cause: "Market move", note: "Primary-market indigestion; IG cash spreads 9bp wider against a CDX hedge.", signoff: "Pending MRM" },
  { desk: "rates", iso: "2026-09-17", hypo: -0.72, gap: -0.46, cause: "Intraday position change", note: "Large client switch executed and hedged intraday; hypothetical P&L excludes it.", signoff: "Pending MRM" },
];

const SHOCK_FROM = "2026-03-09";
const SHOCK_TO = "2026-03-20";
/* The historical-simulation VaR picks the shock up as the days enter the
 * window: ramp from the first shock day over ~20 business days. */
const RAMP_DAYS = 20;

function generate(seed: number) {
  const rng = mulberry32(seed);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const L = cholesky(CORR);
  const NU = 5;
  const ou = DESKS.map(() => 0);
  const phase = DESKS.map(() => rng() * Math.PI * 2);
  const shockIdx = DAYS.findIndex((t) => isoDay(t) >= SHOCK_FROM);
  const planned = new Map(PLANNED.map((p) => [`${p.desk}|${p.iso}`, p]));

  const desk: Record<DeskId, DayRow[]> = {
    rates: [], credit: [], fx: [], equities: [], commodities: [], em: [],
  };

  DAYS.forEach((t, i) => {
    const iso = isoDay(t);
    const inShock = iso >= SHOCK_FROM && iso <= SHOCK_TO;
    const ramp = Math.min(1, Math.max(0, (i - shockIdx - 4) / RAMP_DAYS));
    // multivariate Student-t (nu = 5), unit variance
    const n = DESKS.map(() => gauss());
    let w = 0;
    for (let k = 0; k < NU; k++) w += gauss() ** 2;
    const tScale = Math.sqrt((NU - 2) / w);
    DESKS.forEach((d, di) => {
      let zc = 0;
      for (let k = 0; k <= di; k++) zc += L[di][k] * n[k];
      const z = zc * tScale;
      ou[di] = ou[di] * 0.965 + 0.022 * gauss();
      const drift = 1 + 0.07 * Math.sin((2 * Math.PI * i) / 240 + phase[di]);
      // after the shock rolls in, the lift decays a little through the summer
      const lift = 1 + (d.regimeLift - 1) * ramp * (1 - 0.25 * Math.max(0, (i - shockIdx - 60) / 200));
      const var99 = d.baseVar * Math.exp(ou[di]) * drift * lift;
      const volRatio = inShock ? 0.86 * d.shockVol : 0.86;
      const sigma = (var99 / 2.326348) * volRatio;
      let hypo = sigma * (0.05 + z);
      let actual = hypo + sigma * (0.07 + 0.3 * gauss());
      const p = planned.get(`${d.id}|${iso}`);
      if (p?.hypo !== undefined) {
        hypo = p.hypo * var99;
        actual = (p.hypo + (p.gap ?? 0)) * var99;
      }
      const svar99 = d.baseVar * d.svarMult * Math.pow(var99 / d.baseVar, 0.6);
      desk[d.id].push({ t, iso, var99, svar99, hypo, actual });
    });
  });

  const firm: DayRow[] = DAYS.map((t, i) => {
    const rows = DESKS.map((d) => desk[d.id][i]);
    return {
      t,
      iso: isoDay(t),
      var99: diversified(rows.map((r) => r.var99), CORR),
      svar99: diversified(rows.map((r) => r.svar99), CORR_STRESS),
      hypo: rows.reduce((s, r) => s + r.hypo, 0),
      actual: rows.reduce((s, r) => s + r.actual, 0),
    };
  });

  return { desk, firm };
}

export const SEED = 20260921;
const GEN = generate(SEED);
export const SERIES: Record<Scope, DayRow[]> = { ...GEN.desk, firm: GEN.firm };

/* ------------------------------------------------------------------ *
 * Statistics
 * ------------------------------------------------------------------ */

const LN_FACT: number[] = [0];
for (let k = 1; k <= 1000; k++) LN_FACT[k] = LN_FACT[k - 1] + Math.log(k);

function binomPmf(n: number, k: number, p: number) {
  return Math.exp(LN_FACT[n] - LN_FACT[k] - LN_FACT[n - k] + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Basel cut-offs for any window and tail probability: green while the
 *  cumulative binomial probability is below 95%, red once it reaches 99.99%.
 *  For n = 250, p = 1% this reproduces the familiar 0–4 / 5–9 / 10+. */
export function zoneCutoffs(n: number, p: number) {
  let cum = 0;
  let greenMax = -1;
  let redFrom = n + 1;
  for (let k = 0; k <= n; k++) {
    cum += binomPmf(n, k, p);
    if (cum < 0.95) greenMax = k;
    if (cum >= 0.9999 - 1e-9) {
      redFrom = k;
      break;
    }
  }
  return { greenMax, redFrom };
}

export function zoneFor(count: number, cut: { greenMax: number; redFrom: number }): Zone {
  if (count <= cut.greenMax) return "green";
  if (count >= cut.redFrom) return "red";
  return "amber";
}

/** Basel plus-factor on the 99% / 250-day count. */
export function plusFactor(k: number): number {
  if (k <= 4) return 0;
  if (k >= 10) return 1;
  return [0.4, 0.5, 0.65, 0.75, 0.85][k - 5];
}

/** Complementary error function (Numerical Recipes erfcc, |rel err| < 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Upper tail of chi-square with 1 degree of freedom. */
export function chi2Sf1(lr: number): number {
  if (lr <= 0) return 1;
  return erfc(Math.sqrt(lr / 2));
}

const xlogy = (x: number, y: number) => (x === 0 ? 0 : x * Math.log(y));

export interface TestResult {
  lr: number;
  p: number;
  pass: boolean;
}

/** Kupiec (1995) proportion-of-failures likelihood ratio. */
export function kupiecPof(x: number, T: number, p: number): TestResult {
  const phat = x / T;
  const ll0 = xlogy(T - x, 1 - p) + xlogy(x, p);
  const ll1 = xlogy(T - x, 1 - phat) + xlogy(x, phat);
  const lr = Math.max(0, -2 * (ll0 - ll1));
  const pv = chi2Sf1(lr);
  return { lr, p: pv, pass: pv >= 0.05 };
}

/** Christoffersen (1998) independence test on the hit sequence. */
export function christoffersen(hits: boolean[]): TestResult & { n11: number } {
  let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
  for (let i = 1; i < hits.length; i++) {
    const a = hits[i - 1], b = hits[i];
    if (!a && !b) n00++;
    else if (!a && b) n01++;
    else if (a && !b) n10++;
    else n11++;
  }
  const pi0 = n00 + n01 ? n01 / (n00 + n01) : 0;
  const pi1 = n10 + n11 ? n11 / (n10 + n11) : 0;
  const pi = (n01 + n11) / Math.max(1, n00 + n01 + n10 + n11);
  const llNull = xlogy(n00 + n10, 1 - pi) + xlogy(n01 + n11, pi);
  const llAlt = xlogy(n00, 1 - pi0) + xlogy(n01, pi0) + xlogy(n10, 1 - pi1) + xlogy(n11, pi1);
  const lr = Math.max(0, -2 * (llNull - llAlt));
  const pv = chi2Sf1(lr);
  return { lr, p: pv, pass: pv >= 0.05, n11 };
}

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

export interface ViewDay {
  t: number;
  iso: string;
  var: number;
  svar: number;
  hypo: number;
  actual: number;
  /** P&L on the selected basis. */
  pnl: number;
  ratio: number;
  exc: boolean;
  near: boolean;
}

export interface ScopeView {
  scope: Scope;
  days: ViewDay[];
  exceptions: number;
  nearMisses: number;
  expected: number;
  cut: { greenMax: number; redFrom: number };
  zone: Zone;
  kupiec: TestResult;
  christ: TestResult & { n11: number };
  /** The 99% / 250-day count on the same basis: what the multiplier uses. */
  regCount: number;
  multiplier: number;
}

export const tailP = (c: Confidence) => (c === "99" ? 0.01 : 0.025);
const scaleFor = (c: Confidence) => (c === "99" ? 1 : SCALE_975);

function viewDays(scope: Scope, basis: Basis, conf: Confidence, n: number): ViewDay[] {
  const k = scaleFor(conf);
  return SERIES[scope].slice(-n).map((r) => {
    const v = r.var99 * k;
    const pnl = basis === "hypo" ? r.hypo : r.actual;
    const ratio = pnl / v;
    return {
      t: r.t,
      iso: r.iso,
      var: v,
      svar: r.svar99 * k,
      hypo: r.hypo,
      actual: r.actual,
      pnl,
      ratio,
      exc: ratio < -1,
      near: ratio >= -1 && ratio < -0.8,
    };
  });
}

export function buildView(scope: Scope, basis: Basis, conf: Confidence, win: WindowLen): ScopeView {
  const n = Number(win);
  const p = tailP(conf);
  const days = viewDays(scope, basis, conf, n);
  const exceptions = days.filter((d) => d.exc).length;
  const cut = zoneCutoffs(n, p);
  const reg = viewDays(scope, basis, "99", 250).filter((d) => d.exc).length;
  return {
    scope,
    days,
    exceptions,
    nearMisses: days.filter((d) => d.near).length,
    expected: n * p,
    cut,
    zone: zoneFor(exceptions, cut),
    kupiec: kupiecPof(exceptions, n, p),
    christ: christoffersen(days.map((d) => d.exc)),
    regCount: reg,
    multiplier: 3 + plusFactor(reg),
  };
}

/* ------------------------------------------------------------------ *
 * Exception log
 * ------------------------------------------------------------------ */

type NoteFn = (h: number) => string;
const pick = (h: number, lo: number, hi: number) => Math.round(lo + h * (hi - lo));

const NOTES: Record<DeskId, Record<Cause, NoteFn>> = {
  rates: {
    "Market move": (h) => `Gilt curve ${pick(h, 11, 24)}bp steeper into the close; long-end receivers hit.`,
    "Model limitation": () => "RPI–CPI basis is not a VaR risk factor; a linker switch lost on the basis.",
    "Data issue": () => "Stale SONIA fixing loaded to the VaR run; corrected in the T+1 rerun.",
    "Intraday position change": () => "Client switch executed and hedged intraday; hypothetical P&L excludes it.",
  },
  credit: {
    "Market move": (h) => `iTraxx Crossover ${pick(h, 14, 32)}bp wider on HY supply; short-protection hedges lagged.`,
    "Model limitation": () => "Index–single-name basis proxied rather than modelled; the basis blew out.",
    "Data issue": () => "Missing time series for three new issuers filled with a sector proxy.",
    "Intraday position change": () => "New-issue allocation traded intraday; actual P&L carries the concession.",
  },
  fx: {
    "Market move": (h) => `GBP/USD gapped ${pick(h, 90, 160)} pips on the data; short-dated vol long only a partial offset.`,
    "Model limitation": () => "Pegged-currency de-peg risk sits outside the 2-year lookback window.",
    "Data issue": () => "Vol surface for a pegged cross stale after a vendor outage; VaR understated.",
    "Intraday position change": () => "Fixing-order flow warehoused intraday; actual P&L includes the slippage.",
  },
  equities: {
    "Market move": (h) => `Euro Stoxx 50 down ${(1.6 + h * 1.4).toFixed(1)}% into the close; book net long delta through the move.`,
    "Model limitation": () => "Dividend futures proxied to the index; the proxy broke on a guidance cut.",
    "Data issue": () => "Rights-issue adjustment missed in the price history; the scenario set jumped.",
    "Intraday position change": () => "Block trade facilitated and hedged intraday; actual P&L carries the discount.",
  },
  commodities: {
    "Market move": (h) => `Brent front spread moved $${(0.6 + h * 1.2).toFixed(2)} on a supply outage; calendar spreads squeezed.`,
    "Model limitation": () => "Front-month gas spike beyond any day in the 2-year lookback window.",
    "Data issue": () => "Contract roll dated a day late in the market-data feed.",
    "Intraday position change": () => "Client hedge restructured intraday; actual P&L includes the unwind cost.",
  },
  em: {
    "Market move": (h) => `EM FX risk-off: BRL and ZAR down ${(1.4 + h * 1.6).toFixed(1)}%; carry basket unwound.`,
    "Model limitation": () => "Local sovereign curve bucketed too coarsely; the belly move was missed.",
    "Data issue": () => "Holiday-calendar mismatch: local close used for one leg, London for the other.",
    "Intraday position change": () => "Real-money bond switch executed intraday at a concession.",
  },
};

const PLANNED_BY_KEY = new Map(PLANNED.map((p) => [`${p.desk}|${p.iso}`, p]));

function deskCause(desk: DeskId, row: DayRow): Cause {
  const p = PLANNED_BY_KEY.get(`${desk}|${row.iso}`);
  if (p?.cause) return p.cause;
  if ((row.actual - row.hypo) / row.var99 < -0.3) return "Intraday position change";
  if (row.iso >= SHOCK_FROM && row.iso <= SHOCK_TO) return "Market move";
  const h = hash01(`cause|${desk}|${row.iso}`);
  return h < 0.56 ? "Market move" : h < 0.83 ? "Model limitation" : "Data issue";
}

function deskNote(desk: DeskId, row: DayRow, cause: Cause): string {
  const p = PLANNED_BY_KEY.get(`${desk}|${row.iso}`);
  if (p?.note && p.cause === cause) return p.note;
  return NOTES[desk][cause](hash01(`note|${desk}|${row.iso}`));
}

const RECENT_FROM = DAYS[DAYS.length - 10];

function signOffFor(key: string, t: number, cause: Cause, planned?: SignOff): SignOff {
  if (planned) return planned;
  if (t >= RECENT_FROM) return "Pending MRM";
  const h = hash01(`signoff|${key}`);
  const challengeRate = cause === "Data issue" ? 0.45 : cause === "Model limitation" ? 0.3 : 0.12;
  return h < challengeRate ? "Challenged" : "Approved";
}

export interface ExceptionRow {
  key: string;
  t: number;
  iso: string;
  scope: Scope;
  /** For firm-wide rows: the desk that lost most that day. */
  driver?: DeskId;
  var: number;
  hypo: number;
  actual: number;
  /** Excess loss over VaR on the selected basis, £m (positive). */
  excess: number;
  excessX: number;
  hypoExc: boolean;
  actualExc: boolean;
  cause: Cause;
  note: string;
  signoff: SignOff;
}

const fmtM = (v: number) => `£${Math.abs(v).toFixed(1)}m`;

export function exceptionLog(view: ScopeView, basis: Basis, conf: Confidence): ExceptionRow[] {
  const k = scaleFor(conf);
  const rows: ExceptionRow[] = [];
  view.days.forEach((d, idx) => {
    if (!d.exc) return;
    const i = DAYS.length - view.days.length + idx;
    let cause: Cause;
    let note: string;
    let driver: DeskId | undefined;
    let planned: SignOff | undefined;
    if (view.scope === "firm") {
      const contrib = DESKS.map((ds) => {
        const r = SERIES[ds.id][i];
        return { id: ds.id, row: r, pnl: basis === "hypo" ? r.hypo : r.actual };
      }).sort((a, b) => a.pnl - b.pnl);
      const top = contrib[0];
      driver = top.id;
      // attribute the firm exception to the biggest £ loser that itself breached
      const breach = contrib.find((c) => c.pnl < -c.row.var99 * k);
      const [a, b] = contrib;
      const split = `${DESK_BY_ID[a.id].label} −${fmtM(a.pnl)}, ${DESK_BY_ID[b.id].label} −${fmtM(b.pnl)}`;
      if (breach) {
        cause = deskCause(breach.id, breach.row);
        note = `${DESK_BY_ID[breach.id].label}: ${deskNote(breach.id, breach.row, cause)} (${split}.)`;
        planned = PLANNED_BY_KEY.get(`${breach.id}|${d.iso}`)?.signoff;
      } else {
        cause = "Market move";
        note = `Broad loss with no single desk beyond its own VaR (${split}); diversification did not offset it.`;
      }
    } else {
      const row = SERIES[view.scope][i];
      cause = deskCause(view.scope, row);
      note = deskNote(view.scope, row, cause);
      planned = PLANNED_BY_KEY.get(`${view.scope}|${d.iso}`)?.signoff;
    }
    const key = `${view.scope}|${d.iso}`;
    rows.push({
      key,
      t: d.t,
      iso: d.iso,
      scope: view.scope,
      driver,
      var: d.var,
      hypo: d.hypo,
      actual: d.actual,
      excess: -d.pnl - d.var,
      excessX: -d.ratio,
      hypoExc: d.hypo < -d.var,
      actualExc: d.actual < -d.var,
      cause,
      note,
      signoff: signOffFor(key, d.t, cause, planned),
    });
  });
  return rows.sort((a, b) => b.t - a.t);
}
