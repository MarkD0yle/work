import type {
  ActionContext,
  ActionDef,
  CloseChecklist,
  CloseType,
  Job,
  Message,
  PeriodOverviewRow,
  PeriodState,
  Permission,
  User,
} from '@ledgerline/contracts';
import {
  Badge,
  Button,
  ComparisonTable,
  formatIsoDate,
  formatPeriod,
  formatTimestamp,
  SectionBanner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  useNotifications,
} from '@ledgerline/ui';
import {
  gridFeatures,
  LLGrid,
  type GridJobs,
  type LLColumnDef,
  type LLDataSource,
  type LLGridHandle,
} from '@ledgerline/ui/grid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReasonDialog } from '../common/ReasonDialog';
import { SidePanel } from '../common/SidePanel';
import { noteJob, watchJob } from '../jobs/job-store';
import {
  closePeriods,
  createClosePackage,
  download,
  fetchBooksComparison,
  fetchChecklist,
  fetchCloseOverview,
  fetchJob,
  fetchPermissions,
  problemOf,
  requestBlockOverride,
  requestReopen,
  retryJob,
  signOffPeriod,
  type Me,
} from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { RecordHistory } from '../transactions/RecordHistory';

const CLOSE_TYPES: { type: CloseType; label: string }[] = [
  { type: 'transaction', label: 'Transaction' },
  { type: 'valuation', label: 'Valuation' },
  { type: 'bankAccount', label: 'Bank account' },
  { type: 'generalLedger', label: 'General ledger' },
];
const STATE: Record<PeriodState, { label: string; tone: 'neutral' | 'info' | 'good' | 'warning' }> = {
  open: { label: 'Open', tone: 'neutral' },
  closing: { label: 'Closing', tone: 'info' },
  closed: { label: 'Closed', tone: 'good' },
  reopened: { label: 'Reopened', tone: 'warning' },
};
const CHECK = {
  passed: { label: 'Passed', tone: 'good' },
  warning: { label: 'Open items', tone: 'warning' },
  blocked: { label: 'Blocked', tone: 'critical' },
} as const;
const NOUN = { one: 'portfolio', many: 'portfolios' };
const n = (value: number) => value.toLocaleString('en-US');

/** Whole days from the business date to the cutoff, in words. Counted from the engine's date, not the browser clock. */
export function cutoffCountdown(cutoff: string, businessDate: string): string {
  const days = Math.round(
    (Date.parse(`${cutoff.slice(0, 10)}T00:00:00Z`) - Date.parse(`${businessDate}T00:00:00Z`)) / 86_400_000,
  );
  const when = formatIsoDate(cutoff.slice(0, 10));
  if (days > 1) return `${days} days left · ${when}`;
  if (days === 1) return `Tomorrow · ${when}`;
  if (days === 0) return `Today · ${when}`;
  return `${-days} ${days === -1 ? 'day' : 'days'} past · ${when}`;
}

const GRID_JOBS: GridJobs = {
  watch: watchJob,
  retry: async (jobId) => {
    const job = await retryJob(jobId);
    noteJob(job);
    return { jobId: job.id, status: 'queued', succeeded: [], failed: [], skipped: [] };
  },
};
const permitted =
  (action: string) =>
  (ctx: ActionContext<PeriodOverviewRow>): Permission =>
    ctx.permissions.find((p) => p.action === action) ?? {
      action,
      accessLevel: 'none',
      allowed: false,
      reason: 'role',
      explanation: 'Your role does not include this action.',
    };

export interface CloseConsoleProps {
  me: Me;
  /** Opens the exception queue filtered to one portfolio's blocking exceptions. */
  onOpenExceptions: (portfolioId: string, periodEnd: string) => void;
}

/**
 * The Period Close Console (SPEC 8.3). It opens on the overview: every portfolio with its cutoff countdown,
 * checks passed, what is blocking and its close status, on one screen. Opening a portfolio shows its checklist.
 * Many portfolios close in one job, with a result for each.
 */
export function CloseConsole({ me, onOpenExceptions }: CloseConsoleProps) {
  const { user } = me;
  const grid = useRef<LLGridHandle>(null);
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ['close-overview', user.id, scope],
    queryFn: () => fetchCloseOverview(null, scope),
  });
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });
  const all = useMemo(() => overview.data ?? [], [overview.data]);
  const rows = useMemo(() => (blockedOnly ? all.filter((r) => r.blocking > 0) : all), [all, blockedOnly]);
  const periodEnd = all[0]?.periodEnd ?? null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['close-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['checklist'] });
    void queryClient.invalidateQueries({ queryKey: ['audit'] });
  }, [queryClient]);

  const dataSource = useMemo<LLDataSource<PeriodOverviewRow>>(() => ({ kind: 'client', rows }), [rows]);
  const columns = useMemo<LLColumnDef<PeriodOverviewRow>[]>(
    () => [
      {
        field: 'portfolio',
        header: 'Portfolio',
        type: 'entity',
        width: 280,
        pinned: 'left',
        value: (r) => r.portfolio,
      },
      {
        field: 'cutoff',
        header: 'Cutoff',
        type: 'text',
        width: 210,
        value: (r) => cutoffCountdown(r.cutoff, me.businessDate),
      },
      {
        field: 'checks',
        header: 'Checks passed',
        type: 'text',
        width: 130,
        value: (r) => `${r.checksPassed} of ${r.checksTotal}`,
      },
      // What blocks close, as a count and in words: never colour alone.
      {
        field: 'blocking',
        header: 'Blocking',
        type: 'text',
        width: 150,
        value: (r) => (r.blocking ? `${n(r.blocking)} high severity` : 'Nothing blocking'),
      },
      {
        field: 'openExceptions',
        header: 'Open exceptions',
        type: 'text',
        width: 130,
        value: (r) => n(r.openExceptions),
      },
      ...CLOSE_TYPES.map(({ type, label }): LLColumnDef<PeriodOverviewRow> => ({
        field: `close-${type}`,
        header: label,
        type: 'status',
        width: 126,
        value: (r) => r.closes[type],
        statuses: STATE,
      })),
      {
        field: 'override',
        header: 'Block override',
        type: 'text',
        width: 170,
        value: (r) =>
          r.overrideStatus === 'pending'
            ? 'Waiting for approval'
            : r.overrideStatus === 'approved'
              ? 'Approved'
              : r.overrideStatus === 'rejected'
                ? 'Rejected'
                : '',
      },
      {
        field: 'signOff',
        header: 'Sign-off',
        type: 'text',
        width: 200,
        value: (r) =>
          r.signOff ? `${r.signOff.signedBy.name} · ${formatTimestamp(r.signOff.at)}` : 'Not signed off',
      },
    ],
    [me.businessDate],
  );
  const actions = useMemo<ActionDef<PeriodOverviewRow>[]>(
    () => [
      {
        id: 'period.close',
        label: 'Close',
        description:
          'Closes the selected portfolios for the period, as one job with a result for each portfolio.',
        tier: 'primary',
        appliesTo: 'multi',
        consequence: 'reversibleWithAudit',
        available: permitted('period.close'),
        eligibility: (row) =>
          row.state === 'closed'
            ? {
                action: 'period.close',
                accessLevel: 'none',
                allowed: false,
                reason: 'recordState',
                explanation: 'Already closed.',
              }
            : row.blocking > 0 && row.overrideStatus !== 'approved'
              ? {
                  action: 'period.close',
                  accessLevel: 'none',
                  allowed: false,
                  reason: 'recordState',
                  explanation:
                    'Blocked by open high-severity exceptions. Open the portfolio to see them, or ask for a block override.',
                }
              : { action: 'period.close', accessLevel: 'full', allowed: true },
        agentRequiresConfirmation: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async (ids) => {
          const job = await closePeriods(ids, periodEnd ?? '');
          noteJob(job);
          return { jobId: job.id, status: 'queued', succeeded: [], failed: [], skipped: [] };
        },
      },
    ],
    [periodEnd],
  );
  const features = useMemo(() => gridFeatures(user.segment), [user.segment]);
  const blockedCount = all.filter((r) => r.blocking > 0).length;
  const closedCount = all.filter((r) => r.state === 'closed').length;

  if (overview.isPending) return <LoadingPanel label="Loading the close overview…" />;
  if (overview.error)
    return (
      <ErrorPanel
        messages={problemOf(overview.error)?.messages ?? []}
        onRetry={() => void overview.refetch()}
      />
    );
  const open = all.find((r) => r.portfolio.id === openId);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <p role="status" data-slot="close-summary">
            <span className="font-semibold">{periodEnd ? formatPeriod(periodEnd) : 'No open period'}.</span>{' '}
            {n(all.length)} {all.length === 1 ? 'portfolio' : 'portfolios'}: {n(closedCount)} closed,{' '}
            {n(blockedCount)} blocked.
          </p>
          <div role="group" aria-label="Which portfolios" className="ml-auto flex gap-1">
            <Button
              variant={scope === 'mine' ? 'secondary' : 'ghost'}
              aria-pressed={scope === 'mine'}
              onClick={() => setScope('mine')}
            >
              My portfolios
            </Button>
            <Button
              variant={scope === 'all' ? 'secondary' : 'ghost'}
              aria-pressed={scope === 'all'}
              onClick={() => setScope('all')}
            >
              All portfolios
            </Button>
            <Button
              variant={blockedOnly ? 'secondary' : 'ghost'}
              aria-pressed={blockedOnly}
              onClick={() => setBlockedOnly((v) => !v)}
            >
              Blocked only ({n(blockedCount)})
            </Button>
          </div>
        </div>
        <LLGrid
          ref={grid}
          gridId="close-overview"
          label="Period close"
          columns={columns}
          dataSource={dataSource}
          rowId={(r) => r.portfolio.id}
          features={features}
          actions={actions}
          jobs={GRID_JOBS}
          permissions={permissions.data ?? []}
          noun={NOUN}
          onAction={refresh}
          onRefresh={refresh}
          onRowOpen={(r) => setOpenId(r.portfolio.id)}
        />
      </div>
      {open ? (
        <ClosePanel
          key={open.periodId}
          row={open}
          user={user}
          businessDate={me.businessDate}
          permissions={permissions.data ?? []}
          onChanged={refresh}
          onOpenExceptions={() => onOpenExceptions(open.portfolio.id, open.periodEnd)}
          onClose={() => {
            const id = open.portfolio.id;
            setOpenId(null);
            setTimeout(() => grid.current?.focusRow(id), 0);
          }}
        />
      ) : null}
    </div>
  );
}

type Ask = 'override' | 'reopen' | 'signoff';

function ClosePanel({
  row,
  user,
  businessDate,
  permissions,
  onChanged,
  onOpenExceptions,
  onClose,
}: {
  row: PeriodOverviewRow;
  user: User;
  businessDate: string;
  permissions: Permission[];
  onChanged: () => void;
  onOpenExceptions: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const list = useQuery({
    queryKey: ['checklist', user.id, row.periodId],
    queryFn: () => fetchChecklist(row.periodId),
  });
  const [ask, setAsk] = useState<Ask | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [failure, setFailure] = useState<Message[] | null>(null);
  const [pack, setPack] = useState<Job | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const can = (action: string) => permissions.find((p) => p.action === action);
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['checklist', user.id, row.periodId] });
    onChanged();
  };
  /** Follows a job this panel started, then shows what happened. */
  const follow = (job: Job, label: string, done: (finished: Job) => void) => {
    noteJob(job);
    setRunning(label);
    setFailure(null);
    stop.current?.();
    stop.current = watchJob(job.id, (update) => {
      if (update.status === 'queued' || update.status === 'running') return;
      setRunning(null);
      void fetchJob(job.id).then(done);
      reload();
    });
  };
  const fail = (error: unknown) => {
    const messages = problemOf(error)?.messages ?? [];
    setFailure(messages);
    for (const m of messages) notify({ ...m, target: row.periodId }, 'Period close');
  };

  if (list.isPending) {
    return (
      <SidePanel label="Close detail" title={row.portfolio.label} onClose={onClose} wide>
        <LoadingPanel label="Loading the checklist…" />
      </SidePanel>
    );
  }
  if (list.error) {
    return (
      <SidePanel label="Close detail" title={row.portfolio.label} onClose={onClose} wide>
        <ErrorPanel messages={problemOf(list.error)?.messages ?? []} onRetry={() => void list.refetch()} />
      </SidePanel>
    );
  }
  const data: CloseChecklist = list.data;
  const { period, blocking, override, reopen, signOff } = data;
  const closed = period.state === 'closed';
  const anyClosed = Object.values(period.closes).some((s) => s === 'closed');
  const blocked = blocking.length > 0 && override?.status !== 'approved';
  // Each action that is not available says why (rule 8).
  const closeWhy = !can('period.close')?.allowed
    ? (can('period.close')?.explanation ?? 'Your role cannot close periods.')
    : closed
      ? 'Every close type is already closed.'
      : blocked
        ? `Blocked by ${n(blocking.length)} high-severity ${blocking.length === 1 ? 'exception' : 'exceptions'}, listed above.`
        : null;
  const overrideWhy = !can('period.overrideBlock')?.allowed
    ? (can('period.overrideBlock')?.explanation ?? 'Your role cannot override a close block.')
    : null;
  const reopenWhy = !can('period.reopen')?.allowed
    ? (can('period.reopen')?.explanation ?? 'Your role cannot reopen periods.')
    : reopen
      ? 'A reopen is already waiting for approval.'
      : null;
  const signWhy = !can('period.signoff')?.allowed
    ? (can('period.signoff')?.explanation ?? 'Your role cannot sign off a close.')
    : !closed
      ? 'Sign-off comes after every close type is closed.'
      : null;

  return (
    <SidePanel label="Close detail" title={row.portfolio.label} onClose={onClose} wide>
      <Tabs defaultValue="checklist" className="flex-1">
        <TabsList aria-label="Close sections">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist" className="flex flex-col gap-4 overflow-y-auto p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Period</dt>
            <dd>
              {formatPeriod(period.periodEnd)}{' '}
              <Badge status={STATE[period.state].tone}>{STATE[period.state].label}</Badge>
            </dd>
            <dt className="text-muted-foreground">Cutoff</dt>
            <dd>{cutoffCountdown(period.cutoff, businessDate)}</dd>
            {CLOSE_TYPES.map(({ type, label }) => (
              <div key={type} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{STATE[period.closes[type]].label}</dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Sign-off</dt>
            <dd data-slot="sign-off">
              {signOff
                ? `${signOff.signedBy.name}, ${formatTimestamp(signOff.at)}${signOff.note ? `: ${signOff.note}` : ''}`
                : 'Not signed off'}
            </dd>
          </dl>

          {failure ? (
            <SectionBanner
              state={{ kind: 'blockingError', messages: failure }}
              dismissCritical
              onDismiss={() => setFailure(null)}
            />
          ) : null}
          {running ? (
            <p role="status" className="rounded-md border border-info/40 bg-info/10 px-3 py-2">
              {running}
            </p>
          ) : null}
          {reopen ? <SectionBanner state={{ kind: 'pendingApproval', since: reopen.requestedAt }} /> : null}
          {override?.status === 'pending' ? (
            <SectionBanner state={{ kind: 'pendingApproval', since: override.requestedAt }} />
          ) : null}
          {override?.status === 'approved' && blocking.length ? (
            <p
              data-slot="override-approved"
              className="rounded-md border border-info/40 bg-info/10 px-3 py-2"
            >
              <span className="font-semibold">Block override approved by {override.checker?.name}.</span> This
              portfolio can close with the exceptions below still open. Reason given: {override.reason}
            </p>
          ) : null}
          {override?.status === 'rejected' ? (
            <p
              data-slot="override-rejected"
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2"
            >
              <span className="font-semibold">Block override rejected by {override.checker?.name}.</span>{' '}
              {override.note}
            </p>
          ) : null}

          {blocking.length ? (
            <section
              aria-label="Blocking exceptions"
              data-slot="blocking"
              className="rounded-md border border-critical/40 bg-critical/5 px-3 py-2"
            >
              <h3 className="font-semibold">
                {override?.status === 'approved'
                  ? 'Open high-severity exceptions'
                  : `Close is blocked by ${n(blocking.length)} high-severity ${blocking.length === 1 ? 'exception' : 'exceptions'}`}
              </h3>
              <ul className="mt-1 flex flex-col gap-0.5">
                {blocking.map((b) => (
                  <li key={b.id}>
                    <span className="font-mono">{b.id}</span> {b.label}{' '}
                    <span className="text-muted-foreground">
                      · {b.owner ? `owner ${b.owner.name}` : 'unassigned'}
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="mt-2" onClick={onOpenExceptions}>
                Open these in the exception queue
              </Button>
            </section>
          ) : null}

          <table aria-label="Close checklist" className="w-full text-body">
            <thead className="bg-muted text-left text-xs">
              <tr>
                <th scope="col" className="px-2 py-1 font-medium">
                  Check
                </th>
                <th scope="col" className="px-2 py-1 font-medium">
                  Result
                </th>
                <th scope="col" className="px-2 py-1 text-right font-medium">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {data.checks.map((check) => (
                <tr key={check.id} className="border-t align-top">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    {check.label}
                    <span className="block text-xs text-muted-foreground">{check.catches}</span>
                  </th>
                  <td className="px-2 py-1">
                    <Badge status={CHECK[check.status].tone}>{CHECK[check.status].label}</Badge>
                  </td>
                  <td className="tabular px-2 py-1 text-right font-mono">
                    {check.open ? `${n(check.open)}${check.high ? ` (${n(check.high)} high)` : ''}` : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <section aria-label="Close actions" className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={Boolean(closeWhy) || Boolean(running)}
                onClick={() =>
                  void closePeriods([row.portfolio.id], period.periodEnd)
                    .then((job) =>
                      follow(job, `Closing ${row.portfolio.label}…`, (finished) => {
                        const failed = finished.result?.failed[0];
                        if (failed) setFailure([failed.message]);
                        else toast('Closed', `${row.portfolio.label} · ${formatPeriod(period.periodEnd)}`);
                      }),
                    )
                    .catch(fail)
                }
              >
                Close this portfolio
              </Button>
              {blocking.length && override?.status !== 'approved' && override?.status !== 'pending' ? (
                <Button
                  variant="secondary"
                  disabled={Boolean(overrideWhy)}
                  onClick={() => setAsk('override')}
                >
                  Request block override…
                </Button>
              ) : null}
              <Button
                variant="secondary"
                disabled={Boolean(signWhy) || Boolean(signOff)}
                onClick={() => setAsk('signoff')}
              >
                {signOff ? 'Signed off' : 'Sign off…'}
              </Button>
              {signOff ? (
                <Button
                  variant="secondary"
                  disabled={Boolean(running)}
                  onClick={() =>
                    void createClosePackage(row.periodId)
                      .then((job) => follow(job, 'Producing the close package…', setPack))
                      .catch(fail)
                  }
                >
                  Create close package
                </Button>
              ) : null}
              {anyClosed ? (
                <Button variant="ghost" disabled={Boolean(reopenWhy)} onClick={() => setAsk('reopen')}>
                  Reopen…
                </Button>
              ) : null}
            </div>
            <ul className="text-xs text-muted-foreground" data-slot="close-reasons">
              {closeWhy ? <li>Close: {closeWhy}</li> : null}
              {blocking.length && overrideWhy && override?.status !== 'approved' ? (
                <li>Block override: {overrideWhy}</li>
              ) : null}
              {signWhy && !signOff ? <li>Sign-off: {signWhy}</li> : null}
              {anyClosed && reopenWhy ? <li>Reopen: {reopenWhy}</li> : null}
            </ul>
            {pack?.outputs?.length ? (
              <div data-slot="close-package" className="rounded-md border px-3 py-2">
                <p className="font-semibold">Close package ready ({pack.id})</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {pack.outputs.map((output) => (
                    <Button
                      key={output.url}
                      variant="secondary"
                      onClick={() =>
                        void download(output.url.replace(/^\/api\/v1/, ''), output.name).catch(fail)
                      }
                    >
                      Download {output.format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </TabsContent>
        <TabsContent value="books" className="flex flex-col overflow-hidden p-4">
          <Books portfolioId={row.portfolio.id} userId={user.id} />
        </TabsContent>
        <TabsContent value="history" className="overflow-y-auto">
          <RecordHistory recordType="period" recordId={row.periodId} userId={user.id} noun="period" />
        </TabsContent>
      </Tabs>

      {ask === 'override' ? (
        <ReasonDialog
          title={`Request a block override for ${row.portfolio.label}`}
          label="Reason"
          confirmLabel="Send for approval"
          description={
            <p>
              {n(blocking.length)} high-severity {blocking.length === 1 ? 'exception is' : 'exceptions are'}{' '}
              open. An override lets this portfolio close anyway. It needs a second approver: you cannot
              approve your own request. The reason and the approval are recorded in the audit history.
            </p>
          }
          onClose={() => setAsk(null)}
          onSubmit={async (reason) => {
            await requestBlockOverride(row.periodId, reason);
            toast('Sent for approval', 'Block override');
            reload();
          }}
        />
      ) : null}
      {ask === 'reopen' ? (
        <ReasonDialog
          title={`Reopen ${formatPeriod(period.periodEnd)} for ${row.portfolio.label}`}
          label="Reason"
          confirmLabel="Send for approval"
          description={
            <p>
              Reopening lets transactions be entered in a closed period again. It needs a second approver, and
              the sign-off is withdrawn once it is approved.
            </p>
          }
          onClose={() => setAsk(null)}
          onSubmit={async (reason) => {
            await requestReopen(row.periodId, reason);
            toast('Sent for approval', 'Reopen');
            reload();
          }}
        />
      ) : null}
      {ask === 'signoff' ? (
        <ReasonDialog
          title={`Sign off ${formatPeriod(period.periodEnd)} for ${row.portfolio.label}`}
          label="Sign-off note"
          required={false}
          confirmLabel="Sign off"
          description={
            <p>
              Your name and the time are recorded with the close. After sign-off you can produce the close
              package.
            </p>
          }
          onClose={() => setAsk(null)}
          onSubmit={async (note) => {
            await signOffPeriod(row.periodId, note);
            toast('Signed off', row.portfolio.label);
            reload();
          }}
        />
      ) : null}
    </SidePanel>
  );
}

/** Investment book against accounting book for the portfolio (SPEC 7.9). */
function Books({ portfolioId, userId }: { portfolioId: string; userId: string }) {
  const books = useQuery({
    queryKey: ['books', userId, portfolioId],
    queryFn: () => fetchBooksComparison(portfolioId),
  });
  if (books.isPending) return <LoadingPanel label="Comparing the books…" />;
  if (books.error)
    return (
      <ErrorPanel messages={problemOf(books.error)?.messages ?? []} onRetry={() => void books.refetch()} />
    );
  return <ComparisonTable comparison={books.data} className="flex-1" />;
}
