import type { TransactionRow, User } from '@ledgerline/contracts';
import type { TaskChip, ViewSchema } from '@ledgerline/ui';
import type { LLColumnDef } from '@ledgerline/ui/grid';

export const GRID_ID = 'transactions';

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

/** How far a trade price may sit from the vendor price before it is a breach. The API warns at the same level (LL-VAL-0207). */
export const PRICE_TOLERANCE_PCT = '5';

/** Every column in this grid uses the natural sign convention; conventions are never mixed in one grid. */
export const columns: LLColumnDef<TransactionRow>[] = [
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
    groupable: true,
    value: (r) => r.status,
    statuses: {
      unposted: { label: 'Unposted', tone: 'neutral' },
      posted: { label: 'Posted', tone: 'good' },
      reversed: { label: 'Reversed', tone: 'warning' },
    },
  },
  {
    field: 'type',
    header: 'Type',
    type: 'text',
    width: 132,
    groupable: true,
    value: (r) => TYPE_LABELS[r.type] ?? r.type,
  },
  {
    field: 'tradeDate',
    header: 'Trade date',
    type: 'date',
    dateBasis: 'trade',
    width: 112,
    groupable: true,
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
    // Inline delta column (SPEC 7.1): the trade price against the vendor price, without leaving the grid.
    field: 'priceVsVendor',
    header: 'Price vs vendor',
    type: 'delta',
    width: 170,
    hiddenByDefault: true,
    referenceLabel: 'vendor',
    tolerancePct: PRICE_TOLERANCE_PCT,
    value: (r) => (r.price.value === null ? undefined : r.price),
    reference: (r) => r.vendorPrice,
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
  {
    field: 'portfolio',
    header: 'Portfolio',
    type: 'entity',
    width: 260,
    groupable: true,
    value: (r) => r.portfolio,
  },
];

/**
 * View schema for this grid. Version 2 renamed the id columns to the entity columns the grid shows now;
 * views saved at version 1 are migrated when they load (and `currency`, which no longer exists, is dropped).
 */
export const viewSchema: ViewSchema = {
  version: 2,
  columns: columns.map((c) => c.field),
  renames: { 2: { portfolioId: 'portfolio', securityId: 'security' } },
  hiddenByDefault: columns.filter((c) => c.hiddenByDefault).map((c) => c.field),
};

/** Names for filter fields that are not columns, used in filter tags. */
export const filterLabels: Record<string, string> = {
  portfolioId: 'Portfolio',
  securityId: 'Security',
  createdBy: 'Created by',
  warning: 'Warning',
};

export const taskChips = (user: User): TaskChip[] => [
  { id: 'warnings', label: 'Warnings only', filter: { field: 'warning', op: 'isNotNull' } },
  { id: 'mine', label: 'My records', filter: { field: 'createdBy', op: 'eq', value: user.id } },
  { id: 'today', label: 'Today', filter: { field: 'tradeDate', op: 'relative', period: 'today' } },
];

export const rowId = (row: TransactionRow) => row.id;
export const rowMessages = (row: TransactionRow) => (row.warning ? [row.warning] : []);

export const ASSET_CLASSES = [
  'govt',
  'corporate',
  'muni',
  'mbs',
  'tba',
  'equity',
  'future',
  'swap',
  'fxForward',
];
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];
