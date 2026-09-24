/* AML Alert Operations: the alert-level dataset and every derived view.
 *
 * One seeded dataset of transaction-monitoring alerts, each carrying its own
 * lifecycle (L1 disposition → L2 decision → case → SAR) as day indices. The
 * page never stores a status: "open", "escalated in range" and the backlog on
 * any past Monday are all read off those dates against an as-of day, so the
 * funnel, the ageing chart and the queue cannot disagree.
 *
 * Day 0 is Tue 5 May 2026; AS_OF (day 139) is Mon 21 Sep 2026, the last
 * complete batch before "today" (Tue 22 Sep).
 */

export type Typology =
  | "Structuring"
  | "Rapid movement of funds"
  | "High-risk jurisdiction"
  | "Cash intensive"
  | "Trade-based ML"
  | "Mule activity";
export type Risk = "Low" | "Medium" | "High" | "PEP";
export type Line = "Retail" | "Business banking" | "Private bank" | "Correspondent";
export type Region = "UK" | "Europe" | "Middle East & Africa" | "Americas" | "Asia Pacific";

export const TYPOLOGIES: Typology[] = [
  "Structuring",
  "Rapid movement of funds",
  "High-risk jurisdiction",
  "Cash intensive",
  "Trade-based ML",
  "Mule activity",
];
export const RISKS: Risk[] = ["Low", "Medium", "High", "PEP"];
export const LINES: Line[] = ["Retail", "Business banking", "Private bank", "Correspondent"];
export const REGIONS: Region[] = ["UK", "Europe", "Middle East & Africa", "Americas", "Asia Pacific"];

/* ---------------------------------------------------------------- dates */

const DAY_MS = 86_400_000;
export const N_DAYS = 140;
export const AS_OF = N_DAYS - 1;
const AS_OF_UTC = Date.UTC(2026, 8, 21);
/** Far-future sentinel for "hasn't happened" (kept finite for arithmetic). */
export const NEVER = 1e6;

export const dayDate = (d: number) => new Date(AS_OF_UTC - (AS_OF - d) * DAY_MS);
export const dayOf = (y: number, m: number, d: number) =>
  AS_OF - Math.round((AS_OF_UTC - Date.UTC(y, m, d)) / DAY_MS);
const isWeekend = (d: number) => {
  const wd = dayDate(d).getUTCDay();
  return wd === 0 || wd === 6;
};
const nextBiz = (d: number) => {
  let x = d;
  while (isWeekend(x)) x++;
  return x;
};

const DF_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DF_LONG = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
/* Newer ICU spells September "Sept" in en-GB; the house style is "Sep". */
const sep = (s: string) => s.replace("Sept", "Sep").replace(",", "");
export const fmtDay = (d: number) => sep(DF_SHORT.format(dayDate(d)));
export const fmtDayLong = (d: number) => sep(DF_LONG.format(dayDate(d)));
export function fmtRange(from: number, to: number) {
  return `${fmtDay(from)} – ${fmtDay(to)} ${dayDate(to).getUTCFullYear()}`;
}

export type Preset = "7D" | "30D" | "90D" | "QTD";
export const PRESETS: Preset[] = ["7D", "30D", "90D", "QTD"];
export function windowStart(p: Preset) {
  if (p === "7D") return AS_OF - 6;
  if (p === "30D") return AS_OF - 29;
  if (p === "90D") return AS_OF - 89;
  return dayOf(2026, 6, 1); // Q3 opened Wed 1 Jul
}

/* ---------------------------------------------------------------- model */

export interface Scenario {
  code: string;
  name: string;
  typology: Typology;
  /** Share of alert volume (relative). */
  weight: number;
  /** Base L1→L2 escalation rate before the customer-risk multiplier. */
  esc: number;
  /** Mean model score of the alerts it raises. */
  score: number;
  lines: [Line, number][];
}

export const SCENARIOS: Scenario[] = [
  { code: "RMF-01", name: "Pass-through: in and out within 24h", typology: "Rapid movement of funds", weight: 17, esc: 0.034, score: 44, lines: [["Retail", 50], ["Business banking", 30], ["Private bank", 10], ["Correspondent", 10]] },
  { code: "HRJ-01", name: "Wires to or from high-risk jurisdictions", typology: "High-risk jurisdiction", weight: 15, esc: 0.016, score: 41, lines: [["Retail", 20], ["Business banking", 25], ["Private bank", 25], ["Correspondent", 30]] },
  { code: "CSH-01", name: "Cash turnover above customer profile", typology: "Cash intensive", weight: 13, esc: 0.036, score: 46, lines: [["Retail", 35], ["Business banking", 60], ["Private bank", 5]] },
  { code: "STR-01", name: "Repeated cash deposits just under £10k", typology: "Structuring", weight: 11, esc: 0.085, score: 55, lines: [["Retail", 60], ["Business banking", 35], ["Private bank", 5]] },
  { code: "MUL-01", name: "Many-to-one inbound credits", typology: "Mule activity", weight: 9, esc: 0.16, score: 63, lines: [["Retail", 85], ["Business banking", 15]] },
  { code: "RMF-02", name: "Dormant account reactivated then drained", typology: "Rapid movement of funds", weight: 7, esc: 0.095, score: 56, lines: [["Retail", 60], ["Business banking", 25], ["Private bank", 15]] },
  { code: "MUL-02", name: "New account fan-out to many payees", typology: "Mule activity", weight: 7, esc: 0.125, score: 60, lines: [["Retail", 85], ["Business banking", 15]] },
  { code: "CSH-02", name: "ATM withdrawal velocity", typology: "Cash intensive", weight: 6, esc: 0.06, score: 50, lines: [["Retail", 70], ["Business banking", 30]] },
  { code: "STR-02", name: "Cash split across branches", typology: "Structuring", weight: 4, esc: 0.18, score: 64, lines: [["Retail", 55], ["Business banking", 45]] },
  { code: "TBML-02", name: "Third-party payments against trade invoices", typology: "Trade-based ML", weight: 4, esc: 0.115, score: 58, lines: [["Business banking", 55], ["Correspondent", 45]] },
  { code: "HRJ-02", name: "Nested correspondent flows, high-risk corridor", typology: "High-risk jurisdiction", weight: 3, esc: 0.2, score: 66, lines: [["Business banking", 15], ["Private bank", 40], ["Correspondent", 45]] },
  { code: "TBML-01", name: "Invoice price outside market range", typology: "Trade-based ML", weight: 3, esc: 0.23, score: 67, lines: [["Business banking", 55], ["Correspondent", 45]] },
];
export const SCENARIO_BY_CODE = new Map(SCENARIOS.map((s) => [s.code, s]));

const RISK_BY_LINE: Record<Line, [Risk, number][]> = {
  Retail: [["Low", 55], ["Medium", 33], ["High", 10], ["PEP", 2]],
  "Business banking": [["Low", 35], ["Medium", 42], ["High", 20], ["PEP", 3]],
  "Private bank": [["Low", 15], ["Medium", 35], ["High", 30], ["PEP", 20]],
  Correspondent: [["Low", 5], ["Medium", 40], ["High", 55]],
};
const REGION_BY_LINE: Record<Line, [Region, number][]> = {
  Retail: [["UK", 86], ["Europe", 10], ["Middle East & Africa", 2], ["Asia Pacific", 2]],
  "Business banking": [["UK", 74], ["Europe", 15], ["Asia Pacific", 6], ["Americas", 5]],
  "Private bank": [["UK", 38], ["Europe", 20], ["Middle East & Africa", 22], ["Asia Pacific", 14], ["Americas", 6]],
  Correspondent: [["Middle East & Africa", 30], ["Asia Pacific", 28], ["Americas", 25], ["Europe", 17]],
};
/* Higher-risk customers escalate and convert more often, and are worked
 * faster because their SLA is shorter. */
const RISK_ESC: Record<Risk, number> = { Low: 0.5, Medium: 1, High: 1.9, PEP: 2.6 };
const RISK_CASE: Record<Risk, number> = { Low: 0.85, Medium: 1, High: 1.1, PEP: 1.15 };
const RISK_SAR: Record<Risk, number> = { Low: 0.8, Medium: 1, High: 1.12, PEP: 1.22 };
const RISK_SPEED: Record<Risk, number> = { Low: 1.1, Medium: 1, High: 0.65, PEP: 0.5 };

/** Calendar days from alert generation to disposition. */
export const SLA_DAYS: Record<Risk, number> = { Low: 30, Medium: 25, High: 15, PEP: 10 };
/** Extra allowance once an alert is with L2. */
export const L2_EXTRA_DAYS = 20;

export interface Investigator {
  id: string;
  name: string;
  initials: string;
  team: "L1" | "L2";
}
export const INVESTIGATORS: Investigator[] = [
  { id: "pn", name: "Priya Nair", initials: "PN", team: "L1" },
  { id: "th", name: "Tom Hale", initials: "TH", team: "L1" },
  { id: "id", name: "Ines Duarte", initials: "ID", team: "L1" },
  { id: "ka", name: "Kwame Asante", initials: "KA", team: "L1" },
  { id: "lb", name: "Leah Brennan", initials: "LB", team: "L1" },
  { id: "ms", name: "Marco Silva", initials: "MS", team: "L1" },
  { id: "ar", name: "Aisha Rahman", initials: "AR", team: "L1" },
  { id: "sl", name: "Sofia Lind", initials: "SL", team: "L2" },
  { id: "do", name: "Daniel Okoye", initials: "DO", team: "L2" },
  { id: "hc", name: "Hannah Cole", initials: "HC", team: "L2" },
];
export const INVESTIGATOR_BY_ID = new Map(INVESTIGATORS.map((i) => [i.id, i]));
const L1_POOL: [string, number][] = [["pn", 16], ["th", 15], ["id", 14], ["ka", 15], ["lb", 13], ["ms", 14], ["ar", 13]];
const L2_POOL: [string, number][] = [["sl", 36], ["do", 34], ["hc", 30]];

export interface Alert {
  id: string;
  created: number;
  scenario: string;
  typology: Typology;
  risk: Risk;
  line: Line;
  region: Region;
  customer: string;
  score: number;
  /** L1 disposition day (> AS_OF means still at L1). */
  l1At: number;
  escalated: boolean;
  /** L2 decision day (NEVER when not escalated). */
  l2At: number;
  caseOpened: boolean;
  /** SAR filed / case closed day (NEVER when no case). */
  outcomeAt: number;
  sar: boolean;
  /** Long-running L1 alert waiting on a request for information. */
  rfi: boolean;
  handleMins: number;
  assignee: string | null;
}

/* ---------------------------------------------------------------- generator */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

function normal(rng: () => number) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const expo = (rng: () => number, mean: number) => -Math.log(1 - rng()) * mean;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function generate(): Alert[] {
  const rng = mulberry32(0x5a2c_2609);
  /* Outcomes are dithered per scenario (an accumulator that fires each time
   * it crosses 1) rather than coin-flipped, so a scenario's realised SAR
   * yield tracks its true rate in any window instead of swinging on a
   * handful of events. The per-alert probability still carries risk. */
  const acc = {
    esc: new Map(SCENARIOS.map((s) => [s.code, rng()])),
    case: new Map(SCENARIOS.map((s) => [s.code, rng()])),
    sar: new Map(SCENARIOS.map((s) => [s.code, rng()])),
  };
  const fire = (m: Map<string, number>, code: string, p: number) => {
    let v = (m.get(code) ?? 0) + p;
    const hit = v >= 1;
    if (hit) v -= 1;
    m.set(code, v);
    return hit;
  };

  const thresholdChange = dayOf(2026, 7, 3); // RMF-01 threshold lowered, Mon 3 Aug
  const slowdown = dayOf(2026, 7, 17); // two L1 analysts seconded to a remediation project

  const alerts: Alert[] = [];
  let seq = 604_118;
  for (let d = 0; d <= AS_OF; d++) {
    const wd = dayDate(d).getUTCDay();
    const base = wd === 1 ? 27 : wd === 0 || wd === 6 ? 3 : 21;
    const weights = SCENARIOS.map(
      (s) => [s, s.weight * (s.code === "RMF-01" && d >= thresholdChange ? 1.6 : 1)] as const,
    );
    const totalW = weights.reduce((s, [, w]) => s + w, 0);
    const n = Math.round(base * (0.85 + rng() * 0.3) * (totalW / 100));
    const meanWait = d < slowdown ? 3.2 : Math.min(7.4, 3.2 + (d - slowdown) * 0.3);

    for (let i = 0; i < n; i++) {
      const sc = pick(rng, weights);
      const line = pick(rng, sc.lines);
      const risk = pick(rng, RISK_BY_LINE[line]);
      const region = pick(rng, REGION_BY_LINE[line]);
      const rfi = rng() < 0.055;
      const wait = rfi ? 16 + rng() * 42 : expo(rng, meanWait * RISK_SPEED[risk]);
      const l1At = nextBiz(d + Math.round(wait));

      const escalated = fire(acc.esc, sc.code, clamp(sc.esc * RISK_ESC[risk], 0, 0.9));
      let l2At = NEVER;
      let caseOpened = false;
      let outcomeAt = NEVER;
      let sar = false;
      if (escalated) {
        l2At = nextBiz(l1At + 3 + Math.round(expo(rng, 8)));
        caseOpened = fire(acc.case, sc.code, 0.52 * RISK_CASE[risk]);
        if (caseOpened) {
          outcomeAt = nextBiz(l2At + 6 + Math.round(expo(rng, 15)));
          sar = fire(acc.sar, sc.code, Math.min(0.92, 0.6 * RISK_SAR[risk]));
        }
      }

      const score = Math.round(
        clamp(sc.score + normal(rng) * 11 + (escalated ? 13 : 0) + (risk === "High" || risk === "PEP" ? 5 : 0), 4, 99),
      );
      const handleMins = Math.max(4, Math.round(Math.exp(Math.log(escalated ? 34 : 17) + normal(rng) * 0.5)));

      const age = AS_OF - d;
      let assignee: string | null;
      if (l1At > AS_OF) {
        assignee = rng() < (age <= 1 ? 0.55 : rfi ? 0.02 : 0.07) ? null : pick(rng, L1_POOL);
      } else if (escalated && l2At > AS_OF) {
        assignee = rng() < 0.1 ? null : pick(rng, L2_POOL);
      } else {
        assignee = pick(rng, escalated ? L2_POOL : L1_POOL);
      }

      const cust = String(1_000_000 + Math.floor(rng() * 9_000_000));
      alerts.push({
        id: `TM-${seq++}`,
        created: d,
        scenario: sc.code,
        typology: sc.typology,
        risk,
        line,
        region,
        customer: `C-${cust.slice(0, 2)}•••${cust.slice(-2)}`,
        score,
        l1At,
        escalated,
        l2At,
        caseOpened,
        outcomeAt,
        sar,
        rfi,
        handleMins,
        assignee,
      });
    }
  }
  return alerts;
}

export const BASE_ALERTS: Alert[] = generate();

/* ---------------------------------------------------------------- local actions */

export type Op = { kind: "assign"; to: string | null } | { kind: "fp" } | { kind: "escalate" };
export type OpLog = Record<string, Op[]>;

export function openStage(a: Alert): "L1" | "L2" | null {
  if (a.l1At > AS_OF) return "L1";
  if (a.escalated && a.l2At > AS_OF) return "L2";
  return null;
}

function applyOp(a: Alert, op: Op): Alert {
  if (op.kind === "assign") return { ...a, assignee: op.to };
  const stage = openStage(a);
  const closedOutcome = { caseOpened: false, outcomeAt: NEVER, sar: false };
  if (stage === "L1") {
    return op.kind === "fp"
      ? { ...a, ...closedOutcome, l1At: AS_OF, escalated: false, l2At: NEVER, handleMins: 14 }
      : { ...a, ...closedOutcome, l1At: AS_OF, escalated: true, l2At: NEVER, assignee: null };
  }
  if (stage === "L2") {
    return op.kind === "fp"
      ? { ...a, ...closedOutcome, l2At: AS_OF }
      : { ...a, ...closedOutcome, l2At: AS_OF, caseOpened: true };
  }
  return a;
}

/** Replays the session's bulk actions (stamped on the as-of day) over the base data. */
export function applyOps(base: Alert[], log: OpLog): Alert[] {
  if (Object.keys(log).length === 0) return base;
  return base.map((a) => {
    const ops = log[a.id];
    return ops ? ops.reduce(applyOp, a) : a;
  });
}

/* ---------------------------------------------------------------- filters */

export type DimKey = "typology" | "risk" | "line" | "region" | "scenario";
export type Filters = Partial<Record<DimKey, string[]>>;

export const DIMENSIONS: { key: DimKey; label: string; short: string; values: string[] }[] = [
  { key: "typology", label: "Typology", short: "Typology", values: TYPOLOGIES },
  { key: "risk", label: "Customer risk rating", short: "Risk rating", values: RISKS },
  { key: "line", label: "Business line", short: "Business line", values: LINES },
  { key: "region", label: "Region", short: "Region", values: REGIONS },
  { key: "scenario", label: "Scenario", short: "Scenario", values: SCENARIOS.map((s) => s.code) },
];

export function matches(a: Alert, f: Filters, except?: DimKey) {
  for (const { key } of DIMENSIONS) {
    if (key === except) continue;
    const vals = f[key];
    if (vals && vals.length > 0 && !vals.includes(a[key])) return false;
  }
  return true;
}

/* ---------------------------------------------------------------- derived views */

const inWin = (d: number, from: number, to: number) => d >= from && d <= to;

function median(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface Flow {
  generated: number;
  l1Reviewed: number;
  fpClosed: number;
  escalated: number;
  l2ClosedNoCase: number;
  casesOpened: number;
  casesClosedNoSar: number;
  sars: number;
  bizDays: number;
  medianHandleMins: number | null;
  medianSarLag: number | null;
}

/** Event counts in [from, to]: each stage counts what happened in the window. */
export function flow(alerts: Alert[], from: number, to: number): Flow {
  const f: Flow = {
    generated: 0,
    l1Reviewed: 0,
    fpClosed: 0,
    escalated: 0,
    l2ClosedNoCase: 0,
    casesOpened: 0,
    casesClosedNoSar: 0,
    sars: 0,
    bizDays: 0,
    medianHandleMins: null,
    medianSarLag: null,
  };
  const handle: number[] = [];
  const lag: number[] = [];
  for (const a of alerts) {
    if (inWin(a.created, from, to)) f.generated++;
    if (inWin(a.l1At, from, to)) {
      f.l1Reviewed++;
      handle.push(a.handleMins);
      if (a.escalated) f.escalated++;
      else f.fpClosed++;
    }
    if (a.escalated && inWin(a.l2At, from, to)) {
      if (a.caseOpened) f.casesOpened++;
      else f.l2ClosedNoCase++;
    }
    if (a.caseOpened && inWin(a.outcomeAt, from, to)) {
      if (a.sar) {
        f.sars++;
        lag.push(a.outcomeAt - a.created);
      } else f.casesClosedNoSar++;
    }
  }
  for (let d = from; d <= to; d++) if (!isWeekend(d)) f.bizDays++;
  f.medianHandleMins = median(handle);
  f.medianSarLag = median(lag);
  return f;
}

const exitAt = (a: Alert) => (a.escalated ? a.l2At : a.l1At);
export const isOpenAt = (a: Alert, t: number) => a.created <= t && exitAt(a) > t;

export const AGE_BANDS = [
  { key: "0-5", label: "0–5d", max: 5, color: "#c4b5fd" },
  { key: "6-15", label: "6–15d", max: 15, color: "#8b5cf6" },
  { key: "16-30", label: "16–30d", max: 30, color: "#6d28d9" },
  { key: "30+", label: "30d+", max: Infinity, color: "#4c1d95" },
] as const;
const bandIndex = (age: number) => AGE_BANDS.findIndex((b) => age <= b.max);

export interface AgeingWeek {
  t: number;
  label: string;
  bands: number[];
  total: number;
}

/** Open backlog by age band at each of the last 12 Monday snapshots. */
export function ageingWeekly(alerts: Alert[]): AgeingWeek[] {
  const weeks: AgeingWeek[] = [];
  for (let k = 11; k >= 0; k--) {
    const t = AS_OF - 7 * k;
    const bands = [0, 0, 0, 0];
    for (const a of alerts) if (isOpenAt(a, t)) bands[bandIndex(t - a.created)]++;
    weeks.push({ t, label: fmtDay(t), bands, total: bands.reduce((s, v) => s + v, 0) });
  }
  return weeks;
}

export const backlogAt = (alerts: Alert[], t: number) => alerts.reduce((n, a) => n + (isOpenAt(a, t) ? 1 : 0), 0);

/** Backlog target: eight calendar days of intake at the trailing 12-week rate. */
export function backlogTarget(alerts: Alert[]) {
  const from = AS_OF - 83;
  const n = alerts.reduce((s, a) => s + (inWin(a.created, from, AS_OF) ? 1 : 0), 0);
  return Math.round((n / 84) * 8);
}

export type StageLabel = "New" | "L1 review" | "Awaiting RFI" | "L2 review";
export const STAGE_ORDER: StageLabel[] = ["New", "L1 review", "Awaiting RFI", "L2 review"];

export interface QueueRow {
  alert: Alert;
  age: number;
  stage: StageLabel;
  sla: number;
  /** Days of SLA left; negative once breached. */
  left: number;
}

export function queueRows(alerts: Alert[]): QueueRow[] {
  const rows: QueueRow[] = [];
  for (const a of alerts) {
    const st = openStage(a);
    if (!st) continue;
    const age = AS_OF - a.created;
    const stage: StageLabel =
      st === "L2" ? "L2 review" : !a.assignee ? "New" : a.rfi && age >= 4 ? "Awaiting RFI" : "L1 review";
    const sla = SLA_DAYS[a.risk] + (st === "L2" ? L2_EXTRA_DAYS : 0);
    rows.push({ alert: a, age, stage, sla, left: sla - age });
  }
  return rows;
}

export interface ScenarioPoint {
  code: string;
  name: string;
  typology: Typology;
  volume: number;
  sars: number;
  conv: number;
}

/** Per scenario: alerts generated in the window and SARs filed in it. */
export function scenarioProductivity(alerts: Alert[], from: number, to: number): ScenarioPoint[] {
  const m = new Map(SCENARIOS.map((s) => [s.code, { volume: 0, sars: 0 }]));
  for (const a of alerts) {
    const r = m.get(a.scenario)!;
    if (inWin(a.created, from, to)) r.volume++;
    if (a.sar && inWin(a.outcomeAt, from, to)) r.sars++;
  }
  return SCENARIOS.flatMap((s) => {
    const r = m.get(s.code)!;
    return r.volume > 0
      ? [{ code: s.code, name: s.name, typology: s.typology, volume: r.volume, sars: r.sars, conv: (r.sars / r.volume) * 100 }]
      : [];
  });
}

export { median };
