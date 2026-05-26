import { useMemo, useState } from "react";

export const title = "Best Execution · TCA";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Best Execution — Transaction Cost Analysis (TCA)
 *
 * The execution desk measures fill quality vs a benchmark (Arrival
 * price, VWAP, or TWAP). Slippage in basis points captures how far the
 * average fill deviated from the benchmark at order-receipt time.
 *
 *   Negative slippage  →  paid more than benchmark (cost / red)
 *   Positive slippage  →  received better than benchmark (emerald)
 *   Near zero          →  within tolerance band (neutral)
 *
 * Implementation shortfall = total $ cost of the deviation across all
 * child fills. The header toggle re-bases all slippage numbers to the
 * selected benchmark. Selecting an order in the scatter or table drives
 * the detail panel showing the fill timeline and venue split.
 *
 * Design rule (shared with the workspace):
 *   CALM IS THE DEFAULT. A clean book is neutral grey.
 *   Colour is reserved for statistically meaningful slippage.
 * ------------------------------------------------------------------ */

/* ======================================================================
 * Data model
 * ==================================================================== */

type Benchmark = "Arrival" | "VWAP" | "TWAP";
type Side = "Buy" | "Sell";
type Status = "Complete" | "Partial" | "Cancelled";
type AssetClass = "Equity" | "FX" | "Fixed Income" | "ETF";

type Venue = "XLON" | "BATS" | "Turquoise" | "Dark-A" | "CBOE";
type Algo = "VWAP" | "TWAP" | "IS" | "Liq-seek" | "POV";

interface ChildFill {
  /** minutes from order receipt */
  t: number;
  /** cumulative fill fraction 0-1 */
  cumFillPct: number;
  /** child fill price */
  px: number;
}

interface Order {
  id: string;
  ticker: string;
  assetClass: AssetClass;
  side: Side;
  notional: number;
  venue: Venue;
  algo: Algo;
  /** slippage vs Arrival in bp (negative = cost) */
  slippageArrival: number;
  /** slippage vs VWAP */
  slippageVWAP: number;
  /** slippage vs TWAP */
  slippageTWAP: number;
  fillRate: number;
  status: Status;
  /** arrival price at order receipt */
  arrivalPx: number;
  /** average fill price achieved */
  avgFillPx: number;
  /** VWAP over the order duration */
  vwap: number;
  /** fill timeline for detail panel */
  fills: ChildFill[];
  /** venue split: fraction of fills by venue */
  venueSplit: { venue: Venue; share: number }[];
}

/* ======================================================================
 * Mock data — realistic institutional values
 * ==================================================================== */

// Helper to build plausible fill timelines
function buildFills(
  durationMin: number,
  arrivalPx: number,
  avgFillPx: number,
  steps = 12,
): ChildFill[] {
  const out: ChildFill[] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    // S-curve fill progression
    const sCurve = 1 / (1 + Math.exp(-10 * (frac - 0.5)));
    const cumFillPct = Math.min(1, sCurve);
    // Price walks from arrival toward avg fill with noise
    const drift = frac * (avgFillPx - arrivalPx);
    const noise = arrivalPx * 0.0002 * (Math.sin(i * 2.3) + Math.cos(i * 1.7));
    out.push({ t: Math.round(frac * durationMin), cumFillPct, px: arrivalPx + drift + noise });
  }
  return out;
}

const ORDERS: Order[] = [
  {
    id: "ORD-0001",
    ticker: "SHEL",
    assetClass: "Equity",
    side: "Buy",
    notional: 4_820_000,
    venue: "XLON",
    algo: "VWAP",
    slippageArrival: -3.8,
    slippageVWAP: -0.6,
    slippageTWAP: -1.2,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 2412.8,
    avgFillPx: 2413.7,
    vwap: 2413.5,
    fills: buildFills(45, 2412.8, 2413.7),
    venueSplit: [
      { venue: "XLON", share: 0.62 },
      { venue: "BATS", share: 0.22 },
      { venue: "Turquoise", share: 0.16 },
    ],
  },
  {
    id: "ORD-0002",
    ticker: "HSBA",
    assetClass: "Equity",
    side: "Sell",
    notional: 9_140_000,
    venue: "BATS",
    algo: "IS",
    slippageArrival: -7.2,
    slippageVWAP: -5.1,
    slippageTWAP: -6.3,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 648.4,
    avgFillPx: 647.9,
    vwap: 648.1,
    fills: buildFills(70, 648.4, 647.9),
    venueSplit: [
      { venue: "BATS" as Venue, share: 0.48 },
      { venue: "Dark-A" as Venue, share: 0.31 },
      { venue: "CBOE" as Venue, share: 0.21 },
    ],
  },
  {
    id: "ORD-0003",
    ticker: "BARC",
    assetClass: "Equity",
    side: "Buy",
    notional: 2_360_000,
    venue: "Turquoise",
    algo: "Liq-seek",
    slippageArrival: 2.1,
    slippageVWAP: 1.4,
    slippageTWAP: 0.9,
    fillRate: 98,
    status: "Complete",
    arrivalPx: 229.1,
    avgFillPx: 228.6,
    vwap: 229.0,
    fills: buildFills(30, 229.1, 228.6),
    venueSplit: [
      { venue: "Turquoise", share: 0.71 },
      { venue: "Dark-A", share: 0.29 },
    ],
  },
  {
    id: "ORD-0004",
    ticker: "VOD",
    assetClass: "Equity",
    side: "Sell",
    notional: 14_300_000,
    venue: "XLON",
    algo: "VWAP",
    slippageArrival: -1.5,
    slippageVWAP: -0.3,
    slippageTWAP: -0.9,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 75.36,
    avgFillPx: 75.35,
    vwap: 75.38,
    fills: buildFills(120, 75.36, 75.35),
    venueSplit: [
      { venue: "XLON", share: 0.55 },
      { venue: "BATS", share: 0.3 },
      { venue: "CBOE", share: 0.15 },
    ],
  },
  {
    id: "ORD-0005",
    ticker: "AZN",
    assetClass: "Equity",
    side: "Buy",
    notional: 21_800_000,
    venue: "XLON",
    algo: "TWAP",
    slippageArrival: -5.6,
    slippageVWAP: -4.2,
    slippageTWAP: -0.8,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 10840.0,
    avgFillPx: 10845.9,
    vwap: 10844.5,
    fills: buildFills(90, 10840.0, 10845.9),
    venueSplit: [
      { venue: "XLON", share: 0.68 },
      { venue: "Turquoise", share: 0.2 },
      { venue: "Dark-A", share: 0.12 },
    ],
  },
  {
    id: "ORD-0006",
    ticker: "GLEN",
    assetClass: "Equity",
    side: "Buy",
    notional: 7_650_000,
    venue: "Dark-A",
    algo: "Liq-seek",
    slippageArrival: 4.3,
    slippageVWAP: 3.1,
    slippageTWAP: 2.7,
    fillRate: 87,
    status: "Partial",
    arrivalPx: 498.6,
    avgFillPx: 497.5,
    vwap: 498.2,
    fills: buildFills(55, 498.6, 497.5),
    venueSplit: [
      { venue: "Dark-A", share: 0.83 },
      { venue: "XLON", share: 0.17 },
    ],
  },
  {
    id: "ORD-0007",
    ticker: "BHP",
    assetClass: "Equity",
    side: "Sell",
    notional: 5_210_000,
    venue: "CBOE",
    algo: "IS",
    slippageArrival: -9.4,
    slippageVWAP: -7.1,
    slippageTWAP: -8.2,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 2248.5,
    avgFillPx: 2246.4,
    vwap: 2247.0,
    fills: buildFills(40, 2248.5, 2246.4),
    venueSplit: [
      { venue: "CBOE", share: 0.45 },
      { venue: "XLON", share: 0.35 },
      { venue: "BATS", share: 0.2 },
    ],
  },
  {
    id: "ORD-0008",
    ticker: "LLOY",
    assetClass: "Equity",
    side: "Buy",
    notional: 3_480_000,
    venue: "BATS",
    algo: "POV",
    slippageArrival: 0.4,
    slippageVWAP: 0.2,
    slippageTWAP: -0.1,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 54.92,
    avgFillPx: 54.94,
    vwap: 54.93,
    fills: buildFills(60, 54.92, 54.94),
    venueSplit: [
      { venue: "BATS", share: 0.6 },
      { venue: "XLON", share: 0.4 },
    ],
  },
  {
    id: "ORD-0009",
    ticker: "RIO",
    assetClass: "Equity",
    side: "Sell",
    notional: 11_600_000,
    venue: "XLON",
    algo: "VWAP",
    slippageArrival: -2.3,
    slippageVWAP: -1.1,
    slippageTWAP: -1.8,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 5240.0,
    avgFillPx: 5238.8,
    vwap: 5239.4,
    fills: buildFills(80, 5240.0, 5238.8),
    venueSplit: [
      { venue: "XLON", share: 0.58 },
      { venue: "Turquoise", share: 0.27 },
      { venue: "BATS", share: 0.15 },
    ],
  },
  {
    id: "ORD-0010",
    ticker: "BP",
    assetClass: "Equity",
    side: "Buy",
    notional: 16_900_000,
    venue: "XLON",
    algo: "POV",
    slippageArrival: -11.2,
    slippageVWAP: -8.4,
    slippageTWAP: -9.7,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 432.1,
    avgFillPx: 432.6,
    vwap: 432.4,
    fills: buildFills(150, 432.1, 432.6),
    venueSplit: [
      { venue: "XLON", share: 0.7 },
      { venue: "BATS", share: 0.18 },
      { venue: "Turquoise", share: 0.12 },
    ],
  },
  {
    id: "ORD-0011",
    ticker: "ULVR",
    assetClass: "Equity",
    side: "Sell",
    notional: 6_720_000,
    venue: "Turquoise",
    algo: "Liq-seek",
    slippageArrival: 5.8,
    slippageVWAP: 4.3,
    slippageTWAP: 3.9,
    fillRate: 95,
    status: "Complete",
    arrivalPx: 3985.0,
    avgFillPx: 3987.3,
    vwap: 3986.7,
    fills: buildFills(50, 3985.0, 3987.3),
    venueSplit: [
      { venue: "Turquoise", share: 0.66 },
      { venue: "Dark-A", share: 0.34 },
    ],
  },
  {
    id: "ORD-0012",
    ticker: "DGE",
    assetClass: "Equity",
    side: "Buy",
    notional: 8_200_000,
    venue: "Dark-A",
    algo: "IS",
    slippageArrival: -4.1,
    slippageVWAP: -2.9,
    slippageTWAP: -3.6,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 2890.0,
    avgFillPx: 2891.2,
    vwap: 2890.8,
    fills: buildFills(65, 2890.0, 2891.2),
    venueSplit: [
      { venue: "Dark-A", share: 0.52 },
      { venue: "XLON", share: 0.29 },
      { venue: "BATS", share: 0.19 },
    ],
  },
  {
    id: "ORD-0013",
    ticker: "EXPN",
    assetClass: "Equity",
    side: "Buy",
    notional: 3_100_000,
    venue: "CBOE",
    algo: "TWAP",
    slippageArrival: 1.7,
    slippageVWAP: 0.9,
    slippageTWAP: 0.1,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 3180.0,
    avgFillPx: 3179.5,
    vwap: 3179.7,
    fills: buildFills(35, 3180.0, 3179.5),
    venueSplit: [
      { venue: "CBOE", share: 0.54 },
      { venue: "BATS", share: 0.46 },
    ],
  },
  {
    id: "ORD-0014",
    ticker: "PRU",
    assetClass: "Equity",
    side: "Sell",
    notional: 4_450_000,
    venue: "BATS",
    algo: "VWAP",
    slippageArrival: -6.5,
    slippageVWAP: -4.8,
    slippageTWAP: -5.3,
    fillRate: 72,
    status: "Partial",
    arrivalPx: 886.4,
    avgFillPx: 885.8,
    vwap: 886.1,
    fills: buildFills(45, 886.4, 885.8),
    venueSplit: [
      { venue: "BATS", share: 0.75 },
      { venue: "XLON", share: 0.25 },
    ],
  },
  {
    id: "ORD-0015",
    ticker: "REL",
    assetClass: "Equity",
    side: "Buy",
    notional: 5_800_000,
    venue: "XLON",
    algo: "Liq-seek",
    slippageArrival: 3.2,
    slippageVWAP: 2.1,
    slippageTWAP: 1.5,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 1860.0,
    avgFillPx: 1859.4,
    vwap: 1859.6,
    fills: buildFills(40, 1860.0, 1859.4),
    venueSplit: [
      { venue: "XLON", share: 0.5 },
      { venue: "Turquoise", share: 0.31 },
      { venue: "Dark-A", share: 0.19 },
    ],
  },
  {
    id: "ORD-0016",
    ticker: "CRH",
    assetClass: "Equity",
    side: "Sell",
    notional: 18_400_000,
    venue: "XLON",
    algo: "IS",
    slippageArrival: -13.7,
    slippageVWAP: -10.2,
    slippageTWAP: -11.8,
    fillRate: 100,
    status: "Complete",
    arrivalPx: 6450.0,
    avgFillPx: 6441.2,
    vwap: 6444.6,
    fills: buildFills(100, 6450.0, 6441.2),
    venueSplit: [
      { venue: "XLON", share: 0.61 },
      { venue: "CBOE", share: 0.24 },
      { venue: "BATS", share: 0.15 },
    ],
  },
];

/* ======================================================================
 * Derived / computed data
 * ==================================================================== */

const TOTAL_NOTIONAL = ORDERS.reduce((s, o) => s + o.notional, 0);

function getSlippage(o: Order, bm: Benchmark): number {
  return bm === "Arrival" ? o.slippageArrival : bm === "VWAP" ? o.slippageVWAP : o.slippageTWAP;
}

/** Shortfall in $ from slippage for one order */
function shortfallDollars(o: Order, bm: Benchmark): number {
  const bpCost = -getSlippage(o, bm); // positive = cost
  return (bpCost / 10_000) * o.notional;
}

/* ======================================================================
 * Helpers
 * ==================================================================== */

function compact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

function bpColor(bp: number): string {
  if (bp <= -5) return "text-red-700";
  if (bp < -2) return "text-red-600";
  if (bp < 0) return "text-red-500";
  if (bp < 2) return "text-neutral-500";
  return "text-emerald-700";
}

function slippageTone(bp: number): "error" | "warning" | "neutral" | "ok" {
  if (bp <= -5) return "error";
  if (bp < -2) return "warning";
  if (bp < 2) return "neutral";
  return "ok";
}

function assetDot(cls: AssetClass): string {
  const map: Record<AssetClass, string> = {
    Equity: "bg-sky-400",
    FX: "bg-amber-400",
    "Fixed Income": "bg-violet-400",
    ETF: "bg-teal-400",
  };
  return map[cls];
}

/* ======================================================================
 * Atoms
 * ==================================================================== */

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

/* ======================================================================
 * Scatter plot — slippage vs notional
 * ==================================================================== */

function SlippageScatter({
  orders,
  benchmark,
  selectedId,
  onSelect,
}: {
  orders: Order[];
  benchmark: Benchmark;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Layout constants
  const W = 1000;
  const H = 280;
  const PAD = { top: 24, right: 24, bottom: 48, left: 54 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // X: notional (linear), Y: slippage bp
  const notionals = orders.map((o) => o.notional);
  const minN = Math.min(...notionals);
  const maxN = Math.max(...notionals);

  const slippages = orders.map((o) => getSlippage(o, benchmark));
  const rawMin = Math.min(...slippages);
  const rawMax = Math.max(...slippages);
  // Ensure zero is visible and axis extends beyond data
  const yMin = Math.min(rawMin - 1.5, -5);
  const yMax = Math.max(rawMax + 1.5, 7);

  function xPos(n: number): number {
    return PAD.left + ((n - minN) / (maxN - minN)) * innerW;
  }
  function yPos(bp: number): number {
    return PAD.top + ((yMax - bp) / (yMax - yMin)) * innerH;
  }

  const zeroY = yPos(0);
  const tolBandTop = yPos(3);
  const tolBandBot = yPos(-3);

  // Y gridlines at regular bp intervals
  const yTicks: number[] = [];
  for (let bp = Math.ceil(yMin); bp <= Math.floor(yMax); bp++) {
    if (bp % 2 === 0) yTicks.push(bp);
  }

  // X axis ticks — 5 evenly spaced
  const xTicks = [0, 1, 2, 3, 4].map((i) => minN + (i / 4) * (maxN - minN));

  // Dot size proportional to sqrt of notional (compressed range)
  const sqrtNotionals = notionals.map((n) => Math.sqrt(n));
  const sqrtMin = Math.min(...sqrtNotionals);
  const sqrtMax = Math.max(...sqrtNotionals);
  function dotR(n: number): number {
    const t = (Math.sqrt(n) - sqrtMin) / (sqrtMax - sqrtMin);
    return 4 + t * 7;
  }

  function dotFill(bp: number): string {
    if (bp <= -5) return "#ef4444"; // red-500
    if (bp < -2) return "#f87171"; // red-400
    if (bp < 0) return "#fca5a5"; // red-300
    if (bp < 2) return "#a3a3a3"; // neutral-400
    return "#34d399"; // emerald-400
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label="Slippage vs order size scatter plot"
    >
      {/* Tolerance band ±3bp */}
      <rect
        x={PAD.left}
        y={tolBandTop}
        width={innerW}
        height={tolBandBot - tolBandTop}
        fill="#f0fdf4"
        opacity="0.7"
      />

      {/* Y gridlines */}
      {yTicks.map((bp) => (
        <g key={bp}>
          <line
            x1={PAD.left}
            y1={yPos(bp)}
            x2={PAD.left + innerW}
            y2={yPos(bp)}
            stroke={bp === 0 ? "#404040" : "#e5e5e5"}
            strokeWidth={bp === 0 ? 1.5 : 0.8}
            strokeDasharray={bp === 0 ? undefined : "3 3"}
          />
          <text
            x={PAD.left - 6}
            y={yPos(bp)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={9}
            fill={bp === 0 ? "#525252" : "#a3a3a3"}
            fontFamily="ui-monospace, monospace"
          >
            {bp > 0 ? `+${bp}` : bp}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text
        x={PAD.left - 36}
        y={PAD.top + innerH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fill="#737373"
        transform={`rotate(-90, ${PAD.left - 36}, ${PAD.top + innerH / 2})`}
      >
        Slippage (bp)
      </text>

      {/* X ticks */}
      {xTicks.map((n, i) => (
        <g key={i}>
          <line
            x1={xPos(n)}
            y1={PAD.top + innerH}
            x2={xPos(n)}
            y2={PAD.top + innerH + 4}
            stroke="#d4d4d4"
            strokeWidth={0.8}
          />
          <text
            x={xPos(n)}
            y={PAD.top + innerH + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#a3a3a3"
            fontFamily="ui-monospace, monospace"
          >
            {compact(n)}
          </text>
        </g>
      ))}

      <text
        x={PAD.left + innerW / 2}
        y={H - 6}
        textAnchor="middle"
        fontSize={9}
        fill="#737373"
      >
        Order notional
      </text>

      {/* Tolerance band label */}
      <text
        x={PAD.left + innerW - 4}
        y={tolBandTop + 3}
        textAnchor="end"
        fontSize={8}
        fill="#86efac"
      >
        +3bp tolerance
      </text>
      <text
        x={PAD.left + innerW - 4}
        y={tolBandBot - 3}
        textAnchor="end"
        fontSize={8}
        fill="#fca5a5"
      >
        −3bp tolerance
      </text>

      {/* Zero line label */}
      <text
        x={PAD.left + 4}
        y={zeroY - 4}
        fontSize={8}
        fill="#525252"
      >
        Benchmark
      </text>

      {/* Dots — render selected last so it appears on top */}
      {orders
        .filter((o) => o.id !== selectedId)
        .map((o) => {
          const bp = getSlippage(o, benchmark);
          const cx = xPos(o.notional);
          const cy = yPos(bp);
          const r = dotR(o.notional);
          return (
            <circle
              key={o.id}
              cx={cx}
              cy={cy}
              r={r}
              fill={dotFill(bp)}
              fillOpacity={0.75}
              stroke="white"
              strokeWidth={1}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(o.id)}
            />
          );
        })}

      {/* Selected dot — rendered on top with ring */}
      {selectedId &&
        (() => {
          const o = orders.find((x) => x.id === selectedId);
          if (!o) return null;
          const bp = getSlippage(o, benchmark);
          const cx = xPos(o.notional);
          const cy = yPos(bp);
          const r = dotR(o.notional);
          return (
            <g key="selected">
              <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={dotFill(bp)}
                stroke="white"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(o.id)}
              />
              {/* Ticker label */}
              <text
                x={cx}
                y={cy - r - 6}
                textAnchor="middle"
                fontSize={8}
                fill="#0369a1"
                fontFamily="ui-monospace, monospace"
              >
                {o.ticker}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

/* ======================================================================
 * Fill timeline for selected order
 * ==================================================================== */

function FillTimeline({ order }: { order: Order }) {
  const W = 400;
  const H = 130;
  const PAD = { top: 16, right: 16, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const fills = order.fills;
  const maxT = fills[fills.length - 1].t;
  const allPx = fills.map((f) => f.px);
  const pxMin = Math.min(...allPx, order.arrivalPx, order.avgFillPx) * 0.9998;
  const pxMax = Math.max(...allPx, order.arrivalPx, order.avgFillPx) * 1.0002;

  function xPos(t: number) {
    return PAD.left + (t / maxT) * innerW;
  }
  function yPos(px: number) {
    return PAD.top + ((pxMax - px) / (pxMax - pxMin)) * innerH;
  }

  // Build area path from cumulative fill % (right axis — drawn as area)
  const areaPoints = fills
    .map((f) => `${xPos(f.t)},${PAD.top + innerH - f.cumFillPct * innerH}`)
    .join(" ");
  const areaPath = `M ${xPos(fills[0].t)},${PAD.top + innerH} L ${areaPoints} L ${xPos(fills[fills.length - 1].t)},${PAD.top + innerH} Z`;

  // Price line path
  const pricePath = fills.map((f, i) => `${i === 0 ? "M" : "L"} ${xPos(f.t)},${yPos(f.px)}`).join(" ");

  const arrivalY = yPos(order.arrivalPx);
  const avgY = yPos(order.avgFillPx);

  // X ticks — 5 evenly spaced
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxT));
  // Y ticks — 3
  const yTicks = [pxMin, (pxMin + pxMax) / 2, pxMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Fill area (cumulative %) — secondary axis, faint */}
      <path d={areaPath} fill="#0ea5e9" fillOpacity={0.07} />

      {/* Arrival price line */}
      <line
        x1={PAD.left}
        y1={arrivalY}
        x2={PAD.left + innerW}
        y2={arrivalY}
        stroke="#f59e0b"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text
        x={PAD.left + 3}
        y={arrivalY - 3}
        fontSize={7}
        fill="#f59e0b"
        fontFamily="ui-monospace, monospace"
      >
        Arrival {order.arrivalPx.toFixed(2)}
      </text>

      {/* Avg fill line */}
      <line
        x1={PAD.left}
        y1={avgY}
        x2={PAD.left + innerW}
        y2={avgY}
        stroke="#6366f1"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <text
        x={PAD.left + 3}
        y={avgY + 8}
        fontSize={7}
        fill="#6366f1"
        fontFamily="ui-monospace, monospace"
      >
        Avg fill {order.avgFillPx.toFixed(2)}
      </text>

      {/* Price line */}
      <path d={pricePath} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />

      {/* Y ticks */}
      {yTicks.map((px, i) => (
        <g key={i}>
          <line
            x1={PAD.left - 3}
            y1={yPos(px)}
            x2={PAD.left}
            y2={yPos(px)}
            stroke="#d4d4d4"
            strokeWidth={0.8}
          />
          <text
            x={PAD.left - 5}
            y={yPos(px)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={7}
            fill="#a3a3a3"
            fontFamily="ui-monospace, monospace"
          >
            {px.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X axis */}
      <line
        x1={PAD.left}
        y1={PAD.top + innerH}
        x2={PAD.left + innerW}
        y2={PAD.top + innerH}
        stroke="#e5e5e5"
        strokeWidth={0.8}
      />
      {xTicks.map((t) => (
        <g key={t}>
          <line
            x1={xPos(t)}
            y1={PAD.top + innerH}
            x2={xPos(t)}
            y2={PAD.top + innerH + 3}
            stroke="#d4d4d4"
            strokeWidth={0.8}
          />
          <text
            x={xPos(t)}
            y={PAD.top + innerH + 12}
            textAnchor="middle"
            fontSize={7}
            fill="#a3a3a3"
            fontFamily="ui-monospace, monospace"
          >
            {t}m
          </text>
        </g>
      ))}
      <text
        x={PAD.left + innerW / 2}
        y={H - 2}
        textAnchor="middle"
        fontSize={7}
        fill="#a3a3a3"
      >
        Time from order receipt (min)
      </text>
    </svg>
  );
}

/* ======================================================================
 * Venue diverging bar (per-venue avg slippage)
 * ==================================================================== */

function VenueAvgSlippage({
  orders,
  benchmark,
}: {
  orders: Order[];
  benchmark: Benchmark;
}) {
  const venues: Venue[] = ["XLON", "BATS", "Turquoise", "Dark-A", "CBOE"];
  const venueStats = venues.map((v) => {
    const vOrders = orders.filter((o) => o.venue === v);
    const avg = vOrders.length
      ? vOrders.reduce((s, o) => s + getSlippage(o, benchmark), 0) / vOrders.length
      : 0;
    return { venue: v, avg, count: vOrders.length };
  });

  const maxAbs = Math.max(...venueStats.map((s) => Math.abs(s.avg)), 3);
  const BAR_W = 140; // px total bar width (half each side)
  const midX = BAR_W;

  return (
    <div className="flex flex-col gap-2">
      {venueStats.map(({ venue, avg, count }) => {
        const barPx = Math.round((Math.abs(avg) / maxAbs) * (BAR_W - 16));
        const isNeg = avg < 0;
        return (
          <div key={venue} className="flex items-center gap-2">
            <span className="w-20 truncate text-right font-mono text-[11px] text-neutral-600">
              {venue}
            </span>
            {/* Diverging bar */}
            <div
              className="relative flex items-center"
              style={{ width: BAR_W * 2, height: 14 }}
            >
              {/* centre line */}
              <div
                className="absolute inset-y-0 bg-neutral-200"
                style={{ left: midX - 0.5, width: 1 }}
              />
              {/* bar */}
              <div
                className={`absolute h-2 rounded-sm ${isNeg ? "bg-red-400" : "bg-emerald-400"}`}
                style={{
                  [isNeg ? "right" : "left"]: midX + 1,
                  width: barPx,
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...(isNeg ? { right: midX + 1, left: "auto" } : { left: midX + 1, right: "auto" }),
                }}
              />
            </div>
            <span className={`w-16 font-mono text-[11px] tabular-nums ${bpColor(avg)}`}>
              {avg >= 0 ? "+" : ""}{avg.toFixed(1)} bp
            </span>
            <span className="text-[10px] text-neutral-400">
              n={count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ======================================================================
 * Page component
 * ==================================================================== */

export default function TcaExecution() {
  const [benchmark, setBenchmark] = useState<Benchmark>("Arrival");
  const [selectedId, setSelectedId] = useState<string>(ORDERS[0].id);

  const selectedOrder = useMemo(
    () => ORDERS.find((o) => o.id === selectedId) ?? ORDERS[0],
    [selectedId],
  );

  // KPI derivations
  const avgSlippage = useMemo(() => {
    const sum = ORDERS.reduce((s, o) => s + getSlippage(o, benchmark), 0);
    return sum / ORDERS.length;
  }, [benchmark]);

  const totalShortfall = useMemo(
    () => ORDERS.reduce((s, o) => s + shortfallDollars(o, benchmark), 0),
    [benchmark],
  );

  const ordersInTolerance = useMemo(() => {
    const count = ORDERS.filter((o) => Math.abs(getSlippage(o, benchmark)) <= 3).length;
    return (count / ORDERS.length) * 100;
  }, [benchmark]);

  const selectedSlippage = getSlippage(selectedOrder, benchmark);
  const selectedShortfall = shortfallDollars(selectedOrder, benchmark);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ----------------------------------------------------------------
       * Header
       * -------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">Best Execution · TCA</span>
          <span className="text-xs text-neutral-400">
            Execution desk · slippage vs benchmark
          </span>
        </div>

        {/* Benchmark segmented toggle */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {(["Arrival", "VWAP", "TWAP"] as Benchmark[]).map((bm) => (
            <button
              key={bm}
              type="button"
              onClick={() => setBenchmark(bm)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                benchmark === bm
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {bm}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {avgSlippage < -3 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Avg {avgSlippage.toFixed(1)} bp vs {benchmark}
            </span>
          ) : avgSlippage < 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Avg {avgSlippage.toFixed(1)} bp vs {benchmark}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Price improvement vs {benchmark}
            </span>
          )}
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            Export TCA report
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------
       * Scrollable body
       * -------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-5">
          {/* ---- KPI strip ---- */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi
              label={`Avg slippage vs ${benchmark}`}
              value={`${avgSlippage >= 0 ? "+" : ""}${avgSlippage.toFixed(1)} bp`}
              hint={`${ORDERS.length} orders · today's session`}
              tone={slippageTone(avgSlippage)}
            />
            <Kpi
              label="Implementation shortfall"
              value={compact(totalShortfall)}
              hint={`Total cost of ${benchmark} deviation across all orders`}
              tone={totalShortfall > 50_000 ? "error" : totalShortfall > 20_000 ? "warning" : "neutral"}
            />
            <Kpi
              label="Orders within ±3bp tolerance"
              value={`${ordersInTolerance.toFixed(0)}%`}
              hint={`${Math.round((ordersInTolerance / 100) * ORDERS.length)} of ${ORDERS.length} orders`}
              tone={ordersInTolerance >= 80 ? "ok" : ordersInTolerance >= 65 ? "warning" : "error"}
            />
            <Kpi
              label="Total notional executed"
              value={compact(TOTAL_NOTIONAL)}
              hint={`${ORDERS.filter((o) => o.status === "Complete").length} complete · ${ORDERS.filter((o) => o.status === "Partial").length} partial`}
              tone="neutral"
            />
          </div>

          {/* ---- Scatter + Venue summary row ---- */}
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
            {/* Scatter hero */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Slippage vs order size
                </h2>
                <span className="text-[10px] text-neutral-400">
                  vs {benchmark} · dot size ∝ notional · click to select
                </span>
              </div>
              <div className="p-4">
                <SlippageScatter
                  orders={ORDERS}
                  benchmark={benchmark}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            </section>

            {/* Venue avg slippage */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Venue performance
                </h2>
                <span className="text-[10px] text-neutral-400">avg slippage by primary venue</span>
              </div>
              <div className="px-4 py-3">
                <VenueAvgSlippage orders={ORDERS} benchmark={benchmark} />

                {/* Venue fill share mini bars */}
                <div className="mt-5 border-t border-neutral-100 pt-4">
                  <p className="mb-3 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                    Order flow share
                  </p>
                  {(["XLON", "BATS", "Turquoise", "Dark-A", "CBOE"] as Venue[]).map((v) => {
                    const count = ORDERS.filter((o) => o.venue === v).length;
                    const pct = (count / ORDERS.length) * 100;
                    return (
                      <div key={v} className="mb-2 flex items-center gap-2">
                        <span className="w-20 text-right font-mono text-[11px] text-neutral-600">
                          {v}
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded-md bg-neutral-100">
                          <div
                            className="h-full bg-neutral-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 font-mono text-[11px] tabular-nums text-neutral-500">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* ---- Order table + detail panel row ---- */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_440px]">
            {/* Order table */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Orders
                </h2>
                <span className="text-[10px] text-neutral-400">{ORDERS.length} orders · today</span>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_56px_88px_72px_68px_64px_56px_70px] gap-2 border-b border-neutral-100 px-4 py-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                <span>Instrument</span>
                <span>Side</span>
                <span className="text-right">Notional</span>
                <span>Venue</span>
                <span>Algo</span>
                <span className="text-right">Slip (bp)</span>
                <span className="text-right">Fill%</span>
                <span>Status</span>
              </div>

              <ul>
                {ORDERS.map((o) => {
                  const bp = getSlippage(o, benchmark);
                  const active = o.id === selectedId;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.id)}
                        className={`grid w-full grid-cols-[1fr_56px_88px_72px_68px_64px_56px_70px] items-center gap-2 border-b border-neutral-100 px-4 py-2.5 text-left transition last:border-b-0 ${
                          active ? "bg-sky-50/60" : "hover:bg-neutral-50"
                        }`}
                      >
                        {/* Instrument */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${assetDot(o.assetClass)}`}
                          />
                          <span className="truncate font-mono text-xs font-semibold tabular-nums text-neutral-800">
                            {o.ticker}
                          </span>
                        </div>

                        {/* Side */}
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                            o.side === "Buy"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {o.side}
                        </span>

                        {/* Notional */}
                        <span className="text-right font-mono text-[11px] tabular-nums text-neutral-700">
                          {compact(o.notional)}
                        </span>

                        {/* Venue */}
                        <span className="font-mono text-[11px] text-neutral-500">{o.venue}</span>

                        {/* Algo */}
                        <span className="font-mono text-[11px] text-neutral-500">{o.algo}</span>

                        {/* Slippage */}
                        <span
                          className={`text-right font-mono text-xs font-semibold tabular-nums ${bpColor(bp)}`}
                        >
                          {bp >= 0 ? "+" : ""}
                          {bp.toFixed(1)}
                        </span>

                        {/* Fill rate */}
                        <span className="text-right font-mono text-[11px] tabular-nums text-neutral-600">
                          {o.fillRate}%
                        </span>

                        {/* Status */}
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
                            o.status === "Complete"
                              ? "bg-neutral-100 text-neutral-600"
                              : o.status === "Partial"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {o.status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Detail panel */}
            <div className="flex flex-col gap-3.5">
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">
                      {selectedOrder.ticker} · {selectedOrder.id}
                    </h2>
                    <p className="text-[11px] text-neutral-400">
                      {selectedOrder.side} · {selectedOrder.algo} · {selectedOrder.venue}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${
                      selectedSlippage <= -3
                        ? "bg-red-50 text-red-700 ring-red-200"
                        : selectedSlippage < 0
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    }`}
                  >
                    {selectedSlippage >= 0 ? "+" : ""}
                    {selectedSlippage.toFixed(1)} bp
                  </span>
                </div>

                {/* Key metrics grid */}
                <div className="grid grid-cols-2 gap-3 px-4 py-3">
                  {[
                    ["Arrival price", selectedOrder.arrivalPx.toFixed(2)],
                    ["Avg fill price", selectedOrder.avgFillPx.toFixed(2)],
                    ["VWAP", selectedOrder.vwap.toFixed(2)],
                    [
                      `Slippage vs ${benchmark}`,
                      `${selectedSlippage >= 0 ? "+" : ""}${selectedSlippage.toFixed(1)} bp`,
                    ],
                    [
                      "Impl. shortfall",
                      compact(Math.abs(selectedShortfall)),
                    ],
                    ["Notional", compact(selectedOrder.notional)],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-lg border border-neutral-100 p-2.5">
                      <div className="text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                        {label}
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-neutral-800">
                        {val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fill timeline */}
                <div className="border-t border-neutral-100 px-5 pb-4 pt-3">
                  <p className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                    Fill timeline
                  </p>
                  <FillTimeline order={selectedOrder} />
                </div>
              </section>

              {/* Venue split for selected order */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Venue split
                  </h2>
                  <span className="text-[10px] text-neutral-400">
                    {selectedOrder.ticker} · by executed notional
                  </span>
                </div>
                <div className="px-4 py-3">
                  {/* Stacked waterfall bar */}
                  <div className="mb-4 flex h-6 w-full overflow-hidden rounded-md bg-neutral-100 ring-1 ring-inset ring-neutral-200">
                    {selectedOrder.venueSplit.map(({ venue, share }, i) => {
                      const colors = [
                        "bg-sky-400",
                        "bg-violet-400",
                        "bg-teal-400",
                        "bg-amber-400",
                        "bg-neutral-400",
                      ];
                      return (
                        <div
                          key={venue}
                          className={`flex items-center justify-center ${colors[i % colors.length]} border-r border-white/60`}
                          style={{ width: `${share * 100}%` }}
                          title={`${venue}: ${(share * 100).toFixed(0)}%`}
                        >
                          {share > 0.1 && (
                            <span className="px-1 font-mono text-[9px] font-semibold text-neutral-900/80">
                              {venue}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <ul className="flex flex-col gap-2">
                    {selectedOrder.venueSplit.map(({ venue, share }, i) => {
                      const colors = [
                        "bg-sky-400",
                        "bg-violet-400",
                        "bg-teal-400",
                        "bg-amber-400",
                        "bg-neutral-400",
                      ];
                      return (
                        <li key={venue} className="flex items-center gap-2.5">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${colors[i % colors.length]}`} />
                          <span className="flex-1 font-mono text-xs text-neutral-700">{venue}</span>
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className={`h-full ${colors[i % colors.length]}`}
                              style={{ width: `${share * 100}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono text-xs tabular-nums text-neutral-600">
                            {(share * 100).toFixed(0)}%
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-neutral-400">
                            {compact(selectedOrder.notional * share * selectedOrder.fillRate / 100)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
