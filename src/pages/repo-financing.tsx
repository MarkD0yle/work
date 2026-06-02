import { useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

export const title = "Repo & Securities Financing";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Treasury / Repo Desk — Financing Book Monitor
 *
 * The repo desk funds the firm and earns carry by lending inventory.
 * Repo trades: we post bonds and borrow cash (liability = cash in).
 * Reverse-repo: we lend cash and take bonds as collateral (asset = bond in).
 *
 * The desk monitors:
 *   • the net financing book (repo vs reverse-repo across tenors)
 *   • the blended funding rate vs the GC (general collateral) benchmark
 *   • the maturity ladder — how much rolls off overnight / this week
 *   • individual trade economics: rate, spread to GC, haircut
 *
 * Design rule (shared with the workspace):
 *   CALM IS THE DEFAULT. A well-funded book is neutral grey.
 *   Amber = paying up vs GC or heavy O/N rollover risk.
 *   Red = above-threshold spread or a breach.
 *   Emerald = positive carry / below-benchmark.
 * ------------------------------------------------------------------ */

/* ---------- Types ---------- */

type Tenor = "O/N" | "1W" | "2W" | "1M" | "3M" | "6M";
type Direction = "Repo" | "Reverse";
type CollateralClass = "UST" | "Bund" | "Gilt" | "IG Corp" | "Agency";
type ViewTab = "All" | "Repo" | "Reverse";

type Trade = {
  id: string;
  counterparty: string;
  direction: Direction;
  collateral: string;
  collateralClass: CollateralClass;
  tenor: Tenor;
  notional: number;   // face / market value
  rate: number;       // annualised %, e.g. 4.42
  gcRate: number;     // GC benchmark for this collateral bucket
  haircut: number;    // fraction, e.g. 0.02
  maturityLabel: string;
};

/* ---------- Mock curve data ---------- */

type CurvePoint = { tenor: Tenor; deskRate: number; gcRate: number };

const CURVE: CurvePoint[] = [
  { tenor: "O/N", deskRate: 4.41, gcRate: 4.35 },
  { tenor: "1W",  deskRate: 4.43, gcRate: 4.36 },
  { tenor: "2W",  deskRate: 4.46, gcRate: 4.38 },
  { tenor: "1M",  deskRate: 4.52, gcRate: 4.44 },
  { tenor: "3M",  deskRate: 4.61, gcRate: 4.57 },
  { tenor: "6M",  deskRate: 4.72, gcRate: 4.68 },
];

/* ---------- Maturity ladder ---------- */

type BucketData = {
  tenor: Tenor;
  repoNotional: number;     // cash borrowed (repo)
  reverseNotional: number;  // cash lent (reverse)
};

const LADDER: BucketData[] = [
  { tenor: "O/N", repoNotional: 620_000_000,  reverseNotional: 280_000_000  },
  { tenor: "1W",  repoNotional: 940_000_000,  reverseNotional: 540_000_000  },
  { tenor: "2W",  repoNotional: 380_000_000,  reverseNotional: 210_000_000  },
  { tenor: "1M",  repoNotional: 580_000_000,  reverseNotional: 390_000_000  },
  { tenor: "3M",  repoNotional: 420_000_000,  reverseNotional: 310_000_000  },
  { tenor: "6M",  repoNotional: 260_000_000,  reverseNotional: 190_000_000  },
];

/* ---------- Mock financing book trades (12 trades) ---------- */

const TRADES: Trade[] = [
  {
    id: "t01",
    counterparty: "JP Morgan",
    direction: "Repo",
    collateral: "UST 10Y",
    collateralClass: "UST",
    tenor: "O/N",
    notional: 250_000_000,
    rate: 4.42,
    gcRate: 4.35,
    haircut: 0.02,
    maturityLabel: "O/N",
  },
  {
    id: "t02",
    counterparty: "Goldman Sachs",
    direction: "Repo",
    collateral: "UST 2Y",
    collateralClass: "UST",
    tenor: "1W",
    notional: 180_000_000,
    rate: 4.44,
    gcRate: 4.36,
    haircut: 0.005,
    maturityLabel: "T+7",
  },
  {
    id: "t03",
    counterparty: "BNP Paribas",
    direction: "Reverse",
    collateral: "Bund 5Y",
    collateralClass: "Bund",
    tenor: "1M",
    notional: 120_000_000,
    rate: 4.49,
    gcRate: 4.44,
    haircut: 0.01,
    maturityLabel: "T+30",
  },
  {
    id: "t04",
    counterparty: "Barclays",
    direction: "Repo",
    collateral: "UK Gilt 10Y",
    collateralClass: "Gilt",
    tenor: "1W",
    notional: 95_000_000,
    rate: 4.48,
    gcRate: 4.36,
    haircut: 0.025,
    maturityLabel: "T+7",
  },
  {
    id: "t05",
    counterparty: "Citi",
    direction: "Reverse",
    collateral: "UST 30Y",
    collateralClass: "UST",
    tenor: "O/N",
    notional: 210_000_000,
    rate: 4.38,
    gcRate: 4.35,
    haircut: 0.04,
    maturityLabel: "O/N",
  },
  {
    id: "t06",
    counterparty: "Deutsche Bank",
    direction: "Repo",
    collateral: "IG Corp basket",
    collateralClass: "IG Corp",
    tenor: "2W",
    notional: 75_000_000,
    rate: 4.58,
    gcRate: 4.38,
    haircut: 0.08,
    maturityLabel: "T+14",
  },
  {
    id: "t07",
    counterparty: "Morgan Stanley",
    direction: "Reverse",
    collateral: "Bund 10Y",
    collateralClass: "Bund",
    tenor: "3M",
    notional: 160_000_000,
    rate: 4.59,
    gcRate: 4.57,
    haircut: 0.015,
    maturityLabel: "T+90",
  },
  {
    id: "t08",
    counterparty: "HSBC",
    direction: "Repo",
    collateral: "FNMA 2030",
    collateralClass: "Agency",
    tenor: "1M",
    notional: 140_000_000,
    rate: 4.55,
    gcRate: 4.44,
    haircut: 0.03,
    maturityLabel: "T+30",
  },
  {
    id: "t09",
    counterparty: "Societe Generale",
    direction: "Reverse",
    collateral: "UK Gilt 5Y",
    collateralClass: "Gilt",
    tenor: "1W",
    notional: 88_000_000,
    rate: 4.40,
    gcRate: 4.36,
    haircut: 0.02,
    maturityLabel: "T+7",
  },
  {
    id: "t10",
    counterparty: "UBS",
    direction: "Repo",
    collateral: "UST 5Y",
    collateralClass: "UST",
    tenor: "3M",
    notional: 200_000_000,
    rate: 4.62,
    gcRate: 4.57,
    haircut: 0.01,
    maturityLabel: "T+90",
  },
  {
    id: "t11",
    counterparty: "Credit Suisse",
    direction: "Reverse",
    collateral: "Bund 2Y",
    collateralClass: "Bund",
    tenor: "6M",
    notional: 110_000_000,
    rate: 4.70,
    gcRate: 4.68,
    haircut: 0.005,
    maturityLabel: "T+182",
  },
  {
    id: "t12",
    counterparty: "Nomura",
    direction: "Repo",
    collateral: "IG Corp basket",
    collateralClass: "IG Corp",
    tenor: "O/N",
    notional: 55_000_000,
    rate: 4.63,
    gcRate: 4.35,
    haircut: 0.08,
    maturityLabel: "O/N",
  },
];

/* ---------- Helpers ---------- */

function compact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

/** Spread in basis points: desk rate minus GC, rounded */
function spreadBp(trade: Trade): number {
  return Math.round((trade.rate - trade.gcRate) * 100);
}

/** Category accent colour dot — categorical only, never decorative */
const CLASS_DOT: Record<CollateralClass, string> = {
  UST:     "bg-sky-400",
  Bund:    "bg-teal-400",
  Gilt:    "bg-violet-400",
  "IG Corp": "bg-amber-400",
  Agency:  "bg-neutral-400",
};

/* ---------- Derived book totals ---------- */

const totalRepo    = TRADES.filter(t => t.direction === "Repo").reduce((s, t) => s + t.notional, 0);
const totalReverse = TRADES.filter(t => t.direction === "Reverse").reduce((s, t) => s + t.notional, 0);
const netBook      = totalReverse - totalRepo; // positive = net reverse (lender)

// Weighted average funding rate (weighted by notional)
const weightedRate =
  TRADES.reduce((s, t) => s + t.rate * t.notional, 0) /
  TRADES.reduce((s, t) => s + t.notional, 0);

// Average GC rate (same weight)
const weightedGc =
  TRADES.reduce((s, t) => s + t.gcRate * t.notional, 0) /
  TRADES.reduce((s, t) => s + t.notional, 0);

// Average spread in bp (positive = paying above GC)
const avgSpreadBp = Math.round((weightedRate - weightedGc) * 100);

// Net interest carry per day (rough: (reverse_avg_rate - repo_avg_rate) * net / 365)
const repoAvgRate    = TRADES.filter(t => t.direction === "Repo").reduce((s, t) => s + t.rate * t.notional, 0) / (totalRepo || 1) / 100;
const reverseAvgRate = TRADES.filter(t => t.direction === "Reverse").reduce((s, t) => s + t.rate * t.notional, 0) / (totalReverse || 1) / 100;
const dailyCarry     = (totalReverse * reverseAvgRate - totalRepo * repoAvgRate) / 365;

/* ---------- Collateral-class breakdown (for right panel) ---------- */

type ClassSummary = { cls: CollateralClass; repo: number; reverse: number };
const CLASS_SUMMARY: ClassSummary[] = (["UST", "Bund", "Gilt", "IG Corp", "Agency"] as CollateralClass[]).map(cls => ({
  cls,
  repo:    TRADES.filter(t => t.collateralClass === cls && t.direction === "Repo").reduce((s, t) => s + t.notional, 0),
  reverse: TRADES.filter(t => t.collateralClass === cls && t.direction === "Reverse").reduce((s, t) => s + t.notional, 0),
}));

/* ---------- AG Grid setup ---------- */

ModuleRegistry.registerModules([AllCommunityModule]);

const repoGridTheme = themeQuartz.withParams({
  accentColor: "#0ea5e9",
  fontFamily: "inherit",
  fontSize: 12,
  headerFontWeight: 600,
  headerTextColor: "#737373",
  headerBackgroundColor: "#ffffff",
  borderColor: "#e5e5e5",
  rowBorder: { color: "#f5f5f5" },
  rowHoverColor: "#f0f9ff",
  headerHeight: 34,
  rowHeight: 38,
  cellHorizontalPadding: 12,
  wrapperBorderRadius: 0,
});

const REPO_COL_DEFS: ColDef<Trade>[] = [
  {
    field: "counterparty",
    headerName: "Counterparty",
    flex: 2,
    minWidth: 130,
    cellRenderer: ({ data }: ICellRendererParams<Trade>) => {
      if (!data) return null;
      const isOn = data.tenor === "O/N";
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          {isOn && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Matures overnight" />
          )}
          <span className="truncate text-xs font-medium text-neutral-800">{data.counterparty}</span>
        </div>
      );
    },
  },
  {
    field: "direction",
    headerName: "Dir",
    width: 80,
    cellRenderer: ({ value }: ICellRendererParams<Trade>) => (
      <span
        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${
          value === "Repo" ? "bg-neutral-100 text-neutral-600" : "bg-sky-50 text-sky-700"
        }`}
      >
        {value as string}
      </span>
    ),
  },
  {
    field: "collateral",
    headerName: "Collateral",
    flex: 1,
    minWidth: 100,
    cellRenderer: ({ data }: ICellRendererParams<Trade>) => {
      if (!data) return null;
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-sm ${CLASS_DOT[data.collateralClass]}`} />
          <span className="truncate text-xs text-neutral-700">{data.collateral}</span>
        </div>
      );
    },
  },
  {
    field: "tenor",
    headerName: "Tenor",
    width: 58,
    cellRenderer: ({ data, value }: ICellRendererParams<Trade>) => {
      const isOn = data?.tenor === "O/N";
      return (
        <span className={`font-mono text-xs tabular-nums ${isOn ? "font-semibold text-amber-700" : "text-neutral-600"}`}>
          {value as string}
        </span>
      );
    },
  },
  {
    field: "notional",
    headerName: "Notional",
    width: 90,
    type: "rightAligned",
    cellClass: "font-mono text-xs tabular-nums text-neutral-800",
    valueFormatter: ({ value }: ValueFormatterParams<Trade>) => compact(value as number),
  },
  {
    field: "rate",
    headerName: "Rate",
    width: 64,
    type: "rightAligned",
    cellClass: "font-mono text-xs tabular-nums text-neutral-700",
    valueFormatter: ({ value }: ValueFormatterParams<Trade>) =>
      `${(value as number).toFixed(2)}%`,
  },
  {
    colId: "spreadBp",
    headerName: "Spd bp",
    width: 64,
    type: "rightAligned",
    valueGetter: ({ data }: ValueGetterParams<Trade>) => (data ? spreadBp(data) : 0),
    cellRenderer: ({ data }: ICellRendererParams<Trade>) => {
      if (!data) return null;
      const bp = spreadBp(data);
      const cls =
        bp > 10 ? "text-red-600" : bp > 5 ? "text-amber-600" : "text-neutral-500";
      return (
        <span className={`font-mono text-xs font-semibold tabular-nums ${cls}`}>
          {bp > 0 ? `+${bp}` : bp}
        </span>
      );
    },
  },
  {
    field: "haircut",
    headerName: "Haircut",
    width: 62,
    type: "rightAligned",
    cellClass: "font-mono text-xs tabular-nums text-neutral-500",
    valueFormatter: ({ value }: ValueFormatterParams<Trade>) =>
      `${((value as number) * 100).toFixed(1)}%`,
  },
  {
    field: "maturityLabel",
    headerName: "Maturity",
    width: 62,
    type: "rightAligned",
    cellRenderer: ({ data, value }: ICellRendererParams<Trade>) => {
      const isOn = data?.tenor === "O/N";
      return (
        <span
          className={`font-mono text-xs tabular-nums ${
            isOn ? "font-semibold text-amber-700" : "text-neutral-500"
          }`}
        >
          {value as string}
        </span>
      );
    },
  },
];

/* ---------- Atoms ---------- */

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

/* ---------- Funding Curve SVG chart ---------- */

function FundingCurve() {
  // Chart geometry
  const W = 560;
  const H = 220;
  const PAD_LEFT   = 46;
  const PAD_RIGHT  = 12;
  const PAD_TOP    = 14;
  const PAD_BOTTOM = 36;

  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  // Y axis: rate range 4.30 → 4.80
  const Y_MIN = 4.28;
  const Y_MAX = 4.82;

  function toX(i: number): number {
    return PAD_LEFT + (i / (CURVE.length - 1)) * chartW;
  }
  function toY(rate: number): number {
    return PAD_TOP + chartH - ((rate - Y_MIN) / (Y_MAX - Y_MIN)) * chartH;
  }

  // Build polyline point strings
  const deskPoints = CURVE.map((p, i) => `${toX(i)},${toY(p.deskRate)}`).join(" ");
  const gcPoints   = CURVE.map((p, i) => `${toX(i)},${toY(p.gcRate)}`).join(" ");

  // Shading polygon: area between desk (above) and GC
  const shadePoints = [
    ...CURVE.map((p, i) => `${toX(i)},${toY(p.deskRate)}`),
    ...[...CURVE].reverse().map((p, i) => `${toX(CURVE.length - 1 - i)},${toY(p.gcRate)}`),
  ].join(" ");

  // Y gridlines at meaningful rates
  const yTicks = [4.30, 4.40, 4.50, 4.60, 4.70, 4.80];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      aria-label="Funding curve: desk rate vs GC benchmark"
    >
      {/* Gridlines */}
      {yTicks.map(tick => (
        <g key={tick}>
          <line
            x1={PAD_LEFT}
            y1={toY(tick)}
            x2={W - PAD_RIGHT}
            y2={toY(tick)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={PAD_LEFT - 6}
            y={toY(tick) + 4}
            textAnchor="end"
            className="fill-neutral-400"
            style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
          >
            {tick.toFixed(2)}%
          </text>
        </g>
      ))}

      {/* Shade: gap where desk pays above GC */}
      <polygon
        points={shadePoints}
        fill="#fef3c7"
        opacity={0.5}
      />

      {/* GC benchmark line — dashed sky */}
      <polyline
        points={gcPoints}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="5 3"
      />

      {/* Desk rate line — solid neutral-700 */}
      <polyline
        points={deskPoints}
        fill="none"
        stroke="#404040"
        strokeWidth={2}
      />

      {/* GC circle markers */}
      {CURVE.map((p, i) => (
        <circle key={`gc-${i}`} cx={toX(i)} cy={toY(p.gcRate)} r={3} fill="#38bdf8" stroke="white" strokeWidth={1.5} />
      ))}

      {/* Desk circle markers */}
      {CURVE.map((p, i) => (
        <circle key={`dk-${i}`} cx={toX(i)} cy={toY(p.deskRate)} r={3.5} fill="#404040" stroke="white" strokeWidth={1.5} />
      ))}

      {/* X axis labels */}
      {CURVE.map((p, i) => (
        <text
          key={`x-${i}`}
          x={toX(i)}
          y={H - PAD_BOTTOM + 16}
          textAnchor="middle"
          className="fill-neutral-500"
          style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
        >
          {p.tenor}
        </text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PAD_LEFT}, ${H - PAD_BOTTOM + 26})`}>
        <line x1={0} y1={4} x2={16} y2={4} stroke="#404040" strokeWidth={2} />
        <circle cx={8} cy={4} r={3} fill="#404040" stroke="white" strokeWidth={1.5} />
        <text x={20} y={8} className="fill-neutral-600" style={{ fontSize: 9 }}>Desk blended rate</text>
        <line x1={110} y1={4} x2={126} y2={4} stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5 3" />
        <circle cx={118} cy={4} r={3} fill="#38bdf8" stroke="white" strokeWidth={1.5} />
        <text x={130} y={8} className="fill-neutral-600" style={{ fontSize: 9 }}>GC benchmark</text>
        <rect x={240} y={0} width={12} height={8} fill="#fef3c7" opacity={0.8} />
        <text x={256} y={8} className="fill-neutral-500" style={{ fontSize: 9 }}>Gap (paying up)</text>
      </g>
    </svg>
  );
}

/* ---------- Maturity Ladder bars ---------- */

function MaturityLadder() {
  const maxNotional = Math.max(...LADDER.map(b => b.repoNotional + b.reverseNotional));

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {LADDER.map(bucket => {
        const isShort = bucket.tenor === "O/N" || bucket.tenor === "1W";
        const repoW   = (bucket.repoNotional    / maxNotional) * 100;
        const revW    = (bucket.reverseNotional  / maxNotional) * 100;
        const net     = bucket.reverseNotional - bucket.repoNotional;

        return (
          <div key={bucket.tenor}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 font-mono text-[11px] font-semibold tabular-nums text-neutral-700">
                  {bucket.tenor}
                </span>
                {isShort && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                    rollover risk
                  </span>
                )}
              </div>
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  net >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                net {compact(net)}
              </span>
            </div>
            {/* Repo bar (cash borrowed) */}
            <div className="mb-0.5 flex items-center gap-2">
              <span className="w-9 text-right font-mono text-[9px] tabular-nums text-neutral-400">repo</span>
              <div className="relative flex h-4 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                <div
                  className="h-full bg-neutral-700"
                  style={{ width: `${repoW}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-[10px] tabular-nums text-neutral-600">
                {compact(bucket.repoNotional)}
              </span>
            </div>
            {/* Reverse-repo bar (cash lent) */}
            <div className="flex items-center gap-2">
              <span className="w-9 text-right font-mono text-[9px] tabular-nums text-neutral-400">rev</span>
              <div className="relative flex h-4 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                <div
                  className="h-full bg-neutral-300"
                  style={{ width: `${revW}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-[10px] tabular-nums text-neutral-500">
                {compact(bucket.reverseNotional)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-1 flex items-center gap-4 text-[9px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-neutral-700" />
          Repo (borrowed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-neutral-300" />
          Reverse (lent)
        </span>
      </div>
    </div>
  );
}

/* ---------- Collateral class breakdown panel ---------- */

function CollateralBreakdown() {
  const totalAll = CLASS_SUMMARY.reduce((s, c) => s + c.repo + c.reverse, 0);
  return (
    <div className="px-4 py-3">
      <ul className="flex flex-col gap-3">
        {CLASS_SUMMARY.filter(c => c.repo + c.reverse > 0).map(c => {
          const total = c.repo + c.reverse;
          const pct   = totalAll > 0 ? (total / totalAll) * 100 : 0;
          return (
            <li key={c.cls} className="flex items-center gap-3">
              <span className={`h-2 w-2 shrink-0 rounded-sm ${CLASS_DOT[c.cls]}`} />
              <span className="w-16 shrink-0 text-xs font-medium text-neutral-700">{c.cls}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                <div
                  className={`absolute inset-y-0 left-0 ${CLASS_DOT[c.cls]} opacity-70`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono text-[10px] tabular-nums text-neutral-500">
                {compact(total)}
              </span>
              <span className="w-8 text-right font-mono text-[10px] font-semibold tabular-nums text-neutral-700">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function RepoFinancing() {
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [viewTab, setViewTab]         = useState<ViewTab>("All");

  const filteredTrades = TRADES.filter(t => {
    if (viewTab === "Repo")    return t.direction === "Repo";
    if (viewTab === "Reverse") return t.direction === "Reverse";
    return true;
  });

  // Chosen trade for detail strip
  const selected = TRADES.find(t => t.id === selectedId) ?? null;

  // Alert state: amber if we're paying up more than 8 bp on average, or large O/N rollover
  const onNotional = LADDER.find(b => b.tenor === "O/N")?.repoNotional ?? 0;
  const alertState: "calm" | "attention" =
    avgSpreadBp > 8 || onNotional > 500_000_000 ? "attention" : "calm";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Repo & Securities Financing
          </span>
          <span className="text-xs text-neutral-400">
            Treasury · funding book
          </span>
        </div>

        {/* View filter toggle */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {(["All", "Repo", "Reverse"] as ViewTab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setViewTab(tab)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                viewTab === tab
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {alertState === "attention" ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              O/N rollover risk
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Book stable
            </span>
          )}
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            New trade
          </button>
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-5">
          {/* KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi
              label="Net financing book"
              value={compact(netBook)}
              hint={`${compact(totalRepo)} repo · ${compact(totalReverse)} reverse`}
              tone="neutral"
            />
            <Kpi
              label="Wtd avg funding rate"
              value={`${weightedRate.toFixed(2)}%`}
              hint={`GC benchmark ${weightedGc.toFixed(2)}% · SOFR +${(weightedRate - 4.33).toFixed(0)}bp`}
              tone={weightedRate <= weightedGc + 0.10 ? "ok" : "warning"}
            />
            <Kpi
              label="Funding spread to GC"
              value={`${avgSpreadBp > 0 ? "+" : ""}${avgSpreadBp} bp`}
              hint={avgSpreadBp > 8 ? "Paying above market — review collateral mix" : "Within tolerance"}
              tone={avgSpreadBp > 8 ? "warning" : avgSpreadBp > 5 ? "warning" : "neutral"}
            />
            <Kpi
              label="Net interest carry / day"
              value={compact(dailyCarry)}
              hint="Reverse income minus repo cost, 1-day accrual"
              tone={dailyCarry >= 0 ? "ok" : "error"}
            />
          </div>

          {/* Main two-column grid */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
            {/* ---- LEFT COLUMN ---- */}
            <div className="flex flex-col gap-4">
              {/* Funding Curve */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Funding curve
                  </h2>
                  <span className="text-[10px] text-neutral-400">
                    blended desk rate vs GC benchmark, by tenor
                  </span>
                </div>
                <div className="px-4 py-3">
                  <FundingCurve />
                </div>
              </section>

              {/* Financing Book table */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Financing book
                  </h2>
                  <span className="text-[10px] text-neutral-400">
                    {filteredTrades.length} trades · click to inspect
                  </span>
                </div>

                <AgGridReact<Trade>
                  theme={repoGridTheme}
                  columnDefs={REPO_COL_DEFS}
                  rowData={filteredTrades}
                  domLayout="autoHeight"
                  suppressMovableColumns
                  suppressCellFocus
                  defaultColDef={{ sortable: true }}
                  onRowClicked={(e) => {
                    const id = e.data?.id ?? null;
                    setSelectedId((prev) => (prev === id ? null : id));
                  }}
                  getRowStyle={(params) =>
                    params.data?.id === selectedId
                      ? { background: "rgba(240,249,255,0.6)" }
                      : undefined
                  }
                />

                {/* Selected trade detail strip */}
                {selected && (
                  <div className="border-t border-neutral-200 bg-sky-50/40 px-4 py-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                          Trade detail — {selected.counterparty}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-4">
                          <span className="text-xs text-neutral-600">
                            <span className="font-semibold text-neutral-800">{selected.direction}</span> ·{" "}
                            {selected.collateral} · {selected.tenor}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-neutral-700">
                            Notional: <span className="font-semibold">{compact(selected.notional)}</span>
                          </span>
                          <span className="font-mono text-xs tabular-nums text-neutral-700">
                            Rate: <span className="font-semibold">{selected.rate.toFixed(2)}%</span>
                          </span>
                          <span className="font-mono text-xs tabular-nums text-neutral-700">
                            GC: {selected.gcRate.toFixed(2)}%
                          </span>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              spreadBp(selected) > 10 ? "text-red-600" : spreadBp(selected) > 5 ? "text-amber-600" : "text-neutral-600"
                            }`}
                          >
                            Spread: {spreadBp(selected) > 0 ? "+" : ""}{spreadBp(selected)} bp
                          </span>
                          <span className="font-mono text-xs tabular-nums text-neutral-700">
                            Haircut: {(selected.haircut * 100).toFixed(1)}%
                          </span>
                          <span className="font-mono text-xs tabular-nums text-neutral-700">
                            Daily carry:{" "}
                            <span className="font-semibold">
                              {compact((selected.notional * (selected.rate - selected.gcRate)) / 100 / 365)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="ml-4 shrink-0 text-[11px] text-neutral-400 hover:text-neutral-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* ---- RIGHT COLUMN ---- */}
            <div className="flex flex-col gap-4">
              {/* Maturity Ladder */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Maturity ladder
                  </h2>
                  <span className="text-[10px] text-neutral-400">repo vs reverse · by tenor</span>
                </div>
                <MaturityLadder />
              </section>

              {/* Collateral class breakdown */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    By collateral class
                  </h2>
                  <span className="text-[10px] text-neutral-400">% of total book</span>
                </div>
                <CollateralBreakdown />
              </section>

              {/* Curve spread summary table */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Curve spread summary
                  </h2>
                  <span className="text-[10px] text-neutral-400">desk vs GC by tenor</span>
                </div>
                <div className="px-4 py-3">
                  <div className="grid grid-cols-4 gap-2 pb-2 text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                    <span>Tenor</span>
                    <span className="text-right">Desk</span>
                    <span className="text-right">GC</span>
                    <span className="text-right">Spread</span>
                  </div>
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {CURVE.map(cp => {
                      const bp = Math.round((cp.deskRate - cp.gcRate) * 100);
                      return (
                        <li key={cp.tenor} className="grid grid-cols-4 gap-2 py-1.5">
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-neutral-700">
                            {cp.tenor}
                          </span>
                          <span className="text-right font-mono text-[11px] tabular-nums text-neutral-700">
                            {cp.deskRate.toFixed(2)}%
                          </span>
                          <span className="text-right font-mono text-[11px] tabular-nums text-neutral-400">
                            {cp.gcRate.toFixed(2)}%
                          </span>
                          <span
                            className={`text-right font-mono text-[11px] font-semibold tabular-nums ${
                              bp > 8 ? "text-amber-600" : "text-neutral-600"
                            }`}
                          >
                            +{bp} bp
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
