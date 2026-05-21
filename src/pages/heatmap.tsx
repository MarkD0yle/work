import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const title = "Heat Map";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Currency Management — "Heat Map" page
 *
 * Prototype build of the spec. The single highest-leverage rule:
 *   COMPLETE = NEUTRAL GREY, NOT GREEN.
 * Calm is the default. Colour is the exception. The operator's eye
 * only gets pulled to amber and red.
 *
 * This workspace uses Tailwind rather than real SSDS, so the SSDS
 * tokens are mapped to a small severity palette below. Swap these for
 * SSDS tokens when porting into the ccymgmt monorepo.
 * ------------------------------------------------------------------ */

/* ---------- Data model (§10) ---------- */

type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "ad_hoc";
type Severity = "act_now" | "watch" | "quiet";
type StageStatus =
  | "not_started"
  | "pending"
  | "in_progress"
  | "complete"
  | "breached"
  | "holiday";

type Note = {
  id: string;
  author: string;
  createdAt: number;
  body: string;
};

type Stage = {
  id: string;
  name: string;
  status: StageStatus;
  /** minutes from page mount; null = no deadline */
  deadlineOffsetMin: number | null;
  cutoffLabel: string;
  startedOffsetMin: number | null;
  completedOffsetMin: number | null;
  rebalancedCount?: { done: number; total: number };
  largeRedemptions?: number;
  breachCount?: number;
};

type Alert = {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  actionVerb: string;
  timeContext: string;
};

type ProcessingGroup = {
  id: string;
  clientName: string;
  processingGroupName: string;
  cadence: Cadence;
  region: string;
  isHolidayToday: boolean;
  isMine: boolean;
  stages: Stage[];
  currentStageId: string | null;
  activeAlerts: Alert[];
  quietReason?: "holiday" | "monthly" | "snoozed" | "no_activity";
  notes: Note[];
};

/* ---------- Mock data (§15.2 — calm/busy/holiday/crisis blended) ---------- */

const MOUNT = Date.now();
const offToTs = (off: number | null) => (off == null ? null : MOUNT + off * 60_000);

const GROUPS: ProcessingGroup[] = [
  {
    id: "pg-cohen-capstock",
    clientName: "Cohen & Steers",
    processingGroupName: "Capstock",
    cadence: "daily",
    region: "Lux",
    isHolidayToday: false,
    isMine: true,
    currentStageId: "s-actuals",
    notes: [
      {
        id: "n1",
        author: "Howard W",
        createdAt: MOUNT - 9 * 60_000,
        body: "Pune team chasing the actuals feed — Mary on it.",
      },
    ],
    activeAlerts: [
      {
        id: "a1",
        type: "actuals_file_delayed",
        severity: "act_now",
        message: "Actuals file delayed — expected 09:30, not received",
        actionVerb: "Investigate",
        timeContext: "Breached 23m ago · escalation required by 11:00",
      },
    ],
    stages: [
      { id: "s-rebal", name: "Rebalance", status: "complete", deadlineOffsetMin: -120, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -180, completedOffsetMin: -125 },
      { id: "s-est", name: "Estimates", status: "complete", deadlineOffsetMin: -45, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -110, completedOffsetMin: -50 },
      { id: "s-actuals", name: "Actuals", status: "breached", deadlineOffsetMin: -23, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -40, completedOffsetMin: null, breachCount: 1 },
      { id: "s-report", name: "Reporting", status: "pending", deadlineOffsetMin: 180, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-ishares-nav",
    clientName: "iShares",
    processingGroupName: "STT Daily NAV Rebalance",
    cadence: "daily",
    region: "Lux",
    isHolidayToday: false,
    isMine: true,
    currentStageId: "s2-est",
    notes: [],
    activeAlerts: [
      {
        id: "a2",
        type: "large_redemption",
        severity: "act_now",
        message: "Large redemption flagged — 2 detected, NAV impact review needed",
        actionVerb: "Review",
        timeContext: "Estimates due 12:00 · 8m to cutoff",
      },
    ],
    stages: [
      { id: "s2-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -130, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -160, completedOffsetMin: -135 },
      { id: "s2-est", name: "Est", status: "in_progress", deadlineOffsetMin: 8, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -20, completedOffsetMin: null, rebalancedCount: { done: 15, total: 287 }, largeRedemptions: 2 },
      { id: "s2-actuals", name: "Actuals", status: "not_started", deadlineOffsetMin: 300, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: null, completedOffsetMin: null },
      { id: "s2-report", name: "Reporting", status: "not_started", deadlineOffsetMin: 420, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-pimco-est",
    clientName: "PIMCO",
    processingGroupName: "Income Fund Estimates",
    cadence: "daily",
    region: "London",
    isHolidayToday: false,
    isMine: false,
    currentStageId: "s3-est",
    notes: [],
    activeAlerts: [
      {
        id: "a3",
        type: "estimate_trade_not_reversed",
        severity: "act_now",
        message: "Estimate trade not reversed before actuals run",
        actionVerb: "Reverse",
        timeContext: "Must reverse before 11:30 · 4m",
      },
    ],
    stages: [
      { id: "s3-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -90, cutoffLabel: "BMK 11:00 GMT", startedOffsetMin: -140, completedOffsetMin: -95 },
      { id: "s3-est", name: "Estimates", status: "breached", deadlineOffsetMin: 4, cutoffLabel: "BMK 11:00 GMT", startedOffsetMin: -30, completedOffsetMin: null, breachCount: 1 },
      { id: "s3-actuals", name: "Actuals", status: "not_started", deadlineOffsetMin: 200, cutoffLabel: "BMK 11:00 GMT", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-vanguard-pl",
    clientName: "Vanguard",
    processingGroupName: "Unrealized P&L Monitor",
    cadence: "daily",
    region: "NY",
    isHolidayToday: false,
    isMine: true,
    currentStageId: "s4-pl",
    notes: [],
    activeAlerts: [
      {
        id: "a4",
        type: "pl_breach",
        severity: "watch",
        message: "Unrealized P&L approaching tolerance band",
        actionVerb: "Review",
        timeContext: "Approaching limit · review by 13:00 · 22m",
      },
    ],
    stages: [
      { id: "s4-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -80, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -120, completedOffsetMin: -85 },
      { id: "s4-pl", name: "P&L Check", status: "in_progress", deadlineOffsetMin: 22, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -10, completedOffsetMin: null },
      { id: "s4-report", name: "Reporting", status: "not_started", deadlineOffsetMin: 260, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-fidelity-est",
    clientName: "Fidelity",
    processingGroupName: "Global Bond Estimates",
    cadence: "daily",
    region: "London",
    isHolidayToday: false,
    isMine: false,
    currentStageId: "s5-est",
    notes: [],
    activeAlerts: [
      {
        id: "a5",
        type: "approval_pending",
        severity: "watch",
        message: "Estimates pending approval before submission",
        actionVerb: "Approve",
        timeContext: "Estimates due 12:30 · 27m",
      },
    ],
    stages: [
      { id: "s5-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -70, cutoffLabel: "BMK 12:30 GMT", startedOffsetMin: -110, completedOffsetMin: -75 },
      { id: "s5-est", name: "Estimates", status: "in_progress", deadlineOffsetMin: 27, cutoffLabel: "BMK 12:30 GMT", startedOffsetMin: -15, completedOffsetMin: null },
      { id: "s5-actuals", name: "Actuals", status: "not_started", deadlineOffsetMin: 320, cutoffLabel: "BMK 12:30 GMT", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-jpm-actuals",
    clientName: "JP Morgan AM",
    processingGroupName: "Liquidity Fund Actuals",
    cadence: "daily",
    region: "Singapore",
    isHolidayToday: false,
    isMine: false,
    currentStageId: "s6-actuals",
    notes: [],
    activeAlerts: [
      {
        id: "a6",
        type: "actuals_late",
        severity: "watch",
        message: "Actuals feed running slow — partial file received",
        actionVerb: "Investigate",
        timeContext: "Actuals due 12:15 · 18m",
      },
    ],
    stages: [
      { id: "s6-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -200, cutoffLabel: "SGT 17:00", startedOffsetMin: -240, completedOffsetMin: -205 },
      { id: "s6-est", name: "Est", status: "complete", deadlineOffsetMin: -60, cutoffLabel: "SGT 17:00", startedOffsetMin: -150, completedOffsetMin: -65 },
      { id: "s6-actuals", name: "Actuals", status: "in_progress", deadlineOffsetMin: 18, cutoffLabel: "SGT 17:00", startedOffsetMin: -5, completedOffsetMin: null, rebalancedCount: { done: 88, total: 120 } },
      { id: "s6-report", name: "Reporting", status: "not_started", deadlineOffsetMin: 280, cutoffLabel: "SGT 17:00", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-statestreet-gx",
    clientName: "State Street GA",
    processingGroupName: "GX Multi-Asset Rebalance",
    cadence: "daily",
    region: "NY",
    isHolidayToday: false,
    isMine: true,
    currentStageId: "s7-report",
    notes: [],
    activeAlerts: [],
    stages: [
      { id: "s7-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -150, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -190, completedOffsetMin: -155 },
      { id: "s7-est", name: "Est", status: "complete", deadlineOffsetMin: -90, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -140, completedOffsetMin: -95 },
      { id: "s7-actuals", name: "Actuals", status: "complete", deadlineOffsetMin: -30, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -80, completedOffsetMin: -35 },
      { id: "s7-report", name: "Reporting", status: "in_progress", deadlineOffsetMin: 47, cutoffLabel: "WMH 16:00 EST", startedOffsetMin: -8, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-blackrock-eq",
    clientName: "BlackRock",
    processingGroupName: "Equity Index Daily",
    cadence: "daily",
    region: "London",
    isHolidayToday: false,
    isMine: false,
    currentStageId: "s8-report",
    notes: [],
    activeAlerts: [],
    stages: [
      { id: "s8-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -160, cutoffLabel: "BMK 16:00 GMT", startedOffsetMin: -200, completedOffsetMin: -165 },
      { id: "s8-est", name: "Est", status: "complete", deadlineOffsetMin: -100, cutoffLabel: "BMK 16:00 GMT", startedOffsetMin: -150, completedOffsetMin: -105 },
      { id: "s8-actuals", name: "Actuals", status: "complete", deadlineOffsetMin: -40, cutoffLabel: "BMK 16:00 GMT", startedOffsetMin: -90, completedOffsetMin: -45 },
      { id: "s8-report", name: "Reporting", status: "pending", deadlineOffsetMin: 240, cutoffLabel: "BMK 16:00 GMT", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  // Quiet — holiday (Luxembourg closed)
  {
    id: "pg-amundi-lux",
    clientName: "Amundi",
    processingGroupName: "Lux SICAV Daily",
    cadence: "daily",
    region: "Lux",
    isHolidayToday: true,
    isMine: false,
    currentStageId: null,
    quietReason: "holiday",
    notes: [],
    activeAlerts: [],
    stages: [
      { id: "s9-rebal", name: "Rebal", status: "holiday", deadlineOffsetMin: null, cutoffLabel: "Lux holiday", startedOffsetMin: null, completedOffsetMin: null },
      { id: "s9-est", name: "Est", status: "holiday", deadlineOffsetMin: null, cutoffLabel: "Lux holiday", startedOffsetMin: null, completedOffsetMin: null },
      { id: "s9-actuals", name: "Actuals", status: "holiday", deadlineOffsetMin: null, cutoffLabel: "Lux holiday", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  {
    id: "pg-dws-lux",
    clientName: "DWS",
    processingGroupName: "Xtrackers Lux",
    cadence: "daily",
    region: "Lux",
    isHolidayToday: true,
    isMine: false,
    currentStageId: null,
    quietReason: "holiday",
    notes: [],
    activeAlerts: [],
    stages: [
      { id: "s10-rebal", name: "Rebal", status: "holiday", deadlineOffsetMin: null, cutoffLabel: "Lux holiday", startedOffsetMin: null, completedOffsetMin: null },
      { id: "s10-est", name: "Est", status: "holiday", deadlineOffsetMin: null, cutoffLabel: "Lux holiday", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  // Quiet — monthly cycle not due today
  {
    id: "pg-schroders-monthly",
    clientName: "Schroders",
    processingGroupName: "Monthly Dividend Cycle",
    cadence: "monthly",
    region: "London",
    isHolidayToday: false,
    isMine: false,
    currentStageId: null,
    quietReason: "monthly",
    notes: [],
    activeAlerts: [],
    stages: [
      { id: "s11-rebal", name: "Rebal", status: "not_started", deadlineOffsetMin: null, cutoffLabel: "Month-end", startedOffsetMin: null, completedOffsetMin: null },
      { id: "s11-est", name: "Est", status: "not_started", deadlineOffsetMin: null, cutoffLabel: "Month-end", startedOffsetMin: null, completedOffsetMin: null },
    ],
  },
  // Quiet — snoozed
  {
    id: "pg-aviva-snoozed",
    clientName: "Aviva Investors",
    processingGroupName: "MMF Daily",
    cadence: "daily",
    region: "London",
    isHolidayToday: false,
    isMine: false,
    currentStageId: null,
    quietReason: "snoozed",
    notes: [
      { id: "n2", author: "Howard W", createdAt: MOUNT - 40 * 60_000, body: "Known feed delay from custodian, expected resolved by 13:00." },
    ],
    activeAlerts: [],
    stages: [
      { id: "s12-rebal", name: "Rebal", status: "complete", deadlineOffsetMin: -100, cutoffLabel: "BMK 16:00 GMT", startedOffsetMin: -140, completedOffsetMin: -105 },
      { id: "s12-est", name: "Est", status: "in_progress", deadlineOffsetMin: 90, cutoffLabel: "BMK 16:00 GMT", startedOffsetMin: -10, completedOffsetMin: null },
    ],
  },
];

/* ---------- Severity / time helpers ---------- */

const WATCH_THRESHOLD_MIN = 30; // TODO_VALIDATE
const IMMINENT_THRESHOLD_MIN = 10; // TODO_VALIDATE

function minutesUntil(ts: number | null, now: number): number | null {
  if (ts == null) return null;
  return (ts - now) / 60_000;
}

function fmtCountdown(ts: number | null, now: number): string {
  if (ts == null) return "—";
  const ms = ts - now;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const core =
    h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return ms < 0 ? `${core} ago` : core;
}

function fmtClock(ts: number | null): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RowStatus = "on_track" | "watch" | "at_risk" | "holiday" | "working";

function chevronSeverity(
  stage: Stage,
  now: number,
): "complete" | "on_track" | "watch" | "at_risk" | "holiday" | "active" {
  if (stage.status === "holiday") return "holiday";
  if (stage.status === "complete") return "complete";
  if (stage.status === "breached") return "at_risk";
  const mins = minutesUntil(offToTs(stage.deadlineOffsetMin), now);
  if (mins != null) {
    if (mins <= IMMINENT_THRESHOLD_MIN) return "at_risk";
    if (mins <= WATCH_THRESHOLD_MIN) return "watch";
  }
  if (stage.status === "in_progress") return "active";
  return "on_track";
}

function groupStatus(g: ProcessingGroup, now: number): RowStatus {
  if (g.isHolidayToday) return "holiday";
  const worst = g.stages.reduce<"at_risk" | "watch" | "none">((acc, s) => {
    const sev = chevronSeverity(s, now);
    if (sev === "at_risk") return "at_risk";
    if (sev === "watch" && acc !== "at_risk") return "watch";
    return acc;
  }, "none");
  if (worst === "at_risk") return "at_risk";
  if (worst === "watch") return "watch";
  if (g.currentStageId) return "working";
  return "on_track";
}

function topSeverity(g: ProcessingGroup): Severity | null {
  if (g.activeAlerts.some((a) => a.severity === "act_now")) return "act_now";
  if (g.activeAlerts.some((a) => a.severity === "watch")) return "watch";
  if (g.quietReason || g.activeAlerts.length === 0) return "quiet";
  return null;
}

/* ---------- Small presentational atoms ---------- */

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "warning" | "error" | "muted";
}) {
  const tones: Record<string, string> = {
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-500",
    info: "border-blue-300 bg-blue-50 text-blue-700",
    warning: "border-amber-300 bg-amber-50 text-amber-800",
    error: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Dot({ tone }: { tone: "error" | "warning" | "neutral" | "info" }) {
  const tones: Record<string, string> = {
    error: "bg-red-500",
    warning: "bg-amber-500",
    neutral: "bg-neutral-400",
    info: "bg-blue-500",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${tones[tone]}`} />;
}

function StatusPill({ status }: { status: RowStatus }) {
  const map: Record<
    RowStatus,
    { label: string; cls: string; icon: string }
  > = {
    on_track: { label: "On track", cls: "border-neutral-300 bg-neutral-50 text-neutral-600", icon: "●" },
    watch: { label: "Watch", cls: "border-amber-300 bg-amber-50 text-amber-800", icon: "▲" },
    at_risk: { label: "At risk", cls: "border-red-300 bg-red-50 text-red-700", icon: "■" },
    holiday: { label: "Holiday", cls: "border-neutral-200 bg-neutral-50 text-neutral-400", icon: "◷" },
    working: { label: "Working", cls: "border-blue-300 bg-blue-50 text-blue-700", icon: "◐" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.cls}`}
    >
      <span aria-hidden className="text-[10px] leading-none">{s.icon}</span>
      {s.label}
    </span>
  );
}

/* ---------- Chevron (the colour inversion, §6.3) ---------- */

function Chevron({
  stage,
  now,
  onClick,
  ackBy,
}: {
  stage: Stage;
  now: number;
  onClick: () => void;
  ackBy?: string;
}) {
  const sev = chevronSeverity(stage, now);
  const deadlineTs = offToTs(stage.deadlineOffsetMin);

  // COMPLETE and ON_TRACK both render calm/neutral — by design.
  const styles: Record<string, string> = {
    complete: "border-neutral-300 bg-neutral-100 text-neutral-500",
    on_track: "border-neutral-300 bg-transparent text-neutral-500",
    watch: "border-amber-400 bg-amber-100 text-amber-900",
    at_risk: "border-red-400 bg-red-100 text-red-800",
    holiday: "border-neutral-200 bg-neutral-50 text-neutral-400",
    active: "border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-300/60 animate-pulse",
  };

  let detail: string;
  if (sev === "complete") detail = `✓ ${fmtClock(offToTs(stage.completedOffsetMin))}`;
  else if (sev === "holiday") detail = "N/A";
  else if (ackBy) detail = "ack";
  else detail = fmtCountdown(deadlineTs, now);

  const ariaState =
    sev === "complete"
      ? "complete"
      : sev === "holiday"
        ? "holiday, not applicable"
        : `${sev.replace("_", " ")}, deadline in ${fmtCountdown(deadlineTs, now)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${stage.name} · ${stage.cutoffLabel}${deadlineTs ? ` · ${fmtClock(deadlineTs)}` : ""}`}
      aria-label={`Stage ${stage.name}, ${ariaState}`}
      className={`group relative flex shrink-0 items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-xs font-medium transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${styles[sev]}`}
      style={{
        clipPath:
          "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)",
        paddingLeft: 14,
        paddingRight: 16,
      }}
    >
      <span className="whitespace-nowrap">{stage.name}</span>
      {ackBy && (
        <span
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white"
          title={`Acknowledged by ${ackBy}`}
        >
          {ackBy.charAt(0)}
        </span>
      )}
      <span className="whitespace-nowrap font-mono text-[10px] opacity-80">
        {detail}
      </span>
    </button>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

type AckMap = Record<string, string>; // groupId -> user
type SnoozeMap = Record<string, { reason: string; until: string }>;
type NotesMap = Record<string, Note[]>;

const ME = "Howard W";

export default function HeatMap() {
  const [now, setNow] = useState(() => Date.now());

  // Mutable interaction state layered over the static fixtures.
  const [acks, setAcks] = useState<AckMap>({});
  const [snoozes, setSnoozes] = useState<SnoozeMap>({});
  const [extraNotes, setExtraNotes] = useState<NotesMap>({});

  // UI state
  const [expanded, setExpanded] = useState({
    act_now: true,
    watch: false,
    quiet: false,
  });
  const [volumesOpen, setVolumesOpen] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState<
    "at_risk" | "mine" | "all"
  >("at_risk");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const [drawerStageId, setDrawerStageId] = useState<string | null>(null);
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null);
  const [pulseGroupId, setPulseGroupId] = useState<string | null>(null);

  const triageRef = useRef<HTMLDivElement | null>(null);
  const pipelineRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Real-time tick (§9.2 — 30s acceptable; we use 1s for a lively demo clock)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derived: classify every group into a triage bucket, applying live state.
  const classified = useMemo(() => {
    const actNow: ProcessingGroup[] = [];
    const watch: ProcessingGroup[] = [];
    const quiet: ProcessingGroup[] = [];
    for (const g of GROUPS) {
      if (snoozes[g.id]) {
        quiet.push({ ...g, quietReason: "snoozed" });
        continue;
      }
      const sev = topSeverity(g);
      if (g.isHolidayToday || g.quietReason) quiet.push(g);
      else if (sev === "act_now") actNow.push(g);
      else if (sev === "watch") watch.push(g);
      else quiet.push({ ...g, quietReason: g.quietReason ?? "no_activity" });
    }
    // sort by urgency (soonest breach first)
    const urgency = (g: ProcessingGroup) =>
      Math.min(
        ...g.stages
          .map((s) => minutesUntil(offToTs(s.deadlineOffsetMin), now) ?? Infinity)
          .filter((m) => m > -1e6),
        Infinity,
      );
    actNow.sort((a, b) => urgency(a) - urgency(b));
    watch.sort((a, b) => urgency(a) - urgency(b));
    // acknowledged drop to bottom of act now
    actNow.sort((a, b) => Number(!!acks[a.id]) - Number(!!acks[b.id]));
    return { actNow, watch, quiet };
  }, [now, acks, snoozes]);

  const counts = {
    act_now: classified.actNow.length,
    watch: classified.watch.length,
    quiet: classified.quiet.length,
    total: GROUPS.length,
  };

  const quietBreakdown = useMemo(() => {
    const b = { holiday: 0, monthly: 0, snoozed: 0, no_activity: 0 };
    for (const g of classified.quiet) {
      const r = snoozes[g.id] ? "snoozed" : g.quietReason ?? "no_activity";
      b[r] += 1;
    }
    return b;
  }, [classified.quiet, snoozes]);

  // Pipeline rows after filter
  const pipelineRows = useMemo(() => {
    let rows = GROUPS;
    if (pipelineFilter === "at_risk") {
      rows = rows.filter((g) => {
        const st = groupStatus(g, now);
        return (st === "at_risk" || st === "watch") && !snoozes[g.id];
      });
    } else if (pipelineFilter === "mine") {
      rows = rows.filter((g) => g.isMine);
    }
    return rows;
  }, [pipelineFilter, now, snoozes]);

  // Day strip deadline dots
  const dots = useMemo(() => {
    const out: {
      groupId: string;
      label: string;
      ts: number;
      tone: "error" | "warning" | "neutral";
    }[] = [];
    for (const g of GROUPS) {
      if (g.isHolidayToday) continue;
      for (const s of g.stages) {
        const ts = offToTs(s.deadlineOffsetMin);
        if (ts == null) continue;
        if (s.status === "complete" || s.status === "holiday") continue;
        const mins = minutesUntil(ts, now)!;
        if (mins > 8 * 60) continue;
        const tone =
          mins <= IMMINENT_THRESHOLD_MIN
            ? "error"
            : mins <= WATCH_THRESHOLD_MIN
              ? "warning"
              : "neutral";
        out.push({
          groupId: g.id,
          label: `${g.clientName} · ${g.processingGroupName} · ${s.name}`,
          ts,
          tone,
        });
      }
    }
    return out.sort((a, b) => a.ts - b.ts);
  }, [now]);

  // Summary sentence (§4.2)
  const summary = useMemo(() => {
    const breaches = GROUPS.filter((g) => groupStatus(g, now) === "at_risk").length;
    const nextHour = dots.filter(
      (d) => minutesUntil(d.ts, now)! >= 0 && minutesUntil(d.ts, now)! <= 60,
    );
    const upcoming = dots.filter((d) => minutesUntil(d.ts, now)! >= 0);
    if (breaches > 0) {
      return `${breaches} breach${breaches > 1 ? "es" : ""} active. ${nextHour.length} more deadline${nextHour.length === 1 ? "" : "s"} in the next hour.`;
    }
    if (nextHour.length >= 4) {
      const tightest = upcoming[0];
      return `${nextHour.length} deadlines in the next hour. Tightest: ${tightest.label.split(" · ").slice(0, 2).join(" ")} in ${fmtCountdown(tightest.ts, now)}.`;
    }
    const next = upcoming[0];
    return next
      ? `Next deadline: ${next.label.split(" · ").slice(0, 2).join(" ")} in ${fmtCountdown(next.ts, now)}. ${counts.quiet} processing groups on track.`
      : `All clear. ${counts.quiet} processing groups quiet.`;
  }, [dots, now, counts.quiet]);

  /* ---------- Actions ---------- */

  function scrollToTriage(block: "act_now" | "watch" | "quiet") {
    setExpanded((e) => ({ ...e, [block]: true }));
    triageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusGroupInPipeline(groupId: string) {
    setPipelineFilter("all");
    setPulseGroupId(groupId);
    setTimeout(() => {
      rowRefs.current[groupId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
    setTimeout(() => setPulseGroupId(null), 1200);
  }

  function acknowledge(groupId: string) {
    setAcks((a) => ({ ...a, [groupId]: ME }));
  }

  function openDrawer(groupId: string, stageId?: string) {
    setDrawerGroupId(groupId);
    setDrawerStageId(stageId ?? null);
  }

  const drawerGroup = GROUPS.find((g) => g.id === drawerGroupId) ?? null;

  /* ================================================================ */

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---------- Header (§3) ---------- */}
      <Header now={now} counts={counts} dots={dots} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-8 py-6">
          {/* ---------- Section 1: Overview (§4) ---------- */}
          <section aria-label="Overview" className="mb-12">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left: triage tiles */}
              <div className="grid grid-cols-4 gap-3">
                <OverviewTile
                  label="Act now"
                  value={counts.act_now}
                  tone="error"
                  onClick={() => scrollToTriage("act_now")}
                />
                <OverviewTile
                  label="Watch"
                  value={counts.watch}
                  tone="warning"
                  onClick={() => scrollToTriage("watch")}
                />
                <OverviewTile
                  label="Quiet"
                  value={counts.quiet}
                  tone="neutral"
                  onClick={() => scrollToTriage("quiet")}
                />
                <OverviewTile label="Total" value={counts.total} tone="muted" />
              </div>

              {/* Right: day strip */}
              <DayStrip
                now={now}
                dots={dots}
                summary={summary}
                onDotClick={(gid) => focusGroupInPipeline(gid)}
              />
            </div>
          </section>

          {/* ---------- Section 2: Triage (§5) ---------- */}
          <section
            ref={triageRef}
            aria-label="Triage"
            className="mb-12 scroll-mt-20"
          >
            <h2 className="mb-3 text-xs font-semibold tracking-widest text-neutral-500 uppercase">
              Triage
            </h2>

            <TriageBlock
              name="Act now"
              tone="error"
              count={counts.act_now}
              open={expanded.act_now}
              onToggle={() =>
                setExpanded((e) => ({ ...e, act_now: !e.act_now }))
              }
              emptyState={
                <EmptyState
                  icon="✓"
                  tone="ok"
                  text="Nothing requires action."
                />
              }
            >
              {classified.actNow.map((g) => (
                <AlertRow
                  key={g.id}
                  group={g}
                  acked={!!acks[g.id]}
                  onInvestigate={() => openDrawer(g.id)}
                  onAcknowledge={() => acknowledge(g.id)}
                  onSnooze={(reason, until) =>
                    setSnoozes((s) => ({ ...s, [g.id]: { reason, until } }))
                  }
                  onNote={(body) =>
                    setExtraNotes((n) => ({
                      ...n,
                      [g.id]: [
                        ...(n[g.id] ?? []),
                        { id: `${Date.now()}`, author: ME, createdAt: Date.now(), body },
                      ],
                    }))
                  }
                  onHover={() => setHoverGroupId(g.id)}
                  onLeave={() => setHoverGroupId(null)}
                  onClickRow={() => focusGroupInPipeline(g.id)}
                />
              ))}
            </TriageBlock>

            <TriageBlock
              name="Watch"
              tone="warning"
              count={counts.watch}
              open={expanded.watch}
              onToggle={() => setExpanded((e) => ({ ...e, watch: !e.watch }))}
              emptyState={<EmptyState text="No items approaching deadline." />}
            >
              {classified.watch.map((g) => (
                <AlertRow
                  key={g.id}
                  group={g}
                  acked={!!acks[g.id]}
                  onInvestigate={() => openDrawer(g.id)}
                  onAcknowledge={() => acknowledge(g.id)}
                  onSnooze={(reason, until) =>
                    setSnoozes((s) => ({ ...s, [g.id]: { reason, until } }))
                  }
                  onNote={(body) =>
                    setExtraNotes((n) => ({
                      ...n,
                      [g.id]: [
                        ...(n[g.id] ?? []),
                        { id: `${Date.now()}`, author: ME, createdAt: Date.now(), body },
                      ],
                    }))
                  }
                  onHover={() => setHoverGroupId(g.id)}
                  onLeave={() => setHoverGroupId(null)}
                  onClickRow={() => focusGroupInPipeline(g.id)}
                />
              ))}
            </TriageBlock>

            <TriageBlock
              name="Quiet"
              tone="neutral"
              count={counts.quiet}
              open={expanded.quiet}
              onToggle={() => setExpanded((e) => ({ ...e, quiet: !e.quiet }))}
              subline={`${quietBreakdown.holiday} holiday · ${quietBreakdown.monthly} monthly cycle · ${quietBreakdown.snoozed} snoozed · ${quietBreakdown.no_activity} no activity`}
              emptyState={<EmptyState text="No quiet items." />}
            >
              {classified.quiet.map((g) => (
                <QuietRow
                  key={g.id}
                  group={g}
                  snoozeInfo={snoozes[g.id]}
                  onClickRow={() => openDrawer(g.id)}
                />
              ))}
            </TriageBlock>
          </section>

          {/* ---------- Section 3: Pipeline (§6) ---------- */}
          <section ref={pipelineRef} aria-label="Pipeline" className="mb-12">
            <h2 className="mb-3 text-xs font-semibold tracking-widest text-neutral-500 uppercase">
              Pipeline
            </h2>

            {/* Filter bar */}
            <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white/90 px-4 py-2.5 backdrop-blur">
              <div className="flex items-center gap-1.5">
                {(["at_risk", "mine", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPipelineFilter(f)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      pipelineFilter === f
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {f === "at_risk" ? "At-risk" : f === "mine" ? "My clients" : "All"}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
                <span>
                  Showing {pipelineRows.length} of {GROUPS.length}
                </span>
                <div className="flex items-center gap-1 rounded-full border border-neutral-300 p-0.5">
                  {(["compact", "comfortable"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      className={`rounded-full px-2.5 py-0.5 capitalize transition ${
                        density === d
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rows */}
            {pipelineRows.length === 0 ? (
              <EmptyState
                large
                tone="ok"
                icon="✓"
                text={`All ${GROUPS.length} processing groups on track.`}
                sub={
                  dots[0]
                    ? `Next deadline: ${dots[0].label.split(" · ").slice(0, 2).join(" ")} in ${fmtCountdown(dots[0].ts, now)}.`
                    : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {pipelineRows.map((g) => (
                  <PipelineRow
                    key={g.id}
                    ref={(el) => {
                      rowRefs.current[g.id] = el;
                    }}
                    group={g}
                    now={now}
                    density={density}
                    ackBy={acks[g.id]}
                    highlighted={hoverGroupId === g.id}
                    pulsing={pulseGroupId === g.id}
                    onChevron={(stageId) => openDrawer(g.id, stageId)}
                    onLabel={() => openDrawer(g.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ---------- Section 4: Volumes (§7) ---------- */}
          <section aria-label="Volumes" className="mb-8">
            <button
              type="button"
              onClick={() => setVolumesOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-500 hover:bg-neutral-50"
            >
              <span className="text-xs">{volumesOpen ? "▼" : "▶"}</span>
              Volumes — daily processing summary
            </button>
            {volumesOpen && <Volumes now={now} />}
          </section>
        </div>
      </div>

      {/* ---------- Drawer (§8) ---------- */}
      {drawerGroup && (
        <Drawer
          group={drawerGroup}
          stageId={drawerStageId}
          now={now}
          ackBy={acks[drawerGroup.id]}
          extraNotes={extraNotes[drawerGroup.id] ?? []}
          onClose={() => setDrawerGroupId(null)}
          onAcknowledge={() => acknowledge(drawerGroup.id)}
          onAddNote={(body) =>
            setExtraNotes((n) => ({
              ...n,
              [drawerGroup.id]: [
                ...(n[drawerGroup.id] ?? []),
                { id: `${Date.now()}`, author: ME, createdAt: Date.now(), body },
              ],
            }))
          }
        />
      )}
    </div>
  );
}

/* ================================================================== *
 * Header
 * ================================================================== */

function Header({
  now,
  counts,
  dots,
}: {
  now: number;
  counts: { act_now: number };
  dots: { ts: number }[];
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
  const nextCutoff = dots.find((d) => d.ts > now);

  // System health: amber if any breaches, else healthy.
  const healthy = counts.act_now === 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-neutral-900">{dateStr}</span>
        <span className="font-mono text-sm text-neutral-500">· {timeStr} EST</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge tone="info">London open</Badge>
        <Badge tone="muted">Luxembourg closed</Badge>
        <Badge tone="muted">Tokyo closed</Badge>
      </div>

      {nextCutoff && (
        <span className="text-sm text-neutral-600">
          WMH cutoff in{" "}
          <span className="font-mono font-medium text-neutral-900">
            {fmtCountdown(nextCutoff.ts, now)}
          </span>
        </span>
      )}

      <div className="ml-auto">
        {healthy ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            All monitors healthy · 17/17 ran · last refresh {fmtClock(now - 60_000)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            1 monitor late · last refresh {fmtClock(now - 60_000)}
          </span>
        )}
      </div>
    </header>
  );
}

/* ================================================================== *
 * Overview tile
 * ================================================================== */

function OverviewTile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "error" | "warning" | "neutral" | "muted";
  onClick?: () => void;
}) {
  // Empty Act now is grey, not red (§4.1).
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
          muted: "text-neutral-800",
        }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-start rounded-lg border border-l-4 border-neutral-200 bg-white p-4 text-left transition ${accent} ${
        onClick ? "cursor-pointer hover:shadow-sm" : "cursor-default"
      }`}
    >
      <span className={`text-3xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </span>
      <span className="mt-1 text-xs font-medium text-neutral-500">{label}</span>
    </button>
  );
}

/* ================================================================== *
 * Day strip
 * ================================================================== */

function DayStrip({
  now,
  dots,
  summary,
  onDotClick,
}: {
  now: number;
  dots: { groupId: string; label: string; ts: number; tone: "error" | "warning" | "neutral" }[];
  summary: string;
  onDotClick: (groupId: string) => void;
}) {
  const start = new Date(now);
  start.setHours(6, 0, 0, 0);
  const end = new Date(now);
  end.setHours(18, 0, 0, 0);
  const span = end.getTime() - start.getTime();
  const pct = (ts: number) =>
    Math.max(0, Math.min(100, ((ts - start.getTime()) / span) * 100));

  const ticks = [6, 9, 12, 15, 18];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="relative mt-4 mb-2 h-12">
        {/* axis */}
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-neutral-200" />
        {/* ticks */}
        {ticks.map((h) => {
          const t = new Date(start);
          t.setHours(h, 0, 0, 0);
          return (
            <div
              key={h}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct(t.getTime())}%` }}
            >
              <span className="block font-mono text-[10px] text-neutral-400">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          );
        })}
        {/* now line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-blue-500"
          style={{ left: `${pct(now)}%` }}
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-1 py-0.5 font-mono text-[9px] whitespace-nowrap text-white">
            now {fmtClock(now)}
          </span>
        </div>
        {/* dots */}
        {dots.map((d, i) => (
          <button
            key={`${d.groupId}-${i}`}
            type="button"
            onClick={() => onDotClick(d.groupId)}
            title={`${d.label} · ${fmtClock(d.ts)}`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct(d.ts)}%`, bottom: 0 }}
          >
            <span
              className={`block h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                d.tone === "error"
                  ? "bg-red-500"
                  : d.tone === "warning"
                    ? "bg-amber-500"
                    : "bg-neutral-400"
              }`}
            />
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm font-medium text-neutral-700">{summary}</p>
    </div>
  );
}

/* ================================================================== *
 * Triage block (accordion)
 * ================================================================== */

function TriageBlock({
  name,
  tone,
  count,
  open,
  onToggle,
  subline,
  emptyState,
  children,
}: {
  name: string;
  tone: "error" | "warning" | "neutral";
  count: number;
  open: boolean;
  onToggle: () => void;
  subline?: string;
  emptyState: ReactNode;
  children: ReactNode;
}) {
  const dotTone = count === 0 ? "neutral" : tone;
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
      >
        <Dot tone={dotTone} />
        <span className="text-xs font-semibold tracking-widest text-neutral-700 uppercase">
          {name}
        </span>
        <span className="text-xs font-medium text-neutral-400">({count})</span>
        {subline && (
          <span className="ml-3 hidden text-xs text-neutral-400 md:inline">
            {subline}
          </span>
        )}
        <span className="ml-auto text-xs text-neutral-400">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="border-t border-neutral-100 px-4 py-3">
          {count === 0 ? emptyState : <div className="flex flex-col gap-2">{children}</div>}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 * Alert row
 * ================================================================== */

function AlertRow({
  group,
  acked,
  onInvestigate,
  onAcknowledge,
  onSnooze,
  onNote,
  onHover,
  onLeave,
  onClickRow,
}: {
  group: ProcessingGroup;
  acked: boolean;
  onInvestigate: () => void;
  onAcknowledge: () => void;
  onSnooze: (reason: string, until: string) => void;
  onNote: (body: string) => void;
  onHover: () => void;
  onLeave: () => void;
  onClickRow: () => void;
}) {
  const alert = group.activeAlerts[0];
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  if (!alert) return null;

  const sev = alert.severity;
  const dotTone = acked ? "info" : sev === "act_now" ? "error" : "warning";

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`rounded-lg border p-3 transition ${
        acked
          ? "border-blue-200 bg-blue-50/50"
          : sev === "act_now"
            ? "border-red-200 bg-red-50/40"
            : "border-amber-200 bg-amber-50/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1">
          <Dot tone={dotTone} />
        </span>
        <button
          type="button"
          onClick={onClickRow}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">
              {group.clientName}
            </span>
            <span className="text-neutral-500">· {group.processingGroupName}</span>
            {acked && <Badge tone="info">Working · {ME}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-neutral-700">{alert.message}</p>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">
            {alert.timeContext}
          </p>
        </button>
        <Badge tone="neutral">{group.region}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onInvestigate}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
        >
          {alert.actionVerb}
        </button>
        <button
          type="button"
          onClick={onAcknowledge}
          disabled={acked}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        >
          {acked ? "Acknowledged" : "Acknowledge"}
        </button>
        <button
          type="button"
          onClick={() => setSnoozeOpen(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Snooze
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Note
        </button>
      </div>

      {snoozeOpen && (
        <SnoozeModal
          group={group}
          onClose={() => setSnoozeOpen(false)}
          onConfirm={(reason, until) => {
            onSnooze(reason, until);
            setSnoozeOpen(false);
          }}
        />
      )}
      {noteOpen && (
        <NoteModal
          group={group}
          onClose={() => setNoteOpen(false)}
          onConfirm={(body) => {
            onNote(body);
            setNoteOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ================================================================== *
 * Quiet row (compact)
 * ================================================================== */

function QuietRow({
  group,
  snoozeInfo,
  onClickRow,
}: {
  group: ProcessingGroup;
  snoozeInfo?: { reason: string; until: string };
  onClickRow: () => void;
}) {
  const reason = snoozeInfo
    ? "snoozed"
    : group.quietReason ?? "no_activity";
  const labels: Record<string, string> = {
    holiday: "Holiday",
    monthly: "Monthly cycle — not due today",
    snoozed: "Snoozed",
    no_activity: "No activity",
  };
  return (
    <button
      type="button"
      onClick={onClickRow}
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-left hover:bg-neutral-100"
    >
      <Dot tone="neutral" />
      <span className="font-medium text-neutral-700">{group.clientName}</span>
      <span className="text-sm text-neutral-500">· {group.processingGroupName}</span>
      <span className="ml-auto flex items-center gap-2">
        {snoozeInfo && (
          <span className="text-xs text-neutral-400">
            until {snoozeInfo.until}
          </span>
        )}
        <Badge tone="muted">{labels[reason]}</Badge>
        <Badge tone="neutral">{group.region}</Badge>
      </span>
    </button>
  );
}

/* ================================================================== *
 * Pipeline row
 * ================================================================== */

function PipelineRow({
  ref,
  group,
  now,
  density,
  ackBy,
  highlighted,
  pulsing,
  onChevron,
  onLabel,
}: {
  ref?: React.Ref<HTMLDivElement>;
  group: ProcessingGroup;
  now: number;
  density: "compact" | "comfortable";
  ackBy?: string;
  highlighted: boolean;
  pulsing: boolean;
  onChevron: (stageId: string) => void;
  onLabel: () => void;
}) {
    const status = groupStatus(group, now);
    const cadenceLabel: Record<Cadence, string> = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      ad_hoc: "Ad hoc",
    };

    // Sub-metadata sentence
    const nextStage = group.stages.find(
      (s) => s.status === "in_progress" || s.status === "breached",
    );
    let sub: string;
    if (group.isHolidayToday) sub = "Holiday — no processing today";
    else if (status === "at_risk" && nextStage)
      sub = `${nextStage.name} ${nextStage.status === "breached" ? "breached" : "at risk"} · ${fmtCountdown(offToTs(nextStage.deadlineOffsetMin), now)}`;
    else if (nextStage)
      sub = `Next: ${nextStage.name} due ${fmtClock(offToTs(nextStage.deadlineOffsetMin))} · ${fmtCountdown(offToTs(nextStage.deadlineOffsetMin), now)}`;
    else sub = "All stages complete";

    return (
      <div
        ref={ref}
        onClick={onLabel}
        className={`cursor-pointer rounded-lg border bg-white px-4 transition ${
          density === "compact" ? "py-2.5" : "py-4"
        } ${
          pulsing
            ? "border-blue-400 ring-2 ring-blue-300"
            : highlighted
              ? "border-neutral-300 bg-neutral-50"
              : "border-neutral-200 hover:border-neutral-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">{group.clientName}</span>
          <span className="text-sm text-neutral-500">{group.processingGroupName}</span>
          <Badge tone="muted">{cadenceLabel[group.cadence]}</Badge>
          <Badge tone="neutral">{group.region}</Badge>
          <span className="ml-auto">
            <StatusPill status={status} />
          </span>
        </div>

        <p className="mt-1 font-mono text-xs text-neutral-500">{sub}</p>

        <div
          className="mt-2.5 flex items-center gap-1 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {group.stages.map((s, i) => (
            <div key={s.id} className="flex items-center">
              {i > 0 && <span className="px-0.5 text-neutral-300">—</span>}
              <Chevron
                stage={s}
                now={now}
                ackBy={ackBy && s.id === group.currentStageId ? ackBy : undefined}
                onClick={() => onChevron(s.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
}

/* ================================================================== *
 * Empty state
 * ================================================================== */

function EmptyState({
  text,
  sub,
  icon,
  tone = "neutral",
  large = false,
}: {
  text: string;
  sub?: string;
  icon?: string;
  tone?: "neutral" | "ok";
  large?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        large ? "rounded-lg border border-dashed border-neutral-200 py-16" : "py-6"
      }`}
    >
      {icon && (
        <span
          className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm ${
            tone === "ok"
              ? "bg-emerald-100 text-emerald-600"
              : "bg-neutral-100 text-neutral-400"
          }`}
        >
          {icon}
        </span>
      )}
      <p className={`font-medium text-neutral-500 ${large ? "text-lg" : "text-sm"}`}>
        {text}
      </p>
      {sub && <p className="mt-1 text-sm text-neutral-400">{sub}</p>}
    </div>
  );
}

/* ================================================================== *
 * Volumes (§7) — lightweight CSS bar charts (no new chart lib)
 * ================================================================== */

function Volumes({ now }: { now: number }) {
  const aggregate = [
    { stage: "Rebalance", typical: 240, required: 180, benchmark: 210 },
    { stage: "Estimates", typical: 190, required: 160, benchmark: 175 },
    { stage: "Actuals", typical: 220, required: 200, benchmark: 205 },
  ];
  const maxAgg = Math.max(...aggregate.flatMap((a) => [a.typical, a.required, a.benchmark]));

  const clients = GROUPS.map((g) => ({
    name: g.clientName,
    count: 40 + ((g.id.length * 13) % 220),
    status: groupStatus(g, now),
  })).sort((a, b) => b.count - a.count);
  const maxClient = Math.max(...clients.map((c) => c.count));

  const barColor = (st: RowStatus) =>
    st === "at_risk"
      ? "bg-red-400"
      : st === "watch"
        ? "bg-amber-400"
        : "bg-neutral-300";

  return (
    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Aggregate */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-medium text-neutral-700">
          Processing Summary (aggregate)
        </h3>
        <div className="flex flex-col gap-4">
          {aggregate.map((a) => (
            <div key={a.stage}>
              <div className="mb-1 text-xs text-neutral-500">{a.stage}</div>
              <div className="flex items-end gap-2">
                {(["typical", "required", "benchmark"] as const).map((k) => (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t bg-neutral-400"
                        style={{ height: `${(a[k] / maxAgg) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-neutral-400">
                      {a[k]}
                    </span>
                    <span className="text-[9px] text-neutral-400 capitalize">{k}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client level */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-medium text-neutral-700">
          Client Level Summary
        </h3>
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <div key={c.name} className="flex items-center gap-2" title={`${c.name}: ${c.count}`}>
              <span className="w-28 truncate text-xs text-neutral-600">{c.name}</span>
              <div className="h-4 flex-1 rounded bg-neutral-100">
                <div
                  className={`h-full rounded ${barColor(c.status)}`}
                  style={{ width: `${(c.count / maxClient) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-[10px] text-neutral-400">
                {c.count}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3 text-xs">
          <button className="text-blue-600 hover:underline">Export to CSV</button>
          <button className="text-blue-600 hover:underline">
            Open full reporting view →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Drawer (§8)
 * ================================================================== */

function Drawer({
  group,
  stageId,
  now,
  ackBy,
  extraNotes,
  onClose,
  onAcknowledge,
  onAddNote,
}: {
  group: ProcessingGroup;
  stageId: string | null;
  now: number;
  ackBy?: string;
  extraNotes: Note[];
  onClose: () => void;
  onAcknowledge: () => void;
  onAddNote: (body: string) => void;
}) {
  const stage =
    group.stages.find((s) => s.id === stageId) ??
    group.stages.find((s) => s.id === group.currentStageId) ??
    group.stages[0];
  const [noteDraft, setNoteDraft] = useState("");
  const allNotes = [...group.notes, ...extraNotes];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sev = chevronSeverity(stage, now);
  const sevLabel: Record<string, string> = {
    complete: "Complete",
    on_track: "On track",
    watch: "Approaching deadline",
    at_risk: "Breached / imminent",
    holiday: "Holiday — N/A",
    active: "In progress",
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-neutral-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute top-0 right-0 flex h-full w-[480px] flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-neutral-200 px-5 py-4">
          <button
            onClick={onClose}
            className="mb-2 text-sm text-neutral-400 hover:text-neutral-700"
          >
            ← Close
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">{group.clientName}</span>
            <span className="text-neutral-500">· {group.processingGroupName}</span>
          </div>
          <div className="mt-1 text-sm text-neutral-600">{stage.name}</div>
          <div className="mt-2 flex gap-1.5">
            <Badge tone="muted">{group.cadence}</Badge>
            <Badge tone="neutral">{group.region}</Badge>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <Section label="Status">
            <span
              className={`inline-flex items-center gap-2 font-medium ${
                sev === "at_risk"
                  ? "text-red-600"
                  : sev === "watch"
                    ? "text-amber-600"
                    : "text-neutral-700"
              }`}
            >
              {sevLabel[sev]}
              {stage.deadlineOffsetMin != null && sev !== "complete" && (
                <span className="font-mono text-xs">
                  · {fmtCountdown(offToTs(stage.deadlineOffsetMin), now)}
                </span>
              )}
            </span>
          </Section>

          <Section label="Deadline">
            <span className="text-neutral-700">
              {fmtClock(offToTs(stage.deadlineOffsetMin))} EST · {stage.cutoffLabel}
            </span>
          </Section>

          {(stage.rebalancedCount || stage.largeRedemptions != null) && (
            <Section label="Current figures">
              <div className="space-y-1 text-neutral-700">
                {stage.rebalancedCount && (
                  <div>
                    Rebalanced: {stage.rebalancedCount.done}/{stage.rebalancedCount.total}
                  </div>
                )}
                {stage.largeRedemptions != null && (
                  <div>Large redemptions: {stage.largeRedemptions} detected</div>
                )}
                <div>Benchmark: {stage.cutoffLabel}</div>
              </div>
            </Section>
          )}

          <Section label="Activity">
            <ul className="space-y-1.5 text-neutral-600">
              {stage.startedOffsetMin != null && (
                <li className="font-mono text-xs">
                  {fmtClock(offToTs(stage.startedOffsetMin))} · System · Stage opened
                </li>
              )}
              {stage.completedOffsetMin != null && (
                <li className="font-mono text-xs">
                  {fmtClock(offToTs(stage.completedOffsetMin))} · System · Completed
                </li>
              )}
              {ackBy && (
                <li className="font-mono text-xs text-blue-700">
                  {fmtClock(now)} · {ackBy} · Acknowledged
                </li>
              )}
            </ul>
          </Section>

          <Section label="Notes">
            {allNotes.length === 0 ? (
              <p className="text-neutral-400">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {allNotes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-700"
                  >
                    <p>"{n.body}"</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      — {n.author}, {fmtClock(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (noteDraft.trim()) {
                    onAddNote(noteDraft.trim());
                    setNoteDraft("");
                  }
                }}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
              >
                Add
              </button>
            </div>
          </Section>
        </div>

        {/* Actions */}
        <div className="space-y-2 border-t border-neutral-200 px-5 py-4">
          <button className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Open in Trading System
          </button>
          <div className="flex gap-2">
            <button
              onClick={onAcknowledge}
              disabled={!!ackBy}
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            >
              {ackBy ? "Acknowledged" : "Acknowledge"}
            </button>
            <button className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              Escalate
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold tracking-widest text-neutral-400 uppercase">
        {label}
      </h4>
      {children}
    </div>
  );
}

/* ================================================================== *
 * Modals
 * ================================================================== */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} />
      <div className="relative w-[420px] rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function SnoozeModal({
  group,
  onClose,
  onConfirm,
}: {
  group: ProcessingGroup;
  onClose: () => void;
  onConfirm: (reason: string, until: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const valid = reason.trim().length > 0 && until.length > 0;
  return (
    <ModalShell
      title={`Snooze — ${group.clientName} · ${group.processingGroupName}`}
      onClose={onClose}
    >
      <label className="block text-xs font-medium text-neutral-600">
        Reason (required)
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="e.g. Known feed delay, expected resolved by 13:00"
      />
      <label className="mt-3 block text-xs font-medium text-neutral-600">
        Snooze until (required)
      </label>
      <input
        type="datetime-local"
        value={until}
        onChange={(e) => setUntil(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onConfirm(
              reason.trim(),
              until ? new Date(until).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "",
            )
          }
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          Snooze
        </button>
      </div>
    </ModalShell>
  );
}

function NoteModal({
  group,
  onClose,
  onConfirm,
}: {
  group: ProcessingGroup;
  onClose: () => void;
  onConfirm: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <ModalShell
      title={`Note — ${group.clientName} · ${group.processingGroupName}`}
      onClose={onClose}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        autoFocus
        className="w-full rounded-md border border-neutral-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="Add a note visible to anyone viewing this row…"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          disabled={!body.trim()}
          onClick={() => onConfirm(body.trim())}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          Save note
        </button>
      </div>
    </ModalShell>
  );
}
