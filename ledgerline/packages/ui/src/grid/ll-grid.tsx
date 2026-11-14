import type { ActionRef, GridResponse, Message, UiState } from '@ledgerline/contracts';
import { density as densityTokens } from '@ledgerline/tokens';
import type { CellKeyDownEvent, GridApi, GridReadyEvent, IRowNode } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Decimal } from 'decimal.js';
import { ChevronDown, RefreshCw, Search } from 'lucide-react';
import {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Button } from '../components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';
import { Input } from '../components/input';
import { formatFinancial } from '../financial/format';
import { formatTimestamp } from '../financial/provenance';
import { cn } from '../lib/cn';
import { useDensity } from '../lib/use-density';
import { NotificationContext } from '../state/notifications';
import { StateOverlay } from '../state/state-overlay';
import { toColDefs } from './cells';
import { buildClipboard } from './copy';
import { createInfiniteDatasource, createServerSideDatasource, type QueryContext } from './datasource';
import { ensureGridModules, isGridEnterprise } from './modules';
import { llGridTheme } from './theme';
import type { LLGridHandle, LLGridProps, LLGridState } from './types';

const RETRY: ActionRef = { actionId: 'grid.retry', label: 'Retry' };
const SEARCH_DEBOUNCE_MS = 200;
const count = (n: number) => n.toLocaleString('en-US');

function messagesFrom(error: unknown): Message[] {
  const messages = (error as { messages?: Message[] } | null)?.messages;
  if (Array.isArray(messages) && messages.length) return messages;
  return [
    {
      code: 'LL-GRD-0500',
      severity: 'error',
      level: 'operation',
      text: 'The rows could not be loaded.',
      fix: 'Retry. If it keeps failing, check your connection.',
    },
  ];
}

/**
 * The Ledgerline data grid (SPEC 7.1). Wraps AG Grid: apps never import AG Grid themselves.
 *
 * Anatomy: toolbar (quick search, refresh, row actions) · selection bar · header · body with typed cells ·
 * status bar (row count, selected aggregates, as-of) · state overlay.
 */
export function LLGrid<Row>({
  gridId,
  label,
  columns,
  dataSource,
  rowId,
  features,
  filters,
  rowMessages,
  state: imposedState,
  onStateChange,
  className,
  ref,
}: LLGridProps<Row> & { ref?: Ref<LLGridHandle> }): ReactNode {
  ensureGridModules();
  const density = useDensity();
  const notifications = useContext(NotificationContext);
  const api = useRef<GridApi<Row> | null>(null);
  const [searchText, setSearchText] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [totalRows, setTotalRows] = useState<number | null>(
    dataSource.kind === 'client' ? dataSource.rows.length : null,
  );
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<Message[] | null>(null);
  const [selected, setSelected] = useState<Row[]>([]);
  const [sort, setSort] = useState<LLGridState['sort']>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  /** Counts grid instances: AG Grid is rebuilt when density changes, and each build needs its datasource. */
  const [gridVersion, setGridVersion] = useState(0);

  const context = useRef<QueryContext>({ filters: filters ?? [], quickSearch: '' });
  /** What to put back once a refresh has loaded: selected row ids and the focused cell. */
  const restore = useRef<{ ids: Set<string>; focus: { rowId: string; colId: string } | null } | null>(null);
  const anchorRow = useRef<number | null>(null);
  const returnFocus = useRef<{ rowIndex: number; colId: string } | null>(null);
  const server = dataSource.kind === 'server';
  const serverQuery = server ? dataSource.query : null;
  const enterprise = isGridEnterprise();

  const columnDefs = useMemo(() => toColDefs(columns, rowMessages), [columns, rowMessages]);

  // ── Data ────────────────────────────────────────────────
  const reload = useCallback(() => {
    const grid = api.current;
    if (!grid || !server) return;
    if (enterprise)
      (grid as unknown as { refreshServerSide: (p: { purge: boolean }) => void }).refreshServerSide({
        purge: false,
      });
    else grid.refreshInfiniteCache();
  }, [server, enterprise]);

  const applyRestore = useCallback(() => {
    const grid = api.current;
    const pending = restore.current;
    if (!grid || !pending) return;
    restore.current = null;
    grid.forEachNode((node) => {
      if (node.id && pending.ids.has(node.id) && !node.isSelected()) node.setSelected(true);
    });
    if (pending.focus) {
      const node = grid.getRowNode(pending.focus.rowId);
      if (node?.rowIndex != null) grid.setFocusedCell(node.rowIndex, pending.focus.colId);
    }
  }, []);

  // Latest notify and label, so raising a notification never rebuilds the datasource (which would reload rows).
  const notifyRef = useRef({ notify: notifications?.notify, label });
  useEffect(() => {
    notifyRef.current = { notify: notifications?.notify, label };
  }, [notifications?.notify, label]);

  // The datasource is attached once the grid is ready, and again if the grid is rebuilt (density change).
  useEffect(() => {
    const grid = api.current;
    if (!grid || !serverQuery || gridVersion === 0) return;
    const hooks = {
      context: () => context.current,
      onLoaded: (response: GridResponse<Row>) => {
        setTotalRows(response.totalRows);
        setAsOf(response.asOf);
        setError(null);
        // Let the grid render the new rows before selection and focus are put back.
        setTimeout(applyRestore, 0);
      },
      onError: (e: unknown) => {
        const messages = messagesFrom(e);
        setError(messages);
        for (const m of messages) notifyRef.current.notify?.(m, notifyRef.current.label);
      },
    };
    if (enterprise)
      grid.setGridOption(
        'serverSideDatasource' as never,
        createServerSideDatasource(serverQuery, hooks) as never,
      );
    else grid.setGridOption('datasource', createInfiniteDatasource(serverQuery, hooks));
  }, [gridVersion, serverQuery, enterprise, applyRestore]);

  const refresh = useCallback(() => {
    const grid = api.current;
    if (!grid) return;
    const focused = grid.getFocusedCell();
    const focusedNode = focused ? grid.getDisplayedRowAtIndex(focused.rowIndex) : undefined;
    restore.current = {
      ids: new Set(grid.getSelectedNodes().flatMap((n) => (n.id ? [n.id] : []))),
      focus: focused && focusedNode?.id ? { rowId: focusedNode.id, colId: focused.column.getColId() } : null,
    };
    if (server) reload();
    else grid.refreshCells({ force: true });
  }, [server, reload]);

  const focusRow = useCallback((id: string) => {
    const grid = api.current;
    const node = grid?.getRowNode(id);
    const first = grid
      ?.getAllDisplayedColumns()
      .find((c) => !c.getColId().startsWith('__') && c.getColId() !== 'ag-Grid-SelectionColumn');
    if (!grid || node?.rowIndex == null || !first) return false;
    grid.ensureIndexVisible(node.rowIndex);
    grid.setFocusedCell(node.rowIndex, first);
    return true;
  }, []);

  useImperativeHandle(ref, () => ({ refresh, focusRow }), [refresh, focusRow]);

  // Notification-panel messages jump to their row (SPEC 7.7).
  useEffect(() => notifications?.registerTargetResolver(focusRow), [notifications, focusRow]);

  // Filters and quick search: the datasource reads them at request time, so only a reload is needed.
  useEffect(() => {
    context.current = { filters: filters ?? [], quickSearch };
    const grid = api.current;
    if (!grid) return;
    if (server) {
      if (enterprise)
        (grid as unknown as { refreshServerSide: (p: { purge: boolean }) => void }).refreshServerSide({
          purge: true,
        });
      else grid.purgeInfiniteCache();
    } else {
      grid.setGridOption('quickFilterText', quickSearch);
      setTotalRows(grid.getDisplayedRowCount());
    }
  }, [filters, quickSearch, server, enterprise]);

  useEffect(() => {
    const timer = setTimeout(() => setQuickSearch(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ── State ───────────────────────────────────────────────
  const activeFilters = (filters?.length ?? 0) + (quickSearch ? 1 : 0);
  const ownState: UiState = error
    ? { kind: 'blockingError', messages: error, recovery: [RETRY] }
    : totalRows === null
      ? { kind: 'loading' }
      : totalRows === 0
        ? activeFilters
          ? { kind: 'noMatches', activeFilters }
          : { kind: 'empty', reason: 'noData' }
        : { kind: 'normal' };
  const ui = imposedState ?? ownState;

  const selectedIds = useMemo(() => selected.map(rowId), [selected, rowId]);
  useEffect(() => {
    onStateChange?.({ totalRows, selectedIds, quickSearch, sort, asOf, ui });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ui` is derived from the listed values
  }, [totalRows, selectedIds, quickSearch, sort, asOf, ui.kind, onStateChange]);

  // Row and column counts are announced, including the server total (SPEC 7.1 acceptance).
  const countAnnouncement =
    totalRows === null
      ? ''
      : `${label}: ${count(totalRows)} ${totalRows === 1 ? 'row' : 'rows'}, ${columns.length} columns.`;

  // ── Clipboard ───────────────────────────────────────────
  const copy = useCallback(
    (mode: 'displayed' | 'raw') => {
      const grid = api.current;
      if (!grid || !features.copy) return;
      const focused = grid.getFocusedCell();
      const focusedRow = focused ? grid.getDisplayedRowAtIndex(focused.rowIndex)?.data : undefined;
      const rows = selected.length ? selected : focusedRow ? [focusedRow] : [];
      // With no selection, Copy takes the focused cell only. With a selection, it takes whole rows.
      const focusedColumn = focused ? columns.find((c) => c.field === focused.column.getColId()) : undefined;
      const cols = selected.length || !focusedColumn ? columns : [focusedColumn];
      if (rows.length === 0) return;
      const result = buildClipboard(rows, cols, mode);
      if (result.text === '' && result.blocked.length) {
        notifications?.notify(
          {
            code: 'LL-GRD-0001',
            severity: 'warning',
            level: 'operation',
            text: `${result.blocked[0]?.header} cannot be copied.`,
            fix: result.blocked[0]?.reason ?? '',
          },
          label,
        );
        setAnnouncement(`${result.blocked[0]?.header} cannot be copied. ${result.blocked[0]?.reason}`);
        return;
      }
      void navigator.clipboard?.writeText(result.text);
      const what =
        cols.length === 1 ? '1 cell' : `${count(rows.length)} ${rows.length === 1 ? 'row' : 'rows'}`;
      const left = result.blocked.length
        ? ` ${result.blocked.map((b) => b.header).join(', ')} left out: ${result.blocked[0]?.reason}`
        : '';
      setAnnouncement(`Copied ${what}${mode === 'raw' ? ' as raw values' : ''}.${left}`);
    },
    [columns, features.copy, selected, notifications, label],
  );

  // ── Keyboard (SPEC 7.1) ─────────────────────────────────
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<Row>) => {
      const e = event.event as KeyboardEvent | undefined;
      if (!e) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'a') {
        // Select all rows in view, never every row on the server.
        e.preventDefault();
        if (!features.selection) return;
        const nodes = event.api.getRenderedNodes().filter((n: IRowNode<Row>) => n.data !== undefined);
        for (const node of nodes) node.setSelected(true);
        setAnnouncement(`${count(nodes.length)} rows in view selected.`);
      } else if (mod && key === 'c') {
        e.preventDefault();
        copy(e.shiftKey ? 'raw' : 'displayed');
      } else if (mod && key === 'i') {
        // Provenance is one keystroke away.
        e.preventDefault();
        (e.target as HTMLElement)
          .closest('.ag-cell')
          ?.querySelector<HTMLElement>('[data-slot="financial-cell"]')
          ?.click();
      } else if (e.key === ' ' && features.selection) {
        const row = event.rowIndex;
        if (row == null) return;
        if (!e.shiftKey) {
          // Plain Space toggles the row (handled by the grid); remember it as the anchor for Shift+Space.
          anchorRow.current = row;
          return;
        }
        // Shift+Space extends the selection from the anchor to the focused row.
        e.preventDefault();
        const from = anchorRow.current ?? row;
        for (let i = Math.min(from, row); i <= Math.max(from, row); i += 1) {
          const node = event.api.getDisplayedRowAtIndex(i);
          if (node?.data !== undefined) node.setSelected(true);
        }
      } else if (e.key === 'Escape') {
        if (event.api.getSelectedNodes().length) {
          event.api.deselectAll();
          setAnnouncement('Selection cleared.');
        }
      } else if (e.key === 'F10' && e.shiftKey) {
        e.preventDefault();
        const focused = event.api.getFocusedCell();
        returnFocus.current = focused
          ? { rowIndex: focused.rowIndex, colId: focused.column.getColId() }
          : null;
        setMenuOpen(true);
      }
    },
    [copy, features.selection],
  );

  const onGridReady = useCallback(
    (event: GridReadyEvent<Row>) => {
      api.current = event.api;
      setGridVersion((v) => v + 1);
      setSelected([]);
      if (!server) setTotalRows(event.api.getDisplayedRowCount());
    },
    [server],
  );

  // ── Selected aggregates ─────────────────────────────────
  const aggregates = useMemo(() => {
    if (selected.length === 0) return [];
    return columns.flatMap((column) => {
      if (column.type !== 'financial' || !column.aggregate) return [];
      const values = selected.map((row) => column.value(row)).filter((v) => v.value !== null);
      const first = values[0];
      if (!first) return [];
      // Amounts in different currencies are never added together.
      if (new Set(values.map((v) => v.currency)).size > 1) return [`${column.header}: mixed currencies`];
      const sum = values.reduce((total, v) => total.plus(v.value as string), new Decimal(0));
      const f = formatFinancial({ ...first, value: sum.toString() });
      return [`Sum of ${column.header.toLowerCase()}: ${f.text}${f.currency ? ` ${f.currency}` : ''}`];
    });
  }, [selected, columns]);

  const rowHeight = densityTokens[density].rowHeight;

  return (
    <section
      aria-label={`${label} grid`}
      data-slot="ll-grid"
      data-grid-id={gridId}
      className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}
    >
      <div
        className="flex shrink-0 flex-wrap items-center gap-2"
        role="toolbar"
        aria-label={`${label} tools`}
      >
        {features.quickSearch ? (
          <div className="relative w-72 max-w-full">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label={`Quick search ${label.toLowerCase()}`}
              placeholder="Search id, security, portfolio…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-8"
            />
          </div>
        ) : null}
        <div className="flex-1" />
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden />
          Refresh
        </Button>
        {features.copy ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                Row actions
                <ChevronDown aria-hidden className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => {
                // Opened from a cell with Shift+F10: closing puts focus back on that cell, not on the toolbar.
                const back = returnFocus.current;
                if (!back) return;
                returnFocus.current = null;
                e.preventDefault();
                api.current?.setFocusedCell(back.rowIndex, back.colId);
              }}
            >
              <DropdownMenuItem onSelect={() => copy('displayed')}>
                Copy <span className="ml-auto pl-6 text-2xs text-muted-foreground">Ctrl+C</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => copy('raw')}>
                Copy raw values{' '}
                <span className="ml-auto pl-6 text-2xs text-muted-foreground">Ctrl+Shift+C</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {features.selection && selected.length > 0 ? (
        <div
          data-slot="selection-bar"
          className="flex h-(--ll-control-height) shrink-0 items-center gap-3 rounded-md border bg-muted px-(--ll-padding-x)"
        >
          <span className="font-medium">{count(selected.length)} selected</span>
          <Button variant="ghost" onClick={() => api.current?.deselectAll()}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <StateOverlay
        state={ui}
        className="min-h-0 flex-1"
        onAction={(action) => {
          if (action.actionId === RETRY.actionId) {
            setError(null);
            setTotalRows(null);
            reload();
          }
        }}
      >
        <div className="ll-grid-body min-h-0 flex-1">
          <AgGridReact<Row>
            key={density}
            theme={llGridTheme}
            columnDefs={columnDefs}
            getRowId={(params) => rowId(params.data)}
            rowHeight={rowHeight}
            headerHeight={rowHeight}
            {...(dataSource.kind === 'client'
              ? { rowData: dataSource.rows }
              : enterprise
                ? { rowModelType: 'serverSide' as const, cacheBlockSize: 100 }
                : {
                    rowModelType: 'infinite' as const,
                    cacheBlockSize: 100,
                    infiniteInitialRowCount: 1,
                    maxBlocksInCache: 20,
                  })}
            {...(features.selection
              ? {
                  rowSelection: {
                    mode: 'multiRow' as const,
                    checkboxes: true,
                    headerCheckbox: !server,
                    enableClickSelection: false,
                  },
                  selectionColumnDef: { pinned: 'left' as const, width: 40, suppressHeaderMenuButton: true },
                }
              : {})}
            suppressOverlays={['loading', 'noRows']}
            suppressCellFocus={false}
            enableCellTextSelection={false}
            onGridReady={onGridReady}
            onSelectionChanged={(e) =>
              setSelected(e.api.getSelectedNodes().flatMap((n) => (n.data === undefined ? [] : [n.data])))
            }
            onSortChanged={(e) =>
              setSort(
                e.api
                  .getColumnState()
                  .flatMap((c) =>
                    c.sort ? [{ field: c.colId, dir: c.sort as 'asc' | 'desc', i: c.sortIndex ?? 0 }] : [],
                  )
                  .sort((a, b) => a.i - b.i)
                  .map(({ field, dir }) => ({ field, dir })),
              )
            }
            onCellKeyDown={onCellKeyDown}
            onModelUpdated={(e) => {
              if (!server) setTotalRows(e.api.getDisplayedRowCount());
            }}
          />
        </div>
      </StateOverlay>

      <div
        data-slot="status-bar"
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        <span className="tabular">
          {totalRows === null ? 'Counting rows…' : `${count(totalRows)} ${totalRows === 1 ? 'row' : 'rows'}`}
        </span>
        {aggregates.map((text) => (
          <span key={text} className="tabular">
            {text}
          </span>
        ))}
        <span className="flex-1" />
        {asOf ? <span>Refreshed {formatTimestamp(asOf)}</span> : null}
      </div>

      <div className="sr-only" role="status" aria-live="polite" data-slot="grid-count-announcer">
        {countAnnouncement}
      </div>
      <div className="sr-only" role="status" aria-live="polite" data-slot="grid-announcer">
        {announcement}
      </div>
    </section>
  );
}
