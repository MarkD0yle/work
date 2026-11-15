import type { Message } from '@ledgerline/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BatchGrid, type BatchColumn, type BatchEdit, type BatchRow } from './batch-grid';
import { parseDelimited } from './tabular';

describe('parseDelimited', () => {
  it('reads a spreadsheet paste (tabs) and drops blank lines', () => {
    expect(parseDelimited('Id\tQuantity\r\nT-1\t1,000\r\n\r\nT-2\t 2,000 \n')).toEqual([
      ['Id', 'Quantity'],
      ['T-1', '1,000'],
      ['T-2', '2,000'],
    ]);
  });
  it('reads CSV with quoted cells, embedded commas, quotes and line breaks', () => {
    expect(parseDelimited('Id,Note,Quantity\nT-1,"1,000 ""lots""\nmore",5\n')).toEqual([
      ['Id', 'Note', 'Quantity'],
      ['T-1', '1,000 "lots"\nmore', '5'],
    ]);
  });
  it('reads semicolon files and ignores a byte-order mark', () => {
    expect(parseDelimited('﻿Id;Quantity\nT-1;5')).toEqual([
      ['Id', 'Quantity'],
      ['T-1', '5'],
    ]);
  });
});

const columns: BatchColumn[] = [
  { field: 'Id', header: 'Transaction', messageTarget: 'id' },
  { field: 'Qty', header: 'Quantity', align: 'right', messageTarget: 'quantity' },
];
const error: Message = {
  code: 'LL-VAL-0072',
  severity: 'error',
  level: 'row',
  text: 'Quantity "lots" is not a number.',
  fix: 'Enter a number.',
  target: 'quantity',
};
const start = (): BatchRow[] => [
  { key: 'a', values: { Id: 'T-1', Qty: '100' }, status: 'valid', messages: [] },
  { key: 'b', values: { Id: 'T-2', Qty: 'lots' }, status: 'error', messages: [error] },
  { key: 'c', values: { Id: 'T-3', Qty: '300' }, status: 'valid', messages: [] },
];

function Harness({
  onEdit,
  initial = start(),
}: {
  onEdit?: (edits: BatchEdit[]) => void;
  initial?: BatchRow[];
}) {
  const [rows, setRows] = useState(initial);
  return (
    <BatchGrid
      label="Rows to import"
      columns={columns}
      rows={rows}
      onEdit={(edits) => {
        onEdit?.(edits);
        setRows((prev) =>
          prev.map((r) => {
            const mine = edits.filter((e) => e.key === r.key);
            return mine.length
              ? {
                  ...r,
                  values: { ...r.values, ...Object.fromEntries(mine.map((e) => [e.field, e.value])) },
                  status: 'pending' as const,
                  messages: [],
                }
              : r;
          }),
        );
      }}
      onExclude={(keys, excluded) =>
        setRows((prev) => prev.map((r) => (keys.includes(r.key) ? { ...r, excluded } : r)))
      }
    />
  );
}
const cell = (name: string) => screen.getByRole('textbox', { name });

describe('BatchGrid', () => {
  it('summarises the rows and marks the cell an error belongs to', () => {
    render(<Harness />);
    expect(screen.getByText(/3 rows:/).parentElement).toHaveTextContent(
      '3 rows: 2 valid, 0 warnings, 1 error',
    );
    expect(cell('Quantity, row 2')).toHaveAttribute('aria-invalid', 'true');
    expect(cell('Quantity, row 1')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Quantity "lots" is not a number.')).toBeInTheDocument();
    expect(screen.getByText('LL-VAL-0072')).toBeInTheDocument();
  });

  it('reports an edit when the user leaves the cell, and only if it changed', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    await user.click(cell('Quantity, row 2'));
    await user.keyboard('{Control>}a{/Control}250');
    expect(onEdit).not.toHaveBeenCalled();
    await user.keyboard('{ArrowDown}');
    expect(onEdit).toHaveBeenCalledWith([{ key: 'b', field: 'Qty', value: '250' }]);
    expect(cell('Quantity, row 3')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(cell('Quantity, row 1')).toHaveFocus();
  });

  it('fills down from the cell above with Ctrl+D', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    await user.click(cell('Quantity, row 2'));
    await user.keyboard('{Control>}d{/Control}');
    expect(onEdit).toHaveBeenCalledWith([{ key: 'b', field: 'Qty', value: '100' }]);
    expect(cell('Quantity, row 2')).toHaveValue('100');
  });

  it('fills a selected run of cells from its top cell', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    await user.click(cell('Quantity, row 1'));
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}{Control>}d{/Control}');
    expect(onEdit).toHaveBeenLastCalledWith([
      { key: 'b', field: 'Qty', value: '100' },
      { key: 'c', field: 'Qty', value: '100' },
    ]);
  });

  it('lands a multi-cell paste as a block from the focused cell', () => {
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    fireEvent.paste(cell('Transaction, row 2'), {
      clipboardData: { getData: () => 'T-9\t900\nT-8\t300\nT-7\t1' },
    });
    expect(onEdit).toHaveBeenCalledWith([
      { key: 'b', field: 'Id', value: 'T-9' },
      { key: 'b', field: 'Qty', value: '900' },
      { key: 'c', field: 'Id', value: 'T-8' },
    ]);
    expect(screen.getByText(/1 row did not fit/)).toBeInTheDocument();
  });

  it('excludes a row: it stays visible, is not editable and leaves the counts', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: 'Include row 2' }));
    expect(cell('Quantity, row 2')).toBeDisabled();
    expect(screen.getByText(/3 rows:/).parentElement).toHaveTextContent(
      '2 valid, 0 warnings, 0 errors, 1 excluded',
    );
  });

  it('filters to rows with errors', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Errors (1)' }));
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement;
    expect(within(body).getAllByRole('row')).toHaveLength(1);
    expect(cell('Quantity, row 2')).toBeInTheDocument();
  });

  it('pages long batches', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 120 }, (_, i): BatchRow => ({
      key: `r${i}`,
      values: { Id: `T-${i}`, Qty: '1' },
      status: 'valid',
      messages: [],
    }));
    render(<Harness initial={many} />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(cell('Quantity, row 51')).toBeInTheDocument();
  });
});
