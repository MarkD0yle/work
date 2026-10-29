import type { Chart as HChart, Options, SVGElement as HSvg } from "highcharts";
import { cpIndex } from "../../data/mock";
import { catColor } from "../../tokens";
import { formatNumber } from "../../lib/format";
import type { ChartColors } from "../../chart";
import { tipHtml } from "../../chart";
import type { Theme } from "../../tokens";
import { SIZE_BUCKETS, type PeerStat } from "./mock";

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

type TipCtx = { point?: { options?: { cpId?: string }; series?: { options?: { id?: string } } }; series?: { options?: { id?: string } }; x?: unknown };
const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.12 || 1; return [lo - d, hi + d] as const; };

/** Horizontal signed PAWR bars, sorted descending, per-point better/worse colour. */
export function pawrBarOptions(stats: PeerStat[], c: ChartColors, selected: string | null, onSelect: (id: string) => void): Options {
  const sorted = [...stats].sort((a, b) => b.pawr - a.pawr);
  const max = Math.max(...sorted.map((s) => Math.abs(s.pawr)), 0.5);
  const lim = Math.ceil(max * 1.5 * 2) / 2;
  return {
    chart: { type: "bar", marginLeft: 118 },
    xAxis: {
      categories: sorted.map((s) => s.name), crossing: -lim, tickLength: 0,
      labels: { style: { color: c.muted, fontSize: "11px", width: "108px", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
    },
    yAxis: {
      min: -lim, max: lim, tickAmount: 5, title: { text: "Par-adjusted win rate (bps)" },
      labels: { formatter(this: { value: unknown }) { return formatNumber(this.value as number, "bps-signed"); } },
      plotLines: [{ value: 0, width: 1, color: c.muted, zIndex: 4 }],
    },
    plotOptions: {
      series: { cursor: "pointer", pointPadding: 0.12, groupPadding: 0.05, point: { events: { click: function (this: { index: number }) { onSelect(sorted[this.index].id); } } } },
    },
    tooltip: {
      formatter: function (this: unknown): string {
        const s = sorted[(this as { point: { index: number } }).point.index];
        return tipHtml(s.name, [
          { name: "Par-adjusted win rate", value: formatNumber(s.pawr, "bps-signed") },
          { name: "Win rate", value: formatNumber(s.winRate, "percent") },
          { name: "Notional", value: formatNumber(s.notional, "notional") },
        ]);
      },
    },
    series: [{
      type: "bar", name: "Par-adjusted win rate", showInLegend: false,
      data: sorted.map((s) => {
        const base = s.pawr >= 0 ? c.better : c.worse;
        const dim = selected !== null && selected !== s.id;
        return { y: s.pawr, color: dim ? hexToRgba(base, 0.3) : base, borderWidth: selected === s.id ? 2 : 0, borderColor: c.text };
      }),
      dataLabels: {
        enabled: true, inside: false, style: { color: c.text, fontSize: "10px", fontWeight: "500", textOutline: "none" },
        formatter(this: { y?: number | null }) { return formatNumber(this.y, "bps-signed"); },
      },
    }],
  } as unknown as Options;
}

const quadGroups = new WeakMap<HChart, HSvg>();

/** Draws the quadrant fills + corner captions behind the series. Called on every render so it follows resize. */
function drawQuadrants(chart: HChart, c: ChartColors, midX: number, midY: number, corners: [string, string, string, string]) {
  quadGroups.get(chart)?.destroy();
  const x = chart.xAxis[0], y = chart.yAxis[0];
  const L = chart.plotLeft, T = chart.plotTop, R = L + chart.plotWidth, B = T + chart.plotHeight;
  const mx = Math.min(R, Math.max(L, x.toPixels(midX, false))), my = Math.min(B, Math.max(T, y.toPixels(midY, false)));
  const g = chart.renderer.g("ea-quadrants").attr({ zIndex: 0 }).add();
  chart.renderer.rect(mx, T, R - mx, my - T).attr({ fill: c.betterSubtle, zIndex: 0 }).add(g);
  chart.renderer.rect(L, my, mx - L, B - my).attr({ fill: c.worseSubtle, zIndex: 0 }).add(g);
  const css = { color: c.muted, fontSize: "11px" };
  const [tl, tr, bl, br] = corners;
  chart.renderer.text(tl, L + 6, T + 14).css(css).attr({ zIndex: 1 }).add(g);
  chart.renderer.text(tr, R - 6, T + 14).css(css).attr({ "text-anchor": "end", zIndex: 1 }).add(g);
  chart.renderer.text(bl, L + 6, B - 6).css(css).attr({ zIndex: 1 }).add(g);
  chart.renderer.text(br, R - 6, B - 6).css(css).attr({ "text-anchor": "end", zIndex: 1 }).add(g);
  quadGroups.set(chart, g);
}

export type BubbleSpec = {
  xOf: (s: PeerStat) => number;
  xFormat: "notional" | "bps-signed";
  xTitle: string;
  midX: number;
  corners: [string, string, string, string];
  xLabel: string;
};

/** Quadrant bubble chart: one series per counterparty so each keeps its categorical hue. */
export function bubbleOptions(stats: PeerStat[], spec: BubbleSpec, c: ChartColors, theme: Theme, selected: string | null, onSelect: (id: string) => void): Options {
  const xs = stats.map(spec.xOf), ys = stats.map((s) => s.winRate);
  const [x0, x1] = pad(Math.min(...xs, spec.midX), Math.max(...xs, spec.midX));
  const [y0, y1] = pad(Math.min(...ys, 50), Math.max(...ys, 50));
  const labelled = new Set([...stats].sort((a, b) => b.notional - a.notional).slice(0, 15).map((s) => s.id));
  const byId = new Map(stats.map((s) => [s.id, s]));
  return {
    chart: { type: "bubble", events: { render: function () { drawQuadrants(this as unknown as HChart, c, spec.midX, 50, spec.corners); } } },
    xAxis: {
      min: x0, max: x1, startOnTick: false, endOnTick: false, tickAmount: 5, title: { text: spec.xTitle }, gridLineWidth: 0,
      labels: { formatter(this: { value: unknown }) { return formatNumber(this.value as number, spec.xFormat); } },
      plotLines: [{ value: spec.midX, width: 1, color: c.muted, zIndex: 2 }],
    },
    yAxis: {
      min: y0, max: y1, startOnTick: false, endOnTick: false, tickAmount: 5, title: { text: "Win rate" }, gridLineWidth: 0,
      labels: { formatter(this: { value: unknown }) { return formatNumber(this.value as number, "percent"); } },
      plotLines: [{ value: 50, width: 1, color: c.muted, zIndex: 2 }],
    },
    plotOptions: { bubble: { sizeBy: "area", minSize: 10, maxSize: 38, cursor: "pointer" } },
    tooltip: {
      formatter: function (this: unknown): string {
        const id = (this as TipCtx).series?.options?.id ?? "";
        const s = byId.get(id);
        if (!s) return "";
        return tipHtml(s.name, [
          { color: catColor(cpIndex(s.id), theme), name: spec.xLabel, value: formatNumber(spec.xOf(s), spec.xFormat) },
          { name: "Win rate", value: formatNumber(s.winRate, "percent") },
          { name: "Notional", value: formatNumber(s.notional, "notional") },
        ]);
      },
    },
    series: stats.map((s) => {
      const color = catColor(cpIndex(s.id), theme);
      const isSel = selected === s.id;
      return {
        type: "bubble", id: s.id, name: s.name, color,
        opacity: selected !== null && !isSel ? 0.25 : 1,
        marker: { fillOpacity: 0.7, lineWidth: isSel ? 2 : 0, lineColor: c.text },
        point: { events: { click: () => onSelect(s.id) } },
        data: [{ x: spec.xOf(s), y: s.winRate, z: s.notional, name: s.name }],
        dataLabels: labelled.has(s.id)
          ? { enabled: true, formatter: () => s.short, style: { color: c.text, fontSize: "10px", fontWeight: "400", textOutline: "none" } }
          : { enabled: false },
      };
    }) as Options["series"],
  } as unknown as Options;
}

export function parCurveOptions(curve: { under: number[]; par: number[]; above: number[] }, c: ChartColors): Options {
  return {
    chart: { type: "line" },
    xAxis: { categories: SIZE_BUCKETS, title: { text: "Trade size" } },
    yAxis: { title: { text: "Win rate" }, labels: { formatter(this: { value: unknown }) { return formatNumber(this.value as number, "percent"); } } },
    plotOptions: { line: { marker: { enabled: true, radius: 3, symbol: "circle" } } },
    tooltip: { shared: true },
    series: [
      { type: "line", name: "Under", data: curve.under, color: c.neutral[2] },
      { type: "line", name: "Par", data: curve.par, color: c.muted, dashStyle: "Dash", marker: { enabled: false }, lineWidth: 1 },
      { type: "line", name: "Above", data: curve.above, color: c.neutral[5] },
    ],
  } as unknown as Options;
}
