import { useMemo, useState, type ReactNode } from "react";
import type { ChartClickEventObject, Options, Point } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  COLORS,
  COMPARE_DATE,
  COMPARE_KEYS,
  COMPARE_LABEL,
  CURVE_LABELS,
  CURVE_PAST,
  CURVE_TENORS,
  CURVE_TODAY,
  alpha,
  fmt,
  type CompareKey,
  type Fund,
  type Holding,
  type RatingBucket,
  type Sector,
  type TenorBucket,
  type creditRows,
  type keyRateRows,
  type sectorRows,
} from "./model";

/* Chart cards for the Fixed Income Portfolio page.
 *
 * One hero (the gilt curve with holdings on it) and three analysis cards that
 * double as cross-filter controls: clicking a bar (or anywhere in its column
 * of the plot) toggles that bucket as a filter on the page. Every card has a
 * Chart | Table view toggle; the table twin carries the same values and the
 * same toggle buttons, so the cross-filter works without a pointer too.
 */

type View = "chart" | "table";
const ANALYSIS_HEIGHT = 252;

/* Series ids carry `sliceKey` (fund + active cross-filters). HighchartsView
 * updates with chart.update(…, oneToOne), which merges into existing points:
 * a colour tween out of a dimmed state ends as rgba() rather than the hex
 * asked for, and shrinking then regrowing a bubble series reuses point
 * graphics in a different stacking order. Keying the ids means every slice
 * gets freshly built series, so clearing the filters reproduces the default
 * render exactly. colorIndex is pinned for the same reason (it would otherwise
 * count up as series are rebuilt). The analysis series skip their entry
 * animation so a click does not replay the columns growing. */
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/* ================================================================== */
/*  Chrome                                                             */
/* ================================================================== */

export function Segmented<T extends string>({
  label,
  hideLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      {!hideLabel && (
        <span aria-hidden className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          {label}
        </span>
      )}
      <div className="flex border border-neutral-200 bg-white">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`px-2 py-1 text-[11px] font-medium transition focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                on ? "bg-blue-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "chart", label: "Chart" },
  { value: "table", label: "Table" },
];

function Card({
  title,
  subtitle,
  controls,
  view,
  onView,
  strip,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  controls?: ReactNode;
  view: View;
  onView: (v: View) => void;
  strip?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col border border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-x-4 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle && <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {controls}
          <Segmented label={`${title} view`} hideLabel value={view} options={VIEW_OPTIONS} onChange={onView} />
        </div>
      </header>
      {strip}
      <div className="relative min-w-0 flex-1 px-2 py-2">{children}</div>
      {footer && <footer className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">{footer}</footer>}
    </section>
  );
}

/** Square colour key used in subtitles (identity never rides on colour alone). */
function Key({ color, children, line }: { color: string; children: ReactNode; line?: "solid" | "dash" | "tick" }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {line === "tick" ? (
        <span aria-hidden className="inline-block h-3 w-[3px]" style={{ background: color }} />
      ) : line ? (
        <span
          aria-hidden
          className="inline-block w-4"
          style={{ borderTop: `2px ${line === "dash" ? "dashed" : "solid"} ${color}` }}
        />
      ) : (
        <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: color }} />
      )}
      {children}
    </span>
  );
}

function EmptyOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-500">{children}</div>
    </div>
  );
}

/* ---- accessible table twin -------------------------------------- */

interface TwinRow {
  key: string;
  cells: ReactNode[];
  selected?: boolean;
  onToggle?: () => void;
}

function TwinTable({
  caption,
  head,
  rows,
  height,
  foot,
  narrow,
}: {
  caption: string;
  head: string[];
  rows: TwinRow[];
  height: number;
  foot?: ReactNode[];
  narrow?: boolean;
}) {
  return (
    <div className="overflow-auto" style={{ height }}>
      <table className="w-full border-collapse text-[12px]" style={narrow ? { maxWidth: 640 } : undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-white">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`border-b border-neutral-200 px-3 py-1.5 text-[10px] font-semibold tracking-widest whitespace-nowrap text-neutral-400 uppercase ${
                  i ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <tr key={r.key} className={r.selected ? "bg-blue-50" : undefined}>
              <th scope="row" className="px-3 py-1.5 text-left font-medium whitespace-nowrap text-neutral-800">
                {r.onToggle ? (
                  <button
                    type="button"
                    aria-pressed={r.selected}
                    onClick={r.onToggle}
                    title={r.selected ? `Clear ${r.key} filter` : `Filter to ${r.key}`}
                    className={`-mx-1 px-1 text-left underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                      r.selected ? "font-semibold text-blue-700" : ""
                    }`}
                  >
                    {r.key}
                  </button>
                ) : (
                  r.key
                )}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-neutral-700 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-neutral-200 bg-neutral-50">
              <th scope="row" className="px-3 py-1.5 text-left text-[11px] font-semibold text-neutral-800">
                Total
              </th>
              {foot.map((c, i) => (
                <td key={i} className="px-3 py-1.5 text-right font-mono font-semibold text-neutral-900 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ---- shared chart helpers --------------------------------------- */

/** Category index from a click anywhere in the plot area, so a whole column is the hit target. */
function categoryClick<K extends string>(keys: readonly K[], onSelect: (k: K) => void) {
  return function (e: Event) {
    const v = (e as unknown as ChartClickEventObject).xAxis?.[0]?.value;
    if (typeof v !== "number") return;
    const i = Math.round(v);
    if (i >= 0 && i < keys.length) onSelect(keys[i]);
  };
}

function categoryLabels<K extends string>(selected: K | null) {
  return {
    style: { color: "#525252", fontSize: "10px" },
    formatter(this: { value: string | number }) {
      const v = String(this.value);
      return selected === v ? `<span style="font-weight:700;fill:#1d4ed8;color:#1d4ed8">${v}</span>` : v;
    },
  };
}

function selectedBand<K extends string>(keys: readonly K[], selected: K | null) {
  const i = selected ? keys.indexOf(selected) : -1;
  return i >= 0 ? [{ from: i - 0.5, to: i + 0.5, color: COLORS.accentWash }] : [];
}

/* ================================================================== */
/*  Hero: gilt par curve with holdings                                 */
/* ================================================================== */

// Log-ish spacing: x = ln(1 + years) gives the belly room without letting
// the 3M–2Y front end take a third of the width (a pure log axis would).
const X = (years: number) => Math.log1p(years);
const TICKS = [0.2, 0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 55];
const TICK_LABEL: Record<number, string> = {
  0.25: "3M",
  0.5: "6M",
  1: "1Y",
  2: "2Y",
  3: "3Y",
  5: "5Y",
  7: "7Y",
  10: "10Y",
  15: "15Y",
  20: "20Y",
  30: "30Y",
  50: "50Y",
};
const BUCKET_RANGE: Record<TenorBucket, [number, number]> = {
  "0–2y": [0.2, 2],
  "2–5y": [2, 5],
  "5–10y": [5, 10],
  "10–20y": [10, 20],
  "20–30y": [20, 30],
  "30y+": [30, 55],
};

interface TipHolding {
  issuer: string;
  id: string;
  sector: Sector;
  coupon: number;
  maturity: string;
  rating: string;
  oas: number;
  mv: number;
  weight: number;
}

const at = (curve: number[], tenor: number) => curve[CURVE_TENORS.indexOf(tenor)];

export function HeroCurveCard({
  fund,
  holdings,
  compare,
  onCompare,
  tenor,
  note,
  sliceKey,
}: {
  fund: Fund;
  holdings: Holding[];
  compare: CompareKey;
  onCompare: (k: CompareKey) => void;
  tenor: TenorBucket | null;
  note: ReactNode;
  sliceKey: string;
}) {
  const [view, setView] = useState<View>("chart");
  const past = CURVE_PAST[compare];

  // Axis frame is fixed per fund, so cross-filtering never rescales the curve.
  const frame = useMemo(() => {
    const ys = [...fund.holdings.map((h) => h.ytw), ...CURVE_TODAY, ...Object.values(CURVE_PAST).flat()];
    return {
      yMin: Math.floor((Math.min(...ys) - 0.1) * 4) / 4,
      yMax: Math.ceil((Math.max(...ys) + 0.1) * 4) / 4,
      zMax: Math.max(...fund.holdings.map((h) => h.mv)),
    };
  }, [fund]);

  const options = useMemo<Options>(() => {
    const last = CURVE_TENORS.length - 1;
    const curve = (ys: number[], label: string, above: boolean) =>
      ys.map((y, i) => ({
        x: X(CURVE_TENORS[i]),
        y,
        custom: { i },
        dataLabels:
          i === last
            ? {
                enabled: true,
                format: label,
                align: "right" as const,
                verticalAlign: above ? ("bottom" as const) : ("top" as const),
                y: above ? -4 : 4,
                style: { color: above ? COLORS.ink : COLORS.ink3, fontFamily: "inherit", fontSize: "10px", fontWeight: "600" },
              }
            : undefined,
      }));
    const bubbles = (sov: boolean) =>
      holdings
        .filter((h) => (h.sector === "Gilts" || h.sector === "Supranational") === sov)
        .map((h) => ({
          x: X(h.years),
          y: h.ytw,
          z: h.mv,
          custom: {
            h: {
              issuer: h.issuer,
              id: h.id,
              sector: h.sector,
              coupon: h.coupon,
              maturity: h.maturity,
              rating: h.rating,
              oas: h.oas,
              mv: h.mv,
              weight: h.weight,
            } satisfies TipHolding,
          },
        }));
    const band = tenor ? BUCKET_RANGE[tenor] : null;

    return {
      chart: { spacing: [10, 12, 6, 4] },
      xAxis: {
        min: X(0.2),
        max: X(55),
        tickPositions: TICKS.map(X),
        gridLineWidth: 1,
        title: { text: "Years to maturity", style: { fontSize: "10px" } },
        labels: {
          formatter(this: { value: string | number }) {
            const v = Number(this.value);
            const t = TICKS.find((k) => Math.abs(X(k) - v) < 1e-9);
            return t != null ? (TICK_LABEL[t] ?? "") : "";
          },
        },
        plotBands: band
          ? [
              {
                from: X(band[0]),
                to: X(band[1]),
                color: alpha(COLORS.accent, 0.07),
                label: {
                  text: `Tenor ${tenor}`,
                  align: "left",
                  x: 6,
                  y: 14,
                  style: { color: "#1d4ed8", fontSize: "10px", fontWeight: "600" },
                },
              },
            ]
          : [],
      },
      yAxis: {
        min: frame.yMin,
        max: frame.yMax,
        tickInterval: 0.5,
        title: { text: undefined },
        labels: {
          formatter(this: { value: string | number }) {
            return `${Number(this.value).toFixed(1)}%`;
          },
        },
      },
      legend: { enabled: true, align: "left", verticalAlign: "top", x: 36, itemDistance: 18, margin: 6 },
      tooltip: {
        outside: true,
        formatter(this: Point) {
          const c = this.options.custom as { i?: number; h?: TipHolding } | undefined;
          if (c?.h) {
            const h = c.h;
            const spread = h.sector === "Gilts" ? fmt.signed(h.oas, 1, "bp") : `${fmt.n0(h.oas)}bp`;
            return `<div style="min-width:230px">
              <div><b style="font-size:13px">${fmt.n3(this.y ?? 0)}%</b> <span style="color:#a3a3a3">YTW</span>
              &nbsp;<b>${spread}</b> <span style="color:#a3a3a3">OAS</span></div>
              <div style="margin-top:4px;font-weight:600">${h.issuer}</div>
              <div style="color:#d4d4d4">${fmt.n3(h.coupon)}% coupon · matures ${fmt.date(h.maturity)} · ${h.rating}</div>
              <div style="margin-top:2px;color:#a3a3a3;font-family:${MONO}">${h.id} · £${fmt.n1(h.mv)}m · ${fmt.n2(h.weight)}% NAV</div>
            </div>`;
          }
          if (c?.i != null) {
            const t = CURVE_TODAY[c.i];
            const p = past[c.i];
            return `<b>${fmt.n2(t)}%</b> <span style="color:#a3a3a3">${CURVE_LABELS[c.i]} gilt par, today</span><br/>
              <span style="color:#d4d4d4">${fmt.n2(p)}% ${COMPARE_LABEL[compare]} · ${fmt.signed((t - p) * 100, 0, "bp")}</span>`;
          }
          return false;
        },
      },
      plotOptions: {
        series: { states: { inactive: { enabled: false } } },
        line: {
          lineWidth: 2,
          marker: { enabled: false, radius: 4, lineWidth: 2, lineColor: "#ffffff", symbol: "circle" },
          states: { hover: { lineWidthPlus: 0 } },
        },
        bubble: {
          minSize: 6,
          maxSize: 30,
          zMin: 0,
          zMax: frame.zMax,
          sizeBy: "area",
          marker: { fillOpacity: 0.55, lineWidth: 1, lineColor: "#ffffff", symbol: "circle" },
        },
      },
      series: [
        {
          type: "line",
          id: "today",
          colorIndex: 0,
          name: "Today (21 Sep)",
          legendIndex: 0,
          color: COLORS.accent,
          zIndex: 4,
          data: curve(CURVE_TODAY, "Today", true),
        },
        {
          type: "line",
          id: "compare",
          colorIndex: 1,
          name: `${COMPARE_LABEL[compare]} (${COMPARE_DATE[compare].slice(0, 6)})`,
          legendIndex: 1,
          color: COLORS.compare,
          dashStyle: "ShortDash",
          zIndex: 3,
          data: curve(past, COMPARE_LABEL[compare], false),
        },
        {
          type: "bubble",
          id: `sov:${sliceKey}`,
          colorIndex: 2,
          name: "Gilts & supras",
          legendIndex: 2,
          color: COLORS.cat1,
          zIndex: 1,
          data: bubbles(true),
        },
        {
          type: "bubble",
          id: `corp:${sliceKey}`,
          colorIndex: 3,
          name: "Corporates",
          legendIndex: 3,
          color: COLORS.cat2,
          zIndex: 2,
          data: bubbles(false),
        },
      ],
    };
  }, [holdings, past, compare, frame, tenor, sliceKey]);

  const d = (tenorYrs: number) => (at(CURVE_TODAY, tenorYrs) - at(past, tenorYrs)) * 100;
  const s2s10 = (at(CURVE_TODAY, 10) - at(CURVE_TODAY, 2)) * 100;
  const s2s10Past = (at(past, 10) - at(past, 2)) * 100;
  const s10s30 = (at(CURVE_TODAY, 30) - at(CURVE_TODAY, 10)) * 100;
  const s10s30Past = (at(past, 30) - at(past, 10)) * 100;

  const readout = [
    { label: "2Y", value: `${fmt.n2(at(CURVE_TODAY, 2))}%`, delta: d(2) },
    { label: "10Y", value: `${fmt.n2(at(CURVE_TODAY, 10))}%`, delta: d(10) },
    { label: "30Y", value: `${fmt.n2(at(CURVE_TODAY, 30))}%`, delta: d(30) },
    { label: "2s10s", value: `${fmt.n0(s2s10)}bp`, delta: s2s10 - s2s10Past },
    { label: "10s30s", value: `${fmt.n0(s10s30)}bp`, delta: s10s30 - s10s30Past },
  ];

  return (
    <Card
      title="UK gilt par curve, with holdings"
      subtitle={
        <>
          Each dot is a holding at years to maturity × yield to worst; dot area is market value. Height above the curve
          is spread.
        </>
      }
      controls={
        <Segmented
          label="Compare to"
          value={compare}
          options={COMPARE_KEYS.map((k) => ({ value: k, label: k }))}
          onChange={onCompare}
        />
      }
      view={view}
      onView={setView}
      strip={
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2">
          <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {readout.map((r) => (
              <div key={r.label} className="flex items-baseline gap-1.5">
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{r.label}</dt>
                <dd className="font-mono text-[12px] font-semibold text-neutral-900 tabular-nums">{r.value}</dd>
                <dd className="font-mono text-[11px] text-neutral-500 tabular-nums">
                  {Math.round(r.delta) === 0 ? "–" : r.delta > 0 ? "▲" : "▼"} {fmt.signed(r.delta, 0, "bp")}
                </dd>
              </div>
            ))}
            <div className="text-[10px] text-neutral-400">vs {COMPARE_LABEL[compare]}</div>
          </dl>
          <div className="text-[11px] text-neutral-500">{note}</div>
        </div>
      }
    >
      {view === "chart" ? (
        <>
          <HighchartsView options={options} height={360} />
          {holdings.length === 0 && <EmptyOverlay>No holdings in this slice. The curve is still shown.</EmptyOverlay>}
        </>
      ) : (
        <TwinTable
          narrow
          caption={`UK gilt par curve today and ${COMPARE_LABEL[compare]}`}
          head={["Tenor", "Today", COMPARE_LABEL[compare], "Change"]}
          height={360}
          rows={CURVE_TENORS.map((_, i) => ({
            key: CURVE_LABELS[i],
            cells: [
              `${fmt.n2(CURVE_TODAY[i])}%`,
              `${fmt.n2(past[i])}%`,
              fmt.signed((CURVE_TODAY[i] - past[i]) * 100, 0, "bp"),
            ],
          }))}
        />
      )}
    </Card>
  );
}

/* ================================================================== */
/*  1. Key-rate duration, active vs benchmark                          */
/* ================================================================== */

type KrdRow = ReturnType<typeof keyRateRows>[number];

export function KeyRateCard({
  rows,
  selected,
  onSelect,
  scope,
  sliceKey,
}: {
  rows: KrdRow[];
  selected: TenorBucket | null;
  onSelect: (t: TenorBucket) => void;
  scope: string | null;
  sliceKey: string;
}) {
  const [view, setView] = useState<View>("chart");
  const keys = useMemo(() => rows.map((r) => r.key), [rows]);
  const empty = rows.every((r) => r.port === 0 && r.bench === 0);

  const options = useMemo<Options>(() => {
    const vals = rows.map((r) => r.active);
    const hi = Math.max(0.05, ...vals);
    const lo = Math.min(-0.05, ...vals);
    const pad = (hi - lo) * 0.2;
    const click = categoryClick(keys, onSelect);
    return {
      chart: { type: "column", events: { click } },
      xAxis: {
        categories: [...keys],
        lineWidth: 0,
        tickLength: 0,
        labels: categoryLabels(selected),
        plotBands: selectedBand(keys, selected),
      },
      yAxis: {
        min: lo - pad,
        max: hi + pad,
        startOnTick: false,
        endOnTick: false,
        tickInterval: hi - lo > 1.2 ? 0.5 : 0.25,
        title: { text: undefined },
        labels: {
          formatter(this: { value: string | number }) {
            const v = Number(this.value);
            return Math.abs(v) < 1e-9 ? "0" : fmt.signed(v, 2);
          },
        },
        // zIndex 5: above the series group (3) and below data labels (6). A tie
        // at 3 lets DOM insertion order decide, which flips once series are rebuilt.
        plotLines: [{ value: 0, color: "#a3a3a3", width: 1, zIndex: 5 }],
      },
      legend: { enabled: false },
      tooltip: {
        formatter(this: Point) {
          const r = rows[this.index];
          return `<b>${fmt.signed(r.active, 2, " yrs")}</b> <span style="color:#a3a3a3">active · ${r.key}</span><br/>
            <span style="color:#d4d4d4">Portfolio ${fmt.n2(r.port)} · Benchmark ${fmt.n2(r.bench)}</span>`;
        },
      },
      plotOptions: {
        series: { states: { inactive: { enabled: false } } },
        column: {
          maxPointWidth: 24,
          cursor: "pointer",
          point: {
            events: {
              click(this: Point) {
                onSelect(keys[this.index]);
              },
            },
          },
          dataLabels: {
            enabled: true,
            crop: false,
            overflow: "allow",
            style: { color: COLORS.ink2 },
            formatter(this: Point) {
              return Math.abs(this.y ?? 0) < 0.005 ? "" : fmt.signed(this.y ?? 0, 2);
            },
          },
        },
      },
      series: [
        {
          type: "column",
          id: `krd:${sliceKey}`,
          colorIndex: 0,
          animation: false,
          name: "Active duration contribution",
          data: rows.map((r) => {
            const dimmed = selected !== null && selected !== r.key;
            const base = r.active >= 0 ? COLORS.over : COLORS.under;
            return { y: r.active, color: dimmed ? alpha(base, 0.28) : base };
          }),
        },
      ],
    };
  }, [rows, keys, selected, onSelect, sliceKey]);

  const tot = rows.reduce((a, r) => ({ port: a.port + r.port, bench: a.bench + r.bench }), { port: 0, bench: 0 });

  return (
    <Card
      title="Key-rate duration, active"
      subtitle={
        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span>Duration contribution vs index, yrs</span>
          <Key color={COLORS.over}>Longer</Key>
          <Key color={COLORS.under}>Shorter</Key>
        </span>
      }
      view={view}
      onView={setView}
      footer={<ScopeFooter scope={scope} dim="tenor bucket" />}
    >
      {view === "chart" ? (
        <>
          <HighchartsView options={options} height={ANALYSIS_HEIGHT} />
          {empty && <EmptyOverlay>No duration in this slice</EmptyOverlay>}
        </>
      ) : (
        <TwinTable
          caption="Contribution to duration by tenor bucket, portfolio vs benchmark"
          head={["Tenor", "Portfolio", "Bench", "Active"]}
          height={ANALYSIS_HEIGHT}
          rows={rows.map((r) => ({
            key: r.key,
            selected: selected === r.key,
            onToggle: () => onSelect(r.key),
            cells: [fmt.n2(r.port), fmt.n2(r.bench), fmt.signed(r.active, 2)],
          }))}
          foot={[fmt.n2(tot.port), fmt.n2(tot.bench), fmt.signed(tot.port - tot.bench, 2)]}
        />
      )}
    </Card>
  );
}

function ScopeFooter({ scope, dim }: { scope: string | null; dim: string }) {
  return (
    <span className="flex flex-wrap items-center justify-between gap-x-3">
      <span>Click a {dim} to cross-filter; click again to clear.</span>
      {scope && <span className="font-medium text-neutral-600">Within {scope}</span>}
    </span>
  );
}

/* ================================================================== */
/*  2. Credit quality                                                  */
/* ================================================================== */

type CreditRow = ReturnType<typeof creditRows>[number];

export function CreditCard({
  rows,
  selected,
  onSelect,
  scope,
  sliceKey,
}: {
  rows: CreditRow[];
  selected: RatingBucket | null;
  onSelect: (r: RatingBucket) => void;
  scope: string | null;
  sliceKey: string;
}) {
  const [view, setView] = useState<View>("chart");
  const keys = useMemo(() => rows.map((r) => r.key), [rows]);
  const empty = rows.every((r) => r.port === 0 && r.bench === 0);

  const options = useMemo<Options>(() => {
    const click = categoryClick(keys, onSelect);
    const max = Math.max(1, ...rows.map((r) => Math.max(r.port, r.bench)));
    const paint = (color: string, key: RatingBucket) =>
      selected !== null && selected !== key ? alpha(color, 0.28) : color;
    return {
      chart: { type: "column", events: { click } },
      xAxis: {
        categories: [...keys],
        lineWidth: 0,
        tickLength: 0,
        labels: categoryLabels(selected),
        plotBands: selectedBand(keys, selected),
      },
      yAxis: {
        min: 0,
        max: max * 1.08,
        endOnTick: false,
        title: { text: undefined },
        labels: {
          formatter(this: { value: string | number }) {
            return `${fmt.n0(Number(this.value))}%`;
          },
        },
      },
      legend: { enabled: true, align: "right", verticalAlign: "top", itemDistance: 12, margin: 4 },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const r = rows[this.index];
          return `<b>${fmt.pct1(r.port)}</b> <span style="color:#a3a3a3">portfolio · ${r.key}</span><br/>
            <span style="color:#d4d4d4">Benchmark ${fmt.pct1(r.bench)} · active ${fmt.signed(r.port - r.bench, 1, "pp")}</span>`;
        },
      },
      plotOptions: {
        series: { states: { inactive: { enabled: false } } },
        column: {
          maxPointWidth: 24,
          groupPadding: 0.16,
          pointPadding: 0.04,
          cursor: "pointer",
          point: {
            events: {
              click(this: Point) {
                onSelect(keys[this.index]);
              },
            },
          },
        },
      },
      series: [
        {
          type: "column",
          id: `port:${sliceKey}`,
          colorIndex: 0,
          animation: false,
          name: "Portfolio",
          color: COLORS.cat1,
          data: rows.map((r) => ({ y: r.port, color: paint(COLORS.cat1, r.key) })),
        },
        {
          type: "column",
          id: `bench:${sliceKey}`,
          colorIndex: 1,
          animation: false,
          name: "Benchmark",
          color: COLORS.cat2,
          data: rows.map((r) => ({ y: r.bench, color: paint(COLORS.cat2, r.key) })),
        },
      ],
    };
  }, [rows, keys, selected, onSelect, sliceKey]);

  const tot = rows.reduce((a, r) => ({ port: a.port + r.port, bench: a.bench + r.bench }), { port: 0, bench: 0 });

  return (
    <Card
      title="Credit quality"
      subtitle="Market value by rating, % of NAV vs % of index"
      view={view}
      onView={setView}
      footer={<ScopeFooter scope={scope} dim="rating" />}
    >
      {view === "chart" ? (
        <>
          <HighchartsView options={options} height={ANALYSIS_HEIGHT} />
          {empty && <EmptyOverlay>No exposure in this slice</EmptyOverlay>}
        </>
      ) : (
        <TwinTable
          caption="Rating distribution, portfolio vs benchmark"
          head={["Rating", "Portfolio", "Bench", "Active"]}
          height={ANALYSIS_HEIGHT}
          rows={rows.map((r) => ({
            key: r.key,
            selected: selected === r.key,
            onToggle: () => onSelect(r.key),
            cells: [fmt.pct1(r.port), fmt.pct1(r.bench), fmt.signed(r.port - r.bench, 1, "pp")],
          }))}
          foot={[fmt.pct1(tot.port), fmt.pct1(tot.bench), fmt.signed(tot.port - tot.bench, 1, "pp")]}
        />
      )}
    </Card>
  );
}

/* ================================================================== */
/*  3. Spread duration contribution by sector                          */
/* ================================================================== */

type SectorRow = ReturnType<typeof sectorRows>[number];

export function SectorCard({
  rows,
  selected,
  onSelect,
  scope,
  sliceKey,
}: {
  rows: SectorRow[];
  selected: Sector | null;
  onSelect: (s: Sector) => void;
  scope: string | null;
  sliceKey: string;
}) {
  const [view, setView] = useState<View>("chart");
  // Sectors neither held nor in the index (e.g. utilities in the gilt fund) are left out.
  const shown = useMemo(() => rows.filter((r) => r.held || r.indexed), [rows]);
  const keys = useMemo(() => shown.map((r) => r.key), [shown]);
  const empty = shown.every((r) => r.port === 0 && r.bench === 0);

  const options = useMemo<Options>(() => {
    const click = categoryClick(keys, onSelect);
    const max = Math.max(0.1, ...shown.map((r) => Math.max(r.port, r.bench)));
    return {
      chart: { type: "bullet", inverted: true, events: { click }, spacing: [8, 8, 4, 4] },
      xAxis: {
        categories: [...keys],
        lineWidth: 0,
        tickLength: 0,
        labels: categoryLabels(selected),
        plotBands: selectedBand(keys, selected),
      },
      yAxis: {
        min: 0,
        max: max * 1.2,
        endOnTick: false,
        tickInterval: max > 1.2 ? 0.5 : max > 0.5 ? 0.25 : 0.1,
        gridLineWidth: 1,
        title: { text: undefined },
        labels: {
          formatter(this: { value: string | number }) {
            return String(Number(Number(this.value).toFixed(2)));
          },
        },
      },
      legend: { enabled: false },
      tooltip: {
        formatter(this: Point) {
          const r = shown[this.index];
          return `<b>${fmt.n2(r.port)} yrs</b> <span style="color:#a3a3a3">spread duration · ${r.key}</span><br/>
            <span style="color:#d4d4d4">Benchmark ${fmt.n2(r.bench)} · active ${fmt.signed(r.port - r.bench, 2)}</span>`;
        },
      },
      plotOptions: {
        series: { states: { inactive: { enabled: false } } },
        bullet: {
          borderWidth: 0,
          borderRadius: 0,
          maxPointWidth: 14,
          pointPadding: 0.18,
          groupPadding: 0.08,
          cursor: "pointer",
          targetOptions: { width: "170%", height: 3, borderWidth: 0 },
          point: {
            events: {
              click(this: Point) {
                onSelect(keys[this.index]);
              },
            },
          },
        },
      },
      series: [
        {
          type: "bullet",
          id: `sprdur:${sliceKey}`,
          colorIndex: 0,
          animation: false,
          name: "Portfolio",
          color: COLORS.cat1,
          data: shown.map((r) => {
            const dimmed = selected !== null && selected !== r.key;
            return {
              y: r.port,
              target: r.bench,
              color: dimmed ? alpha(COLORS.cat1, 0.28) : COLORS.cat1,
              targetOptions: { color: dimmed ? "#d4d4d4" : COLORS.ink },
            };
          }),
        },
        {
          // Value labels sit past whichever is further out, the bar or the benchmark tick.
          type: "scatter",
          id: `labels:${sliceKey}`,
          colorIndex: 1,
          animation: false,
          name: "Values",
          enableMouseTracking: false,
          showInLegend: false,
          marker: { enabled: false },
          data: shown.map((r, i) => ({ x: i, y: Math.max(r.port, r.bench), custom: { v: r.port } })),
          dataLabels: {
            enabled: true,
            align: "left",
            verticalAlign: "middle",
            x: 6,
            crop: false,
            overflow: "allow",
            style: { color: COLORS.ink2 },
            formatter(this: Point) {
              const v = (this.options.custom as { v: number }).v;
              return fmt.n2(v);
            },
          },
        },
      ],
    };
  }, [shown, keys, selected, onSelect, sliceKey]);

  const tot = shown.reduce((a, r) => ({ port: a.port + r.port, bench: a.bench + r.bench }), { port: 0, bench: 0 });

  return (
    <Card
      title="Spread duration by sector"
      subtitle={
        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span>Contribution (yrs)</span>
          <Key color={COLORS.cat1}>Portfolio</Key>
          <Key color={COLORS.ink} line="tick">
            Benchmark
          </Key>
        </span>
      }
      view={view}
      onView={setView}
      footer={<ScopeFooter scope={scope} dim="sector" />}
    >
      {view === "chart" ? (
        <>
          <HighchartsView options={options} height={ANALYSIS_HEIGHT} />
          {empty && <EmptyOverlay>No spread duration in this slice</EmptyOverlay>}
        </>
      ) : (
        <TwinTable
          caption="Spread duration contribution by sector, portfolio vs benchmark"
          head={["Sector", "Portfolio", "Bench", "Active"]}
          height={ANALYSIS_HEIGHT}
          rows={shown.map((r) => ({
            key: r.key,
            selected: selected === r.key,
            onToggle: () => onSelect(r.key),
            cells: [fmt.n2(r.port), fmt.n2(r.bench), fmt.signed(r.port - r.bench, 2)],
          }))}
          foot={[fmt.n2(tot.port), fmt.n2(tot.bench), fmt.signed(tot.port - tot.bench, 2)]}
        />
      )}
    </Card>
  );
}
