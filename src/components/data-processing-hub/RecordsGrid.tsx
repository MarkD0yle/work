import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type CellKeyDownEvent,
  type ColDef,
  type FilterChangedEvent,
  type FilterModel,
  type GridApi,
  type GridPreDestroyedEvent,
  type GridReadyEvent,
  type GridState,
  type ICellRendererParams,
  type ModelUpdatedEvent,
  type RowClickedEvent,
  type SideBarDef,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { FilterBar, tokens } from "../patterns";
import { STAGES, num, type HubRecord, type SourceId, type Stage } from "./model";
import { RecordStatusMark } from "./ui";

const { button, cx, text } = tokens;

// Enterprise bundle (includes Community), registered the same way as the
// other AG Grid screens. No licence key is set, so the grid runs in
// evaluation mode and logs the standard watermark notice.
ModuleRegistry.registerModules([AllEnterpriseModule]);

/* Records — every record of one source for the selected business date.
 *
 * Search, sort, column filters, pagination and column configuration (the
 * Columns and Filters tabs on the right edge) all come from AG Grid. The
 * whole grid state (filters, sort, page, columns) is handed back to the page
 * when the grid goes away and passed in again as `initialState`, so opening
 * a record and coming back lands on the same view. */

const HEADERS: Record<string, string> = {
  status: "Status",
  id: "Record ID",
  loadId: "Load ID",
  stage: "Processing stage",
  failureReason: "Failure reason",
  recordType: "Record type",
  subject: "Description",
  reference: "Reference",
  account: "Account",
  instrument: "Security ID",
  amount: "Amount",
  currency: "Currency",
  updatedAt: "Last updated",
  loadName: "File or load name",
  lineNo: "Line",
  errorCode: "Error code",
};

function StatusCell({ data }: ICellRendererParams<HubRecord>) {
  return data ? <RecordStatusMark status={data.status} /> : null;
}

function IdCell({ value }: ICellRendererParams<HubRecord, string>) {
  return <span className="font-mono text-[11px] text-neutral-900 underline decoration-neutral-300 underline-offset-2">{value}</span>;
}

function NoRows() {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3 text-center text-xs text-neutral-500">
      <div className="font-semibold text-neutral-800">No records match</div>
      <div className="mt-0.5">Clear the search or remove a filter to see more records.</div>
    </div>
  );
}

type Chip = { key: string; label: string };

/** Turns the grid's filter model into the chips shown above it. */
function chipsOf(model: FilterModel | null | undefined): Chip[] {
  if (!model) return [];
  return Object.entries(model).map(([key, m]) => {
    const header = HEADERS[key] ?? key;
    const f = m as { filterType?: string; values?: (string | null)[]; filter?: unknown; type?: string };
    if (f.filterType === "set" && f.values) return { key, label: `${header}: ${f.values.map((v) => v || "(blank)").join(", ")}` };
    if (f.filter !== undefined && f.filter !== null) return { key, label: `${header}: ${f.type ?? "is"} ${String(f.filter)}` };
    return { key, label: `${header}: filtered` };
  });
}

export function RecordsGrid({
  source,
  rows,
  initialState,
  search,
  onSearch,
  onSaveState,
  onOpen,
}: {
  source: SourceId;
  rows: HubRecord[];
  /** Grid state saved the last time this source's grid was on screen. */
  initialState: GridState | undefined;
  search: string;
  onSearch: (source: SourceId, value: string) => void;
  onSaveState: (source: SourceId, state: GridState) => void;
  onOpen: (record: HubRecord) => void;
}) {
  const apiRef = useRef<GridApi<HubRecord> | null>(null);
  // The grid reads its starting state once, so later saves must not reach it.
  const [startState] = useState(() => initialState);
  const [chips, setChips] = useState<Chip[]>(() => chipsOf(initialState?.filter?.filterModel));
  const [shown, setShown] = useState(rows.length);

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
        rowHoverColor: "#f5f5f5",
        fontFamily: "inherit",
        fontSize: 12,
        headerFontSize: 11,
        cellHorizontalPadding: 10,
        spacing: 5,
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

  const columnDefs = useMemo<ColDef<HubRecord>[]>(() => {
    const col = (field: keyof HubRecord & string, rest: ColDef<HubRecord>): ColDef<HubRecord> => ({ field, headerName: HEADERS[field], ...rest });
    const mono = "font-mono text-[11px] tabular-nums";
    return [
      // The five lead columns, in the order Support reads them.
      col("status", { width: 124, filter: "agSetColumnFilter", cellRenderer: StatusCell }),
      col("id", { width: 208, filter: "agTextColumnFilter", cellRenderer: IdCell }),
      col("loadId", { width: 170, filter: "agSetColumnFilter", cellClass: mono }),
      col("stage", {
        width: 150,
        filter: "agSetColumnFilter",
        comparator: (a: Stage, b: Stage) => STAGES.indexOf(a) - STAGES.indexOf(b),
      }),
      col("failureReason", { minWidth: 280, flex: 1, filter: "agSetColumnFilter", tooltipField: "failureReason" }),
      // Context columns.
      col("recordType", { width: 130, filter: "agSetColumnFilter" }),
      col("subject", { minWidth: 240, flex: 1, filter: "agTextColumnFilter", tooltipField: "subject" }),
      col("reference", { width: 140, filter: "agTextColumnFilter", cellClass: mono }),
      col("account", { width: 120, filter: "agTextColumnFilter", cellClass: mono }),
      col("instrument", { width: 140, filter: "agTextColumnFilter", cellClass: mono }),
      col("amount", {
        width: 140,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        cellClass: mono,
        valueFormatter: (p: ValueFormatterParams<HubRecord, number>) => (p.value == null ? "" : p.value.toLocaleString("en-US", { maximumFractionDigits: 4 })),
      }),
      col("currency", { width: 104, filter: "agSetColumnFilter" }),
      col("updatedAt", { width: 120, filter: false, cellClass: mono }),
      // Technical columns: available in the Columns panel, hidden by default.
      col("loadName", { width: 280, filter: "agSetColumnFilter", hide: true }),
      col("lineNo", { width: 90, type: "numericColumn", filter: "agNumberColumnFilter", cellClass: mono, hide: true }),
      col("errorCode", { width: 120, filter: "agSetColumnFilter", cellClass: mono, hide: true }),
    ];
  }, []);

  const defaultColDef = useMemo<ColDef<HubRecord>>(() => ({ sortable: true, resizable: true, floatingFilter: true, suppressHeaderMenuButton: true, minWidth: 80 }), []);

  const sideBar = useMemo<SideBarDef>(
    () => ({
      toolPanels: [
        {
          id: "columns",
          labelDefault: "Columns",
          labelKey: "columns",
          iconKey: "columns",
          toolPanel: "agColumnsToolPanel",
          // Show and reorder only: no grouping, values or pivot.
          toolPanelParams: { suppressRowGroups: true, suppressValues: true, suppressPivots: true, suppressPivotMode: true },
        },
        { id: "filters", labelDefault: "Filters", labelKey: "filters", iconKey: "filter", toolPanel: "agFiltersToolPanel" },
      ],
    }),
    [],
  );

  const onGridReady = useCallback((e: GridReadyEvent<HubRecord>) => {
    apiRef.current = e.api;
  }, []);

  const onGridPreDestroyed = useCallback((e: GridPreDestroyedEvent<HubRecord>) => onSaveState(source, e.state), [onSaveState, source]);

  const onFilterChanged = useCallback((e: FilterChangedEvent<HubRecord>) => setChips(chipsOf(e.api.getFilterModel())), []);

  const onModelUpdated = useCallback((e: ModelUpdatedEvent<HubRecord>) => {
    let n = 0;
    e.api.forEachNodeAfterFilter(() => {
      n += 1;
    });
    setShown(n);
  }, []);

  const open = useCallback(
    (api: GridApi<HubRecord>, record: HubRecord) => {
      // Saved here as well as on destroy, so the state is in place before the
      // page swaps the grid for the record.
      onSaveState(source, api.getState());
      onOpen(record);
    },
    [onOpen, onSaveState, source],
  );

  const onRowClicked = useCallback((e: RowClickedEvent<HubRecord>) => e.data && open(e.api, e.data), [open]);

  const onCellKeyDown = useCallback(
    (e: CellKeyDownEvent<HubRecord>) => {
      if ((e.event as KeyboardEvent | undefined)?.key === "Enter" && e.data) open(e.api, e.data);
    },
    [open],
  );

  const removeFilter = (key: string) => {
    const api = apiRef.current;
    if (!api) return;
    const next = { ...api.getFilterModel() };
    delete next[key];
    api.setFilterModel(next);
  };

  const clearFilters = () => {
    apiRef.current?.setFilterModel(null);
    onSearch(source, "");
  };

  const resetView = () => {
    const api = apiRef.current;
    if (!api) return;
    api.resetColumnState();
    api.setFilterModel(null);
    api.paginationGoToFirstPage();
    onSearch(source, "");
  };

  const active = [
    ...(search ? [{ key: "search", label: `Search: ${search}`, onRemove: () => onSearch(source, "") }] : []),
    ...chips.map((c) => ({ ...c, onRemove: () => removeFilter(c.key) })),
  ];

  return (
    <section aria-label={`${source} records`} className={cx("flex min-h-0 flex-1 flex-col", tokens.surface.card, tokens.border.default)}>
      <FilterBar
        search={search}
        onSearch={(v) => onSearch(source, v)}
        searchPlaceholder="Search record ID, load, reason, description…"
        active={active}
        onClearAll={clearFilters}
        trailing={
          <>
            <span aria-live="polite" className={text.muted}>
              <span className="font-medium text-neutral-800 tabular-nums">{num(shown)}</span> of <span className="tabular-nums">{num(rows.length)}</span> records
            </span>
            <button type="button" onClick={resetView} className={button.secondary} title="Clear search and filters, and put columns back to their default order, width and visibility">
              Reset view
            </button>
          </>
        }
      />
      <div className="min-h-0 flex-1">
        <AgGridReact<HubRecord>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => p.data.id}
          initialState={startState}
          quickFilterText={search}
          sideBar={sideBar}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100]}
          onGridReady={onGridReady}
          onGridPreDestroyed={onGridPreDestroyed}
          onFilterChanged={onFilterChanged}
          onModelUpdated={onModelUpdated}
          onRowClicked={onRowClicked}
          onCellKeyDown={onCellKeyDown}
          noRowsOverlayComponent={NoRows}
          rowClass="cursor-pointer"
          rowHeight={34}
          headerHeight={34}
          floatingFiltersHeight={32}
          tooltipShowDelay={300}
        />
      </div>
    </section>
  );
}
