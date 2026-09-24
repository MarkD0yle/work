import { CURRENT_BUSINESS_DATE, isMarketClosed } from "./calendars";

/* Shared data + formatting for the KPI Trend Patterns page (Sparkline
 * Stats, Target Stats, Driver Stats). The KPI Strip on Ops
 * Overview is the first member of the family; these extend it with three
 * other ways of answering "is this number moving, and should I care?"
 *
 * Every number here is mock, but the headline values match the firm-wide
 * ops strip (18,432 trades, 12 exceptions, 94.2% SLA, 8m 14s cycle) so the
 * pages read as the same operation seen through different lenses. */

export type Period = "30d" | "90d" | "ytd";

export const PERIODS: Period[] = ["30d", "90d", "ytd"];

export const PERIOD_LABEL: Record<Period, string> = {
  "30d": "30D",
  "90d": "90D",
  ytd: "YTD",
};

export const AS_OF = CURRENT_BUSINESS_DATE;

/** Which way is good for a metric. "none" = volume, context only. */
export type GoodDirection = "up" | "down" | "none";

export type Tone = "ok" | "warn" | "neutral";

export type Unit = "count" | "pct" | "duration";

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

/** Averages of small counts keep a decimal (1.9 exceptions/day); big ones don't. */
export function formatAvg(n: number): string {
  return Math.abs(n) < 100 ? n.toFixed(1) : formatCount(n);
}

export function formatPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function formatValue(value: number, unit: Unit): string {
  if (unit === "pct") return formatPct(value);
  if (unit === "duration") return formatDuration(value);
  return formatCount(value);
}

/** "Thu 28 May" — the day label a scrubbed sparkline shows. */
export function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/* ------------------------------------------------------------------ *
 * Deltas — the arrow shows direction, the tone shows whether that
 * direction is good for this metric. Exceptions going up is warn;
 * cycle time going down is ok.
 * ------------------------------------------------------------------ */

export function toneFor(change: number, good: GoodDirection): Tone {
  if (change === 0 || good === "none") return "neutral";
  return (change > 0) === (good === "up") ? "ok" : "warn";
}

/** Signed delta text for a unit: counts as % change, rates as percentage
 *  points, durations as time. Returns "±0" inside the noise floor. */
export function deltaText(current: number, baseline: number, unit: Unit): string {
  const change = current - baseline;
  if (unit === "pct") {
    const pt = change * 100;
    if (Math.abs(pt) < 0.05) return "±0";
    return `${pt > 0 ? "▲" : "▼"} ${Math.abs(pt).toFixed(1)}pt`;
  }
  if (unit === "duration") {
    if (Math.abs(change) < 1) return "±0";
    return `${change > 0 ? "▲" : "▼"} ${formatDuration(Math.abs(change))}`;
  }
  if (baseline === 0) return "—";
  const pct = (change / baseline) * 100;
  if (Math.abs(pct) < 0.5) return "±0%";
  return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
}

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-700",
  neutral: "text-neutral-400",
};

/* ------------------------------------------------------------------ *
 * Trading-day windows (XNYS). Holidays are excluded, so a 30D window is
 * ~21 points, not 30 — same rule as the Stage Trend Strip.
 * ------------------------------------------------------------------ */

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function windowStart(period: Period): string {
  if (period === "ytd") return `${AS_OF.slice(0, 4)}-01-01`;
  return addDays(AS_OF, period === "30d" ? -29 : -89);
}

const YTD_DAYS: string[] = (() => {
  const out: string[] = [];
  for (let d = windowStart("ytd"); d <= AS_OF; d = addDays(d, 1)) {
    if (!isMarketClosed("XNYS", d)) out.push(d);
  }
  return out;
})();

/* ------------------------------------------------------------------ *
 * Daily series for Sparkline Stats. Generated once for the year to date
 * from a seeded PRNG (stable across reloads), then sliced per period.
 * Today's value is pinned to the ops-strip headline.
 * ------------------------------------------------------------------ */

export type SeriesMetric = {
  id: string;
  label: string;
  /** Business object behind the number, shown under the value. */
  instance: string;
  unit: Unit;
  good: GoodDirection;
};

export type SeriesWindow = SeriesMetric & {
  dates: string[];
  values: number[];
  /** Mean of the window excluding today — what "vs avg" compares to. */
  avg: number;
  /** 10th–90th percentile of the window excluding today: the usual range. */
  usual: [number, number];
};

type SeriesShape = {
  start: number;
  end: number;
  /** Day-to-day noise as a fraction of level (or absolute, for pct). */
  noise: number;
  today: number;
  round?: (n: number) => number;
  clamp?: [number, number];
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(seed: number, shape: SeriesShape, unit: Unit): number[] {
  const rand = mulberry32(seed);
  const n = YTD_DAYS.length;
  return YTD_DAYS.map((date, i) => {
    if (i === n - 1) return shape.today;
    const level = shape.start + (shape.end - shape.start) * (i / (n - 1));
    // Sum of two uniforms ≈ triangular — softer tails than a single uniform.
    const jitter = rand() + rand() - 1;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const fridayDip = weekday === 5 ? 0.94 : 1;
    let v =
      unit === "pct"
        ? level + jitter * shape.noise
        : level * fridayDip * (1 + jitter * shape.noise);
    if (shape.clamp) v = Math.min(shape.clamp[1], Math.max(shape.clamp[0], v));
    return shape.round ? shape.round(v) : v;
  });
}

const SERIES: { metric: SeriesMetric; values: number[] }[] = [
  {
    metric: {
      id: "trades",
      label: "Trades booked",
      instance: "trades booked",
      unit: "count",
      good: "none",
    },
    values: generate(
      11,
      { start: 15200, end: 16900, noise: 0.07, today: 18432, round: Math.round },
      "count",
    ),
  },
  {
    metric: {
      id: "exceptions",
      label: "Exceptions",
      instance: "breached or overdue",
      unit: "count",
      good: "down",
    },
    values: generate(
      23,
      { start: 11, end: 8, noise: 0.45, today: 12, round: Math.round, clamp: [0, 99] },
      "count",
    ),
  },
  {
    metric: {
      id: "sla",
      label: "SLA on-time",
      instance: "of expected items",
      unit: "pct",
      good: "up",
    },
    values: generate(
      37,
      { start: 0.905, end: 0.944, noise: 0.014, today: 0.942, clamp: [0.8, 0.995] },
      "pct",
    ),
  },
  {
    metric: {
      id: "cycle",
      label: "Cycle time",
      instance: "median resolve",
      unit: "duration",
      good: "down",
    },
    values: generate(
      41,
      { start: 640, end: 505, noise: 0.12, today: 494, round: Math.round },
      "duration",
    ),
  },
];

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function seriesWindows(period: Period): SeriesWindow[] {
  const start = windowStart(period);
  const from = YTD_DAYS.findIndex((d) => d >= start);
  const dates = YTD_DAYS.slice(from);
  return SERIES.map(({ metric, values }) => {
    const slice = values.slice(from);
    const history = slice.slice(0, -1);
    const sorted = [...history].sort((a, b) => a - b);
    return {
      ...metric,
      dates,
      values: slice,
      avg: history.reduce((s, v) => s + v, 0) / history.length,
      usual: [percentile(sorted, 0.1), percentile(sorted, 0.9)],
    };
  });
}

/* ------------------------------------------------------------------ *
 * Target Stats fixtures — period rate vs the prior equal period, against
 * a fixed target. `domain` is the track's visible range; it is fixed per
 * metric so toggling the period moves the markers, not the scale.
 * ------------------------------------------------------------------ */

export type TargetMetric = {
  id: string;
  label: string;
  instance: string;
  unit: Unit;
  good: "up" | "down";
  target: number;
  domain: [number, number];
  current: number;
  prior: number;
};

type TargetFixture = Omit<TargetMetric, "current" | "prior"> & {
  values: Record<Period, { current: number; prior: number }>;
};

const TARGET_FIXTURES: TargetFixture[] = [
  {
    id: "sla",
    label: "SLA on-time",
    instance: "items completed on time",
    unit: "pct",
    good: "up",
    target: 0.95,
    domain: [0.85, 1],
    values: {
      "30d": { current: 0.942, prior: 0.918 },
      "90d": { current: 0.927, prior: 0.901 },
      ytd: { current: 0.914, prior: 0.896 },
    },
  },
  {
    id: "stp",
    label: "Straight-through",
    instance: "trades settled with no touch",
    unit: "pct",
    good: "up",
    target: 0.9,
    domain: [0.8, 1],
    values: {
      "30d": { current: 0.912, prior: 0.931 },
      "90d": { current: 0.921, prior: 0.928 },
      ytd: { current: 0.924, prior: 0.917 },
    },
  },
  {
    id: "match",
    label: "Rec auto-match",
    instance: "breaks cleared without review",
    unit: "pct",
    good: "up",
    target: 0.985,
    domain: [0.95, 1],
    values: {
      "30d": { current: 0.991, prior: 0.987 },
      "90d": { current: 0.989, prior: 0.983 },
      ytd: { current: 0.986, prior: 0.979 },
    },
  },
  {
    id: "cycle",
    label: "Cycle time",
    instance: "median issue to resolve",
    unit: "duration",
    good: "down",
    target: 600,
    domain: [0, 1200],
    values: {
      "30d": { current: 494, prior: 612 },
      "90d": { current: 580, prior: 640 },
      ytd: { current: 612, prior: 698 },
    },
  },
  {
    id: "aged",
    label: "Aged exceptions",
    instance: "open longer than 24h",
    unit: "count",
    good: "down",
    target: 2,
    domain: [0, 10],
    values: {
      "30d": { current: 4, prior: 3 },
      "90d": { current: 4, prior: 5 },
      ytd: { current: 5, prior: 6 },
    },
  },
];

export function targetMetrics(period: Period): TargetMetric[] {
  return TARGET_FIXTURES.map(({ values, ...rest }) => ({
    ...rest,
    ...values[period],
  }));
}

export function isMet(m: TargetMetric): boolean {
  return m.good === "up" ? m.current >= m.target : m.current <= m.target;
}

/** Where it is (met or not) × where it's heading (improving or not). */
export type TargetStatus = "on" | "slipping" | "recovering" | "off";

export function statusOf(m: TargetMetric): TargetStatus {
  const move = toneFor(m.current - m.prior, m.good);
  if (isMet(m)) return move === "warn" ? "slipping" : "on";
  return move === "ok" ? "recovering" : "off";
}

/* ------------------------------------------------------------------ *
 * Driver Stats fixtures — today's count vs the period's daily average,
 * split by the dimension that explains it. Totals are summed from the
 * drivers, never stored, so the breakdown always reconciles to the
 * headline. Only additive metrics belong here: a median or a rate does
 * not decompose into parts that sum.
 * ------------------------------------------------------------------ */

export type Driver = { name: string; today: number; avg: number };

export type DriverMetric = {
  id: string;
  label: string;
  instance: string;
  /** What the drivers are split by — "desk", "team", "source". */
  dimension: string;
  good: GoodDirection;
  drivers: Driver[];
};

type DriverFixture = Omit<DriverMetric, "drivers"> & {
  today: Record<string, number>;
  avg: Record<Period, Record<string, number>>;
};

const DRIVER_FIXTURES: DriverFixture[] = [
  {
    id: "trades",
    label: "Trades booked",
    instance: "trades booked",
    dimension: "desk",
    good: "none",
    today: {
      "Equities cash": 7210,
      "Fixed income": 4380,
      FX: 3905,
      "Listed derivatives": 1862,
      "OTC derivatives": 1075,
    },
    avg: {
      "30d": {
        "Equities cash": 6120,
        "Fixed income": 4510,
        FX: 3340,
        "Listed derivatives": 1640,
        "OTC derivatives": 840,
      },
      "90d": {
        "Equities cash": 6480,
        "Fixed income": 4620,
        FX: 3560,
        "Listed derivatives": 1610,
        "OTC derivatives": 850,
      },
      ytd: {
        "Equities cash": 6900,
        "Fixed income": 4700,
        FX: 3700,
        "Listed derivatives": 1720,
        "OTC derivatives": 870,
      },
    },
  },
  {
    id: "exceptions",
    label: "Exceptions",
    instance: "breached or overdue",
    dimension: "team",
    good: "down",
    today: {
      Custody: 5,
      "Fund admin": 3,
      "Transfer agency": 2,
      "Middle office": 1,
      Treasury: 1,
    },
    avg: {
      "30d": {
        Custody: 1.9,
        "Fund admin": 2.6,
        "Transfer agency": 1.4,
        "Middle office": 1.3,
        Treasury: 0.8,
      },
      "90d": {
        Custody: 2.3,
        "Fund admin": 2.8,
        "Transfer agency": 1.6,
        "Middle office": 1.4,
        Treasury: 0.9,
      },
      ytd: {
        Custody: 2.6,
        "Fund admin": 3.1,
        "Transfer agency": 1.8,
        "Middle office": 1.5,
        Treasury: 1,
      },
    },
  },
  {
    id: "late-files",
    label: "Late files",
    instance: "inbound past cut-off",
    dimension: "source",
    good: "down",
    today: {
      "State Street": 3,
      "BNY feed": 1,
      "Client uploads": 1,
      "Northern Trust": 0,
      Internal: 0,
    },
    avg: {
      "30d": {
        "State Street": 0.8,
        "BNY feed": 0.9,
        "Client uploads": 0.7,
        "Northern Trust": 0.4,
        Internal: 0.2,
      },
      "90d": {
        "State Street": 1,
        "BNY feed": 1,
        "Client uploads": 0.8,
        "Northern Trust": 0.4,
        Internal: 0.2,
      },
      ytd: {
        "State Street": 1.1,
        "BNY feed": 1,
        "Client uploads": 0.9,
        "Northern Trust": 0.4,
        Internal: 0.2,
      },
    },
  },
  {
    id: "breaks",
    label: "Breaks opened",
    instance: "new reconciliation breaks",
    dimension: "rec type",
    good: "down",
    today: { Cash: 9, Positions: 14, Trades: 11, "Corporate actions": 3 },
    avg: {
      "30d": { Cash: 12, Positions: 13, Trades: 15, "Corporate actions": 2 },
      "90d": { Cash: 13, Positions: 14, Trades: 16, "Corporate actions": 2 },
      ytd: { Cash: 13, Positions: 13, Trades: 16, "Corporate actions": 2 },
    },
  },
];

export function driverMetrics(period: Period): DriverMetric[] {
  return DRIVER_FIXTURES.map(({ today, avg, ...rest }) => ({
    ...rest,
    drivers: Object.keys(today).map((name) => ({
      name,
      today: today[name],
      avg: avg[period][name],
    })),
  }));
}

/** Sum a list, rounded to 1dp so float drift (1.9 + 2.6 + …) never shows. */
export function sum1dp(values: number[]): number {
  return Math.round(values.reduce((s, v) => s + v, 0) * 10) / 10;
}
