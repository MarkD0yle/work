import type { BusinessDate, FinancialValue, Message, UiState } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { FilterCondition } from '@ledgerline/contracts';
import { NotificationProvider } from '../state/notifications';
import { LLGrid } from './ll-grid';
import type { LLColumnDef, LLDataSource } from './types';

interface Row {
  id: string;
  status: string;
  tradeDate: BusinessDate;
  security: string;
  price: FinancialValue;
  amount: FinancialValue;
  taxId: string;
  warning?: Message;
}

const money = (
  value: string | null,
  currency: string,
  over: Partial<FinancialValue> = {},
): FinancialValue => ({
  kind: 'currencyAmount',
  value,
  currency,
  precision: currency === 'JPY' ? 0 : 2,
  signConvention: 'natural',
  provenance: { origin: 'calculated', source: 'Quantity × price' },
  ...over,
});
const price = (value: string | null): FinancialValue => ({
  kind: 'price',
  value,
  precision: 6,
  signConvention: 'natural',
  provenance: { origin: 'vendor', source: 'Primary vendor', asOf: '2026-11-13T22:00:00Z' },
  ...(value === null ? { nullReason: 'missing' as const } : {}),
});

const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: `T-${String(i + 1).padStart(7, '0')}`,
  status: i % 5 === 0 ? 'unposted' : i % 11 === 0 ? 'reversed' : 'posted',
  tradeDate: { value: i === 7 ? null : `2026-11-${String(13 - (i % 10)).padStart(2, '0')}`, basis: 'trade' },
  security: [
    'US TREASURY N/B 3.875% 2031-05-15',
    'UK TSY GILT 4.250% 2034-06-07',
    'JAPAN GOVT BOND 0.500% 2030-03-20',
  ][i % 3] as string,
  price: price(i === 3 ? null : (99.5 + i * 0.03125).toString()),
  amount: money(i === 4 ? null : String(1_000_000 + i * 12_345.678), i % 3 === 2 ? 'JPY' : 'USD', {
    ...(i === 4 ? { nullReason: 'unavailable' as const } : {}),
    ...(i === 2
      ? {
          provenance: {
            origin: 'overridden' as const,
            originalValue: '1000000.00',
            overrideReason: 'Agreed net amount.',
          },
        }
      : {}),
  }),
  taxId: `98-${1000 + i}`,
  ...(i % 9 === 1
    ? {
        warning: {
          code: 'LL-VAL-0207',
          severity: 'warning' as const,
          level: 'row' as const,
          text: 'Price differs from the vendor price.',
          fix: 'Check the trade ticket.',
        },
      }
    : {}),
}));

const columns: LLColumnDef<Row>[] = [
  { field: 'id', header: 'Transaction', type: 'text', mono: true, value: (r) => r.id },
  {
    field: 'status',
    header: 'Status',
    type: 'status',
    value: (r) => r.status,
    statuses: {
      unposted: { label: 'Unposted', tone: 'neutral' },
      posted: { label: 'Posted', tone: 'good' },
      reversed: { label: 'Reversed', tone: 'warning' },
    },
  },
  { field: 'tradeDate', header: 'Trade date', type: 'date', dateBasis: 'trade', value: (r) => r.tradeDate },
  { field: 'security', header: 'Security', type: 'text', width: 280, value: (r) => r.security },
  {
    field: 'price',
    header: 'Price',
    type: 'financial',
    financialKind: 'price',
    qualifier: 'clean',
    value: (r) => r.price,
  },
  {
    field: 'amount',
    header: 'Amount',
    type: 'financial',
    financialKind: 'currencyAmount',
    aggregate: true,
    value: (r) => r.amount,
  },
  {
    field: 'taxId',
    header: 'Client tax id',
    type: 'text',
    value: (r) => r.taxId,
    restricted: { reason: 'Personal data cannot be copied.' },
  },
];

const features = { selection: true, copy: true, quickSearch: true };
const client: LLDataSource<Row> = { kind: 'client', rows };
const rowId = (r: Row) => r.id;
const rowMessages = (r: Row) => (r.warning ? [r.warning] : []);

const meta: Meta = {
  title: 'Grid/LLGrid',
  decorators: [
    (Story) => (
      <NotificationProvider>
        <div className="flex h-[32rem] w-full flex-col">
          <Story />
        </div>
      </NotificationProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj;

const grid = (over: { dataSource?: LLDataSource<Row>; state?: UiState; features?: typeof features } = {}) => (
  <LLGrid
    gridId="story"
    label="Transactions"
    columns={columns}
    rowId={rowId}
    rowMessages={rowMessages}
    dataSource={over.dataSource ?? client}
    features={over.features ?? features}
    {...(over.state ? { state: over.state } : {})}
  />
);

export const Normal: Story = { render: () => grid() };
export const Loading: Story = {
  render: () => grid({ dataSource: { kind: 'server', query: () => new Promise(() => undefined) } }),
};
export const Empty: Story = { render: () => grid({ dataSource: { kind: 'client', rows: [] } }) };
export const NoMatches: Story = { render: () => grid({ state: { kind: 'noMatches', activeFilters: 2 } }) };
export const Warning: Story = {
  render: () =>
    grid({
      state: {
        kind: 'warning',
        messages: [
          {
            code: 'LL-VAL-0207',
            severity: 'warning',
            level: 'section',
            text: '4 rows have prices outside tolerance.',
            fix: 'Review the marked rows.',
          },
        ],
      },
    }),
};
export const BlockingError: Story = {
  render: () =>
    grid({
      dataSource: {
        kind: 'server',
        query: () =>
          Promise.reject({
            messages: [
              {
                code: 'LL-NET-0001',
                severity: 'error',
                level: 'operation',
                text: 'The Ledgerline API did not respond.',
                fix: 'Check your connection, then retry.',
              },
            ],
          }),
      },
    }),
};
export const PermissionLimited: Story = {
  render: () =>
    grid({
      state: { kind: 'permissionLimited', reason: 'These transactions are outside your account scope.' },
    }),
};
export const Stale: Story = {
  render: () =>
    grid({
      state: {
        kind: 'stale',
        asOf: '2026-11-14T15:40:00Z',
        refresh: { actionId: 'refresh', label: 'Refresh' },
      },
    }),
};
/** External clients: read and copy only, no selection. */
export const ClientRole: Story = {
  render: () => grid({ features: { selection: false, copy: true, quickSearch: true } }),
};

function Filtered() {
  const [filters, setFilters] = useState<FilterCondition[]>([
    { field: 'status', op: 'eq', value: 'unposted' },
    { field: 'tradeDate', op: 'relative', period: 'yesterday' },
  ]);
  return (
    <LLGrid
      gridId="story-filtered"
      label="Transactions"
      columns={columns}
      rowId={rowId}
      dataSource={client}
      features={features}
      filters={filters}
      onFiltersChange={setFilters}
      onDensityChange={() => undefined}
    />
  );
}

/** Every active filter is a removable tag; the toolbar also offers columns and density. */
export const FilterTags: Story = { render: () => <Filtered /> };
