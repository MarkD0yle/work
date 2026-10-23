/* Reports inbox — data model and mock data.
 *
 * One idea runs through the whole screen: a *definition* is a thread and
 * each *run* is a message in it. A daily exception report is one thread
 * that gains a message every morning. A post-trade upload starts a thread
 * of one; re-running it adds to the same thread.
 *
 * Processing jobs (ingestion, recalcs) use the same thread/run shape so
 * the list behaves the same, but they live in their own view: they are
 * plumbing that reports depend on, not outputs people read. Each report
 * names the jobs it is built on (`inputs`), so a failed recalc can explain
 * a report that is waiting.
 */

import type { Tone } from "../patterns";

export type Kind = "analytics" | "exception" | "posttrade" | "regulatory" | "processing";

export type RunStatus = "succeeded" | "failed" | "running" | "queued" | "waiting";

export type Frequency = "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Every 15 min" | "On upload";

/** BestX analytical outputs a report feeds. */
export type Output = "Trend" | "Cost" | "Benchmark" | "RFQ";

export type Condition = { field: string; op: string; value: string };

export type Run = {
  id: string;
  /** ISO date-time, local. Sorting key. */
  at: string;
  status: RunStatus;
  trigger: "Schedule" | "Manual" | "Upload";
  by: string;
  duration?: string;
  /** One line of what happened — the "preview" text in the list. */
  summary: string;
  /** Exceptions found (exception reports). */
  exceptions?: number;
  unreviewed?: number;
  /** Trades in the run (post-trade, processing). */
  trades?: number;
  rejected?: number;
  /** Regulatory: whether the output went to its distribution list. */
  distributed?: boolean;
  /** Dates a manual run covered, e.g. "21 Oct" or "19–23 Oct". */
  period?: string;
};

export type Thread = {
  id: string;
  kind: Kind;
  name: string;
  description: string;
  frequency: Frequency;
  owner: string;
  recipients: string[];
  conditions?: Condition[];
  outputs?: Output[];
  /** Post-trade only. */
  file?: string;
  /** Regulatory only. */
  purpose?: string;
  /** Processing only: where the data comes from. */
  source?: string;
  /** Processing job ids this report is built on. */
  inputs?: string[];
  nextRun?: string;
  paused?: boolean;
  unread: boolean;
  /** Newest first. */
  runs: Run[];
};

export const ME = "Mark Doyle";
export const TODAY = "2026-10-23";

export const KIND_LABEL: Record<Kind, string> = {
  analytics: "Scheduled & analytics",
  exception: "Exceptions",
  posttrade: "Post-trade",
  regulatory: "Regulatory",
  processing: "Processing",
};

export const STATUS_LABEL: Record<RunStatus, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  running: "Running",
  queued: "Queued",
  waiting: "Waiting on input",
};

export const STATUS_TONE: Record<RunStatus, Tone> = {
  succeeded: "positive",
  failed: "negative",
  running: "info",
  queued: "neutral",
  waiting: "warning",
};

/** The one badge a run shows: its status, or — once it has succeeded —
 * what it found. A clean exception run is good news, so it says so. */
export function outcome(t: Thread, r: Run): { label: string; tone: Tone } {
  if (r.status !== "succeeded") return { label: STATUS_LABEL[r.status], tone: STATUS_TONE[r.status] };
  if (t.kind === "exception") {
    const n = r.exceptions ?? 0;
    return n === 0 ? { label: "Clean", tone: "positive" } : { label: `${n} exception${n === 1 ? "" : "s"}`, tone: "warning" };
  }
  if (t.kind === "regulatory") return r.distributed ? { label: "Distributed", tone: "positive" } : { label: "Draft", tone: "neutral" };
  if (t.kind === "posttrade" && (r.rejected ?? 0) > 0) return { label: `${r.rejected} rejected`, tone: "warning" };
  return { label: STATUS_LABEL.succeeded, tone: "positive" };
}

/** Something a person has to act on. Drives the "Needs attention" filter. */
export function needsAttention(t: Thread): boolean {
  const r = t.runs[0];
  if (!r) return false;
  if (r.status === "failed" || r.status === "waiting") return true;
  if (t.kind === "exception" && (r.unreviewed ?? 0) > 0) return true;
  if (t.kind === "regulatory" && r.status === "succeeded" && !r.distributed) return true;
  return false;
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parse(iso: string) {
  const [d, t = "00:00"] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return { date: new Date(y, m - 1, day), time: t.slice(0, 5), d };
}

/** "09:30" today, "Yesterday", "Wed 21 Oct", "3 Aug" further back. */
export function shortWhen(iso: string): string {
  const { date, time, d } = parse(iso);
  if (d === TODAY) return time;
  const diff = Math.round((parse(TODAY).date.getTime() - date.getTime()) / 86400000);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function longWhen(iso: string): string {
  const { date, time, d } = parse(iso);
  const day = d === TODAY ? "Today" : `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return `${day}, ${time}`;
}

/** "21 Oct", "19–23 Oct" or "28 Sep – 2 Oct" for yyyy-mm-dd dates. */
export function periodLabel(start: string, end: string): string {
  const a = parse(start).date;
  const b = parse(end).date;
  const dm = (x: Date) => `${x.getDate()} ${MONTHS[x.getMonth()]}`;
  if (start === end) return dm(a);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${dm(b)}`;
  return `${dm(a)} – ${dm(b)}`;
}

export function nowIso(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${TODAY}T${p(n.getHours())}:${p(n.getMinutes())}`;
}

/** Back-dated run dates for a frequency, newest first. Weekdays only. */
function schedule(freq: Frequency, time: string, count: number): string[] {
  const out: string[] = [];
  const d = parse(TODAY).date;
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}T${time}`;
  if (freq === "Monthly" || freq === "Quarterly") {
    const step = freq === "Monthly" ? 1 : 3;
    const start = freq === "Monthly" ? d.getMonth() : d.getMonth() - (d.getMonth() % 3);
    for (let i = 0; i < count; i++) out.push(iso(new Date(d.getFullYear(), start - i * step, 1)));
    return out;
  }
  const cur = new Date(d);
  if (freq === "Weekly") {
    while (cur.getDay() !== 1) cur.setDate(cur.getDate() - 1);
    for (let i = 0; i < count; i++) {
      out.push(iso(cur));
      cur.setDate(cur.getDate() - 7);
    }
    return out;
  }
  while (out.length < count) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) out.push(iso(cur));
    cur.setDate(cur.getDate() - 1);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Mock data
 * ------------------------------------------------------------------ */

type RunSeed = Partial<Run> & { status?: RunStatus };

function runs(id: string, freq: Frequency, time: string, base: Omit<Run, "id" | "at" | "status">, seeds: RunSeed[]): Run[] {
  const dates = schedule(freq, time, seeds.length);
  return seeds.map((s, i) => ({ ...base, status: "succeeded", ...s, id: `${id}-${i}`, at: s.at ?? dates[i] }));
}

const OPS = "Scheduler";

export const THREADS: Thread[] = [
  /* ---------------- Processing ---------------- */
  {
    id: "p-fix",
    kind: "processing",
    name: "Trade ingestion · FIX drop copy",
    description: "Streams executed trades from the OMS drop copy into BestX.",
    frequency: "Every 15 min",
    owner: "Data operations",
    recipients: [],
    source: "OMS drop copy (FIX 4.4)",
    unread: false,
    runs: runs("p-fix", "Daily", "09:45", { trigger: "Schedule", by: OPS, duration: "38s", summary: "Trades loaded." }, [
      { trades: 1204, summary: "1,204 trades loaded." },
      { at: "2026-10-23T09:30", trades: 1180, summary: "1,180 trades loaded." },
      { at: "2026-10-23T09:15", trades: 1093, summary: "1,093 trades loaded." },
      { at: "2026-10-23T09:00", trades: 1251, summary: "1,251 trades loaded." },
    ]),
  },
  {
    id: "p-sftp",
    kind: "processing",
    name: "Trade file ingestion · SFTP",
    description: "Picks up the overnight custodian trade files.",
    frequency: "Daily",
    owner: "Data operations",
    recipients: [],
    source: "Custodian SFTP",
    unread: false,
    runs: runs("p-sftp", "Daily", "05:30", { trigger: "Schedule", by: OPS, duration: "4m 10s", summary: "Files loaded." }, [
      { trades: 18204, summary: "3 files, 18,204 trades loaded." },
      { trades: 17652, summary: "3 files, 17,652 trades loaded." },
      { trades: 16980, rejected: 12, summary: "3 files loaded. 12 rows rejected: unknown counterparty." },
      { trades: 18011, summary: "3 files, 18,011 trades loaded." },
      { trades: 17330, summary: "3 files, 17,330 trades loaded." },
    ]),
  },
  {
    id: "p-csv",
    kind: "processing",
    name: "CSV upload parsing",
    description: "Validates and loads trade files uploaded for post-trade TCA.",
    frequency: "On upload",
    owner: "Data operations",
    recipients: [],
    source: "User uploads",
    unread: false,
    runs: [
      { id: "p-csv-0", at: "2026-10-23T08:40", status: "running", trigger: "Upload", by: "J. Patel", summary: "Parsing fx_forwards_oct.csv." },
      { id: "p-csv-1", at: "2026-10-22T14:20", status: "succeeded", trigger: "Upload", by: ME, duration: "1m 02s", trades: 12480, summary: "Q3_FX_trades_EM.csv: 12,480 trades loaded." },
      { id: "p-csv-2", at: "2026-10-22T09:05", status: "failed", trigger: "Upload", by: "J. Patel", duration: "22s", trades: 3214, rejected: 41, summary: "rates_blotter_2210.xlsx: 41 rows missing execution time." },
    ],
  },
  {
    id: "p-mkt",
    kind: "processing",
    name: "Market data load",
    description: "Loads tick and composite rates used for every benchmark.",
    frequency: "Daily",
    owner: "Data operations",
    recipients: [],
    source: "Market data vendor",
    unread: false,
    runs: runs("p-mkt", "Daily", "05:45", { trigger: "Schedule", by: OPS, duration: "9m 41s", summary: "Rates loaded for all pairs." }, [
      { status: "succeeded", summary: "Loaded. 3 pairs late: USDTRY, USDZAR, USDBRL." },
      {},
      {},
      {},
    ]),
  },
  {
    id: "p-recalc",
    kind: "processing",
    name: "TCA metrics recalc",
    description: "Recalculates spread, slippage and benchmark metrics for the day's trades.",
    frequency: "Daily",
    owner: "Data operations",
    recipients: [],
    source: "Trades + market data",
    unread: true,
    runs: runs("p-recalc", "Daily", "06:30", { trigger: "Schedule", by: OPS, duration: "14m 05s", summary: "All trades recalculated." }, [
      { status: "failed", duration: "30m 00s", summary: "Timed out waiting for market data for 3 currency pairs." },
      { trades: 17652, summary: "17,652 trades recalculated." },
      { trades: 16980, summary: "16,980 trades recalculated." },
      { trades: 18011, summary: "18,011 trades recalculated." },
      { status: "failed", duration: "30m 00s", summary: "Timed out waiting for market data." },
    ]),
  },

  /* ---------------- Scheduled & analytics ---------------- */
  {
    id: "a-cost",
    kind: "analytics",
    name: "Daily FX cost summary",
    description: "Cost by desk, counterparty and currency pair for yesterday's FX trades.",
    frequency: "Daily",
    owner: ME,
    recipients: ["fx-desk@firm.com", "head-of-trading@firm.com", "tca-team@firm.com"],
    outputs: ["Cost", "Trend"],
    inputs: ["p-sftp", "p-mkt", "p-recalc"],
    nextRun: "Mon 26 Oct, 07:00",
    unread: true,
    runs: runs("a-cost", "Daily", "07:00", { trigger: "Schedule", by: OPS, duration: "2m 18s", summary: "Sent to 3 recipients." }, [
      { status: "waiting", duration: undefined, summary: "Waiting for TCA metrics recalc to finish." },
      {},
      {},
      {},
      {},
      {},
    ]),
  },
  {
    id: "a-bench",
    kind: "analytics",
    name: "Weekly benchmark performance by LP",
    description: "Fill quality against arrival, mid and best quote for each liquidity provider.",
    frequency: "Weekly",
    owner: ME,
    recipients: ["tca-team@firm.com", "dealer-panel@firm.com"],
    outputs: ["Benchmark", "Trend"],
    inputs: ["p-sftp", "p-recalc"],
    nextRun: "Mon 26 Oct, 08:00",
    unread: false,
    runs: runs("a-bench", "Weekly", "08:00", { trigger: "Schedule", by: OPS, duration: "6m 40s", summary: "Sent to 2 recipients." }, [{}, {}, {}, {}]),
  },
  {
    id: "a-rfq",
    kind: "analytics",
    name: "Monthly RFQ hit-rate analysis",
    description: "Hit rate, cover and response time per dealer across RFQ venues.",
    frequency: "Monthly",
    owner: "A. Chen",
    recipients: ["dealer-panel@firm.com"],
    outputs: ["RFQ", "Benchmark"],
    inputs: ["p-sftp", "p-recalc"],
    nextRun: "Sun 1 Nov, 07:30",
    unread: false,
    runs: runs("a-rfq", "Monthly", "07:30", { trigger: "Schedule", by: OPS, duration: "11m 02s", summary: "Sent to 1 recipient." }, [{}, {}, {}]),
  },

  /* ---------------- Exceptions ---------------- */
  {
    id: "e-spread",
    kind: "exception",
    name: "Spread cost outliers",
    description: "FX trades priced outside the expected spread band.",
    frequency: "Daily",
    owner: ME,
    recipients: ["fx-desk@firm.com", "compliance@firm.com"],
    conditions: [
      { field: "Asset class", op: "=", value: "FX" },
      { field: "Total spread", op: ">", value: "10 bps" },
      { field: "Notional", op: ">", value: "50M USD" },
    ],
    inputs: ["p-fix", "p-recalc"],
    nextRun: "Mon 26 Oct, 08:00",
    unread: true,
    runs: runs("e-spread", "Daily", "08:00", { trigger: "Schedule", by: OPS, duration: "1m 12s", summary: "" }, [
      { exceptions: 42, unreviewed: 18, summary: "42 trades over 10 bps. 18 not yet reviewed." },
      { exceptions: 35, unreviewed: 0, summary: "35 trades over 10 bps. All reviewed." },
      { exceptions: 29, unreviewed: 0, summary: "29 trades over 10 bps. All reviewed." },
      { exceptions: 40, unreviewed: 0, summary: "40 trades over 10 bps. All reviewed." },
      { exceptions: 31, unreviewed: 0, summary: "31 trades over 10 bps. All reviewed." },
    ]),
  },
  {
    id: "e-exec",
    kind: "exception",
    name: "Execution threshold failures",
    description: "Fills worse than arrival by more than the policy threshold.",
    frequency: "Daily",
    owner: ME,
    recipients: ["compliance@firm.com"],
    conditions: [
      { field: "Perf vs arrival", op: "<", value: "−2 bps" },
      { field: "Order type", op: "=", value: "Market" },
    ],
    inputs: ["p-sftp", "p-recalc"],
    nextRun: "Mon 26 Oct, 08:15",
    unread: true,
    runs: runs("e-exec", "Daily", "08:15", { trigger: "Schedule", by: OPS, duration: "58s", summary: "" }, [
      { status: "waiting", summary: "Waiting for TCA metrics recalc to finish." },
      { exceptions: 6, unreviewed: 0, summary: "6 fills breached −2 bps. All reviewed." },
      { exceptions: 9, unreviewed: 0, summary: "9 fills breached −2 bps. All reviewed." },
      { exceptions: 4, unreviewed: 0, summary: "4 fills breached −2 bps. All reviewed." },
    ]),
  },
  {
    id: "e-dealer",
    kind: "exception",
    name: "Dealer performance exceptions",
    description: "Dealers whose hit rate or quote quality fell below the panel minimum.",
    frequency: "Weekly",
    owner: "A. Chen",
    recipients: ["dealer-panel@firm.com"],
    conditions: [
      { field: "Hit rate", op: "<", value: "20%" },
      { field: "Quotes", op: "≥", value: "50" },
    ],
    inputs: ["p-sftp", "p-recalc"],
    nextRun: "Mon 26 Oct, 09:00",
    unread: false,
    runs: runs("e-dealer", "Weekly", "09:00", { trigger: "Schedule", by: OPS, duration: "2m 03s", summary: "" }, [
      { exceptions: 3, unreviewed: 3, summary: "3 dealers under 20% hit rate." },
      { exceptions: 2, unreviewed: 0, summary: "2 dealers under 20% hit rate. Reviewed." },
      { exceptions: 2, unreviewed: 0, summary: "2 dealers under 20% hit rate. Reviewed." },
    ]),
  },
  {
    id: "e-policy",
    kind: "exception",
    name: "Policy violations",
    description: "Trades on unapproved venues, or directed trades without sign-off.",
    frequency: "Daily",
    owner: "Compliance",
    recipients: ["compliance@firm.com"],
    conditions: [
      { field: "Venue", op: "not in", value: "Approved list" },
      { field: "Directed", op: "=", value: "Yes, no approval" },
    ],
    inputs: ["p-fix", "p-sftp"],
    nextRun: "Mon 26 Oct, 08:30",
    unread: false,
    runs: runs("e-policy", "Daily", "08:30", { trigger: "Schedule", by: OPS, duration: "41s", summary: "" }, [
      { exceptions: 0, summary: "No violations found." },
      { exceptions: 1, unreviewed: 0, summary: "1 trade on an unapproved venue. Reviewed." },
      { exceptions: 0, summary: "No violations found." },
      { exceptions: 0, summary: "No violations found." },
    ]),
  },
  {
    id: "e-outlier",
    kind: "exception",
    name: "Price outliers",
    description: "Fills more than 3 standard deviations from the composite mid.",
    frequency: "Daily",
    owner: ME,
    recipients: ["tca-team@firm.com"],
    conditions: [{ field: "Deviation from mid", op: ">", value: "3σ" }],
    inputs: ["p-fix", "p-mkt"],
    nextRun: "Mon 26 Oct, 08:00",
    unread: false,
    runs: runs("e-outlier", "Daily", "08:00", { trigger: "Schedule", by: OPS, duration: "1m 30s", summary: "" }, [
      { exceptions: 7, unreviewed: 0, summary: "7 fills outside 3σ. All reviewed." },
      { exceptions: 5, unreviewed: 0, summary: "5 fills outside 3σ. All reviewed." },
      { exceptions: 11, unreviewed: 0, summary: "11 fills outside 3σ. All reviewed." },
    ]),
  },

  /* ---------------- Post-trade ---------------- */
  {
    id: "t-fwd",
    kind: "posttrade",
    name: "FX forwards · October",
    description: "Post-trade TCA on an uploaded trade file.",
    frequency: "On upload",
    owner: "J. Patel",
    recipients: [],
    file: "fx_forwards_oct.csv",
    outputs: ["Cost", "Benchmark"],
    inputs: ["p-csv", "p-mkt"],
    unread: true,
    runs: [{ id: "t-fwd-0", at: "2026-10-23T08:40", status: "running", trigger: "Upload", by: "J. Patel", summary: "Parsing file and matching to market data." }],
  },
  {
    id: "t-em",
    kind: "posttrade",
    name: "Q3 FX trades · EM",
    description: "Post-trade TCA on an uploaded trade file.",
    frequency: "On upload",
    owner: ME,
    recipients: [],
    file: "Q3_FX_trades_EM.csv",
    outputs: ["Cost", "Benchmark", "Trend"],
    inputs: ["p-csv", "p-mkt"],
    unread: false,
    runs: [
      { id: "t-em-0", at: "2026-10-22T16:05", status: "succeeded", trigger: "Manual", by: ME, duration: "3m 40s", trades: 12480, summary: "Re-run with updated EM benchmarks. 12,480 trades analysed." },
      { id: "t-em-1", at: "2026-10-22T14:20", status: "succeeded", trigger: "Upload", by: ME, duration: "3m 52s", trades: 12480, summary: "12,480 trades analysed." },
    ],
  },
  {
    id: "t-rates",
    kind: "posttrade",
    name: "Rates blotter · 22 Oct",
    description: "Post-trade TCA on an uploaded trade file.",
    frequency: "On upload",
    owner: "J. Patel",
    recipients: [],
    file: "rates_blotter_2210.xlsx",
    outputs: ["Cost"],
    inputs: ["p-csv"],
    unread: false,
    runs: [
      { id: "t-rates-0", at: "2026-10-22T09:05", status: "failed", trigger: "Upload", by: "J. Patel", duration: "22s", trades: 3214, rejected: 41, summary: "41 rows are missing an execution time. Fix the file and upload again." },
    ],
  },

  /* ---------------- Regulatory ---------------- */
  {
    id: "r-committee",
    kind: "regulatory",
    name: "Best execution committee pack",
    description: "Monthly evidence pack for the best execution committee.",
    frequency: "Monthly",
    owner: "Compliance",
    recipients: ["bex-committee@firm.com", "cco@firm.com", "head-of-trading@firm.com"],
    purpose: "Best execution monitoring",
    outputs: ["Cost", "Benchmark", "Trend"],
    inputs: ["p-sftp", "p-recalc"],
    nextRun: "Sun 1 Nov, 06:00",
    unread: true,
    runs: runs("r-committee", "Monthly", "06:00", { trigger: "Schedule", by: OPS, duration: "18m 12s", summary: "" }, [
      { distributed: false, summary: "Draft ready. Needs sign-off before it goes to 3 recipients." },
      { distributed: true, summary: "Signed off and sent to 3 recipients." },
      { distributed: true, summary: "Signed off and sent to 3 recipients." },
    ]),
  },
  {
    id: "r-venues",
    kind: "regulatory",
    name: "Top execution venues",
    description: "Venues and counterparties used, by volume and order count, per asset class.",
    frequency: "Quarterly",
    owner: "Compliance",
    recipients: ["cco@firm.com", "regulatory-reporting@firm.com"],
    purpose: "Regulatory disclosure",
    outputs: ["Benchmark"],
    inputs: ["p-sftp"],
    nextRun: "Fri 1 Jan, 06:00",
    unread: false,
    runs: runs("r-venues", "Quarterly", "06:00", { trigger: "Schedule", by: OPS, duration: "24m 50s", summary: "" }, [
      { distributed: true, summary: "Published and sent to 2 recipients." },
      { distributed: true, summary: "Published and sent to 2 recipients." },
    ]),
  },
  {
    id: "r-policy",
    kind: "regulatory",
    name: "Order execution policy monitoring",
    description: "Checks execution against each factor in the order execution policy.",
    frequency: "Quarterly",
    owner: "Compliance",
    recipients: ["cco@firm.com"],
    purpose: "Policy review",
    outputs: ["Cost", "Benchmark"],
    inputs: ["p-sftp", "p-recalc"],
    nextRun: "Fri 1 Jan, 06:30",
    paused: true,
    unread: false,
    runs: runs("r-policy", "Quarterly", "06:30", { trigger: "Schedule", by: OPS, duration: "12m 30s", summary: "" }, [
      { distributed: true, summary: "Sent to 1 recipient." },
      { distributed: true, summary: "Sent to 1 recipient." },
    ]),
  },
];
