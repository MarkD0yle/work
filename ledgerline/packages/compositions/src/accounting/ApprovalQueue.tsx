import type {
  ActionContext,
  ActionDef,
  ApprovalRequest,
  BulkResult,
  FilterCondition,
  Permission,
  User,
} from '@ledgerline/contracts';
import {
  auditChanges,
  Badge,
  BulkResultPanel,
  bulkResultCsv,
  Button,
  formatTimestamp,
  SectionBanner,
  TaskChips,
  toast,
  type TaskChip,
} from '@ledgerline/ui';
import {
  gridFeatures,
  LLGrid,
  type LLColumnDef,
  type LLDataSource,
  type LLGridHandle,
} from '@ledgerline/ui/grid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { ReasonDialog } from '../common/ReasonDialog';
import { SidePanel } from '../common/SidePanel';
import {
  decideApproval,
  decideApprovals,
  fetchPermissions,
  queryApprovals,
  saveText,
  type Me,
} from '../services';

const ACTION_LABEL: Record<string, string> = {
  'period.reopen': 'Reopen a period',
  'period.overrideBlock': 'Override a close block',
  'price.override': 'Override a price',
};
const STATUS = {
  pending: { label: 'Waiting', tone: 'warning' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'critical' },
} as const;
const NOUN = { one: 'request', many: 'requests' };
const actionLabel = (id: string) => ACTION_LABEL[id] ?? id;
const recordOf = (a: ApprovalRequest) => a.recordRefs.map((r) => r.id).join(', ');
const SOD =
  'You made this request, so you cannot decide it. Approvals need a second person (segregation of duties).';
const opened = (): Promise<BulkResult> =>
  Promise.resolve({ jobId: 'local', status: 'completed', succeeded: [], failed: [], skipped: [] });

type Decision = 'approve' | 'reject';

/**
 * The Approval Queue (SPEC 8.5): maker-checker for reopens and close-block overrides. The approver sees what
 * will change, the maker's reason and how long it has waited. The maker can never decide their own request,
 * and a rejection goes back to them with the note.
 */
export function ApprovalQueue({ me }: { me: Me }) {
  const { user } = me;
  const grid = useRef<LLGridHandle>(null);
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterCondition[]>([
    { field: 'status', op: 'eq', value: 'pending' },
  ]);
  const [open, setOpen] = useState<ApprovalRequest | null>(null);
  const [deciding, setDeciding] = useState<{
    decision: Decision;
    ids: string[];
    single?: ApprovalRequest;
  } | null>(null);
  const [lastRun, setLastRun] = useState<{ label: string; result: BulkResult } | null>(null);
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });
  const approver = permissions.data?.find((p) => p.action === 'approval.decide');

  const dataSource = useMemo<LLDataSource<ApprovalRequest>>(
    () => ({ kind: 'server', query: queryApprovals }),
    [],
  );
  const columns = useMemo<LLColumnDef<ApprovalRequest>[]>(
    () => [
      {
        field: 'id',
        header: 'Request',
        type: 'text',
        mono: true,
        width: 112,
        pinned: 'left',
        value: (a) => a.id,
      },
      {
        field: 'status',
        header: 'Status',
        type: 'status',
        width: 110,
        value: (a) => a.status,
        statuses: STATUS,
      },
      {
        field: 'actionId',
        header: 'Asks to',
        type: 'text',
        width: 200,
        value: (a) => actionLabel(a.actionId),
      },
      { field: 'record', header: 'On', type: 'text', mono: true, width: 170, value: recordOf },
      { field: 'maker', header: 'Asked by', type: 'text', width: 120, value: (a) => a.maker.name },
      {
        field: 'requestedAt',
        header: 'Asked',
        type: 'text',
        width: 180,
        value: (a) => formatTimestamp(a.requestedAt),
      },
      {
        field: 'reason',
        header: 'Reason',
        type: 'text',
        width: 360,
        sortable: false,
        value: (a) => a.reason,
      },
      {
        field: 'checker',
        header: 'Decided by',
        type: 'text',
        width: 120,
        sortable: false,
        value: (a) => a.checker?.name ?? '',
      },
      {
        field: 'note',
        header: 'Decision note',
        type: 'text',
        width: 300,
        sortable: false,
        value: (a) => a.note ?? '',
      },
    ],
    [],
  );
  const chips = useMemo<TaskChip[]>(
    () => [
      { id: 'pending', label: 'Waiting', filter: { field: 'status', op: 'eq', value: 'pending' } },
      { id: 'mine', label: 'Asked by me', filter: { field: 'makerId', op: 'eq', value: user.id } },
      { id: 'rejected', label: 'Rejected', filter: { field: 'status', op: 'eq', value: 'rejected' } },
    ],
    [user.id],
  );
  const actions = useMemo<ActionDef<ApprovalRequest>[]>(() => {
    const make = (decision: Decision, label: string): ActionDef<ApprovalRequest> => ({
      id: `approval.${decision}`,
      label,
      description:
        decision === 'approve'
          ? 'Approves the selected requests. Each takes effect at once.'
          : 'Rejects the selected requests and returns them to their makers with your note.',
      tier: decision === 'approve' ? 'primary' : 'secondary',
      appliesTo: 'multi',
      // Opens a form for the note. The form is the confirm step.
      consequence: 'none',
      available: (ctx: ActionContext<ApprovalRequest>): Permission =>
        ctx.permissions.find((p) => p.action === 'approval.decide') ?? {
          action: 'approval.decide',
          accessLevel: 'none',
          allowed: false,
          reason: 'role',
          explanation: 'Your role cannot decide approvals.',
        },
      eligibility: (row) =>
        row.status !== 'pending'
          ? {
              action: 'approval.decide',
              accessLevel: 'none',
              allowed: false,
              reason: 'recordState',
              explanation: `Already ${row.status}.`,
            }
          : row.maker.id === user.id
            ? {
                action: 'approval.decide',
                accessLevel: 'none',
                allowed: false,
                reason: 'segregationOfDuties',
                explanation: SOD,
              }
            : { action: 'approval.decide', accessLevel: 'full', allowed: true },
      agentRequiresConfirmation: true,
      inputSchema: { type: 'object', properties: { note: { type: 'string' } }, additionalProperties: false },
      execute: (ids) => {
        setDeciding({ decision, ids });
        return opened();
      },
    });
    return [make('approve', 'Approve'), make('reject', 'Reject')];
  }, [user.id]);
  const features = useMemo(() => gridFeatures(user.segment), [user.segment]);
  const refresh = () => {
    grid.current?.refresh();
    void queryClient.invalidateQueries({ queryKey: ['close-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['checklist'] });
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <TaskChips chips={chips} filters={filters} onChange={setFilters} />
        {approver && !approver.allowed ? (
          <p className="shrink-0 rounded-md border bg-muted px-3 py-2">
            <span className="font-semibold">You see the requests you made.</span>{' '}
            {approver.explanation ?? 'Your role cannot decide approvals.'}
          </p>
        ) : null}
        {lastRun ? (
          <BulkResultPanel
            className="shrink-0"
            label={lastRun.label}
            noun={NOUN}
            result={lastRun.result}
            onExport={() => saveText(`${lastRun.result.jobId}-results.csv`, bulkResultCsv(lastRun.result))}
            onDismiss={() => setLastRun(null)}
          />
        ) : null}
        <LLGrid
          ref={grid}
          gridId="approvals"
          label="Approvals"
          columns={columns}
          dataSource={dataSource}
          rowId={(a) => a.id}
          features={features}
          filters={filters}
          onFiltersChange={setFilters}
          filterLabels={{ makerId: 'Asked by' }}
          actions={actions}
          permissions={permissions.data ?? []}
          noun={NOUN}
          onRowOpen={setOpen}
        />
      </div>
      {open ? (
        <ApprovalPanel
          request={open}
          user={user}
          canDecide={Boolean(approver?.allowed)}
          onDecide={(decision) => setDeciding({ decision, ids: [open.id], single: open })}
          onClose={() => {
            const id = open.id;
            setOpen(null);
            setTimeout(() => grid.current?.focusRow(id), 0);
          }}
        />
      ) : null}
      {deciding ? (
        <ReasonDialog
          title={`${deciding.decision === 'approve' ? 'Approve' : 'Reject'} ${deciding.ids.length === 1 ? (deciding.single?.id ?? deciding.ids[0]) : `${deciding.ids.length} requests`}`}
          label="Note"
          required={deciding.decision === 'reject'}
          confirmLabel={deciding.decision === 'approve' ? 'Approve' : 'Reject'}
          description={
            <p>
              {deciding.decision === 'approve'
                ? 'Approving takes effect at once and is recorded with your name.'
                : 'The request goes back to the person who made it, with your note, so they know what to change.'}
            </p>
          }
          onClose={() => setDeciding(null)}
          onSubmit={async (note) => {
            const label = deciding.decision === 'approve' ? 'Approve' : 'Reject';
            if (deciding.single) {
              // One request: a refusal (for example segregation of duties) stays in this dialog.
              setOpen(await decideApproval(deciding.single.id, deciding.decision, note));
              toast(`${label}: done`, deciding.single.id);
            } else {
              const result = await decideApprovals(deciding.ids, deciding.decision, note);
              if (result.failed.length + result.skipped.length) setLastRun({ label, result });
              else
                toast(
                  `${label}: done`,
                  `${result.succeeded.length} ${result.succeeded.length === 1 ? 'request' : 'requests'}`,
                );
            }
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ApprovalPanel({
  request,
  user,
  canDecide,
  onDecide,
  onClose,
}: {
  request: ApprovalRequest;
  user: User;
  canDecide: boolean;
  onDecide: (decision: Decision) => void;
  onClose: () => void;
}) {
  const mine = request.maker.id === user.id;
  const pending = request.status === 'pending';
  const changes = auditChanges({
    id: request.id,
    action: request.actionId,
    recordRef: { type: 'approval', id: request.id },
    actor: request.maker,
    at: request.requestedAt,
    immutable: true,
    ...(request.before ? { before: request.before } : {}),
    ...(request.after ? { after: request.after } : {}),
  });
  // Why the decision buttons are not available, when they are not (rule 8).
  const why = !pending
    ? `This request was ${request.status}${request.checker ? ` by ${request.checker.name}` : ''}.`
    : mine
      ? SOD
      : !canDecide
        ? 'Your role cannot decide approvals.'
        : null;
  return (
    <SidePanel
      label="Approval detail"
      title={`${actionLabel(request.actionId)} · ${request.id}`}
      onClose={onClose}
      wide
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {pending ? <SectionBanner state={{ kind: 'pendingApproval', since: request.requestedAt }} /> : null}
        {request.status === 'rejected' ? (
          <p data-slot="rejection" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
            <span className="font-semibold">Rejected by {request.checker?.name}.</span> {request.note}
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge status={STATUS[request.status].tone}>{STATUS[request.status].label}</Badge>
          </dd>
          <dt className="text-muted-foreground">On</dt>
          <dd className="font-mono">{recordOf(request)}</dd>
          <dt className="text-muted-foreground">Asked by</dt>
          <dd>
            {request.maker.name}, {formatTimestamp(request.requestedAt)}
          </dd>
          <dt className="text-muted-foreground">Reason</dt>
          <dd>{request.reason}</dd>
          {request.checker ? (
            <>
              <dt className="text-muted-foreground">Decided by</dt>
              <dd>
                {request.checker.name}
                {request.decidedAt ? `, ${formatTimestamp(request.decidedAt)}` : ''}
                {request.note ? `: ${request.note}` : ''}
              </dd>
            </>
          ) : null}
        </dl>
        <section aria-label="What will change">
          <h3 className="mb-1 font-semibold">What {pending ? 'will change' : 'was asked for'}</h3>
          {changes.length ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              {changes.map((c) => (
                <div key={c.field} className="contents">
                  <dt className="text-muted-foreground">{c.field}</dt>
                  <dd className="font-mono break-words">
                    {c.before === undefined ? null : (
                      <>
                        <span className="text-muted-foreground line-through">{c.before}</span>
                        <span className="sr-only"> changed to </span>
                        <span aria-hidden> → </span>
                      </>
                    )}
                    {c.after}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground">
              No values change. The request allows an action to go ahead.
            </p>
          )}
          {request.evidence?.length ? (
            <p className="mt-1 text-xs">Evidence: {request.evidence.map((e) => e.label).join(', ')}</p>
          ) : null}
        </section>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={Boolean(why)} onClick={() => onDecide('approve')}>
            Approve
          </Button>
          <Button variant="secondary" disabled={Boolean(why)} onClick={() => onDecide('reject')}>
            Reject…
          </Button>
        </div>
        {why ? (
          <p data-slot="decide-reason" className="text-muted-foreground">
            {why}
          </p>
        ) : null}
      </div>
    </SidePanel>
  );
}
