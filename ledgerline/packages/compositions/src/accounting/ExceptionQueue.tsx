import type {
  ActionContext,
  ActionDef,
  BulkResult,
  ExceptionRecord,
  ExceptionType,
  FilterCondition,
  Message,
  Permission,
  RecurringBreakRule,
  User,
} from '@ledgerline/contracts';
import {
  Badge,
  BulkResultPanel,
  bulkResultCsv,
  Button,
  ComparisonTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  formatIsoDate,
  formatPercent,
  formatTimestamp,
  fractionToPercent,
  Input,
  Label,
  SectionBanner,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TaskChips,
  Textarea,
  toast,
  useNotifications,
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
import { useId, useMemo, useRef, useState } from 'react';
import { ReasonDialog } from '../common/ReasonDialog';
import { SidePanel } from '../common/SidePanel';
import {
  addExceptionComment,
  applyBreakRule,
  createBreakRule,
  deleteBreakRule,
  exceptionBulk,
  fetchBreakRules,
  fetchException,
  fetchPermissions,
  fetchRootCauses,
  fetchUsers,
  problemOf,
  queryExceptions,
  saveText,
  type ExceptionInputs,
  type Me,
} from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { RecordHistory } from '../transactions/RecordHistory';

export const EXCEPTION_TYPES: Record<ExceptionType, string> = {
  priceStale: 'Stale price',
  priceVariance: 'Price variance',
  priceMissing: 'Missing price',
  cashBreak: 'Cash break',
  positionBreak: 'Position break',
  marketValueBreak: 'Market value break',
  unsettledTrade: 'Unsettled trade',
  agedIncome: 'Aged income',
  accrualBreak: 'Accrual break',
  ratingMissing: 'Missing rating',
  impairmentReview: 'Impairment review',
  glMappingBreak: 'GL mapping break',
  importRowError: 'Import row error',
};
const STATUS: Record<
  ExceptionRecord['status'],
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'good' }
> = {
  new: { label: 'New', tone: 'info' },
  inProgress: { label: 'In progress', tone: 'neutral' },
  waitingOnOthers: { label: 'Waiting on others', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'good' },
  acceptedConditionally: { label: 'Accepted conditionally', tone: 'good' },
  overridden: { label: 'Overridden', tone: 'good' },
};
const SEVERITY = {
  high: { label: 'High', tone: 'critical' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
} as const;
const OPEN = ['new', 'inProgress', 'waitingOnOthers'];
const NOUN = { one: 'exception', many: 'exceptions' };
const PRICE_TYPES: ExceptionType[] = ['priceStale', 'priceVariance', 'priceMissing'];

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`)) / 86_400_000,
  );
const percent = (fraction: string) => formatPercent(fraction);
/** The failed rule in words: which rule, its threshold, and what was observed (SPEC 8.4). */
export function describeFailedRule(rule: NonNullable<ExceptionRecord['failedRule']>): string {
  if (rule.check === 'dayOverDay')
    return `${rule.ruleId}: move over ${percent(rule.threshold)} in a day. Actual move ${rule.actual ? percent(rule.actual) : 'unknown'}.`;
  if (rule.check === 'stale')
    return `${rule.ruleId}: unchanged for ${rule.threshold} market ${rule.threshold === '1' ? 'day' : 'days'} or more. Unchanged since the prior close.`;
  if (rule.check === 'missing')
    return `${rule.ruleId}: a price is required every market day. None was received.`;
  return `${rule.ruleId}: vendors differ by more than ${percent(rule.threshold)}.`;
}

/** The exception actions. Each opens a short form for what the action needs; nothing changes until that form is confirmed. */
type ActionId =
  | 'exception.assign'
  | 'exception.resolve'
  | 'exception.accept'
  | 'exception.acceptConditionally'
  | 'exception.override'
  | 'exception.escalate'
  | 'exception.attachEvidence'
  | 'exception.acceptProposal';
const ACTIONS: {
  id: ActionId;
  label: string;
  description: string;
  permission: string;
  tier: ActionDef['tier'];
  verb: string;
}[] = [
  {
    id: 'exception.assign',
    label: 'Assign',
    description: 'Gives the selected exceptions an owner.',
    permission: 'exception.assign',
    tier: 'primary',
    verb: 'Assign',
  },
  {
    id: 'exception.resolve',
    label: 'Resolve',
    description: 'Closes the selected exceptions with a root cause and a note.',
    permission: 'exception.resolve',
    tier: 'primary',
    verb: 'Resolve',
  },
  {
    id: 'exception.attachEvidence',
    label: 'Attach evidence',
    description: 'Attaches one file, such as a custodian statement, to every selected exception.',
    permission: 'exception.resolve',
    tier: 'secondary',
    verb: 'Attach to',
  },
  {
    id: 'exception.acceptProposal',
    label: 'Accept proposal',
    description:
      'Resolves the selected exceptions the way a recurring-break rule proposed. Exceptions with no proposal are skipped.',
    permission: 'exception.resolve',
    tier: 'secondary',
    verb: 'Accept the proposal for',
  },
  {
    id: 'exception.accept',
    label: 'Accept',
    description: 'Accepts the difference as it is, with a note.',
    permission: 'exception.resolve',
    tier: 'overflow',
    verb: 'Accept',
  },
  {
    id: 'exception.acceptConditionally',
    label: 'Accept conditionally',
    description: 'Accepts for now, linked to a challenge raised with a vendor or custodian.',
    permission: 'exception.resolve',
    tier: 'overflow',
    verb: 'Accept conditionally',
  },
  {
    id: 'exception.override',
    label: 'Override',
    description: 'Closes the exception against the check, with a reason.',
    permission: 'exception.resolve',
    tier: 'overflow',
    verb: 'Override',
  },
  {
    id: 'exception.escalate',
    label: 'Escalate',
    description: 'Raises the severity and marks the exception as waiting on others.',
    permission: 'exception.assign',
    tier: 'overflow',
    verb: 'Escalate',
  },
];
const opened = (): Promise<BulkResult> =>
  Promise.resolve({ jobId: 'local', status: 'completed', succeeded: [], failed: [], skipped: [] });
const permitted =
  (action: string) =>
  (ctx: ActionContext<ExceptionRecord>): Permission =>
    ctx.permissions.find((p) => p.action === action) ?? {
      action,
      accessLevel: 'none',
      allowed: false,
      reason: 'role',
      explanation: 'Your role does not include this action.',
    };
const openOnly = (row: ExceptionRecord): Permission =>
  OPEN.includes(row.status)
    ? { action: 'exception', accessLevel: 'full', allowed: true }
    : {
        action: 'exception',
        accessLevel: 'none',
        allowed: false,
        reason: 'recordState',
        explanation: `Already ${STATUS[row.status].label.toLowerCase()}.`,
      };

export const exceptionActions = (
  onAction: (id: ActionId, ids: string[]) => void,
): ActionDef<ExceptionRecord>[] =>
  ACTIONS.map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    tier: a.tier,
    appliesTo: 'multi',
    // These open a form. The form is the confirm step, and it states what will change.
    consequence: 'none',
    available: permitted(a.permission),
    eligibility:
      a.id === 'exception.acceptProposal'
        ? (row) =>
            row.proposal
              ? openOnly(row)
              : {
                  action: a.id,
                  accessLevel: 'none',
                  allowed: false,
                  reason: 'recordState',
                  explanation: 'No rule has proposed a resolution.',
                }
        : openOnly,
    agentRequiresConfirmation: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
    execute: (ids) => {
      onAction(a.id, ids);
      return opened();
    },
  }));

export interface ExceptionQueueProps {
  me: Me;
  /** Limits the queue to some exception types, e.g. the three price types in Price Review. */
  types?: ExceptionType[];
  /** Filters to start with, e.g. one portfolio's blocking exceptions from the close console. */
  initialFilters?: FilterCondition[];
  gridId?: string;
}

/**
 * The Exception Queue (SPEC 8.2): oldest first, with age and due date, an owner, a root cause and a thread on each.
 * Similar exceptions can be grouped and resolved together, one statement can be attached to many, and a recurring-break
 * rule can propose a resolution, which a person then accepts.
 */
export function ExceptionQueue({
  me,
  types,
  initialFilters = [],
  gridId = 'exceptions',
}: ExceptionQueueProps) {
  const { user } = me;
  const grid = useRef<LLGridHandle>(null);
  const [filters, setFilters] = useState<FilterCondition[]>(initialFilters);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: ActionId; ids: string[] } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [lastRun, setLastRun] = useState<{ label: string; result: BulkResult } | null>(null);
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });
  const queryClient = useQueryClient();

  const scope = useMemo<FilterCondition[]>(
    () => (types ? [{ field: 'type', op: 'in', value: types }] : []),
    [types],
  );
  const dataSource = useMemo<LLDataSource<ExceptionRecord>>(
    () => ({
      kind: 'server',
      query: (q) => queryExceptions({ ...q, filters: [...scope, ...(q.filters ?? [])] }),
    }),
    [scope],
  );
  const columns = useMemo<LLColumnDef<ExceptionRecord>[]>(() => {
    const priceOnly = types?.every((t) => PRICE_TYPES.includes(t));
    return [
      {
        field: 'id',
        header: 'Exception',
        type: 'text',
        mono: true,
        width: 112,
        pinned: 'left',
        value: (x) => x.id,
      },
      {
        field: 'severity',
        header: 'Severity',
        type: 'status',
        width: 104,
        value: (x) => x.severity,
        statuses: SEVERITY,
      },
      {
        field: 'type',
        header: 'Type',
        type: 'text',
        width: 160,
        groupable: true,
        value: (x) => EXCEPTION_TYPES[x.type],
      },
      {
        field: 'record',
        header: 'Record',
        type: 'text',
        width: 280,
        groupable: true,
        value: (x) => x.recordRef.label,
      },
      ...(priceOnly
        ? [
            {
              field: 'failedRule',
              header: 'Rule that failed',
              type: 'text' as const,
              width: 420,
              sortable: false,
              value: (x: ExceptionRecord) => (x.failedRule ? describeFailedRule(x.failedRule) : ''),
            },
          ]
        : []),
      {
        field: 'portfolio',
        header: 'Portfolio',
        type: 'text',
        width: 230,
        value: (x) => `${x.portfolioName ?? ''} ${x.portfolioId}`.trim(),
      },
      {
        field: 'status',
        header: 'Status',
        type: 'status',
        width: 160,
        groupable: true,
        value: (x) => x.status,
        statuses: STATUS,
      },
      {
        field: 'owner',
        header: 'Owner',
        type: 'text',
        width: 120,
        value: (x) => x.owner?.name ?? 'Unassigned',
      },
      // Age and due date: a queue is worked oldest first, and an overdue exception says so in words.
      {
        field: 'detectedAt',
        header: 'Days open',
        type: 'text',
        width: 100,
        value: (x) => String(Math.max(0, daysBetween(x.detectedAt, me.businessDate))),
      },
      {
        field: 'dueBy',
        header: 'Due',
        type: 'text',
        width: 170,
        value: (x) =>
          x.dueBy
            ? `${formatIsoDate(x.dueBy)}${OPEN.includes(x.status) && x.dueBy < me.businessDate ? ' · overdue' : ''}`
            : '',
      },
      {
        field: 'rootCauseCategory',
        header: 'Root cause',
        type: 'text',
        width: 150,
        groupable: true,
        value: (x) => x.rootCauseCategory ?? '',
      },
      {
        field: 'matchedRuleId',
        header: 'Proposal',
        type: 'text',
        width: 200,
        value: (x) =>
          x.proposal ? `Proposed: ${String(x.proposal.inputs?.rootCauseCategory ?? 'resolve')}` : '',
      },
      {
        field: 'evidence',
        header: 'Evidence',
        type: 'text',
        width: 96,
        sortable: false,
        value: (x) => (x.evidence.length ? `${x.evidence.length} attached` : ''),
      },
    ];
  }, [types, me.businessDate]);
  const chips = useMemo<TaskChip[]>(
    () => [
      { id: 'mine', label: 'Mine', filter: { field: 'ownerId', op: 'eq', value: user.id } },
      { id: 'high', label: 'High severity', filter: { field: 'severity', op: 'eq', value: 'high' } },
      { id: 'new', label: 'New', filter: { field: 'status', op: 'eq', value: 'new' } },
      { id: 'open', label: 'Open', filter: { field: 'status', op: 'in', value: OPEN } },
      { id: 'overdue', label: 'Overdue', filter: { field: 'dueBy', op: 'lt', value: me.businessDate } },
      { id: 'proposed', label: 'Proposed by a rule', filter: { field: 'matchedRuleId', op: 'isNotNull' } },
    ],
    [user.id, me.businessDate],
  );
  const actions = useMemo(() => exceptionActions((id, ids) => setPending({ id, ids })), []);
  const features = useMemo(() => gridFeatures(user.segment), [user.segment]);
  const refresh = () => {
    grid.current?.refresh();
    void queryClient.invalidateQueries({ queryKey: ['exception'] });
    void queryClient.invalidateQueries({ queryKey: ['audit'] });
  };
  const finish = (label: string, result: BulkResult) => {
    setPending(null);
    if (result.failed.length + result.skipped.length === 0) {
      setLastRun(null);
      toast(
        `${label}: done`,
        `${result.succeeded.length.toLocaleString('en-US')} ${result.succeeded.length === 1 ? 'exception' : 'exceptions'}`,
      );
    } else setLastRun({ label, result });
    refresh();
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <TaskChips chips={chips} filters={filters} onChange={setFilters} />
          <Button variant="secondary" className="ml-auto" onClick={() => setRulesOpen(true)}>
            Recurring-break rules
          </Button>
        </div>
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
          gridId={gridId}
          label="Exceptions"
          columns={columns}
          dataSource={dataSource}
          rowId={(x) => x.id}
          features={features}
          filters={filters}
          onFiltersChange={setFilters}
          filterLabels={{
            ownerId: 'Owner',
            matchedRuleId: 'Proposal',
            portfolioId: 'Portfolio',
            periodEnd: 'Period',
          }}
          actions={actions}
          permissions={permissions.data ?? []}
          noun={NOUN}
          onRowOpen={(x) => setOpenId(x.id)}
        />
      </div>
      {openId ? (
        <ExceptionPanel
          key={openId}
          id={openId}
          user={user}
          onAction={(id) => setPending({ id, ids: [openId] })}
          onChanged={refresh}
          onClose={() => {
            const id = openId;
            setOpenId(null);
            setTimeout(() => grid.current?.focusRow(id), 0);
          }}
        />
      ) : null}
      {pending ? (
        <ExceptionActionDialog
          action={pending.id}
          ids={pending.ids}
          onClose={() => setPending(null)}
          onDone={finish}
        />
      ) : null}
      {rulesOpen ? (
        <BreakRulesDialog
          onClose={() => setRulesOpen(false)}
          onApplied={refresh}
          canEdit={Boolean(permissions.data?.find((p) => p.action === 'exception.rules')?.allowed)}
        />
      ) : null}
    </div>
  );
}

// ── The form behind each action ────────────────────────────
function ExceptionActionDialog({
  action,
  ids,
  onClose,
  onDone,
}: {
  action: ActionId;
  ids: string[];
  onClose: () => void;
  onDone: (label: string, result: BulkResult) => void;
}) {
  const form = useId();
  const def = ACTIONS.find((a) => a.id === action) as (typeof ACTIONS)[number];
  const causes = useQuery({ queryKey: ['root-causes'], queryFn: fetchRootCauses, staleTime: Infinity });
  const users = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: Infinity,
    enabled: action === 'exception.assign',
  });
  const [inputs, setInputs] = useState<ExceptionInputs>({});
  const [failure, setFailure] = useState<Message[] | null>(null);
  const [busy, setBusy] = useState(false);
  const count = `${ids.length.toLocaleString('en-US')} ${ids.length === 1 ? 'exception' : 'exceptions'}`;
  const needsNote = [
    'exception.resolve',
    'exception.accept',
    'exception.acceptConditionally',
    'exception.override',
  ].includes(action);
  const set = (patch: ExceptionInputs) => setInputs((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent data-slot="exception-action">
        <DialogTitle>
          {def.verb} {count}
        </DialogTitle>
        <DialogDescription>
          {def.description} It is recorded in the audit history of each one.
        </DialogDescription>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setFailure(null);
            exceptionBulk(action, ids, inputs)
              .then((result) => onDone(def.label, result))
              .catch((error: unknown) => {
                // What is missing is said here, next to the fields, and stays until it is put right.
                setFailure(
                  problemOf(error)?.messages ?? [
                    {
                      code: 'LL-ACT-0500',
                      severity: 'error',
                      level: 'operation',
                      text: 'That could not be completed.',
                      fix: 'Nothing was changed. Try again.',
                    },
                  ],
                );
                setBusy(false);
              });
          }}
        >
          {failure ? <SectionBanner state={{ kind: 'blockingError', messages: failure }} /> : null}
          {action === 'exception.assign' ? (
            <div>
              <Label htmlFor={`${form}-owner`}>Assign to</Label>
              <Select
                id={`${form}-owner`}
                value={inputs.ownerId ?? ''}
                onChange={(e) => set({ ownerId: e.target.value })}
                autoFocus
              >
                <option value="">Choose a person</option>
                {(users.data ?? [])
                  .filter((u) => u.segment !== 'client')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.team})
                    </option>
                  ))}
              </Select>
            </div>
          ) : null}
          {action === 'exception.resolve' || action === 'exception.accept' ? (
            <div>
              <Label htmlFor={`${form}-cause`}>
                Root cause{action === 'exception.resolve' ? '' : ' (optional)'}
              </Label>
              <Select
                id={`${form}-cause`}
                value={inputs.rootCauseCategory ?? ''}
                onChange={(e) => set({ rootCauseCategory: e.target.value })}
                autoFocus
              >
                <option value="">Choose a root cause</option>
                {(causes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {action === 'exception.acceptConditionally' ? (
            <div>
              <Label htmlFor={`${form}-challenge`}>Challenge reference</Label>
              <Input
                id={`${form}-challenge`}
                value={inputs.challengeRef ?? ''}
                placeholder="The vendor or custodian challenge this depends on"
                onChange={(e) => set({ challengeRef: e.target.value })}
                autoFocus
              />
            </div>
          ) : null}
          {action === 'exception.attachEvidence' ? (
            <div>
              <Label htmlFor={`${form}-file`}>File</Label>
              <input
                id={`${form}-file`}
                type="file"
                className="block text-body file:mr-2 file:h-(--ll-control-height) file:rounded-md file:border file:border-input file:bg-card file:px-(--ll-padding-x)"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) set({ evidence: { name: file.name } });
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                One file is attached to all {count}: the same file on each, not a copy per exception.
              </p>
            </div>
          ) : null}
          {action === 'exception.acceptProposal' ? null : (
            <div>
              <Label htmlFor={`${form}-note`}>
                {action === 'exception.override' ? 'Reason' : 'Note'}
                {needsNote ? '' : ' (optional)'}
              </Label>
              <Textarea
                id={`${form}-note`}
                value={inputs.note ?? ''}
                onChange={(e) => set({ note: e.target.value })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Working…' : `${def.verb} ${count}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── One exception ──────────────────────────────────────────
function ExceptionPanel({
  id,
  user,
  onAction,
  onChanged,
  onClose,
}: {
  id: string;
  user: User;
  onAction: (id: ActionId) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const record = useQuery({ queryKey: ['exception', user.id, id], queryFn: () => fetchException(id) });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [ruleFor, setRuleFor] = useState<ExceptionRecord | null>(null);

  if (record.isPending) {
    return (
      <SidePanel label="Exception detail" title={`Exception ${id}`} onClose={onClose} wide>
        <LoadingPanel label="Loading exception…" />
      </SidePanel>
    );
  }
  if (record.error) {
    return (
      <SidePanel label="Exception detail" title={`Exception ${id}`} onClose={onClose} wide>
        <ErrorPanel
          messages={problemOf(record.error)?.messages ?? []}
          onRetry={() => void record.refetch()}
        />
      </SidePanel>
    );
  }
  const x = record.data;
  const open = OPEN.includes(x.status);
  const post = async () => {
    setSaving(true);
    try {
      queryClient.setQueryData(['exception', user.id, id], await addExceptionComment(id, comment));
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['audit', user.id, 'exception', id] });
    } catch (error) {
      for (const m of problemOf(error)?.messages ?? []) notify({ ...m, target: id }, 'Exceptions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel label="Exception detail" title={`${EXCEPTION_TYPES[x.type]} ${x.id}`} onClose={onClose} wide>
      <Tabs defaultValue="details" className="flex-1">
        <TabsList aria-label="Exception sections">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex flex-col gap-4 overflow-y-auto p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <Badge status={STATUS[x.status].tone}>{STATUS[x.status].label}</Badge>
              <Badge status={SEVERITY[x.severity].tone}>{SEVERITY[x.severity].label} severity</Badge>
            </dd>
            <dt className="text-muted-foreground">Record</dt>
            <dd>{x.recordRef.label}</dd>
            <dt className="text-muted-foreground">Portfolio</dt>
            <dd>
              {x.portfolioName}{' '}
              <span className="font-mono text-xs text-muted-foreground">{x.portfolioId}</span>
            </dd>
            <dt className="text-muted-foreground">Detected</dt>
            <dd>
              {formatTimestamp(x.detectedAt)} by {x.detectedBy.name}
            </dd>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{x.owner?.name ?? 'Unassigned'}</dd>
            {x.dueBy ? (
              <>
                <dt className="text-muted-foreground">Due</dt>
                <dd>{formatIsoDate(x.dueBy)}</dd>
              </>
            ) : null}
            {x.rootCauseCategory || x.rootCause ? (
              <>
                <dt className="text-muted-foreground">Root cause</dt>
                <dd>{[x.rootCauseCategory, x.rootCause].filter(Boolean).join(': ')}</dd>
              </>
            ) : null}
          </dl>

          {x.failedRule ? (
            <p data-slot="failed-rule" className="rounded-md border bg-muted px-3 py-2">
              <span className="font-semibold">Rule that failed.</span> {describeFailedRule(x.failedRule)}
            </p>
          ) : null}
          {x.values?.expected && x.values.actual ? (
            <ComparisonTable
              comparison={{
                leftLabel: x.type === 'priceVariance' || x.type === 'priceStale' ? 'Prior day' : 'Expected',
                rightLabel: 'Actual',
                tolerancePct:
                  x.failedRule?.check === 'dayOverDay' ? fractionToPercent(x.failedRule.threshold) : '0',
                rows: [
                  { key: x.id, label: x.recordRef.label, left: x.values.expected, right: x.values.actual },
                ],
              }}
              defaultMode={x.failedRule ? 'percent' : 'absolute'}
            />
          ) : null}

          {x.proposal ? (
            <div data-slot="proposal" className="rounded-md border border-info/40 bg-info/10 px-3 py-2">
              <p className="font-semibold">Proposed by {x.proposal.by.name}</p>
              <p>{x.proposal.summary}</p>
              {open ? (
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => onAction('exception.acceptProposal')}
                >
                  Accept proposal
                </Button>
              ) : null}
            </div>
          ) : null}

          {open ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onAction('exception.resolve')}>Resolve</Button>
              <Button variant="secondary" onClick={() => onAction('exception.assign')}>
                Assign
              </Button>
              <Button variant="secondary" onClick={() => onAction('exception.attachEvidence')}>
                Attach evidence
              </Button>
              <Button variant="ghost" onClick={() => setRuleFor(x)}>
                Save as recurring-break rule
              </Button>
            </div>
          ) : (
            <p className="rounded-md border bg-muted px-3 py-2">
              <span className="font-semibold">Closed.</span> This exception is{' '}
              {STATUS[x.status].label.toLowerCase()}, so it can no longer be changed. Comments can still be
              added.
            </p>
          )}

          <section aria-label="Evidence">
            <h3 className="mb-1 font-semibold">Evidence</h3>
            {x.evidence.length ? (
              <ul className="list-disc pl-5">
                {x.evidence.map((e, i) => (
                  <li key={`${e.id}-${i}`}>
                    {e.label} <span className="text-xs text-muted-foreground">({e.type})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nothing attached yet.</p>
            )}
          </section>

          <section aria-label="Thread">
            <h3 className="mb-1 font-semibold">Thread</h3>
            {x.thread.length ? (
              <ol className="mb-2 flex flex-col gap-2">
                {x.thread.map((t) => (
                  <li key={t.id} className="rounded-md border px-3 py-1.5">
                    <p className="text-xs text-muted-foreground">
                      {t.author.name} · {formatTimestamp(t.at)}
                    </p>
                    <p>{t.text}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mb-2 text-muted-foreground">
                No comments yet. Keep the discussion here, with the exception.
              </p>
            )}
            <Label htmlFor={`comment-${id}`}>Add a comment</Label>
            <Textarea id={`comment-${id}`} value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button
              variant="secondary"
              className="mt-2"
              disabled={saving || !comment.trim()}
              onClick={() => void post()}
            >
              {saving ? 'Adding…' : 'Add comment'}
            </Button>
          </section>
        </TabsContent>
        <TabsContent value="history" className="overflow-y-auto">
          <RecordHistory recordType="exception" recordId={x.id} userId={user.id} noun="exception" />
        </TabsContent>
      </Tabs>
      {ruleFor ? (
        <SaveRuleDialog exception={ruleFor} onClose={() => setRuleFor(null)} onSaved={onChanged} />
      ) : null}
    </SidePanel>
  );
}

// ── Recurring-break rules ──────────────────────────────────
function SaveRuleDialog({
  exception,
  onClose,
  onSaved,
}: {
  exception: ExceptionRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useId();
  const causes = useQuery({ queryKey: ['root-causes'], queryFn: fetchRootCauses, staleTime: Infinity });
  // The pattern starts from this exception: its type and the words that lead its record name ("Unapplied receipt").
  const [counterparty, setCounterparty] = useState(exception.recordRef.label.replace(/\s+\S*\d\S*$/, ''));
  const [cause, setCause] = useState(exception.rootCauseCategory ?? '');
  const [done, setDone] = useState<string | null>(null);
  return (
    <ReasonDialog
      title="Save as recurring-break rule"
      label="Rule name"
      confirmLabel="Save rule and tag matches"
      description={
        done ?? (
          <p>
            New and open {EXCEPTION_TYPES[exception.type].toLowerCase()} exceptions that match will be tagged
            with a proposed resolution. A rule never resolves anything by itself: a person accepts each
            proposal.
          </p>
        )
      }
      onClose={onClose}
      onSubmit={async (name) => {
        const rule = await createBreakRule({
          name,
          match: {
            type: exception.type,
            ...(counterparty.trim() ? { counterparty: counterparty.trim() } : {}),
          },
          rootCauseCategory: cause,
        });
        const { tagged } = await applyBreakRule(rule.id);
        toast(
          'Rule saved',
          `${tagged.length.toLocaleString('en-US')} open ${tagged.length === 1 ? 'exception' : 'exceptions'} tagged as proposals`,
        );
        setDone(`Saved. ${tagged.length} tagged.`);
        onSaved();
      }}
    >
      <div>
        <Label htmlFor={`${form}-match`}>Record name contains</Label>
        <Input id={`${form}-match`} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`${form}-cause`}>Proposed root cause</Label>
        <Select id={`${form}-cause`} value={cause} onChange={(e) => setCause(e.target.value)}>
          <option value="">Choose a root cause</option>
          {(causes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
    </ReasonDialog>
  );
}

const describeMatch = (rule: RecurringBreakRule) =>
  [
    EXCEPTION_TYPES[rule.match.type],
    rule.match.counterparty ? `record contains "${rule.match.counterparty}"` : '',
    rule.match.maxAmount ? `difference up to ${rule.match.maxAmount}` : '',
    rule.match.portfolioIds?.length ? `in ${rule.match.portfolioIds.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(', ');

function BreakRulesDialog({
  onClose,
  onApplied,
  canEdit,
}: {
  onClose: () => void;
  onApplied: () => void;
  canEdit: boolean;
}) {
  const { notify } = useNotifications();
  const rules = useQuery({ queryKey: ['break-rules'], queryFn: fetchBreakRules });
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const act = async (id: string, run: () => Promise<string>) => {
    setBusy(id);
    try {
      setSaid(await run());
      await rules.refetch();
    } catch (error) {
      for (const m of problemOf(error)?.messages ?? []) notify(m, 'Exceptions');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent variant="sheet" data-slot="break-rules" aria-describedby={undefined}>
        <DialogTitle>Recurring-break rules</DialogTitle>
        <p className="text-muted-foreground">
          A rule tags matching exceptions with a proposed resolution. It never resolves one by itself. To add
          a rule, open an exception and choose “Save as recurring-break rule”.
        </p>
        {canEdit ? null : (
          <p className="rounded-md border bg-muted px-3 py-2">
            Your role can see these rules but not apply or delete them.
          </p>
        )}
        <p role="status" className="min-h-5 font-medium">
          {said}
        </p>
        {rules.isPending ? <LoadingPanel label="Loading rules…" /> : null}
        {rules.error ? (
          <ErrorPanel
            messages={problemOf(rules.error)?.messages ?? []}
            onRetry={() => void rules.refetch()}
          />
        ) : null}
        {rules.data?.length === 0 ? <p className="text-muted-foreground">No rules yet.</p> : null}
        <ul className="flex min-h-0 flex-col overflow-y-auto">
          {(rules.data ?? []).map((rule) => (
            <li
              key={rule.id}
              data-rule-id={rule.id}
              className="flex items-center gap-3 border-b py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {describeMatch(rule)} · proposes root cause {rule.rootCauseCategory} · by{' '}
                  {rule.createdBy.name}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={!canEdit || busy !== null}
                aria-label={`Apply ${rule.name}`}
                onClick={() =>
                  void act(rule.id, async () => {
                    const { tagged } = await applyBreakRule(rule.id);
                    onApplied();
                    return `${rule.name}: ${tagged.length.toLocaleString('en-US')} open ${tagged.length === 1 ? 'exception' : 'exceptions'} tagged as proposals. None was resolved.`;
                  })
                }
              >
                {busy === rule.id ? 'Applying…' : 'Apply now'}
              </Button>
              <Button
                variant="ghost"
                disabled={!canEdit || busy !== null}
                aria-label={`Delete ${rule.name}`}
                onClick={() =>
                  void act(rule.id, async () => {
                    await deleteBreakRule(rule.id);
                    return `${rule.name} deleted. Exceptions it already tagged keep their proposal.`;
                  })
                }
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
