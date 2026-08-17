/* Highcharts bootstrap.
 *
 * Every chart in the workspace goes through this module rather than importing
 * `highcharts` directly, for two reasons:
 *
 *  1. Module registration is a side effect. Highcharts ships its non-core
 *     series (heatmap, treemap, sankey, solid gauge, …) as separate bundles
 *     that attach themselves to the singleton on import. Doing that in one
 *     place means a chart component can just ask for `type: "sankey"` and
 *     trust it exists, instead of each file guessing which bundles it needs.
 *  2. The theme is global. `setOptions` is applied once at module load so the
 *     ten charts on the gallery page read as one system — same type scale,
 *     same tooltip, same square corners the rest of the app uses.
 *
 * Import order matters: `highcharts-more` (bubble, polar, gauge) and the
 * colour-axis carriers must land before anything that builds on them.
 *
 * The `esm/` paths are deliberate. The package's bare specifier resolves to an
 * ESM bundle that only has a default export, so a namespace import of it yields
 * an object with no `setOptions` on it — the theme below would silently do
 * nothing. Importing the ESM entry and its ESM module bundles keeps every
 * import pointed at one Highcharts instance, which is the thing module
 * registration depends on.
 */

import Highcharts from "highcharts/esm/highcharts";
import "highcharts/esm/highcharts-more";
import "highcharts/esm/modules/drilldown";
import "highcharts/esm/modules/heatmap";
import "highcharts/esm/modules/treemap";
import "highcharts/esm/modules/sankey";
import "highcharts/esm/modules/solid-gauge";
import "highcharts/esm/modules/stock";
import "highcharts/esm/modules/accessibility";
import "highcharts/esm/modules/exporting";
import "highcharts/esm/modules/offline-exporting";

/* Categorical palette. Indigo leads because it is the app's accent; the rest
 * are spaced far enough apart in hue to stay separable at 2px line weight. */
export const PALETTE = [
  "#4f46e5", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#64748b", // slate
];

/* Semantic colours, kept separate from the categorical ramp so "up is green"
 * never depends on where a series happens to sit in the rotation. */
export const TONE = {
  pos: "#059669",
  neg: "#e11d48",
  neutral: "#94a3b8",
  ink: "#171717",
  muted: "#a3a3a3",
  grid: "#f0f0f0",
  axis: "#e5e5e5",
};

const FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

Highcharts.setOptions({
  colors: PALETTE,
  lang: { thousandsSep: "," },
  credits: { enabled: false },
  title: { text: undefined },
  accessibility: { enabled: true },
  chart: {
    backgroundColor: "transparent",
    borderRadius: 0,
    spacing: [8, 4, 4, 4],
    style: { fontFamily: FONT },
    animation: { duration: 320 },
  },
  /* The card chrome carries the title, so charts render title-less and the
   * subtitle slot is reused for in-chart hints (e.g. "click to drill in"). */
  subtitle: {
    style: { color: TONE.muted, fontSize: "10px" },
  },
  xAxis: {
    lineColor: TONE.axis,
    tickColor: TONE.axis,
    gridLineColor: TONE.grid,
    labels: { style: { color: "#737373", fontSize: "10px" } },
    title: { style: { color: TONE.muted, fontSize: "10px" } },
    crosshair: { color: "rgba(79,70,229,0.12)", width: 1 },
  },
  yAxis: {
    gridLineColor: TONE.grid,
    lineColor: TONE.axis,
    labels: {
      style: { color: "#737373", fontSize: "10px", fontFamily: MONO },
    },
    title: { style: { color: TONE.muted, fontSize: "10px" } },
  },
  legend: {
    itemStyle: { color: "#525252", fontSize: "11px", fontWeight: "500" },
    itemHoverStyle: { color: TONE.ink },
    itemHiddenStyle: { color: "#d4d4d4" },
    symbolRadius: 0,
    squareSymbol: true,
    margin: 8,
  },
  tooltip: {
    backgroundColor: "#0a0a0a",
    borderWidth: 0,
    borderRadius: 0,
    shadow: false,
    padding: 8,
    style: { color: "#fafafa", fontSize: "11px" },
    useHTML: true,
  },
  plotOptions: {
    series: {
      animation: { duration: 320 },
      states: { inactive: { opacity: 0.25 } },
      dataLabels: {
        style: {
          fontFamily: MONO,
          fontSize: "10px",
          fontWeight: "500",
          textOutline: "none",
        },
      },
    },
    // Highcharts defaults these to rounded corners; the app is square-cornered.
    column: { borderWidth: 0, borderRadius: 0, groupPadding: 0.12 },
    bar: { borderWidth: 0, borderRadius: 0 },
    pie: { borderWidth: 0, borderRadius: 0 },
  },
  /* Local export only — the default menu POSTs the chart to Highcharts'
   * public export server, which this prototype has no business doing. */
  exporting: {
    enabled: false,
    fallbackToExportServer: false,
    chartOptions: { chart: { backgroundColor: "#ffffff" } },
  },
  navigation: {
    buttonOptions: { enabled: false },
  },
});

/* The offline-exporting bundle extends `Chart.prototype` with
 * `exportChartLocal` at load time but ships no type for it. Declare the one
 * method the cards call rather than casting at each call site. */
declare module "highcharts" {
  interface Chart {
    exportChartLocal(
      exportingOptions?: ExportingOptions,
      chartOptions?: Options,
    ): Promise<void>;
  }
}

export { Highcharts };
export default Highcharts;
