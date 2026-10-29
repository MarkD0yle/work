/* Option builders for the six panels. Pure: (data, colours) -> Highcharts Options. All numbers go through formatNumber. */
import type { AxisLabelsFormatterCallbackFunction, DataLabelsFormatterCallbackFunction, Options } from "highcharts";
import { tipHtml, type ChartColors } from "../../chart";
import { formatDate, formatNumber, formatTime } from "../../lib/format";
import type { Trade } from "../../data/mock";
import {
  ALGO_TABS, TENORS, TENOR_LABEL, algoPoints, forwardCurves, liquidityCurve, momentum, swapProfile, twapCosts, type AlgoGroup,
} from "./mock";

type PointCtx = { x?: number; y?: number; low?: number; high?: number; name?: string; color?: string; custom?: Record<string, unknown>; series: { name: string; color?: string } };
type TipCtx = { x?: number | string; y?: number; point: PointCtx; points?: PointCtx[]; series: { name: string } };
type TooltipFormatter = NonNullable<NonNullable<Options["tooltip"]>["formatter"]>;
type LabelFormatter = AxisLabelsFormatterCallbackFunction;

/** Typed shims: Highcharts' own `this` types are too loose to be useful here. */
const tip = (fn: (c: TipCtx) => string) => (function (this: unknown) { return fn(this as TipCtx); }) as unknown as TooltipFormatter;
const dlab = (fn: (y: number | undefined) => string) => (function (this: unknown) { return fn((this as { y?: number }).y); }) as unknown as DataLabelsFormatterCallbackFunction;
const lab = (fn: (v: number) => string) => (function (this: unknown) { return fn((this as { value: number }).value); }) as unknown as LabelFormatter;

const hourText = (h: number) => formatTime(new Date(Date.UTC(2026, 0, 1, h)));
const axisTitle = (text: string) => ({ text });

export function liquidityCurveOptions(t: Trade, c: ChartColors): Options {
  const { data, fv } = liquidityCurve(t);
  return {
    chart: { type: "area" },
    xAxis: { min: 0, max: 23, tickInterval: 4, title: axisTitle("Time of day (local)"), labels: { formatter: lab(hourText) }, plotLines: [{ value: fv.x, color: c.muted, width: 1, dashStyle: "Dash", zIndex: 3 }] },
    yAxis: { title: axisTitle("Volume (notional)"), labels: { formatter: lab((v) => formatNumber(v, "notional")) } },
    tooltip: {
      shared: false,
      formatter: tip((p) => p.point.series.name === "Fair value"
        ? tipHtml("Fair value reference", [{ name: "Reference value", value: `${formatNumber(fv.bps, "bps")} bps` }, { name: `Volume at ${hourText(fv.x)}`, value: formatNumber(fv.y, "notional") }])
        : tipHtml(hourText(Number(p.x)), [{ color: c.neutral[3], name: "Volume", value: formatNumber(p.y ?? null, "notional") }])),
    },
    series: [
      { type: "area", name: "Volume", data, color: c.neutral[3], fillOpacity: 0.4, zIndex: 1 },
      {
        type: "scatter", name: "Fair value", data: [{ x: fv.x, y: fv.y }], zIndex: 5,
        marker: { symbol: "triangle-down", radius: 8, fillColor: c.text, lineWidth: 1, lineColor: c.surface },
        dataLabels: { enabled: true, format: "FV", y: -14, style: { color: c.text, fontSize: "11px", fontWeight: "600", textOutline: "none" } },
      },
    ],
  };
}

export function swapProfileOptions(t: Trade, c: ChartColors): Options {
  const rows = swapProfile(t);
  return {
    chart: { type: "arearange" },
    xAxis: { title: axisTitle("Business days"), tickInterval: 2, labels: { formatter: lab((v) => formatNumber(v, "count")) } },
    yAxis: { title: axisTitle("Liquidity (notional)"), labels: { formatter: lab((v) => formatNumber(v, "notional")) } },
    tooltip: {
      shared: true,
      formatter: tip((p) => {
        const pt = p.points?.[0] ?? p.point;
        return tipHtml(`Day ${formatNumber(Number(p.x), "count")}`, [
          { color: c.neutral[3], name: "High", value: formatNumber(pt.high ?? null, "notional") },
          { color: c.neutral[1], name: "Low", value: formatNumber(pt.low ?? null, "notional") },
        ]);
      }),
    },
    series: [{ type: "arearange", name: "Liquidity band", data: rows.map((r) => [r.day, r.low, r.high]), color: c.neutral[3], fillOpacity: 0.4, lineWidth: 1 }],
  };
}

export function momentumOptions(t: Trade, c: ChartColors): Options {
  const rows = momentum(t);
  const ends = (v: number) => (v === -100 ? `Lower<br/>${formatNumber(v, "count")}` : v === 100 ? `Higher<br/>${formatNumber(v, "count")}` : formatNumber(v, "count"));
  return {
    chart: { type: "bar" },
    xAxis: { categories: rows.map((r) => r.name), title: { text: undefined }, lineColor: c.border },
    yAxis: { min: -100, max: 100, tickPositions: [-100, -50, 0, 50, 100], title: axisTitle("Momentum score"), labels: { formatter: lab(ends) }, plotLines: [{ value: 0, color: c.muted, width: 1, zIndex: 3 }] },
    plotOptions: { bar: { pointWidth: 18, dataLabels: { enabled: true, formatter: dlab((y) => formatNumber(y ?? null, "bps-signed")), style: { color: c.text, fontSize: "11px", fontWeight: "600", textOutline: "none" } } } },
    tooltip: { formatter: tip((p) => tipHtml(String(p.point.name ?? p.x), [{ color: p.point.color, name: (p.y ?? 0) >= 0 ? "Higher" : "Lower", value: formatNumber(p.y ?? null, "bps-signed") }])) },
    series: [{ type: "bar", name: "Momentum", data: rows.map((r) => ({ name: r.name, y: r.value, color: r.value >= 0 ? c.better : c.worse })) }],
  };
}

export function twapOptions(t: Trade, c: ChartColors): Options {
  const { rows, minIndex } = twapCosts(t);
  const mk = (name: string, key: "opportunity" | "spread" | "total", color: string, extra: object = {}) =>
    ({ type: "line", name, color, data: rows.map((r) => [r.minutes, r[key]]), ...extra });
  const minRow = rows[minIndex];
  return {
    chart: {
      type: "line",
      events: {
        // Pin the tooltip at the Total minimum so the cheapest horizon is called out on load.
        load() {
          const chart = this as unknown as { series: { name: string; points: unknown[] }[]; tooltip: { refresh: (p: unknown) => void } };
          window.setTimeout(() => { try { chart.tooltip.refresh(chart.series.find((s) => s.name === "Total")?.points[minIndex]); } catch { /* chart destroyed */ } }, 50);
        },
      },
    },
    xAxis: { title: axisTitle("Execution horizon (minutes)"), labels: { formatter: lab((v) => formatNumber(v, "count")) } },
    yAxis: { title: axisTitle("Cost (bps)"), labels: { formatter: lab((v) => formatNumber(v, "bps")) } },
    tooltip: {
      shared: true,
      formatter: tip((p) => {
        const isMin = Number(p.x) === minRow.minutes;
        return tipHtml(`${formatNumber(Number(p.x), "count")} min${isMin ? " · minimum cost" : ""}`,
          (p.points ?? []).map((q) => ({ color: q.series.color, name: q.series.name, value: formatNumber(q.y ?? null, "bps") })));
      }),
    },
    series: [
      mk("Opportunity", "opportunity", c.cat[0]), mk("Spread", "spread", c.cat[1]),
      mk("Total", "total", c.cat[2], { lineWidth: 3, marker: { enabled: false }, zIndex: 3 }),
      { type: "scatter", name: "Minimum cost", enableMouseTracking: false, showInLegend: false, data: [[minRow.minutes, minRow.total]], marker: { enabled: true, radius: 6, symbol: "circle", fillColor: c.surface, lineWidth: 2, lineColor: c.cat[2] }, zIndex: 4 },
    ] as Options["series"],
  };
}

export function forwardOptions(t: Trade, c: ChartColors): Options {
  const curves = forwardCurves(t);
  return {
    chart: { type: "line" },
    xAxis: { type: "logarithmic", min: 1, max: 365, tickPositions: TENORS, title: axisTitle("Tenor (log scale)"), labels: { formatter: lab((v) => TENOR_LABEL[Math.round(v)] ?? formatNumber(v, "count")) } },
    yAxis: { title: axisTitle("Forward points (bps)"), labels: { formatter: lab((v) => formatNumber(v, "bps")) } },
    tooltip: {
      shared: true,
      formatter: tip((p) => tipHtml(TENOR_LABEL[Math.round(Number(p.x))] ?? formatNumber(Number(p.x), "count"),
        (p.points ?? []).map((q) => ({ color: q.series.color, name: q.series.name, value: formatNumber(q.y ?? null, "bps") })))),
    },
    series: curves.map((cv, i) => ({ type: "line" as const, name: formatDate(cv.date), color: c.cat[i], data: cv.points, marker: { enabled: true, radius: 3 } })),
  };
}

export function algoGroups(t: Trade, group: AlgoGroup, c: ChartColors) {
  const pts = algoPoints(t);
  const names = [...new Set(pts.map((p) => p[group]))].sort();
  return { pts, names: names.map((name, i) => ({ id: name, name, color: c.cat[i % c.cat.length] })) };
}

export function algoOptions(t: Trade, group: AlgoGroup, c: ChartColors): Options {
  const { pts, names } = algoGroups(t, group, c);
  const label = ALGO_TABS.find((x) => x.id === group)?.label ?? "";
  return {
    chart: { type: "scatter" },
    xAxis: { title: axisTitle("Duration (minutes)"), labels: { formatter: lab((v) => formatNumber(v, "count")) } },
    yAxis: { title: axisTitle("Cost (bps)"), labels: { formatter: lab((v) => formatNumber(v, "bps")) } },
    tooltip: {
      formatter: tip((p) => tipHtml(`${label}: ${p.point.series.name}`, [
        { name: "Duration (min)", value: formatNumber(p.x === undefined ? null : Number(p.x), "count") },
        { name: "Cost (bps)", value: formatNumber(p.y ?? null, "bps") },
        { name: "Counterparty", value: String(p.point.custom?.cp ?? "") },
      ])),
    },
    series: names.map((n) => ({
      type: "scatter" as const, name: n.name, color: n.color,
      data: pts.filter((p) => p[group] === n.name).map((p) => ({ x: p.minutes, y: p.cost, custom: { cp: p.counterparty } })),
    })),
  };
}
