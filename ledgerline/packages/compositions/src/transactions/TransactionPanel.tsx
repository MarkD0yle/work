import type {
  ActionRef,
  BusinessDate,
  Message,
  FinancialValue,
  MutationResult,
  Permission,
  TransactionFinancialField,
  TransactionPatch,
  TransactionRow,
  UiState,
  User,
} from '@ledgerline/contracts';
import {
  Badge,
  BusinessDateInput,
  Button,
  endOfMonth,
  formatIsoDate,
  formatPeriod,
  FinancialCell,
  FinancialInput,
  GlossaryTerm,
  GlossaryText,
  SectionBanner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  useNotifications,
} from '@ledgerline/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCalendar, fetchPeriods, fetchPermissions, problemOf, request } from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { RecordHistory } from './RecordHistory';

const FIELDS: { field: TransactionFinancialField; label: string }[] = [
  { field: 'quantity', label: 'Quantity' },
  { field: 'price', label: 'Price' },
  { field: 'amount', label: 'Amount' },
];

const REVIEW: ActionRef = { actionId: 'conflict.review', label: 'Review their change' };
const KEEP: ActionRef = { actionId: 'conflict.keepMine', label: 'Keep my edits' };

type Staged = Partial<Record<TransactionFinancialField, FinancialValue>>;

interface TransactionPanelProps {
  id: string;
  user: User;
  /** The engine's business date: `t` and `t+2` in the date fields count from here. */
  businessDate: string;
  onSaved: () => void;
  onClose: () => void;
}

const can = (permissions: Permission[] | undefined, action: string) =>
  permissions?.find((p) => p.action === action);

/**
 * Detail panel for one transaction. Financial values of an unposted transaction can be edited here.
 * Changing a calculated value is an override: it needs the permission and a reason, and the audit history
 * keeps the original. Nothing is saved until the user chooses Save.
 */
export function TransactionPanel({ id, user, businessDate, onSaved, onClose }: TransactionPanelProps) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const heading = useRef<HTMLHeadingElement>(null);
  const [staged, setStaged] = useState<Staged>({});
  const [stagedDates, setStagedDates] = useState<{ tradeDate?: BusinessDate; settleDate?: BusinessDate }>({});
  const [conflict, setConflict] = useState<TransactionRow | null>(null);
  /** The version edits are based on. After "Keep my edits" it is the other user's version. */
  const [baseVersion, setBaseVersion] = useState<number | null>(null);

  const record = useQuery({
    queryKey: ['transaction', user.id, id],
    queryFn: () => request<TransactionRow>(`/transactions/${id}`),
    // Never refresh under unsaved edits: that would be a silent overwrite.
    staleTime: Infinity,
  });
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });
  // The portfolio's calendar and periods, for business-day rules and the closed-period check.
  const calendarCode = record.data?.tradeDate.calendar;
  const calendar = useQuery({
    queryKey: ['calendar', calendarCode],
    queryFn: () => fetchCalendar(calendarCode as string),
    enabled: Boolean(calendarCode),
    staleTime: Infinity,
  });
  const portfolioId = record.data?.portfolio.id;
  const periods = useQuery({
    queryKey: ['periods', user.id, portfolioId],
    queryFn: () => fetchPeriods(portfolioId as string),
    enabled: Boolean(portfolioId),
  });
  const holidays = useMemo(() => calendar.data?.holidays.map((h) => h.date) ?? [], [calendar.data]);

  useEffect(() => heading.current?.focus(), [id]);

  const save = useMutation({
    mutationFn: (row: TransactionRow) => {
      const changes = Object.fromEntries(
        Object.entries(staged).flatMap(([field, value]) =>
          value.value === null ? [] : [[field, value.value]],
        ),
      ) as NonNullable<TransactionPatch['changes']>;
      const reason = Object.values(staged).find((v) => v.provenance.overrideReason)?.provenance
        .overrideReason;
      const dates = {
        ...(stagedDates.tradeDate?.value ? { tradeDate: stagedDates.tradeDate.value } : {}),
        ...(stagedDates.settleDate ? { settleDate: stagedDates.settleDate.value } : {}),
      };
      const patch: TransactionPatch = {
        ...(Object.keys(changes).length ? { changes } : {}),
        ...(reason ? { reason } : {}),
        ...(Object.keys(dates).length ? { dates } : {}),
      };
      return request<MutationResult<TransactionRow>>(`/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': String(baseVersion ?? row.version) },
        body: JSON.stringify(patch),
      });
    },
    onSuccess: ({ record: saved }) => {
      queryClient.setQueryData(['transaction', user.id, id], saved);
      void queryClient.invalidateQueries({ queryKey: ['audit', user.id, 'transaction', id] });
      setStaged({});
      setStagedDates({});
      setConflict(null);
      setBaseVersion(null);
      toast('Saved', `Transaction ${id}`);
      onSaved();
    },
    onError: (error) => {
      const problem = problemOf(error);
      if (problem?.status === 409 && problem.body.record) {
        setConflict(problem.body.record as TransactionRow);
        return;
      }
      // Errors are never only a toast: they stay in the panel and in the notification history.
      for (const m of problem?.messages ?? []) notify({ ...m, target: m.target ?? id }, 'Transactions');
    },
  });

  // The calendar and periods load after the record. Until they arrive the date checks have nothing to check
  // against, so the form waits: a date entered early would otherwise skip the closed-period rule on screen.
  const rulesPending = Boolean(
    (record.data?.tradeDate.calendar && calendar.isPending) ||
    (record.data?.portfolio.id && periods.isPending),
  );
  if (record.isPending || permissions.isPending || rulesPending) {
    return (
      <Shell title={`Transaction ${id}`} heading={heading} onClose={onClose}>
        <LoadingPanel label="Loading transaction…" />
      </Shell>
    );
  }
  if (record.error || permissions.error) {
    const error = record.error ?? permissions.error;
    return (
      <Shell title={`Transaction ${id}`} heading={heading} onClose={onClose}>
        <ErrorPanel
          messages={problemOf(error)?.messages ?? []}
          onRetry={() => {
            void record.refetch();
            void permissions.refetch();
          }}
        />
      </Shell>
    );
  }

  const row = record.data;
  const edit = can(permissions.data, 'transaction.edit');
  const override = can(permissions.data, 'transaction.override');
  const changeCount = Object.keys(staged).length + Object.keys(stagedDates).length;
  const dirty = changeCount > 0;
  const tradeDate = stagedDates.tradeDate ?? row.tradeDate;
  const settleDate = stagedDates.settleDate ?? { ...row.settleDate, businessDayRule: 'following' as const };

  /** Entry into a closed period is blocked here, and again by the server, naming the period and who can reopen it. */
  const checkPeriod = (iso: string): Message | null => {
    const period = periods.data?.find((p) => p.periodEnd === endOfMonth(iso));
    const state = period?.closes.transaction;
    if (!period || (state !== 'closed' && state !== 'closing')) return null;
    return {
      code: 'LL-PER-0001',
      severity: 'error',
      level: 'field',
      text: `${formatPeriod(period.periodEnd)} is ${state} for transactions in this portfolio.`,
      fix: 'Use a date in an open period, or ask a controller in Investment Accounting to reopen it.',
      target: 'tradeDate',
    };
  };
  const checkSettle = (iso: string): Message | null =>
    tradeDate.value && iso < tradeDate.value
      ? {
          code: 'LL-VAL-0118',
          severity: 'error',
          level: 'field',
          text: 'Settlement date is before trade date.',
          fix: `Choose a date on or after ${formatIsoDate(tradeDate.value)}.`,
          target: 'settleDate',
        }
      : null;
  const stageDate = (field: 'tradeDate' | 'settleDate', next: BusinessDate) =>
    setStagedDates((prev) => {
      const { [field]: _removed, ...rest } = prev;
      return next.value === row[field].value ? rest : { ...rest, [field]: next };
    });
  const actor = { type: 'user' as const, id: user.id, name: user.name };

  // Why the whole record is read-only, if it is. Restrictions always say why.
  const readOnly =
    row.status !== 'unposted'
      ? row.status === 'posted'
        ? 'This transaction is posted, so it cannot be edited. Reverse it, then enter a corrected transaction.'
        : 'This transaction is reversed, so it cannot be edited. Enter a new transaction instead.'
      : !edit?.allowed
        ? (edit?.explanation ?? 'Your role cannot edit transactions.')
        : null;

  const saveProblem = problemOf(save.error);
  const banner: UiState | null = conflict
    ? {
        kind: 'conflict',
        theirs: { type: 'user', id: 'other', name: 'Another user' },
        at: new Date().toISOString(),
        resolve: [REVIEW, KEEP],
      }
    : saveProblem && saveProblem.status !== 409
      ? { kind: 'blockingError', messages: saveProblem.messages }
      : readOnly
        ? { kind: 'permissionLimited', reason: readOnly }
        : null;

  return (
    <Shell
      title={`Transaction ${row.id}`}
      heading={heading}
      onClose={onClose}
      closeLabel={dirty ? 'Discard changes and close' : 'Close'}
    >
      <Tabs defaultValue="details" className="flex-1">
        <TabsList aria-label="Transaction sections">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge
                  status={
                    row.status === 'posted' ? 'good' : row.status === 'reversed' ? 'warning' : 'neutral'
                  }
                >
                  <GlossaryTerm>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</GlossaryTerm>
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Portfolio</dt>
              <dd>{row.portfolio.label}</dd>
              <dt className="text-muted-foreground">Security</dt>
              <dd>{row.security?.label ?? 'None (cash only)'}</dd>
            </dl>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <BusinessDateInput
                  label="Trade date"
                  name="tradeDate"
                  value={tradeDate}
                  today={businessDate}
                  holidays={holidays}
                  validate={checkPeriod}
                  disabled={Boolean(readOnly) || save.isPending}
                  onCommit={(next) => stageDate('tradeDate', next)}
                />
                {stagedDates.tradeDate ? (
                  <p className="mt-1 text-xs text-info">Changed, not saved yet.</p>
                ) : null}
              </div>
              <div>
                <BusinessDateInput
                  label="Settle date"
                  name="settleDate"
                  value={settleDate}
                  today={tradeDate.value ?? businessDate}
                  holidays={holidays}
                  validate={checkSettle}
                  disabled={Boolean(readOnly) || save.isPending}
                  onCommit={(next) => stageDate('settleDate', next)}
                />
                {stagedDates.settleDate ? (
                  <p className="mt-1 text-xs text-info">Changed, not saved yet.</p>
                ) : null}
              </div>
            </div>

            {banner ? (
              banner.kind === 'permissionLimited' ? (
                <p data-slot="read-only-reason" className="rounded-md border bg-muted px-3 py-2">
                  <span className="font-semibold">Read only.</span> <GlossaryText text={readOnly ?? ''} />
                </p>
              ) : (
                <SectionBanner
                  state={banner}
                  onAction={(action) => {
                    if (!conflict) return;
                    if (action.actionId === REVIEW.actionId) {
                      // Take their version and drop my edits.
                      queryClient.setQueryData(['transaction', user.id, id], conflict);
                      setStaged({});
                      setStagedDates({});
                      setBaseVersion(null);
                    } else {
                      // Keep my edits on top of their version; the next Save overwrites knowingly.
                      setBaseVersion(conflict.version);
                    }
                    setConflict(null);
                    save.reset();
                  }}
                />
              )
            ) : null}

            {FIELDS.map(({ field, label }) => {
              const value = staged[field] ?? row[field];
              const original = row[field];
              const isOverride =
                original.provenance.origin === 'calculated' || original.provenance.origin === 'overridden';
              // A field with no value on this kind of record (a fee has no quantity) is shown, not edited.
              if (original.value === null && original.nullReason === 'notApplicable') {
                return (
                  <div key={field}>
                    <p className="mb-1 text-xs font-medium">{label}</p>
                    <FinancialCell value={original} className="justify-start" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Not used for this type of transaction.
                    </p>
                  </div>
                );
              }
              const blocked = readOnly
                ? readOnly
                : isOverride && !override?.allowed
                  ? (override?.explanation ?? 'Your role cannot override calculated values.')
                  : null;
              return (
                <div key={field}>
                  <FinancialInput
                    label={label}
                    name={field}
                    value={value}
                    actor={actor}
                    disabled={Boolean(blocked) || save.isPending}
                    onCommit={(next) =>
                      setStaged((prev) => {
                        const { [field]: _removed, ...rest } = prev;
                        return next.value === original.value ? rest : { ...rest, [field]: next };
                      })
                    }
                  />
                  {blocked && !readOnly ? (
                    <p className="mt-1 text-xs text-muted-foreground">{blocked}</p>
                  ) : null}
                  {staged[field] ? (
                    <p className="mt-1 text-xs text-info" data-slot="dirty-marker">
                      Changed, not saved yet
                      {staged[field]?.provenance.origin === 'overridden' ? ' (override)' : ''}.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {readOnly ? null : (
            <footer className="flex shrink-0 items-center gap-2 border-t p-3">
              <Button
                disabled={!dirty || save.isPending || Boolean(conflict)}
                onClick={() => save.mutate(row)}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                disabled={!dirty || save.isPending}
                onClick={() => {
                  setStaged({});
                  setStagedDates({});
                  setConflict(null);
                  setBaseVersion(null);
                  save.reset();
                }}
              >
                Discard changes
              </Button>
              <span className="ml-auto text-xs text-muted-foreground" role="status">
                {dirty
                  ? `${changeCount} unsaved ${changeCount === 1 ? 'change' : 'changes'}`
                  : 'No unsaved changes'}
              </span>
            </footer>
          )}
        </TabsContent>
        <TabsContent value="history" className="overflow-y-auto">
          <RecordHistory recordType="transaction" recordId={row.id} userId={user.id} />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Shell({
  title,
  heading,
  onClose,
  closeLabel = 'Close',
  children,
}: {
  title: string;
  heading: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      aria-label="Transaction detail"
      data-slot="transaction-panel"
      className="flex w-96 shrink-0 flex-col border-l bg-card"
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        )
          onClose();
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <h2 ref={heading} tabIndex={-1} className="flex-1 font-mono font-semibold outline-hidden">
          {title}
        </h2>
        <Button
          variant="ghost"
          size={closeLabel === 'Close' ? 'icon' : 'default'}
          aria-label={closeLabel}
          onClick={onClose}
        >
          {closeLabel === 'Close' ? <X aria-hidden /> : closeLabel}
        </Button>
      </header>
      {children}
    </aside>
  );
}
