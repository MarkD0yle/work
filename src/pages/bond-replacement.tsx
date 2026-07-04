import { useCallback, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";

// Enterprise bundle (includes Community). No license key is set, so the grid
// runs in evaluation mode and logs the standard watermark notice — expected
// for an internal design workspace.
ModuleRegistry.registerModules([AllEnterpriseModule]);

export const title = "Portfolio Optimizer";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* ================================================================== */
/*  Domain model                                                       */
/* ================================================================== */

type Sector =
  | "Technology"
  | "Energy"
  | "Financials"
  | "Utilities"
  | "Health Care"
  | "Industrials"
  | "Consumer"
  | "Communication";

type Rating = "AAA" | "AA" | "A" | "BBB";
type Region = "US" | "Europe";

interface Bond {
  id: string;
  ticker: string;
  issuer: string;
  sector: Sector;
  region: Region;
  rating: Rating;
  seniority: "SR UNSECURED" | "SUBORDINATED";
  coupon: number;
  maturity: number; // year
  duration: number; // yrs
  yield: number; // %
  gSpread: number; // bps
  zSpread: number; // bps
  oas: number; // bps
  dollarPrice: number;
  liquidity: number; // 0-100
  gsCharge: number; // bps (GS indicative charge)
  yieldLow: number; // 52w low
  yieldHigh: number; // 52w high
}

interface Holding extends Bond {
  weight: number; // % of portfolio
}

/* ---- sector presentation ---------------------------------------- */

const SECTOR_META: Record<Sector, { icon: string; color: string; ring: string }> = {
  Technology: { icon: "💻", color: "#6366f1", ring: "#c7d2fe" },
  Energy: { icon: "⛽", color: "#f97316", ring: "#fed7aa" },
  Financials: { icon: "🏦", color: "#0ea5e9", ring: "#bae6fd" },
  Utilities: { icon: "⚡", color: "#10b981", ring: "#a7f3d0" },
  "Health Care": { icon: "⚕️", color: "#14b8a6", ring: "#99f6e4" },
  Industrials: { icon: "🏭", color: "#64748b", ring: "#cbd5e1" },
  Consumer: { icon: "🛒", color: "#f59e0b", ring: "#fde68a" },
  Communication: { icon: "📡", color: "#a855f7", ring: "#e9d5ff" },
};

const RATING_COLOR: Record<Rating, string> = {
  AAA: "#059669",
  AA: "#10b981",
  A: "#0ea5e9",
  BBB: "#f59e0b",
};

const REGION_COLOR: Record<Region, string> = {
  US: "#4f46e5",
  Europe: "#db2777",
};

/* ================================================================== */
/*  Seeded universe                                                    */
/* ================================================================== */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_YEAR = 2025;

type IssuerDef = {
  ticker: string;
  issuer: string;
  sector: Sector;
  region: Region;
  rating: Rating;
  yld: number; // anchor yield
  g: number; // anchor g-spread
  maturities: number[];
};

const ISSUERS: IssuerDef[] = [
  { ticker: "XOM", issuer: "Exxon Mobil", sector: "Energy", region: "US", rating: "AA", yld: 4.9, g: 78, maturities: [2027, 2028, 2030, 2031] },
  { ticker: "CVX", issuer: "Chevron Corp", sector: "Energy", region: "US", rating: "AA", yld: 4.95, g: 82, maturities: [2029, 2031] },
  { ticker: "NVDA", issuer: "NVIDIA Corp", sector: "Technology", region: "US", rating: "A", yld: 4.6, g: 62, maturities: [2029, 2031] },
  { ticker: "AAPL", issuer: "Apple Inc", sector: "Technology", region: "US", rating: "AAA", yld: 4.45, g: 48, maturities: [2028, 2030] },
  { ticker: "CME", issuer: "CME Group", sector: "Financials", region: "US", rating: "AA", yld: 4.8, g: 74, maturities: [2027, 2030] },
  { ticker: "JPM", issuer: "JPMorgan Chase", sector: "Financials", region: "US", rating: "A", yld: 5.1, g: 96, maturities: [2028, 2031] },
  { ticker: "BAC", issuer: "Bank of America", sector: "Financials", region: "US", rating: "A", yld: 5.2, g: 104, maturities: [2029, 2031] },
  { ticker: "DUK", issuer: "Duke Energy", sector: "Utilities", region: "US", rating: "BBB", yld: 5.35, g: 118, maturities: [2030, 2032] },
  { ticker: "SO", issuer: "Southern Co", sector: "Utilities", region: "US", rating: "BBB", yld: 5.4, g: 122, maturities: [2029, 2031] },
  { ticker: "UNH", issuer: "UnitedHealth", sector: "Health Care", region: "US", rating: "A", yld: 4.85, g: 80, maturities: [2028, 2030] },
  { ticker: "PFE", issuer: "Pfizer Inc", sector: "Health Care", region: "US", rating: "A", yld: 4.9, g: 86, maturities: [2028, 2031] },
  { ticker: "T", issuer: "AT&T Inc", sector: "Communication", region: "US", rating: "BBB", yld: 5.55, g: 138, maturities: [2029, 2033] },
  { ticker: "VZ", issuer: "Verizon Comm", sector: "Communication", region: "US", rating: "BBB", yld: 5.45, g: 130, maturities: [2030, 2032] },
  { ticker: "WMT", issuer: "Walmart Inc", sector: "Consumer", region: "US", rating: "AA", yld: 4.55, g: 52, maturities: [2029, 2031] },
  { ticker: "KO", issuer: "Coca-Cola Co", sector: "Consumer", region: "US", rating: "A", yld: 4.7, g: 66, maturities: [2028, 2030] },
  { ticker: "CAT", issuer: "Caterpillar", sector: "Industrials", region: "US", rating: "A", yld: 4.95, g: 88, maturities: [2029, 2031] },
];

function buildUniverse(): Bond[] {
  const rng = mulberry32(0xb04d);
  const out: Bond[] = [];
  for (const iss of ISSUERS) {
    for (const mat of iss.maturities) {
      const dur = Math.round((mat - BASE_YEAR) * 0.92 * 10) / 10;
      const slope = 0.06; // curve steepness on yield
      const yld = Math.round((iss.yld + slope * (dur - 4) + (rng() - 0.5) * 0.22) * 100) / 100;
      const gSpread = Math.round(iss.g + 3.5 * (dur - 4) + (rng() - 0.5) * 20);
      const liquidity = Math.round(40 + rng() * 58);
      const bond: Bond = {
        id: `${iss.ticker}-${mat}`,
        ticker: iss.ticker,
        issuer: iss.issuer,
        sector: iss.sector,
        region: iss.region,
        rating: iss.rating,
        seniority: rng() > 0.9 ? "SUBORDINATED" : "SR UNSECURED",
        coupon: Math.round((yld - 0.3 + (rng() - 0.5) * 0.6) * 8) / 8,
        maturity: mat,
        duration: dur,
        yield: yld,
        gSpread,
        zSpread: gSpread + Math.round((rng() - 0.5) * 8),
        oas: gSpread - Math.round(6 + rng() * 8),
        dollarPrice: Math.round((100 - (yld - iss.yld) * 6 + (rng() - 0.5) * 3) * 100) / 100,
        liquidity,
        gsCharge: Math.round((14 - liquidity * 0.09 + (rng() - 0.5) * 3) * 10) / 10,
        yieldLow: Math.round((yld - (0.35 + rng() * 0.4)) * 100) / 100,
        yieldHigh: Math.round((yld + (0.35 + rng() * 0.4)) * 100) / 100,
      };
      out.push(bond);
    }
  }
  return out;
}

const UNIVERSE = buildUniverse();
const BY_ID = new Map(UNIVERSE.map((b) => [b.id, b]));

/* ---- initial portfolio (a subset, weighted) --------------------- */

const PORTFOLIO_IDS = [
  "XOM-2030",
  "XOM-2027",
  "NVDA-2031",
  "AAPL-2030",
  "CME-2030",
  "JPM-2031",
  "BAC-2029",
  "DUK-2030",
  "SO-2031",
  "UNH-2030",
  "PFE-2028",
  "T-2033",
  "VZ-2032",
  "WMT-2031",
  "KO-2030",
  "CAT-2031",
];

function buildPortfolio(): Holding[] {
  const rng = mulberry32(0x51ce);
  const raw = PORTFOLIO_IDS.map((id) => ({ bond: BY_ID.get(id)!, w: 0.4 + rng() }));
  const total = raw.reduce((a, r) => a + r.w, 0);
  return raw.map(({ bond, w }) => ({
    ...bond,
    weight: Math.round((w / total) * 1000) / 10,
  }));
}

const INITIAL_PORTFOLIO = buildPortfolio();

/* ---- benchmark reference points --------------------------------- */

interface Benchmark {
  id: string;
  label: string;
  duration: number;
  yield: number;
  color: string;
  on: boolean;
}

const BENCHMARKS: Benchmark[] = [
  { id: "LQD", label: "LQD", duration: 8.2, yield: 5.05, color: "#ea580c", on: true },
  { id: "VCSH", label: "VCSH", duration: 2.6, yield: 4.75, color: "#0d9488", on: false },
  { id: "VCIT", label: "VCIT", duration: 6.1, yield: 5.0, color: "#7c3aed", on: false },
  { id: "IG100", label: "IG100", duration: 7.0, yield: 5.1, color: "#2563eb", on: false },
];

/* ---- recommendation engine -------------------------------------- */

// Composite desirability of a candidate as a replacement (higher = better):
// pick up yield & spread, better liquidity, lower GS charge.
function candidateScore(b: Bond): number {
  return b.yield * 8 + b.gSpread * 0.05 + b.liquidity * 0.25 - b.gsCharge * 2;
}

interface Recommendation {
  fromId: string;
  toId: string;
  yieldPickup: number; // bps
  gPickup: number; // bps
  chargeDelta: number; // bps (positive = cheaper to trade)
  liqDelta: number;
}

function sameIssuerCandidates(fromId: string): Bond[] {
  const from = BY_ID.get(fromId)!;
  return UNIVERSE.filter(
    (b) => b.ticker === from.ticker && b.id !== from.id,
  ).sort((a, b) => candidateScore(b) - candidateScore(a));
}

function bestReplacement(fromId: string): Recommendation | null {
  const from = BY_ID.get(fromId)!;
  const cands = sameIssuerCandidates(fromId);
  if (cands.length === 0) return null;
  const to = cands[0];
  if (candidateScore(to) <= candidateScore(from)) return null;
  return {
    fromId,
    toId: to.id,
    yieldPickup: Math.round((to.yield - from.yield) * 100),
    gPickup: to.gSpread - from.gSpread,
    chargeDelta: Math.round((from.gsCharge - to.gsCharge) * 10) / 10,
    liqDelta: to.liquidity - from.liquidity,
  };
}

// Portfolio-level top recommendations: rank holdings by upside from swapping.
function portfolioRecommendations(holdings: Holding[]): Recommendation[] {
  return holdings
    .map((h) => bestReplacement(h.id))
    .filter((r): r is Recommendation => r != null)
    .sort((a, b) => b.yieldPickup + b.gPickup - (a.yieldPickup + a.gPickup))
    .slice(0, 5);
}

/* ================================================================== */
/*  Metric config (axis toggles)                                       */
/* ================================================================== */

type YKey = "yield" | "gSpread" | "zSpread" | "oas";
const Y_METRICS: Record<YKey, { label: string; get: (b: Bond) => number; fmt: (v: number) => string }> = {
  yield: { label: "Yield", get: (b) => b.yield, fmt: (v) => `${v.toFixed(2)}%` },
  gSpread: { label: "G-Spread", get: (b) => b.gSpread, fmt: (v) => `${Math.round(v)}bp` },
  zSpread: { label: "Z-Spread", get: (b) => b.zSpread, fmt: (v) => `${Math.round(v)}bp` },
  oas: { label: "OAS", get: (b) => b.oas, fmt: (v) => `${Math.round(v)}bp` },
};

type GroupKey = "none" | "sector" | "region" | "rating";

/* ================================================================== */
/*  Formatters                                                         */
/* ================================================================== */

const bp = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}bp`;
const pct2 = (v: number) => `${v.toFixed(2)}%`;

/* ================================================================== */
/*  Bubble chart                                                       */
/* ================================================================== */

const W = 920;
const H = 540;
const PAD = { l: 56, r: 24, t: 22, b: 46 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

interface ChartProps {
  holdings: Holding[];
  replaced: Set<string>;
  changes: { from: Holding; to: Holding }[];
  yKey: YKey;
  group: GroupKey;
  benchmarks: Benchmark[];
  weightRange: [number, number];
  zoom: number;
  preview: Recommendation | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

function BubbleChart({
  holdings,
  replaced,
  changes,
  yKey,
  group,
  benchmarks,
  weightRange,
  zoom,
  preview,
  hoveredId,
  onHover,
}: ChartProps) {
  const ym = Y_METRICS[yKey];

  // Stable domains derived from the whole universe so bubbles don't jump.
  const { xDom, yDom } = useMemo(() => {
    const durs = UNIVERSE.map((b) => b.duration);
    const ys = UNIVERSE.map((b) => ym.get(b));
    const xMin = 0;
    const xMax = Math.max(...durs) + 0.6;
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    const padY = (yMax - yMin) * 0.12;
    yMin -= padY;
    yMax += padY;
    // zoom tightens around the centroid
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const zx = (xMax - xMin) / (2 * zoom);
    const zy = (yMax - yMin) / (2 * zoom);
    return {
      xDom: [Math.max(0, cx - zx), cx + zx] as [number, number],
      yDom: [cy - zy, cy + zy] as [number, number],
    };
  }, [ym, zoom]);

  const xTo = useCallback(
    (v: number) => PAD.l + ((v - xDom[0]) / (xDom[1] - xDom[0])) * PLOT_W,
    [xDom],
  );
  const yTo = useCallback(
    (v: number) => PAD.t + (1 - (v - yDom[0]) / (yDom[1] - yDom[0])) * PLOT_H,
    [yDom],
  );

  const radius = (w: number) => Math.max(9, Math.min(30, 7 + Math.sqrt(w) * 5));

  const bubbleColor = (b: Bond) => {
    if (group === "sector") return SECTOR_META[b.sector].color;
    if (group === "region") return REGION_COLOR[b.region];
    if (group === "rating") return RATING_COLOR[b.rating];
    return SECTOR_META[b.sector].color;
  };

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let d = Math.ceil(xDom[0]); d <= xDom[1]; d += 1) ticks.push(d);
    return ticks;
  }, [xDom]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = (yDom[1] - yDom[0]) / 5;
    for (let i = 0; i <= 5; i += 1) ticks.push(yDom[0] + step * i);
    return ticks;
  }, [yDom]);

  const visible = holdings.filter(
    (h) => h.weight >= weightRange[0] && h.weight <= weightRange[1],
  );

  const fromBond = preview ? BY_ID.get(preview.fromId)! : null;
  const toBond = preview ? BY_ID.get(preview.toId)! : null;
  const previewWeight = preview
    ? (holdings.find((h) => h.id === preview.fromId)?.weight ?? 5)
    : 5;
  // arrow from original → candidate, stopped just short of the destination bubble
  const arrow =
    fromBond && toBond
      ? (() => {
          const fx = xTo(fromBond.duration);
          const fy = yTo(ym.get(fromBond));
          const tx = xTo(toBond.duration);
          const ty = yTo(ym.get(toBond));
          const dx = tx - fx;
          const dy = ty - fy;
          const len = Math.hypot(dx, dy) || 1;
          const r = radius(previewWeight) + 6;
          return { fx, fy, ex: tx - (dx / len) * r, ey: ty - (dy / len) * r };
        })()
      : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" onMouseLeave={() => onHover(null)}>
      <defs>
        <marker id="repl-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#4f46e5" />
        </marker>
      </defs>
      {/* plot frame */}
      <rect x={PAD.l} y={PAD.t} width={PLOT_W} height={PLOT_H} fill="#fff" stroke="#e5e5e5" rx={8} />

      {/* grid + axes */}
      {yTicks.map((t, i) => (
        <g key={`y${i}`}>
          <line x1={PAD.l} y1={yTo(t)} x2={PAD.l + PLOT_W} y2={yTo(t)} stroke="#f1f1f1" />
          <text x={PAD.l - 8} y={yTo(t) + 3} textAnchor="end" className="fill-neutral-400" fontSize={10}>
            {ym.fmt(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <g key={`x${i}`}>
          <line x1={xTo(t)} y1={PAD.t} x2={xTo(t)} y2={PAD.t + PLOT_H} stroke="#f7f7f7" />
          <text x={xTo(t)} y={PAD.t + PLOT_H + 16} textAnchor="middle" className="fill-neutral-400" fontSize={10}>
            {t}y
          </text>
        </g>
      ))}
      <text x={PAD.l + PLOT_W / 2} y={H - 6} textAnchor="middle" className="fill-neutral-500" fontSize={11} fontWeight={600}>
        Duration (yrs)
      </text>
      <text x={14} y={PAD.t + PLOT_H / 2} textAnchor="middle" className="fill-neutral-500" fontSize={11} fontWeight={600} transform={`rotate(-90 14 ${PAD.t + PLOT_H / 2})`}>
        {ym.label}
      </text>

      {/* benchmark overlays */}
      {benchmarks.filter((b) => b.on).map((b) => {
        const by = Y_METRICS[yKey].get({ ...UNIVERSE[0], yield: b.yield, gSpread: b.yield * 100, zSpread: b.yield * 100, oas: b.yield * 90 } as Bond);
        const y = yTo(yKey === "yield" ? b.yield : by);
        return (
          <g key={b.id}>
            <line x1={PAD.l} y1={y} x2={PAD.l + PLOT_W} y2={y} stroke={b.color} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />
            <rect x={xTo(b.duration) - 16} y={y - 16} width={32} height={13} rx={3} fill={b.color} />
            <text x={xTo(b.duration)} y={y - 6} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>
              {b.label}
            </text>
          </g>
        );
      })}

      {/* applied replacements: ghost of the original + arrow to the new bond */}
      {changes.map(({ from, to }, i) => {
        const fx = xTo(from.duration);
        const fy = yTo(ym.get(from));
        const tx = xTo(to.duration);
        const ty = yTo(ym.get(to));
        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.hypot(dx, dy) || 1;
        const r = radius(to.weight) + 6;
        return (
          <g key={`chg-${i}`}>
            <circle cx={fx} cy={fy} r={radius(from.weight)} fill="none" stroke="#a3a3a3" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />
            {len > r + 2 && (
              <line x1={fx} y1={fy} x2={tx - (dx / len) * r} y2={ty - (dy / len) * r} stroke="#4f46e5" strokeWidth={1.5} markerEnd="url(#repl-arrow)" opacity={0.6} />
            )}
          </g>
        );
      })}

      {/* replacement projection */}
      {fromBond && toBond && arrow && (
        <g>
          <line
            x1={arrow.fx}
            y1={arrow.fy}
            x2={arrow.ex}
            y2={arrow.ey}
            stroke="#4f46e5"
            strokeWidth={2}
            strokeDasharray="5 4"
            markerEnd="url(#repl-arrow)"
          />
          <circle cx={xTo(toBond.duration)} cy={yTo(ym.get(toBond))} r={radius(previewWeight)} fill="#eef2ff" stroke="#4f46e5" strokeWidth={2} />
          <text x={xTo(toBond.duration)} y={yTo(ym.get(toBond)) + 3} textAnchor="middle" fontSize={12}>
            {SECTOR_META[toBond.sector].icon}
          </text>
        </g>
      )}

      {/* bubbles */}
      {visible.map((h) => {
        const cx = xTo(h.duration);
        const cy = yTo(ym.get(h));
        const r = radius(h.weight);
        const active = hoveredId === h.id;
        const changed = replaced.has(h.id);
        return (
          <g key={h.id} onMouseEnter={() => onHover(h.id)} className="cursor-pointer">
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={bubbleColor(h)}
              fillOpacity={active ? 0.32 : 0.18}
              stroke={bubbleColor(h)}
              strokeWidth={active ? 2.5 : changed ? 2 : 1.5}
            />
            <text x={cx} y={cy + r * 0.35} textAnchor="middle" fontSize={Math.min(18, r * 1.1)} pointerEvents="none">
              {SECTOR_META[h.sector].icon}
            </text>
            {active && (
              <text x={cx} y={cy - r - 5} textAnchor="middle" className="fill-neutral-700" fontSize={11} fontWeight={700} pointerEvents="none">
                {h.ticker} {String(h.maturity).slice(2)}′
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/*  Historical (52w range) view                                        */
/* ================================================================== */

function HistoricalView({ holdings, onHover, hoveredId }: {
  holdings: Holding[];
  onHover: (id: string | null) => void;
  hoveredId: string | null;
}) {
  const sorted = [...holdings].sort((a, b) => a.duration - b.duration);
  const yMin = Math.min(...holdings.map((h) => h.yieldLow)) - 0.15;
  const yMax = Math.max(...holdings.map((h) => h.yieldHigh)) + 0.15;
  const rowH = 30;
  const chartH = sorted.length * rowH + PAD.t + PAD.b;
  const labelW = 92;
  const plotW = W - labelW - PAD.r;
  const xTo = (v: number) => labelW + ((v - yMin) / (yMax - yMin)) * plotW;

  return (
    <svg viewBox={`0 0 ${W} ${chartH}`} className="h-full w-full" onMouseLeave={() => onHover(null)}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const v = yMin + ((yMax - yMin) / 5) * i;
        return (
          <g key={i}>
            <line x1={xTo(v)} y1={PAD.t} x2={xTo(v)} y2={chartH - PAD.b} stroke="#f1f1f1" />
            <text x={xTo(v)} y={chartH - PAD.b + 16} textAnchor="middle" className="fill-neutral-400" fontSize={10}>
              {v.toFixed(2)}%
            </text>
          </g>
        );
      })}
      {sorted.map((h, i) => {
        const y = PAD.t + i * rowH + rowH / 2;
        const active = hoveredId === h.id;
        const lo = xTo(h.yieldLow);
        const hi = xTo(h.yieldHigh);
        const mid = xTo((h.yieldLow + h.yieldHigh) / 2);
        const cur = xTo(h.yield);
        return (
          <g key={h.id} onMouseEnter={() => onHover(h.id)} className="cursor-pointer">
            <rect x={labelW} y={y - rowH / 2} width={plotW} height={rowH} fill={active ? "#eef2ff" : "transparent"} />
            <text x={labelW - 8} y={y + 3} textAnchor="end" className="fill-neutral-600" fontSize={10} fontWeight={600}>
              {h.ticker} {String(h.maturity).slice(2)}′
            </text>
            {/* range bar */}
            <line x1={lo} y1={y} x2={hi} y2={y} stroke={SECTOR_META[h.sector].ring} strokeWidth={6} strokeLinecap="round" />
            <line x1={lo} y1={y - 5} x2={lo} y2={y + 5} stroke="#a3a3a3" strokeWidth={1.5} />
            <line x1={hi} y1={y - 5} x2={hi} y2={y + 5} stroke="#a3a3a3" strokeWidth={1.5} />
            {/* mean diamond */}
            <rect x={mid - 4} y={y - 4} width={8} height={8} fill="#fff" stroke="#525252" strokeWidth={1.5} transform={`rotate(45 ${mid} ${y})`} />
            {/* current marker */}
            <circle cx={cur} cy={y} r={5} fill={SECTOR_META[h.sector].color} stroke="#fff" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/*  Tree map (rating / sector weight)                                  */
/* ================================================================== */

interface TmNode {
  key: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Binary-split treemap: recursively cut the rectangle along its longer edge in
// proportion to each half's aggregate weight. Good enough for ~4-12 buckets.
function treemapLayout(items: { key: string; value: number }[], x: number, y: number, w: number, h: number, out: TmNode[]) {
  if (items.length === 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  const total = items.reduce((a, i) => a + i.value, 0);
  let acc = 0;
  let idx = 0;
  while (idx < items.length - 1 && acc + items[idx].value <= total / 2) {
    acc += items[idx].value;
    idx += 1;
  }
  const cut = Math.max(1, Math.min(items.length - 1, idx));
  const a = items.slice(0, cut);
  const b = items.slice(cut);
  const aVal = a.reduce((s, i) => s + i.value, 0);
  if (w >= h) {
    const aw = (w * aVal) / total;
    treemapLayout(a, x, y, aw, h, out);
    treemapLayout(b, x + aw, y, w - aw, h, out);
  } else {
    const ah = (h * aVal) / total;
    treemapLayout(a, x, y, w, ah, out);
    treemapLayout(b, x, y + ah, w, h - ah, out);
  }
}

const RATING_TM: Record<Rating, string> = {
  AAA: "#0e7490",
  AA: "#0ea5e9",
  A: "#3b82f6",
  BBB: "#6366f1",
};
const RATING_ORDER: Rating[] = ["AAA", "AA", "A", "BBB"];

function TreeMapView({ holdings, by, hoveredId, onHover }: {
  holdings: Holding[];
  by: "rating" | "sector";
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const nodes = useMemo(() => {
    const totals = new Map<string, number>();
    for (const h of holdings) {
      const k = by === "rating" ? h.rating : h.sector;
      totals.set(k, (totals.get(k) ?? 0) + h.weight);
    }
    const items = [...totals.entries()]
      .map(([key, value]) => ({ key, value }))
      .sort((p, q) => q.value - p.value);
    const out: TmNode[] = [];
    treemapLayout(items, 0, 0, W, H, out);
    return out;
  }, [holdings, by]);

  const grand = holdings.reduce((a, h) => a + h.weight, 0) || 1;
  const colorFor = (key: string) =>
    by === "rating" ? (RATING_TM[key as Rating] ?? "#64748b") : (SECTOR_META[key as Sector]?.color ?? "#64748b");
  // a holding is "hovered" bucket if the hovered row shares this bucket
  const hoveredBucket = hoveredId
    ? (() => {
        const h = holdings.find((x) => x.id === hoveredId);
        return h ? (by === "rating" ? h.rating : h.sector) : null;
      })()
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" onMouseLeave={() => onHover(null)}>
      {nodes.map((n) => {
        const pct = (n.value / grand) * 100;
        const small = n.w < 70 || n.h < 34;
        const active = hoveredBucket === n.key;
        const isIG = by !== "rating" || RATING_ORDER.includes(n.key as Rating);
        return (
          <g key={n.key}>
            <rect
              x={n.x + 1.5}
              y={n.y + 1.5}
              width={Math.max(0, n.w - 3)}
              height={Math.max(0, n.h - 3)}
              rx={4}
              fill={colorFor(n.key)}
              fillOpacity={active ? 0.95 : 0.82}
              stroke="#ffffff"
              strokeWidth={2}
            />
            {n.w > 40 && n.h > 22 && (
              <>
                <text x={n.x + 10} y={n.y + 20} fill="#fff" fontSize={11} fontWeight={700} opacity={0.85}>
                  {isIG ? "IG" : "HY"}
                </text>
                <text x={n.x + 10} y={n.y + (small ? 34 : n.h / 2 + 4)} fill="#fff" fontSize={small ? 12 : 15} fontWeight={700}>
                  {n.key}
                </text>
                {!small && (
                  <text x={n.x + 10} y={n.y + n.h / 2 + 22} fill="#fff" fontSize={12} fontWeight={600} opacity={0.9}>
                    {pct.toFixed(2)}%
                  </text>
                )}
                {small && (
                  <text x={n.x + n.w - 10} y={n.y + 20} textAnchor="end" fill="#fff" fontSize={11} fontWeight={600} opacity={0.9}>
                    {pct.toFixed(1)}%
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/*  Small UI                                                           */
/* ================================================================== */

function HeroStat({ label, value, delta, dir, tone }: {
  label: string;
  value: string;
  delta?: string;
  dir?: "up" | "down";
  tone?: "pos" | "neg" | "neutral";
}) {
  const color = tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : "text-neutral-400";
  return (
    <div className="flex flex-col justify-center border-l border-neutral-200 px-4 py-1 first:border-l-0 first:pl-3">
      <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold tabular-nums text-neutral-900">{value}</span>
        {delta && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${color}`}>
            {dir === "up" ? "▲" : dir === "down" ? "▼" : ""}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

type PortStat = { charge: number; yield: number; duration: number; liquidity: number; gSpread: number; price: number };

function weightedRating(list: Holding[]): Rating {
  const wsum = list.reduce((a, h) => a + h.weight, 0) || 1;
  const rank = list.reduce((a, h) => a + RATING_ORDER.indexOf(h.rating) * h.weight, 0) / wsum;
  return RATING_ORDER[Math.max(0, Math.min(RATING_ORDER.length - 1, Math.round(rank)))];
}

function SummaryPanel({ holdings, baseline, cur, base, diff, onToggleDiff }: {
  holdings: Holding[];
  baseline: Holding[];
  cur: PortStat;
  base: PortStat;
  diff: boolean;
  onToggleDiff: () => void;
}) {
  const rows: { label: string; now: string; was?: string }[] = [
    { label: "Total Positions", now: holdings.length.toString() },
    { label: "Market Value", now: "$105.4M" },
    { label: "Avg Liquidity", now: cur.liquidity.toFixed(2), was: base.liquidity.toFixed(2) },
    { label: "SS Charge (bps)", now: cur.charge.toFixed(2), was: base.charge.toFixed(2) },
    { label: "Avg Yield", now: pct2(cur.yield), was: pct2(base.yield) },
    { label: "Avg G-Spread", now: `${Math.round(cur.gSpread)}bp`, was: `${Math.round(base.gSpread)}bp` },
    { label: "Modified Duration", now: cur.duration.toFixed(2), was: base.duration.toFixed(2) },
    { label: "Weighted S&P", now: weightedRating(holdings), was: weightedRating(baseline) },
  ];
  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
        <span className="text-sm font-semibold text-neutral-900">Summary</span>
        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Client&apos;s Buy</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-neutral-100 py-1.5 text-[12px] last:border-0">
            <span className="text-neutral-500">{r.label}</span>
            <span className="flex items-center gap-1.5 font-mono tabular-nums">
              {diff && r.was && r.was !== r.now && <span className="text-[11px] text-neutral-400 line-through">{r.was}</span>}
              <span className="font-semibold text-neutral-900">{r.now}</span>
            </span>
          </div>
        ))}
      </div>
      <label className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-500">
        Show difference
        <button
          type="button"
          onClick={onToggleDiff}
          className={`relative h-4 w-7 rounded-full transition ${diff ? "bg-indigo-600" : "bg-neutral-300"}`}
        >
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${diff ? "left-3.5" : "left-0.5"}`} />
        </button>
      </label>
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition ${value === o.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  ag-grid constituents table                                         */
/* ================================================================== */

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

function IssuerCell({ data }: ICellRendererParams<HoldingRow>) {
  if (!data) return null;
  return (
    <div className="flex items-center gap-2">
      <span>{SECTOR_META[data.sector].icon}</span>
      <span className="font-mono text-[12px] font-semibold text-neutral-900">{data.ticker}</span>
      <span className="truncate text-[11px] text-neutral-500">
        {data.coupon.toFixed(3)} {String(data.maturity).slice(2)}′
      </span>
      {data.changed && <span className={`${chip} bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200`}>NEW</span>}
    </div>
  );
}

type HoldingRow = Holding & { changed: boolean };

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

function BondReplacement() {
  // working portfolio: a map of original holding id -> replacement bond id
  const [replacements, setReplacements] = useState<Map<string, string>>(new Map());
  const [savedBaseline] = useState<Holding[]>(INITIAL_PORTFOLIO);
  const [committed, setCommitted] = useState(0); // count of confirmed changes
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // view controls
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"bubble" | "treemap" | "historical">("bubble");
  const [treemapBy, setTreemapBy] = useState<"rating" | "sector">("rating");
  const [showDiff, setShowDiff] = useState(true);
  const [yKey, setYKey] = useState<YKey>("yield");
  const [group, setGroup] = useState<GroupKey>("none");
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>(BENCHMARKS);
  const [weightRange, setWeightRange] = useState<[number, number]>([0, 20]);
  const [zoom, setZoom] = useState(1);

  // collapsible panels — collapse them to give the chart more room
  const [railOpen, setRailOpen] = useState(true);
  const [tableOpen, setTableOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"charge" | "liquidity" | "spread">("charge");
  const [preview, setPreview] = useState<Recommendation | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const originalById = useMemo(
    () => new Map(savedBaseline.map((h) => [h.id, h])),
    [savedBaseline],
  );

  // working holdings = baseline with replacements applied (weight carried over)
  const holdings = useMemo<Holding[]>(() => {
    return savedBaseline.map((h) => {
      const repId = replacements.get(h.id);
      if (!repId) return h;
      const rep = BY_ID.get(repId)!;
      return { ...rep, weight: h.weight };
    });
  }, [savedBaseline, replacements]);

  const replacedSet = useMemo(() => new Set(replacements.keys()), [replacements]);

  const rows = useMemo<HoldingRow[]>(
    () => holdings.map((h) => ({ ...h, changed: replacedSet.has(h.id) || (replacements.size > 0 && [...replacements.values()].includes(h.id)) })),
    [holdings, replacedSet, replacements],
  );

  // portfolio stats (weighted)
  const stat = useCallback((list: Holding[]) => {
    const wsum = list.reduce((a, h) => a + h.weight, 0) || 1;
    const wavg = (get: (h: Holding) => number) => list.reduce((a, h) => a + get(h) * h.weight, 0) / wsum;
    return {
      charge: wavg((h) => h.gsCharge),
      yield: wavg((h) => h.yield),
      duration: wavg((h) => h.duration),
      liquidity: wavg((h) => h.liquidity),
      gSpread: wavg((h) => h.gSpread),
      price: wavg((h) => h.dollarPrice),
    };
  }, []);

  const cur = useMemo(() => stat(holdings), [stat, holdings]);
  const base = useMemo(() => stat(savedBaseline), [stat, savedBaseline]);

  // recommendations, re-sortable
  const recs = useMemo(() => {
    const list = portfolioRecommendations(savedBaseline).filter((r) => !replacements.has(r.fromId));
    const sorted = [...list];
    if (sortKey === "charge") sorted.sort((a, b) => b.chargeDelta - a.chargeDelta);
    if (sortKey === "liquidity") sorted.sort((a, b) => b.liqDelta - a.liqDelta);
    if (sortKey === "spread") sorted.sort((a, b) => b.gPickup - a.gPickup);
    return sorted;
  }, [savedBaseline, replacements, sortKey]);

  const applyRec = useCallback((r: Recommendation) => {
    setReplacements((m) => {
      const next = new Map(m);
      next.set(r.fromId, r.toId);
      return next;
    });
    setPreview(null);
    setSavedToast(false);
  }, []);

  const undoOne = useCallback((fromId: string) => {
    setReplacements((m) => {
      const next = new Map(m);
      next.delete(fromId);
      return next;
    });
  }, []);

  const confirmChanges = useCallback(() => {
    setCommitted((c) => c + replacements.size);
    setReviewOpen(false);
    setSavedToast(true);
  }, [replacements.size]);

  const resetAll = useCallback(() => {
    setReplacements(new Map());
    setPreview(null);
    setSavedToast(false);
  }, []);

  const theme = useMemo(
    () =>
      themeQuartz.withParams(
        dark
          ? {
              accentColor: "#818cf8",
              backgroundColor: "#171717",
              foregroundColor: "#e5e5e5",
              borderColor: "#2a2a2a",
              headerBackgroundColor: "#1f1f1f",
              headerTextColor: "#a3a3a3",
              headerFontWeight: 600,
              oddRowBackgroundColor: "#1b1b1b",
              rowHoverColor: "#262626",
              fontFamily: "inherit",
              fontSize: 12,
              headerFontSize: 11,
              wrapperBorderRadius: 10,
              rowBorder: true,
            }
          : {
              accentColor: "#4f46e5",
              backgroundColor: "#ffffff",
              foregroundColor: "#171717",
              borderColor: "#e5e5e5",
              headerBackgroundColor: "#f5f5f5",
              headerTextColor: "#525252",
              headerFontWeight: 600,
              oddRowBackgroundColor: "#fcfcfc",
              rowHoverColor: "#eef2ff",
              fontFamily: "inherit",
              fontSize: 12,
              headerFontSize: 11,
              wrapperBorderRadius: 10,
              rowBorder: true,
            },
      ),
    [dark],
  );

  const columnDefs = useMemo<ColDef<HoldingRow>[]>(
    () => [
      { headerName: "Instrument", field: "ticker", flex: 2, minWidth: 210, cellRenderer: IssuerCell, pinned: "left" },
      { headerName: "Sector", field: "sector", width: 130 },
      { headerName: "Rating", field: "rating", width: 90 },
      { headerName: "Dur", field: "duration", type: "numericColumn", width: 80, valueFormatter: (p: ValueFormatterParams<HoldingRow, number>) => (p.value == null ? "" : p.value.toFixed(1)), cellClass: "font-mono tabular-nums" },
      { headerName: "Yield", field: "yield", type: "numericColumn", width: 90, valueFormatter: (p: ValueFormatterParams<HoldingRow, number>) => (p.value == null ? "" : pct2(p.value)), cellClass: "font-mono tabular-nums" },
      { headerName: "G-Sprd", field: "gSpread", type: "numericColumn", width: 90, valueFormatter: (p: ValueFormatterParams<HoldingRow, number>) => (p.value == null ? "" : `${Math.round(p.value)}bp`), cellClass: "font-mono tabular-nums" },
      { headerName: "$ Price", field: "dollarPrice", type: "numericColumn", width: 90, valueFormatter: (p: ValueFormatterParams<HoldingRow, number>) => (p.value == null ? "" : p.value.toFixed(2)), cellClass: "font-mono tabular-nums" },
      { headerName: "Liq", field: "liquidity", type: "numericColumn", width: 80, cellClass: "font-mono tabular-nums" },
      { headerName: "SS Chg", field: "gsCharge", type: "numericColumn", width: 90, valueFormatter: (p: ValueFormatterParams<HoldingRow, number>) => (p.value == null ? "" : `${p.value.toFixed(1)}bp`), cellClass: "font-mono tabular-nums" },
      { headerName: "Weight", field: "weight", type: "numericColumn", width: 100, valueFormatter: (p: ValueFormatterParams<HoldingRow, number>) => (p.value == null ? "" : `${p.value.toFixed(1)}%`), cellClass: "font-mono tabular-nums" },
    ],
    [],
  );

  const changeList = useMemo(
    () => [...replacements.entries()].map(([fromId, toId]) => ({ from: originalById.get(fromId)!, to: BY_ID.get(toId)! })),
    [replacements, originalById],
  );

  // for the chart: original → candidate (candidate carries the original weight)
  const chartChanges = useMemo(
    () =>
      [...replacements.entries()].map(([fromId, toId]) => {
        const from = originalById.get(fromId)!;
        return { from, to: { ...BY_ID.get(toId)!, weight: from.weight } as Holding };
      }),
    [replacements, originalById],
  );

  const chargeDelta = cur.charge - base.charge;
  const yieldDelta = cur.yield - base.yield;
  const priceDelta = cur.price - base.price;
  const durDelta = cur.duration - base.duration;
  const changed = replacements.size > 0;

  return (
    <div className={`flex h-screen flex-col bg-neutral-50 ${dark ? "screener-dark" : ""}`}>
      {/* header */}
      <div className="border-b border-neutral-200 bg-white px-6 pt-3 pb-4">
        {/* title + actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Portfolio Optimizer</h1>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
              Credit · Pre-Trade
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              State Street recommendations live
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50"
              title={dark ? "Switch to light" : "Switch to dark"}
            >
              {dark ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 2a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 10 2Zm0 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.5a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75ZM4.4 4.4a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 0 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06Zm9.44 9.44a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 1 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06ZM2 10a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2 10Zm13.25 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75ZM5.86 13.84a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 0 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0Zm9.44-9.44a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 1 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0Z" /></svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" /></svg>
              )}
            </button>
            <button type="button" className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" /></svg>
              Share with Sales
            </button>
            <button type="button" className="flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-500">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M1 1.75A.75.75 0 0 1 1.75 1h1.5a.75.75 0 0 1 .74.617l.313 1.729 12.386.005a.75.75 0 0 1 .734.913l-1.05 4.68a2.75 2.75 0 0 1-2.68 2.156H6.34l.29 1.6h7.36a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.738-.617L3.132 2.5H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7.5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" /></svg>
              Create Basket
            </button>
          </div>
        </div>

        {/* portfolio stat strip */}
        <div className="mt-3 flex flex-wrap items-stretch rounded-lg border border-neutral-200 bg-white py-1.5">
          <HeroStat label="Holdings" value={holdings.length.toString()} delta={changed ? `${replacements.size} pending` : undefined} />
          <HeroStat label="Avg Price" value={`$${cur.price.toFixed(2)}`} delta={changed ? `${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(2)}` : undefined} dir={priceDelta >= 0 ? "up" : "down"} tone="neutral" />
          <HeroStat label="Avg Yield" value={pct2(cur.yield)} delta={changed ? bp(yieldDelta * 100) : undefined} dir={yieldDelta >= 0 ? "up" : "down"} tone={yieldDelta >= 0 ? "pos" : "neg"} />
          <HeroStat label="Mod. Duration" value={`${cur.duration.toFixed(2)}y`} delta={changed ? `${durDelta >= 0 ? "+" : ""}${durDelta.toFixed(2)}` : undefined} dir={durDelta >= 0 ? "up" : "down"} tone="neutral" />
          <HeroStat label="SS Charge" value={`${cur.charge.toFixed(2)}bp`} delta={changed ? `${chargeDelta >= 0 ? "+" : ""}${chargeDelta.toFixed(2)}` : undefined} dir={chargeDelta >= 0 ? "up" : "down"} tone={chargeDelta <= 0 ? "pos" : "neg"} />
        </div>

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as "bubble" | "treemap" | "historical")}
              className="h-8 appearance-none rounded-md border border-neutral-200 bg-white pl-3 pr-8 text-sm font-medium text-neutral-800 outline-none focus:border-indigo-400"
            >
              <option value="bubble">Bubble Chart</option>
              <option value="treemap">Tree Map</option>
              <option value="historical">Historical</option>
            </select>
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
            </svg>
          </div>
          {view === "bubble" && (
            <>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                Y-Axis
                <Segmented
                  options={(Object.keys(Y_METRICS) as YKey[]).map((k) => ({ id: k, label: Y_METRICS[k].label }))}
                  value={yKey}
                  onChange={setYKey}
                />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                Group
                <Segmented
                  options={[
                    { id: "none", label: "None" },
                    { id: "sector", label: "Sector" },
                    { id: "region", label: "Region" },
                    { id: "rating", label: "Rating" },
                  ]}
                  value={group}
                  onChange={setGroup}
                />
              </label>
            </>
          )}
          {view === "treemap" && (
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
              By
              <Segmented
                options={[
                  { id: "rating", label: "Rating" },
                  { id: "sector", label: "Sector" },
                ]}
                value={treemapBy}
                onChange={setTreemapBy}
              />
            </label>
          )}
          <div className="ml-auto flex items-center gap-2">
            {view === "bubble" && (
              <div className="flex items-center gap-1">
                {benchmarks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBenchmarks((bs) => bs.map((x) => (x.id === b.id ? { ...x, on: !x.on } : x)))}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition"
                    style={{
                      borderColor: b.on ? b.color : dark ? "#2a2a2a" : "#e5e5e5",
                      color: b.on ? b.color : dark ? "#a3a3a3" : "#737373",
                      background: b.on ? `${b.color}${dark ? "2a" : "12"}` : dark ? "#1f1f1f" : "#fff",
                    }}
                  >
                    <span className="h-1.5 w-3 rounded-full" style={{ background: b.color }} />
                    {b.label}
                  </button>
                ))}
              </div>
            )}
            {replacements.size > 0 && (
              <>
                <button type="button" onClick={resetAll} className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
                  Reset
                </button>
                <button type="button" onClick={() => setReviewOpen(true)} className="h-8 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-500">
                  Save changes ({replacements.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        {/* chart + table */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <SummaryPanel holdings={holdings} baseline={savedBaseline} cur={cur} base={base} diff={showDiff && replacements.size > 0} onToggleDiff={() => setShowDiff((d) => !d)} />
            <div className="bond-chart h-full flex-1 bg-white">
              {view === "bubble" ? (
                <BubbleChart
                  holdings={holdings}
                  replaced={replacedSet}
                  changes={chartChanges}
                  yKey={yKey}
                  group={group}
                  benchmarks={benchmarks}
                  weightRange={weightRange}
                  zoom={zoom}
                  preview={preview}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                />
              ) : view === "treemap" ? (
                <TreeMapView holdings={holdings} by={treemapBy} hoveredId={hoveredId} onHover={setHoveredId} />
              ) : (
                <HistoricalView holdings={holdings} hoveredId={hoveredId} onHover={setHoveredId} />
              )}
            </div>
          </div>

          {/* bubble controls */}
          {view === "bubble" && (
            <div className="flex items-center gap-6 px-6 py-2 text-[11px] text-neutral-500">
              <label className="flex items-center gap-2">
                Zoom
                <input type="range" min={1} max={2.5} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="h-1 w-24 cursor-pointer accent-indigo-600" />
              </label>
              <label className="flex items-center gap-2">
                Weight ≤
                <input type="range" min={2} max={20} step={1} value={weightRange[1]} onChange={(e) => setWeightRange([0, Number(e.target.value)])} className="h-1 w-24 cursor-pointer accent-indigo-600" />
                <span className="font-mono tabular-nums">{weightRange[1]}%</span>
              </label>
              <span className="ml-auto text-neutral-400">Bubble size = portfolio weight · icon = sector</span>
            </div>
          )}

          {/* constituents (collapsible) */}
          <div className={`${tableOpen ? "h-72" : "h-10"} shrink-0 border-t border-neutral-200 px-4 transition-[height] duration-200`}>
            <button
              type="button"
              onClick={() => setTableOpen((o) => !o)}
              className="flex w-full items-center gap-2 py-2.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase transition hover:text-neutral-800"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${tableOpen ? "rotate-90" : ""}`}>
                <path fillRule="evenodd" d="M7.21 5.23a.75.75 0 0 1 1.06.02l4 4.25a.75.75 0 0 1 0 1.02l-4 4.25a.75.75 0 1 1-1.08-1.04L10.69 10 7.19 6.27a.75.75 0 0 1 .02-1.04Z" clipRule="evenodd" />
              </svg>
              Constituents
              <span className="ml-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{rows.length}</span>
            </button>
            {tableOpen && (
              <div className="h-[calc(100%-2.5rem)] pb-3">
                <AgGridReact<HoldingRow>
                  key={dark ? "grid-dark" : "grid-light"}
                  theme={theme}
                  columnDefs={columnDefs}
                  rowData={rows}
                  getRowId={(p) => p.data.id}
                  defaultColDef={{ sortable: true, resizable: true }}
                  onCellMouseOver={(e) => e.data && setHoveredId(e.data.id)}
                  rowHeight={32}
                  headerHeight={34}
                />
              </div>
            )}
          </div>
        </div>

        {/* recommendation rail (collapsible) */}
        {!railOpen && (
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className="flex w-11 shrink-0 flex-col items-center gap-2 border-l border-neutral-200 bg-white py-4 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
            title="Show recommendations"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 0-1.06.02l-4 4.25a.75.75 0 0 0 0 1.02l4 4.25a.75.75 0 1 0 1.08-1.04L9.31 10l3.5-3.73a.75.75 0 0 0-.02-1.04Z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">State Street Recommended</span>
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">{recs.length}</span>
          </button>
        )}
        <aside className={`${railOpen ? "flex" : "hidden"} w-80 shrink-0 flex-col border-l border-neutral-200 bg-white`}>
          <div className="border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900">State Street Recommended</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{recs.length}</span>
                <button type="button" onClick={() => setRailOpen(false)} className="text-neutral-400 transition hover:text-neutral-700" title="Collapse">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M7.21 5.23a.75.75 0 0 1 1.06.02l4 4.25a.75.75 0 0 1 0 1.02l-4 4.25a.75.75 0 1 1-1.08-1.04L10.69 10 7.19 6.27a.75.75 0 0 1 .02-1.04Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="mt-2">
              <Segmented
                options={[
                  { id: "charge", label: "Charge" },
                  { id: "liquidity", label: "Liquidity" },
                  { id: "spread", label: "Spread" },
                ]}
                value={sortKey}
                onChange={setSortKey}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {recs.length === 0 && (
              <div className="mt-10 text-center text-xs text-neutral-400">No pending recommendations.<br />Reset to see all again.</div>
            )}
            <div className="space-y-2">
              {recs.map((r) => {
                const from = originalById.get(r.fromId) ?? BY_ID.get(r.fromId)!;
                const to = BY_ID.get(r.toId)!;
                return (
                  <div
                    key={r.fromId}
                    onMouseEnter={() => setPreview(r)}
                    onMouseLeave={() => setPreview(null)}
                    className="rounded-lg border border-neutral-200 p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <span>{SECTOR_META[from.sector].icon}</span>
                      <span className="font-mono font-semibold text-neutral-700">{from.ticker} {String(from.maturity).slice(2)}′</span>
                      <span className="text-neutral-400">→</span>
                      <span className="font-mono font-semibold text-indigo-700">{to.ticker} {String(to.maturity).slice(2)}′</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                      <div>
                        <div className="text-[9px] tracking-wide text-neutral-400 uppercase">Yield</div>
                        <div className={`font-mono text-[12px] font-semibold tabular-nums ${r.yieldPickup >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{bp(r.yieldPickup)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] tracking-wide text-neutral-400 uppercase">Spread</div>
                        <div className={`font-mono text-[12px] font-semibold tabular-nums ${r.gPickup >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{bp(r.gPickup)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] tracking-wide text-neutral-400 uppercase">Charge</div>
                        <div className={`font-mono text-[12px] font-semibold tabular-nums ${r.chargeDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.chargeDelta >= 0 ? "−" : "+"}{Math.abs(r.chargeDelta).toFixed(1)}bp</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400">Liq {to.liquidity} · {to.rating}</span>
                      <button type="button" onClick={() => applyRec(r)} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-500">
                        Replace
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {replacements.size > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Pending changes</div>
                <div className="space-y-1">
                  {changeList.map(({ from, to }) => (
                    <div key={from.id} className="flex items-center justify-between rounded-md bg-neutral-50 px-2 py-1.5 text-[11px]">
                      <span className="font-mono text-neutral-600">{from.ticker} {String(from.maturity).slice(2)}′ → {to.ticker} {String(to.maturity).slice(2)}′</span>
                      <button type="button" onClick={() => undoOne(from.id)} className="text-neutral-400 hover:text-rose-600">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* review modal */}
      {reviewOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-6" onClick={() => setReviewOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-neutral-900">Review replacements</h2>
            <p className="mt-1 text-sm text-neutral-500">Confirm the {replacements.size} change{replacements.size > 1 ? "s" : ""} below to update your draft.</p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-neutral-200 p-3">
                <div className="text-[10px] tracking-wide text-neutral-400 uppercase">SS charge</div>
                <div className="mt-0.5 font-mono text-sm text-neutral-500 line-through">{base.charge.toFixed(1)}bp</div>
                <div className="font-mono text-lg font-semibold text-neutral-900">{cur.charge.toFixed(1)}bp</div>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <div className="text-[10px] tracking-wide text-neutral-400 uppercase">Avg yield</div>
                <div className="mt-0.5 font-mono text-sm text-neutral-500 line-through">{pct2(base.yield)}</div>
                <div className="font-mono text-lg font-semibold text-emerald-600">{pct2(cur.yield)}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <div className="text-[10px] tracking-wide text-neutral-400 uppercase">Avg G-spread</div>
                <div className="mt-0.5 font-mono text-sm text-neutral-500 line-through">{Math.round(base.gSpread)}bp</div>
                <div className="font-mono text-lg font-semibold text-neutral-900">{Math.round(cur.gSpread)}bp</div>
              </div>
            </div>

            <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto">
              {changeList.map(({ from, to }) => (
                <div key={from.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-neutral-500">
                    {SECTOR_META[from.sector].icon}
                    <span className="font-mono">{from.ticker} {from.coupon.toFixed(3)} {String(from.maturity).slice(2)}′</span>
                  </span>
                  <span className="text-neutral-400">→</span>
                  <span className="flex items-center gap-2 font-medium text-indigo-700">
                    <span className="font-mono">{to.ticker} {to.coupon.toFixed(3)} {String(to.maturity).slice(2)}′</span>
                    <span className="font-mono text-[11px] text-emerald-600">{pct2(to.yield)}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewOpen(false)} className="h-9 rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">Cancel</button>
              <button type="button" onClick={confirmChanges} className="h-9 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-500">Confirm changes</button>
            </div>
          </div>
        </div>
      )}

      {/* saved toast / next steps */}
      {savedToast && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
          <span className="text-sm text-neutral-700">{committed} change{committed > 1 ? "s" : ""} saved to draft.</span>
          <div className="ml-2 flex items-center gap-1.5">
            <button type="button" className="rounded-md border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50">Load more</button>
            <button type="button" className="rounded-md border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50">Create basket</button>
            <button type="button" className="rounded-md border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50">Contact sales</button>
            <button type="button" onClick={() => setSavedToast(false)} className="rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-600">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BondReplacement;
