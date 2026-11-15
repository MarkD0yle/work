import type { ImportMapping } from '@ledgerline/contracts';
import { describe, expect, it } from 'vitest';
import { detectTable, mappingComplete, mappingProblem, matchHeader, toMapping } from './mapping';

const last: ImportMapping = {
  targetType: 'transaction',
  columns: [
    { sourceHeader: 'Id', targetField: 'id' },
    { sourceHeader: 'Qty', targetField: 'quantity' },
    { sourceHeader: 'Px', targetField: 'price' },
  ],
};

describe('import column mapping', () => {
  it('recognises headers however they are spelled', () => {
    expect(matchHeader('Trade Date')).toBe('tradeDate');
    expect(matchHeader('SETTLEMENT_DATE')).toBe('settleDate');
    expect(matchHeader('ISIN')).toBe('securityId');
    expect(matchHeader('Trader notes')).toBeNull();
  });

  it('uses a header row when there is one', () => {
    const table = detectTable(
      [
        ['Transaction', 'Qty', 'Notes'],
        ['T-1', '100', 'check'],
      ],
      null,
    );
    expect(table.basis).toBe('headers');
    expect(table.rows).toEqual([{ Transaction: 'T-1', Qty: '100', Notes: 'check' }]);
    expect(table.targets).toEqual({ Transaction: 'id', Qty: 'quantity' });
    expect(mappingComplete(table.headers, table.targets)).toBe(false);
  });

  it('applies the last mapping by position to a paste with no header row', () => {
    const table = detectTable(
      [
        ['T-1', '100', '99.5'],
        ['T-2', '200', '98'],
      ],
      last,
    );
    expect(table.basis).toBe('lastMapping');
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual({ Id: 'T-1', Qty: '100', Px: '99.5' });
    expect(mappingComplete(table.headers, table.targets)).toBe(true);
    expect(toMapping(table.headers, table.targets)).toEqual(last);
  });

  it('assumes nothing without headers or a last mapping', () => {
    const table = detectTable([['T-1', '100']], null);
    expect(table.basis).toBe('none');
    expect(table.headers).toEqual(['Column 1', 'Column 2']);
    expect(mappingProblem(table.targets)).toBe('Choose what at least one column is.');
  });

  it('says what new transactions still need', () => {
    expect(mappingProblem({ Qty: 'quantity' })).toMatch(/New transactions need Portfolio, Type, Trade date/);
    expect(mappingProblem({ Id: 'id', Qty: 'quantity' })).toBeNull();
  });

  it('never maps two columns to the same field', () => {
    const table = detectTable(
      [
        ['Qty', 'Quantity', 'Id'],
        ['1', '2', 'T-1'],
      ],
      null,
    );
    expect(Object.values(table.targets).sort()).toEqual(['id', 'quantity']);
  });
});
