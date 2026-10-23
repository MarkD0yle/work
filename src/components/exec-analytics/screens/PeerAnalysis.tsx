import { useMemo, useState } from "react";
import { Chart, ChartPanel, PanelGrid, chartColors, type PanelDef } from "../chart";
import { DataTable, heatStyle, percentileAbs, type Column } from "../table";
import { DateRange, ExportMenu, FilterBar, FilterButton, LastLoaded, RefreshButton, ToolbarContext, activeFilterCount, useDateRange, useInitialLoad, usePreviewState, useRefresh, type FilterDef } from "../shell";
import { PageHeader, TabBar } from "../ui";
import { useEa } from "../ui/context";
import { daysBetween } from "../lib/dates";
import { formatNumber } from "../lib/format";
import { usePersisted } from "../lib/persist";
import { cpIndex } from "../data/mock";
import { catColor } from "../tokens";
import { bubbleOptions, parCurveOptions, pawrBarOptions, type BubbleSpec } from "./peer-analysis/charts";
import { SIZE_BUCKETS, TIERS, buildMatrix, buildParCurve, buildPeerStats, type MatrixRow, type PeerStat } from "./peer-analysis/mock";

const FILTERS: FilterDef[] = [{ id: "tier", label: "Liquidity tier", options: TIERS }];
const NO_HIDDEN = new Set<string>();
const CHART_H = 400;
const PAGE_TABS = [{ id: "summary", label: "Summary" }, { id: "leaderboard", label: "Leaderboard" }];
const MATRIX_TABS = [{ id: "instrument", label: "Instrument" }, { id: "tenor", label: "Tenor" }];
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

type Rank = PeerStat & { rank: number };

export default function PeerAnalysis() {
  const initial = useInitialLoad();
  const preview = usePreviewState();
  const { theme } = useEa();
  const c = useMemo(() => chartColors(theme), [theme]);
  const { loadedAt, refreshing, refresh } = useRefresh();
  const [range, setRange] = useDateRange("peer");
  const [tab, setTab] = usePersisted("tab.peer", "summary");
  const [matrixTab, setMatrixTab] = usePersisted("tab.peer.matrix", "instrument");
  const [filters, setFilters] = usePersisted<Record<string, string>>("filter.peer", {});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRaw, setSelected] = useState<string | null>(null);

  const loading = initial || preview === "loading";
  const error = preview === "error" ? "Could not load peer analysis. Check your connection and retry." : undefined;
  const days = Math.max(1, daysBetween(range.start, range.end));

  const all = useMemo(() => buildPeerStats(Math.max(0.3, Math.min(2, days / 90))), [days]);
  const stats = useMemo(() => all.filter((s) => (filters.tier ?? "All") === "All" || s.tier === filters.tier), [all, filters.tier]);
  const empty = preview === "empty" || stats.length === 0;
  const selected = selectedRaw && stats.some((s) => s.id === selectedRaw) ? selectedRaw : null;
  const toggleSelect = (id: string) => setSelected((cur) => (cur === id ? null : id));
  const clearFilters = () => setFilters({});
  const emptyCfg = { message: "No counterparties match the current filters", onChangeFilters: () => setShowFilters(true) };

  const ranked = useMemo<Rank[]>(() => [...stats].sort((a, b) => b.pawr - a.pawr).map((s, i) => ({ ...s, rank: i + 1 })), [stats]);
  const selStat = stats.find((s) => s.id === selected) ?? null;

  const common = { loading, error, onRetry: refresh, loadedAt };
  const legend = useMemo(() => stats.map((s) => ({ id: s.id, name: s.name, color: catColor(cpIndex(s.id), theme) })), [stats, theme]);

  const barOpts = useMemo(() => pawrBarOptions(stats, c, selected, toggleSelect), [stats, c, selected]);
  const notionalSpec: BubbleSpec = useMemo(() => ({
    xOf: (s) => s.notional, xFormat: "notional", xTitle: "Notional", midX: median(stats.map((s) => s.notional)), xLabel: "Notional",
    corners: ["Small, high win", "Large, high win", "Small, low win", "Large, low win"],
  }), [stats]);
  const revalSpec: BubbleSpec = useMemo(() => ({
    xOf: (s) => s.reval, xFormat: "bps-signed", xTitle: "Reval 30s (bps)", midX: 0, xLabel: "Reval 30s",
    corners: ["Adverse, high win", "Favourable, high win", "Adverse, low win", "Favourable, low win"],
  }), []);
  const notionalOpts = useMemo(() => bubbleOptions(stats, notionalSpec, c, theme, selected, toggleSelect), [stats, notionalSpec, c, theme, selected]);
  const revalOpts = useMemo(() => bubbleOptions(stats, revalSpec, c, theme, selected, toggleSelect), [stats, revalSpec, c, theme, selected]);
  const curve = useMemo(() => (selStat ? buildParCurve(selStat) : null), [selStat]);
  const curveOpts = useMemo(() => (curve ? parCurveOptions(curve, c) : null), [curve, c]);

  const matrix = useMemo(() => buildMatrix(stats, matrixTab === "tenor" ? "tenor" : "instrument"), [stats, matrixTab]);
  const limit = useMemo(() => percentileAbs(matrix.rows.flatMap((r) => Object.values(r.values))), [matrix]);
  const matrixCols = useMemo<Column<MatrixRow>[]>(() => [
    { id: "name", header: "Counterparty", headerText: "Counterparty", sticky: true, width: 150, accessor: (r) => r.name, title: (r) => r.name,
      render: (r) => <span style={{ display: "block", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span> },
    ...matrix.columns.map((col): Column<MatrixRow> => ({
      id: col, header: col, headerText: col, format: "bps-signed", width: 76, accessor: (r) => r.values[col],
      cellStyle: (r) => { const h = heatStyle(r.values[col], limit, "higher"); return h ? { style: h.style, hatch: h.worse } : null; },
    })),
  ], [matrix, limit]);

  const bubblePanel = (id: string, title: string, opts: ReturnType<typeof bubbleOptions>, xName: string, xs: (s: PeerStat) => number, xf: "notional" | "bps-signed"): PanelDef => ({
    id, size: "M",
    render: () => (
      <ChartPanel {...common} title={title} height={CHART_H} empty={empty ? emptyCfg : undefined}
        asTable={{ columns: ["Counterparty", xName, "Win rate", "Notional"], rows: stats.map((s) => [s.name, formatNumber(xs(s), xf), formatNumber(s.winRate, "percent"), formatNumber(s.notional, "notional")]) }}>
        {({ height }) => (
          <Chart height={height} options={opts} legend={legend} hiddenIds={NO_HIDDEN} onLegendToggle={toggleSelect}
            summary={`Bubble chart of ${xName.toLowerCase()} against win rate for ${stats.length} counterparties; bubble size is notional. ${selStat ? `${selStat.name} is selected.` : "Click a bubble to select a counterparty."}`} />
        )}
      </ChartPanel>
    ),
  });

  const panels: PanelDef[] = [
    {
      id: "pawr", size: "M",
      render: () => (
        <ChartPanel {...common} title="Par-adjusted win rate" height={CHART_H} empty={empty ? emptyCfg : undefined}
          asTable={{ columns: ["Counterparty", "Par-adjusted win rate (bps)"], rows: ranked.map((s) => [s.name, formatNumber(s.pawr, "bps-signed")]) }}>
          {({ height }) => (
            <Chart height={height} valueFormat="bps-signed" options={barOpts}
              summary={`Horizontal bars of par-adjusted win rate by counterparty, highest first. ${ranked[0] ? `${ranked[0].name} leads at ${formatNumber(ranked[0].pawr, "bps-signed")} bps.` : ""}`} />
          )}
        </ChartPanel>
      ),
    },
    bubblePanel("notional", "Notional vs win rate", notionalOpts, "Notional", notionalSpec.xOf, "notional"),
    bubblePanel("reval", "Reval 30s vs win rate", revalOpts, "Reval 30s (bps)", revalSpec.xOf, "bps-signed"),
    {
      id: "par", size: "M",
      render: () => (
        <ChartPanel {...common} title={selStat ? `Par curve: ${selStat.name}` : "Par curve (selected counterparty)"} height={CHART_H}
          empty={empty ? emptyCfg : !selStat ? { message: "Select a counterparty" } : undefined}
          asTable={curve ? { columns: ["Trade size", "Under", "Par", "Above"], rows: SIZE_BUCKETS.map((b, i) => [b, formatNumber(curve.under[i], "percent"), formatNumber(curve.par[i], "percent"), formatNumber(curve.above[i], "percent")]) } : undefined}>
          {({ height }) => curveOpts && (
            <Chart height={height} valueFormat="percent" options={curveOpts}
              legend={[{ id: "Under", name: "Under", color: c.neutral[2] }, { id: "Par", name: "Par", color: c.muted }, { id: "Above", name: "Above", color: c.neutral[5] }]}
              summary={`Win rate by trade size for ${selStat?.name ?? "the selected counterparty"} when quoted under, at and above par.`} />
          )}
        </ChartPanel>
      ),
    },
    {
      id: "matrix", size: "L",
      render: () => (
        <ChartPanel {...common} title="Win-rate matrix" flush height={CHART_H} empty={empty ? emptyCfg : undefined}
          tabs={{ tabs: MATRIX_TABS, value: matrixTab, onChange: setMatrixTab, label: "Matrix dimension" }}
          asTable={{ columns: ["Counterparty", ...matrix.columns], rows: matrix.rows.map((r) => [r.name, ...matrix.columns.map((col) => formatNumber(r.values[col], "bps-signed"))]) }}>
          {() => (
            <DataTable<MatrixRow> label={`Par-adjusted win rate by counterparty and ${matrixTab}`} grid hideDensity defaultDensity="compact" persistKey="peer.matrix"
              columns={matrixCols} rows={matrix.rows} rowId={(r) => r.id} maxHeight={CHART_H}
              onRowClick={(r) => toggleSelect(r.id)} rowClassActive={(r) => r.id === selected} />
          )}
        </ChartPanel>
      ),
    },
  ];

  const boardCols = useMemo<Column<Rank>[]>(() => [
    { id: "rank", header: "Rank", headerText: "Rank", format: "count", width: 64, sortable: true, accessor: (r) => r.rank },
    {
      id: "change", header: "Change", headerText: "Rank change", width: 80, sortable: true, accessor: (r) => r.prevRank - r.rank,
      render: (r) => { const d = r.prevRank - r.rank; return d === 0 ? <span title="No change">{"– 0"}</span> : <span title={d > 0 ? "Moved up" : "Moved down"}>{d > 0 ? "▲ +" : "▼ −"}{formatNumber(Math.abs(d), "count")}</span>; },
    },
    { id: "name", header: "Counterparty", headerText: "Counterparty", sortable: true, width: 200, accessor: (r) => r.name, title: (r) => r.name,
      render: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: 220 }}><span className="ea-swatch" style={{ background: catColor(cpIndex(r.id), theme) }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span></span> },
    { id: "pawr", header: "PAWR (bps)", headerText: "Par-adjusted win rate", format: "bps-signed", sortable: true, accessor: (r) => r.pawr },
    { id: "win", header: "Win rate", format: "percent", sortable: true, accessor: (r) => r.winRate },
    { id: "notional", header: "Notional", format: "notional", sortable: true, accessor: (r) => r.notional },
    { id: "reval", header: "Reval 30s (bps)", headerText: "Reval 30s", format: "bps-signed", sortable: true, accessor: (r) => r.reval },
    { id: "trades", header: "Trades", format: "count", sortable: true, accessor: (r) => r.trades },
  ], [theme]);

  const leaderboard: PanelDef[] = [{
    id: "board", size: "XL",
    render: () => (
      <ChartPanel {...common} title="Counterparty leaderboard" flush height={CHART_H} expandDisabled empty={empty ? emptyCfg : undefined}
        asTable={{ columns: ["Rank", "Counterparty", "PAWR (bps)", "Win rate", "Notional", "Reval 30s (bps)", "Trades"], rows: ranked.map((r) => [formatNumber(r.rank, "count"), r.name, formatNumber(r.pawr, "bps-signed"), formatNumber(r.winRate, "percent"), formatNumber(r.notional, "notional"), formatNumber(r.reval, "bps-signed"), formatNumber(r.trades, "count")]) }}>
        {() => (
          <DataTable<Rank> label="Counterparty leaderboard" persistKey="peer.board" defaultDensity="compact" columns={boardCols} rows={ranked} rowId={(r) => r.id}
            defaultSort={{ id: "rank", dir: "asc" }} onRowClick={(r) => toggleSelect(r.id)} rowClassActive={(r) => r.id === selected} paginate pageSizes={[10, 25]} />
        )}
      </ChartPanel>
    ),
  }];

  return (
    <>
      <ToolbarContext>
        <DateRange value={range} onChange={setRange} />
        <FilterButton count={activeFilterCount(filters)} expanded={showFilters} onClick={() => setShowFilters((v) => !v)} />
        <ExportMenu />
        <RefreshButton loadedAt={loadedAt} refreshing={refreshing} onRefresh={refresh} />
      </ToolbarContext>
      <div className="ea-page">
        <PageHeader title="Peer analysis" right={<LastLoaded at={loadedAt} />} />
        <TabBar tabs={PAGE_TABS} value={tab} onChange={setTab} label="Peer analysis views" />
        {showFilters && <FilterBar filters={FILTERS} values={filters} onChange={(id, v) => setFilters((f) => ({ ...f, [id]: v }))} onClear={clearFilters} />}
        {tab === "summary" ? <PanelGrid id="peer-summary" panels={panels} /> : <PanelGrid id="peer-board" panels={leaderboard} />}
      </div>
    </>
  );
}
