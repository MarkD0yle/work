import { formatBusinessDate } from '../dates/format';
import { formatDelta } from '../financial/delta';
import { formatFinancial, rawFinancial } from '../financial/format';

export { formatBusinessDate };
import type { FormattedDelta } from '../financial/delta';
import type { DeltaColumn, LLColumnDef } from './types';

export function deltaOf<Row>(column: DeltaColumn<Row>, row: Row): FormattedDelta {
  const value = column.value(row);
  return value
    ? formatDelta(value, column.reference(row), column.tolerancePct, column.referenceLabel)
    : { display: 'none', text: '', ariaLabel: 'Not applicable', raw: '' };
}

/** The text a cell shows. This is also what plain Copy puts on the clipboard. */
export function displayText<Row>(column: LLColumnDef<Row>, row: Row): string {
  switch (column.type) {
    case 'financial':
      return formatFinancial(column.value(row)).text;
    case 'delta': {
      const d = deltaOf(column, row);
      return d.label ? `${d.text} ${d.label}` : d.text;
    }
    case 'date':
      return formatBusinessDate(column.value(row));
    case 'status': {
      const value = column.value(row);
      return column.statuses[value]?.label ?? value;
    }
    case 'entity':
      return column.value(row)?.label ?? '';
    case 'text':
      return column.value(row) ?? '';
    case 'boolean': {
      const value = column.value(row);
      return value === null ? '' : value ? 'Yes' : 'No';
    }
  }
}

/** The stored value: full-precision decimal strings, ISO dates, ids. Used by "Copy raw values". */
export function rawText<Row>(column: LLColumnDef<Row>, row: Row): string {
  switch (column.type) {
    case 'financial':
      return rawFinancial(column.value(row));
    case 'delta':
      return deltaOf(column, row).raw;
    case 'date':
      return column.value(row).value ?? '';
    case 'status':
      return column.value(row);
    case 'entity':
      return column.value(row)?.id ?? '';
    case 'text':
      return column.value(row) ?? '';
    case 'boolean': {
      const value = column.value(row);
      return value === null ? '' : String(value);
    }
  }
}

export interface ClipboardResult {
  /** Tab-separated text, one line per row. Empty when everything requested was restricted. */
  text: string;
  /** Restricted columns that were left out, with their reasons. */
  blocked: { header: string; reason: string }[];
  cells: number;
}

const clean = (text: string) => text.replace(/[\t\r\n]+/g, ' ');

/** Builds clipboard text for rows × columns. Restricted columns are never copied. */
export function buildClipboard<Row>(
  rows: Row[],
  columns: LLColumnDef<Row>[],
  mode: 'displayed' | 'raw',
): ClipboardResult {
  const allowed = columns.filter((c) => !c.restricted);
  const blocked = columns.flatMap((c) =>
    c.restricted ? [{ header: c.header, reason: c.restricted.reason }] : [],
  );
  const toText = mode === 'raw' ? rawText : displayText;
  const text = rows.map((row) => allowed.map((c) => clean(toText(c, row))).join('\t')).join('\n');
  return { text: allowed.length ? text : '', blocked, cells: rows.length * allowed.length };
}
