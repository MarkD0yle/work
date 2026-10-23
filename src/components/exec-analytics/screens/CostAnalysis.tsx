import { useMemo, type ReactNode } from "react";
import { DataTable, type Column } from "../table";
import { Chart, ChartPanel, PanelGrid, chartColors, type PanelDef } from "../chart";
import { Chip, PageHeader, TabBar } from "../ui";
import { DateRange, ExportMenu, FilterBar, FilterButton, ToolbarContext, activeFilterCount, useDateRange, useInitialLoad, usePreviewState, useRefresh } from "../shell";
import { formatNumber } from "../lib/format";
import { daysBetween } from "../lib/dates";
import { usePersisted } from "../lib/persist";
import { useEa } from "../ui/context";
import type { FormatSpec } from "../config/formats";
import { FILTERS, buildModel, type CostRow, type MetricKey } from "./cost-analysis/model";

const PANEL_H = 320;
const CHIP_H = 36;

type Metric = { key: MetricKey; header: string; format: FormatSpec; better?: "lower"; width: number };
const ALL: Metric[] = [
  { key: "avg", header: "Average", format: "bps-signed", better: "lower", width: 80 },
  { key: "median", header: "Median", format: "bps-signed", better: "lower", width: 80 },
  { key: "sd", header: "Std dev", format: "bps", width: 72 },
  { key: "sharpe", header: "Sharpe", format: "ratio", width: 68 },
  { key: "trades", header: "Trades", format: "count", width: 72 },
  { key: "min", header: "Min", format: "bps", width: 72 },
  { key: "max", header: "Max", format: "bps", width: 72 },
];
const SHORT = ALL.slice(0, 5);
const COMPARE_SET = [ALL[0], ALL[1], ALL[4]];

/** Colour only where a better direction is defined (cost: lower is better); the signed value is always shown. */
function valueCell(v: number | null | undefined, m: Metric): ReactNode {
  const text = formatNumber(v ?? null, m.format);
  if (!m.better || v === null || v === undefined || Math.abs(v) < 0.005) return text;
  return <span style={{ color: v < 0 ? "var(--data-better)" : "var(--data-worse)" }}>{text}</span>;
}

function makeColumns(label: string, metrics: Metric[], poolKeys: string[], compare: boolean): Column<CostRow>[] {
  const cols: Column<CostRow>[] = [{ id: "label", header: label, headerText: label, sticky: true, width: 170, accessor: (r) => r.label, render: (r) => r.label }];
  for (const pk of poolKeys) {
    for (const m of metrics) {
      cols.push({
        id: `${pk}.${m.key}`, header: m.header, headerText: m.header, format: m.format, width: m.width, group: compare ? pk : undefined,
        accessor: (r) => r.stats[pk]?.[m.key] ?? null,
        render: (r) => valueCell(r.stats[pk]?.[m.key], m),
      });
    }
  }
  return cols;
}

function TablePanelBody({ chip, children }: { chip: string; children: ReactNode }) {
  return (
    <div style={{ height: PANEL_H, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: CHIP_H, display: "flex", alignItems: "center", padding: "0 var(--space-3)", flexShrink: 0 }}><Chip>{chip}</Chip></div>
      <div style={{ minHeight: 0, flex: 1 }}>{children}</div>
    </div>
  );
}

export default function CostAnalysis() {
  const { theme } = useEa();
  const loadingInitial = useInitialLoad();
  const preview = usePreviewState();
  const { refresh } = useRefresh();
  const [range, setRange] = useDateRange("cost-analysis");
  const [tab, setTab] = usePersisted<"cost" | "benchmark">("tab.costanalysis", "cost");
  const [filters, setFilters] = usePersisted<Record<string, string>>("filter.costanalysis", {});
  const [showFilters, setShowFilters] = usePersisted<boolean>("filter.costanalysis.open", true);

  const days = Math.max(1, daysBetween(range.start, range.end) + 1);
  const model = useMemo(() => buildModel(filters, tab, days), [filters, tab, days]);
  const c = chartColors(theme);
  const bench = tab === "benchmark";
  const suffix = bench ? " vs benchmark" : "";

  const loading = loadingInitial || preview === "loading";
  const empty = preview === "empty" || model.empty;
  const error = preview === "error" ? "Could not load cost analysis." : undefined;
  const common = { loading, error, onRetry: refresh, empty: empty ? { message: "No trades match these filters", onChangeFilters: () => setShowFilters(true) } : undefined };

  const { poolKeys, compare } = model;
  const tableMetrics = compare ? COMPARE_SET : ALL;
  const shortMetrics = compare ? COMPARE_SET : SHORT;

  const distOptions = useMemo(() => ({
    chart: { type: "area" },
    xAxis: {
      type: "linear", title: { text: "Impact (bps)" }, labels: { formatter: function (this: { value: number | string }) { return formatNumber(Number(this.value), "bps"); } },
      plotLines: [{
        value: model.impactAvg, color: c.text, width: 1.5, dashStyle: "Dash", zIndex: 5,
        label: { text: `Average ${formatNumber(model.impactAvg, "bps-signed")}`, rotation: 0, align: "left", x: 6, y: 12, style: { color: c.text, fontSize: "11px" } },
      }],
    },
    yAxis: { title: { text: "Trades" }, labels: { formatter: function (this: { value: number | string }) { return formatNumber(Number(this.value), "count"); } } },
    tooltip: {
      formatter: function (this: unknown) {
        const p = this as { x: number; y: number };
        return `<div class="ea-tooltip"><b>Impact ${formatNumber(p.x, "bps-signed")} bps</b><div class="ea-tooltip-row"><span>Trades</span><span class="ea-num" style="font-weight:600;margin-left:12px">${formatNumber(p.y, "count")}</span></div></div>`;
      },
    },
    series: [{ type: "area", name: "Trades", color: c.neutral[3], fillColor: undefined, fillOpacity: 0.4, data: model.dist.map((d) => [d.x, d.y]) }],
  }), [model, c]);

  const panels: PanelDef[] = [
    {
      id: "totals", size: "M", render: () => (
        <ChartPanel title={`Total costs${suffix}`} height={PANEL_H} flush {...common}>
          <TablePanelBody chip={model.chip}>
            <DataTable<CostRow> label="Total costs" persistKey="cost-totals" defaultDensity="compact" hideDensity maxHeight={PANEL_H - CHIP_H}
              columns={makeColumns("Metric", tableMetrics, poolKeys, compare)} rows={model.totals} rowId={(r) => r.id} />
          </TablePanelBody>
        </ChartPanel>
      ),
    },
    {
      id: "dist", size: "M", render: () => (
        <ChartPanel title={`Impact distribution${suffix}`} height={PANEL_H} {...common}
          asTable={{ columns: ["Impact (bps)", "Trades"], rows: model.dist.map((d) => [formatNumber(d.x, "bps-signed"), formatNumber(d.y, "count")]) }}>
          {({ height }) => (
            <Chart height={height} valueFormat="count" options={distOptions as never}
              summary={`Distribution of impact in bps across trades. Average impact ${formatNumber(model.impactAvg, "bps-signed")} bps.`} />
          )}
        </ChartPanel>
      ),
    },
    {
      id: "product", size: "M", render: () => (
        <ChartPanel title={`Costs by product${suffix}`} height={PANEL_H} flush {...common}>
          <TablePanelBody chip={model.chip}>
            <DataTable<CostRow> label="Costs by product" persistKey="cost-product" defaultDensity="compact" hideDensity maxHeight={PANEL_H - CHIP_H}
              columns={makeColumns("Product", shortMetrics, poolKeys, compare)} rows={model.products} rowId={(r) => r.id} />
          </TablePanelBody>
        </ChartPanel>
      ),
    },
    {
      id: "group", size: "M", render: () => (
        <ChartPanel title={`Costs by currency group${suffix}`} height={PANEL_H} flush {...common}>
          <TablePanelBody chip={model.chip}>
            <DataTable<CostRow> label="Costs by currency group" persistKey="cost-group" defaultDensity="compact" hideDensity maxHeight={PANEL_H - CHIP_H}
              columns={makeColumns("Currency group", shortMetrics, poolKeys, compare)} rows={model.groups} rowId={(r) => r.id}
              getChildren={(r) => r.children} isGroupRow={(r) => !!r.children} />
          </TablePanelBody>
        </ChartPanel>
      ),
    },
  ];

  return (
    <>
      <ToolbarContext>
        <DateRange value={range} onChange={setRange} />
        <FilterButton count={activeFilterCount(filters)} expanded={showFilters} onClick={() => setShowFilters(!showFilters)} />
        <ExportMenu />
      </ToolbarContext>
      <div className="ea-page">
        <PageHeader title="Run report" />
        <TabBar label="Cost analysis view" value={tab} onChange={(id) => setTab(id as "cost" | "benchmark")} tabs={[{ id: "cost", label: "Cost" }, { id: "benchmark", label: "Benchmark" }]} />
        {showFilters && <FilterBar filters={FILTERS} values={filters} onChange={(id, v) => setFilters({ ...filters, [id]: v })} onClear={() => setFilters({})} />}
        <p className="ea-caption" style={{ margin: 0 }}>Average and median are coloured because lower cost is better; the sign is always shown. Other metrics have no better direction and stay neutral.</p>
        <PanelGrid id="cost-analysis" panels={panels} />
      </div>
    </>
  );
}
