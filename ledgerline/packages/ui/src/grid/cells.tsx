import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import type { Message } from '@ledgerline/contracts';
import { Badge } from '../components/badge';
import { FinancialCell } from '../financial/financial-cell';
import { RowMarker } from '../state/row-marker';
import { displayText, formatBusinessDate } from './copy';
import type { LLColumnDef } from './types';

/** Rows not loaded yet (infinite and server-side models) have no data: show a quiet placeholder. */
const Placeholder = () => (
  <span className="text-muted-foreground" aria-label="Loading">
    …
  </span>
);

function renderCell<Row>(column: LLColumnDef<Row>, row: Row) {
  switch (column.type) {
    case 'financial':
      return <FinancialCell value={column.value(row)} inGrid />;
    case 'date': {
      const date = column.value(row);
      return date.value === null ? (
        <span className="text-muted-foreground" aria-label="No date">
          —
        </span>
      ) : (
        <span className="tabular">{formatBusinessDate(date)}</span>
      );
    }
    case 'status': {
      const value = column.value(row);
      const status = column.statuses[value];
      return <Badge status={status?.tone ?? 'neutral'}>{status?.label ?? value}</Badge>;
    }
    case 'entity': {
      const entity = column.value(row);
      return entity ? (
        <span className="flex min-w-0 items-baseline gap-2" title={`${entity.label} (${entity.id})`}>
          <span className="truncate">{entity.label}</span>
          <span className="shrink-0 font-mono text-2xs text-muted-foreground">{entity.id}</span>
        </span>
      ) : (
        <span aria-label="None" />
      );
    }
    case 'text':
      return <span className={column.mono ? 'font-mono' : undefined}>{column.value(row) ?? ''}</span>;
    case 'boolean':
      return <span>{displayText(column, row)}</span>;
  }
}

const DEFAULT_WIDTH: Record<LLColumnDef<unknown>['type'], number> = {
  financial: 170,
  date: 124,
  status: 112,
  entity: 300,
  text: 120,
  boolean: 80,
};

const BASIS_LABEL = {
  trade: 'Trade',
  settle: 'Settle',
  effective: 'Effective',
  ledger: 'Ledger',
  valuation: 'Valuation',
} as const;

/** Header text. A date column always names its basis; a financial column names its qualifier. */
export function headerText<Row>(column: LLColumnDef<Row>): string {
  if (column.type === 'date' && !column.header.toLowerCase().includes(column.dateBasis)) {
    return `${column.header} (${BASIS_LABEL[column.dateBasis].toLowerCase()})`;
  }
  if (column.type === 'financial' && column.qualifier) return `${column.header} (${column.qualifier})`;
  return column.header;
}

export function toColDefs<Row>(
  columns: LLColumnDef<Row>[],
  rowMessages?: (row: Row) => Message[],
): ColDef<Row>[] {
  const defs: ColDef<Row>[] = columns.map((column) => ({
    colId: column.field,
    headerName: headerText(column),
    width: column.width ?? DEFAULT_WIDTH[column.type],
    sortable: column.sortable ?? true,
    resizable: true,
    suppressMovable: false,
    ...(column.pinned ? { pinned: column.pinned } : {}),
    // Financial columns right-align in tabular figures; alignment is a property of the kind, not the cell.
    ...(column.type === 'financial' ? { type: 'rightAligned', cellClass: 'll-cell-financial' } : {}),
    cellRenderer: (params: ICellRendererParams<Row>) =>
      params.data === undefined ? <Placeholder /> : renderCell(column, params.data),
  }));
  if (!rowMessages) return defs;
  return [
    {
      colId: '__messages',
      headerName: 'Messages',
      headerClass: 'll-header-icon-only',
      width: 44,
      pinned: 'left',
      sortable: false,
      resizable: false,
      suppressMovable: true,
      cellRenderer: (params: ICellRendererParams<Row>) =>
        params.data === undefined ? null : <RowMarker messages={rowMessages(params.data)} />,
    },
    ...defs,
  ];
}
