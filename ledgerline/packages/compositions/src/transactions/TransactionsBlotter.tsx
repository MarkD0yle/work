import type {
  ActionDef,
  EntityRef,
  FilterCondition,
  GridQuery,
  GridResponse,
  Permission,
  SavedView,
  TransactionRow,
} from '@ledgerline/contracts';
import {
  applyViewDiff,
  Button,
  defaultViewState,
  diffView,
  EntityPicker,
  EntityPickerSheet,
  GlossaryProvider,
  migrateView,
  normaliseView,
  SectionBanner,
  startingView,
  TaskChips,
  toast,
  useDensity,
  useCommandSource,
  useNotifications,
  ViewSelector,
  type EntityCriteria,
  type ViewDiff,
  type ViewState,
} from '@ledgerline/ui';
import {
  gridFeatures,
  LLGrid,
  type GridJobs,
  type GridViewState,
  type LLDataSource,
  type LLGridHandle,
} from '@ledgerline/ui/grid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import {
  createView,
  deleteView,
  fetchPermissions,
  fetchViews,
  post,
  problemOf,
  request,
  retryJob,
  recentEntities,
  rememberEntity,
  searchEntities,
  setDensity,
  track,
  updateView,
  type Me,
} from '../services';
import { noteJob, watchJob } from '../jobs/job-store';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { ImportDialog } from './import/ImportDialog';
import { TransactionForm } from './TransactionForm';
import { TransactionPanel } from './TransactionPanel';
import { createTransactionActions } from './actions';
import {
  ASSET_CLASSES,
  columns,
  CURRENCIES,
  filterLabels,
  GRID_ID,
  rowId,
  rowMessages,
  taskChips,
  viewSchema,
} from './config';

const NOUN = { one: 'transaction', many: 'transactions' };
/** Lets the grid follow a bulk run that went to the job queue, and retry it. */
const GRID_JOBS: GridJobs = {
  watch: watchJob,
  retry: async (jobId) => {
    const job = await retryJob(jobId);
    noteJob(job);
    return { jobId: job.id, status: 'queued', succeeded: [], failed: [], skipped: [] };
  },
};
const EMPTY_PERMISSIONS: Permission[] = [];
const NO_ACTIONS: ActionDef<TransactionRow>[] = [];
const onAction = (event: Record<string, unknown>) => track('action.invoked', { gridId: GRID_ID, ...event });

export interface BlotterHandle {
  refresh: () => void;
}

export interface BlotterProps {
  me: Me;
  /** Where to start: a saved view and, optionally, unsaved changes on top of it (both can come from a link). */
  initial?: { viewId?: string | null; diff?: ViewDiff };
  /** Reports the current view and unsaved changes, so the caller can keep them in the URL. */
  onLocation?: (viewId: string | null, diff: ViewDiff) => void;
  /** The user asked for a refresh. Used to keep pop-out windows in step. */
  onRefresh?: () => void;
  onSelection?: (ids: string[]) => void;
  ref?: Ref<BlotterHandle>;
}

const gridPart = (state: ViewState): GridViewState => ({
  columns: state.columns,
  sort: state.sort,
  ...(state.quickSearch ? { quickSearch: state.quickSearch } : {}),
  ...(state.grouping ? { grouping: state.grouping } : {}),
});

/**
 * The grid reports every column width; a saved view may not hold any. Parts the saved view does not specify
 * are left out before comparing, so an untouched view never reads as "edited".
 */
function comparable(current: ViewState, saved: ViewState): ViewState {
  const savedColumns = new Map(saved.columns.map((c) => [c.field, c]));
  const { density, ...rest } = current;
  return {
    ...rest,
    columns: current.columns.map((c) => {
      const { width, ...column } = c;
      return savedColumns.get(c.field)?.width === undefined || width === undefined
        ? column
        : { ...column, width };
    }),
    ...(saved.density && density ? { density } : {}),
  };
}

/** The Transactions grid with saved views, task chips and picker filters. Used on its own page and as a workspace panel. */
export function TransactionsBlotter(props: BlotterProps) {
  const { user } = props.me;
  const views = useQuery({ queryKey: ['views', GRID_ID, user.id], queryFn: () => fetchViews(GRID_ID) });
  if (views.isPending) return <LoadingPanel label="Loading views…" />;
  if (views.error) {
    return (
      <ErrorPanel messages={problemOf(views.error)?.messages ?? []} onRetry={() => void views.refetch()} />
    );
  }
  // Keyed by user: a different user has different views, scope and defaults.
  return <Blotter key={user.id} {...props} views={views.data} />;
}

function Blotter({
  me,
  initial,
  onLocation,
  onRefresh,
  onSelection,
  ref,
  views,
}: BlotterProps & { views: SavedView[] }) {
  const { user } = me;
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const density = useDensity();
  const grid = useRef<LLGridHandle>(null);
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });

  // ── Starting view: from the link, else the team default, else the grid default ──
  const [start] = useState(() => {
    const view = views.find((v) => v.id === initial?.viewId) ?? startingView(views, user.team);
    const migrated = view
      ? migrateView(view, viewSchema)
      : { state: defaultViewState(viewSchema), dropped: [] as string[] };
    return {
      view,
      saved: migrated.state,
      dropped: migrated.dropped,
      state: applyViewDiff(migrated.state, initial?.diff ?? {}),
    };
  });
  const [viewId, setViewId] = useState<string | null>(start.view?.id ?? null);
  /** The current view as saved (after migration). "Edited" means the screen differs from this. */
  const [saved, setSaved] = useState<ViewState>(start.saved);
  const [filters, setFilters] = useState<FilterCondition[]>(start.state.filters);
  const [gridView, setGridView] = useState<GridViewState>(() => gridPart(start.state));
  const [dropped, setDropped] = useState<string[]>(start.dropped);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** The entry form: closed, open for a new transaction, or open as a clone of `source`. */
  const [form, setForm] = useState<{ source: TransactionRow | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  /** Labels of picked entities, so filter pickers can show a name, not only an id. */
  const [labels, setLabels] = useState<Record<string, string>>({});

  // A view that sets a density applies it once, when the screen opens on that view.
  useEffect(() => {
    if (start.state.density) setDensity(start.state.density);
  }, [start]);

  const current: ViewState = useMemo(() => ({ ...gridView, filters, density }), [gridView, filters, density]);
  const diff = useMemo(() => diffView(saved, comparable(current, saved)), [saved, current]);
  const dirty = Object.keys(diff).length > 0;

  useEffect(() => onLocation?.(viewId, diff), [onLocation, viewId, diff]);

  const applyView = useCallback((view: SavedView | undefined, extra: ViewDiff = {}) => {
    const migrated = view
      ? migrateView(view, viewSchema)
      : { state: defaultViewState(viewSchema), dropped: [] as string[] };
    const state = applyViewDiff(migrated.state, extra);
    setViewId(view?.id ?? null);
    setSaved(migrated.state);
    setDropped(migrated.dropped);
    setFilters(state.filters);
    if (state.density) setDensity(state.density);
    grid.current?.applyViewState(gridPart(state));
    track('view.applied', {
      gridId: GRID_ID,
      viewId: view?.id ?? null,
      ownership: view?.ownership ?? 'none',
    });
  }, []);

  const fail = (error: unknown) => {
    for (const m of problemOf(error)?.messages ?? []) notify(m, 'Views');
  };
  const reloadViews = () => queryClient.invalidateQueries({ queryKey: ['views', GRID_ID, user.id] });
  const currentView = views.find((v) => v.id === viewId);
  /** What gets saved: everything on screen, with the density, so the view restores exactly. */
  const toSave = (): ViewState => normaliseView(current);

  const save = async () => {
    if (!currentView) return;
    const state = toSave();
    try {
      await updateView(currentView.id, {
        gridId: GRID_ID,
        name: currentView.name,
        ownership: currentView.ownership,
        state,
        schemaVersion: viewSchema.version,
      });
      setSaved(state);
      await reloadViews();
      toast('View saved', currentView.name);
      track('view.saved', {
        gridId: GRID_ID,
        viewId: currentView.id,
        ownership: currentView.ownership,
        isNew: false,
      });
    } catch (error) {
      fail(error);
    }
  };

  const saveAs = async (input: { name: string; ownership: 'personal' | 'shared' }) => {
    const state = toSave();
    try {
      const { record } = await createView({
        gridId: GRID_ID,
        ...input,
        state,
        schemaVersion: viewSchema.version,
      });
      setViewId(record.id);
      setSaved(state);
      await reloadViews();
      toast('View saved', record.name);
      track('view.saved', { gridId: GRID_ID, viewId: record.id, ownership: record.ownership, isNew: true });
    } catch (error) {
      fail(error);
    }
  };

  const remove = async () => {
    if (!currentView) return;
    try {
      await deleteView(currentView.id);
      applyView(
        startingView(
          views.filter((v) => v.id !== currentView.id),
          user.team,
        ),
      );
      await reloadViews();
      toast('View deleted', currentView.name);
    } catch (error) {
      fail(error);
    }
  };

  // ── Data ────────────────────────────────────────────────
  const dataSource = useMemo<LLDataSource<TransactionRow>>(
    () => ({
      kind: 'server',
      query: (query: GridQuery) => post<GridResponse<TransactionRow>>('/transactions/query', query),
    }),
    [],
  );
  const features = useMemo(() => gridFeatures(user.segment), [user.segment]);
  // New, Import and Clone sit in the same registry as Post and Reverse, so every surface offers them the same way.
  const actions = useMemo(
    () =>
      createTransactionActions({
        onNew: () => setForm({ source: null }),
        onImport: () => setImportOpen(true),
        onClone: (id) => {
          request<TransactionRow>(`/transactions/${id}`)
            .then((source) => setForm({ source }))
            .catch((error: unknown) => {
              for (const m of problemOf(error)?.messages ?? []) notify(m, 'Transactions');
            });
        },
      }),
    [notify],
  );
  const chips = useMemo(() => taskChips(user), [user]);
  const openRow = useCallback((row: TransactionRow) => setOpenId(row.id), []);
  useImperativeHandle(ref, () => ({ refresh: () => grid.current?.refresh() }), []);

  // Saved views in the command palette.
  useCommandSource('views-transactions', () =>
    views.map((v) => ({
      id: `view.${v.id}`,
      group: 'Views' as const,
      label: `View: ${v.name}`,
      hint:
        v.ownership === 'default'
          ? 'Default view'
          : v.ownership === 'shared'
            ? `Shared by ${v.owner.name}`
            : 'My view',
      run: () => applyView(v),
    })),
  );

  // ── Picker filters ──────────────────────────────────────
  const pickedId = (field: string) => {
    const f = filters.find((x) => x.field === field && x.op === 'eq');
    return f && 'value' in f ? String(f.value) : null;
  };
  const setPicked = (field: string, kind: EntityRef['kind'], value: EntityRef | null) => {
    const others = filters.filter((f) => f.field !== field);
    setFilters(value ? [...others, { field, op: 'eq', value: value.id }] : others);
    if (value) {
      setLabels((prev) => ({ ...prev, [value.id]: value.label }));
      void rememberEntity({ ...value, kind });
    }
  };
  const refFor = (field: string, kind: EntityRef['kind']): EntityRef | null => {
    const id = pickedId(field);
    return id ? { kind, id, label: labels[id] ?? id } : null;
  };
  const searchPortfolios = useCallback(
    (q: string, o: { includeInactive: boolean }) => searchEntities('portfolio', q, o),
    [],
  );
  const searchSecurities = useCallback(
    (q: string, o: { includeInactive: boolean }) => searchEntities('security', q, { ...o, scope: 'held' }),
    [],
  );
  const searchSheet = useCallback(
    (q: string, c: EntityCriteria) => searchEntities('security', q, { ...c, scope: 'held' }),
    [],
  );
  const recentPortfolios = useCallback(() => recentEntities('portfolio'), []);
  const recentSecurities = useCallback(() => recentEntities('security'), []);
  const severalSecurities = filters.find((f) => f.field === 'securityId' && f.op === 'in');

  return (
    <GlossaryProvider enabled={user.segment === 'newUser'}>
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <ViewSelector
              views={views}
              currentId={viewId}
              dirty={dirty}
              userId={user.id}
              onSelect={(view) => applyView(view)}
              onSave={() => void save()}
              onSaveAs={(input) => void saveAs(input)}
              onDelete={() => void remove()}
              onRestoreDefault={() => applyView(views.find((v) => v.ownership === 'default'))}
            />
            <TaskChips chips={chips} filters={filters} onChange={setFilters} />
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-3">
            <EntityPicker
              label="Portfolio"
              className="w-72"
              value={refFor('portfolioId', 'portfolio')}
              onChange={(value) => setPicked('portfolioId', 'portfolio', value)}
              search={searchPortfolios}
              recent={recentPortfolios}
              placeholder="Any portfolio"
            />
            <EntityPicker
              label="Security"
              className="w-80"
              value={refFor('securityId', 'security')}
              onChange={(value) => setPicked('securityId', 'security', value)}
              search={searchSecurities}
              recent={recentSecurities}
              placeholder={
                severalSecurities && 'value' in severalSecurities
                  ? `${(severalSecurities.value as string[]).length} securities chosen`
                  : 'Any held security'
              }
            />
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Choose several…
            </Button>
          </div>
          {dropped.length ? (
            <SectionBanner
              state={{
                kind: 'warning',
                messages: [
                  {
                    code: 'LL-VIEW-0002',
                    severity: 'warning',
                    level: 'section',
                    text: `This view used ${dropped.length === 1 ? 'a column that no longer exists' : 'columns that no longer exist'}: ${dropped.join(', ')}.`,
                    fix: 'It was loaded without them. Save the view to stop seeing this.',
                  },
                ],
              }}
              onDismiss={() => setDropped([])}
            />
          ) : null}
          <LLGrid
            ref={grid}
            gridId={GRID_ID}
            label="Transactions"
            columns={columns}
            dataSource={dataSource}
            rowId={rowId}
            rowMessages={rowMessages}
            features={features}
            filters={filters}
            onFiltersChange={setFilters}
            filterLabels={filterLabels}
            initialView={gridPart(start.state)}
            onViewChange={setGridView}
            onRowOpen={openRow}
            // External clients read and export only: no entry, import, post or reverse is offered (SPEC 8.6).
            actions={user.segment === 'client' ? NO_ACTIONS : actions}
            jobs={GRID_JOBS}
            permissions={permissions.data ?? EMPTY_PERMISSIONS}
            noun={NOUN}
            onAction={onAction}
            onDensityChange={setDensity}
            {...(onRefresh ? { onRefresh } : {})}
            {...(onSelection ? { onStateChange: (s) => onSelection(s.selectedIds) } : {})}
          />
        </div>
        {openId ? (
          <TransactionPanel
            key={openId}
            id={openId}
            user={user}
            businessDate={me.businessDate}
            onSaved={() => grid.current?.refresh()}
            onClose={() => {
              const id = openId;
              setOpenId(null);
              // Focus goes back to the row the panel was opened from.
              setTimeout(() => grid.current?.focusRow(id), 0);
            }}
          />
        ) : null}
        <EntityPickerSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Choose securities"
          search={searchSheet}
          types={ASSET_CLASSES}
          currencies={CURRENCIES}
          onConfirm={(refs) => {
            const others = filters.filter((f) => f.field !== 'securityId');
            setFilters(
              refs.length
                ? [...others, { field: 'securityId', op: 'in', value: refs.map((r) => r.id) }]
                : others,
            );
          }}
        />
        <TransactionForm
          open={form !== null}
          onOpenChange={(open) => !open && setForm(null)}
          user={user}
          businessDate={me.businessDate}
          source={form?.source ?? null}
          onSaved={(record) => {
            grid.current?.refresh();
            setOpenId(record.id);
          }}
        />
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => grid.current?.refresh()}
        />
      </div>
    </GlossaryProvider>
  );
}
