import { useState } from "react";

export const title = "XVA Desk";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * XVA Desk — Valuation Adjustments
 *
 * The XVA desk computes lifetime valuation adjustments on the
 * derivatives book per counterparty / netting set. XVA components:
 *
 *   CVA  Credit Valuation Adj   — counterparty default risk. A CHARGE
 *        that reduces derivative asset values (always a cost).
 *   DVA  Debit Valuation Adj    — own-credit risk benefit (mirrors CVA
 *        from counterparty's perspective; a book benefit).
 *   FVA  Funding Valuation Adj  — cost of funding uncollateralised
 *        exposures that cannot be repo'd.
 *   MVA  Margin Valuation Adj   — cost of posting initial margin over
 *        the life of cleared / margin-regulated trades.
 *   KVA  Capital Valuation Adj  — cost of holding regulatory capital
 *        (CET1 hurdle) against the derivatives book.
 *
 *   Net XVA = –CVA + DVA – FVA – MVA – KVA  (negative = net charge)
 *
 * Design rule (shared with workspace):
 *   CALM IS THE DEFAULT. Neutral grey is the baseline. Emerald = benefit
 *   / gain (DVA). Red = cost / charge (CVA, FVA, MVA, KVA). Amber =
 *   warning / mixed. Categorical colour only in the component legend.
 * ------------------------------------------------------------------ */

/* ---------- Types ---------- */

type Sector = "Sovereign" | "Bank" | "Insurance" | "Corporate" | "Fund";
type Rating = "AAA" | "AA" | "A" | "BBB+" | "BBB" | "BBB-" | "BB+";
type CsaStatus = "CSA" | "Uncollateralised";

type Counterparty = {
  id: string;
  name: string;
  sector: Sector;
  rating: Rating;
  nettingSets: number;
  /** Expected positive exposure — pre-XVA credit metric */
  epe: number;
  /** CVA charge (positive = cost, will be rendered negative) */
  cva: number;
  /** DVA benefit (positive = benefit) */
  dva: number;
  /** FVA charge (positive = cost) */
  fva: number;
  /** MVA charge (positive = cost) */
  mva: number;
  /** KVA charge (positive = cost) */
  kva: number;
  csa: CsaStatus;
};

/** Net XVA for a counterparty — negative means a net charge to P&L */
function netXva(cp: Counterparty): number {
  return -cp.cva + cp.dva - cp.fva - cp.mva - cp.kva;
}

/* ---------- Mock data ---------- */

const COUNTERPARTIES: Counterparty[] = [
  {
    id: "cp1",
    name: "BNP Paribas SA",
    sector: "Bank",
    rating: "AA",
    nettingSets: 4,
    epe: 312_000_000,
    cva: 18_400_000,
    dva: 4_100_000,
    fva: 3_200_000,
    mva: 2_100_000,
    kva: 1_800_000,
    csa: "CSA",
  },
  {
    id: "cp2",
    name: "Allianz SE",
    sector: "Insurance",
    rating: "AA",
    nettingSets: 2,
    epe: 198_000_000,
    cva: 9_600_000,
    dva: 2_800_000,
    fva: 5_400_000,
    mva: 1_200_000,
    kva: 900_000,
    csa: "Uncollateralised",
  },
  {
    id: "cp3",
    name: "Republic of Italy",
    sector: "Sovereign",
    rating: "BBB+",
    nettingSets: 3,
    epe: 445_000_000,
    cva: 31_200_000,
    dva: 5_600_000,
    fva: 8_100_000,
    mva: 2_800_000,
    kva: 3_100_000,
    csa: "Uncollateralised",
  },
  {
    id: "cp4",
    name: "Goldman Sachs Intl",
    sector: "Bank",
    rating: "A",
    nettingSets: 6,
    epe: 524_000_000,
    cva: 14_700_000,
    dva: 3_400_000,
    fva: 2_100_000,
    mva: 4_600_000,
    kva: 2_200_000,
    csa: "CSA",
  },
  {
    id: "cp5",
    name: "Volkswagen AG",
    sector: "Corporate",
    rating: "BBB",
    nettingSets: 1,
    epe: 87_000_000,
    cva: 12_900_000,
    dva: 1_800_000,
    fva: 6_800_000,
    mva: 0,
    kva: 1_400_000,
    csa: "Uncollateralised",
  },
  {
    id: "cp6",
    name: "Société Générale",
    sector: "Bank",
    rating: "A",
    nettingSets: 3,
    epe: 231_000_000,
    cva: 11_300_000,
    dva: 2_600_000,
    fva: 1_800_000,
    mva: 3_100_000,
    kva: 1_600_000,
    csa: "CSA",
  },
  {
    id: "cp7",
    name: "Blackrock Funds",
    sector: "Fund",
    rating: "A",
    nettingSets: 2,
    epe: 176_000_000,
    cva: 7_800_000,
    dva: 1_200_000,
    fva: 4_200_000,
    mva: 2_400_000,
    kva: 1_100_000,
    csa: "CSA",
  },
  {
    id: "cp8",
    name: "Telecom Italia SpA",
    sector: "Corporate",
    rating: "BB+",
    nettingSets: 1,
    epe: 62_000_000,
    cva: 21_600_000,
    dva: 900_000,
    fva: 9_400_000,
    mva: 0,
    kva: 2_800_000,
    csa: "Uncollateralised",
  },
  {
    id: "cp9",
    name: "Generali Group",
    sector: "Insurance",
    rating: "BBB+",
    nettingSets: 2,
    epe: 143_000_000,
    cva: 8_200_000,
    dva: 1_600_000,
    fva: 3_600_000,
    mva: 800_000,
    kva: 900_000,
    csa: "CSA",
  },
  {
    id: "cp10",
    name: "Credit Agricole CIB",
    sector: "Bank",
    rating: "A",
    nettingSets: 4,
    epe: 289_000_000,
    cva: 10_100_000,
    dva: 2_400_000,
    fva: 1_600_000,
    mva: 3_800_000,
    kva: 1_400_000,
    csa: "CSA",
  },
];

/* ---------- Aggregate XVA book totals ---------- */

const BOOK_CVA = COUNTERPARTIES.reduce((s, c) => s + c.cva, 0);
const BOOK_DVA = COUNTERPARTIES.reduce((s, c) => s + c.dva, 0);
const BOOK_FVA = COUNTERPARTIES.reduce((s, c) => s + c.fva, 0);
const BOOK_MVA = COUNTERPARTIES.reduce((s, c) => s + c.mva, 0);
const BOOK_KVA = COUNTERPARTIES.reduce((s, c) => s + c.kva, 0);
const BOOK_NET = -BOOK_CVA + BOOK_DVA - BOOK_FVA - BOOK_MVA - BOOK_KVA;

/* ---------- Sensitivity grid data ---------- */
/* CR01 × IR01 grid: rows = credit-spread shocks, cols = rate shocks */

type SensCell = { cr: number; ir: number; delta: number };

/** Compute a plausible XVA sensitivity to credit / rate shocks for a counterparty.
 *  These are fictional but internally consistent — bigger EPE → bigger sensitivity.
 *  delta is in $m, positive = XVA charge increases (worsens), negative = improves. */
function buildSensGrid(cp: Counterparty): SensCell[] {
  const crShocks = [-50, -25, 0, 25, 50]; // bp
  const irShocks = [-50, -25, 0, 25, 50]; // bp
  const cells: SensCell[] = [];
  const scale = cp.epe / 1e9; // normalise sensitivity
  for (const cr of crShocks) {
    for (const ir of irShocks) {
      // CVA rises with wider credit spreads (positive cr → worse XVA)
      // Rates rising tends to reduce EPE on pay-fixed swaps (negative ir → improves)
      const delta =
        (cr / 100) * scale * 4.2 - (ir / 100) * scale * 1.8;
      cells.push({ cr, ir, delta });
    }
  }
  return cells;
}

/* ---------- Helpers ---------- */

function compact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

const RATING_COLOR: Record<Rating, string> = {
  AAA: "bg-emerald-50 text-emerald-700",
  AA: "bg-emerald-50 text-emerald-700",
  A: "bg-neutral-100 text-neutral-700",
  "BBB+": "bg-neutral-100 text-neutral-700",
  BBB: "bg-amber-50 text-amber-700",
  "BBB-": "bg-amber-50 text-amber-700",
  "BB+": "bg-red-50 text-red-700",
};

/* ---------- Waterfall chart geometry ---------- */

type WaterfallStep = {
  label: string;
  /** raw delta: positive = up (benefit), negative = down (cost) */
  delta: number;
  /** fill colour class — muted institutional palette */
  fillClass: string;
  isTotal?: boolean;
};

const WATERFALL_STEPS: WaterfallStep[] = [
  { label: "CVA", delta: -BOOK_CVA, fillClass: "fill-red-300", isTotal: false },
  { label: "DVA", delta: BOOK_DVA, fillClass: "fill-emerald-400", isTotal: false },
  { label: "FVA", delta: -BOOK_FVA, fillClass: "fill-sky-300", isTotal: false },
  { label: "MVA", delta: -BOOK_MVA, fillClass: "fill-violet-300", isTotal: false },
  { label: "KVA", delta: -BOOK_KVA, fillClass: "fill-amber-300", isTotal: false },
  { label: "Total XVA", delta: BOOK_NET, fillClass: "fill-neutral-600", isTotal: true },
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

/* ------------------------------------------------------------------ *
 * WaterfallChart — hand-rolled inline SVG bridge / waterfall diagram
 * ------------------------------------------------------------------ */

function WaterfallChart() {
  const W = 900;
  const H = 220;
  const PAD_L = 20;
  const PAD_R = 20;
  const PAD_TOP = 28;
  const PAD_BOT = 36;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_TOP - PAD_BOT;

  const steps = WATERFALL_STEPS;
  const barW = chartW / steps.length;
  const barGap = barW * 0.22;
  const barInner = barW - barGap * 2;

  /* Compute floating bar positions.
   * runningBase tracks the cumulative sum from 0.
   * For a "total" bar the baseline is always 0. */
  const maxAbs =
    Math.max(
      Math.abs(BOOK_CVA),
      BOOK_DVA,
      Math.abs(BOOK_FVA),
      Math.abs(BOOK_MVA),
      Math.abs(BOOK_KVA),
      Math.abs(BOOK_NET),
    ) * 1.18;

  function toY(value: number): number {
    // value = 0 → zero baseline, positive → up, negative → down
    return PAD_TOP + chartH * (1 - (value + maxAbs) / (2 * maxAbs));
  }

  const zeroY = toY(0);

  type BarGeom = {
    x: number;
    y: number;
    h: number;
    labelY: number;
    labelAnchor: "start" | "middle" | "end";
    connY: number;
    step: WaterfallStep;
  };

  let running = 0;
  const bars: BarGeom[] = steps.map((step, i) => {
    const x = PAD_L + i * barW + barGap;

    let base: number;
    let top: number;
    if (step.isTotal) {
      base = Math.min(0, step.delta);
      top = Math.max(0, step.delta);
    } else {
      base = Math.min(running, running + step.delta);
      top = Math.max(running, running + step.delta);
    }

    const y1 = toY(top);
    const y2 = toY(base);
    const barH = Math.max(2, y2 - y1);

    const labelY = step.delta >= 0 ? y1 - 6 : y2 + 12;

    // connector anchors at the "exit" level of the bar
    const connY = step.isTotal ? toY(step.delta) : toY(running + step.delta);

    if (!step.isTotal) running += step.delta;

    return { x, y: y1, h: barH, labelY, labelAnchor: "middle", connY, step };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: `${H}px` }}
      aria-label="XVA waterfall chart"
    >
      {/* Zero baseline */}
      <line
        x1={PAD_L}
        y1={zeroY}
        x2={W - PAD_R}
        y2={zeroY}
        stroke="#e5e7eb"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text
        x={PAD_L}
        y={zeroY - 3}
        fontSize={9}
        fill="#9ca3af"
        fontFamily="ui-monospace, monospace"
      >
        $0
      </text>

      {/* Connector lines between bars */}
      {bars.slice(0, -1).map((bar, i) => {
        const next = bars[i + 1];
        return (
          <line
            key={`conn-${i}`}
            x1={bar.x + barInner}
            y1={bar.connY}
            x2={next.x}
            y2={bar.connY}
            stroke="#d1d5db"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
        );
      })}

      {/* Bars */}
      {bars.map((bar, i) => (
        <g key={`bar-${i}`}>
          <rect
            x={bar.x}
            y={bar.y}
            width={barInner}
            height={bar.h}
            rx={3}
            className={bar.step.fillClass}
            opacity={bar.step.isTotal ? 1 : 0.8}
          />
          {/* Delta value label */}
          <text
            x={bar.x + barInner / 2}
            y={bar.labelY}
            fontSize={9.5}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
            fill={bar.step.delta >= 0 ? "#059669" : "#dc2626"}
          >
            {compact(bar.step.delta)}
          </text>
          {/* Component name on X axis */}
          <text
            x={bar.x + barInner / 2}
            y={H - PAD_BOT + 14}
            fontSize={10}
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight={bar.step.isTotal ? "700" : "500"}
            fill={bar.step.isTotal ? "#374151" : "#6b7280"}
          >
            {bar.step.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * XVA component mini stacked bar (for the detail panel)
 * ------------------------------------------------------------------ */

type ComponentBreakdown = {
  label: string;
  value: number;
  /** Signed for bar proportion; we use absolute value for width */
  colour: string;
};

function ComponentBar({ cp }: { cp: Counterparty }) {
  const components: ComponentBreakdown[] = [
    { label: "CVA", value: cp.cva, colour: "bg-red-300" },
    { label: "DVA", value: cp.dva, colour: "bg-emerald-400" },
    { label: "FVA", value: cp.fva, colour: "bg-sky-300" },
    { label: "MVA", value: cp.mva, colour: "bg-violet-300" },
    { label: "KVA", value: cp.kva, colour: "bg-amber-300" },
  ];

  const total = cp.cva + cp.dva + cp.fva + cp.mva + cp.kva;

  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-md ring-1 ring-neutral-200">
        {components.map((c) => {
          const pct = total > 0 ? (c.value / total) * 100 : 0;
          return pct > 0.5 ? (
            <div
              key={c.label}
              className={`${c.colour} flex items-center justify-center border-r border-white/60`}
              style={{ width: `${pct}%` }}
              title={`${c.label}: ${compact(c.value)}`}
            >
              {pct > 10 && (
                <span className="font-mono text-[8px] font-semibold text-neutral-800/80">
                  {c.label}
                </span>
              )}
            </div>
          ) : null;
        })}
      </div>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {components.map((c) => (
          <div key={c.label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${c.colour}`} />
            <span className="text-[10px] text-neutral-500">{c.label}</span>
            <span className="font-mono text-[10px] font-semibold tabular-nums text-neutral-700">
              {compact(c.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * CR01 × IR01 sensitivity grid
 * ------------------------------------------------------------------ */

const CR_SHOCKS = [-50, -25, 0, 25, 50];
const IR_SHOCKS = [-50, -25, 0, 25, 50];

function SensGrid({ cp }: { cp: Counterparty }) {
  const cells = buildSensGrid(cp);
  const maxDelta = Math.max(...cells.map((c) => Math.abs(c.delta)), 0.001);

  function cellBg(delta: number): string {
    if (Math.abs(delta) < maxDelta * 0.08) return "bg-neutral-50 text-neutral-500";
    const intensity = Math.min(1, Math.abs(delta) / maxDelta);
    if (delta > 0) {
      // charge worsens — red scale, muted
      if (intensity > 0.65) return "bg-red-100 text-red-800";
      return "bg-red-50 text-red-600";
    } else {
      // charge improves — emerald scale, muted
      if (intensity > 0.65) return "bg-emerald-100 text-emerald-800";
      return "bg-emerald-50 text-emerald-700";
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {/* Top-left corner label */}
            <th className="pb-1.5 pr-2 text-left font-semibold text-neutral-400">
              CR ↓ / IR →
            </th>
            {IR_SHOCKS.map((ir) => (
              <th
                key={ir}
                className="pb-1.5 text-center font-semibold text-neutral-500"
              >
                {ir > 0 ? `+${ir}` : ir}bp
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CR_SHOCKS.map((cr) => (
            <tr key={cr}>
              <td className="pr-2 py-0.5 font-semibold text-neutral-500 whitespace-nowrap">
                {cr > 0 ? `+${cr}` : cr}bp
              </td>
              {IR_SHOCKS.map((ir) => {
                const cell = cells.find((c) => c.cr === cr && c.ir === ir)!;
                const isBase = cr === 0 && ir === 0;
                return (
                  <td key={ir} className="py-0.5 px-0.5">
                    <div
                      className={`rounded px-1.5 py-1 text-center font-mono tabular-nums font-semibold ${
                        isBase
                          ? "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-300"
                          : cellBg(cell.delta)
                      }`}
                    >
                      {isBase
                        ? "BASE"
                        : `${cell.delta >= 0 ? "+" : ""}${(cell.delta * 1e6).toFixed(1)}m`}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[9px] text-neutral-400">
        Δ Total XVA ($m) · positive = charge worsens · negative = charge improves · 1bp shock
      </p>
    </div>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function XvaDesk() {
  const [selectedId, setSelectedId] = useState<string>(COUNTERPARTIES[0].id);

  const selected = COUNTERPARTIES.find((c) => c.id === selectedId)!;
  const netFundingMargin = -(BOOK_FVA + BOOK_MVA);

  /* Sort counterparties by absolute CVA descending — biggest risk first */
  const sorted = [...COUNTERPARTIES].sort((a, b) => b.cva - a.cva);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">XVA Desk</span>
          <span className="text-xs text-neutral-400">
            Valuation adjustments · derivatives book
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Book charge status */}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Net charge {compact(Math.abs(BOOK_NET))}
          </span>
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            Run revaluation
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-5">

          {/* KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi
              label="Total XVA"
              value={compact(BOOK_NET)}
              hint="+$3.4m vs yesterday"
              tone="error"
            />
            <Kpi
              label="CVA charge"
              value={compact(-BOOK_CVA)}
              hint={`+$1.8m vs yesterday · ${COUNTERPARTIES.length} counterparties`}
              tone="error"
            />
            <Kpi
              label="DVA benefit"
              value={compact(BOOK_DVA)}
              hint="-$0.3m vs yesterday"
              tone="ok"
            />
            <Kpi
              label="Net funding + margin"
              value={compact(netFundingMargin)}
              hint={`FVA ${compact(-BOOK_FVA)} · MVA ${compact(-BOOK_MVA)}`}
              tone="warning"
            />
          </div>

          {/* Waterfall card */}
          <section className="mb-4 rounded-lg border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
              <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                XVA Waterfall
              </h2>
              <div className="flex items-center gap-4">
                {/* Component legend */}
                {[
                  { label: "CVA", colour: "bg-red-300" },
                  { label: "DVA", colour: "bg-emerald-400" },
                  { label: "FVA", colour: "bg-sky-300" },
                  { label: "MVA", colour: "bg-violet-300" },
                  { label: "KVA", colour: "bg-amber-300" },
                  { label: "Total", colour: "bg-neutral-600" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-sm ${l.colour}`} />
                    <span className="text-[10px] text-neutral-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <WaterfallChart />
            </div>
          </section>

          {/* Bottom two-column grid */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_460px]">

            {/* ── Counterparty table ─────────────────────────────────── */}
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Counterparty XVA
                </h2>
                <span className="text-[10px] text-neutral-400">sorted by CVA desc</span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_50px_90px_90px_90px_100px_110px] gap-2 border-b border-neutral-100 px-5 py-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                <span>Counterparty</span>
                <span className="text-center">NSets</span>
                <span className="text-right">EPE</span>
                <span className="text-right">CVA</span>
                <span className="text-right">DVA</span>
                <span className="text-right">Total XVA</span>
                <span className="text-right">CSA</span>
              </div>

              <ul>
                {sorted.map((cp) => {
                  const net = netXva(cp);
                  const active = cp.id === selectedId;
                  return (
                    <li key={cp.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(cp.id)}
                        className={`w-full border-t border-neutral-100 text-left transition first:border-t-0 ${
                          active ? "bg-sky-50/60" : "hover:bg-neutral-50"
                        }`}
                      >
                        <div className="grid grid-cols-[1fr_50px_90px_90px_90px_100px_110px] items-center gap-2 px-5 py-2.5">
                          {/* Name + badges */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-neutral-800">
                                {cp.name}
                              </span>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${RATING_COLOR[cp.rating]}`}
                              >
                                {cp.rating}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400">{cp.sector}</div>
                          </div>
                          {/* Netting sets */}
                          <span className="text-center font-mono text-xs tabular-nums text-neutral-500">
                            {cp.nettingSets}
                          </span>
                          {/* EPE */}
                          <span className="text-right font-mono text-xs tabular-nums text-neutral-600">
                            {compact(cp.epe)}
                          </span>
                          {/* CVA */}
                          <span className="text-right font-mono text-xs font-semibold tabular-nums text-red-700">
                            {compact(-cp.cva)}
                          </span>
                          {/* DVA */}
                          <span className="text-right font-mono text-xs font-semibold tabular-nums text-emerald-700">
                            +{compact(cp.dva)}
                          </span>
                          {/* Total XVA */}
                          <span
                            className={`text-right font-mono text-xs font-bold tabular-nums ${
                              net < 0 ? "text-red-700" : "text-emerald-700"
                            }`}
                          >
                            {compact(net)}
                          </span>
                          {/* CSA badge */}
                          <div className="flex justify-end">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                cp.csa === "CSA"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {cp.csa}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Footer totals row */}
              <div className="border-t border-neutral-200 bg-neutral-50">
                <div className="grid grid-cols-[1fr_50px_90px_90px_90px_100px_110px] items-center gap-2 px-5 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Book total
                  </span>
                  <span className="text-center font-mono text-[10px] text-neutral-400">
                    {COUNTERPARTIES.reduce((s, c) => s + c.nettingSets, 0)}
                  </span>
                  <span className="text-right font-mono text-[10px] tabular-nums text-neutral-500">
                    {compact(COUNTERPARTIES.reduce((s, c) => s + c.epe, 0))}
                  </span>
                  <span className="text-right font-mono text-[10px] font-bold tabular-nums text-red-700">
                    {compact(-BOOK_CVA)}
                  </span>
                  <span className="text-right font-mono text-[10px] font-bold tabular-nums text-emerald-700">
                    +{compact(BOOK_DVA)}
                  </span>
                  <span className="text-right font-mono text-[10px] font-bold tabular-nums text-red-700">
                    {compact(BOOK_NET)}
                  </span>
                  <span />
                </div>
              </div>
            </section>

            {/* ── Detail / sensitivity panel ─────────────────────────── */}
            <div className="flex flex-col gap-3.5">
              {/* Component breakdown */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Component breakdown
                  </h2>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {selected.name}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <ComponentBar cp={selected} />

                  {/* Numeric breakdown grid */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(
                      [
                        { k: "CVA", v: -selected.cva, tone: "error" },
                        { k: "DVA", v: selected.dva, tone: "ok" },
                        { k: "FVA", v: -selected.fva, tone: "warning" },
                        { k: "MVA", v: -selected.mva, tone: "warning" },
                        { k: "KVA", v: -selected.kva, tone: "warning" },
                        { k: "Net XVA", v: netXva(selected), tone: netXva(selected) < 0 ? "error" : "ok" },
                      ] as { k: string; v: number; tone: "neutral" | "ok" | "warning" | "error" }[]
                    ).map((item) => (
                      <div
                        key={item.k}
                        className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                      >
                        <div className="text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                          {item.k}
                        </div>
                        <div
                          className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                            {
                              neutral: "text-neutral-800",
                              ok: "text-emerald-700",
                              warning: "text-amber-700",
                              error: "text-red-700",
                            }[item.tone]
                          }`}
                        >
                          {compact(item.v)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Key metrics row */}
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-100 px-4 py-2.5">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                        EPE
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-neutral-800">
                        {compact(selected.epe)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                        Netting sets
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-neutral-800">
                        {selected.nettingSets}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                        CVA / EPE
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-neutral-800">
                        {((selected.cva / selected.epe) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CR01 × IR01 sensitivity */}
              <section className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    CR01 × IR01 sensitivity
                  </h2>
                  <span className="text-[10px] text-neutral-400">
                    Δ XVA ($m per 1bp)
                  </span>
                </div>
                <div className="px-4 py-3">
                  <SensGrid cp={selected} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
