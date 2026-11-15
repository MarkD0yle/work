import type { PositionRow, Statement } from '@ledgerline/contracts';
import {
  Button,
  formatPeriod,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useNotifications,
} from '@ledgerline/ui';
import { gridFeatures, LLGrid, type LLColumnDef, type LLDataSource } from '@ledgerline/ui/grid';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { download, fetchStatements, problemOf, queryPositions, type Me } from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { TransactionsBlotter } from '../transactions/TransactionsBlotter';

const columns: LLColumnDef<PositionRow>[] = [
  {
    field: 'portfolio',
    header: 'Portfolio',
    type: 'entity',
    width: 280,
    groupable: true,
    value: (p) => p.portfolio,
  },
  { field: 'security', header: 'Security', type: 'entity', width: 320, value: (p) => p.security },
  {
    field: 'assetClass',
    header: 'Asset class',
    type: 'text',
    width: 130,
    groupable: true,
    value: (p) => p.assetClass,
  },
  {
    field: 'quantity',
    header: 'Quantity',
    type: 'financial',
    financialKind: 'quantity',
    width: 170,
    value: (p) => p.quantity,
  },
  {
    field: 'marketValue',
    header: 'Market value',
    type: 'financial',
    financialKind: 'marketValue',
    width: 200,
    aggregate: true,
    value: (p) => p.marketValue,
  },
  {
    field: 'asOf',
    header: 'As of',
    type: 'date',
    dateBasis: 'valuation',
    width: 150,
    sortable: false,
    value: (p) => p.asOf,
  },
];
const NOUN = { one: 'position', many: 'positions' };

function useDownload() {
  const { notify } = useNotifications();
  const [busy, setBusy] = useState<string | null>(null);
  const run = (statement: Statement) => {
    setBusy(statement.id);
    void download(statement.url, `${statement.id}.pdf`)
      .catch((error: unknown) => {
        for (const m of problemOf(error)?.messages ?? []) notify(m, 'Statements');
      })
      .finally(() => setBusy(null));
  };
  return { busy, run };
}

/**
 * Client Home (SPEC 8.6). An external client needs three things, on one page: their positions, their transactions
 * and their statements. The latest month-end statement is one click away from sign-in.
 */
export function ClientHome({ me }: { me: Me }) {
  const statements = useQuery({ queryKey: ['statements', me.user.id], queryFn: fetchStatements });
  const { busy, run } = useDownload();
  const dataSource = useMemo<LLDataSource<PositionRow>>(
    () => ({ kind: 'server', query: queryPositions }),
    [],
  );
  const features = useMemo(() => gridFeatures(me.user.segment), [me.user.segment]);
  const latestPeriod = statements.data?.[0]?.periodEnd;
  const latest = statements.data?.filter((s) => s.periodEnd === latestPeriod) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section
        aria-label="Latest statements"
        data-slot="latest-statements"
        className="shrink-0 rounded-md border px-3 py-2"
      >
        {statements.isPending ? (
          <LoadingPanel label="Loading statements…" />
        ) : statements.error ? (
          <ErrorPanel
            messages={problemOf(statements.error)?.messages ?? []}
            onRetry={() => void statements.refetch()}
          />
        ) : latest.length === 0 ? (
          <p className="text-muted-foreground">
            No statements yet. Your first month-end statement appears here after the month closes.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Latest statement: {formatPeriod(latestPeriod as string)}</h2>
            {latest.map((s) => (
              <Button
                key={s.id}
                variant="secondary"
                disabled={busy !== null}
                aria-label={`Download statement for ${s.portfolio.label}, ${formatPeriod(s.periodEnd)}`}
                onClick={() => run(s)}
              >
                {busy === s.id ? 'Preparing…' : `Download statement for ${s.portfolio.label}`}
              </Button>
            ))}
          </div>
        )}
      </section>
      <Tabs defaultValue="positions" className="flex-1">
        <TabsList aria-label="Your account">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="statements">All statements</TabsTrigger>
        </TabsList>
        <TabsContent value="positions" className="flex flex-col pt-3">
          <LLGrid
            gridId="client-positions"
            label="Positions"
            columns={columns}
            dataSource={dataSource}
            rowId={(p) => p.id}
            features={features}
            noun={NOUN}
          />
        </TabsContent>
        <TabsContent value="transactions" className="pt-3">
          <TransactionsBlotter me={me} />
        </TabsContent>
        <TabsContent value="statements" className="overflow-y-auto pt-3">
          {statements.data?.length ? (
            <table aria-label="Statements" className="w-full max-w-3xl text-body">
              <thead className="bg-muted text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Month
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Portfolio
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Statement
                  </th>
                </tr>
              </thead>
              <tbody>
                {statements.data.map((s) => (
                  <tr key={s.id} className="border-t">
                    <th scope="row" className="px-3 py-1 text-left font-normal">
                      {formatPeriod(s.periodEnd)}
                    </th>
                    <td className="px-3 py-1">
                      {s.portfolio.label}{' '}
                      <span className="font-mono text-xs text-muted-foreground">{s.portfolio.id}</span>
                    </td>
                    <td className="px-3 py-1">
                      <Button
                        variant="ghost"
                        disabled={busy !== null}
                        aria-label={`Download PDF: ${s.portfolio.label}, ${formatPeriod(s.periodEnd)}`}
                        onClick={() => run(s)}
                      >
                        Download PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground">No statements yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
