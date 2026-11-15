import type { GridQuery, GridResponse, TransactionRow } from '@ledgerline/contracts';
import {
  gridFeatures,
  LLGrid,
  type LLColumnDef,
  type LLDataSource,
  type LLGridHandle,
} from '@ledgerline/ui/grid';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import { api, type Me } from '../api/client';
import { useSession } from '../state/session';
import { TransactionPanel } from './TransactionPanel';

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

/** The transactions grid on seeded data. Opening a row shows its detail panel, where financial values can be edited. */
export function Transactions() {
  const { user } = useOutletContext<Me>();
  const setDensity = useSession((s) => s.setDensity);
  const grid = useRef<LLGridHandle>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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
  const openRow = useCallback((row: TransactionRow) => setOpenId(row.id), []);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <header className="shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
          {user.blotterScope ? (
            <p className="text-muted-foreground">
              Showing only your portfolios: {user.blotterScope.join(', ')}. Other records are outside your
              account scope.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Press Enter on a row, or double-click it, to open the transaction.
            </p>
          )}
        </header>
        <LLGrid
          key={user.id}
          ref={grid}
          gridId="transactions"
          label="Transactions"
          columns={columns}
          dataSource={dataSource}
          rowId={rowId}
          rowMessages={rowMessages}
          features={features}
          onRowOpen={openRow}
          onDensityChange={setDensity}
        />
      </div>
      {openId ? (
        <TransactionPanel
          key={`${user.id}-${openId}`}
          id={openId}
          user={user}
          onSaved={() => grid.current?.refresh()}
          onClose={() => {
            const id = openId;
            setOpenId(null);
            // Focus goes back to the row the panel was opened from.
            setTimeout(() => grid.current?.focusRow(id), 0);
          }}
        />
      ) : null}
    </div>
  );
}
