import { useState } from "react";

export const title = "Stress & Scenario Analysis";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Risk — Stress & Scenario Analysis
 *
 * The portfolio is run through a library of historical and hypothetical
 * stress scenarios. Each scenario produces a total P&L impact that is
 * decomposed by risk factor (Rates, Credit, Equity, FX, Vol, Commodity,
 * Basis) and by trading desk. The analyst can select a scenario and see
 * a tornado chart of factor contributions, a desk-level breakdown, and
 * a full scenario × factor heatmap at the bottom.
 *
 * Design rule (shared with the workspace):
 *   CALM IS THE DEFAULT. A neutral, fully-hedged book is grey.
 *   Red = loss / severe, Amber = moderate, Emerald = gain / benign.
 *   Fills are always desaturated — strong saturation is reserved for
 *   the section heading accent colours and status pills only.
 * ------------------------------------------------------------------ */

/* ================================================================== *
 * Data model
 * ================================================================== */

type ScenarioType = "Historical" | "Hypothetical" | "Regulatory";

type RiskFactor =
  | "Rates"
  | "Credit"
  | "Equity"
  | "FX"
  | "Vol"
  | "Commodity"
  | "Basis";

type Desk = "Rates" | "Credit" | "Equities" | "FX" | "Commodities" | "XVA";

/** Per-scenario P&L impact split by risk factor (negative = loss, $) */
type FactorImpact = Record<RiskFactor, number>;

/** Per-scenario P&L impact split by trading desk (negative = loss, $) */
type DeskImpact = Record<Desk, number>;

type Scenario = {
  id: string;
  name: string;
  type: ScenarioType;
  /** Total P&L impact in $ — should be close to the sum of factor impacts */
  totalPnl: number;
  /** Risk appetite limit for this type of scenario (negative = loss, $) */
  appetite: number;
  factors: FactorImpact;
  desks: DeskImpact;
};

/* ================================================================== *
 * Mock data — realistic institutional figures
 * ================================================================== */

const SCENARIOS: Scenario[] = [
  {
    id: "gfc",
    name: "2008 GFC Replay",
    type: "Historical",
    totalPnl: -1_820_000_000,
    appetite: -1_500_000_000,
    factors: {
      Rates:     -240_000_000,
      Credit:    -820_000_000,
      Equity:    -410_000_000,
      FX:         -95_000_000,
      Vol:        -310_000_000,
      Commodity:   80_000_000,
      Basis:      -25_000_000,
    },
    desks: {
      Rates:       -280_000_000,
      Credit:      -720_000_000,
      Equities:    -390_000_000,
      FX:          -110_000_000,
      Commodities:   80_000_000,
      XVA:         -400_000_000,
    },
  },
  {
    id: "covid",
    name: "COVID March-2020 Replay",
    type: "Historical",
    totalPnl: -1_340_000_000,
    appetite: -1_500_000_000,
    factors: {
      Rates:      180_000_000,
      Credit:    -550_000_000,
      Equity:    -620_000_000,
      FX:         -70_000_000,
      Vol:        -310_000_000,
      Commodity:  -140_000_000,
      Basis:       170_000_000,
    },
    desks: {
      Rates:        200_000_000,
      Credit:      -490_000_000,
      Equities:    -610_000_000,
      FX:           -80_000_000,
      Commodities: -130_000_000,
      XVA:         -230_000_000,
    },
  },
  {
    id: "rates200",
    name: "Rates +200 bp Parallel Shift",
    type: "Hypothetical",
    totalPnl: -980_000_000,
    appetite: -1_200_000_000,
    factors: {
      Rates:     -870_000_000,
      Credit:    -110_000_000,
      Equity:      20_000_000,
      FX:          15_000_000,
      Vol:         -40_000_000,
      Commodity:    5_000_000,
      Basis:       -10_000_000,
    },
    desks: {
      Rates:       -760_000_000,
      Credit:      -130_000_000,
      Equities:     20_000_000,
      FX:           15_000_000,
      Commodities:   5_000_000,
      XVA:        -130_000_000,
    },
  },
  {
    id: "eq30vol",
    name: "Equity −30 % / Vol +15 pts",
    type: "Hypothetical",
    totalPnl: -870_000_000,
    appetite: -1_000_000_000,
    factors: {
      Rates:       50_000_000,
      Credit:     -60_000_000,
      Equity:    -590_000_000,
      FX:         -30_000_000,
      Vol:        -255_000_000,
      Commodity:   10_000_000,
      Basis:       -5_000_000,
    },
    desks: {
      Rates:         50_000_000,
      Credit:       -70_000_000,
      Equities:     -580_000_000,
      FX:            -30_000_000,
      Commodities:   10_000_000,
      XVA:          -250_000_000,
    },
  },
  {
    id: "sovereign",
    name: "Sovereign Credit Shock",
    type: "Hypothetical",
    totalPnl: -760_000_000,
    appetite: -1_000_000_000,
    factors: {
      Rates:    -280_000_000,
      Credit:   -420_000_000,
      Equity:    -60_000_000,
      FX:        -35_000_000,
      Vol:        20_000_000,
      Commodity:  15_000_000,
      Basis:      -5_000_000,
    },
    desks: {
      Rates:      -310_000_000,
      Credit:     -380_000_000,
      Equities:    -65_000_000,
      FX:          -40_000_000,
      Commodities:  15_000_000,
      XVA:         -80_000_000,
    },
  },
  {
    id: "usd_funding",
    name: "USD Funding Squeeze",
    type: "Regulatory",
    totalPnl: -650_000_000,
    appetite: -800_000_000,
    factors: {
      Rates:    -140_000_000,
      Credit:   -190_000_000,
      Equity:    -50_000_000,
      FX:       -180_000_000,
      Vol:        30_000_000,
      Commodity: -40_000_000,
      Basis:     -90_000_000,
    },
    desks: {
      Rates:      -150_000_000,
      Credit:     -195_000_000,
      Equities:    -55_000_000,
      FX:         -175_000_000,
      Commodities: -40_000_000,
      XVA:         -35_000_000,
    },
  },
  {
    id: "rates_steepen",
    name: "Rates −50 bp Flattener",
    type: "Hypothetical",
    totalPnl: -340_000_000,
    appetite: -600_000_000,
    factors: {
      Rates:    -290_000_000,
      Credit:    -30_000_000,
      Equity:     40_000_000,
      FX:          5_000_000,
      Vol:        -15_000_000,
      Commodity:  10_000_000,
      Basis:     -60_000_000,
    },
    desks: {
      Rates:      -280_000_000,
      Credit:      -35_000_000,
      Equities:     40_000_000,
      FX:            5_000_000,
      Commodities:  10_000_000,
      XVA:         -80_000_000,
    },
  },
  {
    id: "em_contagion",
    name: "EM Contagion / FX Crisis",
    type: "Historical",
    totalPnl: -510_000_000,
    appetite: -800_000_000,
    factors: {
      Rates:     50_000_000,
      Credit:   -160_000_000,
      Equity:   -120_000_000,
      FX:       -230_000_000,
      Vol:        -30_000_000,
      Commodity:  -40_000_000,
      Basis:      20_000_000,
    },
    desks: {
      Rates:        55_000_000,
      Credit:      -160_000_000,
      Equities:    -125_000_000,
      FX:          -225_000_000,
      Commodities:  -40_000_000,
      XVA:          -15_000_000,
    },
  },
  {
    id: "commodity_spike",
    name: "Commodity Supply Shock +40 %",
    type: "Hypothetical",
    totalPnl: 140_000_000,
    appetite: -600_000_000,
    factors: {
      Rates:    -20_000_000,
      Credit:   -10_000_000,
      Equity:   -40_000_000,
      FX:        20_000_000,
      Vol:       10_000_000,
      Commodity: 200_000_000,
      Basis:    -20_000_000,
    },
    desks: {
      Rates:        -20_000_000,
      Credit:       -10_000_000,
      Equities:     -40_000_000,
      FX:            25_000_000,
      Commodities:  195_000_000,
      XVA:          -10_000_000,
    },
  },
];

/** Scenarios sorted by severity (largest loss first, gains at bottom) */
const SORTED_SCENARIOS = [...SCENARIOS].sort((a, b) => a.totalPnl - b.totalPnl);

/** All risk factors in display order */
const ALL_FACTORS: RiskFactor[] = [
  "Rates",
  "Credit",
  "Equity",
  "FX",
  "Vol",
  "Commodity",
  "Basis",
];

/** All desks in display order */
const ALL_DESKS: Desk[] = [
  "Rates",
  "Credit",
  "Equities",
  "FX",
  "Commodities",
  "XVA",
];

/** Worst loss across all scenarios (for KPI card) */
const WORST_SCENARIO = SORTED_SCENARIOS[0];

/** How many scenarios breach their appetite */
const BREACHING_COUNT = SCENARIOS.filter(
  (s) => s.totalPnl < s.appetite,
).length;

/** Capital buffer set aside for stress losses (regulatory + management) */
const CAPITAL_BUFFER = 3_300_000_000;

/** Largest single factor loss across all scenarios (for KPI) */
const largestFactorEntry = (() => {
  let worstVal = 0;
  let worstFactor: RiskFactor = "Credit";
  for (const s of SCENARIOS) {
    for (const f of ALL_FACTORS) {
      if (s.factors[f] < worstVal) {
        worstVal = s.factors[f];
        worstFactor = f;
      }
    }
  }
  return { value: worstVal, factor: worstFactor };
})();

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

/** Badge colour for scenario type */
function typeBadgeClass(t: ScenarioType): string {
  return {
    Historical:   "bg-sky-50 text-sky-700 ring-sky-200",
    Hypothetical: "bg-violet-50 text-violet-700 ring-violet-200",
    Regulatory:   "bg-amber-50 text-amber-700 ring-amber-200",
  }[t];
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
    ok:      "border-l-emerald-500",
    warning: "border-l-amber-500",
    error:   "border-l-red-500",
  }[tone];
  const valueColor = {
    neutral: "text-neutral-900",
    ok:      "text-emerald-700",
    warning: "text-amber-700",
    error:   "text-red-700",
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

/* ================================================================== *
 * Tornado chart (inline SVG, diverging from zero axis)
 * ================================================================== */

/**
 * TornadoChart — hand-rolled SVG diverging bar chart.
 * Bars sorted by absolute magnitude (largest at top).
 * Losses extend left (muted red), gains extend right (muted emerald).
 */
function TornadoChart({ scenario }: { scenario: Scenario }) {
  const factors = [...ALL_FACTORS].sort(
    (a, b) => Math.abs(scenario.factors[b]) - Math.abs(scenario.factors[a]),
  );

  const rowH      = 36;   // px per factor row
  const labelW    = 90;   // px reserved for factor label on the left
  const valueW    = 72;   // px reserved for value label on the right
  const padTop    = 24;   // px above first bar (for scale ticks)
  const padBottom = 12;   // px below last bar
  const svgH      = padTop + rowH * factors.length + padBottom;

  // The chart usable width will be derived from CSS (100%).
  // We use a fixed viewBox width so we can do arithmetic, then let SVG scale.
  const VB_W = 680;
  const chartW = VB_W - labelW - valueW; // available for bars
  const axisX  = labelW + chartW / 2;    // centre zero line in viewBox coords

  // Absolute max across all factors for scale normalisation
  const maxAbs = Math.max(...factors.map((f) => Math.abs(scenario.factors[f])));
  const halfW  = chartW / 2;

  // Scale tick values (roughly 4 ticks per side)
  const tickStep = Math.ceil(maxAbs / 4 / 1e8) * 1e8;
  const ticks: number[] = [];
  for (let v = tickStep; v <= maxAbs * 1.05; v += tickStep) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${svgH}`}
      className="w-full"
      style={{ height: `${svgH}px` }}
      aria-label={`Tornado chart: factor P&L for ${scenario.name}`}
    >
      {/* ---- Scale ticks ---- */}
      {ticks.map((v) => {
        const xRight = axisX + (v / maxAbs) * halfW;
        const xLeft  = axisX - (v / maxAbs) * halfW;
        return (
          <g key={v}>
            {/* right tick */}
            <line
              x1={xRight} y1={padTop - 6}
              x2={xRight} y2={svgH - padBottom}
              stroke="#e5e7eb" strokeWidth={0.8} strokeDasharray="3 2"
            />
            <text
              x={xRight} y={padTop - 8}
              textAnchor="middle"
              fontSize={8} fill="#9ca3af"
            >
              {compact(v)}
            </text>
            {/* left tick */}
            <line
              x1={xLeft} y1={padTop - 6}
              x2={xLeft} y2={svgH - padBottom}
              stroke="#e5e7eb" strokeWidth={0.8} strokeDasharray="3 2"
            />
            <text
              x={xLeft} y={padTop - 8}
              textAnchor="middle"
              fontSize={8} fill="#9ca3af"
            >
              {compact(-v)}
            </text>
          </g>
        );
      })}

      {/* ---- Centre zero axis ---- */}
      <line
        x1={axisX} y1={padTop - 10}
        x2={axisX} y2={svgH - padBottom}
        stroke="#6b7280" strokeWidth={1}
      />

      {/* ---- Bars ---- */}
      {factors.map((factor, i) => {
        const pnl = scenario.factors[factor];
        const barLen = maxAbs > 0 ? (Math.abs(pnl) / maxAbs) * halfW : 0;
        const isLoss = pnl < 0;
        const barX   = isLoss ? axisX - barLen : axisX;
        const barY   = padTop + i * rowH + 6;
        const barH   = rowH - 12;
        const fillCls = isLoss ? "#fca5a5" : "#6ee7b7"; // red-300 / emerald-300

        // Value label position
        const valX = isLoss
          ? axisX - barLen - 4
          : axisX + barLen + 4;
        const valAnchor = isLoss ? "end" : "start";
        const valFill   = isLoss ? "#b91c1c" : "#047857"; // red-700 / emerald-700

        // Row background (alternating)
        const rowBg = i % 2 === 0 ? "#f9fafb" : "transparent";

        return (
          <g key={factor}>
            {/* Alternating row background */}
            <rect
              x={0} y={padTop + i * rowH}
              width={VB_W} height={rowH}
              fill={rowBg}
            />
            {/* Factor label */}
            <text
              x={labelW - 6}
              y={barY + barH / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fontWeight={500}
              fill="#374151"
            >
              {factor}
            </text>
            {/* Magnitude bar */}
            <rect
              x={barX} y={barY}
              width={barLen} height={barH}
              rx={2}
              fill={fillCls}
              fillOpacity={0.85}
            />
            {/* Value label at bar tip */}
            <text
              x={valX}
              y={barY + barH / 2 + 4}
              textAnchor={valAnchor}
              fontSize={9.5}
              fontWeight={600}
              fill={valFill}
              fontFamily="ui-monospace,SFMono-Regular,monospace"
            >
              {compact(pnl)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ================================================================== *
 * Heatmap cell — scenario × factor P&L intensity
 * ================================================================== */

/**
 * Map a P&L value to a desaturated background + text colour.
 * Scale is relative to the max absolute value in the matrix.
 */
function heatCell(value: number, maxAbs: number): { bg: string; fg: string } {
  if (maxAbs === 0) return { bg: "transparent", fg: "#374151" };
  const ratio = Math.abs(value) / maxAbs; // 0 → 1
  const alpha = 0.12 + ratio * 0.68;      // 0.12 → 0.80 — never fully saturated
  if (value < 0) {
    return {
      bg: `rgba(239,68,68,${alpha.toFixed(2)})`,   // red-500
      fg: ratio > 0.5 ? "#fff" : "#b91c1c",
    };
  }
  if (value > 0) {
    return {
      bg: `rgba(16,185,129,${alpha.toFixed(2)})`,  // emerald-500
      fg: ratio > 0.5 ? "#fff" : "#047857",
    };
  }
  return { bg: "transparent", fg: "#6b7280" };
}

/* ================================================================== *
 * Page component
 * ================================================================== */

export default function StressScenarios() {
  const [selectedId, setSelectedId]  = useState<string>(WORST_SCENARIO.id);
  const [view, setView]              = useState<"factor" | "desk">("factor");

  const selected = SCENARIOS.find((s) => s.id === selectedId)!;

  // Max absolute impact across the entire scenario list — used for bar widths in the list
  const listMaxAbs = Math.max(...SORTED_SCENARIOS.map((s) => Math.abs(s.totalPnl)));

  // Capital buffer coverage (how many times the worst loss the buffer covers)
  const bufferCoverage = CAPITAL_BUFFER / Math.abs(WORST_SCENARIO.totalPnl);

  // Heatmap: max absolute value across all scenario × factor combinations
  const heatmaxAbs = Math.max(
    ...SCENARIOS.flatMap((s) => ALL_FACTORS.map((f) => Math.abs(s.factors[f]))),
  );

  // Desk breakdown max absolute — for bar scaling within the desk table
  const deskMaxAbs = Math.max(
    ...ALL_DESKS.map((d) => Math.abs(selected.desks[d])),
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">

      {/* ================================================================ *
       *  Header
       * ================================================================ */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Stress &amp; Scenario Analysis
          </span>
          <span className="text-xs text-neutral-400">
            Risk · {SCENARIOS.length} scenarios · as of today
          </span>
        </div>

        {/* Factor / Desk toggle (drives the right-panel detail view) */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {(
            [
              ["factor", "By Factor"],
              ["desk",   "By Desk"],
            ] as ["factor" | "desk", string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                view === k
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Breaching appetite pill */}
          {BREACHING_COUNT > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {BREACHING_COUNT} scenario{BREACHING_COUNT !== 1 ? "s" : ""} breaching appetite
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              All within appetite
            </span>
          )}
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            Export report
          </button>
        </div>
      </header>

      {/* ================================================================ *
       *  Body
       * ================================================================ */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-5">

          {/* ---- KPI strip ---- */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi
              label="Worst-case scenario loss"
              value={compact(WORST_SCENARIO.totalPnl)}
              hint={WORST_SCENARIO.name}
              tone="error"
            />
            <Kpi
              label="Scenarios breaching appetite"
              value={`${BREACHING_COUNT} of ${SCENARIOS.length}`}
              hint="vs. board-approved stress appetite"
              tone={BREACHING_COUNT >= 3 ? "error" : BREACHING_COUNT > 0 ? "warning" : "ok"}
            />
            <Kpi
              label="Largest single-factor loss"
              value={compact(largestFactorEntry.value)}
              hint={`${largestFactorEntry.factor} spreads · GFC scenario`}
              tone="error"
            />
            <Kpi
              label="Capital buffer coverage"
              value={`${bufferCoverage.toFixed(1)}x`}
              hint={`${compact(CAPITAL_BUFFER)} buffer vs. worst loss`}
              tone={bufferCoverage >= 2 ? "ok" : bufferCoverage >= 1.5 ? "warning" : "error"}
            />
          </div>

          {/* ---- Main two-column layout ---- */}
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">

            {/* ============================================================ *
             *  Left — Scenario list
             * ============================================================ */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Scenarios
                </h2>
                <span className="text-[10px] text-neutral-400">sorted by severity</span>
              </div>

              <ul>
                {SORTED_SCENARIOS.map((s) => {
                  const isSelected  = s.id === selectedId;
                  const isBreaching = s.totalPnl < s.appetite;
                  const isGain      = s.totalPnl > 0;
                  // Bar width = share of the worst scenario's absolute magnitude
                  const barPct = (Math.abs(s.totalPnl) / listMaxAbs) * 100;

                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={`w-full border-t border-neutral-100 px-4 py-2.5 text-left transition first:border-t-0 ${
                          isSelected ? "bg-sky-50/60" : "hover:bg-neutral-50"
                        }`}
                      >
                        {/* Row 1: name + type badge + appetite indicator */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-neutral-800">
                              {s.name}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ring-1 ring-inset uppercase ${typeBadgeClass(s.type)}`}
                            >
                              {s.type}
                            </span>
                            {isBreaching ? (
                              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">
                                Breach
                              </span>
                            ) : (
                              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500">
                                Within
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: magnitude bar + P&L value */}
                        <div className="mt-2 flex items-center gap-2">
                          {/* Bar track — losses extend from right-to-left visually */}
                          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${
                                isGain ? "bg-emerald-300" : isBreaching ? "bg-red-400" : "bg-red-200"
                              }`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span
                            className={`w-20 shrink-0 text-right font-mono text-xs font-semibold tabular-nums ${
                              isGain ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {compact(s.totalPnl)}
                          </span>
                        </div>

                        {/* Row 3: appetite threshold */}
                        <div className="mt-1 text-[10px] text-neutral-400">
                          Appetite: {compact(s.appetite)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ============================================================ *
             *  Right — Tornado chart + detail breakdown
             * ============================================================ */}
            <div className="flex flex-col gap-4">

              {/* Selected scenario header */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">
                      {selected.name}
                    </h2>
                    <p className="text-[11px] text-neutral-400">
                      {selected.type} scenario · total impact:{" "}
                      <span
                        className={`font-mono font-semibold ${
                          selected.totalPnl < 0 ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {compact(selected.totalPnl)}
                      </span>
                      {" · "}appetite:{" "}
                      <span className="font-mono">{compact(selected.appetite)}</span>
                    </p>
                  </div>
                  {selected.totalPnl < selected.appetite ? (
                    <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                      Appetite breached
                    </span>
                  ) : selected.totalPnl < 0 ? (
                    <span className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200">
                      Within appetite
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Net gain
                    </span>
                  )}
                </div>

                {/* ---- Tornado chart (factor view) or Desk table (desk view) ---- */}
                {view === "factor" ? (
                  <div className="px-4 py-3">
                    <p className="mb-3 text-[10px] text-neutral-400">
                      Risk-factor P&amp;L decomposition — sorted by absolute magnitude. Losses left (red), gains right (emerald).
                    </p>
                    <TornadoChart scenario={selected} />
                  </div>
                ) : (
                  /* Desk breakdown table */
                  <div className="px-4 py-3">
                    <p className="mb-3 text-[10px] text-neutral-400">
                      P&amp;L impact attributed to each trading desk.
                    </p>
                    <div className="grid grid-cols-[1fr_80px_180px] gap-y-2 pb-1">
                      {/* Column headers */}
                      <div className="col-span-3 grid grid-cols-[1fr_80px_180px] gap-x-2 px-1 pb-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                        <span>Desk</span>
                        <span className="text-right">P&amp;L</span>
                        <span>Magnitude</span>
                      </div>
                      {ALL_DESKS.map((desk) => {
                        const val     = selected.desks[desk];
                        const isLoss  = val < 0;
                        const isGain  = val > 0;
                        const barPct  = deskMaxAbs > 0 ? (Math.abs(val) / deskMaxAbs) * 100 : 0;
                        return (
                          <div
                            key={desk}
                            className="col-span-3 grid grid-cols-[1fr_80px_180px] items-center gap-x-3 rounded-lg border border-neutral-100 px-3 py-2"
                          >
                            <span className="text-sm font-medium text-neutral-800">{desk}</span>
                            <span
                              className={`text-right font-mono text-xs font-semibold tabular-nums ${
                                isLoss ? "text-red-700" : isGain ? "text-emerald-700" : "text-neutral-500"
                              }`}
                            >
                              {compact(val)}
                            </span>
                            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className={`h-full rounded-full ${
                                  isLoss ? "bg-red-300" : "bg-emerald-300"
                                }`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* ================================================================ *
           *  Bottom — Scenario × Factor heatmap matrix (full width)
           * ================================================================ */}
          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
              <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Scenario × Risk-Factor Matrix
              </h2>
              <div className="flex items-center gap-4">
                {/* Legend */}
                <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-5 rounded-sm bg-red-200" />
                    Loss
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-5 rounded-sm" style={{ background: "rgba(239,68,68,0.75)" }} />
                    Severe loss
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-5 rounded-sm bg-emerald-200" />
                    Gain
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400">click row to select scenario</span>
              </div>
            </div>

            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full min-w-[700px] border-separate border-spacing-0.5 text-[11px]">
                <thead>
                  <tr>
                    {/* Scenario name column */}
                    <th className="w-52 pb-2 text-left text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      Scenario
                    </th>
                    <th className="w-14 pb-2 text-right text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      Total
                    </th>
                    {ALL_FACTORS.map((f) => (
                      <th
                        key={f}
                        className="pb-2 text-center text-[10px] font-semibold tracking-wider text-neutral-400 uppercase"
                      >
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SORTED_SCENARIOS.map((s) => {
                    const isSelected = s.id === selectedId;
                    return (
                      <tr
                        key={s.id}
                        className={`cursor-pointer transition ${
                          isSelected ? "outline outline-1 outline-sky-400" : ""
                        }`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        {/* Scenario name */}
                        <td
                          className={`rounded-l py-1.5 pl-2 pr-3 text-[11px] font-medium text-neutral-700 ${
                            isSelected ? "bg-sky-50" : "bg-white"
                          }`}
                        >
                          {s.name}
                        </td>

                        {/* Total P&L */}
                        {(() => {
                          const { bg, fg } = heatCell(s.totalPnl, heatmaxAbs);
                          return (
                            <td
                              className="py-1.5 text-right font-mono tabular-nums"
                              style={{ background: bg, color: fg }}
                            >
                              <span className="px-2 font-semibold">{compact(s.totalPnl)}</span>
                            </td>
                          );
                        })()}

                        {/* Factor cells */}
                        {ALL_FACTORS.map((f) => {
                          const val = s.factors[f];
                          const { bg, fg } = heatCell(val, heatmaxAbs);
                          return (
                            <td
                              key={f}
                              className="rounded py-1.5 text-center font-mono tabular-nums"
                              style={{ background: bg, color: fg }}
                            >
                              <span className="px-1">{compact(val)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
