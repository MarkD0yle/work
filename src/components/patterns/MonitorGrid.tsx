import { useMemo } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  SEVERITY_TONES,
  monitorStatusToSeverity,
} from "../../lib/severity-tokens";
import type { MonitorStatus, QlikMonitor } from "../../lib/qlik";

/* MonitorGrid — the data-dense pattern, built on ag-grid (community).
 *
 * The branch grids (MandateGrid, FileForensicGrid) are hand-rolled flex
 * tables — right for sparse, bespoke layouts. This is the other end of the
 * spectrum: a sortable / filterable / resizable column grid for when an
 * operator needs to triage a long, uniform list. ag-grid was already a
 * dependency but unused; this wires it up under the house theme so it reads
 * as native rather than the default ag-grid blue.
 *
 * Severity still comes from the shared token system — status and tier cells
 * render the same pills used elsewhere, so the grid sits in the same visual
 * language as the rest of Ops Overview.
 */

ModuleRegistry.registerModules([AllCommunityModule]);

// House theme: neutral chrome, system font, dense rows. Mirrors the
// border/hover/label treatment used across the branch components.
const houseTheme = themeQuartz.withParams({
  accentColor: "#171717",
  fontFamily: "inherit",
  fontSize: 12,
  headerFontWeight: 600,
  headerTextColor: "#737373",
  headerBackgroundColor: "#ffffff",
  borderColor: "#e5e5e5",
  rowBorder: { color: "#f5f5f5" },
  rowHoverColor: "#fafafa",
  headerHeight: 34,
  rowHeight: 38,
  cellHorizontalPadding: 14,
  wrapperBorderRadius: 8,
});

const STATUS_LABEL: Record<MonitorStatus, string> = {
  red: "Red",
  amber: "Amber",
  green: "Green",
  info: "Info",
};

function StatusPill({ value }: ICellRendererParams<QlikMonitor, MonitorStatus>) {
  if (!value) return null;
  const tone =
    value === "info"
      ? SEVERITY_TONES.working.muted
      : SEVERITY_TONES[monitorStatusToSeverity(value)].muted;
  const dot =
    value === "red"
      ? "bg-red-500"
      : value === "amber"
        ? "bg-amber-500"
        : value === "info"
          ? "bg-blue-500"
          : "bg-emerald-500";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.bg} ${tone.text} ${tone.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {STATUS_LABEL[value]}
    </span>
  );
}

function relTime(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m ago`;
}

export default function MonitorGrid({
  monitors,
  now = Date.now(),
  onRowClick,
  className = "",
}: {
  monitors: QlikMonitor[];
  now?: number;
  onRowClick?: (monitor: QlikMonitor) => void;
  className?: string;
}) {
  const columnDefs = useMemo<ColDef<QlikMonitor>[]>(
    () => [
      {
        field: "name",
        headerName: "Monitor",
        flex: 2,
        minWidth: 200,
        cellClass: "font-medium text-neutral-900",
      },
      {
        field: "status",
        headerName: "Status",
        width: 110,
        cellRenderer: StatusPill,
        comparator: (a: MonitorStatus, b: MonitorStatus) => {
          const order: MonitorStatus[] = ["red", "amber", "info", "green"];
          return order.indexOf(a) - order.indexOf(b);
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 120,
        valueFormatter: (p: ValueFormatterParams<QlikMonitor, string>) =>
          p.value ? p.value[0].toUpperCase() + p.value.slice(1) : "",
      },
      {
        field: "tier",
        headerName: "Tier",
        width: 110,
        valueFormatter: (p: ValueFormatterParams<QlikMonitor, string>) =>
          p.value ? p.value[0].toUpperCase() + p.value.slice(1) : "—",
        cellClass: "text-neutral-500",
      },
      {
        field: "affectedCount",
        headerName: "Affected",
        width: 100,
        type: "rightAligned",
        cellClass: "font-mono tabular-nums text-neutral-700",
      },
      {
        field: "detail",
        headerName: "Detail",
        flex: 3,
        minWidth: 220,
        cellClass: "text-neutral-600",
        tooltipField: "detail",
      },
      {
        field: "lastRefresh",
        headerName: "Last refresh",
        width: 130,
        valueFormatter: (p: ValueFormatterParams<QlikMonitor, string>) =>
          p.value ? relTime(p.value, now) : "",
        cellClass: "font-mono text-[11px] tabular-nums text-neutral-500",
      },
    ],
    [now],
  );

  const defaultColDef = useMemo<ColDef<QlikMonitor>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressHeaderMenuButton: true,
    }),
    [],
  );

  return (
    <div className={`h-full w-full ${className}`}>
      <AgGridReact<QlikMonitor>
        theme={houseTheme}
        rowData={monitors}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={(p) => p.data.id}
        animateRows
        rowClass={onRowClick ? "cursor-pointer" : undefined}
        onRowClicked={(e) => e.data && onRowClick?.(e.data)}
        tooltipShowDelay={300}
      />
    </div>
  );
}
