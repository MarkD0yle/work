import type { GridQuery, GridResponse, TransactionRow } from '@ledgerline/contracts';
import { gridFeatures, LLGrid, type LLColumnDef, type LLDataSource } from '@ledgerline/ui/grid';
import { useMemo } from 'react';
import { useOutletContext } from 'react-router';
import { api, type Me } from '../api/client';

const TYPE_LABELS: Record<string, string> = {
  buy: 'Buy',
  sell: 'Sell',
  income: 'Income',
  corporateAction: 'Corporate action',
  repo: 'Repo',
  margin: 'Margin',
  maturity: 'Maturity',
  fee: 'Fee',
};

/** Every column in this grid uses the natural sign convention; conventions are never mixed in one grid. */
const columns: LLColumnDef<TransactionRow>[] = [
  {
    field: 'id',
    header: 'Transaction',
    type: 'text',
    mono: true,
    width: 116,
    pinned: 'left',
    value: (r) => r.id,
  },
  {
    field: 'status',
    header: 'Status',
    type: 'status',
    width: 104,
    value: (r) => r.status,
    statuses: {
      unposted: { label: 'Unposted', tone: 'neutral' },
      posted: { label: 'Posted', tone: 'good' },
      reversed: { label: 'Reversed', tone: 'warning' },
    },
  },
  { field: 'type', header: 'Type', type: 'text', width: 132, value: (r) => TYPE_LABELS[r.type] ?? r.type },
  {
    field: 'tradeDate',
    header: 'Trade date',
    type: 'date',
    dateBasis: 'trade',
    width: 112,
    value: (r) => r.tradeDate,
  },
  {
    field: 'settleDate',
    header: 'Settle date',
    type: 'date',
    dateBasis: 'settle',
    width: 112,
    value: (r) => r.settleDate,
  },
  { field: 'security', header: 'Security', type: 'entity', width: 250, value: (r) => r.security },
  {
    field: 'quantity',
    header: 'Quantity',
    type: 'financial',
    financialKind: 'quantity',
    width: 150,
    value: (r) => r.quantity,
  },
  {
    field: 'price',
    header: 'Price',
    type: 'financial',
    financialKind: 'price',
    width: 130,
    value: (r) => r.price,
  },
  {
    field: 'amount',
    header: 'Amount',
    type: 'financial',
    financialKind: 'currencyAmount',
    width: 190,
    aggregate: true,
    value: (r) => r.amount,
  },
  { field: 'portfolio', header: 'Portfolio', type: 'entity', width: 260, value: (r) => r.portfolio },
];

const rowId = (row: TransactionRow) => row.id;
const rowMessages = (row: TransactionRow) => (row.warning ? [row.warning] : []);

/** Milestone 1: the read-only transactions grid on seeded data. Views, actions and editing arrive in later milestones. */
export function Transactions() {
  const { user } = useOutletContext<Me>();
  const dataSource = useMemo<LLDataSource<TransactionRow>>(
    () => ({
      kind: 'server',
      query: (query: GridQuery) =>
        api<GridResponse<TransactionRow>>('/transactions/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query),
        }),
    }),
    // A different user sees different rows (blotter scope), so the data source is rebuilt per user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.id],
  );
  const features = useMemo(() => gridFeatures(user.segment), [user.segment]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <header className="shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
        {user.blotterScope ? (
          <p className="text-muted-foreground">
            Showing only your portfolios: {user.blotterScope.join(', ')}. Other records are outside your
            account scope.
          </p>
        ) : null}
      </header>
      <LLGrid
        key={user.id}
        gridId="transactions"
        label="Transactions"
        columns={columns}
        dataSource={dataSource}
        rowId={rowId}
        rowMessages={rowMessages}
        features={features}
      />
    </div>
  );
}
