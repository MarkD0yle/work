import type {
  ActionDef,
  ActionRef,
  BulkResult,
  FilterCondition,
  FinancialValue,
  GridQuery,
  GridResponse,
  Message,
  Permission,
  UiState,
} from '@ledgerline/contracts';
import { density as densityTokens } from '@ledgerline/tokens';
import type { CellKeyDownEvent, GridApi, GridReadyEvent, IRowNode } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Decimal } from 'decimal.js';
import { ChevronDown, Columns3, Group, RefreshCw, Rows3, Search, X } from 'lucide-react';
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
import { ActionBar, ActionMenuItems } from '../actions/action-bar';
import { BulkResultPanel, bulkResultCsv } from '../actions/bulk-results';
import { formatShortcut, matchesShortcut, resolveActions, type ResolvedAction } from '../actions/registry';
import { useActionRunner, type ActionOutcome } from '../actions/use-action-runner';
import { useCommandSource } from '../command/command-context';
import { Button } from '../components/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../components/context-menu';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';
import { Popover, PopoverAnchor, PopoverContent } from '../components/popover';
import { toast } from '../components/toaster';
import { ProvenanceDetails } from '../financial/financial-cell';
import { densities } from '../lib/preferences';
import { Input } from '../components/input';
import { formatFinancial } from '../financial/format';
import { formatTimestamp } from '../financial/provenance';
import { cn } from '../lib/cn';
import { useDensity } from '../lib/use-density';
import { NotificationContext } from '../state/notifications';
import { SectionBanner } from '../state/section-banner';
import { StateOverlay } from '../state/state-overlay';
import { headerText, MESSAGES_COLUMN, toColDefs } from './cells';
import { buildClipboard, formatBusinessDate } from './copy';
import {
  createInfiniteDatasource,
  createServerSideDatasource,
  toGridQuery,
  type QueryContext,
} from './datasource';
import { ensureGridModules, isGridEnterprise } from './modules';
import { groupRowId, isGroupRow, recordOf } from './grouping';
import { llGridTheme } from './theme';
import type { GridViewState, LLColumnDef, LLGridHandle, LLGridProps, LLGridState } from './types';

/** The most rows "Select all matching" will take. It matches the most one bulk run can carry. */
const SELECT_ALL_LIMIT = 5000;

const OP_WORDS: Record<FilterCondition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  contains: 'contains',
  gt: 'more than',
  lt: 'less than',
  between: 'between',
  relative: 'is',
  isNull: 'is empty',
  isNotNull: 'is not empty',
};
const PERIOD_WORDS = {
  today: 'today',
  yesterday: 'yesterday',
  thisPeriod: 'this period',
  lastPeriod: 'last period',
} as const;

/** Plain-language text for a filter tag, e.g. "Status is unposted" or "Trade date is yesterday". */
export function describeFilter<Row>(
  filter: FilterCondition,
  columns: LLColumnDef<Row>[],
  labels: Record<string, string> = {},
): string {
  const name = labels[filter.field] ?? columns.find((c) => c.field === filter.field)?.header ?? filter.field;
  const words = OP_WORDS[filter.op];
  switch (filter.op) {
    case 'between':
      return `${name} ${words} ${filter.from} and ${filter.to}`;
    case 'relative':
      return `${name} ${words} ${filter.period === 'lastNDays' ? `in the last ${filter.n ?? 7} days` : PERIOD_WORDS[filter.period]}`;
    case 'isNull':
    case 'isNotNull':
      return `${name} ${words}`;
    case 'in':
      return `${name} ${words} ${(Array.isArray(filter.value) ? filter.value : [filter.value]).join(', ')}`;
    default:
      return `${name} ${words} ${String(filter.value)}`;
  }
}

const DROPDOWN_PARTS = { Item: DropdownMenuItem, Separator: DropdownMenuSeparator } as Parameters<
  typeof ActionMenuItems
>[0]['parts'];
const CONTEXT_PARTS = { Item: ContextMenuItem, Separator: ContextMenuSeparator } as Parameters<
  typeof ActionMenuItems
>[0]['parts'];
const DEFAULT_NOUN = { one: 'row', many: 'rows' };
const ALLOWED: Permission = { action: 'grid', accessLevel: 'view', allowed: true };
const LOCAL_RESULT = (ids: string[]): BulkResult => ({
  jobId: 'local',
  status: 'completed',
  succeeded: ids,
  failed: [],
  skipped: [],
});

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
  onFiltersChange,
  onRowOpen,
  jobs,
  onDensityChange,
  initialView,
  onViewChange,
  filterLabels,
  onRefresh,
  actions,
  permissions,
  noun = DEFAULT_NOUN,
  onAction,
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
  /** The row the keyboard is on. With nothing selected, row actions act on it. */
  const [focusedRow, setFocusedRow] = useState<Row | undefined>(undefined);
  /** Result of the last action that did not fully succeed. It stays until dismissed: partial success is never a toast. */
  const [actionState, setActionState] = useState<UiState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  /** "Select all matching": every row the current filters match, loaded or not. Valid only for the filters it was taken under. */
  const [allMatching, setAllMatching] = useState<{ key: string; rows: Row[] } | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  /** The last bulk run that left rows failed or skipped. It stays until dismissed: partial success is never a toast. */
  const [lastRun, setLastRun] = useState<{
    def: ActionDef<Row>;
    result: BulkResult;
    inputs?: Record<string, unknown>;
  } | null>(null);
  /** A run that went to the job queue and has not finished yet. */
  const [running, setRunning] = useState<{
    jobId: string;
    label: string;
    done: number;
    total: number;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  /** Set while this component selects rows itself, so that does not count as the user changing the selection. */
  const selectingRows = useRef(false);
  /** Counts grid instances: AG Grid is rebuilt when density changes, and each build needs its datasource. */
  const [gridVersion, setGridVersion] = useState(0);
  /** The one provenance popover for the whole grid, anchored to the cell that asked for it. */
  const [provenance, setProvenance] = useState<{ anchor: HTMLElement; value: FinancialValue } | null>(null);
  // Starts from the opening view, so counts and the Columns menu are right before the grid reports anything.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        initialView
          ? initialView.columns.filter((c) => !c.visible).map((c) => c.field)
          : columns.filter((c) => c.hiddenByDefault).map((c) => c.field),
      ),
  );
  const [grouping, setGrouping] = useState<string[]>([]);
  /** The view as it is now. A rebuilt grid (density change) is given it back. */
  const liveView = useRef<GridViewState | null>(initialView ?? null);
  /** The filters and search the attached datasource was last loaded with, to avoid loading twice. */
  const loadedKey = useRef('');
  /** Selection and scroll position, kept so a rebuilt grid (density change) can put them back. */
  const lastView = useRef<{ ids: string[]; firstRow: number }>({ ids: [], firstRow: 0 });

  const context = useRef<QueryContext>({ filters: filters ?? [], quickSearch: '' });
  /** What to put back once a refresh has loaded: selected row ids and the focused cell. */
  const restore = useRef<{
    ids: Set<string>;
    focus: { rowId: string; colId: string } | null;
    scrollTo?: number;
  } | null>(null);
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
    // After a rebuild the old scroll position is restored first; its rows may need one more load, so the
    // selection is applied now for rows already here and once more when that load lands.
    restore.current = pending.scrollTo === undefined ? null : { ids: pending.ids, focus: null };
    if (pending.scrollTo) grid.ensureIndexVisible(pending.scrollTo, 'top');
    grid.forEachNode((node) => {
      if (node.id && pending.ids.has(node.id) && !node.isSelected()) node.setSelected(true);
    });
    if (pending.focus) {
      const node = grid.getRowNode(pending.focus.rowId);
      if (node?.rowIndex != null) grid.setFocusedCell(node.rowIndex, pending.focus.colId);
    }
  }, []);

  // Latest notify and label, so raising a notification never rebuilds the datasource (which would reload rows).
  const notifyRef = useRef({ notify: notifications?.notify, label, onViewChange });
  useEffect(() => {
    notifyRef.current = { notify: notifications?.notify, label, onViewChange };
  }, [notifications?.notify, label, onViewChange]);

  // ── View state: columns, sort, quick search and grouping (SPEC 7.2) ──
  const readView = useCallback((): GridViewState => {
    const grid = api.current;
    if (!grid)
      return (
        liveView.current ?? { columns: columns.map((c) => ({ field: c.field, visible: true })), sort: [] }
      );
    const own = new Set(columns.map((c) => c.field));
    const state = grid.getColumnState().filter((c) => own.has(c.colId));
    const ordered = <T extends { i: number }>(items: T[]) => items.sort((a, b) => a.i - b.i);
    const sortNow = ordered(
      state.flatMap((c) =>
        c.sort ? [{ field: c.colId, dir: c.sort as 'asc' | 'desc', i: c.sortIndex ?? 0 }] : [],
      ),
    ).map(({ field, dir }) => ({ field, dir }));
    const groups = ordered(
      state.flatMap((c) => (c.rowGroup ? [{ field: c.colId, i: c.rowGroupIndex ?? 0 }] : [])),
    ).map((g) => g.field);
    const search = context.current.quickSearch;
    return {
      columns: state.map((c) => ({
        field: c.colId,
        visible: !c.hide,
        ...(c.width == null ? {} : { width: c.width }),
        ...(c.pinned ? { pinned: c.pinned === 'right' ? ('right' as const) : ('left' as const) } : {}),
      })),
      sort: sortNow,
      ...(search ? { quickSearch: search } : {}),
      ...(groups.length ? { grouping: groups } : {}),
    };
  }, [columns]);

  const emitView = useCallback(() => {
    const view = readView();
    liveView.current = view;
    setSort(view.sort);
    setHidden(new Set(view.columns.filter((c) => !c.visible).map((c) => c.field)));
    setGrouping(view.grouping ?? []);
    notifyRef.current.onViewChange?.(view);
  }, [readView]);

  const applyView = useCallback(
    (view: GridViewState) => {
      liveView.current = view;
      const search = view.quickSearch?.trim() ?? '';
      context.current = { ...context.current, quickSearch: search };
      setSearchText(search);
      setQuickSearch(search);
      const grid = api.current;
      if (!grid) return;
      const groups = enterprise ? (view.grouping ?? []) : [];
      grid.applyColumnState({
        state: [
          { colId: MESSAGES_COLUMN },
          ...view.columns.map((c) => {
            const sortIndex = view.sort.findIndex((s) => s.field === c.field);
            const groupIndex = groups.indexOf(c.field);
            return {
              colId: c.field,
              hide: !c.visible,
              pinned: c.pinned ?? null,
              ...(c.width === undefined ? {} : { width: c.width }),
              sort: sortIndex < 0 ? null : (view.sort[sortIndex]?.dir ?? null),
              sortIndex: sortIndex < 0 ? null : sortIndex,
              rowGroup: groupIndex >= 0,
              rowGroupIndex: groupIndex < 0 ? null : groupIndex,
            };
          }),
        ],
        applyOrder: true,
      });
      emitView();
    },
    [emitView, enterprise],
  );

  // The datasource is attached once the grid is ready, and again if the grid is rebuilt (density change).
  useEffect(() => {
    const grid = api.current;
    if (!grid || !serverQuery || gridVersion === 0) return;
    const hooks = {
      context: () => context.current,
      onLoaded: (response: GridResponse<Row>, query: GridQuery) => {
        // With grouping on, the record total is the sum of the top-level groups; pages inside a group leave it alone.
        if (response.groups) {
          if (!query.groupKeys?.length) setTotalRows(response.groups.reduce((n, g) => n + g.count, 0));
        } else if (!query.groupBy?.length) setTotalRows(response.totalRows);
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
    loadedKey.current = JSON.stringify([context.current.filters, context.current.quickSearch]);
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

  // Notification-panel messages jump to their row (SPEC 7.7).
  useEffect(() => notifications?.registerTargetResolver(focusRow), [notifications, focusRow]);

  // Filters and quick search: the datasource reads them at request time, so only a reload is needed.
  useEffect(() => {
    context.current = { filters: filters ?? [], quickSearch };
    const grid = api.current;
    if (!grid) return;
    // Skip when the datasource was just attached with exactly these conditions: it is already loading them.
    const key = JSON.stringify([filters ?? [], quickSearch]);
    if (server && loadedKey.current === key) return;
    loadedKey.current = key;
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
    const timer = setTimeout(() => {
      const next = searchText.trim();
      if (next === context.current.quickSearch) return;
      context.current = { ...context.current, quickSearch: next };
      setQuickSearch(next);
      emitView();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, emitView]);

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
      : `${label}: ${count(totalRows)} ${totalRows === 1 ? 'row' : 'rows'}, ${columns.length - hidden.size} columns.`;

  // ── Clipboard ───────────────────────────────────────────
  const copy = useCallback(
    (mode: 'displayed' | 'raw') => {
      const grid = api.current;
      if (!grid || !features.copy) return;
      const focused = grid.getFocusedCell();
      const focusedRow = focused ? recordOf(grid.getDisplayedRowAtIndex(focused.rowIndex)?.data) : undefined;
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
      toast(`Copied ${what}${mode === 'raw' ? ' as raw values' : ''}`);
    },
    [columns, features.copy, selected, notifications, label],
  );

  // ── Actions: one registry for the toolbar, selection bar, context menu and palette (SPEC 7.8) ──
  const refreshRef = useRef(refresh);
  const copyRef = useRef(copy);
  const openRef = useRef(onRowOpen);
  useEffect(() => {
    refreshRef.current = refresh;
    copyRef.current = copy;
    openRef.current = onRowOpen;
  }, [refresh, copy, onRowOpen]);

  const canOpen = Boolean(onRowOpen);
  const definitions = useMemo<ActionDef<Row>[]>(() => {
    const local = {
      consequence: 'none' as const,
      agentRequiresConfirmation: false,
      available: () => ALLOWED,
    };
    const open: ActionDef<Row>[] = canOpen
      ? [
          {
            ...local,
            id: 'row.open',
            label: 'Open',
            description: `Opens the ${noun.one} in the detail panel.`,
            tier: 'primary',
            appliesTo: 'single',
            shortcut: 'Enter',
            execute: async (ids) => LOCAL_RESULT(ids),
          },
        ]
      : [];
    const copies: ActionDef<Row>[] = features.copy
      ? [
          {
            ...local,
            id: 'grid.copy',
            label: 'Copy',
            description: 'Copies the selected rows, or the focused cell, as they are shown.',
            tier: 'secondary',
            appliesTo: 'multi',
            shortcut: 'Mod+C',
            execute: async (ids) => {
              copyRef.current('displayed');
              return LOCAL_RESULT(ids);
            },
          },
          {
            ...local,
            id: 'grid.copyRaw',
            label: 'Copy raw values',
            description: 'Copies the stored values at full precision, with ISO dates and ids.',
            tier: 'overflow',
            appliesTo: 'multi',
            shortcut: 'Mod+Shift+C',
            execute: async (ids) => {
              copyRef.current('raw');
              return LOCAL_RESULT(ids);
            },
          },
        ]
      : [];
    const refreshAction: ActionDef<Row> = {
      ...local,
      id: 'grid.refresh',
      label: 'Refresh',
      description: 'Reloads the rows. Focus, selection and scroll position are kept.',
      tier: 'secondary',
      appliesTo: 'none',
      execute: async () => {
        refreshRef.current();
        return LOCAL_RESULT([]);
      },
    };
    return [...open, ...(actions ?? []), ...copies, refreshAction];
  }, [actions, features.copy, noun.one, canOpen]);

  const matchKey = JSON.stringify([filters ?? [], quickSearch]);
  const everyMatch = allMatching && allMatching.key === matchKey ? allMatching.rows : null;
  const targets = useMemo(
    () => everyMatch ?? (selected.length ? selected : focusedRow !== undefined ? [focusedRow] : []),
    [everyMatch, selected, focusedRow],
  );
  const resolved = useMemo(
    () => resolveActions(definitions, { selection: targets, state: ui, permissions: permissions ?? [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ui` is rebuilt every render; its kind is what matters
    [definitions, targets, ui.kind, permissions],
  );
  const rowActions = resolved.filter((a) => a.def.appliesTo !== 'none');
  const gridActions = resolved.filter((a) => a.def.appliesTo === 'none');

  /** Shows the outcome of a finished run, inline or from a job, and reloads the rows. */
  const settle = useCallback(
    (def: ActionDef<Row>, result: BulkResult, requested: number, inputs?: Record<string, unknown>) => {
      const [ok, failed, skipped] = [result.succeeded.length, result.failed.length, result.skipped.length];
      onAction?.({ actionId: def.id, requested, succeeded: ok, failed, skipped, error: false });
      setRunning(null);
      setAllMatching(null);
      if (failed + skipped === 0 && result.status !== 'cancelled') {
        setActionState(null);
        setLastRun(null);
        toast(`${def.label}: done`, `${count(ok)} ${ok === 1 ? noun.one : noun.many}`);
      } else {
        // Partial success is a first-class outcome: three counts and the next steps in a panel that stays.
        setActionState(null);
        setLastRun({ def, result, ...(inputs ? { inputs } : {}) });
        const { notify, label: source } = notifyRef.current;
        if (failed + skipped <= 10) {
          for (const f of result.failed) notify?.({ ...f.message, target: f.message.target ?? f.id }, source);
          for (const sk of result.skipped)
            notify?.(
              {
                code: 'LL-BLK-0003',
                severity: 'info',
                level: 'row',
                text: `${def.label} skipped ${sk.id}.`,
                fix: sk.reason,
                target: sk.id,
              },
              source,
            );
        } else {
          // A long list of rows would bury every other notification: one summary, with the detail in the results panel.
          notify?.(
            {
              code: 'LL-BLK-0004',
              severity: failed ? 'error' : 'info',
              level: 'operation',
              text: `${def.label}: ${count(ok)} succeeded, ${count(failed)} failed, ${count(skipped)} skipped.`,
              fix: 'The reasons are in the results panel above the grid. Export the results for the full list.',
            },
            source,
          );
        }
      }
      refreshRef.current();
    },
    [noun, onAction],
  );

  const jobWatch = useRef<(() => void) | null>(null);
  useEffect(() => () => jobWatch.current?.(), []);
  /** Follows a run that went to the job queue until it finishes. The user is free to leave meanwhile. */
  const follow = useCallback(
    (def: ActionDef<Row>, queued: BulkResult, requested: number, inputs?: Record<string, unknown>) => {
      jobWatch.current?.();
      setRunning({ jobId: queued.jobId, label: def.label, done: 0, total: requested });
      setLastRun(null);
      if (!jobs) return;
      jobWatch.current = jobs.watch(queued.jobId, (update) => {
        if (update.result && update.status !== 'queued' && update.status !== 'running') {
          jobWatch.current?.();
          jobWatch.current = null;
          settle(def, update.result, requested, inputs);
        } else if (update.progress) {
          const { done, total } = update.progress;
          setRunning((prev) => (prev && prev.jobId === queued.jobId ? { ...prev, done, total } : prev));
        }
      });
    },
    [jobs, settle],
  );

  const onDone = useCallback(
    ({ action, result, error: failure, inputs }: ActionOutcome<Row>) => {
      const requested = action.eligible.length;
      if (failure) {
        for (const m of failure) notifyRef.current.notify?.(m, notifyRef.current.label);
        setActionState({ kind: 'blockingError', messages: failure });
        onAction?.({
          actionId: action.def.id,
          requested,
          succeeded: 0,
          failed: requested,
          skipped: 0,
          error: true,
        });
        return;
      }
      if (!result) return;
      if (action.def.id === 'row.open') {
        const row = action.eligible[0];
        if (row !== undefined) openRef.current?.(row);
      }
      if (result.jobId === 'local') {
        onAction?.({
          actionId: action.def.id,
          requested,
          succeeded: result.succeeded.length,
          failed: 0,
          skipped: 0,
          error: false,
        });
        return;
      }
      if (result.status === 'queued' || result.status === 'running')
        follow(action.def, result, requested, inputs);
      else settle(action.def, result, requested, inputs);
    },
    [onAction, follow, settle],
  );

  /** Retry runs the same action on the failed rows only. Rows that already went through are never sent again. */
  const retryFailed = useCallback(async () => {
    if (!lastRun) return;
    const { def, result, inputs } = lastRun;
    const failedIds = result.failed.map((f) => f.id);
    setRetrying(true);
    try {
      const next =
        result.jobId.startsWith('J-') && jobs
          ? await jobs.retry(result.jobId)
          : await def.execute(failedIds, inputs);
      if (next.status === 'queued' || next.status === 'running') follow(def, next, failedIds.length, inputs);
      else settle(def, next, failedIds.length, inputs);
    } catch (problem) {
      const messages = (problem as { messages?: Message[] } | null)?.messages ?? [];
      for (const m of messages) notifyRef.current.notify?.(m, notifyRef.current.label);
      setActionState({ kind: 'blockingError', messages });
    } finally {
      setRetrying(false);
    }
  }, [lastRun, jobs, follow, settle]);

  /** Loads every row the current filters match, so an action can run on all of them, not only the rows scrolled into view. */
  const selectAllMatching = useCallback(async () => {
    if (!serverQuery || totalRows === null) return;
    setSelectingAll(true);
    try {
      const rows: Row[] = [];
      const sortModel = sort.map((x) => ({ colId: x.field, sort: x.dir }));
      for (let startRow = 0; startRow < Math.min(totalRows, SELECT_ALL_LIMIT); startRow += 1000) {
        const page = await serverQuery(
          toGridQuery({ startRow, endRow: startRow + 1000, sortModel }, context.current),
        );
        rows.push(...page.rows);
        if (page.rows.length < 1000) break;
      }
      setAllMatching({ key: JSON.stringify([context.current.filters, context.current.quickSearch]), rows });
      selectingRows.current = true;
      api.current?.forEachNode((node) => {
        if (recordOf(node.data) !== undefined && !node.isSelected()) node.setSelected(true);
      });
      setTimeout(() => {
        selectingRows.current = false;
      }, 0);
      setAnnouncement(
        `All ${count(rows.length)} matching ${rows.length === 1 ? noun.one : noun.many} selected.`,
      );
    } catch (problem) {
      const messages = (problem as { messages?: Message[] } | null)?.messages ?? [];
      for (const m of messages) notifyRef.current.notify?.(m, notifyRef.current.label);
    } finally {
      setSelectingAll(false);
    }
  }, [serverQuery, totalRows, sort, noun]);

  const exportResults = useCallback(() => {
    if (!lastRun) return;
    const url = URL.createObjectURL(new Blob([bulkResultCsv(lastRun.result)], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lastRun.def.id}-${lastRun.result.jobId}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [lastRun]);

  // When the confirm step closes, focus goes back to the grid cell the user was on, however the action was started.
  const onConfirmClosed = useCallback(() => {
    setTimeout(() => {
      const grid = api.current;
      const focused = grid?.getFocusedCell();
      if (grid && focused) grid.setFocusedCell(focused.rowIndex, focused.column);
    }, 0);
  }, []);
  // The preview opens by itself for users flagged as new, and whenever a row to be changed carries a warning.
  const autoPreview = useCallback(
    (action: ResolvedAction<Row>) =>
      Boolean(features.previewFirst) ||
      Boolean(rowMessages && action.eligible.some((row) => rowMessages(row).length > 0)),
    [features.previewFirst, rowMessages],
  );
  const { run, dialog: confirmDialog } = useActionRunner<Row>({
    rowId,
    noun,
    onDone,
    onConfirmClosed,
    autoPreview,
  });

  const runById = useCallback(
    (actionId: string, onRow?: Row) => {
      const listed = resolved.find((a) => a.def.id === actionId);
      if (!listed) return;
      // From the keyboard, the row under the cursor is known at once; the focused-row state may be a render behind.
      const action: ResolvedAction<Row> | undefined =
        onRow !== undefined && selected.length === 0
          ? resolveActions<Row>([listed.def], {
              selection: [onRow as Row],
              state: ui,
              permissions: permissions ?? [],
            })[0]
          : listed;
      if (!action) return;
      if (action.enabled) run(action);
      else setAnnouncement(`${action.def.label} is not available. ${action.reason ?? ''}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ui` is rebuilt every render; its kind is what matters
    [resolved, run, selected.length, ui.kind, permissions],
  );

  // The command palette lists these actions with the same label, shortcut and reason as every other surface.
  useCommandSource(`grid-${gridId}`, () =>
    resolved.map((a) => ({
      id: a.def.id,
      group: 'Actions' as const,
      label: a.def.label,
      hint: a.def.description,
      ...(a.def.shortcut ? { shortcut: formatShortcut(a.def.shortcut) } : {}),
      ...(a.enabled ? {} : { disabledReason: a.reason ?? 'Not available.' }),
      run: () => run(a),
    })),
  );

  /** Right-click (and Shift+F10) act on the row under the pointer: if it is not part of the selection, it becomes the target. */
  const prepareContext = (target: HTMLElement) => {
    const grid = api.current;
    const id = target.closest('.ag-row')?.getAttribute('row-id');
    const node = id ? grid?.getRowNode(id) : undefined;
    const record = recordOf(node?.data);
    if (!grid || !node || record === undefined || node.rowIndex == null) return;
    if (!node.isSelected() && grid.getSelectedNodes().length) grid.deselectAll();
    const colId = target.closest('[col-id]')?.getAttribute('col-id');
    if (colId) grid.setFocusedCell(node.rowIndex, colId);
    setFocusedRow(record);
  };

  // ── Keyboard (SPEC 7.1) ─────────────────────────────────
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<Row>) => {
      const e = event.event as KeyboardEvent | undefined;
      if (!e) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // Action shortcuts come from the registry, so they are the same keys the menus and palette show.
      const byShortcut = resolved.find((a) => a.def.shortcut && matchesShortcut(e, a.def.shortcut));
      if (byShortcut || (e.key === 'F2' && canOpen)) {
        e.preventDefault();
        runById(byShortcut ? byShortcut.def.id : 'row.open', recordOf(event.data));
        return;
      }
      if (mod && key === 'a') {
        // Select all rows in view, never every row on the server.
        e.preventDefault();
        if (!features.selection) return;
        const nodes = event.api
          .getRenderedNodes()
          .filter((n: IRowNode<Row>) => recordOf(n.data) !== undefined);
        for (const node of nodes) node.setSelected(true);
        setAnnouncement(`${count(nodes.length)} rows in view selected.`);
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
          if (recordOf(node?.data) !== undefined) node?.setSelected(true);
        }
      } else if (e.key === 'Escape') {
        if (event.api.getSelectedNodes().length) {
          event.api.deselectAll();
          setAnnouncement('Selection cleared.');
        }
      } else if (e.key === 'F10' && e.shiftKey) {
        // Shift+F10 opens the same actions menu as right-click, at the focused cell: right-click is never the only path.
        e.preventDefault();
        const cell = (e.target as HTMLElement).closest<HTMLElement>('.ag-cell');
        const focused = event.api.getFocusedCell();
        if (!cell || !focused) return;
        returnFocus.current = { rowIndex: focused.rowIndex, colId: focused.column.getColId() };
        const box = cell.getBoundingClientRect();
        cell.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: box.left + 16,
            clientY: box.bottom - 4,
          }),
        );
      }
    },
    [resolved, runById, features.selection, canOpen],
  );

  useImperativeHandle(
    ref,
    () => ({
      refresh,
      focusRow,
      getViewState: readView,
      applyViewState: applyView,
      runAction: (id: string) => runById(id),
    }),
    [refresh, focusRow, readView, applyView, runById],
  );

  const onGridReady = useCallback(
    (event: GridReadyEvent<Row>) => {
      api.current = event.api;
      setGridVersion((v) => v + 1);
      setSelected([]);
      setProvenance(null);
      // Put the view back before the first load, so the first query already has its sort, search and grouping.
      if (liveView.current) applyView(liveView.current);
      const { ids, firstRow } = lastView.current;
      if (ids.length || firstRow > 0)
        restore.current = { ids: new Set(ids), focus: null, scrollTo: firstRow };
      if (!server) setTotalRows(event.api.getDisplayedRowCount());
    },
    [server, applyView],
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
  const targetLabel =
    targets.length === 0
      ? `No ${noun.one} selected`
      : targets.length === 1
        ? `1 ${noun.one}`
        : `${count(targets.length)} ${noun.many}`;

  // ── Provenance (one popover for every financial cell) ───
  const openProvenance = useCallback(
    (target: HTMLElement) => {
      const button = target.closest<HTMLElement>('[data-slot="financial-cell"]');
      const id = button?.closest('.ag-row')?.getAttribute('row-id');
      const field = button?.closest('[col-id]')?.getAttribute('col-id');
      const row = id ? recordOf(api.current?.getRowNode(id)?.data) : undefined;
      const column = columns.find((c) => c.field === field);
      if (!button || row === undefined || column?.type !== 'financial') return;
      setProvenance((open) =>
        open?.anchor === button ? null : { anchor: button, value: column.value(row) },
      );
    },
    [columns],
  );
  useEffect(() => {
    const anchor = provenance?.anchor;
    if (!anchor) return;
    anchor.setAttribute('aria-expanded', 'true');
    return () => anchor.setAttribute('aria-expanded', 'false');
  }, [provenance]);

  // ── Columns ─────────────────────────────────────────────
  const toggleColumn = (field: string, visible: boolean) => {
    api.current?.setColumnsVisible([field], visible);
    // A column the user just turned on is brought into view, so the change is seen, not hunted for.
    if (visible) api.current?.ensureColumnVisible(field);
  };

  const groupable = enterprise && server ? columns.filter((c) => c.groupable) : [];
  const toggleGroup = (field: string, on: boolean) =>
    (api.current as unknown as { setRowGroupColumns: (keys: string[]) => void } | null)?.setRowGroupColumns(
      on ? [...grouping, field] : grouping.filter((f) => f !== field),
    );

  /**
   * Grid options that never change while the grid is on screen. They are built once: handing AG Grid a new
   * object on every render makes it rebuild columns and rows, which can drop a click that is in progress.
   */
  const client = dataSource.kind === 'client';
  const staticOptions = useMemo(() => {
    /** Text for a group row: status labels and dates read as they do in cells. */
    const groupLabel = (field: string | undefined, key: string | null | undefined) => {
      const column = columns.find((c) => c.field === field);
      if (key == null || key === '') return '(none)';
      if (column?.type === 'status') return column.statuses[key]?.label ?? key;
      if (column?.type === 'date') return formatBusinessDate({ value: key, basis: column.dateBasis });
      return key;
    };
    return {
      getRowId: (params: { data: Row; parentKeys?: string[] }) =>
        // While rows shift during a reload, the grid asks for the id of a placeholder that has no data yet.
        params.data === null || params.data === undefined
          ? '__ll-placeholder'
          : isGroupRow(params.data)
            ? groupRowId(params.parentKeys, params.data)
            : rowId(params.data),
      suppressOverlays: ['loading', 'noRows'] as ('loading' | 'noRows')[],
      ...(client
        ? {}
        : enterprise
          ? { rowModelType: 'serverSide' as const, cacheBlockSize: 100 }
          : {
              rowModelType: 'infinite' as const,
              cacheBlockSize: 100,
              infiniteInitialRowCount: 1,
              maxBlocksInCache: 20,
            }),
      ...(features.selection
        ? {
            rowSelection: {
              mode: 'multiRow' as const,
              checkboxes: true,
              headerCheckbox: client,
              enableClickSelection: false,
              // Group rows are headings, not records: they cannot be selected.
              isRowSelectable: (node: IRowNode<Row>) => !isGroupRow(node.data),
            },
            selectionColumnDef: { pinned: 'left' as const, width: 40, suppressHeaderMenuButton: true },
          }
        : {}),
      ...(enterprise && !client
        ? {
            autoGroupColumnDef: {
              headerName: 'Group',
              minWidth: 240,
              pinned: 'left' as const,
              sortable: false,
              valueFormatter: (p: { value: unknown; node: IRowNode<Row> | null }) =>
                groupLabel(p.node?.rowGroupColumn?.getColId(), p.value as string | null),
            },
            getChildCount: (data: unknown) => (isGroupRow(data) ? data.count : 0),
            suppressGroupChangesColumnVisibility: true,
          }
        : {}),
    };
  }, [client, enterprise, features.selection, columns, rowId]);

  // ── Filter tags: every active condition is visible and removable ──
  const tags = [
    ...(quickSearch
      ? [{ key: 'search', text: `Search: ${quickSearch}`, remove: () => setSearchText('') }]
      : []),
    ...(filters ?? []).map((f, i) => ({
      key: `${f.field}-${f.op}-${i}`,
      text: describeFilter(f, columns, filterLabels),
      remove: onFiltersChange ? () => onFiltersChange((filters ?? []).filter((_, j) => j !== i)) : undefined,
    })),
  ];

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
        {groupable.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Group aria-hidden />
                Group
                {grouping.length ? <span className="text-muted-foreground">({grouping.length})</span> : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Group rows by</DropdownMenuLabel>
              {groupable.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.field}
                  checked={grouping.includes(c.field)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => toggleGroup(c.field, checked)}
                >
                  {headerText(c)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <Columns3 aria-hidden />
              Columns
              {hidden.size ? <span className="text-muted-foreground">({hidden.size} hidden)</span> : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            {columns.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.field}
                checked={!hidden.has(c.field)}
                // Keep the menu open so several columns can be changed in one go.
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => toggleColumn(c.field, checked)}
                disabled={!hidden.has(c.field) && columns.length - hidden.size === 1}
              >
                {headerText(c)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {onDensityChange ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Rows3 aria-hidden />
                Density
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Row density</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={density}
                onValueChange={(v) => onDensityChange(v as typeof density)}
              >
                {densities.map((d) => (
                  <DropdownMenuRadioItem key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {gridActions.map((action) => (
          <Button
            key={action.def.id}
            variant="secondary"
            data-action-id={action.def.id}
            // An action the user cannot run stays visible and focusable, and says why.
            aria-disabled={!action.enabled || undefined}
            title={action.enabled ? undefined : (action.reason ?? undefined)}
            className={action.enabled ? undefined : 'opacity-60'}
            onClick={() => {
              if (!action.enabled) {
                setAnnouncement(`${action.def.label} is not available. ${action.reason ?? ''}`);
                return;
              }
              run(action);
              if (action.def.id === 'grid.refresh') onRefresh?.();
            }}
          >
            {action.def.id === 'grid.refresh' ? <RefreshCw aria-hidden /> : null}
            {action.def.label}
          </Button>
        ))}
        {rowActions.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                Row actions
                <ChevronDown aria-hidden className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64">
              <DropdownMenuLabel>{targetLabel}</DropdownMenuLabel>
              <ActionMenuItems actions={rowActions} onRun={run} parts={DROPDOWN_PARTS} />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {tags.length ? (
        <ul
          data-slot="filter-tags"
          aria-label="Active filters"
          className="flex shrink-0 flex-wrap items-center gap-2"
        >
          {tags.map((tag) => (
            <li
              key={tag.key}
              className="flex h-6 items-center gap-1 rounded-sm border bg-muted pr-0.5 pl-2 text-xs"
            >
              <span>{tag.text}</span>
              {tag.remove ? (
                <button
                  type="button"
                  aria-label={`Remove filter: ${tag.text}`}
                  onClick={tag.remove}
                  className="flex size-5 items-center justify-center rounded-sm hover:bg-accent"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
          {tags.length > 1 || tags[0]?.remove ? (
            <li>
              <Button
                variant="link"
                className="h-6 px-1 text-xs"
                onClick={() => {
                  setSearchText('');
                  onFiltersChange?.([]);
                }}
              >
                Clear all
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {features.selection && selected.length > 0 ? (
        <div
          data-slot="selection-bar"
          className="flex h-(--ll-control-height) shrink-0 items-center gap-3 rounded-md border bg-muted px-(--ll-padding-x)"
        >
          <span className="font-medium" data-slot="selection-count">
            {everyMatch
              ? `All ${count(everyMatch.length)} matching ${everyMatch.length === 1 ? noun.one : noun.many} selected`
              : `${count(selected.length)} selected`}
          </span>
          {server && !everyMatch && totalRows !== null && totalRows > selected.length ? (
            totalRows > SELECT_ALL_LIMIT ? (
              <span className="text-xs text-muted-foreground">
                To select every match, narrow the filters to {count(SELECT_ALL_LIMIT)} rows or fewer.
              </span>
            ) : (
              <Button variant="ghost" disabled={selectingAll} onClick={() => void selectAllMatching()}>
                {selectingAll ? 'Selecting…' : `Select all ${count(totalRows)} matching`}
              </Button>
            )
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              setAllMatching(null);
              api.current?.deselectAll();
            }}
          >
            Clear selection
          </Button>
          <ActionBar
            className="ml-auto"
            actions={rowActions}
            onRun={run}
            label={`Actions for selected ${noun.many}`}
          />
        </div>
      ) : null}

      {running ? (
        <p
          role="status"
          data-slot="job-running"
          className="shrink-0 rounded-md border border-info/40 bg-info/10 px-3 py-2"
        >
          <span className="font-medium">
            {running.label} is running as a job: {count(running.done)} of {count(running.total)} done.
          </span>{' '}
          You can leave this screen. The result will be here and under Jobs ({running.jobId}).
        </p>
      ) : null}
      {lastRun ? (
        <BulkResultPanel
          className="shrink-0"
          label={lastRun.def.label}
          noun={noun}
          result={lastRun.result}
          retrying={retrying}
          onExport={exportResults}
          onDismiss={() => setLastRun(null)}
          {...(lastRun.result.failed.length ? { onRetry: () => void retryFailed() } : {})}
          {...(onFiltersChange && lastRun.result.failed.length
            ? {
                onShowFailures: () =>
                  onFiltersChange([
                    ...(filters ?? []).filter((f) => !(f.field === 'id' && f.op === 'in')),
                    { field: 'id', op: 'in', value: lastRun.result.failed.map((f) => f.id) },
                  ]),
              }
            : {})}
        />
      ) : null}
      {actionState ? (
        <SectionBanner
          state={actionState}
          dismissCritical
          onDismiss={() => setActionState(null)}
          className="shrink-0"
        />
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
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {/* Clicks on financial cells are handled here once, not by a listener per cell. */}
            <div
              className="ll-grid-body min-h-0 flex-1"
              onClick={(e) => openProvenance(e.target as HTMLElement)}
              onContextMenu={(e) => prepareContext(e.target as HTMLElement)}
              role="presentation"
            >
              <AgGridReact<Row>
                key={density}
                theme={llGridTheme}
                columnDefs={columnDefs}
                rowHeight={rowHeight}
                headerHeight={rowHeight}
                {...(dataSource.kind === 'client' ? { rowData: dataSource.rows } : {})}
                {...staticOptions}
                suppressCellFocus={false}
                enableCellTextSelection={false}
                onGridReady={onGridReady}
                onSelectionChanged={(e) => {
                  const nodes = e.api.getSelectedNodes();
                  lastView.current.ids = nodes.flatMap((n) => (n.id ? [n.id] : []));
                  setSelected(nodes.flatMap((n) => recordOf(n.data) ?? []));
                  // Changing the selection by hand ends "all matching": the user is now choosing rows one by one.
                  if (!selectingRows.current) setAllMatching(null);
                }}
                onBodyScrollEnd={(e) => {
                  lastView.current.firstRow = e.api.getFirstDisplayedRowIndex();
                }}
                onRowDoubleClicked={(e) => {
                  const record = recordOf(e.data);
                  if (record !== undefined) onRowOpen?.(record);
                }}
                onSortChanged={emitView}
                onColumnVisible={emitView}
                onColumnPinned={emitView}
                onColumnRowGroupChanged={emitView}
                onColumnMoved={(e) => {
                  if (e.finished) emitView();
                }}
                onColumnResized={(e) => {
                  if (e.finished) emitView();
                }}
                onCellKeyDown={onCellKeyDown}
                onModelUpdated={(e) => {
                  if (!server) setTotalRows(e.api.getDisplayedRowCount());
                }}
                onCellFocused={(e) => {
                  const node = e.rowIndex == null ? undefined : e.api.getDisplayedRowAtIndex(e.rowIndex);
                  setFocusedRow(recordOf(node?.data));
                }}
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent
            onCloseAutoFocus={(e) => {
              // Focus goes back to the cell the menu was opened from, so arrow keys carry on from there.
              const back =
                returnFocus.current ??
                (api.current?.getFocusedCell()
                  ? {
                      rowIndex: api.current.getFocusedCell()?.rowIndex ?? 0,
                      colId: api.current.getFocusedCell()?.column.getColId() ?? '',
                    }
                  : null);
              returnFocus.current = null;
              if (!back) return;
              e.preventDefault();
              api.current?.setFocusedCell(back.rowIndex, back.colId);
            }}
          >
            <ContextMenuLabel>{targetLabel}</ContextMenuLabel>
            <ActionMenuItems actions={rowActions} onRun={run} parts={CONTEXT_PARTS} />
          </ContextMenuContent>
        </ContextMenu>
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

      {confirmDialog}

      {provenance ? (
        <Popover open onOpenChange={(open) => !open && setProvenance(null)}>
          <PopoverAnchor virtualRef={{ current: provenance.anchor }} />
          <PopoverContent
            align="end"
            aria-label="Provenance"
            onCloseAutoFocus={(e) => {
              // Focus goes back to the grid cell, so arrow keys carry on from where the user was.
              e.preventDefault();
              provenance.anchor.closest<HTMLElement>('.ag-cell')?.focus();
            }}
          >
            <ProvenanceDetails value={provenance.value} />
          </PopoverContent>
        </Popover>
      ) : null}

      <div className="sr-only" role="status" aria-live="polite" data-slot="grid-count-announcer">
        {countAnnouncement}
      </div>
      <div className="sr-only" role="status" aria-live="polite" data-slot="grid-announcer">
        {announcement}
      </div>
    </section>
  );
}
