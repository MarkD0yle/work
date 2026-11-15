import type { ExceptionType, FilterCondition, PriceRow } from '@ledgerline/contracts';
import { Tabs, TabsContent, TabsList, TabsTrigger, TaskChips, type TaskChip } from '@ledgerline/ui';
import { gridFeatures, LLGrid, type LLColumnDef, type LLDataSource } from '@ledgerline/ui/grid';
import { useMemo, useState } from 'react';
import { describeFailedRule, ExceptionQueue } from '../accounting/ExceptionQueue';
import { queryPrices, type Me } from '../services';
import { ToleranceRules } from './ToleranceRules';

const PRICE_TYPES: ExceptionType[] = ['priceStale', 'priceVariance', 'priceMissing'];
const STATUS = {
  ok: { label: 'Within rules', tone: 'good' },
  stale: { label: 'Stale', tone: 'warning' },
  variance: { label: 'Variance', tone: 'critical' },
  missing: { label: 'Missing', tone: 'critical' },
} as const;
const ASSET: Record<string, string> = {
  govt: 'Government',
  corporate: 'Corporate',
  muni: 'Municipal',
  mbs: 'MBS',
  tba: 'TBA',
  equity: 'Equity',
  future: 'Future',
  swap: 'Swap',
  fxForward: 'FX forward',
};
const NOUN = { one: 'price', many: 'prices' };

const columns: LLColumnDef<PriceRow>[] = [
  {
    field: 'security',
    header: 'Security',
    type: 'entity',
    width: 300,
    pinned: 'left',
    value: (p) => p.security,
  },
  {
    field: 'assetClass',
    header: 'Asset class',
    type: 'text',
    width: 130,
    groupable: true,
    value: (p) => ASSET[p.assetClass] ?? p.assetClass,
  },
  {
    field: 'priceDate',
    header: 'Price date',
    type: 'date',
    dateBasis: 'valuation',
    width: 150,
    value: (p) => p.priceDate,
  },
  {
    field: 'price',
    header: 'Price',
    type: 'financial',
    financialKind: 'price',
    width: 150,
    value: (p) => p.price,
  },
  {
    field: 'priorPrice',
    header: 'Prior day',
    type: 'financial',
    financialKind: 'price',
    width: 150,
    value: (p) => p.priorPrice,
  },
  // The prior-day comparison is a column beside the price, not another screen (SPEC 7.1, 8.4).
  {
    field: 'vsPriorDay',
    header: 'Price vs prior day',
    type: 'delta',
    width: 190,
    referenceLabel: 'prior day',
    tolerancePct: '2',
    value: (p) => p.price,
    reference: (p) => p.priorPrice,
  },
  {
    field: 'toleranceStatus',
    header: 'Result',
    type: 'status',
    width: 130,
    groupable: true,
    value: (p) => p.toleranceStatus,
    statuses: STATUS,
  },
  {
    field: 'failedRule',
    header: 'Rule that failed',
    type: 'text',
    width: 440,
    sortable: false,
    value: (p) => (p.failedRule ? describeFailedRule(p.failedRule) : ''),
  },
  { field: 'source', header: 'Source', type: 'text', width: 160, groupable: true, value: (p) => p.source },
];

/**
 * Price Review (SPEC 8.4): price exceptions with the rule that failed, the prices themselves with the prior day
 * beside them, and the tolerance rules Market Data owns.
 */
export function PriceReview({ me }: { me: Me }) {
  const [filters, setFilters] = useState<FilterCondition[]>([
    { field: 'priceDate', op: 'relative', period: 'yesterday' },
    { field: 'toleranceStatus', op: 'neq', value: 'ok' },
  ]);
  const dataSource = useMemo<LLDataSource<PriceRow>>(() => ({ kind: 'server', query: queryPrices }), []);
  const features = useMemo(() => ({ ...gridFeatures(me.user.segment), selection: false }), [me.user.segment]);
  const chips = useMemo<TaskChip[]>(
    () => [
      {
        id: 'latest',
        label: 'Latest prices',
        filter: { field: 'priceDate', op: 'relative', period: 'yesterday' },
      },
      { id: 'failing', label: 'Outside rules', filter: { field: 'toleranceStatus', op: 'neq', value: 'ok' } },
      { id: 'stale', label: 'Stale', filter: { field: 'toleranceStatus', op: 'eq', value: 'stale' } },
      { id: 'missing', label: 'Missing', filter: { field: 'toleranceStatus', op: 'eq', value: 'missing' } },
    ],
    [],
  );
  return (
    <Tabs defaultValue="exceptions" className="h-full">
      <TabsList aria-label="Price review sections">
        <TabsTrigger value="exceptions">Price exceptions</TabsTrigger>
        <TabsTrigger value="prices">Prices</TabsTrigger>
        <TabsTrigger value="rules">Tolerance rules</TabsTrigger>
      </TabsList>
      <TabsContent value="exceptions" className="pt-3">
        <ExceptionQueue
          me={me}
          types={PRICE_TYPES}
          gridId="price-exceptions"
          initialFilters={[{ field: 'status', op: 'in', value: ['new', 'inProgress', 'waitingOnOthers'] }]}
        />
      </TabsContent>
      <TabsContent value="prices" className="flex flex-col gap-2 pt-3">
        <TaskChips chips={chips} filters={filters} onChange={setFilters} />
        <LLGrid
          gridId="prices"
          label="Prices"
          columns={columns}
          dataSource={dataSource}
          rowId={(p) => p.id}
          features={features}
          filters={filters}
          onFiltersChange={setFilters}
          filterLabels={{ toleranceStatus: 'Result' }}
          noun={NOUN}
        />
      </TabsContent>
      <TabsContent value="rules" className="overflow-y-auto pt-3">
        <ToleranceRules me={me} />
      </TabsContent>
    </Tabs>
  );
}
