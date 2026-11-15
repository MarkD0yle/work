import type {
  ActionDef,
  BulkResult,
  BusinessDate,
  DateBasis,
  EntityRef,
  ExperienceSegment,
  FinancialKind,
  FinancialValue,
  GridQuery,
  GridResponse,
  JobStatus,
  Message,
  Permission,
  SavedView,
  UiState,
} from '@ledgerline/contracts';
import type { BadgeProps } from '../components/badge';

interface ColumnBase {
  /** Field name. Also the sort key sent to the server and the column id. */
  field: string;
  header: string;
  width?: number;
  sortable?: boolean;
  pinned?: 'left' | 'right';
  /** Rows can be grouped by this column (Enterprise). The server must be able to group on the field. */
  groupable?: boolean;
  /** The name to show for a group, when the server groups on a stored code ("cashBreak") and cells show a name ("Cash break"). */
  groupLabel?: (key: string) => string;
  /** Starts hidden. The user turns it on from the Columns menu. */
  hiddenByDefault?: boolean;
  /** Restricted columns cannot be copied; the reason is shown to the user. */
  restricted?: { reason: string };
}

/** A financial column must say which kind it is: precision and alignment follow from that, never from the cell. */
export interface FinancialColumn<Row> extends ColumnBase {
  type: 'financial';
  financialKind: FinancialKind;
  value: (row: Row) => FinancialValue;
  /** Price type or rate basis shown in the header, e.g. "clean". */
  qualifier?: string;
  /** Sum this column over the selected rows in the status bar. */
  aggregate?: boolean;
}

/** A date column must say which basis it is. */
export interface DateColumn<Row> extends ColumnBase {
  type: 'date';
  dateBasis: DateBasis;
  value: (row: Row) => BusinessDate;
}

export interface StatusColumn<Row> extends ColumnBase {
  type: 'status';
  value: (row: Row) => string;
  /** Label and tone per status value. Status is always readable from the label. */
  statuses: Record<string, { label: string; tone: NonNullable<BadgeProps['status']> }>;
}

export interface EntityColumn<Row> extends ColumnBase {
  type: 'entity';
  value: (row: Row) => EntityRef | null;
}

export interface TextColumn<Row> extends ColumnBase {
  type: 'text';
  value: (row: Row) => string | null;
  mono?: boolean;
}

export interface BooleanColumn<Row> extends ColumnBase {
  type: 'boolean';
  value: (row: Row) => boolean | null;
}

/**
 * An inline comparison beside a financial column: this value against another source or the prior day,
 * as a percentage, marked against a tolerance (SPEC 7.1). It is worked out in the browser, so it cannot be sorted.
 */
export interface DeltaColumn<Row> extends ColumnBase {
  type: 'delta';
  value: (row: Row) => FinancialValue | undefined;
  reference: (row: Row) => FinancialValue | undefined;
  /** What the value is compared with, in lower case: "vendor", "prior day". */
  referenceLabel: string;
  /** Tolerance as a percentage, as a decimal string: "5" means 5%. */
  tolerancePct: string;
}

export type LLColumnDef<Row> =
  | DeltaColumn<Row>
  | FinancialColumn<Row>
  | DateColumn<Row>
  | StatusColumn<Row>
  | EntityColumn<Row>
  | TextColumn<Row>
  | BooleanColumn<Row>;

/** Where rows come from. More than 10,000 rows, or unbounded data, must use `server`. */
export type LLDataSource<Row> =
  | { kind: 'client'; rows: Row[] }
  | { kind: 'server'; query: (query: GridQuery) => Promise<GridResponse<Row>> };

/** What a role gets. Capability is switched by role, never removed for everyone (SPEC 7.1). */
export interface LLGridFeatures {
  selection: boolean;
  copy: boolean;
  quickSearch: boolean;
  /** Open the preview before every confirm. On for users flagged as new (SPEC 7.4). */
  previewFirst?: boolean;
}

export function gridFeatures(segment: ExperienceSegment): LLGridFeatures {
  // Clients are read and export only: no selection bar, because they have no bulk actions.
  return {
    selection: segment !== 'client',
    copy: true,
    quickSearch: true,
    previewFirst: segment === 'newUser',
  };
}

/** What the grid needs from the job queue to follow a run that is too large to finish in one request. */
export interface GridJobs {
  /** Calls back on every change to the job until it finishes. Returns a function that stops watching. */
  watch: (
    jobId: string,
    onUpdate: (update: {
      status: JobStatus;
      progress?: { done: number; total: number };
      result?: BulkResult;
    }) => void,
  ) => () => void;
  /** Runs the job again on its failed rows, with its original inputs. */
  retry: (jobId: string) => Promise<BulkResult>;
}

export interface LLGridState {
  /** Rows on the server (or in the client data set) after filters. Null until the first load. */
  totalRows: number | null;
  selectedIds: string[];
  quickSearch: string;
  sort: NonNullable<GridQuery['sort']>;
  /** ISO timestamp of the last data load. */
  asOf: string | null;
  ui: UiState;
}

/** The part of a saved view the grid itself owns. Filters and density belong to the caller. */
export type GridViewState = Pick<SavedView['state'], 'columns' | 'sort' | 'quickSearch' | 'grouping'>;

export interface LLGridHandle {
  /** Columns (order, visibility, width, pinning), sort, quick search and grouping, as they are now. */
  getViewState: () => GridViewState;
  /** Applies a view. Reloads data once, with the new sort, search and grouping. */
  applyViewState: (state: GridViewState) => void;
  /** Runs a registered action by id on the current selection, exactly as the toolbar would. */
  runAction: (actionId: string) => void;
  /** Reloads data. Focus, selection and scroll position are kept. */
  refresh: () => void;
  /** Moves focus to a row by id. Returns false when the row is not loaded. */
  focusRow: (rowId: string) => boolean;
}

export interface LLGridProps<Row> {
  /** Stable id for this grid, used for saved views and analytics. */
  gridId: string;
  /** Human name, e.g. "Transactions". Used in labels and announcements. */
  label: string;
  columns: LLColumnDef<Row>[];
  dataSource: LLDataSource<Row>;
  rowId: (row: Row) => string;
  features: LLGridFeatures;
  /**
   * Filters applied on top of quick search. The grid shows every one as a removable tag: there are no hidden filters.
   * Removing a tag calls `onFiltersChange`; without that callback the tags are shown but cannot be removed.
   */
  filters?: NonNullable<GridQuery['filters']>;
  onFiltersChange?: (filters: NonNullable<GridQuery['filters']>) => void;
  /** The view to start on. Applied before the first load, so the first query already uses it. */
  initialView?: GridViewState;
  /** Called whenever the user changes columns, sort, quick search or grouping. */
  onViewChange?: (state: GridViewState) => void;
  /** Names for filter fields that are not columns, e.g. `{ portfolioId: 'Portfolio' }`, used in filter tags. */
  filterLabels?: Record<string, string>;
  /** Called when the user asks for a refresh (not when the caller refreshes through the handle). */
  onRefresh?: () => void;
  /**
   * This grid's actions (SPEC 7.8). The toolbar, the selection bar, the context menu and the command palette
   * are all built from this one list, plus the grid's own Open, Copy and Refresh.
   */
  actions?: ActionDef<Row>[];
  /** The signed-in user's permissions, passed to each action's `available`. */
  permissions?: Permission[];
  /** What a row is called, for confirm text: { one: 'transaction', many: 'transactions' }. */
  noun?: { one: string; many: string };
  /** Called after an action has run, for analytics. */
  onAction?: (event: {
    actionId: string;
    requested: number;
    succeeded: number;
    failed: number;
    skipped: number;
    error: boolean;
  }) => void;
  /** The job queue. Without it, a run that goes to a job is announced but not followed. */
  jobs?: GridJobs;
  /** Opens a row (Enter, F2 or double-click), e.g. in a detail panel. */
  onRowOpen?: (row: Row) => void;
  /** When given, the toolbar offers a density control. The app owns the setting so it applies everywhere. */
  onDensityChange?: (density: 'compact' | 'standard' | 'comfortable') => void;
  /** Messages for a row. Rows with messages get a marker in the first column. */
  rowMessages?: (row: Row) => Message[];
  /** State imposed from outside, e.g. stale or permission-limited. Overrides the grid's own state. */
  state?: UiState;
  onStateChange?: (state: LLGridState) => void;
  className?: string;
}
