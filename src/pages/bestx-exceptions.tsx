import { useMemo, useState } from "react";
import type { Options } from "highcharts";
import { HighchartsView } from "../components/highcharts/HighchartsView";
import { TONE } from "../lib/highcharts";

export const title = "BestX · Exception Reports";
export const section = "dashboards";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * BestX — Exception Reports (visual uplift)
 *
 * Two screens from the live TCA client, reworked:
 *
 *   1. Report list  — scheduled checks that flag trades breaching a
 *      threshold. Select one or more, then run to open the results.
 *   2. Report view  — the results of a run: what broke, how badly,
 *      and which trades still need a comment.
 *
 * What changed vs the current product, and why:
 *   - Conditions read as chips ("Total spread > 10 bps") instead of
 *     faint italic text, so the rule is scannable.
 *   - Every row action is labelled. Status is a named toggle, not a
 *     bare switch in a headerless column.
 *   - "Run selected" only appears when something is selected, and says
 *     how many reports it will run.
 *   - The report opens with KPIs, so the answer comes before the charts.
 *   - One sign convention everywhere: above zero = cost (rose),
 *     below zero = saving (emerald). The old "Top" chart showed large
 *     costs in green.
 *   - Pies with one slice became ranked bars. The flat shortfall area
 *     became a waterfall that shows where the cost was added.
 *   - 14 dimension tabs collapse to two views plus a "Break down by"
 *     menu, so nothing is hidden behind a horizontal scroll.
 * ------------------------------------------------------------------ */

/* ======================================================================
 * Data model + mock data
 * ==================================================================== */

type AssetClass = "FX" | "CR" | "MA";
type RunState = "exceptions" | "clean" | "never";

type Condition = { field: string; op: string; value: string };

type Report = {
  id: string;
  asset: AssetClass;
  name: string;
  description: string;
  conditions: Condition[];
  recipients: string[];
  frequency: "Daily" | "Weekly" | "Monthly";
  runAt: string;
  active: boolean;
  lastRun: { state: RunState; when: string; exceptions: number };
  modifiedBy: string;
  modifiedOn: string;
};

const REPORTS: Report[] = [
  {
    id: "rpt-11499ff4",
    asset: "FX",
    name: "Spread outliers",
    description: "Trades priced outside the expected spread band.",
    conditions: [
      { field: "Asset type", op: "=", value: "FX" },
      { field: "Desk", op: "=", value: "bos.testcomp1" },
      { field: "Entity", op: "=", value: "SSGA UK" },
      { field: "Portfolio", op: "=", value: "GLB-EQ-01" },
      { field: "Direction", op: "=", value: "Sell" },
      { field: "Trade type", op: "=", value: "Spot" },
      { field: "Channel", op: "=", value: "FXall" },
      { field: "Currency pair", op: "in", value: "EURUSD, GBPUSD" },
      { field: "Size", op: ">", value: "50M USD" },
      { field: "Total spread", op: ">", value: "10 bps" },
      { field: "Perf vs Q Best", op: "<", value: "−0.01 bps" },
      { field: "Perf vs Arrival", op: "<", value: "−2 bps" },
    ],
    recipients: ["sgaughan@statestreet.com"],
    frequency: "Daily",
    runAt: "07:00",
    active: false,
    lastRun: { state: "exceptions", when: "Sep 23, 08:37", exceptions: 42 },
    modifiedBy: "state_street support",
    modifiedOn: "Jun 26, 2025",
  },
  {
    id: "rpt-0a73c2d1",
    asset: "FX",
    name: "Q Best underperformance",
    description: "Fills worse than the best quote on the panel.",
    conditions: [
      { field: "Asset type", op: "=", value: "FX" },
      { field: "Desk", op: "=", value: "bos.testcomp1" },
      { field: "Counterparty", op: "in", value: "Barclays, Citi" },
      { field: "Entity", op: "=", value: "SSGA US" },
      { field: "Direction", op: "=", value: "Buy" },
      { field: "Trade type", op: "=", value: "Forward" },
      { field: "Channel", op: "=", value: "Bloomberg FXGO" },
      { field: "Currency pair", op: "=", value: "USDJPY" },
      { field: "Size", op: ">", value: "10M USD" },
      { field: "Perf vs Q Best", op: "<", value: "−0.01 bps" },
      { field: "Perf vs Arrival", op: "<", value: "−0.5 bps" },
      { field: "Directed", op: "=", value: "Not directed" },
      { field: "Trade age", op: ">", value: "30 seconds" },
    ],
    recipients: ["state_street_support@bestx.co.uk"],
    frequency: "Daily",
    runAt: "07:30",
    active: false,
    lastRun: { state: "clean", when: "Sep 22, 07:30", exceptions: 0 },
    modifiedBy: "state_street support",
    modifiedOn: "Apr 20, 2020",
  },
  {
    id: "rpt-5be910aa",
    asset: "FX",
    name: "Large ticket slippage",
    description: "Tickets over 50M where arrival slippage is material.",
    conditions: [
      { field: "Asset type", op: "=", value: "FX" },
      { field: "Desk", op: "=", value: "lon.fx.exec" },
      { field: "Direction", op: "=", value: "Buy" },
      { field: "Directed", op: "=", value: "Directed" },
      { field: "Trade type", op: "=", value: "Swap" },
      { field: "Channel", op: "=", value: "Bloomberg FXGO" },
      { field: "Currency pair", op: "in", value: "EURUSD, AUDUSD" },
      { field: "Size", op: ">", value: "50M USD" },
      { field: "Perf vs Arrival", op: "<", value: "−2 bps" },
      { field: "Arrival slippage", op: ">", value: "1.5 bps" },
      { field: "Price impact", op: ">", value: "0.2%" },
      { field: "VWAP delta", op: "<", value: "−0.5 bps" },
      { field: "Client tier", op: "=", value: "Institutional" },
    ],
    recipients: ["fx-desk@statestreet.com", "tca-oversight@statestreet.com"],
    frequency: "Weekly",
    runAt: "Mon 06:00",
    active: true,
    lastRun: { state: "exceptions", when: "Sep 21, 06:00", exceptions: 7 },
    modifiedBy: "m.doyle",
    modifiedOn: "Sep 02, 2026",
  },
  {
    id: "rpt-c41d7730",
    asset: "FX",
    name: "WMR fix deviation",
    description: "Fix orders filled away from the WMR 4pm rate.",
    conditions: [
      { field: "Asset type", op: "=", value: "FX" },
      { field: "Desk", op: "=", value: "nyc.fx.exec" },
      { field: "Entity", op: "=", value: "SSGA IE" },
      { field: "Portfolio", op: "=", value: "EM-DEBT-02" },
      { field: "Trade type", op: "=", value: "Fix" },
      { field: "Direction", op: "=", value: "Sell" },
      { field: "Channel", op: "=", value: "Voice" },
      { field: "Currency pair", op: "in", value: "USDCHF, EURGBP" },
      { field: "Size", op: ">", value: "5M USD" },
      { field: "Perf vs WMR 4pm", op: "<", value: "−1 bps" },
      { field: "Fix offset", op: ">", value: "0.6 bps" },
      { field: "Market dislocation", op: ">", value: "2.0 standard deviations" },
      { field: "Client book", op: "=", value: "Macro hedging" },
      { field: "Liquidity score", op: "<", value: "0.7" },
    ],
    recipients: ["fx-desk@statestreet.com"],
    frequency: "Monthly",
    runAt: "1st 06:00",
    active: true,
    lastRun: { state: "never", when: "—", exceptions: 0 },
    modifiedBy: "m.doyle",
    modifiedOn: "Sep 18, 2026",
  },
];

const ASSET_TABS: { id: AssetClass; label: string }[] = [
  { id: "FX", label: "FX" },
  { id: "CR", label: "Credit" },
  { id: "MA", label: "Multi-asset" },
];

/* Break-down dimensions — the 14 tabs of the old header. */
const DIMENSIONS = [
  "Currency pair",
  "Channel",
  "Client name",
  "Counterparty",
  "Desk",
  "Directed",
  "Direction",
  "Entity",
  "Portfolio",
  "Product",
  "Size",
  "Trade type",
] as const;
type Dimension = (typeof DIMENSIONS)[number];

const DIMENSION_VALUES: Record<Dimension, string[]> = {
  "Currency pair": ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "EURGBP", "USDCHF"],
  Channel: ["FXall", "360T", "Bloomberg FXGO", "Voice", "Direct API"],
  "Client name": ["Northgate Pension", "Arcus Insurance", "Halcyon AM", "Meridian Capital"],
  Counterparty: ["Barclays", "Citi", "JPMorgan", "UBS", "Deutsche Bank", "HSBC"],
  Desk: ["bos.testcomp1", "lon.fx.exec", "nyc.fx.exec"],
  Directed: ["Directed", "Not directed"],
  Direction: ["Buy", "Sell"],
  Entity: ["SSGA UK", "SSGA US", "SSGA IE"],
  Portfolio: ["GLB-EQ-01", "GLB-FI-04", "EM-DEBT-02", "LDI-UK-07"],
  Product: ["Spot", "Forward", "Swap", "NDF"],
  Size: ["< 1M", "1–10M", "10–50M", "> 50M"],
  "Trade type": ["Risk transfer", "Algo", "Fix", "Auto price"],
};

/* Deterministic pseudo-random so the mock data is stable across renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

type TradeException = {
  id: string;
  time: string;
  pair: string;
  side: "Buy" | "Sell";
  notionalM: number;
  counterparty: string;
  actual: number; // total spread paid, bps
  expected: number; // model expected spread, bps
  commented: boolean;
};

const TRADES: TradeException[] = (() => {
  const r = seeded(11499);
  const pairs = DIMENSION_VALUES["Currency pair"];
  const cps = DIMENSION_VALUES.Counterparty;
  return Array.from({ length: 42 }, (_, i) => {
    const expected = +(1 + r() * 4).toFixed(1);
    // Most exceptions are costs; a handful are negative-spread outliers.
    const excess = i % 9 === 4 ? -(0.6 + r() * 2) : 10 + Math.pow(r(), 2) * 38;
    const day = 1 + Math.floor(r() * 30);
    const hh = 7 + Math.floor(r() * 10);
    const mm = Math.floor(r() * 60);
    return {
      id: `FX-2608${String(day).padStart(2, "0")}-${String(400 + i * 17).padStart(4, "0")}`,
      time: `Aug ${String(day).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      pair: pairs[Math.floor(r() * pairs.length)],
      side: r() > 0.5 ? "Buy" : "Sell",
      notionalM: +(0.5 + Math.pow(r(), 1.6) * 120).toFixed(1),
      counterparty: cps[Math.floor(r() * cps.length)],
      actual: +(expected + excess).toFixed(1),
      expected,
      commented: r() < 0.22,
    };
  });
})();

const diff = (t: TradeException) => +(t.actual - t.expected).toFixed(1);

const TOTAL_TRADES_IN_PERIOD = 1_284;

/* ======================================================================
 * Small building blocks
 * ==================================================================== */

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d={d} />
    </svg>
  );
}

const I = {
  play: "M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm6.39-2.908a.75.75 0 0 1 .766.027l3.5 2.25a.75.75 0 0 1 0 1.262l-3.5 2.25A.75.75 0 0 1 8 12.25v-4.5a.75.75 0 0 1 .39-.658Z",
  history:
    "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z",
  refresh:
    "M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z",
  search:
    "M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z",
  lock: "M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z",
  mail: "M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z M19 8.839l-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z",
  back: "M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z",
  calendar:
    "M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z",
  download:
    "M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z",
  filter:
    "M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z",
  bell: "M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z",
  help: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  gear: "M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  chat: "M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Z",
  check:
    "M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z",
};

function IconButton({ label, d, badge }: { label: string; d: string; badge?: number }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="relative inline-flex h-8 w-8 items-center justify-center text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Icon d={d} />
      {badge ? (
        <span className="absolute top-1 right-1 inline-flex h-3.5 min-w-3.5 items-center justify-center bg-rose-600 px-0.5 text-[9px] font-semibold text-white tabular-nums">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function ConditionChip({ c }: { c: Condition }) {
  return (
    <span className="inline-flex items-center gap-1 border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap">
      <span className="text-neutral-600">{c.field}</span>
      <span className="font-mono text-indigo-600">{c.op}</span>
      <span className="font-medium text-neutral-900">{c.value}</span>
    </span>
  );
}

function Toggle({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 disabled:cursor-not-allowed"
    >
      <span
        className={`relative inline-block h-4 w-7 transition ${on ? "bg-emerald-600" : "bg-neutral-300"} ${disabled ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`}
        />
      </span>
      <span className={`text-xs ${on ? "text-emerald-700" : "text-neutral-500"}`}>
        {on ? "Active" : "Paused"}
      </span>
    </button>
  );
}

function LastRun({ run }: { run: Report["lastRun"] }) {
  if (run.state === "never")
    return <span className="text-xs text-neutral-400">Not run yet</span>;
  return (
    <div className="leading-tight">
      {run.state === "exceptions" ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
          <span className="h-1.5 w-1.5 bg-rose-600" />
          {run.exceptions} exceptions
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 bg-emerald-600" />
          Clean
        </span>
      )}
      <div className="text-[11px] text-neutral-400 tabular-nums">{run.when}</div>
    </div>
  );
}

/* ======================================================================
 * Top bar (shared by both screens)
 * ==================================================================== */

function TopBar({ crumbs }: { crumbs: { label: string; onClick?: () => void }[] }) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center bg-neutral-900 text-[11px] font-bold tracking-tight text-white">
          BX
        </span>
        <span className="text-sm font-semibold text-neutral-900">TCA</span>
        <span className="h-4 w-px bg-neutral-200" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span className="text-neutral-300">/</span>}
              {c.onClick ? (
                <button
                  type="button"
                  onClick={c.onClick}
                  className="truncate text-neutral-500 hover:text-neutral-900"
                >
                  {c.label}
                </button>
              ) : (
                <span className="truncate font-medium text-neutral-900">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton label="Help" d={I.help} />
        <IconButton label="Notifications" d={I.bell} badge={3} />
        <IconButton label="Settings" d={I.gear} />
        <span className="ml-2 inline-flex h-7 w-7 items-center justify-center bg-indigo-100 text-[11px] font-semibold text-indigo-700">
          SS
        </span>
      </div>
    </header>
  );
}

/* ======================================================================
 * Screen 1 — Report list
 * ==================================================================== */

function ReportList({ onRun }: { onRun: (ids: string[]) => void }) {
  const [asset, setAsset] = useState<AssetClass>("FX");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(REPORTS.map((r) => [r.id, r.active])),
  );
  const readOnly = true;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        ASSET_TABS.map((t) => [t.id, REPORTS.filter((r) => r.asset === t.id).length]),
      ) as Record<AssetClass, number>,
    [],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REPORTS.filter((r) => r.asset === asset).filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.conditions.some((c) => `${c.field} ${c.value}`.toLowerCase().includes(q)) ||
        r.recipients.some((e) => e.toLowerCase().includes(q)),
    );
  }, [asset, query]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Page header */}
      <div className="border-b border-neutral-200 bg-white px-6 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                Exception reports
              </h1>
              {readOnly && (
                <span
                  title="You can run reports but not create or edit them."
                  className="inline-flex items-center gap-1 border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600"
                >
                  <Icon d={I.lock} className="h-3 w-3" />
                  Read only
                </span>
              )}
            </div>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Scheduled checks that flag trades breaching your thresholds. Select
              reports and run them to open the results.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="tabular-nums">Last loaded Sep 23, 2026 08:37</span>
            <button
              type="button"
              title="Reload reports"
              aria-label="Reload reports"
              className="inline-flex h-7 w-7 items-center justify-center border border-neutral-200 text-neutral-500 hover:text-neutral-900"
            >
              <Icon d={I.refresh} className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs + search */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div role="tablist" aria-label="Asset class" className="flex gap-6">
            {ASSET_TABS.map((t) => {
              const on = t.id === asset;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  type="button"
                  onClick={() => setAsset(t.id)}
                  className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-sm transition ${
                    on
                      ? "border-indigo-600 font-medium text-neutral-900"
                      : "border-transparent text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {t.label}
                  <span
                    className={`px-1.5 text-[11px] tabular-nums ${on ? "bg-indigo-50 text-indigo-700" : "bg-neutral-100 text-neutral-500"}`}
                  >
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="relative mb-2 block w-72">
            <span className="sr-only">Search reports</span>
            <Icon
              d={I.search}
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, condition or recipient"
              className="h-8 w-full border border-neutral-200 bg-white pr-2 pl-8 text-sm outline-none placeholder:text-neutral-400 focus:border-indigo-500"
            />
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-neutral-50 px-6 py-5">
        {rows.length === 0 ? (
          <EmptyState asset={asset} searching={query.trim().length > 0} />
        ) : (
          <div className="border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                  <th className="w-10 py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all reports"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                  </th>
                  <th className="py-2.5 pr-4">Report</th>
                  <th className="py-2.5 pr-4">Conditions</th>
                  <th className="py-2.5 pr-4">Recipients</th>
                  <th className="py-2.5 pr-4">Schedule</th>
                  <th className="py-2.5 pr-4">Last run</th>
                  <th className="py-2.5 pr-4">Modified</th>
                  <th className="py-2.5 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSel = selected.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`group border-b border-neutral-100 align-top last:border-0 ${isSel ? "bg-indigo-50/60" : "hover:bg-neutral-50"}`}
                    >
                      <td className="py-3.5 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name}`}
                          checked={isSel}
                          onChange={() => toggleOne(r.id)}
                          className="mt-0.5 h-3.5 w-3.5 accent-indigo-600"
                        />
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="font-medium text-neutral-900">{r.name}</div>
                        <div className="mt-0.5 text-xs text-neutral-500">{r.description}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {r.conditions.map((c, i) => (
                            <ConditionChip key={i} c={c} />
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-700">
                          <Icon d={I.mail} className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          <span className="max-w-48 truncate" title={r.recipients.join(", ")}>
                            {r.recipients[0]}
                          </span>
                          {r.recipients.length > 1 && (
                            <span className="bg-neutral-100 px-1 text-[10px] text-neutral-500">
                              +{r.recipients.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="text-xs text-neutral-800">
                          {r.frequency}
                          <span className="text-neutral-400 tabular-nums"> · {r.runAt}</span>
                        </div>
                        <div className="mt-1">
                          <Toggle
                            on={active[r.id]}
                            disabled={readOnly}
                            label={`Schedule for ${r.name}`}
                            onChange={(v) => setActive((p) => ({ ...p, [r.id]: v }))}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <LastRun run={r.lastRun} />
                      </td>
                      <td className="py-3.5 pr-4 text-xs leading-tight">
                        <div className="text-neutral-700">{r.modifiedBy}</div>
                        <div className="text-neutral-400 tabular-nums">{r.modifiedOn}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                          >
                            <Icon d={I.history} className="h-3.5 w-3.5" />
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => onRun([r.id])}
                            className="inline-flex h-7 items-center gap-1 border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-800 hover:border-indigo-300 hover:text-indigo-700"
                          >
                            <Icon d={I.play} className="h-3.5 w-3.5 text-indigo-600" />
                            Run
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
              <span className="tabular-nums">
                {rows.length} of {counts[asset]} reports
              </span>
              <span>Sorted by last modified</span>
            </div>
          </div>
        )}
      </div>

      {/* Selection bar — only exists when there is something to run */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center justify-between border-t border-neutral-800 bg-neutral-900 px-6 py-3 text-sm text-white">
          <div className="flex items-center gap-3">
            <span className="font-medium tabular-nums">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRun([...selected])}
            className="inline-flex h-8 items-center gap-1.5 bg-indigo-500 px-3 font-medium hover:bg-indigo-400"
          >
            <Icon d={I.play} className="h-4 w-4" />
            Run {selected.size} {selected.size === 1 ? "report" : "reports"}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ asset, searching }: { asset: AssetClass; searching: boolean }) {
  const label = ASSET_TABS.find((t) => t.id === asset)?.label ?? asset;
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <Icon d={I.filter} className="h-6 w-6 text-neutral-300" />
      <h2 className="mt-3 text-sm font-medium text-neutral-900">
        {searching ? "No reports match your search" : `No ${label} exception reports yet`}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        {searching
          ? "Try a report name, a condition such as “spread”, or a recipient email."
          : "Reports are set up by your BestX administrator. Ask them to add one for this asset class."}
      </p>
    </div>
  );
}

/* ======================================================================
 * Screen 2 — Report view
 * ==================================================================== */

type View = "summary" | "trades";

function Kpi({
  label,
  value,
  unit,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone?: "neutral" | "neg" | "pos" | "warn";
}) {
  const valueTone = {
    neutral: "text-neutral-900",
    neg: "text-rose-700",
    pos: "text-emerald-700",
    warn: "text-amber-700",
  }[tone];
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${valueTone}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-neutral-400">{unit}</span>}
      </div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}

function Card({
  title,
  hint,
  right,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col border border-neutral-200 bg-white ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
        </div>
        {right}
      </header>
      <div className="flex-1 px-2 py-2">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-neutral-200">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={`h-6 px-2 text-[11px] ${o.id === value ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const signColour = (v: number) => (v > 0 ? TONE.neg : TONE.pos);

const bpsTooltip = {
  pointFormatter(this: { y?: number; series: { name: string } }) {
    const y = this.y ?? 0;
    return `<span style="color:#a3a3a3">${this.series.name}</span> <b>${y > 0 ? "+" : ""}${y.toFixed(1)} bps</b>`;
  },
};

function ReportView({ reportIds, onBack }: { reportIds: string[]; onBack: () => void }) {
  const report = REPORTS.find((r) => r.id === reportIds[0]) ?? REPORTS[0];
  const [view, setView] = useState<View>("summary");
  const [dimension, setDimension] = useState<Dimension | "">("");
  const [rank, setRank] = useState<"worst" | "best">("worst");

  const stats = useMemo(() => {
    const diffs = TRADES.map(diff);
    const costs = diffs.filter((d) => d > 0);
    const commented = TRADES.filter((t) => t.commented).length;
    const notional = TRADES.reduce((s, t) => s + t.notionalM, 0);
    return {
      exceptions: TRADES.length,
      rate: (TRADES.length / TOTAL_TRADES_IN_PERIOD) * 100,
      avgExcess: costs.reduce((s, d) => s + d, 0) / costs.length,
      worst: Math.max(...diffs),
      commented,
      awaiting: TRADES.length - commented,
      notional,
      // $ cost ≈ bps × notional
      costUsd: TRADES.reduce((s, t) => s + (Math.max(diff(t), 0) / 1e4) * t.notionalM * 1e6, 0),
    };
  }, []);

  /* 1 · Spread & impact — actual vs expected, per component. */
  const spreadOptions = useMemo<Options>(
    () => ({
      chart: { type: "column" },
      xAxis: { categories: ["Spot impact", "Spot spread", "Forward spread", "Total spread"] },
      yAxis: {
        title: { text: undefined },
        labels: { format: "{value} bps" },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
      },
      legend: { align: "left", verticalAlign: "top", margin: 4 },
      tooltip: { shared: true, ...bpsTooltip, headerFormat: "<b>{point.key}</b><br/>" },
      series: [
        { type: "column", name: "Actual", color: "#4f46e5", data: [4.2, 18.6, 6.1, 24.7] },
        { type: "column", name: "Expected", color: "#c7d2fe", data: [1.1, 2.4, 1.3, 3.8] },
      ],
      plotOptions: {
        column: {
          dataLabels: { enabled: true, format: "{y:.1f}", style: { color: "#525252" } },
        },
      },
    }),
    [],
  );

  /* 2 · Performance vs benchmarks — horizontal, one sign convention. */
  const benchOptions = useMemo<Options>(() => {
    const data = [
      ["Arrival price", 14.2],
      ["Risk transfer", 14.3],
      ["1 hr TWAP", 13.8],
      ["Q Best", 0.2],
      ["Q Avg", 0.1],
      ["Q Worst", -0.4],
      ["WMR LN 4pm fix", 14.1],
    ] as const;
    return {
      chart: { type: "bar" },
      xAxis: { categories: data.map((d) => d[0]) },
      yAxis: {
        title: { text: undefined },
        labels: { format: "{value}" },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
      },
      legend: { enabled: false },
      tooltip: bpsTooltip,
      series: [
        {
          type: "bar",
          name: "Cost vs benchmark",
          data: data.map(([, y]) => ({ y, color: signColour(y) })),
          dataLabels: { enabled: true, format: "{y:+.1f}", style: { color: "#525252" } },
        },
      ],
    };
  }, []);

  /* 3 · Worst / best ten trades by excess spread. */
  const rankOptions = useMemo<Options>(() => {
    const sorted = [...TRADES].sort((a, b) =>
      rank === "worst" ? diff(b) - diff(a) : diff(a) - diff(b),
    );
    const top = sorted.slice(0, 10);
    return {
      chart: { type: "bar" },
      xAxis: {
        categories: top.map((t) => `${t.pair} · ${t.id.slice(-4)}`),
        labels: { style: { fontFamily: "ui-monospace, monospace" } },
      },
      yAxis: {
        title: { text: undefined },
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 3 }],
      },
      legend: { enabled: false },
      tooltip: bpsTooltip,
      series: [
        {
          type: "bar",
          name: "Actual − expected",
          data: top.map((t) => ({ y: diff(t), color: signColour(diff(t)) })),
          dataLabels: { enabled: true, format: "{y:+.1f}", style: { color: "#525252" } },
        },
      ],
    };
  }, [rank]);

  /* 4 · Implementation shortfall — where along the order's life cost was added. */
  const shortfallOptions = useMemo<Options>(
    () => ({
      chart: { type: "waterfall" },
      xAxis: {
        categories: [
          "Desk arrival",
          "→ Market sent<br/><span style='color:#a3a3a3'>+420 ms</span>",
          "→ Quote time<br/><span style='color:#a3a3a3'>+180 ms</span>",
          "→ Completed<br/><span style='color:#a3a3a3'>+95 ms</span>",
          "Total shortfall",
        ],
        labels: { useHTML: true },
      },
      yAxis: { title: { text: undefined }, labels: { format: "{value} bps" } },
      legend: { enabled: false },
      tooltip: bpsTooltip,
      series: [
        {
          type: "waterfall",
          name: "Shortfall",
          upColor: TONE.neg,
          color: TONE.pos,
          data: [
            { y: 0, color: "#d4d4d4" },
            { y: 3.1 },
            { y: 9.4 },
            { y: 1.7 },
            { isSum: true, color: "#4f46e5" },
          ],
          dataLabels: { enabled: true, format: "{y:.1f}", style: { color: "#525252" } },
        },
      ],
    }),
    [],
  );

  const breakdown = useMemo(() => {
    if (!dimension) return [];
    const r = seeded(dimension.length * 97);
    return DIMENSION_VALUES[dimension]
      .map((name) => ({ name, count: 1 + Math.floor(r() * 14), bps: +(4 + r() * 26).toFixed(1) }))
      .sort((a, b) => b.bps - a.bps);
  }, [dimension]);

  const algos = [
    { name: "Auto Price Test Bank Market", share: 100, trades: 42 },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Report header */}
      <div className="border-b border-neutral-200 bg-white px-6 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
        >
          <Icon d={I.back} className="h-3.5 w-3.5" />
          All exception reports
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              {report.name}
              {reportIds.length > 1 && (
                <span className="ml-2 align-middle text-xs font-normal text-neutral-500">
                  + {reportIds.length - 1} more
                </span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1">
              {report.conditions.map((c, i) => (
                <ConditionChip key={i} c={c} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 border border-neutral-200 bg-white px-3 text-sm text-neutral-800 hover:border-neutral-300"
            >
              <Icon d={I.calendar} className="h-4 w-4 text-neutral-400" />
              <span className="tabular-nums">Aug 01 – Aug 31, 2026</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 border border-neutral-200 bg-white px-3 text-sm text-neutral-800 hover:border-neutral-300"
            >
              <Icon d={I.filter} className="h-3.5 w-3.5 text-neutral-400" />
              Filters
              <span className="bg-indigo-50 px-1 text-[11px] text-indigo-700">2</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center border border-neutral-200 bg-white px-3 text-sm text-neutral-800 hover:border-neutral-300"
            >
              USD
            </button>
            <IconButton label="Re-run report" d={I.refresh} />
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-700"
            >
              <Icon d={I.download} className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* View switch + break-down menu, replacing 14 tabs */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div role="tablist" aria-label="Report view" className="flex gap-6">
            {(
              [
                { id: "summary", label: "Summary" },
                { id: "trades", label: `Trades (${TRADES.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setView(t.id)}
                className={`-mb-px border-b-2 pb-2.5 text-sm transition ${
                  view === t.id
                    ? "border-indigo-600 font-medium text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
            Break down by
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as Dimension | "")}
              className="h-7 border border-neutral-200 bg-white px-2 text-sm text-neutral-800 outline-none focus:border-indigo-500"
            >
              <option value="">None</option>
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto bg-neutral-50 px-6 py-5">
        {/* KPIs — the answer before the charts */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Exceptions"
            value={String(stats.exceptions)}
            sub={`${stats.rate.toFixed(1)}% of ${TOTAL_TRADES_IN_PERIOD.toLocaleString()} trades`}
            tone="neg"
          />
          <Kpi
            label="Avg excess spread"
            value={`+${stats.avgExcess.toFixed(1)}`}
            unit="bps"
            sub="Actual − expected, costs only"
            tone="neg"
          />
          <Kpi
            label="Worst trade"
            value={`+${stats.worst.toFixed(1)}`}
            unit="bps"
            sub="vs expected spread"
          />
          <Kpi
            label="Estimated cost"
            value={
              stats.costUsd >= 1e6
                ? `$${(stats.costUsd / 1e6).toFixed(1)}M`
                : `$${(stats.costUsd / 1e3).toFixed(0)}k`
            }
            sub={`on $${(stats.notional / 1000).toFixed(2)}bn notional`}
          />
          <Kpi
            label="Awaiting comment"
            value={String(stats.awaiting)}
            sub={`${stats.commented} of ${stats.exceptions} reviewed`}
            tone="warn"
          />
        </div>

        {/* Legend strip — say the rule once, instead of per chart */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span>All values in basis points.</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5" style={{ background: TONE.neg }} />
            Above zero = cost
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5" style={{ background: TONE.pos }} />
            Below zero = saving
          </span>
        </div>

        {dimension && (
          <Card
            title={`Excess spread by ${dimension.toLowerCase()}`}
            hint="Average actual − expected, highest cost first"
            right={
              <button
                type="button"
                onClick={() => setDimension("")}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                Clear
              </button>
            }
          >
            <RankedBars
              rows={breakdown.map((b) => ({
                name: b.name,
                value: b.bps,
                label: `+${b.bps.toFixed(1)} bps`,
                meta: `${b.count} trades`,
              }))}
              tone="neg"
            />
          </Card>
        )}

        {view === "summary" ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card title="Spread & impact cost" hint="Actual paid vs BestX expected, by component">
                <HighchartsView options={spreadOptions} height={260} />
              </Card>
              <Card title="Cost vs benchmarks" hint="How far fills sat from each benchmark">
                <HighchartsView options={benchOptions} height={260} />
              </Card>
              <Card
                title={rank === "worst" ? "Ten worst trades" : "Ten best trades"}
                hint="Total spread, actual − expected"
                right={
                  <Segmented
                    label="Rank"
                    value={rank}
                    onChange={setRank}
                    options={[
                      { id: "worst", label: "Worst" },
                      { id: "best", label: "Best" },
                    ]}
                  />
                }
              >
                <HighchartsView options={rankOptions} height={260} />
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card
                title="Implementation shortfall"
                hint="Cost added at each stage of the order, with time taken"
                className="xl:col-span-2"
              >
                <HighchartsView options={shortfallOptions} height={260} />
              </Card>
              <div className="grid gap-4">
                <Card title="Review status" hint="Exceptions need a comment before sign-off">
                  <ReviewStatus
                    commented={stats.commented}
                    awaiting={stats.awaiting}
                    onOpen={() => setView("trades")}
                  />
                </Card>
                <Card title="Volume by algo" hint="Share of exception trades">
                  <RankedBars
                    rows={algos.map((a) => ({
                      name: a.name,
                      value: a.share,
                      label: `${a.share}%`,
                      meta: `${a.trades} trades`,
                    }))}
                    max={100}
                    tone="brand"
                  />
                </Card>
              </div>
            </div>

            <Card
              title="Largest exceptions"
              hint="Top 8 by excess spread"
              right={
                <button
                  type="button"
                  onClick={() => setView("trades")}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  View all {TRADES.length} →
                </button>
              }
            >
              <TradeTable trades={[...TRADES].sort((a, b) => diff(b) - diff(a)).slice(0, 8)} />
            </Card>
          </>
        ) : (
          <Card title="Exception trades" hint="Every trade that breached the report's conditions">
            <TradeTable trades={[...TRADES].sort((a, b) => diff(b) - diff(a))} />
          </Card>
        )}
      </div>
    </div>
  );
}

/* A ranked bar list — replaces pies. Works for 1 item and for 20. */
function RankedBars({
  rows,
  max,
  tone,
}: {
  rows: { name: string; value: number; label: string; meta?: string }[];
  max?: number;
  tone: "neg" | "brand";
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  const bar = tone === "neg" ? "bg-rose-500" : "bg-indigo-500";
  return (
    <ul className="space-y-2.5 px-2 py-1">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-neutral-800">{r.name}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium text-neutral-900">{r.label}</span>
              {r.meta && <span className="ml-2 text-neutral-400">{r.meta}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-neutral-100">
            <div className={`h-full ${bar}`} style={{ width: `${(r.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReviewStatus({
  commented,
  awaiting,
  onOpen,
}: {
  commented: number;
  awaiting: number;
  onOpen: () => void;
}) {
  const total = commented + awaiting;
  const pct = (commented / total) * 100;
  return (
    <div className="px-2 py-1">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
          {pct.toFixed(0)}%
        </span>
        <span className="text-xs text-neutral-500">reviewed</span>
      </div>
      <div className="mt-2 flex h-2 bg-neutral-100">
        <div className="bg-emerald-600" style={{ width: `${pct}%` }} />
        <div className="bg-amber-400" style={{ width: `${100 - pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          <span className="h-2 w-2 bg-emerald-600" />
          Commented <b className="font-medium text-neutral-900 tabular-nums">{commented}</b>
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          <span className="h-2 w-2 bg-amber-400" />
          Awaiting <b className="font-medium text-neutral-900 tabular-nums">{awaiting}</b>
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full border border-neutral-200 py-1.5 text-xs font-medium text-neutral-800 hover:border-indigo-300 hover:text-indigo-700"
      >
        Review {awaiting} trades
      </button>
    </div>
  );
}

function TradeTable({ trades }: { trades: TradeException[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
            <th className="px-2 py-2">Trade</th>
            <th className="px-2 py-2">Time</th>
            <th className="px-2 py-2">Pair</th>
            <th className="px-2 py-2">Side</th>
            <th className="px-2 py-2 text-right">Notional</th>
            <th className="px-2 py-2">Counterparty</th>
            <th className="px-2 py-2 text-right">Actual</th>
            <th className="px-2 py-2 text-right">Expected</th>
            <th className="px-2 py-2 text-right">Excess</th>
            <th className="px-2 py-2 text-right">Comment</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const d = diff(t);
            const commented = t.commented || done.has(t.id);
            return (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-2 py-2 font-mono text-neutral-800">{t.id}</td>
                <td className="px-2 py-2 text-neutral-500 tabular-nums">{t.time}</td>
                <td className="px-2 py-2 font-medium text-neutral-900">{t.pair}</td>
                <td className="px-2 py-2 text-neutral-600">{t.side}</td>
                <td className="px-2 py-2 text-right text-neutral-800 tabular-nums">
                  {t.notionalM.toFixed(1)}M
                </td>
                <td className="px-2 py-2 text-neutral-600">{t.counterparty}</td>
                <td className="px-2 py-2 text-right text-neutral-800 tabular-nums">
                  {t.actual.toFixed(1)}
                </td>
                <td className="px-2 py-2 text-right text-neutral-500 tabular-nums">
                  {t.expected.toFixed(1)}
                </td>
                <td
                  className={`px-2 py-2 text-right font-medium tabular-nums ${d > 0 ? "text-rose-700" : "text-emerald-700"}`}
                >
                  {d > 0 ? "+" : ""}
                  {d.toFixed(1)}
                </td>
                <td className="px-2 py-2 text-right">
                  {commented ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Icon d={I.check} className="h-3.5 w-3.5" />
                      Commented
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDone((p) => new Set(p).add(t.id))}
                      className="inline-flex items-center gap-1 border border-neutral-200 px-2 py-0.5 text-neutral-700 hover:border-indigo-300 hover:text-indigo-700"
                    >
                      <Icon d={I.chat} className="h-3 w-3" />
                      Add
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ======================================================================
 * Page
 * ==================================================================== */

export default function BestxExceptions() {
  const [running, setRunning] = useState<string[] | null>(null);
  const current = running ? REPORTS.find((r) => r.id === running[0]) : null;

  return (
    <div className="flex h-full min-h-screen flex-col bg-neutral-50">
      <TopBar
        crumbs={
          current
            ? [
                { label: "Exception reports", onClick: () => setRunning(null) },
                { label: current.name },
              ]
            : [{ label: "Exception reports" }]
        }
      />
      {running ? (
        <ReportView reportIds={running} onBack={() => setRunning(null)} />
      ) : (
        <ReportList onRun={setRunning} />
      )}
    </div>
  );
}
