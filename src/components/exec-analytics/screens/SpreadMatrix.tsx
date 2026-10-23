import { useMemo, useState } from "react";
import { DataTable, heatStyle, percentileAbs, type Column } from "../table";
import { PageHeader, Toggle } from "../ui";
import { ExportMenu, FilterBar, FilterButton, DateRange, ToolbarContext, activeFilterCount, useDateRange, useInitialLoad, usePreviewState, usePrefs } from "../shell";
import { formatFull, formatNumber } from "../lib/format";
import { usePersisted } from "../lib/persist";
import { useEa } from "../ui/context";
import type { CurrencyGroup } from "../data/mock";
import { GROUPS, buildMatrix, type MatrixRow } from "./spread-matrix/data";

const NAME_MAX = 24;
const FILTERS = [{ id: "group", label: "Currency group", options: GROUPS as string[] }];
const MAX_PCT = 45; // matches heatStyle's upper fill

const truncate = (s: string) => (s.length > NAME_MAX ? `${s.slice(0, NAME_MAX - 1)}…` : s);

function Legend({ limit }: { limit: number }) {
  const worse = `color-mix(in srgb, var(--data-worse) ${MAX_PCT}%, var(--color-surface))`;
  const better = `color-mix(in srgb, var(--data-better) ${MAX_PCT}%, var(--color-surface))`;
  return (
    <div role="group" aria-label="Heatmap legend" style={{ display: "flex", alignItems: "center", gap: 8 }} className="ea-caption">
      <span>Lower is better</span>
      <div style={{ display: "flex", flexDirection: "column", width: 160 }}>
        <div aria-hidden style={{ height: 10, border: "1px solid var(--color-border)", background: `linear-gradient(to right, ${better}, var(--color-surface), ${worse})` }} />
        <div className="ea-num" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{formatNumber(-limit, "bps-signed")}</span><span>0.00</span><span>{formatNumber(limit, "bps-signed")}</span>
        </div>
      </div>
      <span>bps</span>
    </div>
  );
}

export default function SpreadMatrix() {
  const loadingInitial = useInitialLoad();
  const preview = usePreviewState();
  const { setPrefs } = usePrefs();
  const { colorBlindSafe } = useEa();
  const [range, setRange] = useDateRange("spread-matrix");
  const [filters, setFilters] = usePersisted<Record<string, string>>("filter.spreadmatrix", {});
  const [showFilters, setShowFilters] = usePersisted<boolean>("filter.spreadmatrix.open", false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const group = (filters.group ?? "All") as CurrencyGroup | "All";
  const groups = group === "All" ? GROUPS : [group];
  const { rows, average, pairs } = useMemo(() => buildMatrix(groups), [group]); // eslint-disable-line react-hooks/exhaustive-deps
  const limit = useMemo(() => percentileAbs(rows.flatMap((r) => Object.values(r.vals)), 0.95), [rows]);

  const columns = useMemo<Column<MatrixRow>[]>(() => {
    const first: Column<MatrixRow> = {
      id: "name", header: "Counterparty", headerText: "Counterparty", sticky: true, sortable: true, width: 190,
      accessor: (r) => r.name,
      render: (r) => <span style={{ fontWeight: r.id === "avg" ? 600 : undefined, cursor: r.id === "avg" ? undefined : "pointer" }}>{truncate(r.name)}</span>,
      title: (r) => (r.name.length > NAME_MAX ? r.name : undefined),
    };
    const cols = pairs.map<Column<MatrixRow>>((p) => ({
      id: p.pair, header: p.pair, headerText: p.pair, group: p.group, sortable: true, format: "bps-signed", width: 84,
      accessor: (r) => r.vals[p.pair],
      cellStyle: (r) => {
        const v = r.vals[p.pair];
        if (r.id === "avg" || v === null || v === undefined) return null;
        const h = heatStyle(v, limit, "lower");
        if (!h) return null;
        return { style: h.style, hatch: h.worse, glyph: h.clipped ? "▲" : undefined, title: h.clipped ? `${formatFull(v)} bps (colour clipped at the 95th percentile)` : undefined };
      },
    }));
    return [first, ...cols];
  }, [pairs, limit]);

  const loading = loadingInitial || preview === "loading";
  const empty = preview === "empty" || pairs.length === 0;
  const error = preview === "error" ? "Could not load the spread matrix." : undefined;

  return (
    <>
      <ToolbarContext>
        <DateRange value={range} onChange={setRange} />
        <FilterButton count={activeFilterCount(filters)} expanded={showFilters} onClick={() => setShowFilters(!showFilters)} />
        <ExportMenu />
      </ToolbarContext>
      <div className="ea-page">
        <PageHeader title="Spread matrix" />
        {showFilters && <FilterBar filters={FILTERS} values={filters} onChange={(id, v) => setFilters({ ...filters, [id]: v })} onClear={() => setFilters({})} />}
        <DataTable<MatrixRow>
          label="Total actual spread by counterparty and instrument"
          persistKey="spread-matrix" defaultDensity="compact" grid
          columns={columns} rows={empty || error ? [] : rows} rowId={(r) => r.id}
          pinnedRow={empty || error ? undefined : average}
          maxHeight="calc(100vh - 220px)"
          loading={loading} error={error} onRetry={() => setPrefs({ previewState: "none" })}
          empty={{ title: "No spreads for this selection", hint: "Try a different currency group or date range." }}
          onRowClick={(r) => setActiveId((a) => (a === r.id ? null : r.id))}
          rowClassActive={(r) => r.id === activeId}
          title={<span className="ea-section-title">Total actual spread (bps)</span>}
          toolbarEnd={
            <>
              <Legend limit={limit} />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }} className="ea-caption">
                Colour-blind safe
                <Toggle label="Colour-blind safe" checked={colorBlindSafe} onChange={(v) => setPrefs({ colorBlindSafe: v })} />
              </label>
            </>
          }
        />
      </div>
    </>
  );
}
