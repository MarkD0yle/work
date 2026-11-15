import type { ColDef, ICellRendererComp, ICellRendererParams } from 'ag-grid-community';
import type { Message } from '@ledgerline/contracts';
import { RowMarker } from '../state/row-marker';
import { cellElement, placeholderElement } from './dom-cells';
import type { LLColumnDef } from './types';

interface DomCellParams<Row> extends ICellRendererParams<Row> {
  llColumn: LLColumnDef<Row>;
}

/**
 * One plain-DOM renderer for every data column. AG Grid treats a class with `getGui` as a native
 * component, so no React tree is created per cell.
 */
class DomCell<Row> implements ICellRendererComp<Row> {
  private gui = document.createElement('div');

  init(params: DomCellParams<Row>): void {
    this.gui.className = 'flex h-full w-full min-w-0 items-center';
    this.draw(params);
  }

  getGui(): HTMLElement {
    return this.gui;
  }

  refresh(params: DomCellParams<Row>): boolean {
    this.draw(params);
    return true;
  }

  private draw(params: DomCellParams<Row>): void {
    // Rows not loaded yet (infinite and server-side models) have no data: show a quiet placeholder.
    this.gui.replaceChildren(
      params.data === undefined ? placeholderElement() : cellElement(params.llColumn, params.data),
    );
  }
}

/** The row marker keeps its React tooltip. One stable component, so the grid never remounts it between redraws. */
function MarkerCell<Row>(params: ICellRendererParams<Row> & { llMessages: (row: Row) => Message[] }) {
  return params.data === undefined ? null : <RowMarker messages={params.llMessages(params.data)} />;
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

export const MESSAGES_COLUMN = '__messages';

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
    ...(column.pinned ? { pinned: column.pinned } : {}),
    // Financial columns right-align in tabular figures; alignment is a property of the kind, not the cell.
    ...(column.type === 'financial' ? { type: 'rightAligned', cellClass: 'll-cell-financial' } : {}),
    cellRenderer: DomCell,
    cellRendererParams: { llColumn: column },
  }));
  if (!rowMessages) return defs;
  return [
    {
      colId: MESSAGES_COLUMN,
      headerName: 'Messages',
      headerClass: 'll-header-icon-only',
      width: 44,
      pinned: 'left',
      sortable: false,
      resizable: false,
      suppressMovable: true,
      lockVisible: true,
      // Only rows that have messages mount the (React) marker; every other row stays an empty cell.
      cellRendererSelector: (params: ICellRendererParams<Row>) =>
        params.data !== undefined && rowMessages(params.data).length
          ? { component: MarkerCell, params: { llMessages: rowMessages } }
          : undefined,
      valueGetter: () => '',
    },
    ...defs,
  ];
}
