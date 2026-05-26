import { useState } from "react";

export const title = "Limit & Risk Appetite";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Risk Control — Limit & Risk Appetite Monitor
 *
 * The control desk watches firm-wide utilisation of trading limits:
 * market risk (VaR, DV01, CS01, vega, FX delta, equity delta),
 * credit (per-counterparty notional), concentration (sector/issuer),
 * and stop-loss (desk P&L floors). Each limit has a current usage,
 * a soft warning threshold (typically 80% of hard limit), and the
 * hard limit itself. Breaches surface to a queue and require sign-off.
 *
 * Visualization centrepiece: Stephen Few–style bullet charts. Each
 * limit row shows qualitative bands (OK / warning / breach zones),
 * soft-threshold marker, hard-limit marker, and a solid measure bar.
 *
 * Design rule (shared workspace): CALM IS THE DEFAULT.
 *   Under threshold → neutral grey bar.
 *   > soft threshold → amber.
 *   >= hard limit   → red.
 * ------------------------------------------------------------------ */

/* ================================================================== *
 * Data model
 * ================================================================== */

type LimitCategory = "Market" | "Credit" | "Concentration" | "Stop-Loss";

type LimitTone = "ok" | "warning" | "error";

type LimitRow = {
  id: string;
  name: string;
  category: LimitCategory;
  /** desk / owner */
  desk: string;
  /** current measured usage (same units as hardLimit) */
  current: number;
  /** soft warning threshold (usually 80% of hard limit) */
  softThreshold: number;
  /** hard limit — breached at current >= hardLimit */
  hardLimit: number;
  /** unit label shown to user e.g. "$m", "bp", "%" */
  unit: string;
  /** display the numbers as percentage of hard limit (true) or raw (false) */
  showAsPct: boolean;
};

type AlertEvent = {
  id: string;
  limitId: string;
  /** percent of hard limit at time of alert */
  utilizationPct: number;
  /** raw amount over limit (0 if near-limit warning) */
  overAmount: number;
  timestamp: string;
  /** "New" | "Acknowledged" | "Escalated" */
  status: "New" | "Acknowledged" | "Escalated";
  severity: "error" | "warning";
  desk: string;
};

/* ================================================================== *
 * Mock data — realistic institutional values
 * ================================================================== */

const LIMITS: LimitRow[] = [
  /* ---- Market Risk ---- */
  {
    id: "var-1d",
    name: "1-Day VaR (99%)",
    category: "Market",
    desk: "Risk Control",
    current: 47_200_000,
    softThreshold: 48_000_000,
    hardLimit: 60_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "dv01-rates",
    name: "IR DV01 — Rates book",
    category: "Market",
    desk: "Fixed Income",
    current: 2_870_000,
    softThreshold: 2_400_000,
    hardLimit: 3_000_000,
    unit: "$",
    showAsPct: false,
  },
  {
    id: "cs01-credit",
    name: "Credit CS01 — Corp book",
    category: "Market",
    desk: "Credit Trading",
    current: 1_140_000,
    softThreshold: 960_000,
    hardLimit: 1_200_000,
    unit: "$",
    showAsPct: false,
  },
  {
    id: "fx-delta",
    name: "FX Delta — G10",
    category: "Market",
    desk: "FX Trading",
    current: 38_000_000,
    softThreshold: 40_000_000,
    hardLimit: 50_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "eq-delta",
    name: "Equity Delta — Cash",
    category: "Market",
    desk: "Equity Derivatives",
    current: 112_000_000,
    softThreshold: 96_000_000,
    hardLimit: 120_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "vega-total",
    name: "Vega (1% move) — Total",
    category: "Market",
    desk: "Equity Derivatives",
    current: 5_480_000,
    softThreshold: 4_000_000,
    hardLimit: 5_000_000,
    unit: "$",
    showAsPct: false,
  },
  /* ---- Credit ---- */
  {
    id: "cpt-gs",
    name: "Goldman Sachs — notional",
    category: "Credit",
    desk: "Credit Risk",
    current: 640_000_000,
    softThreshold: 640_000_000,
    hardLimit: 800_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "cpt-ms",
    name: "Morgan Stanley — notional",
    category: "Credit",
    desk: "Credit Risk",
    current: 430_000_000,
    softThreshold: 560_000_000,
    hardLimit: 700_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "cpt-db",
    name: "Deutsche Bank — notional",
    category: "Credit",
    desk: "Credit Risk",
    current: 870_000_000,
    softThreshold: 720_000_000,
    hardLimit: 900_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "cpt-bnp",
    name: "BNP Paribas — notional",
    category: "Credit",
    desk: "Credit Risk",
    current: 310_000_000,
    softThreshold: 480_000_000,
    hardLimit: 600_000_000,
    unit: "$m",
    showAsPct: false,
  },
  /* ---- Concentration ---- */
  {
    id: "conc-tech",
    name: "Tech sector — equity %",
    category: "Concentration",
    desk: "Portfolio Risk",
    current: 23.4,
    softThreshold: 20,
    hardLimit: 25,
    unit: "%",
    showAsPct: false,
  },
  {
    id: "conc-energy",
    name: "Energy sector — equity %",
    category: "Concentration",
    desk: "Portfolio Risk",
    current: 11.2,
    softThreshold: 12,
    hardLimit: 15,
    unit: "%",
    showAsPct: false,
  },
  {
    id: "conc-issuer",
    name: "Single-issuer — AAPL",
    category: "Concentration",
    desk: "Portfolio Risk",
    current: 4.8,
    softThreshold: 4,
    hardLimit: 5,
    unit: "%",
    showAsPct: false,
  },
  /* ---- Stop-Loss ---- */
  {
    id: "sl-rates",
    name: "Rates desk — daily P&L",
    category: "Stop-Loss",
    desk: "Fixed Income",
    current: -2_340_000,
    softThreshold: -2_000_000,
    hardLimit: -2_500_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "sl-eq-deriv",
    name: "Eq Deriv desk — daily P&L",
    category: "Stop-Loss",
    desk: "Equity Derivatives",
    current: -820_000,
    softThreshold: -1_600_000,
    hardLimit: -2_000_000,
    unit: "$m",
    showAsPct: false,
  },
  {
    id: "sl-credit",
    name: "Credit desk — daily P&L",
    category: "Stop-Loss",
    desk: "Credit Trading",
    current: -1_920_000,
    softThreshold: -2_400_000,
    hardLimit: -3_000_000,
    unit: "$m",
    showAsPct: false,
  },
];

const ALERTS: AlertEvent[] = [
  {
    id: "al-1",
    limitId: "vega-total",
    utilizationPct: 109.6,
    overAmount: 480_000,
    timestamp: "08:23",
    status: "New",
    severity: "error",
    desk: "Equity Derivatives",
  },
  {
    id: "al-2",
    limitId: "cs01-credit",
    utilizationPct: 95.0,
    overAmount: 0,
    timestamp: "08:31",
    status: "New",
    severity: "error",
    desk: "Credit Trading",
  },
  {
    id: "al-3",
    limitId: "dv01-rates",
    utilizationPct: 95.7,
    overAmount: 0,
    timestamp: "08:42",
    status: "Acknowledged",
    severity: "error",
    desk: "Fixed Income",
  },
  {
    id: "al-4",
    limitId: "conc-tech",
    utilizationPct: 93.6,
    overAmount: 0,
    timestamp: "08:55",
    status: "New",
    severity: "error",
    desk: "Portfolio Risk",
  },
  {
    id: "al-5",
    limitId: "cpt-db",
    utilizationPct: 96.7,
    overAmount: 0,
    timestamp: "09:04",
    status: "Escalated",
    severity: "error",
    desk: "Credit Risk",
  },
  {
    id: "al-6",
    limitId: "conc-issuer",
    utilizationPct: 96.0,
    overAmount: 0,
    timestamp: "09:11",
    status: "New",
    severity: "error",
    desk: "Portfolio Risk",
  },
  {
    id: "al-7",
    limitId: "sl-rates",
    utilizationPct: 93.6,
    overAmount: 0,
    timestamp: "09:18",
    status: "New",
    severity: "warning",
    desk: "Fixed Income",
  },
  {
    id: "al-8",
    limitId: "eq-delta",
    utilizationPct: 93.3,
    overAmount: 0,
    timestamp: "09:22",
    status: "Acknowledged",
    severity: "warning",
    desk: "Equity Derivatives",
  },
  {
    id: "al-9",
    limitId: "cpt-gs",
    utilizationPct: 80.0,
    overAmount: 0,
    timestamp: "09:31",
    status: "New",
    severity: "warning",
    desk: "Credit Risk",
  },
];

/* ================================================================== *
 * Helpers
 * ================================================================== */

function compact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

/** For stop-loss rows the "usage" is a negative number — treat distance from zero toward limit */
function utilPct(row: LimitRow): number {
  const isNegative = row.hardLimit < 0;
  if (isNegative) {
    // P&L stop-loss: current is negative, hardLimit is the most-negative allowed
    // utilisation = |current| / |hardLimit|
    return Math.abs(row.current) / Math.abs(row.hardLimit);
  }
  return row.current / row.hardLimit;
}

function softPct(row: LimitRow): number {
  const isNegative = row.hardLimit < 0;
  if (isNegative) {
    return Math.abs(row.softThreshold) / Math.abs(row.hardLimit);
  }
  return row.softThreshold / row.hardLimit;
}

function rowTone(row: LimitRow): LimitTone {
  const u = utilPct(row);
  if (u >= 1) return "error";
  if (u >= softPct(row)) return "warning";
  return "ok";
}

function displayValue(row: LimitRow, val: number): string {
  if (row.unit === "%") return `${Math.abs(val).toFixed(1)}%`;
  return compact(val);
}

/* ================================================================== *
 * Atoms
 * ================================================================== */

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warning" | "error";
}) {
  const accent = {
    neutral: "border-l-neutral-300",
    ok: "border-l-emerald-500",
    warning: "border-l-amber-500",
    error: "border-l-red-500",
  }[tone];
  const valueColor = {
    neutral: "text-neutral-900",
    ok: "text-emerald-700",
    warning: "text-amber-700",
    error: "text-red-700",
  }[tone];
  return (
    <div className={`rounded-lg border border-l-2 border-neutral-200 bg-white px-4 py-3 ${accent}`}>
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/* ---- Bullet gauge row ---- */
function BulletGauge({
  row,
  highlighted,
  onClick,
}: {
  row: LimitRow;
  highlighted: boolean;
  onClick: () => void;
}) {
  const uPct = utilPct(row);
  const sPct = softPct(row);
  const tone = rowTone(row);

  // Bar fill colour
  const barColor =
    tone === "error"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-400"
        : "bg-neutral-400";

  // Utilisation label colour
  const utilColor =
    tone === "error"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-neutral-500";

  // Cap bar at 110% visually so overruns are visible but don't overflow layout
  const barWidthPct = Math.min(uPct * 100, 110);

  // Category badge colour
  const catColor: Record<LimitCategory, string> = {
    Market: "bg-sky-50 text-sky-700",
    Credit: "bg-violet-50 text-violet-700",
    Concentration: "bg-teal-50 text-teal-700",
    "Stop-Loss": "bg-rose-50 text-rose-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-t border-neutral-100 px-4 py-2.5.5 text-left transition first:border-t-0 ${
        highlighted ? "bg-amber-50/50" : "hover:bg-neutral-50/70"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Left: name + meta */}
        <div className="w-52 shrink-0">
          <div className="flex items-center gap-1.5">
            {tone === "error" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            )}
            {tone === "warning" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            )}
            {tone === "ok" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
            )}
            <span className="text-sm font-semibold text-neutral-800 leading-tight">
              {row.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`rounded px-1 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${catColor[row.category]}`}
            >
              {row.category}
            </span>
            <span className="text-[10px] text-neutral-400">{row.desk}</span>
          </div>
        </div>

        {/* Centre: bullet gauge track */}
        <div className="relative flex-1" style={{ height: "28px" }}>
          {/* Qualitative background bands */}
          {/* OK band: 0→soft */}
          <div
            className="absolute inset-y-[6px] left-0 rounded-l-sm bg-neutral-100"
            style={{ width: `${sPct * 100}%` }}
          />
          {/* Warning band: soft→100% */}
          <div
            className="absolute inset-y-[6px] bg-amber-50"
            style={{
              left: `${sPct * 100}%`,
              width: `${(1 - sPct) * 100}%`,
            }}
          />
          {/* Breach band: 100%→110% (overflow zone) */}
          <div
            className="absolute inset-y-[2px] right-0 rounded-r-sm bg-red-50"
            style={{ width: "9.09%" /* 10/110 */ }}
          />

          {/* Measure bar */}
          <div
            className={`absolute inset-y-[8px] left-0 rounded-sm ${barColor}`}
            style={{ width: `${barWidthPct / 1.1}%` /* scale into 110% track */ }}
          />

          {/* Soft-threshold marker */}
          <div
            className="absolute inset-y-[2px] w-px bg-amber-400/60"
            style={{ left: `${(sPct * 100) / 1.1}%` }}
          />

          {/* Hard-limit marker (100% → 90.9% of the 110%-wide track) */}
          <div
            className="absolute inset-y-0 w-0.5 bg-neutral-500"
            style={{ left: "90.9%" }}
          />

          {/* "BREACH" label when over hard limit */}
          {uPct >= 1 && (
            <span className="absolute right-0 top-0.5 font-mono text-[8px] font-bold tracking-wider text-red-500 uppercase">
              Breach
            </span>
          )}
        </div>

        {/* Right: values */}
        <div className="w-36 shrink-0 text-right">
          <div className="font-mono text-[11px] tabular-nums text-neutral-500">
            {displayValue(row, row.current)} / {displayValue(row, row.hardLimit)}
          </div>
          <div className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${utilColor}`}>
            {(uPct * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---- Alert / breach feed item ---- */
function AlertItem({
  event,
  limitName,
  highlighted,
  onClick,
}: {
  event: AlertEvent;
  limitName: string;
  highlighted: boolean;
  onClick: () => void;
}) {
  const statusColor: Record<AlertEvent["status"], string> = {
    New: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    Acknowledged: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    Escalated: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-t border-neutral-100 px-4 py-3 text-left transition first:border-t-0 ${
        highlighted ? "bg-amber-50/50" : "hover:bg-neutral-50"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Severity dot */}
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            event.severity === "error" ? "bg-red-500" : "bg-amber-400"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-semibold text-neutral-800">
              {limitName}
            </span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-neutral-400">
              {event.timestamp}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`font-mono text-[11px] font-semibold tabular-nums ${
                event.severity === "error" ? "text-red-600" : "text-amber-600"
              }`}>
                {event.utilizationPct.toFixed(1)}% of limit
              </span>
              {event.overAmount > 0 && (
                <span className="text-[10px] text-red-500">
                  +{compact(event.overAmount)} over
                </span>
              )}
            </div>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${statusColor[event.status]}`}>
              {event.status}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-400">{event.desk}</div>
        </div>
      </div>
    </button>
  );
}

/* ================================================================== *
 * Derived statistics (computed once at module scope)
 * ================================================================== */

type CategorySummary = {
  category: LimitCategory;
  total: number;
  breached: number;
  nearLimit: number;
  /** average utilisation across category */
  avgUtil: number;
};

const CATEGORIES: LimitCategory[] = ["Market", "Credit", "Concentration", "Stop-Loss"];

const CATEGORY_SUMMARY: CategorySummary[] = CATEGORIES.map((cat) => {
  const rows = LIMITS.filter((r) => r.category === cat);
  const breached = rows.filter((r) => rowTone(r) === "error").length;
  const nearLimit = rows.filter((r) => rowTone(r) === "warning").length;
  const avgUtil = rows.reduce((s, r) => s + utilPct(r), 0) / rows.length;
  return { category: cat, total: rows.length, breached, nearLimit, avgUtil };
});

const ALL_BREACHED = LIMITS.filter((r) => rowTone(r) === "error");
const ALL_WARNING = LIMITS.filter((r) => rowTone(r) === "warning");

// Aggregate VaR utilisation
const varRow = LIMITS.find((r) => r.id === "var-1d")!;
const varUtil = utilPct(varRow);

// Largest single utilisation
const sortedByUtil = [...LIMITS].sort((a, b) => utilPct(b) - utilPct(a));
const largestUtil = sortedByUtil[0];

/* ================================================================== *
 * Page
 * ================================================================== */

type FilterMode = "all" | "breached" | "near";

export default function LimitMonitor() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedLimitId, setSelectedLimitId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  /* Derived: which limits to show */
  const visibleLimits = (() => {
    let rows = LIMITS;
    if (filter === "breached") rows = rows.filter((r) => rowTone(r) === "error");
    if (filter === "near") rows = rows.filter((r) => rowTone(r) === "warning");
    // Sort: breached first, then warning, then ok; within each group by utilisation desc
    return [...rows].sort((a, b) => {
      const toneOrder = { error: 0, warning: 1, ok: 2 };
      const ta = toneOrder[rowTone(a)];
      const tb = toneOrder[rowTone(b)];
      if (ta !== tb) return ta - tb;
      return utilPct(b) - utilPct(a);
    });
  })();

  function handleGaugeClick(id: string) {
    setSelectedLimitId((prev) => (prev === id ? null : id));
    // Also highlight the first matching alert
    const alert = ALERTS.find((a) => a.limitId === id);
    setSelectedAlertId(alert ? alert.id : null);
  }

  function handleAlertClick(alertId: string, limitId: string) {
    setSelectedAlertId((prev) => (prev === alertId ? null : alertId));
    setSelectedLimitId((prev) => (prev === limitId ? null : limitId));
  }

  const breachCount = ALL_BREACHED.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Limit & Risk Appetite
          </span>
          <span className="text-xs text-neutral-400">
            Risk Control · real-time utilisation
          </span>
        </div>

        {/* Filter toggle */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {(
            [
              ["all", "All limits"],
              ["breached", "Breached"],
              ["near", "Near limit"],
            ] as [FilterMode, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                filter === k
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Breach count pill */}
          {breachCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {breachCount} {breachCount === 1 ? "breach" : "breaches"} active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              No active breaches
            </span>
          )}
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            Acknowledge all
          </button>
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-5">

          {/* KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi
              label="Active breaches"
              value={breachCount.toString()}
              hint="require sign-off before further trading"
              tone={breachCount > 0 ? "error" : "ok"}
            />
            <Kpi
              label="Near limit (>80%)"
              value={ALL_WARNING.length.toString()}
              hint={`${ALL_WARNING.map((r) => r.name.split("—")[0].trim()).slice(0, 2).join(", ")}…`}
              tone={ALL_WARNING.length > 0 ? "warning" : "neutral"}
            />
            <Kpi
              label="Aggregate VaR util"
              value={`${(varUtil * 100).toFixed(0)}%`}
              hint={`${compact(varRow.current)} of ${compact(varRow.hardLimit)} limit`}
              tone={varUtil >= 1 ? "error" : varUtil >= softPct(varRow) ? "warning" : "neutral"}
            />
            <Kpi
              label="Largest single util"
              value={`${(utilPct(largestUtil) * 100).toFixed(1)}%`}
              hint={largestUtil.name}
              tone={rowTone(largestUtil)}
            />
          </div>

          {/* Main two-column layout */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">

            {/* Left: bullet gauge list (hero) */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Limit Utilisation
                </h2>
                <div className="flex items-center gap-4">
                  {/* Legend */}
                  <div className="hidden items-center gap-3 text-[10px] text-neutral-400 sm:flex">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-6 rounded-sm bg-neutral-400 opacity-60" />
                      OK
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-6 rounded-sm bg-amber-400 opacity-70" />
                      Warning
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-6 rounded-sm bg-red-500 opacity-70" />
                      Breached
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-0.5 bg-neutral-500" />
                      Hard limit
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-px bg-amber-400" />
                      Soft threshold
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {visibleLimits.length} limits
                  </span>
                </div>
              </div>

              {/* Rows */}
              <ul>
                {visibleLimits.length === 0 && (
                  <li className="px-5 py-10 text-center text-sm text-neutral-400">
                    No limits match the current filter.
                  </li>
                )}
                {visibleLimits.map((row) => (
                  <li key={row.id}>
                    <BulletGauge
                      row={row}
                      highlighted={selectedLimitId === row.id}
                      onClick={() => handleGaugeClick(row.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>

            {/* Right: breach queue / alert feed */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Breach Queue
                </h2>
                <span className="text-[10px] text-neutral-400">
                  {ALERTS.filter((a) => a.status === "New").length} unactioned
                </span>
              </div>

              <ul>
                {ALERTS.map((alert) => {
                  const limitRow = LIMITS.find((r) => r.id === alert.limitId);
                  const name = limitRow?.name ?? alert.limitId;
                  return (
                    <li key={alert.id}>
                      <AlertItem
                        event={alert}
                        limitName={name}
                        highlighted={
                          selectedAlertId === alert.id ||
                          selectedLimitId === alert.limitId
                        }
                        onClick={() => handleAlertClick(alert.id, alert.limitId)}
                      />
                    </li>
                  );
                })}
              </ul>

              {/* Feed footer */}
              <div className="border-t border-neutral-100 px-4 py-3">
                <button
                  type="button"
                  className="w-full rounded-lg border border-neutral-200 py-2 text-[11px] font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
                >
                  View full audit log
                </button>
              </div>
            </section>
          </div>

          {/* By-category rollup strip */}
          <div className="mt-6">
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  By-Category Summary
                </h2>
                <span className="text-[10px] text-neutral-400">
                  {LIMITS.length} limits total across {CATEGORIES.length} categories
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-neutral-100 lg:grid-cols-4">
                {CATEGORY_SUMMARY.map((cat) => {
                  const catBarColor =
                    cat.breached > 0
                      ? "bg-red-400"
                      : cat.nearLimit > 0
                        ? "bg-amber-400"
                        : "bg-neutral-300";

                  const catBadgeColor: Record<LimitCategory, string> = {
                    Market: "text-sky-700 bg-sky-50",
                    Credit: "text-violet-700 bg-violet-50",
                    Concentration: "text-teal-700 bg-teal-50",
                    "Stop-Loss": "text-rose-700 bg-rose-50",
                  };

                  return (
                    <div key={cat.category} className="bg-white px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${catBadgeColor[cat.category]}`}
                        >
                          {cat.category}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
                          {cat.total} limits
                        </span>
                      </div>

                      {/* Count row */}
                      <div className="mt-3 flex items-center gap-4">
                        <div className="text-center">
                          <div
                            className={`font-mono text-xl font-semibold tabular-nums ${
                              cat.breached > 0 ? "text-red-600" : "text-neutral-300"
                            }`}
                          >
                            {cat.breached}
                          </div>
                          <div className="text-[9px] text-neutral-400 uppercase tracking-wide">
                            Breached
                          </div>
                        </div>
                        <div className="text-center">
                          <div
                            className={`font-mono text-xl font-semibold tabular-nums ${
                              cat.nearLimit > 0 ? "text-amber-600" : "text-neutral-300"
                            }`}
                          >
                            {cat.nearLimit}
                          </div>
                          <div className="text-[9px] text-neutral-400 uppercase tracking-wide">
                            Near limit
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="font-mono text-sm font-semibold tabular-nums text-neutral-700">
                            {(cat.avgUtil * 100).toFixed(0)}%
                          </div>
                          <div className="text-[9px] text-neutral-400 uppercase tracking-wide">
                            Avg util
                          </div>
                        </div>
                      </div>

                      {/* Aggregate utilisation bar */}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full rounded-full ${catBarColor}`}
                          style={{ width: `${Math.min(cat.avgUtil * 100, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[9px] text-neutral-400">
                        <span>0%</span>
                        <span>Avg utilisation</span>
                        <span>100%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
