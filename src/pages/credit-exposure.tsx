import { useMemo, useState, type ReactNode } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ValueGetterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

export const title = "Counterparty Credit";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Model — counterparty credit limits and pre-trade what-if analysis.
 * Each counterparty has a stack of caps; the what-if previews the
 * projected impact of a hypothetical ticket against every cap before
 * the trader books it.
 * ------------------------------------------------------------------ */

type LimitKey = "sr" | "psr" | "mtm" | "im" | "conc";
type Trend = "up" | "down" | "flat";

interface Limit {
  key: LimitKey;
  label: string;
  ccy: string;
  current: number;
  soft: number;
  hard: number;
  unit: "ccy" | "pct";
  trend: Trend;
  note?: string;
}

interface NettingAgreement {
  type: "ISDA" | "CSA" | "GMRA" | "MSFTA";
  signed: string;
  threshold: string;
  mtaCcy: string;
  rehypothecation: boolean;
  collateralPosted: number;
  collateralReceived: number;
  status: "active" | "stale-doc" | "in-renewal";
}

interface CreditEvent {
  at: string;
  who: string;
  kind: "limit-change" | "override" | "review" | "breach" | "remediation";
  text: string;
}

interface Counterparty {
  id: string;
  name: string;
  desk: string;
  jurisdiction: string;
  internalRating: string;
  externalRating: string;
  watchlist: boolean;
  cds5y: number;
  cds5yChange1d: number;
  cdsTrend: number[];
  notional: number;
  limits: Limit[];
  netting: NettingAgreement[];
  events: CreditEvent[];
  topConcentrations: { instrument: string; notional: number; ccy: string }[];
  outlook: "stable" | "negative" | "positive";
  lastReview: string;
}

const COUNTERPARTIES: Counterparty[] = [
  {
    id: "JPM",
    name: "JP Morgan",
    desk: "Cash equities · Repo · FX",
    jurisdiction: "US",
    internalRating: "AA-",
    externalRating: "A+/S&P",
    watchlist: false,
    cds5y: 38,
    cds5yChange1d: -1,
    cdsTrend: [42, 41, 40, 40, 39, 39, 38],
    notional: 3_412_000_000,
    outlook: "stable",
    lastReview: "2026-04-12",
    limits: [
      { key: "sr", label: "Settlement Risk", ccy: "USD", current: 412_000_000, soft: 500_000_000, hard: 600_000_000, unit: "ccy", trend: "flat" },
      { key: "psr", label: "Pre-Settlement Risk", ccy: "USD", current: 178_000_000, soft: 220_000_000, hard: 275_000_000, unit: "ccy", trend: "up" },
      { key: "mtm", label: "MtM exposure", ccy: "USD", current: 41_000_000, soft: 80_000_000, hard: 120_000_000, unit: "ccy", trend: "flat" },
      { key: "im", label: "Initial Margin posted", ccy: "USD", current: 92_000_000, soft: 130_000_000, hard: 160_000_000, unit: "ccy", trend: "flat" },
      { key: "conc", label: "Book concentration", ccy: "", current: 14.2, soft: 18, hard: 22, unit: "pct", trend: "flat" },
    ],
    netting: [
      { type: "ISDA", signed: "2019-06-04", threshold: "USD 0", mtaCcy: "USD", rehypothecation: false, collateralPosted: 92_000_000, collateralReceived: 0, status: "active" },
      { type: "GMRA", signed: "2020-11-22", threshold: "USD 0", mtaCcy: "USD", rehypothecation: true, collateralPosted: 0, collateralReceived: 215_000_000, status: "active" },
    ],
    events: [
      { at: "Yest 16:40", who: "Credit risk", kind: "review", text: "Quarterly review passed — no rating change." },
    ],
    topConcentrations: [
      { instrument: "Repo · UST 10Y", notional: 1_400_000_000, ccy: "USD" },
      { instrument: "FX swap · USD/EUR", notional: 820_000_000, ccy: "USD" },
      { instrument: "Cash equities — large cap US", notional: 412_000_000, ccy: "USD" },
    ],
  },
  {
    id: "DB",
    name: "Deutsche Bank",
    desk: "Repo · Rates · FX",
    jurisdiction: "DE",
    internalRating: "A-",
    externalRating: "A-/S&P",
    watchlist: true,
    cds5y: 89,
    cds5yChange1d: 6,
    cdsTrend: [72, 75, 78, 80, 82, 83, 89],
    notional: 1_120_000_000,
    outlook: "negative",
    lastReview: "2026-05-02",
    limits: [
      { key: "sr", label: "Settlement Risk", ccy: "EUR", current: 248_000_000, soft: 250_000_000, hard: 300_000_000, unit: "ccy", trend: "up", note: "Within 1% of soft cap on a busy settlement day." },
      { key: "psr", label: "Pre-Settlement Risk", ccy: "EUR", current: 165_000_000, soft: 150_000_000, hard: 180_000_000, unit: "ccy", trend: "up", note: "Soft cap breached — desk informed." },
      { key: "mtm", label: "MtM exposure", ccy: "EUR", current: 12_400_000, soft: 40_000_000, hard: 60_000_000, unit: "ccy", trend: "flat" },
      { key: "im", label: "Initial Margin posted", ccy: "EUR", current: 38_000_000, soft: 70_000_000, hard: 90_000_000, unit: "ccy", trend: "flat" },
      { key: "conc", label: "Book concentration", ccy: "", current: 8.4, soft: 10, hard: 12, unit: "pct", trend: "up" },
    ],
    netting: [
      { type: "ISDA", signed: "2017-02-12", threshold: "EUR 0", mtaCcy: "EUR", rehypothecation: false, collateralPosted: 38_000_000, collateralReceived: 0, status: "stale-doc" },
      { type: "GMRA", signed: "2018-04-04", threshold: "EUR 0", mtaCcy: "EUR", rehypothecation: true, collateralPosted: 0, collateralReceived: 91_000_000, status: "active" },
    ],
    events: [
      { at: "10:42", who: "Credit bot", kind: "breach", text: "PSR EUR 165m above soft cap of EUR 150m." },
      { at: "10:50", who: "Credit risk — A. Costa", kind: "override", text: "Temporary headroom approved to EUR 175m, expires 16:00 today." },
      { at: "Yest", who: "Credit risk", kind: "limit-change", text: "PSR hard cap held at EUR 180m pending external review." },
    ],
    topConcentrations: [
      { instrument: "Repo · German Bund 5–10y", notional: 470_000_000, ccy: "EUR" },
      { instrument: "FX forward · EUR/USD", notional: 320_000_000, ccy: "EUR" },
      { instrument: "OIS swap · EUR", notional: 240_000_000, ccy: "EUR" },
    ],
  },
  {
    id: "GS",
    name: "Goldman Sachs",
    desk: "Equities · Rates",
    jurisdiction: "US",
    internalRating: "A+",
    externalRating: "BBB+/S&P",
    watchlist: false,
    cds5y: 52,
    cds5yChange1d: 2,
    cdsTrend: [48, 48, 49, 50, 50, 51, 52],
    notional: 2_010_000_000,
    outlook: "stable",
    lastReview: "2026-03-29",
    limits: [
      { key: "sr", label: "Settlement Risk", ccy: "USD", current: 310_000_000, soft: 450_000_000, hard: 525_000_000, unit: "ccy", trend: "flat" },
      { key: "psr", label: "Pre-Settlement Risk", ccy: "USD", current: 138_000_000, soft: 200_000_000, hard: 250_000_000, unit: "ccy", trend: "flat" },
      { key: "mtm", label: "MtM exposure", ccy: "USD", current: 28_000_000, soft: 70_000_000, hard: 100_000_000, unit: "ccy", trend: "down" },
      { key: "im", label: "Initial Margin posted", ccy: "USD", current: 64_000_000, soft: 110_000_000, hard: 140_000_000, unit: "ccy", trend: "flat" },
      { key: "conc", label: "Book concentration", ccy: "", current: 9.1, soft: 15, hard: 18, unit: "pct", trend: "flat" },
    ],
    netting: [
      { type: "ISDA", signed: "2018-09-19", threshold: "USD 0", mtaCcy: "USD", rehypothecation: false, collateralPosted: 64_000_000, collateralReceived: 0, status: "active" },
    ],
    events: [
      { at: "Yest 14:21", who: "Credit risk", kind: "review", text: "Internal rating affirmed at A+." },
    ],
    topConcentrations: [
      { instrument: "Cash equities — US tech", notional: 680_000_000, ccy: "USD" },
      { instrument: "OIS swap · USD", notional: 410_000_000, ccy: "USD" },
      { instrument: "Repo · UST 2Y", notional: 240_000_000, ccy: "USD" },
    ],
  },
  {
    id: "BARC",
    name: "Barclays",
    desk: "Rates · FX · Repo",
    jurisdiction: "UK",
    internalRating: "A",
    externalRating: "A/S&P",
    watchlist: false,
    cds5y: 58,
    cds5yChange1d: 0,
    cdsTrend: [56, 57, 58, 58, 58, 58, 58],
    notional: 1_580_000_000,
    outlook: "stable",
    lastReview: "2026-02-15",
    limits: [
      { key: "sr", label: "Settlement Risk", ccy: "GBP", current: 290_000_000, soft: 320_000_000, hard: 380_000_000, unit: "ccy", trend: "up" },
      { key: "psr", label: "Pre-Settlement Risk", ccy: "GBP", current: 122_000_000, soft: 180_000_000, hard: 220_000_000, unit: "ccy", trend: "flat" },
      { key: "mtm", label: "MtM exposure", ccy: "GBP", current: 18_000_000, soft: 50_000_000, hard: 75_000_000, unit: "ccy", trend: "flat" },
      { key: "im", label: "Initial Margin posted", ccy: "GBP", current: 41_000_000, soft: 80_000_000, hard: 100_000_000, unit: "ccy", trend: "flat" },
      { key: "conc", label: "Book concentration", ccy: "", current: 6.9, soft: 12, hard: 14, unit: "pct", trend: "flat" },
    ],
    netting: [
      { type: "ISDA", signed: "2016-07-18", threshold: "GBP 0", mtaCcy: "GBP", rehypothecation: false, collateralPosted: 41_000_000, collateralReceived: 0, status: "active" },
      { type: "GMRA", signed: "2019-05-09", threshold: "GBP 0", mtaCcy: "GBP", rehypothecation: true, collateralPosted: 0, collateralReceived: 142_000_000, status: "in-renewal" },
    ],
    events: [
      { at: "08:30", who: "Doc team", kind: "review", text: "GMRA renewal in progress — current doc valid through 2026-06-30." },
    ],
    topConcentrations: [
      { instrument: "Repo · UK Gilt 10y", notional: 510_000_000, ccy: "GBP" },
      { instrument: "FX swap · GBP/USD", notional: 280_000_000, ccy: "GBP" },
      { instrument: "OIS swap · GBP", notional: 220_000_000, ccy: "GBP" },
    ],
  },
  {
    id: "SMALL-BK",
    name: "Tier-3 Bank A",
    desk: "FX",
    jurisdiction: "TR",
    internalRating: "BB+",
    externalRating: "BB/S&P",
    watchlist: true,
    cds5y: 412,
    cds5yChange1d: 18,
    cdsTrend: [340, 360, 370, 380, 390, 394, 412],
    notional: 88_000_000,
    outlook: "negative",
    lastReview: "2026-05-10",
    limits: [
      { key: "sr", label: "Settlement Risk", ccy: "USD", current: 32_000_000, soft: 35_000_000, hard: 40_000_000, unit: "ccy", trend: "up", note: "Settlement risk approaching cap on FX legs." },
      { key: "psr", label: "Pre-Settlement Risk", ccy: "USD", current: 14_000_000, soft: 15_000_000, hard: 18_000_000, unit: "ccy", trend: "up" },
      { key: "mtm", label: "MtM exposure", ccy: "USD", current: 2_800_000, soft: 5_000_000, hard: 8_000_000, unit: "ccy", trend: "flat" },
      { key: "im", label: "Initial Margin posted", ccy: "USD", current: 0, soft: 0, hard: 0, unit: "ccy", trend: "flat", note: "No CSA — no IM exchange." },
      { key: "conc", label: "Book concentration", ccy: "", current: 0.5, soft: 2, hard: 3, unit: "pct", trend: "flat" },
    ],
    netting: [
      { type: "ISDA", signed: "2022-03-01", threshold: "USD 5,000,000", mtaCcy: "USD", rehypothecation: false, collateralPosted: 0, collateralReceived: 0, status: "active" },
    ],
    events: [
      { at: "10:14", who: "Credit bot", kind: "breach", text: "CDS widened 18bp overnight — auto-flag for daily monitoring." },
      { at: "Yest", who: "Credit risk — A. Costa", kind: "remediation", text: "Settlement cap reduced from USD 50m to USD 40m pending watchlist review." },
    ],
    topConcentrations: [
      { instrument: "FX spot · USD/TRY", notional: 38_000_000, ccy: "USD" },
      { instrument: "FX forward · USD/TRY 1M", notional: 22_000_000, ccy: "USD" },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const ccyFmt = (n: number, ccy: string) =>
  new Intl.NumberFormat("en-GB", {
    style: ccy ? "currency" : "decimal",
    currency: ccy || undefined,
    maximumFractionDigits: 0,
    notation: Math.abs(n) >= 10_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(n);

const ccyFmtFull = (n: number, ccy: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

const utilisation = (l: Limit) => (l.hard > 0 ? (l.current / l.hard) * 100 : 0);

const limitTone = (
  current: number,
  soft: number,
  hard: number,
): "ok" | "warn" | "breach" => {
  if (hard <= 0) return "ok";
  if (current >= hard) return "breach";
  if (current >= soft) return "warn";
  return "ok";
};

const TONE: Record<
  "ok" | "warn" | "breach",
  { bar: string; pill: string; dot: string; text: string; ring: string; chipBg: string }
> = {
  ok: {
    bar: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700",
    ring: "ring-emerald-200",
    chipBg: "bg-emerald-50",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  warn: {
    bar: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700",
    ring: "ring-amber-200",
    chipBg: "bg-amber-50",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  breach: {
    bar: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700",
    ring: "ring-rose-200",
    chipBg: "bg-rose-50",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
};

const worstTone = (cp: Counterparty): "ok" | "warn" | "breach" =>
  cp.limits.reduce<"ok" | "warn" | "breach">((acc, l) => {
    const t = limitTone(l.current, l.soft, l.hard);
    if (t === "breach") return "breach";
    if (t === "warn" && acc !== "breach") return "warn";
    return acc;
  }, "ok");

/* ------------------------------------------------------------------ *
 * AG Grid — counterparty list in the left panel
 * ------------------------------------------------------------------ */

ModuleRegistry.registerModules([AllCommunityModule]);

const creditGridTheme = themeQuartz.withParams({
  accentColor: "#171717",
  fontFamily: "inherit",
  fontSize: 12,
  headerFontWeight: 600,
  headerTextColor: "#737373",
  headerBackgroundColor: "#fafafa",
  borderColor: "#e5e5e5",
  rowBorder: { color: "#f5f5f5" },
  rowHoverColor: "#fafafa",
  headerHeight: 32,
  rowHeight: 40,
  cellHorizontalPadding: 8,
  wrapperBorderRadius: 0,
});

const CP_COL_DEFS: ColDef<Counterparty>[] = [
  {
    colId: "name",
    headerName: "Counterparty",
    flex: 2,
    minWidth: 90,
    cellRenderer: ({ data }: ICellRendererParams<Counterparty>) => {
      if (!data) return null;
      const tone = TONE[worstTone(data)];
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-neutral-900">{data.name}</div>
            {data.watchlist && (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-800">
                Watch
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    colId: "rating",
    headerName: "Rtg",
    width: 44,
    cellClass: "font-mono text-[11px] tabular-nums text-neutral-600",
    valueGetter: ({ data }: ValueGetterParams<Counterparty>) => data?.internalRating ?? "",
  },
  {
    colId: "cds",
    headerName: "CDS",
    width: 56,
    type: "rightAligned",
    valueGetter: ({ data }: ValueGetterParams<Counterparty>) => data?.cds5y ?? 0,
    cellRenderer: ({ data }: ICellRendererParams<Counterparty>) => {
      if (!data) return null;
      const up = data.cds5yChange1d > 0;
      const dn = data.cds5yChange1d < 0;
      return (
        <span className={`font-mono text-[11px] tabular-nums ${up ? "text-rose-600" : dn ? "text-emerald-600" : "text-neutral-600"}`}>
          {data.cds5y}bp
        </span>
      );
    },
  },
  {
    colId: "srUtil",
    headerName: "SR util",
    width: 60,
    type: "rightAligned",
    valueGetter: ({ data }: ValueGetterParams<Counterparty>) => {
      if (!data) return 0;
      const sr = data.limits.find((l) => l.key === "sr");
      return sr && sr.hard > 0 ? Math.round((sr.current / sr.hard) * 100) : 0;
    },
    cellRenderer: ({ data }: ICellRendererParams<Counterparty>) => {
      if (!data) return null;
      const sr = data.limits.find((l) => l.key === "sr");
      if (!sr || sr.hard <= 0)
        return <span className="font-mono text-[11px] tabular-nums text-neutral-400">—</span>;
      const u = Math.round((sr.current / sr.hard) * 100);
      const tone = limitTone(sr.current, sr.soft, sr.hard);
      const cls =
        tone === "breach" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-neutral-600";
      return <span className={`font-mono text-[11px] font-semibold tabular-nums ${cls}`}>{u}%</span>;
    },
  },
];

/* ------------------------------------------------------------------ *
 * Limit bar — clean single bar with optional projected delta segment.
 * ------------------------------------------------------------------ */

function LimitBar({ limit, delta }: { limit: Limit; delta?: number }) {
  if (limit.hard <= 0) {
    return (
      <div className="grid grid-cols-[1fr_140px] items-center gap-4 py-2">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800">
              {limit.label}
            </span>
            <span className="text-[11px] tabular-nums text-neutral-500">
              No limit
            </span>
          </div>
          <div className="mt-1 text-[11px] italic text-neutral-500">
            {limit.note ?? "Not applicable for this counterparty."}
          </div>
        </div>
        <div />
      </div>
    );
  }

  const tone = limitTone(limit.current, limit.soft, limit.hard);
  const t = TONE[tone];
  const u = Math.min(utilisation(limit), 100);
  const softPct = Math.min((limit.soft / limit.hard) * 100, 100);

  const fmtVal = (v: number) =>
    limit.unit === "pct" ? `${v.toFixed(1)}%` : ccyFmt(v, limit.ccy);

  const hasDelta = delta !== undefined && delta !== 0;
  const after = hasDelta ? Math.max(0, limit.current + (delta as number)) : undefined;
  const afterTone =
    after !== undefined
      ? limitTone(after, limit.soft, limit.hard)
      : undefined;
  const afterU =
    after !== undefined ? Math.min((after / limit.hard) * 100, 100) : undefined;

  // Position of the projected addition (positive deltas extend, negative deltas retract)
  const deltaStart = Math.min(u, afterU ?? u);
  const deltaEnd = Math.max(u, afterU ?? u);
  const deltaDir = (delta ?? 0) >= 0 ? "add" : "remove";

  return (
    <div className="grid grid-cols-[1fr_180px] items-center gap-4 border-t border-neutral-100 py-3 first:border-t-0">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-800">
              {limit.label}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
              {tone === "ok" ? "Headroom" : tone === "warn" ? "Soft cap" : "Hard breach"}
            </span>
          </div>
          <div className="text-[10px] tabular-nums text-neutral-500">
            {pct(u)} used
          </div>
        </div>

        {/* Bar */}
        <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`absolute inset-y-0 left-0 ${t.bar}`}
            style={{ width: `${u}%` }}
          />
          {hasDelta && afterU !== undefined && (
            <div
              className={`absolute inset-y-0 ${
                deltaDir === "add"
                  ? "bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.18)_0_4px,transparent_4px_8px)]"
                  : "bg-neutral-300/60"
              }`}
              style={{
                left: `${deltaStart}%`,
                width: `${deltaEnd - deltaStart}%`,
              }}
            />
          )}
          {/* Soft cap tick */}
          <div
            className="absolute inset-y-0 w-px bg-neutral-700"
            style={{ left: `${softPct}%` }}
            aria-label={`Soft cap at ${fmtVal(limit.soft)}`}
          />
        </div>

        {/* Scale labels */}
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-400">
          <span>0</span>
          <span style={{ marginLeft: `${softPct}%` }} className="-translate-x-1/2">
            soft {fmtVal(limit.soft)}
          </span>
          <span>hard {fmtVal(limit.hard)}</span>
        </div>
      </div>

      {/* Right column: now / after */}
      <div className="flex flex-col items-end gap-0.5">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
          Current
        </div>
        <div className={`font-mono text-sm font-semibold tabular-nums ${t.text}`}>
          {fmtVal(limit.current)}
        </div>
        {hasDelta && after !== undefined && (
          <div
            className={`mt-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${TONE[afterTone!].chipBg} ${TONE[afterTone!].text}`}
          >
            <span aria-hidden>{deltaDir === "add" ? "→" : "←"}</span>
            {fmtVal(after)}
          </div>
        )}
        {!hasDelta && limit.note && (
          <div className="text-[10px] italic text-neutral-400 line-clamp-1">
            {limit.note}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sparkline — minimal SVG path for the CDS trend.
 * ------------------------------------------------------------------ */

function Spark({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 18;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-4 w-16">
      <polyline
        fill="none"
        points={points}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={tone}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * What-if analyser
 * ------------------------------------------------------------------ */

type WhatIfSide = "buy" | "sell";
type WhatIfProduct = "FX Spot" | "FX Forward" | "Repo" | "OIS Swap" | "Cash Equity";

function useWhatIfDeltas(
  cp: Counterparty,
  side: WhatIfSide,
  product: WhatIfProduct,
  notional: number,
  tenor: string,
) {
  return useMemo<Partial<Record<LimitKey, number>>>(() => {
    if (notional === 0) return {};
    const signed = side === "buy" ? 1 : -1;
    const longDays =
      tenor === "1M" ? 30 : tenor === "3M" ? 90 : tenor === "6M" ? 180 : 7;
    switch (product) {
      case "FX Spot":
        return {
          sr: notional,
          psr: notional * 0.012,
          mtm: 0,
          conc: notional / cp.notional > 0.02 ? 0.4 : 0.1,
        };
      case "FX Forward":
        return {
          sr: 0,
          psr: notional * (longDays / 365) * 0.04,
          mtm: signed * notional * 0.003,
          conc: notional / cp.notional > 0.02 ? 0.6 : 0.2,
        };
      case "Repo":
        return {
          sr: notional * 0.5,
          psr: notional * 0.04,
          mtm: signed * notional * 0.001,
          im: notional * 0.02,
          conc: 0.3,
        };
      case "OIS Swap":
        return {
          sr: 0,
          psr: notional * (longDays / 365) * 0.06,
          mtm: signed * notional * 0.005,
          im: notional * 0.01,
          conc: 0.2,
        };
      case "Cash Equity":
        return {
          sr: notional,
          psr: notional * 0.01,
          mtm: 0,
          conc: notional / cp.notional > 0.05 ? 0.5 : 0.15,
        };
    }
  }, [side, product, notional, tenor, cp.notional]);
}

function WhatIfHero({
  cp,
}: {
  cp: Counterparty;
}) {
  const [side, setSide] = useState<WhatIfSide>("buy");
  const [product, setProduct] = useState<WhatIfProduct>("FX Forward");
  const [notional, setNotional] = useState<number>(50_000_000);
  const [tenor, setTenor] = useState<string>("1M");

  const deltas = useWhatIfDeltas(cp, side, product, notional, tenor);

  const verdict = useMemo<"ok" | "warn" | "breach">(() => {
    let worst: "ok" | "warn" | "breach" = "ok";
    cp.limits.forEach((l) => {
      const d = deltas[l.key] ?? 0;
      const after = l.current + d;
      const t = limitTone(after, l.soft, l.hard);
      if (t === "breach") worst = "breach";
      else if (t === "warn" && worst !== "breach") worst = "warn";
    });
    return worst;
  }, [deltas, cp.limits]);

  const verdictMeta = {
    ok: {
      headline: "Within all caps",
      sub: "This ticket passes the pre-trade check on every limit.",
      cta: "Pass to OMS",
      ctaCls: "bg-emerald-600 hover:bg-emerald-700",
      cardCls: "border-emerald-200 bg-emerald-50/40",
    },
    warn: {
      headline: "Breaches a soft cap",
      sub: "Within hard limits — desk head sign-off required.",
      cta: "Pass with sign-off",
      ctaCls: "bg-amber-600 hover:bg-amber-700",
      cardCls: "border-amber-200 bg-amber-50/40",
    },
    breach: {
      headline: "Breaches a hard cap",
      sub: "Blocked at pre-trade — request a temporary headroom override.",
      cta: "Request override",
      ctaCls: "bg-rose-600 hover:bg-rose-700",
      cardCls: "border-rose-200 bg-rose-50/40",
    },
  }[verdict];

  const summedSize = ccyFmtFull(notional, cp.limits[0].ccy || "USD");

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Inputs */}
        <div className="border-b border-neutral-200 p-5 lg:border-r lg:border-b-0">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
            What-if ticket
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            Preview impact against every cap before booking.
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Side
              </div>
              <div className="mt-1 inline-flex rounded-md border border-neutral-200 bg-neutral-50/60 p-0.5">
                {(["buy", "sell"] as WhatIfSide[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={`rounded-sm px-3 py-1 text-[11px] font-semibold transition ${
                      side === s
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:bg-white"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Product
              </div>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value as WhatIfProduct)}
                className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 focus:border-neutral-400 focus:outline-none"
              >
                {(["FX Spot", "FX Forward", "Repo", "OIS Swap", "Cash Equity"] as WhatIfProduct[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                  Notional
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-neutral-900">
                  {summedSize}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={500_000_000}
                step={1_000_000}
                value={notional}
                onChange={(e) => setNotional(Number(e.target.value))}
                className="mt-1 w-full accent-neutral-900"
              />
              <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-neutral-400">
                <span>0</span>
                <span>500m</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Tenor
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {["O/N", "1W", "1M", "3M", "6M"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTenor(t)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                      tenor === t
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Verdict + bars preview */}
        <div className="p-5">
          <div
            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${verdictMeta.cardCls}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-white ${TONE[verdict].bar}`}
                >
                  {verdict === "ok" ? "✓" : verdict === "warn" ? "!" : "✕"}
                </span>
                <div>
                  <div className={`text-sm font-semibold ${TONE[verdict].text}`}>
                    {verdictMeta.headline}
                  </div>
                  <div className="text-[11px] text-neutral-600">
                    {verdictMeta.sub}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={verdict === "breach" && notional === 0}
              className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-white shadow-sm ${verdictMeta.ctaCls}`}
            >
              {verdictMeta.cta}
            </button>
          </div>

          {/* Per-limit impact preview */}
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                Impact preview
              </div>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                  Current
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.6)_0_2px,transparent_2px_4px)]" />
                  Added by trade
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="block h-2 w-px bg-neutral-700" />
                  Soft cap
                </span>
              </div>
            </div>
            <div className="px-4 pb-2">
              {cp.limits.map((l) => (
                <LimitBar key={l.key} limit={l} delta={deltas[l.key]} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function CreditExposure() {
  const [selectedId, setSelectedId] = useState(COUNTERPARTIES[0].id);
  const [search, setSearch] = useState("");
  const [filterWorst, setFilterWorst] = useState<"all" | "breach" | "warn">(
    "all",
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return COUNTERPARTIES.filter((cp) => {
      const w = worstTone(cp);
      if (filterWorst === "breach" && w !== "breach") return false;
      if (filterWorst === "warn" && w === "ok") return false;
      if (
        q &&
        !cp.name.toLowerCase().includes(q) &&
        !cp.id.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [search, filterWorst]);

  const selected = useMemo(
    () => COUNTERPARTIES.find((c) => c.id === selectedId) ?? COUNTERPARTIES[0],
    [selectedId],
  );

  const portfolio = useMemo(() => {
    const total = COUNTERPARTIES.reduce((acc, c) => acc + c.notional, 0);
    const watchlist = COUNTERPARTIES.filter((c) => c.watchlist).length;
    const breaches = COUNTERPARTIES.reduce(
      (acc, c) =>
        acc +
        c.limits.filter((l) => limitTone(l.current, l.soft, l.hard) === "breach")
          .length,
      0,
    );
    const softWarns = COUNTERPARTIES.reduce(
      (acc, c) =>
        acc +
        c.limits.filter((l) => limitTone(l.current, l.soft, l.hard) === "warn")
          .length,
      0,
    );
    return { total, watchlist, breaches, softWarns };
  }, []);

  const cdsTrendTone =
    selected.cds5yChange1d > 0
      ? "stroke-rose-500"
      : selected.cds5yChange1d < 0
        ? "stroke-emerald-500"
        : "stroke-neutral-400";

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-neutral-500">
                <span>Risk</span>
                <span aria-hidden className="text-neutral-300">/</span>
                <span className="text-neutral-700">Counterparty Credit</span>
              </nav>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
                Counterparty Credit Exposure
              </h1>
              <p className="mt-1 max-w-prose text-sm text-neutral-600">
                Track limit utilisation across the book, run pre-trade
                what-ifs against every cap, and manage breaches before they
                hit published exposure.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Export to risk committee
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Request limit change
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Aggregate notional"
              value={ccyFmt(portfolio.total, "USD")}
              hint="USD-equivalent across all CPs"
            />
            <Kpi
              label="Hard breaches"
              value={String(portfolio.breaches)}
              hint="require override or unwind"
              tone={portfolio.breaches ? "rose" : "emerald"}
            />
            <Kpi
              label="Soft cap warnings"
              value={String(portfolio.softWarns)}
              hint="approaching headroom"
              tone={portfolio.softWarns ? "amber" : "emerald"}
            />
            <Kpi
              label="On watchlist"
              value={String(portfolio.watchlist)}
              hint={`of ${COUNTERPARTIES.length} counterparties`}
              tone={portfolio.watchlist ? "amber" : "neutral"}
            />
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[300px_1fr] overflow-hidden">
        {/* Counterparty list */}
        <aside className="flex h-full flex-col border-r border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search counterparty…"
              className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-0.5 rounded-full bg-neutral-50 p-0.5 ring-1 ring-inset ring-neutral-200">
              {(
                [
                  ["all", "All"],
                  ["warn", "Soft"],
                  ["breach", "Breach"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterWorst(k)}
                  className={`flex-1 rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                    filterWorst === k
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <AgGridReact<Counterparty>
              theme={creditGridTheme}
              columnDefs={CP_COL_DEFS}
              rowData={filtered}
              suppressMovableColumns
              suppressCellFocus
              noRowsOverlayComponent={() => (
                <div className="px-4 py-8 text-center text-xs text-neutral-400">
                  No counterparties match.
                </div>
              )}
              onRowClicked={(e) => {
                if (!e.data) return;
                setSelectedId(e.data.id);
              }}
              getRowStyle={(params) =>
                params.data?.id === selectedId
                  ? { background: "#f9fafb", borderLeft: "2px solid #171717" }
                  : undefined
              }
            />
          </div>
        </aside>

        {/* Detail */}
        <section className="flex h-full flex-col overflow-y-auto px-8 py-6">
          {/* CP identity row */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-neutral-500 tabular-nums">
                  {selected.id}
                </span>
                <span className="text-neutral-300">·</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                  Internal {selected.internalRating}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                  External {selected.externalRating}
                </span>
                {selected.watchlist && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Watchlist · {selected.outlook}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                {selected.name}
              </h2>
              <div className="mt-0.5 text-xs text-neutral-500">
                {selected.desk} · {selected.jurisdiction}
              </div>
            </div>

            {/* Big CDS card */}
            <div className="flex items-center gap-5 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  5y CDS
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tabular-nums text-neutral-950">
                    {selected.cds5y}
                  </span>
                  <span className="text-xs text-neutral-500">bp</span>
                </div>
                <div
                  className={`mt-0.5 text-[11px] font-semibold tabular-nums ${
                    selected.cds5yChange1d > 0
                      ? "text-rose-600"
                      : selected.cds5yChange1d < 0
                        ? "text-emerald-600"
                        : "text-neutral-500"
                  }`}
                >
                  {selected.cds5yChange1d > 0
                    ? "▲ "
                    : selected.cds5yChange1d < 0
                      ? "▼ "
                      : "– "}
                  {selected.cds5yChange1d}bp 1d
                </div>
              </div>
              <div className="h-12 w-px bg-neutral-100" />
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  Trend (7d)
                </div>
                <Spark values={selected.cdsTrend} tone={cdsTrendTone} />
              </div>
              <div className="h-12 w-px bg-neutral-100" />
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  Notional
                </div>
                <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-neutral-900">
                  {ccyFmt(selected.notional, "USD")}
                </div>
                <div className="text-[10px] text-neutral-500">
                  reviewed {selected.lastReview}
                </div>
              </div>
            </div>
          </div>

          {/* What-if hero */}
          <div className="mt-6">
            <WhatIfHero cp={selected} />
          </div>

          {/* Supporting panels */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <NettingTable cp={selected} />
            <Concentration cp={selected} />
          </div>

          <div className="mt-4">
            <EventList cp={selected} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Supporting cards
 * ------------------------------------------------------------------ */

function NettingTable({ cp }: { cp: Counterparty }) {
  const STATUS_VIS = {
    active: "bg-emerald-50 text-emerald-700",
    "stale-doc": "bg-rose-50 text-rose-700",
    "in-renewal": "bg-amber-50 text-amber-700",
  } as const;
  const STATUS_LABEL = {
    active: "Active",
    "stale-doc": "Stale doc",
    "in-renewal": "In renewal",
  } as const;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Netting & collateral
        </h3>
        <span className="text-[11px] text-neutral-500">
          ISDA · GMRA · CSA inventory
        </span>
      </div>
      <div className="divide-y divide-neutral-100">
        {cp.netting.map((n, i) => (
          <div
            key={i}
            className="grid grid-cols-[100px_1fr_1fr_120px] items-center gap-3 px-4 py-3 text-xs"
          >
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                {n.type}
              </div>
              <div className="text-[11px] text-neutral-500">
                {n.rehypothecation ? "rehyp." : "no rehyp."}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Signed · Threshold
              </div>
              <div className="font-mono text-xs tabular-nums text-neutral-700">
                {n.signed}
              </div>
              <div className="text-[11px] text-neutral-500">
                Threshold {n.threshold}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                Posted · Received
              </div>
              <div className="font-mono text-xs tabular-nums text-neutral-700">
                {ccyFmtFull(n.collateralPosted, n.mtaCcy)}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-neutral-500">
                {ccyFmtFull(n.collateralReceived, n.mtaCcy)} rcvd
              </div>
            </div>
            <div className="flex justify-end">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_VIS[n.status]}`}
              >
                {STATUS_LABEL[n.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Concentration({ cp }: { cp: Counterparty }) {
  const max = Math.max(...cp.topConcentrations.map((c) => c.notional));
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Top concentrations
        </h3>
        <p className="text-[11px] text-neutral-500">
          Largest sleeves of book exposure at this counterparty
        </p>
      </div>
      <ul className="flex flex-col gap-3 px-4 py-3">
        {cp.topConcentrations.map((c, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-800">
                {c.instrument}
              </span>
              <span className="font-mono tabular-nums text-neutral-700">
                {ccyFmtFull(c.notional, c.ccy)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-neutral-700"
                style={{ width: `${(c.notional / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventList({ cp }: { cp: Counterparty }) {
  const kindMeta: Record<
    CreditEvent["kind"],
    { label: string; tone: string; dot: string }
  > = {
    "limit-change": { label: "Limit change", tone: "text-neutral-700", dot: "bg-neutral-400" },
    override: { label: "Override", tone: "text-amber-700", dot: "bg-amber-500" },
    review: { label: "Review", tone: "text-neutral-700", dot: "bg-neutral-400" },
    breach: { label: "Breach", tone: "text-rose-700", dot: "bg-rose-500" },
    remediation: { label: "Remediation", tone: "text-blue-700", dot: "bg-blue-500" },
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Credit activity
        </h3>
        <p className="text-[11px] text-neutral-500">
          Limit changes, overrides, breaches and reviews — auditable.
        </p>
      </div>
      <ol className="flex flex-col gap-3 px-4 py-3">
        {cp.events.length === 0 && (
          <li className="text-xs text-neutral-400">
            No activity in the lookback window.
          </li>
        )}
        {cp.events.map((e, i) => {
          const m = kindMeta[e.kind];
          return (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`text-xs font-semibold ${m.tone}`}>
                    {m.label}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-neutral-400">
                    {e.at}
                  </span>
                  <span className="text-[10px] text-neutral-400">· {e.who}</span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-neutral-700">
                  {e.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "amber" | "rose" | "emerald" | "neutral";
}) {
  const valueTone =
    tone === "amber"
      ? "text-amber-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-neutral-950";
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
        {label}
      </span>
      <span
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}
      >
        {value}
      </span>
      {hint && (
        <span className="mt-1 text-[11px] text-neutral-500">{hint}</span>
      )}
    </div>
  );
}
