import { useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  themeQuartz,
  type AdvancedFilterBuilderVisibleChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { ROWS, type Row } from "./native";
import "./native-filter.css";

// Enterprise bundle (includes Community). No licence key is set, so the grid
// runs in evaluation mode and logs the standard watermark notice.
ModuleRegistry.registerModules([AllEnterpriseModule]);

/* Ledgerline transactions on AG Grid, filtered by AG Grid Enterprise's own
 * Advanced Filter. Nothing here replaces it: the expression bar and the
 * builder are AG Grid's, configured through grid options and restyled
 * through theme params and native-filter.css. */

const MINOR: Record<string, number> = { JPY: 0 };
const money = (v: number | null | undefined, ccy: string) =>
  v == null ? "" : v.toLocaleString("en-US", { minimumFractionDigits: MINOR[ccy] ?? 2, maximumFractionDigits: MINOR[ccy] ?? 2 });

const STATUS_CHIP: Record<string, string> = {
  Posted: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Unposted: "border-amber-200 bg-amber-50 text-amber-800",
  Reversed: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

function StatusCell({ value }: ICellRendererParams<Row, string>) {
  if (!value) return null;
  return <span className={`border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${STATUS_CHIP[value] ?? ""}`}>{value}</span>;
}

function WarningCell({ value }: ICellRendererParams<Row, string | null>) {
  if (!value) return <span className="text-neutral-300">—</span>;
  return <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-800">{value}</span>;
}

function NoRows() {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3 text-center text-xs text-neutral-500">
      <div className="font-semibold text-neutral-800">No transactions match</div>
      <div className="mt-0.5">Edit the expression, or open the builder to loosen a condition.</div>
    </div>
  );
}

const MONO = "font-mono text-[11px] tabular-nums";

/* Builder copy, through AG Grid's own locale keys. */
const LOCALE: Record<string, string> = {
  advancedFilterBuilderTitle: "Filter builder",
  advancedFilterBuilder: "Builder",
  advancedFilterApply: "Apply",
  advancedFilterBuilderApply: "Apply",
  advancedFilterBuilderCancel: "Cancel",
  advancedFilterBuilderClear: "Clear",
  advancedFilterBuilderAddButtonTooltip: "Add a condition or a group",
  advancedFilterBuilderAddCondition: "Condition",
  advancedFilterBuilderAddJoin: "Group",
  advancedFilterBuilderSelectColumn: "Pick a column",
  advancedFilterBuilderSelectOption: "Pick an operator",
  advancedFilterBuilderEnterValue: "Value…",
  advancedFilterBuilderMoveUpButtonTooltip: "Move up",
  advancedFilterBuilderMoveDownButtonTooltip: "Move down",
  advancedFilterBuilderRemoveButtonTooltip: "Remove",
};

export function NativeFilterGrid({
  barParent,
  onReady,
  onCount,
  onBuilderVisible,
}: {
  /** Where AG Grid renders its expression bar: the page's toolbar. */
  barParent: HTMLElement;
  onReady: (api: GridApi<Row>) => void;
  onCount: (n: number) => void;
  onBuilderVisible: (visible: boolean) => void;
}) {
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
        inputBorder: { color: "#d4d4d4" },
        inputFocusBorder: { color: "#171717" },
        focusShadow: "none",
        // Suggestion lists (expression bar and builder pickers): taller rows
        // and a real shadow, so they read as a menu over the rows beneath.
        listItemHeight: 28,
        dropdownShadow: { offsetY: 8, radius: 24, spread: -8, color: "rgb(0 0 0 / 0.28)" },
        // Advanced Filter builder: one tint per part of a condition.
        advancedFilterBuilderIndentSize: 22,
        advancedFilterBuilderButtonBarBorder: { color: "#e5e5e5" },
        advancedFilterBuilderJoinPillColor: "#e0f2fe",
        advancedFilterBuilderColumnPillColor: "#f5f5f5",
        advancedFilterBuilderOptionPillColor: "#fef3c7",
        advancedFilterBuilderValuePillColor: "#ffffff",
      }),
    [],
  );

  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { field: "id", headerName: "Transaction", pinned: "left", width: 118, cellClass: MONO, cellDataType: "text" },
      { field: "tradeDate", headerName: "Trade date", width: 122, cellClass: MONO, cellDataType: "dateString", sort: "desc" },
      { field: "settleDate", headerName: "Settle date", width: 122, cellClass: MONO, cellDataType: "dateString" },
      { field: "type", headerName: "Type", width: 128, cellDataType: "text" },
      { field: "status", headerName: "Status", width: 104, cellRenderer: StatusCell, cellDataType: "text" },
      { field: "portfolio", headerName: "Portfolio", width: 230, cellDataType: "text", tooltipField: "portfolio" },
      { field: "security", headerName: "Security", width: 260, cellDataType: "text", tooltipField: "security", valueFormatter: (p) => p.value ?? "Cash" },
      { field: "assetClass", headerName: "Asset class", width: 112, cellDataType: "text" },
      { field: "quantity", headerName: "Quantity", width: 118, type: "rightAligned", cellClass: MONO, cellDataType: "number", valueFormatter: (p) => (p.value == null ? "" : p.value.toLocaleString("en-US")) },
      { field: "price", headerName: "Price", width: 104, type: "rightAligned", cellClass: MONO, cellDataType: "number", valueFormatter: (p) => (p.value == null ? "" : p.value.toLocaleString("en-US", { maximumFractionDigits: 4 })) },
      { field: "amount", headerName: "Amount", width: 140, type: "rightAligned", cellClass: MONO, cellDataType: "number", valueFormatter: (p) => money(p.value, p.data?.currency ?? "USD") },
      { field: "currency", headerName: "Currency", width: 88, cellClass: MONO, cellDataType: "text" },
      { field: "warningCode", headerName: "Warning", width: 118, cellRenderer: WarningCell, cellDataType: "text" },
      { field: "origin", headerName: "Origin", width: 100, cellDataType: "text" },
      { field: "createdBy", headerName: "Created by", width: 120, cellDataType: "text" },
      // Hidden, but offered by the Advanced Filter (includeHiddenColumnsInAdvancedFilter).
      { field: "age", headerName: "Age (days)", hide: true, cellDataType: "number" },
      { field: "settleLag", headerName: "Settlement lag (days)", hide: true, cellDataType: "number" },
      { field: "hasWarning", headerName: "Has warning", hide: true, cellDataType: "boolean" },
      { field: "ticker", headerName: "Ticker", hide: true, cellDataType: "text" },
      { field: "isin", headerName: "ISIN", hide: true, cellDataType: "text" },
      { field: "market", headerName: "Market", hide: true, cellDataType: "text" },
      { field: "portfolioId", headerName: "Portfolio ID", hide: true, cellDataType: "text" },
      { field: "portfolioType", headerName: "Portfolio type", hide: true, cellDataType: "text" },
      { field: "manager", headerName: "Manager", hide: true, cellDataType: "text" },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, filter: true }), []);

  const onGridReady = useCallback(
    (e: GridReadyEvent<Row>) => {
      onReady(e.api);
      onCount(e.api.getDisplayedRowCount());
    },
    [onReady, onCount],
  );

  return (
    <div className="af-native h-full">
      <AgGridReact<Row>
        theme={theme}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={ROWS}
        getRowId={(p) => p.data.id}
        onGridReady={onGridReady}
        onModelUpdated={(e) => onCount(e.api.getDisplayedRowCount())}
        enableAdvancedFilter
        includeHiddenColumnsInAdvancedFilter
        advancedFilterParent={barParent}
        advancedFilterBuilderParams={{
          showMoveButtons: true,
          buttons: ["clear", "cancel", "apply"],
          suppressFullScreenButton: true,
          addSelectWidth: 140,
          pillSelectMinWidth: 180,
          pillSelectMaxWidth: 260,
        }}
        onAdvancedFilterBuilderVisibleChanged={(e: AdvancedFilterBuilderVisibleChangedEvent<Row>) => onBuilderVisible(e.visible)}
        localeText={LOCALE}
        noRowsOverlayComponent={NoRows}
        rowHeight={30}
        headerHeight={32}
        tooltipShowDelay={300}
        enableCellTextSelection
        statusBar={{ statusPanels: [{ statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" }] }}
      />
    </div>
  );
}
