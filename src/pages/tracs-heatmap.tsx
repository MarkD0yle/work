import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export const title = "TRACS Heat Map";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * TRACS — Monitor Health Heat Map
 *
 * "Think outside the box" reframe of the TRACS TODAY monitoring board.
 * The source dashboard is a flat table of monitors + last-refresh
 * timestamps and two descending bar charts. That answers "did it run?"
 * but hides "WHEN did it go wrong, and is it spreading?".
 *
 * This view turns the same data on its side: a monitors x time-of-day
 * matrix where every cell is one scheduled refresh, coloured by health.
 * Patterns the table can't show jump out — a bad 16:00 column, a row
 * that degrades all afternoon, an EOD failure cascading into the feeds.
 *
 * Design rule inherited from the Heat Map page:
 *   HEALTHY = NEUTRAL GREY, NOT GREEN. Calm is the default.
 *   The operator's eye is only ever pulled to amber and red.
 *
 * Tailwind stands in for SSDS here; swap the palette for SSDS tokens
 * when porting. No chart lib — CSS grid + CSS bars only.
 * ------------------------------------------------------------------ */

/* ---------- Time window ---------- */

const START_HOUR = 6;
const END_HOUR = 21; // inclusive
const HOURS: number[] = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);

/* ---------- Data model ---------- */

type Cadence = "hourly" | "2h" | "4h" | "eod" | "sod";

type RunStatus =
  | "ok" // refreshed within SLA — calm grey
  | "slow" // refreshed but over soft SLA — amber
  | "late" // refreshed well past SLA — strong amber
  | "failed" // run errored / no data — red
  | "stale" // expected refresh never landed — striped red
  | "pending" // scheduled, in the future — dashed
  | "norun" // not scheduled this slot — blank
  | "holiday"; // market closed — striped grey

type Incident = {
  status: Extract<RunStatus, "slow" | "late" | "failed" | "stale">;
  latencyMin?: number;
  note: string;
};

type Monitor = {
  id: string;
  name: string;
  group: string;
  cadence: Cadence;
  /** for eod/sod cadences: the single hour it runs */
  anchorHour?: number;
  slaMin: number; // soft SLA for a refresh
  owner: string;
  region: string;
  baseVolume: number; // typical records per run
  isHoliday?: boolean;
  /** hand-authored hotspots, keyed by slot hour */
  incidents?: Record<number, Incident>;
};

/* ---------- Monitor fixtures (the "TRACS TODAY" board, reimagined) ----------
 *
 * A handful of authored incidents create a legible story for "today":
 *   - Pricing EOD Snap fails at 16:00 (vendor timeout) — the headline.
 *   - Reg Reporting Feed then fails at 18:00 — the cascade downstream.
 *   - Custodian Break degrades all afternoon — the slow burn.
 *   - Holiday Calendar never refreshed at SOD — the silent staleness.
 * Everything else is calm with the odd amber, generated deterministically.
 */

const MONITORS: Monitor[] = [
  // ---- TRACS Core ----
  { id: "tc-trade", name: "Trade Capture", group: "TRACS Core", cadence: "hourly", slaMin: 5, owner: "Core Ops", region: "London", baseVolume: 4200 },
  { id: "tc-posn", name: "Position Keeping", group: "TRACS Core", cadence: "hourly", slaMin: 6, owner: "Core Ops", region: "London", baseVolume: 3100 },
  { id: "tc-life", name: "Lifecycle Events", group: "TRACS Core", cadence: "2h", slaMin: 10, owner: "Core Ops", region: "London", baseVolume: 860 },
  {
    id: "tc-settle", name: "Settlement Ladder", group: "TRACS Core", cadence: "hourly", slaMin: 8, owner: "Settlements", region: "London", baseVolume: 1500,
    incidents: { 9: { status: "slow", latencyMin: 11, note: "SWIFT batch backed up behind overnight queue." } },
  },

  // ---- Reconciliation ----
  {
    id: "rc-cash", name: "Cash Recon", group: "Reconciliation", cadence: "2h", slaMin: 12, owner: "Recon Team", region: "London", baseVolume: 2400,
    incidents: { 12: { status: "late", latencyMin: 22, note: "Custodian statement arrived 20m late; recon re-queued." } },
  },
  { id: "rc-stock", name: "Stock Recon", group: "Reconciliation", cadence: "2h", slaMin: 12, owner: "Recon Team", region: "London", baseVolume: 1900 },
  {
    id: "rc-cust", name: "Custodian Break", group: "Reconciliation", cadence: "hourly", slaMin: 10, owner: "Recon Team", region: "London", baseVolume: 320,
    incidents: {
      14: { status: "slow", latencyMin: 13, note: "Break count rising — 40 unmatched." },
      15: { status: "late", latencyMin: 24, note: "Break count 120 unmatched; chasing custodian." },
      16: { status: "failed", note: "Recon engine timed out — 300+ unmatched, escalated to Ops lead." },
      17: { status: "late", latencyMin: 28, note: "Partial recovery after restart; backlog clearing." },
    },
  },
  { id: "rc-nostro", name: "Nostro Recon", group: "Reconciliation", cadence: "4h", slaMin: 15, owner: "Treasury Ops", region: "NY", baseVolume: 540 },

  // ---- Pricing & Valuation ----
  { id: "pv-intra", name: "Intraday Price Snap", group: "Pricing & Valuation", cadence: "hourly", slaMin: 4, owner: "Valuations", region: "London", baseVolume: 9800 },
  {
    id: "pv-eod", name: "EOD Price Snap", group: "Pricing & Valuation", cadence: "eod", anchorHour: 16, slaMin: 8, owner: "Valuations", region: "London", baseVolume: 12500,
    incidents: { 16: { status: "failed", note: "Vendor feed timeout — EOD snap did not complete. Manual snap initiated." } },
  },
  { id: "pv-fx", name: "FX Rates", group: "Pricing & Valuation", cadence: "hourly", slaMin: 3, owner: "Valuations", region: "London", baseVolume: 640 },
  { id: "pv-curve", name: "Curve Build", group: "Pricing & Valuation", cadence: "4h", slaMin: 12, owner: "Quant Ops", region: "London", baseVolume: 210 },

  // ---- Reference Data ----
  { id: "rd-sec", name: "Security Master", group: "Reference Data", cadence: "sod", anchorHour: 6, slaMin: 20, owner: "Ref Data", region: "London", baseVolume: 58000 },
  { id: "rd-cpty", name: "Counterparty Master", group: "Reference Data", cadence: "sod", anchorHour: 6, slaMin: 20, owner: "Ref Data", region: "London", baseVolume: 7300 },
  {
    id: "rd-cal", name: "Holiday Calendar", group: "Reference Data", cadence: "sod", anchorHour: 6, slaMin: 20, owner: "Ref Data", region: "London", baseVolume: 1,
    incidents: { 6: { status: "stale", note: "SOD refresh never landed — calendar 1 day stale. Downstream cutoffs at risk." } },
  },
  { id: "rd-ca", name: "Corporate Actions", group: "Reference Data", cadence: "2h", slaMin: 15, owner: "Ref Data", region: "London", baseVolume: 430 },

  // ---- Reporting & Feeds ----
  {
    id: "rf-reg", name: "Reg Reporting Feed", group: "Reporting & Feeds", cadence: "eod", anchorHour: 18, slaMin: 10, owner: "Reg Ops", region: "London", baseVolume: 8800,
    incidents: { 18: { status: "failed", note: "Upstream EOD prices missing (see Pricing 16:00). Feed cannot build — regulatory deadline 21:00." } },
  },
  { id: "rf-client", name: "Client Extract", group: "Reporting & Feeds", cadence: "eod", anchorHour: 17, slaMin: 12, owner: "Client Svc", region: "Lux", baseVolume: 5400, isHoliday: true },
  { id: "rf-risk", name: "Risk Cube", group: "Reporting & Feeds", cadence: "4h", slaMin: 18, owner: "Risk Eng", region: "NY", baseVolume: 3200 },
  { id: "rf-lake", name: "Data Lake Load", group: "Reporting & Feeds", cadence: "2h", slaMin: 20, owner: "Data Eng", region: "NY", baseVolume: 41000 },
];

const GROUP_ORDER = [
  "TRACS Core",
  "Reconciliation",
  "Pricing & Valuation",
  "Reference Data",
  "Reporting & Feeds",
];

/* ---------- Helpers ---------- */

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Stable FNV-1a hash → [0, 1). Same monitor+slot always yields the same run. */
function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function isScheduled(m: Monitor, hour: number): boolean {
  switch (m.cadence) {
    case "hourly":
      return true;
    case "2h":
      return hour % 2 === 0;
    case "4h":
      return [6, 10, 14, 18].includes(hour);
    case "eod":
    case "sod":
      return hour === m.anchorHour;
  }
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function fmtClock(ts: number | null): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- Run derivation ---------- */

type Run = {
  monitorId: string;
  hour: number;
  status: RunStatus;
  latencyMin: number | null; // minutes over SLA; <=0 = on time
  refreshedAt: number | null;
  records: number;
  note: string | null;
};

function deriveRun(
  m: Monitor,
  hour: number,
  playheadHour: number,
  dayStart: number,
): Run {
  const slotTs = dayStart + hour * 3_600_000;
  const base: Omit<Run, "status" | "latencyMin" | "refreshedAt" | "records" | "note"> = {
    monitorId: m.id,
    hour,
  };

  if (m.isHoliday) {
    return { ...base, status: "holiday", latencyMin: null, refreshedAt: null, records: 0, note: "Region on holiday — no processing today." };
  }
  if (!isScheduled(m, hour)) {
    return { ...base, status: "norun", latencyMin: null, refreshedAt: null, records: 0, note: null };
  }
  if (hour > playheadHour) {
    return { ...base, status: "pending", latencyMin: null, refreshedAt: null, records: 0, note: null };
  }

  const r = hash01(`${m.id}:${hour}`);
  const r2 = hash01(`v:${m.id}:${hour}`);
  const records = Math.round(m.baseVolume * (0.6 + r2 * 0.7));

  const inc = m.incidents?.[hour];
  if (inc) {
    if (inc.status === "failed" || inc.status === "stale") {
      return {
        ...base,
        status: inc.status,
        latencyMin: null,
        refreshedAt: inc.status === "failed" ? null : null,
        records: inc.status === "failed" ? Math.round(records * 0.3) : 0,
        note: inc.note,
      };
    }
    const lat = inc.latencyMin ?? m.slaMin + 8;
    return {
      ...base,
      status: inc.status,
      latencyMin: lat,
      refreshedAt: slotTs + (m.slaMin + lat) * 60_000,
      records,
      note: inc.note,
    };
  }

  // Baseline: mostly calm, occasional amber. No random hard failures —
  // those are authored so the day reads as a coherent story.
  let status: RunStatus;
  let latencyMin: number;
  if (r < 0.84) {
    status = "ok";
    latencyMin = Math.round(-2 + r * 4); // a touch early to a touch over
  } else if (r < 0.95) {
    status = "slow";
    latencyMin = Math.round(m.slaMin + 2 + r2 * 8);
  } else {
    status = "late";
    latencyMin = Math.round(m.slaMin + 12 + r2 * 14);
  }
  return {
    ...base,
    status,
    latencyMin,
    refreshedAt: slotTs + Math.max(0, m.slaMin + latencyMin) * 60_000,
    records,
    note: null,
  };
}

/* ---------- Severity ranking ---------- */

const SEV_RANK: Record<RunStatus, number> = {
  failed: 5,
  stale: 4,
  late: 3,
  slow: 2,
  ok: 1,
  pending: 0,
  norun: 0,
  holiday: 0,
};

const isIssue = (s: RunStatus) =>
  s === "slow" || s === "late" || s === "failed" || s === "stale";

/* ---------- Cell appearance (the colour inversion lives here) ---------- */

function statusCell(status: RunStatus): {
  cls: string;
  style?: React.CSSProperties;
  glyph?: string;
} {
  switch (status) {
    case "ok":
      return { cls: "bg-neutral-200" }; // calm — NOT green
    case "slow":
      return { cls: "bg-amber-200" };
    case "late":
      return { cls: "bg-amber-400" };
    case "failed":
      return { cls: "bg-red-500 text-white", glyph: "×" };
    case "stale":
      return {
        cls: "bg-red-100 text-red-700",
        glyph: "!",
        style: {
          backgroundImage:
            "repeating-linear-gradient(45deg, rgb(248 113 113 / 0.55) 0, rgb(248 113 113 / 0.55) 2px, transparent 2px, transparent 5px)",
        },
      };
    case "holiday":
      return {
        cls: "bg-neutral-50 text-neutral-300",
        style: {
          backgroundImage:
            "repeating-linear-gradient(45deg, rgb(212 212 212 / 0.6) 0, rgb(212 212 212 / 0.6) 2px, transparent 2px, transparent 5px)",
        },
      };
    case "pending":
      return { cls: "border border-dashed border-neutral-200 bg-white" };
    case "norun":
      return { cls: "bg-neutral-50/60" };
  }
}

/** Latency mode: a sequential ramp. On-time stays calm grey, heat builds. */
function latencyCell(run: Run): {
  cls: string;
  style?: React.CSSProperties;
  glyph?: string;
} {
  if (run.status === "failed") return { cls: "bg-red-600 text-white", glyph: "×" };
  if (run.status === "stale") return statusCell("stale");
  if (run.status === "holiday") return statusCell("holiday");
  if (run.status === "pending") return statusCell("pending");
  if (run.status === "norun") return statusCell("norun");
  const lat = run.latencyMin ?? 0;
  if (lat <= 0) return { cls: "bg-neutral-200" };
  if (lat <= 5) return { cls: "bg-neutral-300" };
  if (lat <= 12) return { cls: "bg-amber-200" };
  if (lat <= 20) return { cls: "bg-amber-400 text-amber-950" };
  if (lat <= 35) return { cls: "bg-orange-500 text-white" };
  return { cls: "bg-red-500 text-white" };
}

const STATUS_LABEL: Record<RunStatus, string> = {
  ok: "On time",
  slow: "Slow",
  late: "Late",
  failed: "Failed",
  stale: "Stale — no refresh",
  pending: "Scheduled",
  norun: "Not scheduled",
  holiday: "Holiday",
};

/* ---------- Small atoms ---------- */

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "warning" | "error" | "muted" | "ok";
}) {
  const tones: Record<string, string> = {
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-500",
    info: "border-blue-300 bg-blue-50 text-blue-700",
    warning: "border-amber-300 bg-amber-50 text-amber-800",
    error: "border-red-300 bg-red-50 text-red-700",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

type SelectedCell = { monitorId: string; hour: number } | null;
type ModeKey = "status" | "latency";
type RowFilter = "all" | "issues";

export default function TracsHeatMap() {
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<ModeKey>("status");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string | "all">("all");
  const [selected, setSelected] = useState<SelectedCell>(null);
  const [hover, setHover] = useState<{ row: string | null; col: number | null }>({
    row: null,
    col: null,
  });

  // Live clock — drives the playhead. 1s for a lively demo.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const dayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const realHour = new Date(now).getHours();
  // Clamp the playhead into the window so there's always a meaningful
  // amount of history to look at, whatever the wall-clock time.
  const playheadHour = clamp(realHour, START_HOUR + 2, END_HOUR);
  const minuteFrac = new Date(now).getMinutes() / 60;

  // All runs for the day, derived deterministically.
  const runs = useMemo(() => {
    const map = new Map<string, Run>();
    for (const m of MONITORS) {
      for (const h of HOURS) {
        map.set(`${m.id}:${h}`, deriveRun(m, h, playheadHour, dayStart));
      }
    }
    return map;
  }, [playheadHour, dayStart]);

  const runOf = useCallback(
    (monitorId: string, hour: number) => runs.get(`${monitorId}:${hour}`)!,
    [runs],
  );

  // Per-monitor rollups (reliability, lost minutes, volume, worst status).
  const monitorStats = useMemo(() => {
    const out = new Map<
      string,
      {
        reliability: number | null;
        worst: RunStatus;
        lostMin: number;
        volume: number;
        scheduledPast: number;
        okCount: number;
      }
    >();
    for (const m of MONITORS) {
      let scheduledPast = 0;
      let okCount = 0;
      let lostMin = 0;
      let volume = 0;
      let worst: RunStatus = "ok";
      for (const h of HOURS) {
        const run = runOf(m.id, h);
        if (run.status === "pending" || run.status === "norun") continue;
        if (run.status === "holiday") {
          worst = SEV_RANK[worst] >= SEV_RANK.holiday ? worst : "holiday";
          continue;
        }
        scheduledPast++;
        volume += run.records;
        if (run.status === "ok") okCount++;
        if (SEV_RANK[run.status] > SEV_RANK[worst]) worst = run.status;
        if (run.status === "failed") lostMin += 60;
        else if (run.status === "stale") lostMin += 45;
        else if (run.latencyMin && run.latencyMin > 0) lostMin += run.latencyMin;
      }
      out.set(m.id, {
        reliability: scheduledPast ? okCount / scheduledPast : null,
        worst,
        lostMin,
        volume,
        scheduledPast,
        okCount,
      });
    }
    return out;
  }, [runOf]);

  // Per-slot column health.
  const slotHealth = useMemo(() => {
    return HOURS.map((h) => {
      let issues = 0;
      let failed = 0;
      let active = 0;
      for (const m of MONITORS) {
        const run = runOf(m.id, h);
        if (run.status === "pending" || run.status === "norun" || run.status === "holiday")
          continue;
        active++;
        if (run.status === "failed" || run.status === "stale") failed++;
        if (isIssue(run.status)) issues++;
      }
      return { hour: h, issues, failed, active };
    });
  }, [runOf]);

  // Filtered, grouped rows for the matrix.
  const groupedRows = useMemo(() => {
    const groups: { group: string; monitors: Monitor[] }[] = [];
    for (const g of GROUP_ORDER) {
      if (groupFilter !== "all" && groupFilter !== g) continue;
      let monitors = MONITORS.filter((m) => m.group === g);
      if (rowFilter === "issues") {
        monitors = monitors.filter((m) => isIssue(monitorStats.get(m.id)!.worst));
      }
      if (monitors.length) groups.push({ group: g, monitors });
    }
    return groups;
  }, [groupFilter, rowFilter, monitorStats]);

  const visibleCount = groupedRows.reduce((n, g) => n + g.monitors.length, 0);

  // Headline counts + summary sentence.
  const counts = useMemo(() => {
    let failed = 0;
    let degraded = 0;
    let healthy = 0;
    let holiday = 0;
    for (const m of MONITORS) {
      const w = monitorStats.get(m.id)!.worst;
      if (w === "failed" || w === "stale") failed++;
      else if (w === "slow" || w === "late") degraded++;
      else if (w === "holiday") holiday++;
      else healthy++;
    }
    return { failed, degraded, healthy, holiday, total: MONITORS.length };
  }, [monitorStats]);

  const summary = useMemo(() => {
    const worstSlot = [...slotHealth].sort((a, b) => b.issues - a.issues)[0];
    if (counts.failed > 0) {
      const failing = MONITORS.filter((m) => {
        const w = monitorStats.get(m.id)!.worst;
        return w === "failed" || w === "stale";
      });
      const lead = failing[0];
      return `${counts.failed} monitor${counts.failed > 1 ? "s" : ""} failing, ${counts.degraded} degraded. Worst hour: ${hourLabel(worstSlot.hour)} (${worstSlot.issues} issues). Lead: ${lead.name}.`;
    }
    if (counts.degraded > 0) {
      return `All monitors running. ${counts.degraded} degraded — busiest hour ${hourLabel(worstSlot.hour)}.`;
    }
    return `All ${counts.total} monitors healthy. Calm board.`;
  }, [counts, slotHealth, monitorStats]);

  // Pareto data (the screenshot's two bar charts, reborn).
  const lostMinPareto = useMemo(
    () =>
      MONITORS.map((m) => ({
        m,
        value: monitorStats.get(m.id)!.lostMin,
        worst: monitorStats.get(m.id)!.worst,
      }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [monitorStats],
  );
  const volumePareto = useMemo(
    () =>
      MONITORS.map((m) => ({
        m,
        value: monitorStats.get(m.id)!.volume,
        worst: monitorStats.get(m.id)!.worst,
      }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [monitorStats],
  );

  const selectedRun = selected ? runOf(selected.monitorId, selected.hour) : null;
  const selectedMonitor = selected
    ? MONITORS.find((m) => m.id === selected.monitorId)!
    : null;

  // grid template: label | hours | reliability
  const gridTemplate = `220px repeat(${HOURS.length}, minmax(34px, 1fr)) 78px`;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      <Header now={now} counts={counts} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1700px] px-8 py-6">
          {/* ---- Overview tiles + summary ---- */}
          <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
            <div className="grid grid-cols-4 gap-3">
              <Tile label="Failing" value={counts.failed} tone="error" />
              <Tile label="Degraded" value={counts.degraded} tone="warning" />
              <Tile label="Healthy" value={counts.healthy} tone="neutral" />
              <Tile label="Holiday" value={counts.holiday} tone="muted" />
            </div>
            <div className="flex items-center rounded-lg border border-neutral-200 bg-white px-5 py-4">
              <p className="text-sm font-medium text-neutral-700">{summary}</p>
            </div>
          </section>

          {/* ---- Toolbar ---- */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
            {/* Mode toggle */}
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as ModeKey)}
              options={[
                { value: "status", label: "Status" },
                { value: "latency", label: "Latency" },
              ]}
            />
            <span className="h-5 w-px bg-neutral-200" />
            {/* Row filter */}
            <Segmented
              value={rowFilter}
              onChange={(v) => setRowFilter(v as RowFilter)}
              options={[
                { value: "all", label: "All" },
                { value: "issues", label: "Issues only" },
              ]}
            />
            {/* Group pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
                All groups
              </Pill>
              {GROUP_ORDER.map((g) => (
                <Pill
                  key={g}
                  active={groupFilter === g}
                  onClick={() => setGroupFilter(g)}
                >
                  {g}
                </Pill>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-neutral-500">
                {visibleCount} of {MONITORS.length} monitors
              </span>
              <Legend mode={mode} />
            </div>
          </div>

          {/* ---- Heat map matrix ---- */}
          <div className="mb-8 overflow-auto rounded-lg border border-neutral-200 bg-white">
            <div
              className="grid min-w-[920px] text-xs"
              style={{ gridTemplateColumns: gridTemplate }}
              onMouseLeave={() => setHover({ row: null, col: null })}
            >
              {/* Header row */}
              <div className="sticky top-0 left-0 z-30 flex items-center border-b border-neutral-200 bg-white px-3 py-2 font-semibold tracking-wide text-neutral-500 uppercase">
                Monitor
              </div>
              {HOURS.map((h) => {
                const isNow = h === playheadHour;
                const colHover = hover.col === h;
                return (
                  <div
                    key={h}
                    className={`sticky top-0 z-20 border-b border-neutral-200 px-1 py-2 text-center font-mono text-[10px] ${
                      isNow
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : colHover
                          ? "bg-neutral-100 text-neutral-700"
                          : "bg-white text-neutral-400"
                    }`}
                  >
                    {String(h).padStart(2, "0")}
                    {isNow && <span className="ml-0.5 hidden sm:inline">·now</span>}
                  </div>
                );
              })}
              <div className="sticky top-0 z-20 border-b border-l border-neutral-200 bg-white px-2 py-2 text-center text-[10px] font-medium text-neutral-400">
                Reliab.
              </div>

              {/* Group + monitor rows */}
              {groupedRows.map(({ group, monitors }) => (
                <GroupRows
                  key={group}
                  group={group}
                  monitors={monitors}
                  runOf={runOf}
                  monitorStats={monitorStats}
                  mode={mode}
                  playheadHour={playheadHour}
                  hover={hover}
                  setHover={setHover}
                  selected={selected}
                  onSelect={(monitorId, hour) => setSelected({ monitorId, hour })}
                />
              ))}

              {/* Footer: per-slot health */}
              <div className="sticky left-0 z-10 flex items-center border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                Slot health
              </div>
              {slotHealth.map((s) => {
                const tone =
                  s.failed > 0
                    ? "bg-red-500 text-white"
                    : s.issues >= 3
                      ? "bg-amber-400 text-amber-950"
                      : s.issues > 0
                        ? "bg-amber-200 text-amber-900"
                        : "bg-neutral-100 text-neutral-400";
                const isNow = s.hour === playheadHour;
                return (
                  <div
                    key={s.hour}
                    title={`${hourLabel(s.hour)} — ${s.issues} issue${s.issues === 1 ? "" : "s"} of ${s.active} active`}
                    className={`border-t border-neutral-200 px-1 py-2 text-center font-mono text-[10px] ${tone} ${
                      isNow ? "ring-1 ring-blue-300 ring-inset" : ""
                    }`}
                  >
                    {s.active === 0 ? "·" : s.issues}
                  </div>
                );
              })}
              <div className="border-t border-l border-neutral-200 bg-neutral-50" />
            </div>
          </div>

          {/* ---- Pareto strips (the two bar charts, reframed) ---- */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ParetoPanel
              title="Lost minutes today"
              subtitle="SLA breach time per monitor — where attention is going"
              data={lostMinPareto}
              unit="min"
              onPick={(m) => {
                // jump to that monitor's worst slot
                let worstHour = playheadHour;
                let worstRank = -1;
                for (const h of HOURS) {
                  const run = runOf(m.id, h);
                  if (SEV_RANK[run.status] > worstRank) {
                    worstRank = SEV_RANK[run.status];
                    worstHour = h;
                  }
                }
                setSelected({ monitorId: m.id, hour: worstHour });
              }}
            />
            <ParetoPanel
              title="Records processed today"
              subtitle="Throughput per monitor — volume context for the heat"
              data={volumePareto}
              unit=""
              neutral
              onPick={(m) => setSelected({ monitorId: m.id, hour: playheadHour })}
            />
          </section>
        </div>
      </div>

      {/* ---- Cell drawer ---- */}
      {selected && selectedRun && selectedMonitor && (
        <CellDrawer
          monitor={selectedMonitor}
          run={selectedRun}
          stats={monitorStats.get(selectedMonitor.id)!}
          dayStart={dayStart}
          minuteFrac={minuteFrac}
          playheadHour={playheadHour}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== *
 * Group + monitor rows
 * ================================================================== */

function GroupRows({
  group,
  monitors,
  runOf,
  monitorStats,
  mode,
  playheadHour,
  hover,
  setHover,
  selected,
  onSelect,
}: {
  group: string;
  monitors: Monitor[];
  runOf: (id: string, h: number) => Run;
  monitorStats: Map<string, { reliability: number | null; worst: RunStatus }>;
  mode: ModeKey;
  playheadHour: number;
  hover: { row: string | null; col: number | null };
  setHover: (h: { row: string | null; col: number | null }) => void;
  selected: SelectedCell;
  onSelect: (monitorId: string, hour: number) => void;
}) {
  return (
    <>
      {/* Group header spanning all columns */}
      <div
        className="sticky left-0 z-10 border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
        style={{ gridColumn: "1 / -1" }}
      >
        {group}
      </div>

      {monitors.map((m) => {
        const stats = monitorStats.get(m.id)!;
        const rowHover = hover.row === m.id;
        return (
          <div key={m.id} className="contents">
            {/* Sticky label */}
            <button
              type="button"
              onMouseEnter={() => setHover({ row: m.id, col: hover.col })}
              onClick={() => onSelect(m.id, playheadHour)}
              className={`sticky left-0 z-10 flex items-center gap-2 border-t border-neutral-100 px-3 py-1.5 text-left ${
                rowHover ? "bg-neutral-100" : "bg-white"
              }`}
            >
              <RowDot worst={stats.worst} />
              <span className="truncate text-[12px] font-medium text-neutral-800">
                {m.name}
              </span>
            </button>

            {/* Cells */}
            {HOURS.map((h) => {
              const run = runOf(m.id, h);
              const appearance =
                mode === "status" ? statusCell(run.status) : latencyCell(run);
              const isNow = h === playheadHour;
              const isSel =
                selected?.monitorId === m.id && selected?.hour === h;
              const interactive =
                run.status !== "norun" && run.status !== "pending";
              return (
                <button
                  key={h}
                  type="button"
                  disabled={!interactive}
                  onMouseEnter={() => setHover({ row: m.id, col: h })}
                  onClick={() => interactive && onSelect(m.id, h)}
                  title={`${m.name} · ${hourLabel(h)} · ${STATUS_LABEL[run.status]}${
                    run.latencyMin && run.latencyMin > 0
                      ? ` · +${run.latencyMin}m vs SLA`
                      : ""
                  }`}
                  className={`relative m-px flex h-7 items-center justify-center rounded-[3px] text-[10px] font-bold transition ${appearance.cls} ${
                    interactive ? "hover:brightness-95" : "cursor-default"
                  } ${isNow ? "ring-1 ring-blue-300/70 ring-inset" : ""} ${
                    isSel ? "outline outline-2 outline-blue-500" : ""
                  }`}
                  style={appearance.style}
                >
                  {appearance.glyph ?? ""}
                </button>
              );
            })}

            {/* Reliability */}
            <div className="flex items-center justify-center border-t border-l border-neutral-100 bg-white px-1">
              <ReliabilityCell value={stats.reliability} worst={stats.worst} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function RowDot({ worst }: { worst: RunStatus }) {
  const tone =
    worst === "failed" || worst === "stale"
      ? "bg-red-500"
      : worst === "late" || worst === "slow"
        ? "bg-amber-400"
        : worst === "holiday"
          ? "bg-neutral-300"
          : "bg-neutral-300";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />;
}

function ReliabilityCell({
  value,
  worst,
}: {
  value: number | null;
  worst: RunStatus;
}) {
  if (value == null) {
    return <span className="font-mono text-[10px] text-neutral-300">—</span>;
  }
  const pct = Math.round(value * 100);
  const color =
    worst === "failed" || worst === "stale"
      ? "text-red-600"
      : pct < 90
        ? "text-amber-600"
        : "text-neutral-500";
  return <span className={`font-mono text-[10px] font-medium ${color}`}>{pct}%</span>;
}

/* ================================================================== *
 * Header
 * ================================================================== */

function Header({
  now,
  counts,
}: {
  now: number;
  counts: { failed: number; degraded: number };
}) {
  const dateStr = new Date(now).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = new Date(now).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const healthy = counts.failed === 0;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-neutral-900">TRACS Today</span>
        <span className="text-sm text-neutral-400">·</span>
        <span className="text-sm text-neutral-600">{dateStr}</span>
        <span className="font-mono text-sm text-neutral-500">· {timeStr}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge tone="info">London open</Badge>
        <Badge tone="muted">Luxembourg closed</Badge>
      </div>
      <div className="ml-auto">
        {healthy ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            All monitors healthy · last refresh {fmtClock(now - 60_000)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {counts.failed} failing · {counts.degraded} degraded · last refresh{" "}
            {fmtClock(now - 60_000)}
          </span>
        )}
      </div>
    </header>
  );
}

/* ================================================================== *
 * Overview tile
 * ================================================================== */

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "error" | "warning" | "neutral" | "muted";
}) {
  const accent =
    value === 0 && tone !== "muted"
      ? "border-l-neutral-300"
      : {
          error: "border-l-red-500",
          warning: "border-l-amber-500",
          neutral: "border-l-neutral-400",
          muted: "border-l-neutral-300",
        }[tone];
  const valueColor =
    value === 0
      ? "text-neutral-400"
      : {
          error: "text-red-600",
          warning: "text-amber-600",
          neutral: "text-neutral-800",
          muted: "text-neutral-700",
        }[tone];
  return (
    <div
      className={`flex w-28 flex-col items-start rounded-lg border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}
    >
      <span className={`text-3xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </span>
      <span className="mt-1 text-xs font-medium text-neutral-500">{label}</span>
    </div>
  );
}

/* ================================================================== *
 * Toolbar controls
 * ================================================================== */

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-neutral-300 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            value === o.value
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ mode }: { mode: ModeKey }) {
  const items =
    mode === "status"
      ? [
          { cls: "bg-neutral-200", label: "On time" },
          { cls: "bg-amber-200", label: "Slow" },
          { cls: "bg-amber-400", label: "Late" },
          { cls: "bg-red-500", label: "Failed" },
          { cls: "bg-red-100", label: "Stale" },
        ]
      : [
          { cls: "bg-neutral-200", label: "0" },
          { cls: "bg-amber-200", label: "+12m" },
          { cls: "bg-amber-400", label: "+20m" },
          { cls: "bg-orange-500", label: "+35m" },
          { cls: "bg-red-500", label: "fail" },
        ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <span className={`h-3 w-3 rounded-[2px] ${it.cls}`} />
          <span className="text-[10px] text-neutral-400">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ================================================================== *
 * Pareto panel (CSS bars — the screenshot's two charts, reframed)
 * ================================================================== */

function ParetoPanel({
  title,
  subtitle,
  data,
  unit,
  neutral = false,
  onPick,
}: {
  title: string;
  subtitle: string;
  data: { m: Monitor; value: number; worst: RunStatus }[];
  unit: string;
  neutral?: boolean;
  onPick: (m: Monitor) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barColor = (worst: RunStatus) => {
    if (neutral) return "bg-neutral-300";
    if (worst === "failed" || worst === "stale") return "bg-red-400";
    if (worst === "late" || worst === "slow") return "bg-amber-400";
    return "bg-neutral-300";
  };
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-medium text-neutral-700">{title}</h3>
      <p className="mb-3 text-xs text-neutral-400">{subtitle}</p>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">
          Nothing to show — calm board.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data.map((d) => (
            <button
              key={d.m.id}
              type="button"
              onClick={() => onPick(d.m)}
              className="flex items-center gap-2 text-left"
              title={`${d.m.name} — ${fmt(d.value)}${unit ? ` ${unit}` : ""}`}
            >
              <span className="w-32 truncate text-xs text-neutral-600">
                {d.m.name}
              </span>
              <div className="h-4 flex-1 rounded bg-neutral-100">
                <div
                  className={`h-full rounded ${barColor(d.worst)}`}
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono text-[10px] text-neutral-400">
                {fmt(d.value)}
                {unit && <span className="ml-0.5">{unit}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 * Cell drawer
 * ================================================================== */

function CellDrawer({
  monitor,
  run,
  stats,
  dayStart,
  minuteFrac,
  playheadHour,
  onClose,
}: {
  monitor: Monitor;
  run: Run;
  stats: { reliability: number | null; worst: RunStatus; lostMin: number; volume: number };
  dayStart: number;
  minuteFrac: number;
  playheadHour: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const slotTs = dayStart + run.hour * 3_600_000;
  const dueTs = slotTs + monitor.slaMin * 60_000;
  const sevText: Record<RunStatus, { label: string; cls: string }> = {
    ok: { label: "On time", cls: "text-neutral-700" },
    slow: { label: "Slow", cls: "text-amber-600" },
    late: { label: "Late", cls: "text-amber-700" },
    failed: { label: "Failed", cls: "text-red-600" },
    stale: { label: "Stale — refresh never landed", cls: "text-red-600" },
    pending: { label: "Scheduled", cls: "text-neutral-500" },
    norun: { label: "Not scheduled", cls: "text-neutral-400" },
    holiday: { label: "Holiday — no run", cls: "text-neutral-400" },
  };
  const sev = sevText[run.status];

  const cadenceLabel: Record<Cadence, string> = {
    hourly: "Hourly",
    "2h": "Every 2h",
    "4h": "Every 4h",
    eod: `EOD · ${hourLabel(monitor.anchorHour ?? 0)}`,
    sod: `SOD · ${hourLabel(monitor.anchorHour ?? 0)}`,
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-neutral-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute top-0 right-0 flex h-full w-[440px] flex-col bg-white shadow-2xl"
      >
        <div className="border-b border-neutral-200 px-5 py-4">
          <button
            onClick={onClose}
            className="mb-2 text-sm text-neutral-400 hover:text-neutral-700"
          >
            ← Close
          </button>
          <div className="flex items-center gap-2">
            <RowDot worst={run.status} />
            <span className="font-semibold text-neutral-900">{monitor.name}</span>
          </div>
          <div className="mt-1 font-mono text-sm text-neutral-500">
            {hourLabel(run.hour)} slot · {monitor.group}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="muted">{cadenceLabel[monitor.cadence]}</Badge>
            <Badge tone="neutral">{monitor.region}</Badge>
            <Badge tone="muted">SLA {monitor.slaMin}m</Badge>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <DrawerSection label="This run">
            <span className={`font-medium ${sev.cls}`}>{sev.label}</span>
            {run.latencyMin != null && run.latencyMin > 0 && (
              <span className="ml-2 font-mono text-xs text-neutral-500">
                +{run.latencyMin}m vs SLA
              </span>
            )}
          </DrawerSection>

          {run.note && (
            <DrawerSection label="What happened">
              <p
                className={`rounded-md border p-2.5 ${
                  run.status === "failed" || run.status === "stale"
                    ? "border-red-200 bg-red-50/60 text-red-800"
                    : "border-amber-200 bg-amber-50/60 text-amber-900"
                }`}
              >
                {run.note}
              </p>
            </DrawerSection>
          )}

          <DrawerSection label="Timing">
            <ul className="space-y-1 font-mono text-xs text-neutral-600">
              <li>Scheduled · {fmtClock(slotTs)}</li>
              <li>SLA due · {fmtClock(dueTs)}</li>
              <li>
                Refreshed ·{" "}
                {run.refreshedAt ? (
                  fmtClock(run.refreshedAt)
                ) : (
                  <span className="text-red-600">no refresh</span>
                )}
              </li>
            </ul>
          </DrawerSection>

          <DrawerSection label="This run's figures">
            <div className="space-y-1 text-neutral-700">
              <div>
                Records:{" "}
                <span className="font-mono">
                  {run.records.toLocaleString("en-GB")}
                </span>
              </div>
              <div>
                Owner: <span className="text-neutral-500">{monitor.owner}</span>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection label="Today (this monitor)">
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Reliability"
                value={stats.reliability == null ? "—" : `${Math.round(stats.reliability * 100)}%`}
              />
              <Stat label="Lost min" value={`${stats.lostMin}`} />
              <Stat label="Records" value={stats.volume.toLocaleString("en-GB")} />
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              {run.hour === playheadHour
                ? `Current slot. ${Math.round(minuteFrac * 60)}m into the hour.`
                : "Historical slot."}
            </p>
          </DrawerSection>
        </div>

        <div className="space-y-2 border-t border-neutral-200 px-5 py-4">
          <button className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Open in TRACS
          </button>
          <div className="flex gap-2">
            <button className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              View runbook
            </button>
            <button className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              Acknowledge
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DrawerSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold tracking-widest text-neutral-400 uppercase">
        {label}
      </h4>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
      <div className="font-mono text-sm font-semibold text-neutral-800">{value}</div>
      <div className="text-[10px] text-neutral-400">{label}</div>
    </div>
  );
}
