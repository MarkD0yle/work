import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type GridOptions } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

ModuleRegistry.registerModules([AllCommunityModule])

/* One grid style for every app, driven entirely by tokens: the theme below
 * points AG Grid's own variables at ours, so theme and density switches need
 * no grid code. */
const harborGridTheme = themeQuartz.withParams({
  browserColorScheme: 'inherit',
  backgroundColor: 'var(--color-surface-1)',
  foregroundColor: 'var(--color-text-primary)',
  headerBackgroundColor: 'var(--color-surface-2)',
  headerTextColor: 'var(--color-text-secondary)',
  borderColor: 'var(--color-border)',
  accentColor: 'var(--color-accent)',
  rowHoverColor: 'var(--color-surface-hover)',
  selectedRowBackgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
  oddRowBackgroundColor: 'var(--color-surface-1)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-small)',
  headerFontSize: 'var(--text-caption)',
  headerFontWeight: 500,
  cellHorizontalPadding: 'var(--gap-sm)',
  borderRadius: 'var(--radius-none)',
  wrapperBorderRadius: 'var(--radius-none)',
  wrapperBorder: false,
})

/** The row height token as a number; follows density changes on the root element. */
function useRowHeight(): number {
  const read = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-row-height'), 10) || 24
  const [height, setHeight] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setHeight(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density'] })
    return () => observer.disconnect()
  }, [])
  return height
}

export interface DataGridProps<Row> {
  label: string
  rows: Row[]
  columns: ColDef<Row>[]
  rowId: (row: Row) => string
  /** A row was selected by click or by moving the keyboard focus onto it. */
  onSelect?: (row: Row) => void
  /** Enter or double-click on a row. */
  onActivate?: (row: Row) => void
  selectedId?: string | null
  emptyText?: string
  options?: GridOptions<Row>
}

export function DataGrid<Row>({ label, rows, columns, rowId, onSelect, onActivate, selectedId, emptyText = 'No rows', options }: DataGridProps<Row>) {
  const rowHeight = useRowHeight()
  const api = useRef<GridApi<Row> | null>(null)
  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, suppressMovable: true, suppressHeaderMenuButton: true }), [])

  // Selection can be asked for before the grid exists or has rows (an app opened by an intent), so it is
  // applied from three places: when the request changes, when the grid is ready, and when rows first render.
  const wanted = useRef(selectedId)
  const applySelection = useCallback(() => {
    const grid = api.current
    const id = wanted.current
    if (!grid || id === undefined) return
    if (id === null) {
      grid.deselectAll()
      return
    }
    const node = grid.getRowNode(id)
    if (!node) return
    if (!node.isSelected()) node.setSelected(true, true)
    grid.ensureNodeVisible(node)
  }, [])
  useEffect(() => {
    wanted.current = selectedId
    applySelection()
  }, [selectedId, rows, applySelection])

  return (
    <div className="hb-grid" role="region" aria-label={label}>
      <AgGridReact<Row>
        theme={harborGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        getRowId={(params) => rowId(params.data)}
        rowHeight={rowHeight}
        headerHeight={rowHeight + 4}
        rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
        animateRows={false}
        suppressCellFocus={false}
        overlayNoRowsTemplate={`<span class="hb-grid__empty">${emptyText}</span>`}
        onGridReady={(event) => {
          api.current = event.api
          applySelection()
        }}
        onFirstDataRendered={applySelection}
        onRowDataUpdated={applySelection}
        onRowClicked={(event) => event.data && onSelect?.(event.data)}
        // Arrow keys move the focused cell; treat that as selecting the row.
        onCellFocused={(event) => {
          if (event.rowIndex === null || event.rowIndex === undefined || event.rowPinned) return
          const node = event.api.getDisplayedRowAtIndex(event.rowIndex)
          if (!node?.data || node.isSelected()) return
          node.setSelected(true, true)
          onSelect?.(node.data)
        }}
        onCellKeyDown={(event) => {
          const key = (event.event as KeyboardEvent | undefined)?.key
          if (key === 'Enter' && event.data) onActivate?.(event.data)
        }}
        onRowDoubleClicked={(event) => event.data && onActivate?.(event.data)}
        {...options}
      />
    </div>
  )
}

export type { ColDef, GridOptions } from 'ag-grid-community'
