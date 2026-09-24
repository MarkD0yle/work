import { useEffect, useMemo, useRef, useState } from "react";
import type { Options, Point } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import {
  DESKS,
  isHoliday,
  type Basis,
  type Confidence,
  type DeskId,
  type ScopeView,
  type ViewDay,
} from "./model";
import {
  FOCUS,
  INK,
  MON,
  MUTED_SERIES,
  STATUS,
  dateLong,
  dateMid,
  dateShort,
  gbpM,
  monthYear,
  times,
} from "./format";
import { CardHeader, LegendItem, MicroLabel, ViewToggle, ZoneChip, type View } from "./ui";

const basisWord = (b: Basis) => (b === "hypo" ? "hypothetical" : "actual");
const r2 = (v: number) => Math.round(v * 100) / 100;

const TH = "px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase";
const TD = "px-3 py-1.5 font-mono text-[11px] tabular-nums text-neutral-800";

/** Tracks an element's content height so a chart can fill a flex cell. */
function useBoxHeight<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [h, setH] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0].contentRect.height);
      setH((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, h] as const;
}

/* ------------------------------------------------------------------ *
 * Hero timeline: P&L columns against the −VaR line (Highcharts Stock)
 * ------------------------------------------------------------------ */

export function PnlTimelineCard({
  view,
  basis,
  conf,
  scopeLabel,
}: {
  view: ScopeView;
  basis: Basis;
  conf: Confidence;
  scopeLabel: string;
}) {
  const [mode, setMode] = useState<View>("chart");
  const [boxRef, boxH] = useBoxHeight<HTMLDivElement>(400);

  const options = useMemo<Options>(() => {
    const byT = new Map(view.days.map((d) => [d.t, d]));
    let lo = 0;
    let hi = 0;
    for (const d of view.days) {
      lo = Math.min(lo, d.pnl, -d.var);
      hi = Math.max(hi, d.pnl, d.var);
    }
    const span = hi - lo;
    const exc = view.days.filter((d) => d.exc);

    return {
      chart: { spacing: [4, 10, 6, 4] },
      rangeSelector: {
        selected: 4,
        inputEnabled: false,
        allButtonsEnabled: true,
        buttonSpacing: 2,
        buttonTheme: {
          fill: "none",
          r: 0,
          width: 30,
          height: 16,
          stroke: "#e5e5e5",
          "stroke-width": 1,
          style: { color: "#525252", fontSize: "10px", fontWeight: "500" },
          states: {
            hover: { fill: "#f5f5f5" },
            select: { fill: INK, style: { color: "#ffffff", fontWeight: "600" } },
          },
        },
        buttons: [
          { type: "month", count: 1, text: "1M" },
          { type: "month", count: 3, text: "3M" },
          { type: "month", count: 6, text: "6M" },
          { type: "year", count: 1, text: "1Y" },
          { type: "all", text: "All" },
        ],
        labelStyle: { display: "none" },
      },
      navigator: {
        height: 30,
        margin: 10,
        baseSeries: "negvar",
        maskFill: "rgba(23,23,23,0.06)",
        outlineColor: "#e5e5e5",
        handles: { backgroundColor: "#ffffff", borderColor: "#a3a3a3" },
        series: { type: "line", color: INK, lineWidth: 1, fillOpacity: 0 },
        xAxis: {
          gridLineColor: "#f0f0f0",
          labels: { style: { fontSize: "9px", color: "#a3a3a3", textOutline: "none", opacity: 1 } },
        },
      },
      scrollbar: { enabled: false },
      xAxis: {
        crosshair: { color: "rgba(23,23,23,0.12)", width: 1 },
        labels: { style: { color: "#737373", fontSize: "10px" } },
      },
      yAxis: {
        opposite: false,
        title: { text: undefined },
        min: lo - span * 0.24,
        max: hi + span * 0.04,
        startOnTick: false,
        endOnTick: false,
        tickAmount: 6,
        labels: {
          align: "right",
          x: -6,
          formatter() {
            return gbpM(Number(this.value)).replace(".0m", "m");
          },
        },
        plotLines: [{ id: "zero", value: 0, color: "#d4d4d4", width: 1, zIndex: 5 }],
      },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        split: false,
        formatter(this: Point) {
          const d = byT.get(Number(this.x));
          if (!d) return false;
          const flag = d.exc
            ? `<span style="display:inline-block;width:8px;height:8px;background:${STATUS.bad};margin-right:4px"></span>Exception`
            : d.near
              ? `<span style="display:inline-block;width:8px;height:8px;background:${STATUS.warn};margin-right:4px"></span>Near miss`
              : "Inside VaR";
          return `<div style="font-size:10px;color:#a3a3a3;margin-bottom:3px">${dateLong(d.t)}</div>
            <div><b style="font-size:13px">${gbpM(d.pnl)}</b> <span style="color:#d4d4d4">${basisWord(basis)} P&amp;L</span></div>
            <div style="margin-top:2px"><b>${gbpM(-d.var)}</b> <span style="color:#d4d4d4">−VaR ${conf}%</span></div>
            <div style="margin-top:4px;color:#e5e5e5">${times(d.ratio)} VaR · ${flag}</div>`;
        },
      },
      plotOptions: {
        series: {
          dataGrouping: { enabled: false },
          states: { inactive: { opacity: 1 } },
          animation: false,
        },
        column: { pointPadding: 0.08, groupPadding: 0, borderWidth: 0, maxPointWidth: 8 },
      },
      series: [
        {
          type: "column",
          id: "pnl",
          name: `Daily ${basisWord(basis)} P&L`,
          turboThreshold: 0,
          data: view.days.map((d) => ({
            x: d.t,
            y: r2(d.pnl),
            color: d.exc ? STATUS.bad : MUTED_SERIES,
          })),
        },
        {
          type: "line",
          id: "negvar",
          name: `−VaR ${conf}%`,
          color: INK,
          lineWidth: 2,
          marker: { enabled: false },
          states: { hover: { lineWidthPlus: 0 } },
          zIndex: 4,
          data: view.days.map((d) => [d.t, r2(-d.var)]),
        },
        {
          type: "line",
          id: "posvar",
          name: `+VaR ${conf}% (mirror)`,
          color: "#d4d4d4",
          lineWidth: 1,
          marker: { enabled: false },
          enableMouseTracking: false,
          zIndex: 2,
          data: view.days.map((d) => [d.t, r2(d.var)]),
        },
        {
          type: "flags",
          name: "Exceptions",
          shape: "squarepin",
          y: -22,
          stackDistance: 15,
          color: STATUS.bad,
          fillColor: "#ffffff",
          lineWidth: 1,
          zIndex: 5,
          style: { fontSize: "9px", fontWeight: "600", color: INK },
          states: { hover: { fillColor: "#fff1f2", lineColor: STATUS.bad } },
          data: exc.map((d) => ({
            x: d.t,
            title: dateShort(d.t),
            text: `Exception · ${gbpM(d.pnl)} vs VaR ${gbpM(d.var)}`,
          })),
        },
      ],
    };
  }, [view, basis, conf]);

  const months = useMemo(() => {
    const m = new Map<string, { t: number; days: number; varSum: number; worst: ViewDay; exc: number }>();
    for (const d of view.days) {
      const key = d.iso.slice(0, 7);
      const cur = m.get(key);
      if (!cur) m.set(key, { t: d.t, days: 1, varSum: d.var, worst: d, exc: d.exc ? 1 : 0 });
      else {
        cur.days++;
        cur.varSum += d.var;
        if (d.ratio < cur.worst.ratio) cur.worst = d;
        if (d.exc) cur.exc++;
      }
    }
    return [...m.values()].reverse();
  }, [view]);

  return (
    <section aria-labelledby="vb-timeline-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="vb-timeline-title"
        title={`Daily P&L against ${conf}% VaR`}
        sub={`${scopeLabel} · ${basisWord(basis)} P&L against prior-day 1-day VaR · ${view.days.length} business days to ${dateMid(view.days[view.days.length - 1].t)}`}
        right={<ViewToggle value={mode} onChange={setMode} name="P&L timeline" />}
      />
      {mode === "chart" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
          <LegendItem color={MUTED_SERIES}>P&amp;L inside VaR</LegendItem>
          <LegendItem color={STATUS.bad}>Exception: loss beyond VaR (flagged with date)</LegendItem>
          <LegendItem color={INK} line>
            −VaR {conf}%
          </LegendItem>
          <LegendItem color="#d4d4d4" line>
            +VaR mirror
          </LegendItem>
        </div>
      )}
      {/* Fills whatever height the row gives it (the traffic-light panel
          sets the row height at xl), with a floor for stacked layouts. */}
      <div ref={boxRef} className="relative min-h-[400px] min-w-0 flex-1">
        <div className="absolute inset-0 overflow-auto">
          {mode === "chart" ? (
            <div className="px-1 pt-1 pb-2">
              <HighchartsView options={options} constructorType="stockChart" height={Math.max(380, boxH - 12)} />
            </div>
          ) : (
            <table className="w-full text-left">
              <caption className="sr-only">Monthly summary of P&amp;L against VaR</caption>
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
                <tr>
                  <th scope="col" className={TH}>Month</th>
                  <th scope="col" className={`${TH} text-right`}>Days</th>
                  <th scope="col" className={`${TH} text-right`}>Avg VaR</th>
                  <th scope="col" className={`${TH} text-right`}>Worst P&amp;L</th>
                  <th scope="col" className={`${TH} text-right`}>Worst ÷ VaR</th>
                  <th scope="col" className={`${TH} text-right`}>Exceptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {months.map((m) => (
                  <tr key={m.t}>
                    <th scope="row" className="px-3 py-1.5 text-[11px] font-medium text-neutral-800">
                      {MON[new Date(m.t).getUTCMonth()]} {new Date(m.t).getUTCFullYear()}
                    </th>
                    <td className={`${TD} text-right`}>{m.days}</td>
                    <td className={`${TD} text-right`}>{gbpM(m.varSum / m.days)}</td>
                    <td className={`${TD} text-right`}>{gbpM(m.worst.pnl)}</td>
                    <td className={`${TD} text-right`}>{times(m.worst.ratio)}</td>
                    <td className={`${TD} text-right ${m.exc ? "font-semibold text-neutral-950" : "text-neutral-400"}`}>
                      {m.exc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Desk small multiples
 * ------------------------------------------------------------------ */

function MiniChart({ view }: { view: ScopeView }) {
  const n = view.days.length;
  const maxVar = Math.max(...view.days.map((d) => d.var));
  const top = maxVar * 1.25;
  const bottom = -maxVar * 1.75;
  const y = (v: number) => (100 * (top - Math.min(top, Math.max(bottom, v)))) / (top - bottom);
  const y0 = y(0);
  const varPath = view.days.map((d, i) => `${i === 0 ? "M" : "L"}${i + 0.5},${y(-d.var).toFixed(2)}`).join("");
  return (
    <svg
      viewBox={`0 0 ${n} 100`}
      preserveAspectRatio="none"
      className="block h-16 w-full"
      aria-hidden
    >
      <line x1={0} x2={n} y1={y0} y2={y0} stroke="#e5e5e5" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {view.days.map((d, i) => {
        if (d.exc) return null;
        const yy = y(d.pnl);
        return (
          <rect
            key={d.t}
            x={i + 0.1}
            width={0.8}
            y={Math.min(yy, y0)}
            height={Math.max(0.4, Math.abs(yy - y0))}
            fill={MUTED_SERIES}
          />
        );
      })}
      <path d={varPath} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {view.days.map((d, i) => {
        if (!d.exc) return null;
        const yy = y(d.pnl);
        const w = Math.max(1.6, n / 160);
        return (
          <rect key={d.t} x={i + 0.5 - w / 2} width={w} y={y0} height={yy - y0} fill={STATUS.bad} />
        );
      })}
    </svg>
  );
}

export function DeskMultiples({
  views,
  selected,
  onSelect,
}: {
  views: Record<DeskId, ScopeView>;
  selected: DeskId | null;
  onSelect: (d: DeskId) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {DESKS.map((desk) => {
        const v = views[desk.id];
        const on = selected === desk.id;
        const first = v.days[0].t;
        const last = v.days[v.days.length - 1];
        return (
          <li key={desk.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(desk.id)}
              aria-label={`${desk.label}: ${v.exceptions} exceptions, ${v.zone} zone. ${on ? "Selected; click to return to firm-wide" : "Click to focus the page on this desk"}`}
              className={`group flex w-full flex-col border bg-white p-3 text-left transition ${FOCUS} ${
                on
                  ? "border-neutral-900 shadow-[0_0_0_1px_#171717]"
                  : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-neutral-900">{desk.label}</span>
                <ZoneChip zone={v.zone} size="sm" />
              </span>
              <span className="mt-1 flex w-full items-baseline gap-1.5">
                <span className="text-xl leading-none font-semibold text-neutral-950">{v.exceptions}</span>
                <span className="text-[11px] text-neutral-500">exception{v.exceptions === 1 ? "" : "s"}</span>
                <span className="ml-auto font-mono text-[10px] text-neutral-500 tabular-nums">
                  VaR {gbpM(last.var)}
                </span>
              </span>
              <span className="mt-2 block w-full">
                <MiniChart view={v} />
              </span>
              <span className="mt-1 flex w-full justify-between font-mono text-[9px] text-neutral-400 tabular-nums">
                <span>{monthYear(first)}</span>
                <span>{monthYear(last.t)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * P&L ÷ VaR distribution
 * ------------------------------------------------------------------ */

const BIN_W = 0.1;
const BIN_LO = -2.0;
const BIN_N = 36; // −2.0 … +1.6

export function DistributionCard({
  view,
  basis,
  conf,
  tailP,
}: {
  view: ScopeView;
  basis: Basis;
  conf: Confidence;
  tailP: number;
}) {
  const [mode, setMode] = useState<View>("chart");

  const { bins, es } = useMemo(() => {
    const counts = new Array<number>(BIN_N).fill(0);
    for (const d of view.days) {
      const i = Math.min(BIN_N - 1, Math.max(0, Math.floor((d.ratio - BIN_LO) / BIN_W + 1e-9)));
      counts[i]++;
    }
    const b = counts.map((c, i) => {
      const from = BIN_LO + i * BIN_W;
      const mid = from + BIN_W / 2;
      const kind = mid < -1 ? "exc" : mid < -0.8 ? "near" : "in";
      return { i, from, to: from + BIN_W, mid, c, kind } as const;
    });
    const k = Math.max(1, Math.ceil(view.days.length * tailP));
    const worst = view.days.map((d) => d.ratio).sort((a, c) => a - c).slice(0, k);
    return { bins: b, es: worst.reduce((s, r) => s + r, 0) / k };
  }, [view, tailP]);

  const options = useMemo<Options>(() => {
    const esLeft = es < -1;
    const lbl = { fontSize: "10px", fontWeight: "600", color: INK };
    return {
      chart: { type: "column", spacing: [12, 10, 4, 4] },
      xAxis: {
        min: BIN_LO,
        max: BIN_LO + BIN_N * BIN_W,
        tickInterval: 0.5,
        labels: {
          formatter() {
            const v = Number(this.value);
            return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}×`;
          },
        },
        title: { text: `P&L ÷ ${conf}% VaR` },
        plotLines: [
          {
            value: -1,
            color: INK,
            width: 1.5,
            dashStyle: "Dash",
            zIndex: 5,
            label: {
              text: "VaR −1.00×",
              rotation: 0,
              align: "left",
              textAlign: esLeft ? "left" : "right",
              x: esLeft ? 5 : -5,
              y: 10,
              style: lbl,
            },
          },
          {
            value: es,
            color: "#737373",
            width: 1.5,
            dashStyle: "ShortDot",
            zIndex: 5,
            label: {
              text: `ES ${conf}% ${times(es)}`,
              rotation: 0,
              align: "left",
              textAlign: esLeft ? "right" : "left",
              x: esLeft ? -5 : 5,
              y: 24,
              style: { ...lbl, color: "#525252" },
            },
          },
        ],
      },
      yAxis: { title: { text: "Business days" }, allowDecimals: false, min: 0 },
      legend: { enabled: false },
      tooltip: {
        formatter(this: Point) {
          const b = bins[Number(this.index)];
          const edge = b.i === 0 ? `≤ ${times(b.to)}` : b.i === BIN_N - 1 ? `≥ ${times(b.from)}` : `${times(b.from)} to ${times(b.to)}`;
          const kind = b.kind === "exc" ? "Exception" : b.kind === "near" ? "Near miss" : "Inside VaR";
          return `<b style="font-size:13px">${b.c} day${b.c === 1 ? "" : "s"}</b><br/><span style="color:#d4d4d4">${edge} · ${kind}</span>`;
        },
      },
      plotOptions: {
        column: {
          pointPadding: 0,
          groupPadding: 0,
          pointRange: BIN_W,
          borderWidth: 1,
          borderColor: "#ffffff",
          maxPointWidth: 24,
        },
      },
      series: [
        {
          type: "column",
          name: "Business days",
          data: bins.map((b) => ({
            x: r2(b.mid),
            y: b.c,
            color: b.kind === "exc" ? STATUS.bad : b.kind === "near" ? STATUS.warn : STATUS.neutral,
          })),
        },
      ],
    };
  }, [bins, es, conf]);

  const shown = bins.filter((b) => b.c > 0);

  return (
    <section aria-labelledby="vb-dist-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="vb-dist-title"
        title="P&L ÷ VaR distribution"
        sub={`Each ${basisWord(basis)} P&L day as a multiple of that day's ${conf}% VaR · ES is the realised mean of the worst ${Math.max(1, Math.ceil(view.days.length * tailP))} days`}
        right={<ViewToggle value={mode} onChange={setMode} name="Distribution" />}
      />
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
            <LegendItem color={STATUS.neutral}>Inside VaR</LegendItem>
            <LegendItem color={STATUS.warn}>Near miss (−1.0× to −0.8×)</LegendItem>
            <LegendItem color={STATUS.bad}>Exception (beyond −1.0×)</LegendItem>
          </div>
          <div className="min-w-0 px-1 pt-1 pb-2">
            <HighchartsView options={options} height={272} />
          </div>
        </>
      ) : (
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Histogram bins of P&amp;L divided by VaR</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>P&amp;L ÷ VaR</th>
                <th scope="col" className={TH}>Band</th>
                <th scope="col" className={`${TH} text-right`}>Days</th>
                <th scope="col" className={`${TH} text-right`}>Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shown.map((b) => (
                <tr key={b.i}>
                  <th scope="row" className={`${TD} text-left font-medium`}>
                    {times(b.from)} to {times(b.to)}
                  </th>
                  <td className="px-3 py-1.5 text-[11px] text-neutral-600">
                    {b.kind === "exc" ? "Exception" : b.kind === "near" ? "Near miss" : "Inside VaR"}
                  </td>
                  <td className={`${TD} text-right`}>{b.c}</td>
                  <td className={`${TD} text-right`}>{((b.c / view.days.length) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Exception calendar (weeks × weekdays)
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const CELL = 11;
const STEP = 13;
const LEFT = 26;
const TOPPAD = 14;
const ROWS = ["Mon", "", "Wed", "", "Fri"];

type Cell =
  | { kind: "day"; t: number; r: number; d: ViewDay }
  | { kind: "holiday"; t: number; r: number };

export function ExceptionCalendar({ view, conf }: { view: ScopeView; conf: Confidence }) {
  const [hover, setHover] = useState<ViewDay | null>(null);

  const { bands, maxWeeks, stats, months } = useMemo(() => {
    const byT = new Map(view.days.map((d) => [d.t, d]));
    const first = view.days[0].t;
    const last = view.days[view.days.length - 1].t;
    const wd0 = new Date(first).getUTCDay(); // 1..5
    const monday0 = first - (wd0 - 1) * DAY_MS;
    const W = Math.floor((last - monday0) / (7 * DAY_MS)) + 1;
    const weeks: Cell[][] = [];
    for (let w = 0; w < W; w++) {
      const col: Cell[] = [];
      for (let r = 0; r < 5; r++) {
        const t = monday0 + (w * 7 + r) * DAY_MS;
        if (t < first || t > last) continue;
        const d = byT.get(t);
        if (d) col.push({ kind: "day", t, r, d });
        else if (isHoliday(t)) col.push({ kind: "holiday", t, r });
      }
      weeks.push(col);
    }
    const split = W > 60 ? Math.ceil(W / 2) : W;
    const b = split === W ? [weeks] : [weeks.slice(0, split), weeks.slice(split)];

    // stats
    let sinceLast = -1;
    let run = 0;
    let longest = 0;
    view.days.forEach((d, i) => {
      if (d.exc) {
        sinceLast = view.days.length - 1 - i;
        run = 0;
      } else {
        run++;
        longest = Math.max(longest, run);
      }
    });
    const byMonth = new Map<string, { t: number; exc: number }>();
    for (const d of view.days) {
      const k = d.iso.slice(0, 7);
      const cur = byMonth.get(k);
      if (cur) cur.exc += d.exc ? 1 : 0;
      else byMonth.set(k, { t: d.t, exc: d.exc ? 1 : 0 });
    }
    return {
      bands: b,
      maxWeeks: Math.max(...b.map((x) => x.length)),
      stats: { sinceLast, longest },
      months: [...byMonth.values()],
    };
  }, [view]);

  const vbW = LEFT + maxWeeks * STEP;
  const vbH = TOPPAD + 5 * STEP;

  return (
    <section aria-labelledby="vb-cal-title" className="flex flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="vb-cal-title"
        title="Exception calendar"
        sub={`One square per business day, ${view.days.length}-day window · near miss = loss above 80% of ${conf}% VaR`}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
        <LegendItem color={STATUS.bad}>Exception</LegendItem>
        <LegendItem color={STATUS.warn}>Near miss</LegendItem>
        <LegendItem color="#e5e5e5">Inside VaR</LegendItem>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
          <span aria-hidden className="inline-block h-2.5 w-2.5 border border-dashed border-neutral-300 bg-white" />
          UK bank holiday
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-3" onMouseLeave={() => setHover(null)}>
        {bands.map((weeks, bi) => {
          // month labels at each month's first week; a label crowded by the
          // next one (a partial first month) gives way to the full month
          const starts: { wi: number; m: number }[] = [];
          weeks.forEach((col, wi) => {
            if (!col[0]) return;
            const m = new Date(col[0].t).getUTCMonth();
            if (starts.length === 0 || starts[starts.length - 1].m !== m) starts.push({ wi, m });
          });
          const labels = new Map(
            starts
              .filter((s, i) => i === starts.length - 1 || starts[i + 1].wi - s.wi >= 3)
              .map((s) => [s.wi, MON[s.m]]),
          );
          return (
            <svg
              key={bi}
              viewBox={`0 0 ${vbW} ${vbH}`}
              className="block w-full"
              role="img"
              aria-label={`Exception calendar ${bi + 1} of ${bands.length}: ${view.exceptions} exceptions and ${view.nearMisses} near misses in the window`}
            >
              {ROWS.map((l, r) =>
                l ? (
                  <text key={l} x={LEFT - 6} y={TOPPAD + r * STEP + CELL - 2} textAnchor="end" fontSize={8} fill="#a3a3a3">
                    {l}
                  </text>
                ) : null,
              )}
              {weeks.map((col, wi) => {
                const label = labels.get(wi);
                return (
                  <g key={wi}>
                    {label && (
                      <text x={LEFT + wi * STEP} y={9} fontSize={8} fill="#737373">
                        {label}
                      </text>
                    )}
                    {col.map((c) => {
                      const x = LEFT + wi * STEP;
                      const yy = TOPPAD + c.r * STEP;
                      if (c.kind === "holiday")
                        return (
                          <rect
                            key={c.t}
                            x={x + 0.5}
                            y={yy + 0.5}
                            width={CELL - 1}
                            height={CELL - 1}
                            fill="#fff"
                            stroke="#d4d4d4"
                            strokeWidth={0.75}
                            strokeDasharray="1.5 1.5"
                          >
                            <title>{dateLong(c.t)} · UK bank holiday</title>
                          </rect>
                        );
                      const d = c.d;
                      const fill = d.exc ? STATUS.bad : d.near ? STATUS.warn : "#e5e5e5";
                      const on = hover?.t === d.t;
                      return (
                        <g key={c.t} onMouseEnter={() => setHover(d)}>
                          <rect
                            x={x}
                            y={yy}
                            width={CELL}
                            height={CELL}
                            fill={fill}
                            stroke={on ? INK : "none"}
                            strokeWidth={on ? 1.5 : 0}
                          />
                          {d.exc && <rect x={x + 4} y={yy + 4} width={3} height={3} fill="#fff" pointerEvents="none" />}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          );
        })}
      </div>
      <p aria-live="polite" className="mx-4 mt-2 min-h-[34px] border-t border-neutral-100 pt-2 text-[11px] text-neutral-600">
        {hover ? (
          <>
            <span className="font-semibold text-neutral-900">{dateLong(hover.t)}</span>
            <span className="font-mono tabular-nums">
              {" "}
              · P&amp;L {gbpM(hover.pnl)} · VaR {gbpM(hover.var)} · {times(hover.ratio)}
            </span>
            {" · "}
            <span className="font-semibold text-neutral-900">
              {hover.exc ? "Exception" : hover.near ? "Near miss" : "Inside VaR"}
            </span>
          </>
        ) : (
          <span className="text-neutral-400">Hover a day to read its P&amp;L against VaR.</span>
        )}
      </p>
      <div className="px-4 pt-1 pb-3">
        <MicroLabel>Exceptions by month</MicroLabel>
        <ol
          className="mt-1.5 grid gap-px border border-neutral-100 bg-neutral-100"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
        >
          {months.map((m) => {
            const d = new Date(m.t);
            return (
              <li
                key={m.t}
                title={`${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}: ${m.exc} exception${m.exc === 1 ? "" : "s"}`}
                className={`flex flex-col items-center py-1 ${m.exc ? "bg-rose-50" : "bg-white"}`}
              >
                <span className="text-[9px] leading-tight text-neutral-400">{MON[d.getUTCMonth()]}</span>
                <span
                  className={`font-mono text-[11px] leading-tight tabular-nums ${m.exc ? "font-semibold text-neutral-950" : "text-neutral-300"}`}
                >
                  {m.exc}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-px border-t border-neutral-200 bg-neutral-100 sm:grid-cols-4">
        {[
          { l: "Exceptions", v: String(view.exceptions) },
          { l: "Near misses", v: String(view.nearMisses) },
          {
            l: "Last exception",
            v: stats.sinceLast < 0 ? "None in window" : `${stats.sinceLast} days ago`,
          },
          { l: "Max clean run", v: `${stats.longest} days` },
        ].map((s) => (
          <div key={s.l} className="bg-white px-4 py-2.5">
            <dt>
              <MicroLabel>{s.l}</MicroLabel>
            </dt>
            <dd className="mt-0.5 text-base font-semibold text-neutral-900">{s.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

