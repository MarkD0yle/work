import type {
  BusinessDate,
  DateBasis,
  EntityRef,
  ExperienceSegment,
  FinancialKind,
  FinancialValue,
  GridQuery,
  GridResponse,
  Message,
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

export type LLColumnDef<Row> =
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
}

export function gridFeatures(segment: ExperienceSegment): LLGridFeatures {
  // Clients are read and export only: no selection bar, because they have no bulk actions.
  return { selection: segment !== 'client', copy: true, quickSearch: true };
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

export interface LLGridHandle {
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
  /** Filters applied on top of quick search. Each one must be visible to the user as a tag (owned by the caller). */
  filters?: NonNullable<GridQuery['filters']>;
  /** Messages for a row. Rows with messages get a marker in the first column. */
  rowMessages?: (row: Row) => Message[];
  /** State imposed from outside, e.g. stale or permission-limited. Overrides the grid's own state. */
  state?: UiState;
  onStateChange?: (state: LLGridState) => void;
  className?: string;
}
