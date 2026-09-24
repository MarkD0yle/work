import { useEffect, useMemo, useRef, useState } from "react";
import type { Options, Point } from "highcharts";
import HighchartsView from "../highcharts/HighchartsView";
import { tipHtml } from "../highcharts/tooltip";
import {
  BUYOUT_TARGET_MONTH,
  CASHFLOWS,
  CASHFLOW_FROM,
  CASHFLOW_TO,
  EVENTS,
  LD_TARGET_MONTH,
  MEMBER_CATEGORIES,
  MONTHS,
  TOTAL_MONTHS,
  cashflowBuckets,
  monthIndex,
  quarterlyRows,
  type SchemeView,
} from "./model";
import {
  CAT,
  INK,
  MEMBER_COLOR,
  MUTED_SERIES,
  STATUS,
  dateMid,
  gbpM,
  monthShort,
  monthYear,
  num,
  pct,
  pp,
  quarterLabel,
} from "./format";
import { CardHeader, Chip, LegendItem, MicroLabel, ViewToggle, type View } from "./ui";

const r1 = (v: number) => Math.round(v * 10) / 10;

const TH = "px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase";
const TD = "px-3 py-1.5 font-mono text-[11px] tabular-nums text-neutral-800";
const AXIS_LABEL = { fontSize: "10px", color: "#737373" };

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
 * 02 · Journey plan: funding level against the plan, with the fan
 * ------------------------------------------------------------------ */

export function JourneyPlanCard({ view }: { view: SchemeView }) {
  const [mode, setMode] = useState<View>("chart");
  const [boxRef, boxH] = useBoxHeight<HTMLDivElement>(460);
  const { basis } = view;

  const options = useMemo<Options>(() => {
    const byT = new Map(view.history.map((p) => [p.t, p]));
    const fanByT = new Map(view.fan.map((f) => [f.t, f]));
    const planByT = new Map(view.plan.map((p) => [p.t, p.v]));
    const last = view.current;
    const crisis = EVENTS.find((e) => e.to);
    const ldT = MONTHS[monthIndex(LD_TARGET_MONTH)].t;
    const boT = MONTHS[monthIndex(BUYOUT_TARGET_MONTH)].t;
    const values = [
      ...view.history.map((p) => p.fl),
      ...view.fan.flatMap((f) => [f.p5, f.p95]),
      ...view.plan.map((p) => p.v),
    ];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const refLabel = { fontSize: "10px", color: "#737373", fontWeight: "500" };

    return {
      chart: { spacing: [8, 12, 4, 4] },
      xAxis: {
        type: "datetime",
        min: MONTHS[0].t,
        max: MONTHS[TOTAL_MONTHS - 1].t,
        crosshair: { color: "rgba(23,23,23,0.12)", width: 1 },
        labels: { style: AXIS_LABEL },
        // The crisis months are tinted; the flag on the line names them.
        plotBands: crisis?.to
          ? [
              {
                from: MONTHS[monthIndex(crisis.key) - 1].t,
                to: MONTHS[monthIndex(crisis.to)].t,
                color: "rgba(225,29,72,0.07)",
              },
            ]
          : [],
        plotLines: [
          {
            value: last.t,
            color: INK,
            width: 1,
            zIndex: 3,
            label: {
              text: `Reporting month · ${monthYear(last.t)}`,
              rotation: 0,
              align: "right",
              x: -6,
              y: 14,
              style: { fontSize: "10px", color: "#525252", fontWeight: "600" },
            },
          },
          {
            value: ldT,
            color: "#d4d4d4",
            width: 1,
            dashStyle: "ShortDash",
            label: { text: "Low dependency · Dec 2029", rotation: 90, x: -4, y: 6, style: refLabel },
          },
          {
            value: boT,
            color: "#d4d4d4",
            width: 1,
            dashStyle: "ShortDash",
            label: { text: "Buyout · Dec 2031", rotation: 90, x: -4, y: 6, style: refLabel },
          },
        ],
      },
      yAxis: {
        title: { text: `Funding level, % of ${basis.short} liabilities` },
        min: Math.floor((lo - 3) / 5) * 5,
        max: Math.ceil((hi + 3) / 5) * 5,
        startOnTick: false,
        endOnTick: false,
        labels: { format: "{value}%" },
        plotLines: [
          {
            value: 100,
            color: "#a3a3a3",
            width: 1,
            zIndex: 2,
            label: { text: "Fully funded", align: "left", x: 6, y: -4, style: refLabel },
          },
        ],
      },
      legend: {
        enabled: true,
        align: "left",
        verticalAlign: "top",
        itemDistance: 14,
        symbolWidth: 14,
        margin: 8,
      },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const x = Number(this.x);
          const h = byT.get(x);
          const f = fanByT.get(x);
          const plan = planByT.get(x);
          const rows = [];
          if (h) {
            rows.push(
              { label: "Funding level", value: pct(h.fl), color: INK },
              { label: "Assets", value: gbpM(h.assets) },
              { label: `Liabilities · ${basis.short}`, value: gbpM(h.liabilities) },
            );
          } else if (f) {
            rows.push(
              { label: "Median projection", value: pct(f.p50), color: INK },
              { label: "25th–75th", value: `${pct(f.p25)} – ${pct(f.p75)}` },
              { label: "5th–95th", value: `${pct(f.p5)} – ${pct(f.p95)}` },
            );
          }
          if (plan !== undefined) rows.push({ label: "Journey plan", value: pct(plan), color: MUTED_SERIES });
          if (h && plan !== undefined) rows.push({ label: "vs plan", value: pp(h.fl - plan) });
          return tipHtml(monthYear(x), rows, h ? undefined : "Projection");
        },
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 1 } },
          animation: false,
        },
      },
      series: [
        {
          type: "arearange",
          name: "Projection 5th–95th",
          color: INK,
          fillOpacity: 0.06,
          lineWidth: 0,
          zIndex: 1,
          enableMouseTracking: false,
          data: view.fan.map((f) => ({ x: f.t, low: r1(f.p5), high: r1(f.p95) })),
        },
        {
          type: "arearange",
          name: "Projection 25th–75th",
          color: INK,
          fillOpacity: 0.12,
          lineWidth: 0,
          zIndex: 1,
          enableMouseTracking: false,
          data: view.fan.map((f) => ({ x: f.t, low: r1(f.p25), high: r1(f.p75) })),
        },
        {
          type: "line",
          name: "Projection median",
          color: INK,
          dashStyle: "ShortDash",
          lineWidth: 1.5,
          zIndex: 3,
          data: view.fan.map((f) => [f.t, r1(f.p50)]),
        },
        {
          type: "line",
          name: "Journey plan",
          color: MUTED_SERIES,
          lineWidth: 2,
          zIndex: 2,
          data: view.plan.map((p) => [p.t, r1(p.v)]),
        },
        {
          type: "line",
          id: "actual",
          name: "Funding level",
          color: INK,
          lineWidth: 2,
          zIndex: 4,
          data: view.history.map((p, k) =>
            k === view.history.length - 1
              ? {
                  x: p.t,
                  y: r1(p.fl),
                  marker: { enabled: true, symbol: "square", radius: 4 },
                  dataLabels: {
                    enabled: true,
                    format: pct(p.fl),
                    align: "left",
                    verticalAlign: "middle",
                    x: 8,
                    style: { fontSize: "11px", fontWeight: "600", color: INK, textOutline: "2px #ffffff" },
                  },
                }
              : [p.t, r1(p.fl)],
          ),
        },
        {
          type: "flags",
          name: "Events",
          onSeries: "actual",
          shape: "squarepin",
          y: -32,
          stackDistance: 18,
          color: INK,
          fillColor: "#ffffff",
          lineWidth: 1,
          zIndex: 5,
          showInLegend: false,
          style: { fontSize: "9px", fontWeight: "600", color: INK },
          states: { hover: { fillColor: "#f5f5f5", lineColor: INK } },
          data: EVENTS.map((e) => ({ x: MONTHS[monthIndex(e.key)].t, title: e.title, text: e.text })),
        },
      ],
    };
  }, [view, basis]);

  const rows = useMemo(() => quarterlyRows(view), [view]);
  const end = view.fan[view.fan.length - 1];

  return (
    <section
      aria-labelledby="pf-journey-title"
      className="flex h-full flex-col border border-neutral-200 bg-white"
    >
      <CardHeader
        id="pf-journey-title"
        title="Funding level against the journey plan"
        sub={`${basis.label} basis · monthly Jan 2020 to ${monthYear(view.current.t)} · lognormal projection fan to Dec 2031 (μ ${num(2.2, 1)}% p.a. over liabilities, σ ${num(4.2, 1)}%)`}
        right={<ViewToggle value={mode} onChange={setMode} name="Journey plan" />}
      />
      <div ref={boxRef} className="relative min-h-[440px] min-w-0 flex-1">
        <div className="absolute inset-0 overflow-auto">
          {mode === "chart" ? (
            <div className="px-2 pt-2 pb-1">
              <HighchartsView options={options} height={Math.max(420, boxH - 12)} />
            </div>
          ) : (
            <table className="w-full text-left">
              <caption className="sr-only">
                Quarterly funding position against the journey plan, {basis.label} basis, newest first
              </caption>
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
                <tr>
                  <th scope="col" className={TH}>Quarter-end</th>
                  <th scope="col" className={`${TH} text-right`}>Assets</th>
                  <th scope="col" className={`${TH} text-right`}>Liabilities</th>
                  <th scope="col" className={`${TH} text-right`}>Surplus</th>
                  <th scope="col" className={`${TH} text-right`}>Funding level</th>
                  <th scope="col" className={`${TH} text-right`}>Plan</th>
                  <th scope="col" className={`${TH} text-right`}>vs plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((p) => {
                  const d = p.fl - p.plan;
                  return (
                    <tr key={p.t}>
                      <th scope="row" className="px-3 py-1.5 text-[11px] font-medium text-neutral-800">
                        {dateMid(p.t)}
                        <span className="ml-1.5 text-neutral-400">{quarterLabel(p.t)}</span>
                      </th>
                      <td className={`${TD} text-right`}>{gbpM(p.assets)}</td>
                      <td className={`${TD} text-right`}>{gbpM(p.liabilities)}</td>
                      <td className={`${TD} text-right`}>{gbpM(p.surplus)}</td>
                      <td className={`${TD} text-right font-semibold text-neutral-950`}>{pct(p.fl)}</td>
                      <td className={`${TD} text-right text-neutral-500`}>{pct(p.plan)}</td>
                      <td className={`${TD} text-right ${d >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pp(d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-neutral-200 bg-neutral-100 md:grid-cols-4">
        {[
          {
            l: "Against plan today",
            v: pp(view.vsPlan),
            s: view.vsPlan >= 0 ? "ahead of the journey plan" : "behind the journey plan",
            tone: view.vsPlan >= 0 ? "text-emerald-700" : "text-rose-700",
          },
          {
            l: "Low dependency by Dec 2029",
            v: pct(view.probability.ld * 100, 0),
            s: `chance of reaching ${pct(view.journey.ldTarget, 0)} on this basis`,
          },
          {
            l: "Buyout by Dec 2031",
            v: pct(view.probability.buyout * 100, 0),
            s: `chance of reaching ${pct(view.journey.buyoutTarget, 0)} on this basis`,
          },
          {
            l: "Median at Dec 2031",
            v: pct(end.p50),
            s: `5th–95th ${pct(end.p5, 0)} to ${pct(end.p95, 0)}`,
          },
        ].map((s) => (
          <div key={s.l} className="bg-white px-4 py-2.5 lg:px-5">
            <dt>
              <MicroLabel>{s.l}</MicroLabel>
            </dt>
            <dd className={`mt-0.5 text-lg leading-tight font-semibold ${s.tone ?? "text-neutral-900"}`}>{s.v}</dd>
            <dd className="text-[11px] text-neutral-500">{s.s}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 03 · Hedge ratios: two solid gauges against the 85–95% band
 * ------------------------------------------------------------------ */

const GAUGE_MIN = 50;
const GAUGE_MAX = 110;

function Gauge({
  value,
  label,
  band,
  height,
}: {
  value: number;
  label: string;
  band: { lo: number; hi: number };
  height: number;
}) {
  const inBand = value >= band.lo && value <= band.hi;
  const color = inBand ? STATUS.good : STATUS.warn;
  const options = useMemo<Options>(
    () => ({
      chart: { type: "solidgauge", spacing: [6, 0, 0, 0], animation: { duration: 400 } },
      tooltip: { enabled: false },
      accessibility: {
        description: `${label} ${value.toFixed(1)}% against a target band of ${band.lo} to ${band.hi}%.`,
      },
      pane: {
        center: ["50%", "92%"],
        size: "150%",
        startAngle: -90,
        endAngle: 90,
        background: [
          { backgroundColor: "#f5f5f5", borderWidth: 0, innerRadius: "70%", outerRadius: "100%", shape: "arc" },
        ],
      },
      yAxis: {
        min: GAUGE_MIN,
        max: GAUGE_MAX,
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        tickPositions: [GAUGE_MIN, 70, band.lo, band.hi, GAUGE_MAX],
        labels: {
          distance: 12,
          format: "{value}%",
          style: { fontSize: "10px", color: "#737373", fontFamily: "ui-monospace, Menlo, monospace" },
        },
        stops: [
          [0, color],
          [1, color],
        ],
        plotBands: [
          // The target band sits under the dial; the 100% mark is a tick over it.
          { from: band.lo, to: band.hi, color: "#d1fae5", innerRadius: "70%", outerRadius: "100%" },
          { from: 99.6, to: 100.4, color: INK, innerRadius: "64%", outerRadius: "106%", zIndex: 5 },
        ],
      },
      plotOptions: {
        solidgauge: { rounded: false, dataLabels: { enabled: false }, enableMouseTracking: false },
      },
      series: [
        {
          type: "solidgauge",
          name: label,
          data: [{ y: Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value)), radius: "94%", innerRadius: "76%" }],
        },
      ],
    }),
    [value, label, band, color],
  );

  return (
    <div className="flex min-w-0 flex-col items-center">
      <MicroLabel>{label}</MicroLabel>
      <div className="relative mt-1 w-full" style={{ height }}>
        <HighchartsView options={options} height={height} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-[40px] leading-none font-semibold tracking-tight text-neutral-950">{pct(value)}</span>
        </div>
      </div>
      <div className="mt-2">
        <Chip tone={inBand ? "good" : "warn"}>
          {inBand ? "In target band" : value < band.lo ? "Below target band" : "Above target band"}
        </Chip>
      </div>
    </div>
  );
}

export function HedgeCard({ view }: { view: SchemeView }) {
  const [mode, setMode] = useState<View>("chart");
  const { hedge, basis } = view;
  const rows = [
    { label: "Interest-rate hedge ratio", value: hedge.rate, pv01: hedge.hedgePv01 },
    { label: "Inflation hedge ratio", value: hedge.infl, pv01: (hedge.hedgePv01 * hedge.infl) / hedge.rate },
  ];
  const inBand = (v: number) => v >= hedge.band.lo && v <= hedge.band.hi;

  return (
    <section aria-labelledby="pf-hedge-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="pf-hedge-title"
        title="Hedge ratios"
        sub={`PV01 of the hedge over PV01 of the ${basis.short} liabilities · target band ${hedge.band.lo}–${hedge.band.hi}%, set on TP`}
        right={<ViewToggle value={mode} onChange={setMode} name="Hedge ratios" />}
      />
      {mode === "chart" ? (
        <div className="grid flex-1 grid-cols-2 gap-4 px-4 pt-4 pb-2 lg:px-5" style={{ alignContent: "center" }}>
          {rows.map((r) => (
            <Gauge key={r.label} value={r.value} label={r.label} band={hedge.band} height={150} />
          ))}
        </div>
      ) : (
        <table className="w-full text-left">
          <caption className="sr-only">Hedge ratios and PV01s on the {basis.label} basis</caption>
          <thead className="border-b border-neutral-200">
            <tr>
              <th scope="col" className={TH}>Measure</th>
              <th scope="col" className={`${TH} text-right`}>Ratio</th>
              <th scope="col" className={`${TH} text-right`}>Hedge PV01</th>
              <th scope="col" className={TH}>Band</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="px-3 py-2 text-[11px] font-medium text-neutral-800">{r.label}</th>
                <td className={`${TD} text-right font-semibold text-neutral-950`}>{pct(r.value)}</td>
                <td className={`${TD} text-right`}>£{num(r.pv01, 2)}m/bp</td>
                <td className="px-3 py-2">
                  <Chip tone={inBand(r.value) ? "good" : "warn"} size="sm">
                    {inBand(r.value) ? "In band" : "Outside band"}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <HedgeHistory view={view} />
      <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
        <Row label={`Liability PV01 · ${basis.short}`} sub="Value change per 1bp fall in yields" value={`£${num(hedge.liabPv01, 2)}m`} />
        <Row label="Hedge PV01" sub="LDI gilts, repo and swaps" value={`£${num(hedge.hedgePv01, 2)}m`} />
        <Row
          label="Hedge after a full deleveraging"
          sub="What credit collateral alone supports at the 250bp minimum"
          value={pct(hedge.afterCut, 0)}
        />
      </dl>
    </section>
  );
}

/* Hedge ratios since 2020 as a bespoke sparkline: the 2022 cut and the
 * step-up as the deficit closed, against the target band. */
const HH_H = 64;
const HH_MIN = 40;
const HH_MAX = 110;
const INFL_LINE = CAT[0];

function HedgeHistory({ view }: { view: SchemeView }) {
  const series = view.hedgeHistory;
  const { band } = view.hedge;
  const n = series.length;
  const y = (v: number) => HH_H - ((Math.min(HH_MAX, Math.max(HH_MIN, v)) - HH_MIN) / (HH_MAX - HH_MIN)) * HH_H;
  const line = (pick: (p: (typeof series)[number]) => number) =>
    `M${series.map((p, i) => `${i + 0.5},${y(pick(p)).toFixed(2)}`).join("L")}`;
  const lowest = series.reduce((best, p) => (p.rate < best.rate ? p : best), series[0]);
  const last = series[n - 1];

  return (
    <figure className="border-t border-neutral-100 px-4 pt-3 pb-3 lg:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <MicroLabel>Hedge ratios since 2020 · {view.basis.short}</MicroLabel>
        <div className="flex gap-3">
          <LegendItem color={INK} line>Interest rate</LegendItem>
          <LegendItem color={INFL_LINE} line>Inflation</LegendItem>
          <LegendItem color="#d1fae5">Target band</LegendItem>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${n} ${HH_H}`}
        preserveAspectRatio="none"
        className="mt-2 block w-full"
        style={{ height: HH_H }}
        role="img"
        aria-label={`Interest-rate hedge ratio each month since January 2020 on the ${view.basis.label} basis: ${pct(series[0].rate, 0)} at the start, a low of ${pct(lowest.rate, 0)} in ${monthYear(lowest.t)}, ${pct(last.rate, 0)} at ${monthYear(last.t)}; inflation hedge ${pct(last.infl, 0)}.`}
      >
        <rect x={0} y={y(band.hi)} width={n} height={y(band.lo) - y(band.hi)} fill="#d1fae5" />
        <line x1={0} x2={n} y1={y(100)} y2={y(100)} stroke="#d4d4d4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={line((p) => p.infl)} fill="none" stroke={INFL_LINE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={line((p) => p.rate)} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-neutral-400 tabular-nums">
        <span>{monthShort(series[0].t)}</span>
        <span>
          {pct(HH_MIN, 0)} – {pct(HH_MAX, 0)}
        </span>
        <span>{monthShort(last.t)}</span>
      </div>
      <figcaption className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">
        Cut to <span className="font-mono font-semibold text-neutral-800 tabular-nums">{pct(lowest.rate, 0)}</span> in {monthYear(lowest.t)} when
        collateral ran short, then stepped up as the deficit closed.
      </figcaption>
    </figure>
  );
}

function Row({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 lg:px-5">
      <dt className="min-w-0">
        <span className="block text-[11px] font-medium text-neutral-700">{label}</span>
        <span className="mt-0.5 block truncate text-[10px] text-neutral-500">{sub}</span>
      </dt>
      <dd className="shrink-0 font-mono text-sm font-semibold text-neutral-900 tabular-nums">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 04a · Actual vs strategic allocation (dumbbell with tolerance range)
 * ------------------------------------------------------------------ */

const STRATEGIC_MARK = "#a3a3a3";
const TOLERANCE_FILL = "#ececec";

export function AllocationCard({ view }: { view: SchemeView }) {
  const [mode, setMode] = useState<View>("chart");
  const rows = view.allocation;

  const options = useMemo<Options>(() => {
    const hi = Math.max(...rows.map((r) => Math.max(r.actual, r.strategic + r.tol)));
    return {
      chart: { type: "dumbbell", inverted: true, spacing: [8, 12, 4, 4] },
      legend: { enabled: false },
      xAxis: {
        categories: rows.map((r) => r.label),
        lineWidth: 0,
        tickLength: 0,
        gridLineWidth: 1,
        gridLineColor: "#f5f5f5",
        labels: { style: { fontSize: "11px", color: "#525252" } },
      },
      yAxis: {
        title: { text: "% of investable assets" },
        min: 0,
        max: Math.ceil((hi + 2) / 5) * 5,
        tickInterval: 5,
        labels: { format: "{value}%" },
      },
      tooltip: {
        formatter(this: Point) {
          const r = rows[this.index];
          return tipHtml(
            r.label,
            [
              { label: "Actual", value: `${pct(r.actual)} · ${gbpM(r.value)}`, color: r.inRange ? INK : STATUS.warn },
              { label: "Strategic", value: pct(r.strategic), color: STRATEGIC_MARK },
              { label: "Tolerance", value: `±${num(r.tol)}pp` },
              { label: "Deviation", value: pp(r.deviation) },
            ],
            r.inRange ? "Within tolerance" : "Outside tolerance",
          );
        },
      },
      plotOptions: {
        columnrange: {
          grouping: false,
          pointWidth: 18,
          borderWidth: 0,
          color: TOLERANCE_FILL,
          enableMouseTracking: false,
          zIndex: 0,
        },
        dumbbell: {
          connectorWidth: 3,
          groupPadding: 0,
          pointPadding: 0,
          marker: { symbol: "square", radius: 5, lineWidth: 2, lineColor: "#ffffff" },
          lowMarker: { symbol: "square" },
          dataLabels: { enabled: false },
          states: { hover: { halo: { size: 0 } } },
          zIndex: 2,
        },
      },
      series: [
        {
          type: "columnrange",
          name: "Tolerance range",
          data: rows.map((r) => ({ low: r.strategic - r.tol, high: r.strategic + r.tol })),
        },
        {
          type: "dumbbell",
          name: "Actual vs strategic",
          data: rows.map((r) => {
            const c = r.inRange ? INK : STATUS.warn;
            // The actual weight is always the coloured end; strategic is the grey one.
            return r.actual >= r.strategic
              ? { low: r.strategic, high: r.actual, lowColor: STRATEGIC_MARK, color: c, connectorColor: c }
              : { low: r.actual, high: r.strategic, lowColor: c, color: STRATEGIC_MARK, connectorColor: c };
          }),
        },
      ],
    };
  }, [rows]);

  const outside = rows.filter((r) => !r.inRange);

  return (
    <section aria-labelledby="pf-alloc-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="pf-alloc-title"
        title="Actual against strategic allocation"
        sub={`Investable assets ${gbpM(view.investable)} at ${dateMid(view.current.t)}, excluding the ${gbpM(view.buyin)} buy-in policy · strategic weights on the de-risking glide path`}
        right={<ViewToggle value={mode} onChange={setMode} name="Allocation" />}
      />
      {mode === "chart" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5 lg:px-5">
            <LegendItem color={INK}>Actual, within tolerance</LegendItem>
            <LegendItem color={STATUS.warn}>Actual, outside tolerance</LegendItem>
            <LegendItem color={STRATEGIC_MARK}>Strategic weight</LegendItem>
            <LegendItem color={TOLERANCE_FILL}>Tolerance range</LegendItem>
          </div>
          <div className="min-w-0 px-1 pt-1 pb-1">
            <HighchartsView key={`${view.basis.id}-${view.month.key}`} options={options} height={44 + rows.length * 38} />
          </div>
        </>
      ) : (
        <table className="w-full text-left">
          <caption className="sr-only">Actual against strategic allocation by asset class</caption>
          <thead className="border-b border-neutral-200">
            <tr>
              <th scope="col" className={TH}>Asset class</th>
              <th scope="col" className={`${TH} text-right`}>£m</th>
              <th scope="col" className={`${TH} text-right`}>Actual</th>
              <th scope="col" className={`${TH} text-right`}>Strategic</th>
              <th scope="col" className={`${TH} text-right`}>Tolerance</th>
              <th scope="col" className={`${TH} text-right`}>Deviation</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="px-3 py-2 text-[11px] font-medium text-neutral-800">{r.label}</th>
                <td className={`${TD} text-right`}>{gbpM(r.value)}</td>
                <td className={`${TD} text-right font-semibold text-neutral-950`}>{pct(r.actual)}</td>
                <td className={`${TD} text-right text-neutral-500`}>{pct(r.strategic)}</td>
                <td className={`${TD} text-right text-neutral-500`}>±{num(r.tol)}pp</td>
                <td className={`${TD} text-right`}>{pp(r.deviation)}</td>
                <td className="px-3 py-2">
                  <Chip tone={r.inRange ? "good" : "warn"} size="sm">
                    {r.inRange ? "In range" : "Outside"}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-auto border-t border-neutral-100 px-4 py-2.5 text-[11px] leading-relaxed text-neutral-600 lg:px-5">
        {outside.length === 0 ? (
          "Every asset class is inside its tolerance range."
        ) : (
          <>
            <span className="font-semibold text-neutral-800">{outside.length}</span> of {rows.length} classes outside tolerance:{" "}
            {outside.map((r, k) => (
              <span key={r.id}>
                {k > 0 && "; "}
                {r.label} <span className="font-mono tabular-nums">{pp(r.deviation)}</span>
              </span>
            ))}
            . Illiquids run off through distributions, so the overweight closes only as the programme returns capital.
          </>
        )}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 04b · Liability cash-flow profile with CDI asset cash flows overlaid
 * ------------------------------------------------------------------ */

export function CashflowCard() {
  const [mode, setMode] = useState<View>("chart");

  const options = useMemo<Options>(() => {
    const byYear = new Map(CASHFLOWS.map((c) => [c.year, c]));
    return {
      chart: { type: "area", spacing: [8, 12, 4, 4] },
      xAxis: {
        min: CASHFLOW_FROM,
        max: CASHFLOW_TO,
        tickInterval: 10,
        crosshair: { color: "rgba(23,23,23,0.12)", width: 1 },
        labels: { style: AXIS_LABEL },
      },
      yAxis: { title: { text: "£m a year, nominal" }, min: 0 },
      legend: { enabled: true, align: "left", verticalAlign: "top", itemDistance: 14, symbolWidth: 14, margin: 8 },
      tooltip: {
        shared: true,
        formatter(this: Point) {
          const c = byYear.get(Number(this.x));
          if (!c) return false;
          return tipHtml(
            String(c.year),
            [
              ...MEMBER_CATEGORIES.map((m) => ({ label: m.label, value: gbpM(c[m.id], 1), color: MEMBER_COLOR[m.id] })),
              { label: "Total benefits", value: gbpM(c.total, 1) },
              { label: "CDI cash flows", value: gbpM(c.cdi, 1), color: INK },
              { label: "Covered by CDI", value: c.total > 0 ? pct((c.cdi / c.total) * 100, 0) : "—" },
            ],
            "Projected benefit payments",
          );
        },
      },
      plotOptions: {
        area: {
          stacking: "normal",
          lineWidth: 1,
          lineColor: "#ffffff",
          fillOpacity: 0.85,
          marker: { enabled: false },
        },
        series: { states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 1 } }, animation: false },
      },
      series: [
        ...MEMBER_CATEGORIES.map((m) => ({
          type: "area" as const,
          name: m.label,
          color: MEMBER_COLOR[m.id],
          data: CASHFLOWS.map((c) => [c.year, r1(c[m.id])]),
        })),
        {
          type: "line",
          name: "CDI asset cash flows",
          color: INK,
          lineWidth: 2,
          zIndex: 5,
          marker: { enabled: false },
          data: CASHFLOWS.map((c) => [c.year, r1(c.cdi)]),
        },
      ],
    };
  }, []);

  const buckets = useMemo(() => cashflowBuckets(), []);
  const totals = useMemo(
    () =>
      buckets.reduce(
        (a, b) => ({
          pensioners: a.pensioners + b.pensioners,
          deferreds: a.deferreds + b.deferreds,
          actives: a.actives + b.actives,
          total: a.total + b.total,
          cdi: a.cdi + b.cdi,
        }),
        { pensioners: 0, deferreds: 0, actives: 0, total: 0, cdi: 0 },
      ),
    [buckets],
  );
  const decade = CASHFLOWS.slice(0, 10);
  const decadeTotal = decade.reduce((s, c) => s + c.total, 0);
  const decadeCdi = decade.reduce((s, c) => s + c.cdi, 0);

  return (
    <section aria-labelledby="pf-cf-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <CardHeader
        id="pf-cf-title"
        title="Liability cash-flow profile, 2026–2090"
        sub="Projected benefit payments by member category, nominal, with the buy-and-maintain CDI portfolio's cash flows overlaid · unchanged by basis"
        right={<ViewToggle value={mode} onChange={setMode} name="Cash-flow profile" />}
      />
      {mode === "chart" ? (
        <div className="min-w-0 px-1 pt-2 pb-1">
          <HighchartsView options={options} height={272} />
        </div>
      ) : (
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Projected benefit payments and CDI cash flows in five-year buckets</caption>
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e5e5]">
              <tr>
                <th scope="col" className={TH}>Years</th>
                {MEMBER_CATEGORIES.map((m) => (
                  <th key={m.id} scope="col" className={`${TH} text-right`}>{m.label}</th>
                ))}
                <th scope="col" className={`${TH} text-right`}>Total</th>
                <th scope="col" className={`${TH} text-right`}>CDI</th>
                <th scope="col" className={`${TH} text-right`}>Covered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {buckets.map((b) => (
                <tr key={b.year}>
                  <th scope="row" className="px-3 py-1.5 font-mono text-[11px] font-medium text-neutral-800 tabular-nums">{b.label}</th>
                  <td className={`${TD} text-right`}>{gbpM(b.pensioners)}</td>
                  <td className={`${TD} text-right`}>{gbpM(b.deferreds)}</td>
                  <td className={`${TD} text-right`}>{gbpM(b.actives)}</td>
                  <td className={`${TD} text-right font-semibold text-neutral-950`}>{gbpM(b.total)}</td>
                  <td className={`${TD} text-right`}>{gbpM(b.cdi)}</td>
                  <td className={`${TD} text-right text-neutral-500`}>{pct((b.cdi / b.total) * 100, 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-neutral-200 bg-neutral-50">
              <tr>
                <th scope="row" className="px-3 py-1.5 text-[11px] font-semibold text-neutral-900">Total</th>
                <td className={`${TD} text-right font-semibold`}>{gbpM(totals.pensioners)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpM(totals.deferreds)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpM(totals.actives)}</td>
                <td className={`${TD} text-right font-semibold text-neutral-950`}>{gbpM(totals.total)}</td>
                <td className={`${TD} text-right font-semibold`}>{gbpM(totals.cdi)}</td>
                <td className={`${TD} text-right font-semibold`}>{pct((totals.cdi / totals.total) * 100, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-auto border-t border-neutral-100 px-4 py-2.5 text-[11px] leading-relaxed text-neutral-600 lg:px-5">
        <span className="font-semibold text-neutral-800">{gbpM(decadeTotal)}</span> of benefits fall due in the next ten years, of which the CDI portfolio's
        contractual cash flows cover <span className="font-semibold text-neutral-800">{pct((decadeCdi / decadeTotal) * 100, 0)}</span>; the balance is met from
        the buy-in policy and asset income. Pensioners in payment are {pct((totals.pensioners / totals.total) * 100, 0)} of all projected payments.
      </p>
    </section>
  );
}
