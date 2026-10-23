import type { Options } from "highcharts";
import Highcharts from "../../../lib/highcharts";
import { CAT, NEUTRAL_RAMP, TOKENS, type Theme } from "../tokens";
import { formatNumber } from "../lib/format";
import type { FormatSpec } from "../config/formats";

export type ChartColors = ReturnType<typeof chartColors>;
export function chartColors(theme: Theme) {
  const t = TOKENS[theme];
  return { ...t, cat: CAT[theme], neutral: NEUTRAL_RAMP[theme] };
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export type TipRow = { color?: string; name: string; value: string };
/** The one tooltip markup used by every chart. */
export function tipHtml(title: string, rows: TipRow[]): string {
  const body = rows.map((r) =>
    `<div class="ea-tooltip-row"><span style="display:inline-flex;align-items:center;gap:6px">${r.color ? `<span class="ea-swatch" style="background:${r.color}"></span>` : ""}${r.name}</span><span class="ea-num" style="font-weight:600;margin-left:12px">${r.value}</span></div>`).join("");
  return `<div class="ea-tooltip"><b>${title}</b>${body}</div>`;
}

/** Flat, token-driven base: horizontal gridlines only, no gradients/shadows, caption-sized axes. */
export function baseOptions(theme: Theme, valueFormat: FormatSpec = "bps"): Options {
  const c = chartColors(theme);
  return Highcharts.merge({
    colors: c.cat,
    chart: { backgroundColor: "transparent", style: { fontFamily: FONT }, animation: { duration: 200 }, spacing: [8, 8, 4, 4] },
    title: { text: undefined }, subtitle: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
    xAxis: { lineColor: c.border, tickColor: c.border, gridLineWidth: 0, labels: { style: { color: c.muted, fontSize: "11px" } }, title: { style: { color: c.muted, fontSize: "11px", fontWeight: "400" } }, crosshair: { color: c.muted, width: 1, dashStyle: "Solid" } },
    yAxis: { gridLineWidth: 1, gridLineColor: c.border, tickAmount: 5, lineWidth: 0, labels: { style: { color: c.muted, fontSize: "11px" } }, title: { style: { color: c.muted, fontSize: "11px", fontWeight: "400" } }, zeroLine: undefined },
    plotOptions: {
      series: { animation: { duration: 200 }, states: { hover: { halo: { size: 0 } } }, shadow: false, borderWidth: 0 },
      area: { fillOpacity: 0.4, lineWidth: 2, marker: { enabled: false } },
      line: { lineWidth: 2, marker: { enabled: false } },
      bar: { borderWidth: 0, borderRadius: 0 },
      column: { borderWidth: 0, borderRadius: 0 },
      scatter: { marker: { radius: 5, symbol: "circle", fillOpacity: 0.7 } },
      bubble: { minSize: 8, maxSize: 40, fillOpacity: 0.7, marker: { lineWidth: 0, fillColor: undefined } },
    },
    tooltip: {
      useHTML: true, shared: false, backgroundColor: "transparent", borderWidth: 0, shadow: false, padding: 0, outside: true,
      formatter: function (this: unknown): string {
        const p = this as { x?: number | string; points?: { series: { name: string; color?: string }; y?: number | null }[]; point?: { name?: string; y?: number | null; color?: string }; series?: { name: string } };
        const pts = p.points ?? (p.point ? [{ series: { name: p.series?.name ?? p.point.name ?? "", color: String(p.point.color ?? "") }, y: p.point.y }] : []);
        return tipHtml(String(p.x ?? p.point?.name ?? ""), pts.map((q) => ({ color: q.series.color, name: q.series.name, value: formatNumber(q.y ?? null, valueFormat) })));
      },
    },
  } as Options, {} as Options);
}

export const mergeOptions = (base: Options, over: Options): Options => Highcharts.merge(base, over) as Options;
