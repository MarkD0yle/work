import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type AdvancedFilterModel,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type IRowNode,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import {
  ASSET_LABEL,
  CREATED_BY_LABEL,
  ORIGIN_LABEL,
  PORTFOLIO_TYPE_LABEL,
  STATUS_LABEL,
  TRANSACTIONS,
  TYPE_LABEL,
  testNode,
  type AgModel,
  type Group,
  type Txn,
} from "./model";

// Enterprise bundle (includes Community), registered the same way as the
// other AG Grid pages. No licence key is set, so the grid runs in evaluation
// mode and logs the standard watermark notice.
ModuleRegistry.registerModules([AllEnterpriseModule]);

/* The transactions grid the filter drives.
 *
 * Two engines can run the same filter:
 *  - "builder": the page's own evaluator, through AG Grid's external filter.
 *  - "ag-grid": AG Grid's Advanced Filter, fed the translated
 *    AdvancedFilterModel. Its built-in bar is parked in a hidden element so
 *    the builder stays the only way in.
 * Running both over the same rows is how the translation is checked: the
 * page compares the counts and shows whether they agree. */

export type Engine = "builder" | "ag-grid";

const MINOR: Record<string, number> = { JPY: 0 };
const money = (v: number | null | undefined, ccy: string) =>
  v == null ? "" : v.toLocaleString("en-US", { minimumFractionDigits: MINOR[ccy] ?? 2, maximumFractionDigits: MINOR[ccy] ?? 2 });

const STATUS_CHIP: Record<string, string> = {
  posted: "border-emerald-200 bg-emerald-50 text-emerald-800",
  unposted: "border-amber-200 bg-amber-50 text-amber-800",
  reversed: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

function StatusCell({ value }: ICellRendererParams<Txn, string>) {
  if (!value) return null;
  return <span className={`border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${STATUS_CHIP[value]}`}>{STATUS_LABEL[value]}</span>;
}

function WarningCell({ value }: ICellRendererParams<Txn, string | null>) {
  if (!value) return <span className="text-neutral-300">—</span>;
  return <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-800">{value}</span>;
}

function NoRows() {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3 text-center text-xs text-neutral-500">
      <div className="font-semibold text-neutral-800">No transactions match</div>
      <div className="mt-0.5">Loosen a condition, switch a group to ANY, or turn a condition off.</div>
    </div>
  );
}

const label = (map: Record<string, string>) => (p: ValueFormatterParams<Txn, string | null>) => (p.value ? (map[p.value] ?? p.value) : "");
const MONO = "font-mono text-[11px] tabular-nums";

export function ResultsGrid({
  applied,
  agModel,
  engine,
  onCount,
}: {
  applied: Group;
  agModel: AgModel | null;
  engine: Engine;
  onCount: (n: number) => void;
}) {
  const apiRef = useRef<GridApi<Txn> | null>(null);
  const appliedRef = useRef(applied);
  const engineRef = useRef(engine);
  const [parking, setParking] = useState<HTMLDivElement | null>(null);

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
        fontSize: 12,
        borderRadius: 0,
        wrapperBorderRadius: 0,
        spacing: 6,
      }),
    [],
  );

  const columnDefs = useMemo<ColDef<Txn>[]>(
    () => [
      { field: "id", headerName: "Transaction", pinned: "left", width: 118, cellClass: MONO, cellDataType: "text" },
      { field: "tradeDate", headerName: "Trade date", width: 122, cellClass: MONO, cellDataType: "dateString", sort: "desc" },
      { field: "settleDate", headerName: "Settle date", width: 122, cellClass: MONO, cellDataType: "dateString" },
      { field: "type", headerName: "Type", width: 128, valueFormatter: label(TYPE_LABEL), cellDataType: "text" },
      { field: "status", headerName: "Status", width: 104, cellRenderer: StatusCell, cellDataType: "text" },
      { field: "portfolio", headerName: "Portfolio", width: 230, cellDataType: "text", tooltipField: "portfolio" },
      { field: "security", headerName: "Security", width: 260, cellDataType: "text", tooltipField: "security", valueFormatter: (p) => p.value ?? "Cash" },
      { field: "assetClass", headerName: "Asset class", width: 112, valueFormatter: label(ASSET_LABEL), cellDataType: "text" },
      {
        field: "quantity",
        headerName: "Quantity",
        width: 118,
        type: "rightAligned",
        cellClass: MONO,
        cellDataType: "number",
        valueFormatter: (p) => (p.value == null ? "" : p.value.toLocaleString("en-US")),
      },
      {
        field: "price",
        headerName: "Price",
        width: 104,
        type: "rightAligned",
        cellClass: MONO,
        cellDataType: "number",
        valueFormatter: (p) => (p.value == null ? "" : p.value.toLocaleString("en-US", { maximumFractionDigits: 4 })),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 140,
        type: "rightAligned",
        cellClass: MONO,
        cellDataType: "number",
        valueFormatter: (p) => money(p.value, p.data?.currency ?? "USD"),
      },
      { field: "currency", headerName: "Ccy", width: 70, cellClass: MONO, cellDataType: "text" },
      { field: "warningCode", headerName: "Warning", width: 118, cellRenderer: WarningCell, cellDataType: "text" },
      { field: "origin", headerName: "Origin", width: 100, valueFormatter: label(ORIGIN_LABEL), cellDataType: "text" },
      { field: "createdBy", headerName: "Created by", width: 160, valueFormatter: label(CREATED_BY_LABEL), cellDataType: "text" },
      // Hidden but filterable: the Advanced Filter needs a column for every field.
      { field: "settleLag", headerName: "Settlement lag", hide: true, cellDataType: "number" },
      { field: "age", headerName: "Age", hide: true, cellDataType: "number" },
      { field: "hasWarning", headerName: "Has warning", hide: true, cellDataType: "boolean" },
      { field: "ticker", headerName: "Ticker", hide: true, cellDataType: "text" },
      { field: "isin", headerName: "ISIN", hide: true, cellDataType: "text" },
      { field: "market", headerName: "Market", hide: true, cellDataType: "text" },
      { field: "portfolioId", headerName: "Portfolio ID", hide: true, cellDataType: "text" },
      { field: "portfolioType", headerName: "Portfolio type", hide: true, valueFormatter: label(PORTFOLIO_TYPE_LABEL), cellDataType: "text" },
      { field: "manager", headerName: "Manager", hide: true, cellDataType: "text" },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<Txn>>(() => ({ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: false }), []);

  const isExternalFilterPresent = useCallback(() => engineRef.current === "builder", []);
  const doesExternalFilterPass = useCallback((node: IRowNode<Txn>) => (node.data ? testNode(appliedRef.current, node.data) : true), []);

  const sync = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    if (engineRef.current === "ag-grid") {
      api.setAdvancedFilterModel((agModel as AdvancedFilterModel | null) ?? null);
    } else {
      api.setAdvancedFilterModel(null);
    }
    api.onFilterChanged();
    onCount(api.getDisplayedRowCount());
  }, [agModel, onCount]);

  useEffect(() => {
    appliedRef.current = applied;
    engineRef.current = engine;
    sync();
  }, [applied, engine, sync]);

  const onGridReady = useCallback(
    (e: GridReadyEvent<Txn>) => {
      apiRef.current = e.api;
      sync();
    },
    [sync],
  );

  return (
    <div className="flex h-full flex-col">
      {/* AG Grid's own Advanced Filter bar renders here, out of sight. */}
      <div ref={setParking} hidden aria-hidden />
      <div className="min-h-0 flex-1">
        {parking && (
          <AgGridReact<Txn>
            theme={theme}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowData={TRANSACTIONS}
            getRowId={(p) => p.data.id}
            onGridReady={onGridReady}
            onModelUpdated={(e) => onCount(e.api.getDisplayedRowCount())}
            enableAdvancedFilter
            includeHiddenColumnsInAdvancedFilter
            advancedFilterParent={parking}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            noRowsOverlayComponent={NoRows}
            rowHeight={30}
            headerHeight={32}
            tooltipShowDelay={300}
            enableCellTextSelection
            statusBar={{ statusPanels: [{ statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" }] }}
          />
        )}
      </div>
    </div>
  );
}
