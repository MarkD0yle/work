import type { FinancialValue } from '@ledgerline/contracts';
import type { GridApi } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import { SPREADSHEET_FORMATS, sumFinancial, toSpreadsheetFinancial } from '../financial/format';
import {
  columnMenuItems,
  EXCEL_STYLES,
  excelClass,
  exportableColumns,
  exportFileName,
  exportHeader,
  planExport,
  rangeCells,
  rangeSummary,
  RANGE_SUM_LIMIT,
  spreadsheetValue,
} from './enterprise';
import type { LLColumnDef } from './types';

const fv = (value: string | null, over: Partial<FinancialValue> = {}): FinancialValue => ({
  kind: 'currencyAmount',
  value,
  currency: 'USD',
  precision: 2,
  signConvention: 'natural',
  provenance: { origin: 'entered' },
  ...over,
});

interface Row {
  id: string;
  amount: FinancialValue;
  code: string;
}

const columns: LLColumnDef<Row>[] = [
  { field: 'id', header: 'Id', type: 'text', value: (r) => r.id },
  {
    field: 'amount',
    header: 'Amount',
    type: 'financial',
    financialKind: 'currencyAmount',
    value: (r) => r.amount,
  },
  {
    field: 'code',
    header: 'Code',
    type: 'text',
    value: (r) => r.code,
    restricted: { reason: 'Client data.' },
  },
];
const amountColumn = columns[1] as LLColumnDef<Row>;

describe('sumFinancial', () => {
  it('adds decimal strings exactly, skipping nulls', () => {
    const sum = sumFinancial([fv('0.1'), fv('0.2'), fv(null)]);
    expect(sum).toMatchObject({ kind: 'sum', count: 2, value: { value: '0.3', currency: 'USD' } });
  });

  it('never adds different currencies together', () => {
    expect(sumFinancial([fv('1'), fv('2', { currency: 'EUR' })])).toEqual({ kind: 'mixed' });
  });

  it('is null when there is nothing to add', () => {
    expect(sumFinancial([fv(null)])).toBeNull();
  });
});

describe('toSpreadsheetFinancial', () => {
  it('rounds to display precision with half-up rounding, as the grid shows it', () => {
    expect(toSpreadsheetFinancial(fv('1250.005')).value).toBe('1250.01');
    expect(toSpreadsheetFinancial(fv('-0.125')).value).toBe('-0.13');
  });

  it('follows the currency: JPY has no decimals', () => {
    const cell = toSpreadsheetFinancial(fv('1999.5', { currency: 'JPY', precision: 0 }));
    expect(cell).toEqual({ value: '2000', styleId: 'll-xl-0-n-n' });
  });

  it('keeps percentages as fractions under a percent format, and scales basis points', () => {
    expect(toSpreadsheetFinancial(fv('0.052512', { kind: 'percentage', precision: 2 }))).toEqual({
      value: '0.0525',
      styleId: 'll-xl-2-p-n',
    });
    expect(toSpreadsheetFinancial(fv('0.0025', { kind: 'basisPoints', precision: 2 })).value).toBe('25.00');
  });

  it('uses a format with parentheses for accounting sign', () => {
    const { styleId } = toSpreadsheetFinancial(fv('-5', { signConvention: 'accounting' }));
    expect(SPREADSHEET_FORMATS.find((f) => f.id === styleId)?.format).toBe('#,##0.00;(#,##0.00)');
  });

  it('keeps blanks blank, never zero', () => {
    expect(toSpreadsheetFinancial(fv(null, { nullReason: 'missing' })).value).toBeNull();
  });

  it('only produces style ids that the grid registers up front', () => {
    const ids = new Set(EXCEL_STYLES.map((s) => s.id));
    for (const kind of ['price', 'units', 'rate', 'percentage', 'basisPoints', 'amount'] as const)
      for (const signConvention of ['natural', 'accounting'] as const)
        expect(ids.has(toSpreadsheetFinancial(fv('1', { kind, signConvention, precision: 9 })).styleId)).toBe(
          true,
        );
  });
});

describe('Excel export plan', () => {
  const rows: Row[] = [
    { id: 'T-1', amount: fv('10'), code: '000123' },
    { id: 'T-2', amount: fv('20'), code: '000124' },
  ];

  it('names a single currency in the header and writes numbers', () => {
    const plan = planExport(rows, columns);
    expect(exportHeader('Amount', 'amount', plan)).toBe('Amount (USD)');
    expect(spreadsheetValue(amountColumn, rows[0] as Row, plan)).toBe('10.00');
    expect(excelClass(amountColumn, rows[0], plan)).toBe('ll-xl-2-n-n');
  });

  it('writes a mixed-currency column as text with each currency, never as one column of numbers', () => {
    const mixed = [...rows, { id: 'T-3', amount: fv('5', { currency: 'EUR' }), code: 'x' }];
    const plan = planExport(mixed, columns);
    expect(exportHeader('Amount', 'amount', plan)).toBe('Amount');
    expect(spreadsheetValue(amountColumn, mixed[2] as Row, plan)).toBe('5.00 EUR');
    expect(excelClass(amountColumn, mixed[2], plan)).toBe('ll-xl-text');
  });

  it('keeps ids and codes as text', () => {
    expect(excelClass(columns[0] as LLColumnDef<Row>, rows[0], planExport(rows, columns))).toBe('ll-xl-text');
  });

  it('adds no Excel class outside an export', () => {
    expect(excelClass(amountColumn, rows[0], null)).toBeUndefined();
  });

  it('builds a file name from the grid id and the time', () => {
    expect(exportFileName('transactions', '2026-11-18T10:32:45.000Z')).toBe(
      'transactions-2026-11-18T1032.xlsx',
    );
  });
});

describe('column menu', () => {
  it('never offers copy, paste, filters, charts or value aggregation', () => {
    const items = columnMenuItems(true);
    for (const banned of [
      'copy',
      'copyWithHeaders',
      'paste',
      'columnFilter',
      'chartRange',
      'valueAggSubMenu',
    ])
      expect(items).not.toContain(banned);
    expect(items).toContain('rowGroup');
    expect(columnMenuItems(false)).not.toContain('rowGroup');
  });
});

describe('cell range', () => {
  const rows: Row[] = [
    { id: 'T-1', amount: fv('1.10'), code: 'a' },
    { id: 'T-2', amount: fv('2.20'), code: 'b' },
    { id: 'T-3', amount: fv('3.30', { currency: 'EUR' }), code: 'c' },
  ];
  const fakeApi = (from: number, to: number, fields: string[], data: (Row | undefined)[] = rows) =>
    ({
      getCellRanges: () => [
        {
          startRow: { rowIndex: from, rowPinned: null },
          endRow: { rowIndex: to, rowPinned: null },
          columns: fields.map((f) => ({ getColId: () => f })),
        },
      ],
      getDisplayedRowAtIndex: (i: number) => ({ data: data[i] }),
    }) as unknown as GridApi<Row>;

  it('takes the records and Ledgerline columns under the range, in either drag direction', () => {
    const range = rangeCells(fakeApi(1, 0, ['amount', 'ag-Grid-SelectionColumn']), columns);
    expect(range?.rows.map((r) => r.id)).toEqual(['T-1', 'T-2']);
    expect(range?.columns.map((c) => c.field)).toEqual(['amount']);
    expect(range?.cells).toBe(2);
  });

  it('sums financial columns in decimals', () => {
    expect(rangeSummary(rangeCells(fakeApi(0, 1, ['id', 'amount']), columns))).toEqual([
      '4 cells',
      'Sum of amount: 3.30 USD',
    ]);
  });

  it('refuses to sum across currencies', () => {
    expect(rangeSummary(rangeCells(fakeApi(0, 2, ['amount']), columns))).toEqual([
      '3 cells',
      'Amount: mixed currencies, not summed',
    ]);
  });

  it('says nothing for a single cell', () => {
    expect(rangeSummary(rangeCells(fakeApi(0, 0, ['amount']), columns))).toEqual([]);
  });

  it('skips rows that have not loaded and caps very large ranges', () => {
    const range = rangeCells(fakeApi(0, RANGE_SUM_LIMIT + 10, ['amount'], [rows[0], undefined]), columns);
    expect(range?.rows).toHaveLength(1);
    expect(range?.truncated).toBe(true);
  });
});

describe('exportable columns', () => {
  it('exports only shown, unrestricted Ledgerline columns, and names the ones left out', () => {
    const api = {
      getAllDisplayedColumns: () =>
        ['ag-Grid-SelectionColumn', '__messages', 'code', 'amount'].map((id) => ({ getColId: () => id })),
    } as unknown as GridApi<Row>;
    const { allowed, blocked } = exportableColumns(api, columns);
    expect(allowed.map((c) => c.field)).toEqual(['amount']);
    expect(blocked.map((c) => c.field)).toEqual(['code']);
  });
});
