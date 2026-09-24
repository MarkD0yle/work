/* Mortgage Pipeline: model and derived statistics.
 *
 * A seeded book of mortgage applications received since mid-June 2026, as
 * at Tue 22 Sep 2026, 09:30. The last ten application weeks (Mon 20 Jul
 * onwards) are the cohort window for the heatmap and the league table; the
 * older cases are there so the live pipeline and this month's completions
 * are complete rather than cut off at the window edge. Each case carries a channel,
 * product, introducer, loan and LTV, and walks the six stages
 * Application → Decision in principle → Valuation → Underwriting → Offer →
 * Completion with a stage-specific duration drawn in *business days*, so
 * SLA ageing never counts weekends or the August bank holiday. A case is
 * open in the stage it had reached at 09:30 today, completed once it leaves
 * the Completion stage (funds released), or fallen through if it dropped
 * out on the way.
 *
 * The story built into the draws: underwriting durations have been
 * stretching since the September pick-up in volume, so the live Underwriting
 * population sits past its 4-day SLA; valuation and completion carry the
 * usual tails (surveyor and solicitor delays). Everything on the page —
 * stage counts, medians, breaches, cohort conversion, pacing, the league
 * table and time-in-stage buckets — comes from one `buildView(filters)` so
 * all the numbers agree. */

export type Channel = "Broker" | "Direct" | "Digital";
export type Product = "2y fixed" | "5y fixed" | "Tracker" | "Buy-to-let" | "First-time buyer";
export type StageIdx = 0 | 1 | 2 | 3 | 4 | 5;
export type CaseStatus = "open" | "completed" | "fell";
export type HoldReason =
  | "Awaiting valuation"
  | "Documents outstanding"
  | "Referred to senior underwriter"
  | "Awaiting solicitor"
  | "Broker query"
  | "Income verification";

export const CHANNELS: Channel[] = ["Broker", "Direct", "Digital"];
export const PRODUCTS: Product[] = ["2y fixed", "5y fixed", "Tracker", "Buy-to-let", "First-time buyer"];
export const HOLD_REASONS: HoldReason[] = [
  "Awaiting valuation",
  "Documents outstanding",
  "Referred to senior underwriter",
  "Awaiting solicitor",
  "Broker query",
  "Income verification",
];

export interface Stage {
  idx: StageIdx;
  id: string;
  label: string;
  short: string;
  /** SLA for time in stage, business days. */
  sla: number;
}

export const STAGES: Stage[] = [
  { idx: 0, id: "app", label: "Application", short: "App", sla: 1 },
  { idx: 1, id: "dip", label: "Decision in principle", short: "DIP", sla: 2 },
  { idx: 2, id: "val", label: "Valuation", short: "Valuation", sla: 5 },
  { idx: 3, id: "uw", label: "Underwriting", short: "Underwriting", sla: 4 },
  { idx: 4, id: "offer", label: "Offer", short: "Offer", sla: 3 },
  { idx: 5, id: "comp", label: "Completion", short: "Completion", sla: 28 },
];

export interface Filters {
  channel: Channel | "all";
  product: Product | "all";
}

/* ------------------------------------------------------------------ *
 * Business-day calendar
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
export const AS_OF = Date.UTC(2026, 8, 22, 9, 30); // Tue 22 Sep 2026, 09:30
const CAL_START = Date.UTC(2026, 5, 15); // Mon 15 Jun 2026: first application day in the book
/** The cohort window: the last ten application weeks, Mon 20 Jul onwards. */
export const WINDOW_START = Date.UTC(2026, 6, 20);
export const WINDOW_WEEKS = 10;
const CAL_END = Date.UTC(2026, 11, 31);
const HOLIDAYS = new Set(["2026-08-31", "2026-12-25", "2026-12-28"]);

export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const isBusinessDay = (t: number) => {
  const wd = new Date(t).getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(isoDay(t));
};

/** UTC-midnight timestamps of every business day in the calendar. */
export const BIZ_DAYS: number[] = [];
for (let t = CAL_START; t <= CAL_END; t += DAY_MS) if (isBusinessDay(t)) BIZ_DAYS.push(t);
const BIZ_INDEX = new Map(BIZ_DAYS.map((t, i) => [t, i]));

/** Business time: whole business days since 20 Jul plus the fraction of the
 *  current day, so subtracting two values gives business-day ageing. A
 *  timestamp on a weekend or holiday snaps to the start of the next
 *  business day. */
export function bizTime(t: number): number {
  const day = Math.floor(t / DAY_MS) * DAY_MS;
  const idx = BIZ_INDEX.get(day);
  if (idx !== undefined) return idx + (t - day) / DAY_MS;
  let d = day + DAY_MS;
  while (!BIZ_INDEX.has(d)) d += DAY_MS;
  return BIZ_INDEX.get(d) as number;
}

export function fromBizTime(b: number): number {
  const idx = Math.min(BIZ_DAYS.length - 1, Math.max(0, Math.floor(b)));
  return BIZ_DAYS[idx] + (b - idx) * DAY_MS;
}

export const NOW_B = bizTime(AS_OF);
const TODAY_IDX = Math.floor(NOW_B);
const B_SEP1 = bizTime(Date.UTC(2026, 8, 1));
const B_AUG3 = bizTime(Date.UTC(2026, 7, 3));
/** Business days in September 2026 (22: no bank holidays). */
export const SEP_DAYS = BIZ_DAYS.filter((t) => t >= Date.UTC(2026, 8, 1) && t < Date.UTC(2026, 9, 1));
export const MONTH_END = Date.UTC(2026, 8, 30);

/* ------------------------------------------------------------------ *
 * Reference data (all fictional)
 * ------------------------------------------------------------------ */

export interface Introducer {
  id: string;
  name: string;
  channel: Channel;
  /** Relative submission volume within the channel. */
  weight: number;
  /** Probability a case arrives fully packaged. */
  quality: number;
}

export const INTRODUCERS: Introducer[] = [
  { id: "b01", name: "Harcourt Mortgage Partners", channel: "Broker", weight: 14, quality: 0.9 },
  { id: "b02", name: "Lindley & Pryce", channel: "Broker", weight: 12, quality: 0.86 },
  { id: "b03", name: "Northgate Financial", channel: "Broker", weight: 11, quality: 0.72 },
  { id: "b04", name: "Ashcombe Advisers", channel: "Broker", weight: 9, quality: 0.93 },
  { id: "b05", name: "Blue Kestrel Mortgages", channel: "Broker", weight: 8, quality: 0.64 },
  { id: "b06", name: "Fenwick Home Finance", channel: "Broker", weight: 8, quality: 0.8 },
  { id: "b07", name: "Marlow Rowe", channel: "Broker", weight: 7, quality: 0.88 },
  { id: "b08", name: "Carrick Brokerage", channel: "Broker", weight: 6, quality: 0.58 },
  { id: "b09", name: "Stonebridge Mortgages", channel: "Broker", weight: 6, quality: 0.83 },
  { id: "b10", name: "Oakhurst Financial", channel: "Broker", weight: 5, quality: 0.77 },
  { id: "b11", name: "Tarrant & Vale", channel: "Broker", weight: 4, quality: 0.9 },
  { id: "b12", name: "Weston Ridge Advisers", channel: "Broker", weight: 4, quality: 0.7 },
  { id: "b13", name: "Pennington Row", channel: "Broker", weight: 3, quality: 0.85 },
  { id: "b14", name: "Greyfriars Mortgages", channel: "Broker", weight: 3, quality: 0.62 },
  { id: "b15", name: "Selby Ashworth", channel: "Broker", weight: 2, quality: 0.8 },
  { id: "b16", name: "Hollis & Kemp", channel: "Broker", weight: 2, quality: 0.75 },
  { id: "d01", name: "Leeds branch", channel: "Direct", weight: 22, quality: 0.9 },
  { id: "d02", name: "Manchester branch", channel: "Direct", weight: 20, quality: 0.88 },
  { id: "d03", name: "Birmingham branch", channel: "Direct", weight: 18, quality: 0.84 },
  { id: "d04", name: "Bristol branch", channel: "Direct", weight: 15, quality: 0.91 },
  { id: "d05", name: "Glasgow branch", channel: "Direct", weight: 13, quality: 0.87 },
  { id: "d06", name: "London Moorgate branch", channel: "Direct", weight: 12, quality: 0.82 },
  { id: "g01", name: "Online (direct.app)", channel: "Digital", weight: 100, quality: 0.76 },
];
export const INTRODUCER_BY_ID = new Map(INTRODUCERS.map((i) => [i.id, i]));

export interface Owner {
  id: string;
  name: string;
  team: string;
}

const CASE_MANAGERS: Owner[] = [
  { id: "o01", name: "Priya Raman", team: "Case management" },
  { id: "o02", name: "Tom Achebe", team: "Case management" },
  { id: "o03", name: "Sian Lloyd", team: "Case management" },
  { id: "o04", name: "Marek Novak", team: "Case management" },
];
const VALUATIONS: Owner[] = [
  { id: "o05", name: "Dee Okonkwo", team: "Valuations" },
  { id: "o06", name: "Hamish Frazer", team: "Valuations" },
  { id: "o07", name: "Lucy Pham", team: "Valuations" },
];
const UNDERWRITERS: Owner[] = [
  { id: "o08", name: "Ade Bello", team: "Underwriting" },
  { id: "o09", name: "Rosa Fiorentino", team: "Underwriting" },
  { id: "o10", name: "Callum Reid", team: "Underwriting" },
  { id: "o11", name: "Ines Duarte", team: "Underwriting" },
  { id: "o12", name: "Nikhil Sethi", team: "Underwriting" },
];
const SENIOR_UW: Owner = { id: "o13", name: "Margaret Osei", team: "Senior underwriting" };
const COMPLETIONS: Owner[] = [
  { id: "o14", name: "Grace Whitlow", team: "Completions" },
  { id: "o15", name: "Omar Haddad", team: "Completions" },
  { id: "o16", name: "Beth Carrow", team: "Completions" },
];
export const OWNERS: Owner[] = [...CASE_MANAGERS, ...VALUATIONS, ...UNDERWRITERS, SENIOR_UW, ...COMPLETIONS];
export const OWNER_BY_ID = new Map(OWNERS.map((o) => [o.id, o]));
const OWNER_POOL: Owner[][] = [CASE_MANAGERS, CASE_MANAGERS, VALUATIONS, UNDERWRITERS, CASE_MANAGERS, COMPLETIONS];

const SURNAMES = [
  "Thornton", "Okafor", "Bennett", "Chaudhry", "Marsh", "Delgado", "Kowalczyk", "Hughes", "Ibrahim", "Fletcher",
  "Nakamura", "Osborne", "Petrov", "Quinn", "Radcliffe", "Sato", "Turnbull", "Underwood", "Varga", "Whitmore",
  "Yilmaz", "Ziegler", "Abbott", "Brennan", "Coyle", "Dunmore", "Ellwood", "Farrell", "Gault", "Hartley",
  "Iqbal", "Jarvis", "Kendrick", "Lowry", "Mensah", "Nwosu", "Oduya", "Pearce", "Rahman", "Stirling",
];
const INITIALS = "ABCDEFGHJKLMNPRSTW";

const PRODUCT_MIX: Record<Channel, [Product, number][]> = {
  Broker: [["2y fixed", 26], ["5y fixed", 32], ["Tracker", 9], ["Buy-to-let", 21], ["First-time buyer", 12]],
  Direct: [["2y fixed", 34], ["5y fixed", 38], ["Tracker", 12], ["Buy-to-let", 4], ["First-time buyer", 12]],
  Digital: [["2y fixed", 36], ["5y fixed", 34], ["Tracker", 10], ["Buy-to-let", 5], ["First-time buyer", 15]],
};
const LOAN_MEDIAN: Record<Product, number> = {
  "2y fixed": 236_000,
  "5y fixed": 252_000,
  Tracker: 318_000,
  "Buy-to-let": 208_000,
  "First-time buyer": 214_000,
};
const LTV_PARAMS: Record<Product, { mean: number; sd: number; lo: number; hi: number }> = {
  "2y fixed": { mean: 74, sd: 9, lo: 55, hi: 90 },
  "5y fixed": { mean: 71, sd: 10, lo: 50, hi: 90 },
  Tracker: { mean: 64, sd: 10, lo: 45, hi: 85 },
  "Buy-to-let": { mean: 67, sd: 6, lo: 50, hi: 75 },
  "First-time buyer": { mean: 88, sd: 4, lo: 80, hi: 95 },
};

/* Monthly plan. The target is 640 completions / £172m for the whole book;
 * a filtered slice is measured against its planned share of that. */
export const TARGET = { count: 640, value: 172_000_000 };
const PLAN_CHANNEL: Record<Channel, number> = { Broker: 0.58, Direct: 0.24, Digital: 0.18 };
const PLAN_PRODUCT: Record<Product, number> = {
  "2y fixed": 0.3,
  "5y fixed": 0.34,
  Tracker: 0.1,
  "Buy-to-let": 0.14,
  "First-time buyer": 0.12,
};

export function targetFor(f: Filters): { count: number; value: number } {
  const ch = f.channel === "all" ? 1 : PLAN_CHANNEL[f.channel];
  const prCount = f.product === "all" ? 1 : PLAN_PRODUCT[f.product];
  const valueWeight = PRODUCTS.reduce((s, p) => s + PLAN_PRODUCT[p] * LOAN_MEDIAN[p], 0);
  const prValue = f.product === "all" ? 1 : (PLAN_PRODUCT[f.product] * LOAN_MEDIAN[f.product]) / valueWeight;
  return {
    count: Math.round(TARGET.count * ch * prCount),
    value: Math.round(TARGET.value * ch * prValue),
  };
}

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

/** FNV-1a: a stable per-key uniform in [0, 1) for labels that must not move. */
export function hash01(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

function pickWeighted<T>(rng: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

export interface Case {
  id: string;
  applicant: string;
  channel: Channel;
  product: Product;
  introducerId: string;
  loan: number;
  ltv: number;
  /** Application received, ms. */
  appliedAt: number;
  /** Business time the case entered each stage it has reached (index = stage). */
  entered: number[];
  status: CaseStatus;
  /** Current stage if open; the stage it left from if completed or fallen. */
  stage: StageIdx;
  /** Business time funds were released (completed cases). */
  completedB?: number;
  /** Business time the case dropped out (fallen cases). */
  fellB?: number;
  holdReason: HoldReason | null;
  ownerId: string;
  packagingOk: boolean;
  referred: boolean;
}

/* Weekly application volume, Mon 20 Jul onwards; the September pick-up is
 * what tips underwriting over its SLA. */
const WEEK_BASE = [170, 172, 168, 175, 176, 182, 168, 174, 180, 171, 186, 198, 204, 196];
const WD_WEIGHT = [1.15, 1.08, 1.0, 0.97, 0.8]; // Mon … Fri
const MEDIAN_DAYS = [0.7, 1.2, 3.4, 2.8, 1.6, 14];
const SIGMA = [0.55, 0.6, 0.5, 0.5, 0.5, 0.38];
const FALL_P = [0.015, 0.05, 0.035, 0.05, 0.02, 0.035];

/** Underwriting load factor: durations stretch as the September volume
 *  lands on the same underwriting capacity. */
function uwLoad(b: number): number {
  const from = B_SEP1 - 6;
  const x = Math.min(1, Math.max(0, (b - from) / (NOW_B - from)));
  return 1 + 2.7 * x;
}

interface Traits {
  channel: Channel;
  product: Product;
  packagingOk: boolean;
  referred: boolean;
  slowVal: boolean;
  slowSol: boolean;
}

function stageMedian(s: number, c: Traits, start: number): number {
  let m = MEDIAN_DAYS[s];
  switch (s) {
    case 0:
      if (c.channel === "Digital") m *= 0.6;
      if (c.channel === "Broker") m *= 1.25;
      if (!c.packagingOk) m *= 1.8;
      break;
    case 1:
      if (c.product === "Buy-to-let") m *= 1.2;
      if (!c.packagingOk) m *= 1.5;
      break;
    case 2:
      if (c.product === "First-time buyer") m *= 1.1;
      if (c.slowVal) m *= 2.4;
      break;
    case 3:
      if (c.product === "Buy-to-let") m *= 1.4;
      if (!c.packagingOk) m *= 1.5;
      if (c.referred) m *= 2.2;
      m *= uwLoad(start);
      break;
    case 4:
      if (c.channel === "Broker") m *= 1.1;
      break;
    default:
      if (c.product === "First-time buyer") m *= 1.15;
      if (c.product === "Buy-to-let") m *= 0.9;
      if (c.slowSol) m *= 2.0;
  }
  return m;
}

const HOLD_WEIGHTS: [HoldReason, number][][] = [
  [["Documents outstanding", 60], ["Broker query", 25], ["Income verification", 15]],
  [["Income verification", 55], ["Documents outstanding", 35], ["Broker query", 10]],
  [["Awaiting valuation", 55], ["Documents outstanding", 30], ["Broker query", 15]],
  [["Income verification", 35], ["Documents outstanding", 30], ["Broker query", 20], ["Referred to senior underwriter", 15]],
  [["Broker query", 45], ["Documents outstanding", 40], ["Income verification", 15]],
  [["Awaiting solicitor", 70], ["Broker query", 15], ["Documents outstanding", 15]],
];

function pickHold(rng: () => number, stage: StageIdx, c: Traits): HoldReason {
  if (stage === 3 && c.referred && rng() < 0.85) return "Referred to senior underwriter";
  if (stage === 2 && c.slowVal && rng() < 0.9) return "Awaiting valuation";
  if (stage === 5 && c.slowSol && rng() < 0.9) return "Awaiting solicitor";
  const weights = HOLD_WEIGHTS[stage].map(
    ([r, w]) => [r === "Broker query" && c.channel !== "Broker" ? "Documents outstanding" : r, w] as [HoldReason, number],
  );
  return pickWeighted(rng, weights);
}

function generate(seed: number): Case[] {
  const rng = mulberry32(seed);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const cases: Case[] = [];
  let seq = 40113;

  for (let k = 0; k <= TODAY_IDX; k++) {
    const dayT = BIZ_DAYS[k];
    const week = Math.min(WEEK_BASE.length - 1, Math.floor((dayT - CAL_START) / (7 * DAY_MS)));
    const wd = new Date(dayT).getUTCDay() - 1;
    const n = Math.round((WEEK_BASE[week] / 5) * WD_WEIGHT[wd] * (0.88 + 0.24 * rng()));
    for (let i = 0; i < n; i++) {
      // applications land between 08:00 and 18:00; today's stop at 09:30
      const b = k + 0.33 + 0.42 * rng();
      if (b > NOW_B) continue;
      const channel = pickWeighted<Channel>(rng, [["Broker", 58], ["Direct", 24], ["Digital", 18]]);
      const intro = pickWeighted(
        rng,
        INTRODUCERS.filter((x) => x.channel === channel).map((x) => [x, x.weight] as [Introducer, number]),
      );
      const product = pickWeighted(rng, PRODUCT_MIX[channel]);
      const loan = Math.round((LOAN_MEDIAN[product] * Math.exp(0.42 * gauss())) / 500) * 500;
      const lp = LTV_PARAMS[product];
      const ltv = Math.round(Math.min(lp.hi, Math.max(lp.lo, lp.mean + lp.sd * gauss())) * 10) / 10;
      const traits: Traits = {
        channel,
        product,
        packagingOk: rng() < intro.quality,
        referred: rng() < (product === "Buy-to-let" ? 0.18 : 0.1),
        slowVal: rng() < 0.09,
        slowSol: rng() < 0.12,
      };

      const entered = [b];
      let status: CaseStatus = "open";
      let stage: StageIdx = 0;
      let completedB: number | undefined;
      let fellB: number | undefined;
      for (let s = 0; s < STAGES.length; s++) {
        const start = entered[s];
        const dur = stageMedian(s, traits, start) * Math.exp(SIGMA[s] * gauss());
        const fallP =
          FALL_P[s] * (traits.packagingOk ? 1 : 1.5) * (product === "Buy-to-let" && s === 3 ? 1.3 : 1);
        const falls = rng() < fallP;
        const leaveAt = start + (falls ? dur * (0.2 + 0.8 * rng()) : dur);
        if (leaveAt > NOW_B) {
          stage = s as StageIdx;
          break;
        }
        if (falls) {
          status = "fell";
          stage = s as StageIdx;
          fellB = leaveAt;
          break;
        }
        if (s === STAGES.length - 1) {
          status = "completed";
          stage = 5;
          completedB = leaveAt;
          break;
        }
        entered.push(leaveAt);
      }

      let holdReason: HoldReason | null = null;
      if (status === "open") {
        const over = NOW_B - entered[stage] > STAGES[stage].sla;
        if (over || rng() < 0.22) holdReason = pickHold(rng, stage, traits);
      }

      const id = `APP-26-${String(seq++).padStart(5, "0")}`;
      const h1 = hash01(`name|${id}`);
      const h2 = hash01(`init|${id}`);
      const joint = hash01(`joint|${id}`) < 0.28;
      const initial = (h: number) => INITIALS[Math.floor(h * INITIALS.length)];
      const applicant = `${initial(h2)}.${joint ? ` & ${initial(hash01(`init2|${id}`))}.` : ""} ${
        SURNAMES[Math.floor(h1 * SURNAMES.length)]
      }`;
      const pool = stage === 3 && traits.referred && holdReason === "Referred to senior underwriter" ? [SENIOR_UW] : OWNER_POOL[stage];
      const owner = pool[Math.floor(hash01(`owner|${id}`) * pool.length)];

      cases.push({
        id,
        applicant,
        channel,
        product,
        introducerId: intro.id,
        loan,
        ltv,
        appliedAt: fromBizTime(b),
        entered,
        status,
        stage,
        completedB,
        fellB,
        holdReason,
        ownerId: owner.id,
        packagingOk: traits.packagingOk,
        referred: traits.referred,
      });
    }
  }
  return cases;
}

export const SEED = 20260922;
export const CASES: Case[] = generate(SEED);

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

export interface CaseRow extends Case {
  stageDef: Stage;
  introducer: Introducer;
  owner: Owner;
  /** Business days in the current stage (open cases). */
  daysInStage: number;
  /** Days past the stage SLA (negative while inside it). */
  overSla: number;
  breach: boolean;
}

export interface StageSummary {
  stage: Stage;
  count: number;
  value: number;
  /** Median business days in stage for the live population. */
  median: number;
  breaches: number;
  breachValue: number;
  /** Cases entering the stage per business day, oldest first. */
  inflow: number[];
  /** Business-day timestamps matching `inflow`. */
  inflowDays: number[];
}

export interface FunnelBand {
  label: string;
  n: number;
  /** Share of the band above, 0–1 (1 for the top band). */
  ofPrev: number;
  /** Share of applications, 0–1. */
  ofTop: number;
}

export interface Funnel {
  current: FunnelBand[];
  prior: FunnelBand[];
  /** Cohort age in business days: both cohorts are measured at the same age. */
  ageDays: number;
  currentRange: [number, number];
  priorRange: [number, number];
}

export interface CohortRow {
  weekStart: number;
  n: number;
  /** Cases that reached each of DIP … Completion, then Completed. */
  counts: number[];
  /** `counts` as a share of `n`, 0–100. */
  pct: number[];
  fell: number;
}

export interface PacingPoint {
  t: number;
  /** Cumulative completions to this point; null beyond today. */
  actual: number | null;
  actualValue: number | null;
  target: number;
  targetValue: number;
}

export interface Pacing {
  targetCount: number;
  targetValue: number;
  mtdCount: number;
  mtdValue: number;
  /** Business days elapsed and remaining in the month (fractional). */
  elapsed: number;
  remaining: number;
  workingDays: number;
  /** Trailing 10-business-day run rate, completions per business day. */
  rateCount: number;
  rateValue: number;
  requiredRate: number;
  projectedCount: number;
  projectedValue: number;
  points: PacingPoint[];
  /** Completions per business day for the trailing 10 days, oldest first. */
  trailing: { t: number; n: number }[];
}

export interface IntroducerRow {
  introducer: Introducer;
  submissions: number;
  value: number;
  /** Offers ÷ (offers + fall-throughs before offer); null when fewer than 5 decided. */
  offerRate: number | null;
  /** Mean business days from application to offer for offered cases. */
  daysToOffer: number | null;
  /** Fall-throughs at any stage ÷ submissions. */
  fallThrough: number;
  /** Share of submissions that arrived fully packaged, 0–100. */
  packaging: number;
  open: number;
  breaches: number;
}

export interface PipelineView {
  filters: Filters;
  cases: Case[];
  rows: CaseRow[];
  stages: StageSummary[];
  funnel: Funnel;
  cohorts: CohortRow[];
  pacing: Pacing;
  league: IntroducerRow[];
  totals: { open: number; openValue: number; breaches: number; breachValue: number; fell: number; completed: number };
}

export const FUNNEL_LABELS = STAGES.map((s) => s.label);
export const COHORT_COLUMNS = [...STAGES.slice(1).map((s) => s.short), "Completed"];

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const matches = (c: Case, f: Filters) =>
  (f.channel === "all" || c.channel === f.channel) && (f.product === "all" || c.product === f.product);

/** Bands reached by a cohort as at business time `at`: applications, then
 *  each stage entered, then completed. */
function reachedBands(cohort: Case[], at: number): number[] {
  const out = new Array<number>(STAGES.length + 1).fill(0);
  for (const c of cohort) {
    for (let s = 0; s < STAGES.length; s++) if (c.entered[s] !== undefined && c.entered[s] <= at) out[s]++;
    if (c.completedB !== undefined && c.completedB <= at) out[STAGES.length]++;
  }
  return out;
}

function bands(reached: number[]): FunnelBand[] {
  const counts = reached.slice(0, STAGES.length);
  return counts.map((n, i) => ({
    label: FUNNEL_LABELS[i],
    n,
    ofPrev: i === 0 ? 1 : counts[i - 1] ? n / counts[i - 1] : 0,
    ofTop: counts[0] ? n / counts[0] : 0,
  }));
}

function buildPacing(cases: Case[], f: Filters): Pacing {
  const target = targetFor(f);
  const done = cases
    .filter((c): c is Case & { completedB: number } => c.status === "completed" && c.completedB !== undefined)
    .sort((a, b) => a.completedB - b.completedB);
  const cumTo = (b: number) => {
    let n = 0;
    let v = 0;
    for (const c of done) {
      if (c.completedB > b) break;
      if (c.completedB >= B_SEP1) {
        n++;
        v += c.loan;
      }
    }
    return { n, v };
  };
  const workingDays = SEP_DAYS.length;
  const elapsed = NOW_B - B_SEP1;
  const remaining = workingDays - elapsed;
  const mtd = cumTo(NOW_B);
  const trailing = Array.from({ length: 10 }, (_, i) => {
    const from = NOW_B - 10 + i;
    const n = done.filter((c) => c.completedB >= from && c.completedB < from + 1).length;
    return { t: fromBizTime(from), n };
  });
  const tenDays = done.filter((c) => c.completedB >= NOW_B - 10 && c.completedB < NOW_B);
  const rateCount = tenDays.length / 10;
  const rateValue = tenDays.reduce((s, c) => s + c.loan, 0) / 10;
  const points: PacingPoint[] = [
    { t: Date.UTC(2026, 8, 1), actual: 0, actualValue: 0, target: 0, targetValue: 0 },
  ];
  SEP_DAYS.forEach((t, i) => {
    const endOfDay = B_SEP1 + i + 1;
    const share = (i + 1) / workingDays;
    const past = endOfDay <= NOW_B;
    const cum = past ? cumTo(endOfDay) : null;
    points.push({
      t: t + 17 * 3_600_000,
      actual: cum ? cum.n : null,
      actualValue: cum ? cum.v : null,
      target: target.count * share,
      targetValue: target.value * share,
    });
  });
  const todayShare = elapsed / workingDays;
  points.push({
    t: AS_OF,
    actual: mtd.n,
    actualValue: mtd.v,
    target: target.count * todayShare,
    targetValue: target.value * todayShare,
  });
  points.sort((a, b) => a.t - b.t);
  return {
    targetCount: target.count,
    targetValue: target.value,
    mtdCount: mtd.n,
    mtdValue: mtd.v,
    elapsed,
    remaining,
    workingDays,
    rateCount,
    rateValue,
    requiredRate: Math.max(0, (target.count - mtd.n) / remaining),
    projectedCount: Math.round(mtd.n + remaining * rateCount),
    projectedValue: mtd.v + remaining * rateValue,
    points,
    trailing,
  };
}

export function buildView(filters: Filters): PipelineView {
  const cases = CASES.filter((c) => matches(c, filters));

  const rows: CaseRow[] = cases
    .filter((c) => c.status === "open")
    .map((c) => {
      const stageDef = STAGES[c.stage];
      const daysInStage = NOW_B - c.entered[c.stage];
      return {
        ...c,
        stageDef,
        introducer: INTRODUCER_BY_ID.get(c.introducerId) as Introducer,
        owner: OWNER_BY_ID.get(c.ownerId) as Owner,
        daysInStage,
        overSla: daysInStage - stageDef.sla,
        breach: daysInStage > stageDef.sla,
      };
    });

  const inflowDays = Array.from({ length: 14 }, (_, i) => TODAY_IDX - 13 + i);
  const stages: StageSummary[] = STAGES.map((stage) => {
    const live = rows.filter((r) => r.stage === stage.idx);
    const breached = live.filter((r) => r.breach);
    const inflow = inflowDays.map(
      (d) => cases.filter((c) => c.entered[stage.idx] !== undefined && Math.floor(c.entered[stage.idx]) === d).length,
    );
    return {
      stage,
      count: live.length,
      value: live.reduce((s, r) => s + r.loan, 0),
      median: median(live.map((r) => r.daysInStage)),
      breaches: breached.length,
      breachValue: breached.reduce((s, r) => s + r.loan, 0),
      inflow,
      inflowDays: inflowDays.map((d) => BIZ_DAYS[d]),
    };
  });

  // Cohort funnel: this month's applications, and last month's measured at
  // the same age so the comparison is like for like.
  const age = NOW_B - B_SEP1;
  const priorAt = B_AUG3 + age;
  const currentCohort = cases.filter((c) => c.entered[0] >= B_SEP1);
  const priorCohort = cases.filter((c) => c.entered[0] >= B_AUG3 && c.entered[0] < priorAt);
  const funnel: Funnel = {
    current: bands(reachedBands(currentCohort, NOW_B)),
    prior: bands(reachedBands(priorCohort, priorAt)),
    ageDays: age,
    currentRange: [Date.UTC(2026, 8, 1), AS_OF],
    priorRange: [Date.UTC(2026, 7, 3), fromBizTime(priorAt)],
  };

  const cohorts: CohortRow[] = Array.from({ length: WINDOW_WEEKS }, (_, w) => {
    const weekStart = WINDOW_START + w * 7 * DAY_MS;
    const weekEnd = weekStart + 7 * DAY_MS;
    const cohort = cases.filter((c) => c.appliedAt >= weekStart && c.appliedAt < weekEnd);
    const counts = reachedBands(cohort, NOW_B).slice(1);
    return {
      weekStart,
      n: cohort.length,
      counts,
      pct: counts.map((n) => (cohort.length ? (100 * n) / cohort.length : 0)),
      fell: cohort.filter((c) => c.status === "fell").length,
    };
  });

  // League table: submissions in the cohort window only, so introducers are
  // compared over the same ten weeks.
  const byIntro = new Map<string, Case[]>();
  for (const c of cases) {
    if (c.appliedAt < WINDOW_START) continue;
    const list = byIntro.get(c.introducerId);
    if (list) list.push(c);
    else byIntro.set(c.introducerId, [c]);
  }
  const league: IntroducerRow[] = [...byIntro.entries()]
    .map(([id, list]) => {
      const offered = list.filter((c) => c.entered.length > 4);
      const fellBeforeOffer = list.filter((c) => c.status === "fell" && c.stage < 4).length;
      const decided = offered.length + fellBeforeOffer;
      const open = rows.filter((r) => r.introducerId === id && r.appliedAt >= WINDOW_START);
      return {
        introducer: INTRODUCER_BY_ID.get(id) as Introducer,
        submissions: list.length,
        value: list.reduce((s, c) => s + c.loan, 0),
        offerRate: decided >= 5 ? offered.length / decided : null,
        daysToOffer: offered.length
          ? offered.reduce((s, c) => s + (c.entered[4] - c.entered[0]), 0) / offered.length
          : null,
        fallThrough: list.filter((c) => c.status === "fell").length / list.length,
        packaging: (100 * list.filter((c) => c.packagingOk).length) / list.length,
        open: open.length,
        breaches: open.filter((r) => r.breach).length,
      };
    })
    .sort((a, b) => b.submissions - a.submissions || a.introducer.name.localeCompare(b.introducer.name))
    .slice(0, 12);

  const breached = rows.filter((r) => r.breach);
  return {
    filters,
    cases,
    rows,
    stages,
    funnel,
    cohorts,
    pacing: buildPacing(cases, filters),
    league,
    totals: {
      open: rows.length,
      openValue: rows.reduce((s, r) => s + r.loan, 0),
      breaches: breached.length,
      breachValue: breached.reduce((s, r) => s + r.loan, 0),
      fell: cases.filter((c) => c.status === "fell").length,
      completed: cases.filter((c) => c.status === "completed").length,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Time-in-stage buckets
 * ------------------------------------------------------------------ */

export const BUCKET_EDGES = [0, 1, 2, 3, 4, 5, 7, 10, 15, 20, 28, 40];

export interface BucketRow {
  label: string;
  from: number;
  /** Null for the open-ended last bucket. */
  to: number | null;
  /** Live cases per stage in this bucket. */
  byStage: number[];
  total: number;
  /** Live cases in this bucket that are past their stage SLA. */
  breach: number;
}

export function timeInStage(rows: CaseRow[], stage: StageIdx | null): BucketRow[] {
  const buckets: BucketRow[] = BUCKET_EDGES.map((from, i) => {
    const to = i + 1 < BUCKET_EDGES.length ? BUCKET_EDGES[i + 1] : null;
    return {
      label: to === null ? `${from}+` : to - from === 1 ? (from === 0 ? "<1" : `${from}–${to}`) : `${from}–${to}`,
      from,
      to,
      byStage: STAGES.map(() => 0),
      total: 0,
      breach: 0,
    };
  });
  for (const r of rows) {
    if (stage !== null && r.stage !== stage) continue;
    let i = BUCKET_EDGES.length - 1;
    while (i > 0 && r.daysInStage < BUCKET_EDGES[i]) i--;
    const b = buckets[i];
    b.byStage[r.stage]++;
    b.total++;
    if (r.breach) b.breach++;
  }
  return buckets;
}

/** Index of the bucket boundary that equals a stage SLA, for the plot line. */
export function slaBoundary(sla: number): number {
  return BUCKET_EDGES.indexOf(sla) - 0.5;
}
