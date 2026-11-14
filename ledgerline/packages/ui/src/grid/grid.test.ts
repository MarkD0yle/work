import type { BusinessDate, FinancialValue, GridResponse } from '@ledgerline/contracts';
import { describe, expect, it, vi } from 'vitest';
import { buildClipboard, displayText, formatBusinessDate, rawText } from './copy';
import { createInfiniteDatasource, createServerSideDatasource, toGridQuery } from './datasource';
import { gridFeatures, type LLColumnDef } from './types';

interface Row {
  id: string;
  amount: FinancialValue;
  tradeDate: BusinessDate;
  status: string;
  secret: string;
}

const amount = (value: string | null, currency = 'USD'): FinancialValue => ({
  kind: 'currencyAmount',
  value,
  currency,
  precision: currency === 'JPY' ? 0 : 2,
  signConvention: 'accounting',
  provenance: { origin: 'entered' },
  ...(value === null ? { nullReason: 'unavailable' as const } : {}),
});

const columns: LLColumnDef<Row>[] = [
  { field: 'id', header: 'Id', type: 'text', value: (r) => r.id },
  {
    field: 'amount',
    header: 'Amount',
    type: 'financial',
    financialKind: 'currencyAmount',
    value: (r) => r.amount,
  },
  { field: 'tradeDate', header: 'Trade date', type: 'date', dateBasis: 'trade', value: (r) => r.tradeDate },
  {
    field: 'status',
    header: 'Status',
    type: 'status',
    value: (r) => r.status,
    statuses: { posted: { label: 'Posted', tone: 'good' } },
  },
  {
    field: 'secret',
    header: 'Client tax id',
    type: 'text',
    value: (r) => r.secret,
    restricted: { reason: 'Personal data cannot be copied.' },
  },
];

const rows: Row[] = [
  {
    id: 'T-1',
    amount: amount('-1250000.4567'),
    tradeDate: { value: '2026-11-13', basis: 'trade' },
    status: 'posted',
    secret: '123-45',
  },
  {
    id: 'T-2',
    amount: amount(null),
    tradeDate: { value: null, basis: 'trade' },
    status: 'other',
    secret: '678-90',
  },
];

describe('cell text', () => {
  it('formats dates day-first with the month as a word, and null as a dash', () => {
    expect(formatBusinessDate({ value: '2026-11-13', basis: 'trade' })).toBe('13 Nov 2026');
    expect(formatBusinessDate({ value: null, basis: 'settle' })).toBe('—');
  });

  it('displayed text uses registry precision; raw text keeps the stored value', () => {
    const [, amountCol, dateCol, statusCol] = columns as [
      LLColumnDef<Row>,
      LLColumnDef<Row>,
      LLColumnDef<Row>,
      LLColumnDef<Row>,
    ];
    expect(displayText(amountCol, rows[0] as Row)).toBe('(1,250,000.46)');
    expect(rawText(amountCol, rows[0] as Row)).toBe('-1250000.4567');
    expect(displayText(amountCol, rows[1] as Row)).toBe('n/a');
    expect(rawText(amountCol, rows[1] as Row)).toBe('');
    expect(rawText(dateCol, rows[0] as Row)).toBe('2026-11-13');
    expect(displayText(statusCol, rows[0] as Row)).toBe('Posted');
    expect(displayText(statusCol, rows[1] as Row)).toBe('other');
  });
});

describe('clipboard', () => {
  it('copies displayed precision as tab-separated rows', () => {
    const out = buildClipboard(rows, columns, 'displayed');
    expect(out.text).toBe('T-1\t(1,250,000.46)\t13 Nov 2026\tPosted\nT-2\tn/a\t—\tother');
  });

  it('"Copy raw values" copies stored values', () => {
    expect(buildClipboard(rows, columns, 'raw').text).toBe(
      'T-1\t-1250000.4567\t2026-11-13\tposted\nT-2\t\t\tother',
    );
  });

  it('never copies a restricted column and reports why', () => {
    const out = buildClipboard(rows, columns, 'raw');
    expect(out.text).not.toContain('123-45');
    expect(out.blocked).toEqual([{ header: 'Client tax id', reason: 'Personal data cannot be copied.' }]);
    const only = buildClipboard(rows, columns.slice(4), 'displayed');
    expect(only).toMatchObject({ text: '', cells: 0 });
  });
});

describe('server-side adapter', () => {
  const context = () => ({
    filters: [{ field: 'status', op: 'eq' as const, value: 'unposted' }],
    quickSearch: '  AAPL ',
  });

  it('maps the grid request onto the /query contract', () => {
    const q = toGridQuery(
      {
        startRow: 100,
        endRow: 200,
        sortModel: [
          { colId: 'tradeDate', sort: 'desc' },
          { colId: 'x', sort: null },
        ],
      },
      context(),
    );
    expect(q).toEqual({
      startRow: 100,
      endRow: 200,
      sort: [{ field: 'tradeDate', dir: 'desc' }],
      filters: [{ field: 'status', op: 'eq', value: 'unposted' }],
      quickSearch: 'AAPL',
    });
    expect(
      toGridQuery({ startRow: 0, endRow: 100, sortModel: [] }, { filters: [], quickSearch: ' ' }),
    ).toEqual({ startRow: 0, endRow: 100 });
  });

  const response: GridResponse<Row> = { rows, totalRows: 104_233, asOf: '2026-11-14T16:00:00Z' };

  it('infinite datasource passes rows and the server total to the grid', async () => {
    const onLoaded = vi.fn();
    const query = vi.fn().mockResolvedValue(response);
    const successCallback = vi.fn();
    createInfiniteDatasource<Row>(query, { context, onLoaded, onError: vi.fn() }).getRows({
      startRow: 0,
      endRow: 100,
      sortModel: [],
      filterModel: {},
      successCallback,
      failCallback: vi.fn(),
    } as never);
    await vi.waitFor(() => expect(successCallback).toHaveBeenCalledWith(rows, 104_233));
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ quickSearch: 'AAPL', startRow: 0, endRow: 100 }),
    );
    expect(onLoaded).toHaveBeenCalledWith(response, expect.anything());
  });

  it('infinite datasource reports a failure instead of leaving blank rows', async () => {
    const onError = vi.fn();
    const failCallback = vi.fn();
    const error = new Error('down');
    createInfiniteDatasource<Row>(vi.fn().mockRejectedValue(error), {
      context,
      onLoaded: vi.fn(),
      onError,
    }).getRows({
      startRow: 0,
      endRow: 100,
      sortModel: [],
      filterModel: {},
      successCallback: vi.fn(),
      failCallback,
    } as never);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(failCallback).toHaveBeenCalled();
  });

  it('Enterprise server-side datasource uses the same contract', async () => {
    const success = vi.fn();
    const query = vi.fn().mockResolvedValue(response);
    createServerSideDatasource<Row>(query, { context, onLoaded: vi.fn(), onError: vi.fn() }).getRows({
      request: { startRow: 200, endRow: 300, sortModel: [{ colId: 'amount', sort: 'asc' }] },
      success,
      fail: vi.fn(),
    });
    await vi.waitFor(() => expect(success).toHaveBeenCalledWith({ rowData: rows, rowCount: 104_233 }));
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ startRow: 200, endRow: 300, sort: [{ field: 'amount', dir: 'asc' }] }),
    );
  });
});

describe('role feature sets', () => {
  it('keeps full capability for every internal role and limits clients to read and copy', () => {
    for (const segment of ['superUser', 'operator', 'newUser', 'approver', 'admin'] as const) {
      expect(gridFeatures(segment)).toEqual({ selection: true, copy: true, quickSearch: true });
    }
    expect(gridFeatures('client')).toEqual({ selection: false, copy: true, quickSearch: true });
  });
});
