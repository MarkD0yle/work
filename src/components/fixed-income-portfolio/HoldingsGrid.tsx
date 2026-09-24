import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
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
  type RowStyle,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { COLORS, bucketOf, fmt, type Holding } from "./model";

// Enterprise bundle (includes Community), registered the same way as the
// Asset Screener and Blotter pages. No licence key is set, so the grid runs in
// evaluation mode and logs the standard watermark notice.
ModuleRegistry.registerModules([AllEnterpriseModule]);

/* Holdings grid: the only AG Grid on the dashboard set.
 *
 * Rows arrive already cross-filtered by the page. The grid adds its own
 * quick-filter search and floating column filters on top, and the pinned
 * totals row is computed from whatever survives those, so the grid's footer
 * always describes the rows you can see.
 */

type Row = Holding;
type VFP = ValueFormatterParams<Row, number>;

interface Totals {
  n: number;
  mv: number;
  weight: number;
  active: number;
  ytw: number | null;
  modDur: number | null;
  oas: number | null;
  dv01: number;
}

function totalsOf(rows: Row[]): Totals {
  const w = rows.reduce((a, r) => a + r.weight, 0);
  const avg = (get: (r: Row) => number) => (w > 0 ? rows.reduce((a, r) => a + r.weight * get(r), 0) / w : null);
  return {
    n: rows.length,
    mv: rows.reduce((a, r) => a + r.mv, 0),
    weight: w,
    active: rows.reduce((a, r) => a + r.active, 0),
    ytw: avg((r) => r.ytw),
    modDur: avg((r) => r.modDur),
    oas: avg((r) => r.oas),
    dv01: rows.reduce((a, r) => a + r.dv01, 0),
  };
}

/* ---- cell renderers ---------------------------------------------- */

const RATING_RAMP: Record<string, string> = {
  AAA: "#dbeafe",
  AA: "#bfdbfe",
  A: "#93c5fd",
  BBB: "#3b82f6",
  BB: "#1d4ed8",
  NR: "#d4d4d4",
};

function RatingCell({ data, node }: ICellRendererParams<Row, string>) {
  if (!data || node.rowPinned) return null;
  const bucket = data.sector === "Gilts" ? "AA" : bucketOf(data.notch);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: RATING_RAMP[bucket] }} />
      <span className="font-mono text-[12px]">{data.rating}</span>
    </span>
  );
}

function IssuerCell({ data, node, value }: ICellRendererParams<Row, string>) {
  if (node.rowPinned) return <span className="font-semibold text-neutral-900">{value}</span>;
  if (!data) return null;
  // Marker colour matches the hero chart's dot series; a hollow marker means off-index.
  const color = data.sector === "Gilts" || data.sector === "Supranational" ? COLORS.cat1 : COLORS.cat2;
  const off = data.benchWeight === 0;
  return (
    <span className="flex min-w-0 items-center gap-2" title={off ? `${value} · off-index holding` : (value ?? undefined)}>
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0"
        style={off ? { boxShadow: `inset 0 0 0 2px ${color}` } : { background: color }}
      />
      <span className="truncate font-medium text-neutral-900">{value}</span>
      {off && <span className="sr-only">, off-index</span>}
    </span>
  );
}

function ActiveCell(p: ICellRendererParams<Row, number> & { maxAbs: number }) {
  const v = p.value ?? 0;
  const label = fmt.signed(v, 2);
  // Summed active weight across held lines is not a meaningful figure, so the totals row leaves it blank.
  if (p.node.rowPinned) return null;
  const half = Math.min(1, Math.abs(v) / (p.maxAbs || 1)) * 50;
  return (
    <div className="flex h-full items-center gap-2" title={`${label}pp vs benchmark`}>
      <div className="relative h-3 flex-1 bg-neutral-100" aria-hidden>
        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-400" />
        <div
          className="absolute inset-y-0"
          style={{
            left: v >= 0 ? "50%" : `${50 - half}%`,
            width: `${half}%`,
            background: v >= 0 ? COLORS.over : COLORS.under,
          }}
        />
      </div>
      <span className="w-11 text-right font-mono text-[12px] text-neutral-800 tabular-nums">{label}</span>
    </div>
  );
}

function NoRows() {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3 text-center text-[12px] text-neutral-500">
      <div className="font-semibold text-neutral-800">No holdings in this slice</div>
      <div className="mt-0.5">Remove a cross-filter chip or clear the search to widen it.</div>
    </div>
  );
}

/* ---- formatters -------------------------------------------------- */

const num = (dp: number, suffix = "") => (p: VFP) => (p.value == null ? "" : `${fmt[`n${dp as 0 | 1 | 2 | 3}`](p.value)}${suffix}`);
const RATING_RANK = (r: Row | undefined) => (!r ? 99 : r.notch <= 0 ? 50 : r.notch);

/* ---- grid -------------------------------------------------------- */

export function HoldingsGrid({
  rows,
  maxAbsActive,
  toolbar,
  maxHeight = 520,
}: {
  rows: Row[];
  maxAbsActive: number;
  toolbar: ReactNode;
  maxHeight?: number;
}) {
  // Fixed height with internal scroll, shrinking for small slices so a
  // nine-line result does not sit in a mostly empty box.
  const height = Math.min(maxHeight, Math.max(240, 34 + 32 + 32 * (rows.length + 1) + 4));
  const apiRef = useRef<GridApi<Row> | null>(null);
  const [quick, setQuick] = useState("");
  const [totals, setTotals] = useState<Totals>(() => totalsOf(rows));

  const theme = useMemo(
    () =>
      themeQuartz.withParams({
        accentColor: COLORS.accent,
        backgroundColor: "#ffffff",
        foregroundColor: "#171717",
        borderColor: "#e5e5e5",
        chromeBackgroundColor: "#fafafa",
        headerBackgroundColor: "#fafafa",
        headerTextColor: "#525252",
        headerFontWeight: 600,
        oddRowBackgroundColor: "#fcfcfc",
        rowHoverColor: "#eff6ff",
        selectedRowBackgroundColor: "#dbeafe",
        fontFamily: "inherit",
        fontSize: 12,
        headerFontSize: 11,
        cellHorizontalPadding: 10,
        spacing: 6,
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
      {
        headerName: "Issuer",
        field: "issuer",
        pinned: "left",
        minWidth: 196,
        flex: 1,
        filter: "agTextColumnFilter",
        cellRenderer: IssuerCell,
      },
      {
        headerName: "ISIN",
        field: "id",
        width: 124,
        filter: "agTextColumnFilter",
        cellClass: "font-mono text-neutral-600",
        valueFormatter: (p: ValueFormatterParams<Row, string>) => (p.node?.rowPinned ? "" : (p.value ?? "")),
      },
      { headerName: "Sector", field: "sector", width: 112, filter: "agSetColumnFilter" },
      {
        headerName: "Rating",
        field: "rating",
        width: 86,
        filter: "agSetColumnFilter",
        cellRenderer: RatingCell,
        comparator: (_a, _b, na, nb) => RATING_RANK(na.data) - RATING_RANK(nb.data),
      },
      {
        headerName: "Coupon",
        field: "coupon",
        type: "numericColumn",
        width: 84,
        filter: "agNumberColumnFilter",
        valueFormatter: num(3),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "Maturity",
        field: "maturity",
        width: 106,
        filter: "agTextColumnFilter",
        valueFormatter: (p: ValueFormatterParams<Row, string>) => (p.value ? fmt.date(p.value) : ""),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "MV £m",
        field: "mv",
        type: "numericColumn",
        width: 88,
        sort: "desc",
        filter: "agNumberColumnFilter",
        valueFormatter: num(1),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "Weight %",
        field: "weight",
        type: "numericColumn",
        width: 90,
        filter: "agNumberColumnFilter",
        valueFormatter: num(2),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "Active wt pp",
        field: "active",
        width: 152,
        filter: "agNumberColumnFilter",
        cellRenderer: ActiveCell,
        cellRendererParams: { maxAbs: maxAbsActive },
      },
      {
        headerName: "YTW %",
        field: "ytw",
        type: "numericColumn",
        width: 80,
        filter: "agNumberColumnFilter",
        valueFormatter: num(2),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "Mod dur",
        field: "modDur",
        type: "numericColumn",
        width: 86,
        filter: "agNumberColumnFilter",
        valueFormatter: num(2),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "OAS bp",
        field: "oas",
        type: "numericColumn",
        width: 80,
        filter: "agNumberColumnFilter",
        valueFormatter: num(0),
        cellClass: "font-mono tabular-nums",
      },
      {
        headerName: "DV01 £k",
        field: "dv01",
        type: "numericColumn",
        width: 86,
        filter: "agNumberColumnFilter",
        valueFormatter: num(1),
        cellClass: "font-mono tabular-nums",
      },
    ],
    [maxAbsActive],
  );

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({ sortable: true, resizable: true, floatingFilter: true, suppressHeaderMenuButton: true, minWidth: 70 }),
    [],
  );

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
    setTotals((prev) =>
      prev.n === next.n && Math.abs(prev.mv - next.mv) < 1e-9 && Math.abs(prev.weight - next.weight) < 1e-9 ? prev : next,
    );
  }, []);

  const pinnedBottom = useMemo(
    () => [
      {
        id: "TOTAL",
        issuer: `Total · ${totals.n} holding${totals.n === 1 ? "" : "s"}`,
        mv: totals.mv,
        weight: totals.weight,
        active: totals.active,
        ytw: totals.ytw,
        modDur: totals.modDur,
        oas: totals.oas,
        dv01: totals.dv01,
      } as unknown as Row,
    ],
    [totals],
  );

  const getRowStyle = useCallback(
    (p: RowClassParams<Row>): RowStyle | undefined =>
      p.node.rowPinned ? { background: "#f5f5f5", fontWeight: 600, borderTop: "1px solid #d4d4d4" } : undefined,
    [],
  );

  const filtersActive = quick.trim().length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2">
        <div className="min-w-0 flex-1">{toolbar}</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-3 text-[10px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: COLORS.cat1 }} />
              <span aria-hidden className="-ml-1 inline-block h-2.5 w-2.5" style={{ background: COLORS.cat2 }} />
              In index
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ boxShadow: `inset 0 0 0 2px ${COLORS.ink3}` }} />
              Off-index
            </span>
          </span>
          <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
            {totals.n} of {rows.length} shown
          </span>
          <label className="relative block">
            <span className="sr-only">Search holdings</span>
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="Search issuer, ISIN, sector…"
              className="h-8 w-64 border border-neutral-200 bg-white pr-7 pl-8 text-[12px] outline-none placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="absolute top-2 left-2.5 h-4 w-4 text-neutral-400">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                clipRule="evenodd"
              />
            </svg>
            {filtersActive && (
              <button
                type="button"
                onClick={() => setQuick("")}
                aria-label="Clear search"
                className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center text-neutral-400 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                ✕
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => apiRef.current?.exportDataAsCsv({ fileName: "fixed-income-holdings.csv" })}
            className="h-8 border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div style={{ height }}>
        <AgGridReact<Row>
          theme={theme}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowData={rows}
          getRowId={(p) => p.data.id}
          onGridReady={onGridReady}
          onModelUpdated={onModelUpdated}
          quickFilterText={quick}
          pinnedBottomRowData={pinnedBottom}
          getRowStyle={getRowStyle}
          noRowsOverlayComponent={NoRows}
          rowHeight={32}
          headerHeight={34}
          floatingFiltersHeight={32}
          animateRows
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}
