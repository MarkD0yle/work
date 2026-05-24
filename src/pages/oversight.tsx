import {
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const title = "Oversight";
export const fullWidth = true;

/* ================================================================== *
 * Currency Management — "Oversight" workspace
 *
 * Airtable, but for an FX / currency-management operations desk.
 * One base table of client processing groups, viewed three ways:
 *   • Grid       — typed fields, grouping, sorting, summary footer
 *   • Heat Map   — rows × lifecycle stages, complete oversight at a glance
 *   • Markets    — holiday closures + the clients each closure touches
 *
 * Design rule inherited from the Heat Map page:
 *   COMPLETE = NEUTRAL GREY, NOT GREEN.
 * Calm is the default. Colour is the exception — the eye is only ever
 * pulled to amber (watch) and red (act now).
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * Clock — pinned to the scenario time so the data reads coherently.
 * ------------------------------------------------------------------ */

const NOW = new Date("2026-05-23T09:22:00-04:00"); // Sat 23 May 2026, 09:22 EST

/* ------------------------------------------------------------------ *
 * Data model
 * ------------------------------------------------------------------ */

type Region = "Lux" | "London" | "Tokyo" | "New York";
type Cadence = "Daily" | "Weekly" | "Monthly" | "Quarterly";
type Health = "act_now" | "watch" | "quiet";

type StageStatus =
  | "complete"
  | "in_progress"
  | "pending"
  | "not_started"
  | "at_risk"
  | "breached"
  | "holiday";

/** The fixed lifecycle every processing group moves through each cycle.
 *  These are the columns of the "complete oversight" heat grid. */
const STAGES = [
  "Rebalance",
  "Estimates",
  "Trades",
  "Actuals",
  "NAV Strike",
  "Reporting",
] as const;
type StageName = (typeof STAGES)[number];

type Stage = {
  name: StageName;
  status: StageStatus;
  /** clock time the stage is due, as an ISO string; null = no hard cutoff */
  due: string | null;
  note?: string;
};

type Person = { name: string; initials: string };

type Record_ = {
  id: string;
  client: string;
  group: string;
  region: Region;
  cadence: Cadence;
  owner: Person;
  aum: number; // USD
  baseCcy: string;
  /** market codes this group's pricing/settlement depends on */
  markets: string[];
  stages: Stage[];
  /** id of the stage currently in flight */
  currentStage: StageName | null;
  /** hard desk cutoff for the whole cycle */
  cutoff: string;
  isMine: boolean;
  notes: { author: string; at: string; body: string }[];
};

/* ------------------------------------------------------------------ *
 * Mock book — calm / busy / holiday / crisis blended
 * ------------------------------------------------------------------ */

const P = {
  howard: { name: "Howard W", initials: "HW" },
  mary: { name: "Mary K", initials: "MK" },
  sanjay: { name: "Sanjay P", initials: "SP" },
  lena: { name: "Lena R", initials: "LR" },
  tomos: { name: "Tomos B", initials: "TB" },
  yuki: { name: "Yuki N", initials: "YN" },
} satisfies Record<string, Person>;

const iso = (h: number, m: number) => {
  const d = new Date(NOW);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const RECORDS: Record_[] = [
  {
    id: "cohen-capstock",
    client: "Cohen & Steers",
    group: "Capstock",
    region: "Lux",
    cadence: "Daily",
    owner: P.howard,
    aum: 4_120_000_000,
    baseCcy: "USD",
    markets: ["USD", "EUR", "GBP"],
    currentStage: "Actuals",
    cutoff: iso(16, 0),
    isMine: true,
    notes: [
      { author: "Howard W", at: iso(9, 13), body: "Pune team chasing the actuals feed — Mary on it." },
    ],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(7, 16) },
      { name: "Estimates", status: "complete", due: iso(8, 31) },
      { name: "Trades", status: "complete", due: iso(8, 55) },
      { name: "Actuals", status: "breached", due: iso(9, 0), note: "File expected 09:30, not received. Escalate by 11:00." },
      { name: "NAV Strike", status: "pending", due: iso(13, 0) },
      { name: "Reporting", status: "not_started", due: iso(16, 0) },
    ],
  },
  {
    id: "ishares-nav",
    client: "iShares",
    group: "STT Daily NAV Rebalance",
    region: "Lux",
    cadence: "Daily",
    owner: P.mary,
    aum: 11_800_000_000,
    baseCcy: "USD",
    markets: ["USD", "EUR", "GBP", "JPY"],
    currentStage: "Estimates",
    cutoff: iso(16, 0),
    isMine: true,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(7, 10) },
      { name: "Estimates", status: "at_risk", due: iso(12, 0), note: "Large redemption flagged — 2 detected, NAV impact review needed." },
      { name: "Trades", status: "not_started", due: iso(13, 30) },
      { name: "Actuals", status: "not_started", due: iso(14, 30) },
      { name: "NAV Strike", status: "not_started", due: iso(15, 0) },
      { name: "Reporting", status: "not_started", due: iso(16, 0) },
    ],
  },
  {
    id: "pimco-income",
    client: "PIMCO",
    group: "Income Fund Estimates",
    region: "London",
    cadence: "Daily",
    owner: P.tomos,
    aum: 6_540_000_000,
    baseCcy: "GBP",
    markets: ["GBP", "USD", "EUR"],
    currentStage: "Estimates",
    cutoff: iso(11, 30),
    isMine: false,
    notes: [
      { author: "Tomos B", at: iso(9, 5), body: "Estimate trade booked in error — needs reversing before actuals run." },
    ],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(7, 40) },
      { name: "Estimates", status: "at_risk", due: iso(11, 30), note: "Estimate trade not reversed before actuals run. Reverse before 11:30." },
      { name: "Trades", status: "pending", due: iso(12, 15) },
      { name: "Actuals", status: "not_started", due: iso(13, 45) },
      { name: "NAV Strike", status: "not_started", due: iso(15, 0) },
      { name: "Reporting", status: "not_started", due: iso(16, 30) },
    ],
  },
  {
    id: "vanguard-global",
    client: "Vanguard",
    group: "Global Equity Hedge",
    region: "London",
    cadence: "Daily",
    owner: P.lena,
    aum: 9_220_000_000,
    baseCcy: "USD",
    markets: ["USD", "EUR", "GBP", "CHF"],
    currentStage: "Trades",
    cutoff: iso(16, 0),
    isMine: false,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(7, 5) },
      { name: "Estimates", status: "complete", due: iso(8, 20) },
      { name: "Trades", status: "in_progress", due: iso(11, 0), note: "287 orders staged, 41 confirmed." },
      { name: "Actuals", status: "not_started", due: iso(14, 0) },
      { name: "NAV Strike", status: "not_started", due: iso(15, 0) },
      { name: "Reporting", status: "not_started", due: iso(16, 0) },
    ],
  },
  {
    id: "blackrock-em",
    client: "BlackRock",
    group: "EM Local Currency",
    region: "New York",
    cadence: "Daily",
    owner: P.sanjay,
    aum: 3_080_000_000,
    baseCcy: "USD",
    markets: ["USD", "BRL", "MXN", "ZAR"],
    currentStage: "Rebalance",
    cutoff: iso(17, 0),
    isMine: false,
    notes: [],
    stages: [
      { name: "Rebalance", status: "in_progress", due: iso(10, 30) },
      { name: "Estimates", status: "not_started", due: iso(12, 30) },
      { name: "Trades", status: "not_started", due: iso(14, 0) },
      { name: "Actuals", status: "not_started", due: iso(15, 30) },
      { name: "NAV Strike", status: "not_started", due: iso(16, 30) },
      { name: "Reporting", status: "not_started", due: iso(17, 0) },
    ],
  },
  {
    id: "ssga-balanced",
    client: "State Street GA",
    group: "Balanced Multi-Asset",
    region: "New York",
    cadence: "Daily",
    owner: P.sanjay,
    aum: 7_650_000_000,
    baseCcy: "USD",
    markets: ["USD", "EUR", "CAD"],
    currentStage: "Reporting",
    cutoff: iso(17, 0),
    isMine: true,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(6, 50) },
      { name: "Estimates", status: "complete", due: iso(8, 10) },
      { name: "Trades", status: "complete", due: iso(9, 0) },
      { name: "Actuals", status: "complete", due: iso(9, 15) },
      { name: "NAV Strike", status: "complete", due: iso(9, 20) },
      { name: "Reporting", status: "in_progress", due: iso(12, 0) },
    ],
  },
  {
    id: "fidelity-target",
    client: "Fidelity",
    group: "Target Date 2045",
    region: "London",
    cadence: "Weekly",
    owner: P.lena,
    aum: 2_410_000_000,
    baseCcy: "GBP",
    markets: ["GBP", "USD"],
    currentStage: "Estimates",
    cutoff: iso(16, 0),
    isMine: false,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(7, 30) },
      { name: "Estimates", status: "in_progress", due: iso(12, 0) },
      { name: "Trades", status: "pending", due: iso(13, 30) },
      { name: "Actuals", status: "not_started", due: iso(14, 30) },
      { name: "NAV Strike", status: "not_started", due: iso(15, 30) },
      { name: "Reporting", status: "not_started", due: iso(16, 0) },
    ],
  },
  {
    id: "nomura-japan",
    client: "Nomura AM",
    group: "Japan Core Equity",
    region: "Tokyo",
    cadence: "Daily",
    owner: P.yuki,
    aum: 1_980_000_000,
    baseCcy: "JPY",
    markets: ["JPY"],
    currentStage: null,
    cutoff: iso(16, 0),
    isMine: false,
    notes: [
      { author: "Yuki N", at: iso(8, 40), body: "Tokyo closed — no rebalance today. Resumes next session." },
    ],
    stages: [
      { name: "Rebalance", status: "holiday", due: null },
      { name: "Estimates", status: "holiday", due: null },
      { name: "Trades", status: "holiday", due: null },
      { name: "Actuals", status: "holiday", due: null },
      { name: "NAV Strike", status: "holiday", due: null },
      { name: "Reporting", status: "holiday", due: null },
    ],
  },
  {
    id: "amundi-credit",
    client: "Amundi",
    group: "Euro Credit Short Dur",
    region: "Lux",
    cadence: "Daily",
    owner: P.howard,
    aum: 5_300_000_000,
    baseCcy: "EUR",
    markets: ["EUR", "USD"],
    currentStage: "NAV Strike",
    cutoff: iso(16, 0),
    isMine: true,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(7, 0) },
      { name: "Estimates", status: "complete", due: iso(8, 0) },
      { name: "Trades", status: "complete", due: iso(9, 0) },
      { name: "Actuals", status: "complete", due: iso(9, 30) },
      { name: "NAV Strike", status: "in_progress", due: iso(13, 0) },
      { name: "Reporting", status: "not_started", due: iso(16, 0) },
    ],
  },
  {
    id: "schroders-multi",
    client: "Schroders",
    group: "Multi-Asset Income",
    region: "London",
    cadence: "Monthly",
    owner: P.tomos,
    aum: 3_760_000_000,
    baseCcy: "GBP",
    markets: ["GBP", "EUR", "USD", "CHF"],
    currentStage: null,
    cutoff: iso(16, 0),
    isMine: false,
    notes: [{ author: "Tomos B", at: iso(8, 0), body: "Monthly cycle — next run 29 May." }],
    stages: [
      { name: "Rebalance", status: "not_started", due: null },
      { name: "Estimates", status: "not_started", due: null },
      { name: "Trades", status: "not_started", due: null },
      { name: "Actuals", status: "not_started", due: null },
      { name: "NAV Strike", status: "not_started", due: null },
      { name: "Reporting", status: "not_started", due: null },
    ],
  },
  {
    id: "wellington-global",
    client: "Wellington",
    group: "Global Bond Aggregate",
    region: "New York",
    cadence: "Daily",
    owner: P.sanjay,
    aum: 8_140_000_000,
    baseCcy: "USD",
    markets: ["USD", "EUR", "JPY", "GBP"],
    currentStage: "Actuals",
    cutoff: iso(17, 0),
    isMine: false,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(6, 40) },
      { name: "Estimates", status: "complete", due: iso(8, 5) },
      { name: "Trades", status: "complete", due: iso(9, 10) },
      { name: "Actuals", status: "in_progress", due: iso(14, 0) },
      { name: "NAV Strike", status: "not_started", due: iso(16, 0) },
      { name: "Reporting", status: "not_started", due: iso(17, 0) },
    ],
  },
  {
    id: "jpmam-liquidity",
    client: "JPMAM",
    group: "USD Liquidity",
    region: "New York",
    cadence: "Daily",
    owner: P.mary,
    aum: 14_500_000_000,
    baseCcy: "USD",
    markets: ["USD"],
    currentStage: "Reporting",
    cutoff: iso(17, 0),
    isMine: true,
    notes: [],
    stages: [
      { name: "Rebalance", status: "complete", due: iso(6, 30) },
      { name: "Estimates", status: "complete", due: iso(7, 45) },
      { name: "Trades", status: "complete", due: iso(8, 30) },
      { name: "Actuals", status: "complete", due: iso(9, 0) },
      { name: "NAV Strike", status: "complete", due: iso(9, 10) },
      { name: "Reporting", status: "complete", due: iso(9, 20) },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Markets & holiday closures
 * ------------------------------------------------------------------ */

type MarketState = "open" | "closed" | "half";
type Market = {
  code: string; // currency / market code
  name: string;
  ccy: string;
  today: MarketState;
};

const MARKETS: Market[] = [
  { code: "USD", name: "New York", ccy: "USD", today: "open" },
  { code: "GBP", name: "London", ccy: "GBP", today: "open" },
  { code: "EUR", name: "Luxembourg", ccy: "EUR", today: "closed" },
  { code: "CHF", name: "Zurich", ccy: "CHF", today: "open" },
  { code: "JPY", name: "Tokyo", ccy: "JPY", today: "closed" },
  { code: "CAD", name: "Toronto", ccy: "CAD", today: "open" },
  { code: "BRL", name: "São Paulo", ccy: "BRL", today: "open" },
  { code: "MXN", name: "Mexico City", ccy: "MXN", today: "open" },
  { code: "ZAR", name: "Johannesburg", ccy: "ZAR", today: "open" },
];

/** Forward calendar — keyed by market code → { date → closure }. */
type Closure = { state: MarketState; reason: string };
const CALENDAR_DAYS = [
  "2026-05-23",
  "2026-05-25",
  "2026-05-26",
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-06-01",
];

const CLOSURES: Record<string, Record<string, Closure>> = {
  USD: { "2026-05-25": { state: "closed", reason: "Memorial Day" } },
  GBP: { "2026-05-25": { state: "closed", reason: "Spring Bank Holiday" } },
  EUR: {
    "2026-05-23": { state: "closed", reason: "Weekend" },
    "2026-05-25": { state: "half", reason: "Whit Monday (early close)" },
  },
  JPY: {
    "2026-05-23": { state: "closed", reason: "Weekend" },
  },
  CHF: { "2026-06-01": { state: "closed", reason: "Whit Monday" } },
  BRL: { "2026-06-01": { state: "closed", reason: "Corpus Christi (regional)" } },
};

/* ------------------------------------------------------------------ *
 * Palette — calm grey by default, heat builds amber → red
 * ------------------------------------------------------------------ */

const STAGE_TILE: Record<StageStatus, { cls: string; glyph?: string; label: string }> = {
  complete: { cls: "bg-neutral-200 text-neutral-500", label: "Complete" },
  in_progress: { cls: "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-300", label: "In progress" },
  pending: { cls: "bg-neutral-100 text-neutral-400", label: "Pending" },
  not_started: { cls: "bg-neutral-50 text-neutral-300 ring-1 ring-inset ring-neutral-200", label: "Not started" },
  at_risk: { cls: "bg-amber-300 text-amber-950", glyph: "▲", label: "At risk" },
  breached: { cls: "bg-red-500 text-white", glyph: "×", label: "Breached" },
  holiday: { cls: "bg-[repeating-linear-gradient(45deg,#f4f4f5,#f4f4f5_6px,#e7e7ea_6px,#e7e7ea_12px)] text-neutral-400", label: "Holiday" },
};

const HEALTH_META: Record<Health, { label: string; cls: string; dot: string }> = {
  act_now: { label: "Act now", cls: "border-red-300 bg-red-50 text-red-700", dot: "bg-red-500" },
  watch: { label: "Watch", cls: "border-amber-300 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  quiet: { label: "Quiet", cls: "border-neutral-200 bg-neutral-50 text-neutral-500", dot: "bg-neutral-300" },
};

const REGION_CHIP: Record<Region, string> = {
  Lux: "bg-violet-50 text-violet-700 ring-violet-200",
  London: "bg-sky-50 text-sky-700 ring-sky-200",
  Tokyo: "bg-rose-50 text-rose-700 ring-rose-200",
  "New York": "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const CADENCE_CHIP: Record<Cadence, string> = {
  Daily: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  Weekly: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Monthly: "bg-amber-50 text-amber-700 ring-amber-200",
  Quarterly: "bg-teal-50 text-teal-700 ring-teal-200",
};

const MARKET_STATE_META: Record<MarketState, { label: string; cls: string; dot: string }> = {
  open: { label: "Open", cls: "border-emerald-300 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  half: { label: "Half day", cls: "border-amber-300 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  closed: { label: "Closed", cls: "border-neutral-300 bg-neutral-100 text-neutral-500", dot: "bg-neutral-400" },
};

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

function healthOf(r: Record_): Health {
  if (r.stages.some((s) => s.status === "breached")) return "act_now";
  if (r.stages.some((s) => s.status === "at_risk")) return "watch";
  return "quiet";
}

function completion(r: Record_): { done: number; total: number } {
  const live = r.stages.filter((s) => s.status !== "holiday");
  const done = live.filter((s) => s.status === "complete").length;
  return { done, total: live.length || r.stages.length };
}

const fmtAum = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`;

function fmtTime(isoStr: string | null) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Human countdown to a cutoff relative to NOW. */
function countdown(isoStr: string): { label: string; tone: "red" | "amber" | "neutral" } {
  const diffMin = Math.round((new Date(isoStr).getTime() - NOW.getTime()) / 60000);
  if (diffMin < 0) return { label: `${Math.abs(diffMin)}m ago`, tone: "red" };
  if (diffMin <= 30) return { label: `${diffMin}m`, tone: "amber" };
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return { label: h > 0 ? `${h}h ${m}m` : `${m}m`, tone: "neutral" };
}

/* ------------------------------------------------------------------ *
 * Small UI atoms
 * ------------------------------------------------------------------ */

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400 ${className}`}
    >
      {children}
    </th>
  );
}

function Chip({ children, cls }: { children: ReactNode; cls: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

function Avatar({ person }: { person: Person }) {
  return (
    <span
      title={person.name}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-white"
    >
      {person.initials}
    </span>
  );
}

function HealthPill({ health }: { health: Health }) {
  const m = HEALTH_META[health];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StageTile({
  stage,
  size = "sm",
  onClick,
}: {
  stage: Stage;
  size?: "sm" | "lg";
  onClick?: () => void;
}) {
  const m = STAGE_TILE[stage.status];
  const dim = size === "lg" ? "h-9 min-w-[3.25rem]" : "h-6 w-6";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${stage.name} · ${m.label}${stage.due ? ` · due ${fmtTime(stage.due)}` : ""}${
        stage.note ? `\n${stage.note}` : ""
      }`}
      className={`flex ${dim} items-center justify-center rounded-md text-[11px] font-semibold transition hover:opacity-80 ${m.cls}`}
    >
      {m.glyph ?? (size === "lg" ? fmtTime(stage.due).replace(/^—$/, "") : "")}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Toolbar primitives
 * ------------------------------------------------------------------ */

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-neutral-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            value === o.value
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600">
      <span className="text-neutral-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent font-medium text-neutral-800 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

type View = "grid" | "heat" | "markets";
type GroupBy = "none" | "region" | "cadence" | "owner" | "health";
type SortBy = "client" | "aum" | "cutoff" | "health";
type Quick = "all" | "mine" | "risk";

const FIELDS = ["region", "cadence", "owner", "aum", "base", "markets", "notes"] as const;
type FieldKey = (typeof FIELDS)[number];
const FIELD_LABEL: Record<FieldKey, string> = {
  region: "Region",
  cadence: "Cadence",
  owner: "Owner",
  aum: "AUM",
  base: "Base",
  markets: "Markets",
  notes: "Notes",
};

const HEALTH_RANK: Record<Health, number> = { act_now: 0, watch: 1, quiet: 2 };

export default function Oversight() {
  const [view, setView] = useState<View>("grid");
  const [groupBy, setGroupBy] = useState<GroupBy>("region");
  const [sortBy, setSortBy] = useState<SortBy>("health");
  const [quick, setQuick] = useState<Quick>("all");
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(true);
  const [hidden, setHidden] = useState<Set<FieldKey>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Record_ | null>(null);
  const [fieldMenu, setFieldMenu] = useState(false);

  const filtered = useMemo(() => {
    let rows = RECORDS.slice();
    if (quick === "mine") rows = rows.filter((r) => r.isMine);
    if (quick === "risk") rows = rows.filter((r) => healthOf(r) !== "quiet");
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.client.toLowerCase().includes(q) ||
          r.group.toLowerCase().includes(q) ||
          r.owner.name.toLowerCase().includes(q) ||
          r.markets.some((m) => m.toLowerCase().includes(q)),
      );
    }
    rows.sort((a, b) => {
      switch (sortBy) {
        case "client":
          return a.client.localeCompare(b.client);
        case "aum":
          return b.aum - a.aum;
        case "cutoff":
          return new Date(a.cutoff).getTime() - new Date(b.cutoff).getTime();
        case "health":
          return (
            HEALTH_RANK[healthOf(a)] - HEALTH_RANK[healthOf(b)] || b.aum - a.aum
          );
      }
    });
    return rows;
  }, [quick, search, sortBy]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "All records", rows: filtered }];
    const map = new Map<string, Record_[]>();
    for (const r of filtered) {
      const key =
        groupBy === "region"
          ? r.region
          : groupBy === "cadence"
            ? r.cadence
            : groupBy === "owner"
              ? r.owner.name
              : HEALTH_META[healthOf(r)].label;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, rows]) => ({ key, rows }));
  }, [filtered, groupBy]);

  const totals = useMemo(() => {
    const aum = filtered.reduce((s, r) => s + r.aum, 0);
    const stages = filtered.flatMap((r) => r.stages.filter((s) => s.status !== "holiday"));
    const done = stages.filter((s) => s.status === "complete").length;
    const breaches = filtered.filter((r) => healthOf(r) === "act_now").length;
    const watch = filtered.filter((r) => healthOf(r) === "watch").length;
    return { aum, pct: stages.length ? Math.round((done / stages.length) * 100) : 0, breaches, watch };
  }, [filtered]);

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleField = (f: FieldKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const show = (f: FieldKey) => !hidden.has(f);

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900">
      <HeaderBar totals={totals} count={filtered.length} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-5 py-2">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "▦ Grid" },
            { value: "heat", label: "▤ Heat Map" },
            { value: "markets", label: "◷ Markets" },
          ]}
        />
        <div className="mx-1 h-5 w-px bg-neutral-200" />

        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients, groups, markets…"
            className="w-56 rounded-md border border-neutral-200 bg-white py-1 pl-7 pr-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400">
            ⌕
          </span>
        </div>

        {view !== "markets" && (
          <>
            <Select<GroupBy>
              label="Group"
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { value: "none", label: "None" },
                { value: "region", label: "Region" },
                { value: "cadence", label: "Cadence" },
                { value: "owner", label: "Owner" },
                { value: "health", label: "Health" },
              ]}
            />
            <Select<SortBy>
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "health", label: "Health" },
                { value: "client", label: "Client" },
                { value: "aum", label: "AUM" },
                { value: "cutoff", label: "Cutoff" },
              ]}
            />
          </>
        )}

        {view === "grid" && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setFieldMenu((v) => !v)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              ⊞ Fields{hidden.size ? ` · ${FIELDS.length - hidden.size}/${FIELDS.length}` : ""}
            </button>
            {fieldMenu && (
              <div
                className="absolute left-0 top-9 z-30 w-44 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
                onMouseLeave={() => setFieldMenu(false)}
              >
                {FIELDS.map((f) => (
                  <label
                    key={f}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={show(f)}
                      onChange={() => toggleField(f)}
                      className="accent-neutral-800"
                    />
                    {FIELD_LABEL[f]}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Segmented<Quick>
            value={quick}
            onChange={setQuick}
            options={[
              { value: "all", label: "All" },
              { value: "mine", label: "My clients" },
              { value: "risk", label: "At risk" },
            ]}
          />
          {view !== "markets" && (
            <Segmented<"compact" | "comfortable">
              value={compact ? "compact" : "comfortable"}
              onChange={(v) => setCompact(v === "compact")}
              options={[
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfortable" },
              ]}
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {view === "grid" && (
          <GridView
            groups={groups}
            groupBy={groupBy}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            show={show}
            compact={compact}
            onOpen={setSelected}
            totals={totals}
            count={filtered.length}
          />
        )}
        {view === "heat" && (
          <HeatView
            groups={groups}
            groupBy={groupBy}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            compact={compact}
            onOpen={setSelected}
            rows={filtered}
          />
        )}
        {view === "markets" && <MarketsView onOpen={setSelected} />}
      </div>

      {selected && <RecordDrawer record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Header strip
 * ------------------------------------------------------------------ */

function HeaderBar({
  totals,
  count,
}: {
  totals: { aum: number; pct: number; breaches: number; watch: number };
  count: number;
}) {
  const dateStr = NOW.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = NOW.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="flex items-center gap-4 border-b border-neutral-200 bg-white px-5 py-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight">Currency Management · Oversight</h1>
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
            BASE TABLE
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">{dateStr}</span>
          <span>·</span>
          <span className="font-mono">{timeStr} EST</span>
        </div>
      </div>

      <div className="ml-2 flex items-center gap-1.5">
        {MARKETS.filter((m) => ["USD", "GBP", "EUR", "JPY"].includes(m.code)).map((m) => {
          const meta = MARKET_STATE_META[m.today];
          return (
            <span
              key={m.code}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {m.name} {meta.label.toLowerCase()}
            </span>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Stat label="Records" value={String(count)} />
        <Stat label="AUM" value={fmtAum(totals.aum)} />
        <Stat label="Stages done" value={`${totals.pct}%`} />
        <Stat label="Watch" value={String(totals.watch)} tone={totals.watch ? "amber" : undefined} />
        <Stat label="Act now" value={String(totals.breaches)} tone={totals.breaches ? "red" : undefined} />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "red" | "amber";
}) {
  const toneCls =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-neutral-200 bg-white text-neutral-900";
  return (
    <div className={`rounded-lg border px-3 py-1 text-right ${toneCls}`}>
      <div className="text-sm font-semibold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Group header (shared by grid + heat)
 * ------------------------------------------------------------------ */

function GroupHeader({
  label,
  rows,
  collapsed,
  onToggle,
  colSpan,
}: {
  label: string;
  rows: Record_[];
  collapsed: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  const breaches = rows.filter((r) => healthOf(r) === "act_now").length;
  const watch = rows.filter((r) => healthOf(r) === "watch").length;
  const aum = rows.reduce((s, r) => s + r.aum, 0);
  return (
    <tr className="bg-neutral-100/70">
      <td colSpan={colSpan} className="sticky left-0 px-3 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left"
        >
          <span className={`text-neutral-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}>
            ▾
          </span>
          <span className="text-xs font-semibold text-neutral-800">{label}</span>
          <span className="text-[11px] text-neutral-400">{rows.length}</span>
          {breaches > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
              {breaches} act now
            </span>
          )}
          {watch > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {watch} watch
            </span>
          )}
          <span className="ml-1 font-mono text-[11px] text-neutral-400">{fmtAum(aum)}</span>
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Grid view
 * ------------------------------------------------------------------ */

function GridView({
  groups,
  groupBy,
  collapsed,
  onToggleCollapse,
  show,
  compact,
  onOpen,
  totals,
  count,
}: {
  groups: { key: string; rows: Record_[] }[];
  groupBy: GroupBy;
  collapsed: Set<string>;
  onToggleCollapse: (k: string) => void;
  show: (f: FieldKey) => boolean;
  compact: boolean;
  onOpen: (r: Record_) => void;
  totals: { aum: number; pct: number };
  count: number;
}) {
  const rowPad = compact ? "py-1.5" : "py-3";
  const colCount =
    3 + // client, lifecycle, health
    [show("region"), show("cadence"), show("owner"), show("aum"), show("base"), show("markets"), show("notes")].filter(
      Boolean,
    ).length +
    1; // cutoff

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-20">
        <tr className="bg-white shadow-[0_1px_0_0_#e5e5e5]">
          <Th className="sticky left-0 z-10 bg-white">Client · Group</Th>
          {show("region") && <Th>Region</Th>}
          {show("cadence") && <Th>Cadence</Th>}
          {show("owner") && <Th>Owner</Th>}
          {show("aum") && <Th className="text-right">AUM</Th>}
          {show("base") && <Th>Base</Th>}
          <Th>Lifecycle</Th>
          <Th>Cutoff</Th>
          {show("markets") && <Th>Markets</Th>}
          <Th>Health</Th>
          {show("notes") && <Th>Notes</Th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          return (
            <>
              {groupBy !== "none" && (
                <GroupHeader
                  key={`h-${g.key}`}
                  label={g.key}
                  rows={g.rows}
                  collapsed={isCollapsed}
                  onToggle={() => onToggleCollapse(g.key)}
                  colSpan={colCount}
                />
              )}
              {!isCollapsed &&
                g.rows.map((r) => {
                  const health = healthOf(r);
                  const cd = countdown(r.cutoff);
                  const cdCls =
                    cd.tone === "red"
                      ? "text-red-600"
                      : cd.tone === "amber"
                        ? "text-amber-700"
                        : "text-neutral-500";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onOpen(r)}
                      className="group cursor-pointer border-b border-neutral-100 hover:bg-sky-50/40"
                    >
                      <td className={`sticky left-0 z-10 bg-white px-3 group-hover:bg-sky-50/40 ${rowPad}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${HEALTH_META[health].dot}`} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-neutral-900">{r.client}</div>
                            <div className="truncate text-xs text-neutral-400">{r.group}</div>
                          </div>
                          {r.isMine && (
                            <span className="rounded bg-neutral-100 px-1 text-[9px] font-medium text-neutral-500">
                              MINE
                            </span>
                          )}
                        </div>
                      </td>
                      {show("region") && (
                        <td className={`px-3 ${rowPad}`}>
                          <Chip cls={REGION_CHIP[r.region]}>{r.region}</Chip>
                        </td>
                      )}
                      {show("cadence") && (
                        <td className={`px-3 ${rowPad}`}>
                          <Chip cls={CADENCE_CHIP[r.cadence]}>{r.cadence}</Chip>
                        </td>
                      )}
                      {show("owner") && (
                        <td className={`px-3 ${rowPad}`}>
                          <div className="flex items-center gap-2">
                            <Avatar person={r.owner} />
                            {!compact && <span className="text-xs text-neutral-600">{r.owner.name}</span>}
                          </div>
                        </td>
                      )}
                      {show("aum") && (
                        <td className={`px-3 text-right font-mono text-xs tabular-nums text-neutral-700 ${rowPad}`}>
                          {fmtAum(r.aum)}
                        </td>
                      )}
                      {show("base") && (
                        <td className={`px-3 ${rowPad}`}>
                          <span className="font-mono text-xs text-neutral-500">{r.baseCcy}</span>
                        </td>
                      )}
                      <td className={`px-3 ${rowPad}`}>
                        <div className="flex items-center gap-1">
                          {r.stages.map((s) => (
                            <StageTile key={s.name} stage={s} onClick={() => onOpen(r)} />
                          ))}
                        </div>
                      </td>
                      <td className={`px-3 ${rowPad}`}>
                        <span className={`font-mono text-xs ${cdCls}`}>{cd.label}</span>
                        <span className="ml-1 text-[10px] text-neutral-300">{fmtTime(r.cutoff)}</span>
                      </td>
                      {show("markets") && (
                        <td className={`px-3 ${rowPad}`}>
                          <div className="flex flex-wrap gap-1">
                            {r.markets.map((mc) => {
                              const mk = MARKETS.find((m) => m.code === mc);
                              const closed = mk?.today === "closed";
                              return (
                                <span
                                  key={mc}
                                  title={mk ? `${mk.name} · ${MARKET_STATE_META[mk.today].label}` : mc}
                                  className={`rounded px-1 py-0.5 font-mono text-[10px] ${
                                    closed
                                      ? "bg-neutral-200 text-neutral-400 line-through"
                                      : "bg-neutral-100 text-neutral-600"
                                  }`}
                                >
                                  {mc}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      )}
                      <td className={`px-3 ${rowPad}`}>
                        <HealthPill health={health} />
                      </td>
                      {show("notes") && (
                        <td className={`px-3 ${rowPad}`}>
                          {r.notes.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                              💬 {r.notes.length}
                            </span>
                          ) : (
                            <span className="text-neutral-200">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
            </>
          );
        })}
        {/* add-record affordance */}
        <tr>
          <td className="sticky left-0 bg-white px-3 py-2 text-xs text-neutral-400">
            <button type="button" className="hover:text-neutral-700">
              + New processing group
            </button>
          </td>
        </tr>
      </tbody>
      {/* Summary footer */}
      <tfoot className="sticky bottom-0 z-20">
        <tr className="bg-neutral-50 shadow-[0_-1px_0_0_#e5e5e5]">
          <td className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-[11px] font-medium text-neutral-500">
            {count} records
          </td>
          {show("region") && <td />}
          {show("cadence") && <td />}
          {show("owner") && <td />}
          {show("aum") && (
            <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-neutral-700">
              {fmtAum(totals.aum)}
            </td>
          )}
          {show("base") && <td />}
          <td className="px-3 py-2 text-[11px] text-neutral-400">{totals.pct}% complete</td>
          <td />
          {show("markets") && <td />}
          <td />
          {show("notes") && <td />}
        </tr>
      </tfoot>
    </table>
  );
}

/* ------------------------------------------------------------------ *
 * Heat Map view — rows × lifecycle stages, complete oversight
 * ------------------------------------------------------------------ */

function HeatView({
  groups,
  groupBy,
  collapsed,
  onToggleCollapse,
  compact,
  onOpen,
  rows,
}: {
  groups: { key: string; rows: Record_[] }[];
  groupBy: GroupBy;
  collapsed: Set<string>;
  onToggleCollapse: (k: string) => void;
  compact: boolean;
  onOpen: (r: Record_) => void;
  rows: Record_[];
}) {
  const colCount = 1 + STAGES.length + 2; // client + stages + cutoff + health

  // per-stage slot health across all visible rows (mirrors TRACS slot footer)
  const slotHealth = STAGES.map((name) => {
    const live = rows
      .map((r) => r.stages.find((s) => s.name === name))
      .filter((s): s is Stage => !!s && s.status !== "holiday");
    const breached = live.filter((s) => s.status === "breached").length;
    const atRisk = live.filter((s) => s.status === "at_risk").length;
    return { name, breached, atRisk };
  });

  return (
    <div className="p-4">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="bg-neutral-50">
            <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Processing group
            </th>
            {STAGES.map((s) => (
              <th
                key={s}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
              >
                {s}
              </th>
            ))}
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Cutoff
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Health
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <>
                {groupBy !== "none" && (
                  <GroupHeader
                    key={`hh-${g.key}`}
                    label={g.key}
                    rows={g.rows}
                    collapsed={isCollapsed}
                    onToggle={() => onToggleCollapse(g.key)}
                    colSpan={colCount}
                  />
                )}
                {!isCollapsed &&
                  g.rows.map((r) => {
                    const health = healthOf(r);
                    const cd = countdown(r.cutoff);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => onOpen(r)}
                        className="group cursor-pointer hover:bg-sky-50/40"
                      >
                        <td className="sticky left-0 z-10 bg-white px-3 py-1.5 group-hover:bg-sky-50/40">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_META[health].dot}`} />
                            <span className="font-medium text-neutral-800">{r.client}</span>
                            <span className="truncate text-xs text-neutral-400">{r.group}</span>
                          </div>
                        </td>
                        {r.stages.map((s) => (
                          <td key={s.name} className="px-1 py-1.5 text-center">
                            <div className="flex justify-center">
                              <StageTile
                                stage={s}
                                size={compact ? "sm" : "lg"}
                                onClick={() => onOpen(r)}
                              />
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-1.5">
                          <span
                            className={`font-mono text-xs ${
                              cd.tone === "red"
                                ? "text-red-600"
                                : cd.tone === "amber"
                                  ? "text-amber-700"
                                  : "text-neutral-500"
                            }`}
                          >
                            {cd.label}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <HealthPill health={health} />
                        </td>
                      </tr>
                    );
                  })}
              </>
            );
          })}
        </tbody>
        {/* slot health footer */}
        <tfoot>
          <tr className="bg-neutral-50">
            <td className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Slot health
            </td>
            {slotHealth.map((s) => {
              const cls = s.breached
                ? "bg-red-500 text-white"
                : s.atRisk
                  ? "bg-amber-400 text-amber-950"
                  : "bg-neutral-200 text-neutral-400";
              const n = s.breached || s.atRisk;
              return (
                <td key={s.name} className="px-1 py-2 text-center">
                  <span
                    className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md text-[11px] font-semibold ${cls}`}
                  >
                    {n || "·"}
                  </span>
                </td>
              );
            })}
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <Legend />
    </div>
  );
}

function Legend() {
  const items: { status: StageStatus }[] = [
    { status: "complete" },
    { status: "in_progress" },
    { status: "pending" },
    { status: "at_risk" },
    { status: "breached" },
    { status: "holiday" },
  ];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 px-1 text-[11px] text-neutral-500">
      <span className="font-medium text-neutral-400">Legend</span>
      {items.map(({ status }) => {
        const m = STAGE_TILE[status];
        return (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] ${m.cls}`}>
              {m.glyph}
            </span>
            {m.label}
          </span>
        );
      })}
      <span className="text-neutral-400">· Complete is grey by design — colour only marks what needs you.</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Markets view — holiday closures & impacted clients
 * ------------------------------------------------------------------ */

function MarketsView({ onOpen }: { onOpen: (r: Record_) => void }) {
  const dayLabel = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  // Headline: which upcoming day has the most closures?
  const dualClosure = "2026-05-25";
  const impacted = RECORDS.filter(
    (r) =>
      r.cadence === "Daily" &&
      r.markets.some((mc) => CLOSURES[mc]?.[dualClosure]),
  );

  return (
    <div className="space-y-5 p-5">
      {/* Today's board */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Markets today · {NOW.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MARKETS.map((m) => {
            const meta = MARKET_STATE_META[m.today];
            return (
              <div
                key={m.code}
                className={`rounded-lg border px-3 py-2 ${
                  m.today === "closed" ? "border-neutral-200 bg-neutral-50" : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-neutral-400">{m.code}</span>
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                </div>
                <div className="mt-1 text-sm font-medium text-neutral-800">{m.name}</div>
                <div
                  className={`text-[11px] ${
                    m.today === "closed"
                      ? "text-neutral-400"
                      : m.today === "half"
                        ? "text-amber-700"
                        : "text-emerald-600"
                  }`}
                >
                  {meta.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Headline closure callout */}
      <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-amber-500">▲</span>
          <div>
            <div className="text-sm font-semibold text-amber-900">
              Dual closure ahead — Monday 25 May
            </div>
            <p className="mt-0.5 text-xs text-amber-800">
              US (Memorial Day) and UK (Spring Bank Holiday) markets both closed. Luxembourg on a half
              day (Whit Monday). {impacted.length} daily processing groups depend on these markets — pull
              their cutoffs forward to Friday 22 May or expect a gap.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {impacted.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpen(r)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                >
                  {r.client}
                  <span className="text-amber-500">·</span>
                  <span className="font-normal text-amber-700">{r.group}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Forward calendar grid */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Forward closures
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  Market
                </th>
                {CALENDAR_DAYS.map((d) => (
                  <th
                    key={d}
                    className={`px-2 py-2 text-center text-[10px] font-medium ${
                      d === dualClosure ? "text-amber-700" : "text-neutral-400"
                    }`}
                  >
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MARKETS.map((m) => (
                <tr key={m.code} className="border-t border-neutral-100">
                  <td className="sticky left-0 bg-white px-3 py-1.5">
                    <span className="font-mono text-xs text-neutral-400">{m.code}</span>{" "}
                    <span className="text-xs text-neutral-700">{m.name}</span>
                  </td>
                  {CALENDAR_DAYS.map((d) => {
                    const c = CLOSURES[m.code]?.[d];
                    const state: MarketState = c?.state ?? "open";
                    const cls =
                      state === "closed"
                        ? "bg-neutral-200 text-neutral-500"
                        : state === "half"
                          ? "bg-amber-200 text-amber-900"
                          : "bg-white text-neutral-200";
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <div
                          title={c ? `${MARKET_STATE_META[state].label} — ${c.reason}` : "Open"}
                          className={`mx-auto flex h-7 w-full max-w-[5rem] items-center justify-center rounded text-[10px] font-medium ${cls}`}
                        >
                          {c ? (state === "half" ? "½" : "✕") : "·"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 px-1 text-[11px] text-neutral-400">
          ✕ closed · ½ half day · · open. Hover a cell for the reason.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Record drawer — Airtable's expanded record
 * ------------------------------------------------------------------ */

function RecordDrawer({ record, onClose }: { record: Record_; onClose: () => void }) {
  const health = healthOf(record);
  const { done, total } = completion(record);
  const cd = countdown(record.cutoff);
  const closuresAhead = record.markets
    .map((mc) => {
      const next = CALENDAR_DAYS.find((d) => d !== "2026-05-23" && CLOSURES[mc]?.[d]);
      return next ? { mc, day: next, c: CLOSURES[mc][next] } : null;
    })
    .filter(Boolean) as { mc: string; day: string; c: Closure }[];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-neutral-900/20" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-neutral-200 bg-white shadow-xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Chip cls={REGION_CHIP[record.region]}>{record.region}</Chip>
              <Chip cls={CADENCE_CHIP[record.cadence]}>{record.cadence}</Chip>
              <HealthPill health={health} />
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{record.client}</h2>
            <div className="text-sm text-neutral-500">{record.group}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* fields */}
        <div className="grid grid-cols-2 gap-px border-b border-neutral-200 bg-neutral-100">
          <Field label="Owner">
            <div className="flex items-center gap-2">
              <Avatar person={record.owner} />
              <span className="text-sm text-neutral-700">{record.owner.name}</span>
            </div>
          </Field>
          <Field label="AUM">
            <span className="font-mono text-sm text-neutral-800">{fmtAum(record.aum)}</span>
          </Field>
          <Field label="Base currency">
            <span className="font-mono text-sm text-neutral-800">{record.baseCcy}</span>
          </Field>
          <Field label="Cutoff">
            <span className="font-mono text-sm text-neutral-800">{fmtTime(record.cutoff)}</span>
            <span
              className={`ml-1 text-xs ${
                cd.tone === "red" ? "text-red-600" : cd.tone === "amber" ? "text-amber-700" : "text-neutral-400"
              }`}
            >
              ({cd.label})
            </span>
          </Field>
        </div>

        {/* progress */}
        <div className="px-5 py-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-500">Lifecycle</span>
            <span className="text-neutral-400">
              {done}/{total} complete
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-neutral-400"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>

          {/* vertical timeline */}
          <ol className="mt-4 space-y-1">
            {record.stages.map((s, i) => {
              const m = STAGE_TILE[s.status];
              const isCurrent = record.currentStage === s.name;
              return (
                <li
                  key={s.name}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 ${
                    isCurrent ? "bg-neutral-50 ring-1 ring-inset ring-neutral-200" : ""
                  }`}
                >
                  <span className="font-mono text-[10px] text-neutral-300">{i + 1}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${m.cls}`}
                  >
                    {m.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-800">{s.name}</span>
                      {isCurrent && (
                        <span className="rounded bg-sky-100 px-1 text-[9px] font-medium text-sky-700">
                          NOW
                        </span>
                      )}
                    </div>
                    {s.note && <p className="mt-0.5 text-xs text-neutral-500">{s.note}</p>}
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-neutral-400">{fmtTime(s.due)}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* markets */}
        <div className="border-t border-neutral-200 px-5 py-4">
          <div className="mb-2 text-xs font-medium text-neutral-500">Market dependencies</div>
          <div className="flex flex-wrap gap-1.5">
            {record.markets.map((mc) => {
              const mk = MARKETS.find((m) => m.code === mc);
              const meta = mk ? MARKET_STATE_META[mk.today] : null;
              return (
                <span
                  key={mc}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] ${
                    meta?.cls ?? "border-neutral-200 text-neutral-500"
                  }`}
                >
                  {meta && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
                  <span className="font-mono">{mc}</span>
                  {mk && <span className="text-neutral-400">{mk.name}</span>}
                </span>
              );
            })}
          </div>
          {closuresAhead.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
              <span className="font-medium">Upcoming closures: </span>
              {closuresAhead.map((c, i) => (
                <span key={c.mc + c.day}>
                  {i > 0 && " · "}
                  {c.mc} {new Date(c.day + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ({c.c.reason})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* notes */}
        <div className="border-t border-neutral-200 px-5 py-4">
          <div className="mb-2 text-xs font-medium text-neutral-500">Notes</div>
          {record.notes.length === 0 ? (
            <p className="text-xs text-neutral-400">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {record.notes.map((n, i) => (
                <li key={i} className="rounded-md bg-neutral-50 px-3 py-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-medium text-neutral-600">{n.author}</span>
                    <span className="font-mono">{fmtTime(n.at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-700">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <input
              placeholder="Add a note…"
              className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-400"
            />
            <button
              type="button"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
            >
              Post
            </button>
          </div>
        </div>

        {/* actions */}
        <div className="mt-auto flex gap-2 border-t border-neutral-200 px-5 py-4">
          <button
            type="button"
            className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Open processing group
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Snooze
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-5 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
