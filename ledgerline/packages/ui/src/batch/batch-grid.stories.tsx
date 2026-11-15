import type { Message } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { BatchGrid, type BatchColumn, type BatchRow } from './batch-grid';

const meta: Meta = { title: 'Grid/BatchGrid' };
export default meta;

const columns: BatchColumn[] = [
  { field: 'id', header: 'Transaction', chars: 11 },
  { field: 'tradeDate', header: 'Trade date', chars: 11 },
  { field: 'quantity', header: 'Quantity', align: 'right', chars: 14 },
  { field: 'price', header: 'Price', align: 'right', chars: 12 },
];
const notNumber: Message = {
  code: 'LL-VAL-0072',
  severity: 'error',
  level: 'row',
  text: 'Quantity "lots" is not a number.',
  fix: 'Enter a number such as 1250000.00.',
  target: 'quantity',
};
const late: Message = {
  code: 'LL-VAL-0150',
  severity: 'warning',
  level: 'row',
  text: 'Trade date 2026-12-01 is in the future.',
  fix: 'Check the date, or acknowledge to keep it.',
  target: 'tradeDate',
};
const rows: BatchRow[] = [
  {
    key: '1',
    values: { id: 'T-0000101', tradeDate: '2026-11-13', quantity: '1,250,000', price: '99.125' },
    status: 'valid',
    messages: [],
  },
  {
    key: '2',
    values: { id: 'T-0000102', tradeDate: '2026-11-13', quantity: 'lots', price: '101.5' },
    status: 'error',
    messages: [notNumber],
  },
  {
    key: '3',
    values: { id: 'T-0000103', tradeDate: '2026-12-01', quantity: '500,000', price: '98.75' },
    status: 'warning',
    messages: [late],
  },
  {
    key: '4',
    values: { id: 'T-0000104', tradeDate: '2026-11-13', quantity: '75,000', price: '100' },
    status: 'pending',
    messages: [],
  },
  {
    key: '5',
    values: { id: 'T-0000105', tradeDate: '2026-11-13', quantity: '10', price: '100' },
    status: 'valid',
    messages: [],
    excluded: true,
  },
];

function Demo({ initial }: { initial: BatchRow[] }) {
  const [state, setState] = useState(initial);
  return (
    <div className="h-96">
      <BatchGrid
        label="Rows to import"
        columns={columns}
        rows={state}
        onEdit={(edits) =>
          setState((prev) =>
            prev.map((r) => {
              const mine = edits.filter((e) => e.key === r.key);
              return mine.length
                ? {
                    ...r,
                    values: { ...r.values, ...Object.fromEntries(mine.map((e) => [e.field, e.value])) },
                    status: 'pending',
                    messages: [],
                  }
                : r;
            }),
          )
        }
        onExclude={(keys, excluded) =>
          setState((prev) => prev.map((r) => (keys.includes(r.key) ? { ...r, excluded } : r)))
        }
      />
    </div>
  );
}

export const MixedResults: StoryObj = { render: () => <Demo initial={rows} /> };
export const AllValid: StoryObj = { render: () => <Demo initial={rows.slice(0, 1)} /> };
export const Empty: StoryObj = { render: () => <Demo initial={[]} /> };
