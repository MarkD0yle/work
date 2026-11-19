import type { DefaultMenuItem, ExcelStyle, GridApi, ProcessCellForExportParams } from 'ag-grid-community';
import {
  formatFinancial,
  SPREADSHEET_FORMATS,
  sumFinancial,
  toSpreadsheetFinancial,
} from '../financial/format';
import { displayText, rawText } from './copy';
import { recordOf } from './grouping';
import type { LLColumnDef } from './types';

/**
 * Helpers for the AG Grid Enterprise features that Ledgerline adopts (see `docs/AG-GRID-ENTERPRISE.md`).
 * Each one is routed through Ledgerline rules: decimal maths, restricted columns, and display precision from the registry.
 */

/** Ranges larger than this are not summed: the rows past the loaded blocks are not in the browser. */
export const RANGE_SUM_LIMIT = 20_000;

/**
 * The column menu. Copy, paste, filters, charts and value aggregation are left out on purpose: copy goes
 * through Ledgerline's own command (restricted columns), filters are screen-owned tags, and aggregation is not decimal.
 */
export function columnMenuItems(groupable: boolean): DefaultMenuItem[] {
  return [
    'sortAscending',
    'sortDescending',
    'sortUnSort',
    'separator',
    'pinSubMenu',
    'separator',
    'autoSizeThis',
    'autoSizeAll',
    ...(groupable ? (['separator', 'rowGroup', 'rowUnGroup'] as const) : []),
    'separator',
    'columnChooser',
    'resetColumns',
  ];
}

export interface RangeCells<Row> {
  rows: Row[];
  columns: LLColumnDef<Row>[];
  /** Cells in the range, counting only loaded records in Ledgerline columns. */
  cells: number;
  /** True when the range ran past `RANGE_SUM_LIMIT` rows and was cut short. */
  truncated: boolean;
}

/** The records and Ledgerline columns under the first selected cell range. Group rows and unloaded rows are skipped. */
export function rangeCells<Row>(api: GridApi<Row>, columns: LLColumnDef<Row>[]): RangeCells<Row> | null {
  const range = api.getCellRanges?.()?.[0];
  if (!range?.startRow || !range.endRow) return null;
  const from = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
  const to = Math.max(range.startRow.rowIndex, range.endRow.rowIndex);
  const byField = new Map(columns.map((c) => [c.field, c]));
  // Columns in the order they are shown, which is the order the user dragged across.
  const cols = range.columns.flatMap((c) => byField.get(c.getColId()) ?? []);
  const last = Math.min(to, from + RANGE_SUM_LIMIT - 1);
  const rows: Row[] = [];
  for (let i = from; i <= last; i += 1) {
    const record = recordOf(api.getDisplayedRowAtIndex(i)?.data);
    if (record !== undefined) rows.push(record);
  }
  return { rows, columns: cols, cells: rows.length * cols.length, truncated: last < to };
}

/** Status-bar text for a range of more than one cell: the count, then a decimal sum per financial column. */
export function rangeSummary<Row>(range: RangeCells<Row> | null): string[] {
  if (!range || range.cells < 2) return [];
  const parts = [`${range.cells.toLocaleString('en-US')} cells`];
  for (const column of range.columns) {
    if (column.type !== 'financial') continue;
    const sum = sumFinancial(range.rows.map((row) => column.value(row)));
    if (!sum) continue;
    const name = column.header.toLowerCase();
    if (sum.kind === 'mixed') {
      parts.push(`${column.header}: mixed currencies, not summed`);
      continue;
    }
    const f = formatFinancial(sum.value);
    parts.push(`Sum of ${name}: ${f.text}${f.currency ? ` ${f.currency}` : ''}`);
  }
  if (range.truncated) parts.push(`First ${RANGE_SUM_LIMIT.toLocaleString('en-US')} rows only`);
  return parts;
}

/** Columns that may be exported: visible Ledgerline columns that are not restricted. */
export function exportableColumns<Row>(
  api: GridApi<Row>,
  columns: LLColumnDef<Row>[],
): { allowed: LLColumnDef<Row>[]; blocked: LLColumnDef<Row>[] } {
  const byField = new Map(columns.map((c) => [c.field, c]));
  const shown = api.getAllDisplayedColumns().flatMap((c) => byField.get(c.getColId()) ?? []);
  return { allowed: shown.filter((c) => !c.restricted), blocked: shown.filter((c) => c.restricted) };
}

/**
 * Decided once per export, before any cell is written: which currency each financial column holds.
 * One currency goes in the header and the cells are numbers. Several currencies are never presented as
 * one column of numbers: those cells are written as text with their currency.
 */
export interface ExportPlan {
  currency: Map<string, string | null | 'mixed'>;
}

/** Key of the export plan in the grid context while a file is being written. */
export const EXPORT_PLAN = '__llExportPlan';

export const exportPlanOf = (context: unknown): ExportPlan | null =>
  (context as Record<string, ExportPlan | undefined> | null | undefined)?.[EXPORT_PLAN] ?? null;

export function planExport<Row>(rows: Row[], columns: LLColumnDef<Row>[]): ExportPlan {
  const currency = new Map<string, string | null | 'mixed'>();
  for (const column of columns) {
    if (column.type !== 'financial') continue;
    const codes = new Set(
      rows.flatMap((row) => {
        const fv = column.value(row);
        return fv.value !== null && fv.currency ? [fv.currency] : [];
      }),
    );
    currency.set(column.field, codes.size > 1 ? 'mixed' : ([...codes][0] ?? null));
  }
  return { currency };
}

/** Every Excel style the export can use. Fixed at grid build time, because AG Grid reads `excelStyles` once. */
export const EXCEL_STYLES: ExcelStyle[] = [
  { id: 'header', font: { bold: true } },
  { id: 'll-xl-text', dataType: 'String' },
  ...SPREADSHEET_FORMATS.map((f) => ({
    id: f.id,
    dataType: 'Number' as const,
    numberFormat: { format: f.format },
  })),
];

const mixed = (plan: ExportPlan | null, field: string) => plan?.currency.get(field) === 'mixed';

/** What a cell becomes in the spreadsheet: financial values as numbers at display precision, dates as ISO, the rest as shown. */
export function spreadsheetValue<Row>(column: LLColumnDef<Row>, row: Row, plan: ExportPlan | null): string {
  switch (column.type) {
    case 'financial': {
      const fv = column.value(row);
      if (mixed(plan, column.field)) {
        const f = formatFinancial(fv);
        return f.currency ? `${f.text} ${f.currency}` : f.text;
      }
      return toSpreadsheetFinancial(fv).value ?? '';
    }
    case 'date':
      return rawText(column, row);
    default:
      return displayText(column, row);
  }
}

/** The Excel class for one cell. Applied through `cellClass`, so it is evaluated per row at export time. */
export function excelClass<Row>(
  column: LLColumnDef<Row>,
  row: Row | undefined,
  plan: ExportPlan | null,
): string | undefined {
  if (row === undefined || !plan) return undefined;
  if (column.type === 'financial' && !mixed(plan, column.field))
    return toSpreadsheetFinancial(column.value(row)).styleId;
  // Ids and codes such as "000123" stay text, never numbers.
  return 'll-xl-text';
}

/** Header text in the spreadsheet: a single-currency column names its currency. */
export function exportHeader(header: string, field: string, plan: ExportPlan): string {
  const currency = plan.currency.get(field);
  return currency && currency !== 'mixed' ? `${header} (${currency})` : header;
}

/** The cell callback for Excel export: the record's spreadsheet value, never AG Grid's own number handling. */
export function processExportCell<Row>(columns: LLColumnDef<Row>[], plan: ExportPlan) {
  const byField = new Map(columns.map((c) => [c.field, c]));
  return (params: ProcessCellForExportParams<Row>): string => {
    const column = byField.get(params.column.getColId());
    const record = recordOf(params.node?.data);
    if (!column || record === undefined) return '';
    return spreadsheetValue(column, record, plan);
  };
}

/** A file name for an export: grid id plus the moment of export, e.g. "transactions-2026-11-18T1032.xlsx". */
export function exportFileName(gridId: string, nowIso: string): string {
  return `${gridId}-${nowIso.slice(0, 16).replace(':', '')}.xlsx`;
}
