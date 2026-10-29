import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type ModelUpdatedEvent,
  type RowClassParams,
  type RowSelectionOptions,
  type RowStyle,
  type SelectionChangedEvent,
  type SelectionColumnDef,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { MARKET_BY_ID, type Instruction } from "./model";
import { BUCKET_COLOR, FOCUS, dateShort, days1, gbp0, gbp0Signed, num0 } from "./format";
import { ClearButton, EmptyState, Seg, StatusChip, Swatch } from "./ui";

// Enterprise bundle (includes Community), registered the same way as the
// other AG Grid pages. No licence key is set, so the grid runs in evaluation
// mode and logs the standard watermark notice.
ModuleRegistry.registerModules([AllEnterpriseModule]);

/* The fails blotter: every failing instruction in the slice, on AG Grid.
 *
 * Rows arrive already scoped by the header filters and the ageing-matrix
 * cross-filter. The grid adds its own quick-filter search, floating column
 * filters and an optional group-by-counterparty view; the pinned totals row
 * follows whatever survives those, so the footer always describes the rows
 * you can see. Bulk actions are recorded by the page and shown back here as
 * a marker on the trade reference. */

export type ActionKind = "chase" | "escalate" | "partial";
export type BlotterRow = Instruction & { action: ActionKind | null };

type Row = BlotterRow;
type VFP = ValueFormatterParams<Row, number>;

const ACTION_LABEL: Record<ActionKind, string> = { chase: "Chased", escalate: "Escalated", partial: "Partial req." };
const ACTION_CHIP: Record<ActionKind, string> = {
  chase: "border-sky-200 bg-sky-50 text-sky-800",
  escalate: "border-rose-200 bg-rose-50 text-rose-800",
  partial: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

interface Totals {
  n: number;
  value: number;
  perDay: number;
  cum: number;
  avgAge: number;
}

function totalsOf(rows: Row[]): Totals {
  const n = rows.length;
  return {
    n,
    value: rows.reduce((s, r) => s + r.value, 0),
    perDay: rows.reduce((s, r) => s + r.perDay, 0),
    cum: rows.reduce((s, r) => s + r.cum, 0),
    avgAge: n > 0 ? rows.reduce((s, r) => s + r.age, 0) / n : 0,
  };
}

/* ---- cell renderers ---------------------------------------------- */

function RefCell({ value, data, node }: ICellRendererParams<Row, string>) {
  if (node.rowPinned) return <span className="font-semibold text-neutral-900">{value}</span>;
  if (!data) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-neutral-800">{value}</span>
      {data.action && (
        <span className={`border px-1 text-[9px] font-semibold tracking-wide uppercase ${ACTION_CHIP[data.action]}`}>
          {ACTION_LABEL[data.action]}
        </span>
      )}
    </span>
  );
}

function AgeCell({ value, data, node }: ICellRendererParams<Row, number>) {
  if (value == null) return null;
  if (node.rowPinned) return <span className="font-mono text-[11px] tabular-nums">avg {days1(value)}</span>;
  // Group rows carry the max age of their members.
  const bucket = data ? data.bucket : value <= 0 ? 0 : value === 1 ? 1 : value <= 3 ? 2 : value <= 7 ? 3 : 4;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums" title={data ? `${value} business day${value === 1 ? "" : "s"} since ISD` : `Oldest ${value}d`}>
      <Swatch color={BUCKET_COLOR[bucket]} className="h-2 w-2" />
      {data ? `${value}d` : `max ${value}d`}
    </span>
  );
}

function StatusCell({ data, node }: ICellRendererParams<Row, string>) {
  if (node.rowPinned || !data) return null;
  return <StatusChip status={data.status} />;
}

function NoRows() {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3 text-center text-[12px] text-neutral-500">
      <div className="font-semibold text-neutral-800">No instructions match</div>
      <div className="mt-0.5">Clear the search or a column filter to widen the blotter.</div>
    </div>
  );
}

/* ---- formatters -------------------------------------------------- */

const MONO = "font-mono tabular-nums";
const int = (p: VFP) => (p.value == null ? "" : num0(p.value));
const money = (p: VFP) => (p.value == null ? "" : gbp0(p.value));
const accrual = (p: VFP) => (p.value == null ? "" : p.value === 0 ? "—" : gbp0Signed(p.value));

/* ---- grid -------------------------------------------------------- */

export function FailsBlotter({
  rows,
  total,
  focusLabel,
  onClearFocus,
  onAction,
  notice,
  onUndo,
  onDismiss,
}: {
  rows: Row[];
  /** Rows in the page slice before the matrix cross-filter. */
  total: number;
  focusLabel: string | null;
  onClearFocus: () => void;
  onAction: (rows: Row[], kind: ActionKind) => void;
  notice: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const apiRef = useRef<GridApi<Row> | null>(null);
  const [quick, setQuick] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [selected, setSelected] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals>(() => totalsOf(rows));

  // Fixed height with internal scroll, shrinking for small slices.
  const height = Math.min(600, Math.max(260, 30 + 28 + 28 * (rows.length + 1) + 4));

  const theme = useMemo(
    () =>
      themeQuartz.withParams({
        accentColor: "#171717",
        backgroundColor: "#ffffff",
        foregroundColor: "#171717",
        borderColor: "#e5e5e5",
        chromeBackgroundColor: "#fafafa",
        headerBackgroundColor: "#fafafa",
        headerTextColor: "#525252",
        headerFontWeight: 600,
        oddRowBackgroundColor: "#fcfcfc",
        rowHoverColor: "#f5f5f5",
        selectedRowBackgroundColor: "#e5e5e5",
        fontFamily: "inherit",
        fontSize: 11,
        headerFontSize: 10,
        cellHorizontalPadding: 8,
        spacing: 4,
        // Square, per the workspace's zero-radius rule.
        borderRadius: 0,
        wrapperBorderRadius: 0,
        buttonBorderRadius: 0,
        inputBorderRadius: 0,
        checkboxBorderRadius: 0,
        iconButtonBorderRadius: 0,
        rowBorder: true,
        columnBorder: false,
      }),
    [],
  );

  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { headerName: "Trade ref", field: "id", pinned: "left", width: 182, filter: "agTextColumnFilter", cellRenderer: RefCell },
      {
        headerName: "Counterparty",
        field: "counterparty",
        width: 176,
        filter: "agSetColumnFilter",
        rowGroup: grouped,
        hide: grouped,
      },
      { headerName: "ISIN", field: "isin", width: 126, filter: "agTextColumnFilter", cellClass: `${MONO} text-neutral-600` },
      { headerName: "Security", field: "security", minWidth: 170, flex: 1, filter: "agTextColumnFilter" },
      {
        headerName: "Market",
        colId: "market",
        width: 120,
        filter: "agSetColumnFilter",
        // The pinned totals row has data with no market, so guard the field, not the row.
        valueGetter: (p: ValueGetterParams<Row>) => (p.data?.market ? MARKET_BY_ID[p.data.market].label : ""),
      },
      { headerName: "Direction", field: "direction", width: 88, filter: "agSetColumnFilter" },
      { headerName: "Quantity", field: "quantity", type: "numericColumn", width: 100, filter: "agNumberColumnFilter", valueFormatter: int, cellClass: MONO },
      { headerName: "Value £", field: "value", type: "numericColumn", width: 112, sort: "desc", filter: "agNumberColumnFilter", valueFormatter: money, cellClass: MONO, aggFunc: "sum" },
      {
        headerName: "ISD",
        field: "isd",
        width: 84,
        filter: false,
        valueFormatter: (p: VFP) => (p.value == null ? "" : dateShort(p.value)),
        cellClass: MONO,
      },
      { headerName: "Age", field: "age", type: "numericColumn", width: 88, filter: "agNumberColumnFilter", cellRenderer: AgeCell, aggFunc: "max" },
      { headerName: "Root cause", field: "cause", width: 150, filter: "agSetColumnFilter" },
      { headerName: "Status", field: "status", width: 132, filter: "agSetColumnFilter", cellRenderer: StatusCell },
      { headerName: "Penalty / day £", field: "perDay", type: "numericColumn", width: 110, filter: "agNumberColumnFilter", valueFormatter: accrual, cellClass: MONO, aggFunc: "sum" },
      { headerName: "Cumulative £", field: "cum", type: "numericColumn", width: 112, filter: "agNumberColumnFilter", valueFormatter: accrual, cellClass: MONO, aggFunc: "sum" },
      { headerName: "Owner", field: "owner", width: 104, filter: "agSetColumnFilter" },
    ],
    [grouped],
  );

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({ sortable: true, resizable: true, floatingFilter: true, suppressHeaderMenuButton: true, minWidth: 60 }),
    [],
  );
  const autoGroupColumnDef = useMemo<ColDef<Row>>(
    () => ({ headerName: "Counterparty", pinned: "left", minWidth: 220, cellRendererParams: { suppressCount: false } }),
    [],
  );
  const rowSelection = useMemo<RowSelectionOptions<Row>>(
    () => ({
      mode: "multiRow",
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
      selectAll: "filtered",
      groupSelects: "filteredDescendants",
    }),
    [],
  );
  const selectionColumnDef = useMemo<SelectionColumnDef>(() => ({ width: 36, pinned: "left" }), []);

  const onGridReady = useCallback((e: GridReadyEvent<Row>) => {
    apiRef.current = e.api;
  }, []);

  // Totals follow what is displayed (page slice ∩ search ∩ column filters).
  const onModelUpdated = useCallback((e: ModelUpdatedEvent<Row>) => {
    const shown: Row[] = [];
    e.api.forEachNodeAfterFilter((n) => {
      if (n.data) shown.push(n.data);
    });
    const next = totalsOf(shown);
    setTotals((prev) => (prev.n === next.n && Math.abs(prev.value - next.value) < 1e-9 && Math.abs(prev.cum - next.cum) < 1e-9 ? prev : next));
    // Rows the filters removed drop out of the selection too.
    const sel = e.api.getSelectedRows();
    setSelected((prev) => (prev.length === sel.length && prev.every((r, i) => r.id === sel[i].id) ? prev : sel));
  }, []);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<Row>) => {
    setSelected(e.api.getSelectedRows());
  }, []);

  // A bulk action changes `action` but not the trade-ref value, and the grid
  // only re-renders a cell whose value changed, so the marker column is
  // refreshed by hand whenever the rows are replaced.
  useEffect(() => {
    apiRef.current?.refreshCells({ columns: ["id"], force: true });
  }, [rows]);

  const pinnedBottom = useMemo(
    () => [
      {
        id: `Total · ${totals.n} instruction${totals.n === 1 ? "" : "s"}`,
        value: totals.value,
        perDay: totals.perDay,
        cum: totals.cum,
        age: totals.avgAge,
      } as unknown as Row,
    ],
    [totals],
  );

  const getRowStyle = useCallback(
    (p: RowClassParams<Row>): RowStyle | undefined =>
      p.node.rowPinned ? { background: "#f5f5f5", fontWeight: 600, borderTop: "1px solid #d4d4d4" } : undefined,
    [],
  );

  const act = (kind: ActionKind) => {
    if (selected.length === 0) return;
    onAction(selected, kind);
    apiRef.current?.deselectAll();
  };

  const cptys = new Set(selected.map((r) => r.counterparty)).size;

  return (
    <section aria-labelledby="sf-blotter-title" className="flex flex-col border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <div>
            <h2 id="sf-blotter-title" className="text-sm font-semibold text-neutral-900">
              Fails blotter
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              <span className="font-mono text-neutral-800 tabular-nums">{totals.n}</span> of{" "}
              <span className="font-mono text-neutral-800 tabular-nums">{total}</span> in the slice shown
              {focusLabel && <span> · scoped by the ageing matrix</span>}
            </p>
          </div>
          {focusLabel && <ClearButton onClick={onClearFocus}>Clear {focusLabel}</ClearButton>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg<"flat" | "group">
            label="Layout"
            hideLabel
            size="sm"
            value={grouped ? "group" : "flat"}
            onChange={(v) => setGrouped(v === "group")}
            options={[
              { value: "flat", label: "Flat" },
              { value: "group", label: "By counterparty" },
            ]}
          />
          <label className="relative block">
            <span className="sr-only">Search the blotter</span>
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="Search ref, ISIN, security, counterparty…"
              className={`h-[26px] w-64 border border-neutral-200 bg-white pr-7 pl-7 text-[11px] placeholder:text-neutral-400 ${FOCUS}`}
            />
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="absolute top-1.5 left-2 h-3.5 w-3.5 text-neutral-400">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                clipRule="evenodd"
              />
            </svg>
            {quick && (
              <button
                type="button"
                onClick={() => setQuick("")}
                aria-label="Clear search"
                className={`absolute top-1 right-1 flex h-[18px] w-[18px] items-center justify-center text-neutral-400 hover:text-neutral-800 ${FOCUS}`}
              >
                ✕
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => apiRef.current?.exportDataAsCsv({ fileName: "settlement-fails-blotter.csv" })}
            className={`h-[26px] border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-700 hover:border-neutral-400 ${FOCUS}`}
          >
            Export CSV
          </button>
        </div>
      </header>

      <div aria-live="polite">
        {notice && (
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[11px] text-neutral-800">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" onClick={onUndo} className={`font-semibold underline underline-offset-2 hover:text-neutral-950 ${FOCUS}`}>
              Undo
            </button>
            <button type="button" onClick={onDismiss} aria-label="Dismiss" className={`text-neutral-500 hover:text-neutral-900 ${FOCUS}`}>
              ✕
            </button>
          </div>
        )}
      </div>

      {total === 0 ? (
        <EmptyState title="No failing instructions in this slice" body="Widen the market, asset class or direction filters." />
      ) : (
        <div style={{ height }}>
          <AgGridReact<Row>
            theme={theme}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            autoGroupColumnDef={autoGroupColumnDef}
            groupDisplayType="singleColumn"
            groupDefaultExpanded={0}
            suppressAggFuncInHeader
            rowData={rows}
            getRowId={(p) => p.data.id}
            onGridReady={onGridReady}
            onModelUpdated={onModelUpdated}
            onSelectionChanged={onSelectionChanged}
            rowSelection={rowSelection}
            selectionColumnDef={selectionColumnDef}
            quickFilterText={quick}
            pinnedBottomRowData={pinnedBottom}
            getRowStyle={getRowStyle}
            noRowsOverlayComponent={NoRows}
            rowHeight={28}
            headerHeight={30}
            floatingFiltersHeight={28}
            animateRows
            tooltipShowDelay={300}
          />
        </div>
      )}

      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white"
        >
          <span className="px-1 font-semibold">
            <span className="font-mono tabular-nums">{num0(selected.length)}</span> selected
            <span className="font-normal text-neutral-400"> · {cptys} counterpart{cptys === 1 ? "y" : "ies"}</span>
          </span>
          <span className="px-1 text-neutral-600" aria-hidden>
            ·
          </span>
          <button type="button" onClick={() => act("chase")} className={`border border-neutral-700 px-2 py-1 font-medium hover:bg-neutral-800 ${FOCUS}`}>
            Chase counterparty
          </button>
          <button type="button" onClick={() => act("escalate")} className={`border border-neutral-700 px-2 py-1 font-medium hover:bg-neutral-800 ${FOCUS}`}>
            Escalate
          </button>
          <button
            type="button"
            onClick={() => act("partial")}
            title="Request partial settlement of whatever stock is available"
            className={`bg-white px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-200 ${FOCUS}`}
          >
            Partial settle
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.deselectAll()}
            aria-label="Clear selection"
            className={`ml-auto px-2 py-1 text-neutral-400 hover:text-white ${FOCUS}`}
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
