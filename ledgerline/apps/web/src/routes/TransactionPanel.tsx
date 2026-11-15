import type {
  ActionRef,
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
  Button,
  FinancialCell,
  FinancialInput,
  SectionBanner,
  toast,
  useNotifications,
} from '@ledgerline/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, fetchPermissions } from '../api/client';
import { ErrorPanel, LoadingPanel } from '../app/StatePanel';

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
export function TransactionPanel({ id, user, onSaved, onClose }: TransactionPanelProps) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const heading = useRef<HTMLHeadingElement>(null);
  const [staged, setStaged] = useState<Staged>({});
  const [conflict, setConflict] = useState<TransactionRow | null>(null);
  /** The version edits are based on. After "Keep my edits" it is the other user's version. */
  const [baseVersion, setBaseVersion] = useState<number | null>(null);

  const record = useQuery({
    queryKey: ['transaction', user.id, id],
    queryFn: () => api<TransactionRow>(`/transactions/${id}`),
    // Never refresh under unsaved edits: that would be a silent overwrite.
    staleTime: Infinity,
  });
  const permissions = useQuery({ queryKey: ['permissions', user.id], queryFn: fetchPermissions });

  useEffect(() => heading.current?.focus(), [id]);

  const save = useMutation({
    mutationFn: (row: TransactionRow) => {
      const changes = Object.fromEntries(
        Object.entries(staged).flatMap(([field, value]) =>
          value.value === null ? [] : [[field, value.value]],
        ),
      ) as TransactionPatch['changes'];
      const reason = Object.values(staged).find((v) => v.provenance.overrideReason)?.provenance
        .overrideReason;
      const patch: TransactionPatch = { changes, ...(reason ? { reason } : {}) };
      return api<MutationResult<TransactionRow>>(`/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': String(baseVersion ?? row.version) },
        body: JSON.stringify(patch),
      });
    },
    onSuccess: ({ record: saved }) => {
      queryClient.setQueryData(['transaction', user.id, id], saved);
      setStaged({});
      setConflict(null);
      setBaseVersion(null);
      toast('Saved', `Transaction ${id}`);
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409 && error.body.record) {
        setConflict(error.body.record as TransactionRow);
        return;
      }
      // Errors are never only a toast: they stay in the panel and in the notification history.
      for (const m of error instanceof ApiError ? error.messages : [])
        notify({ ...m, target: m.target ?? id }, 'Transactions');
    },
  });

  if (record.isPending || permissions.isPending) {
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
          messages={error instanceof ApiError ? error.messages : []}
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
  const dirty = Object.keys(staged).length > 0;
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

  const banner: UiState | null = conflict
    ? {
        kind: 'conflict',
        theirs: { type: 'user', id: 'other', name: 'Another user' },
        at: new Date().toISOString(),
        resolve: [REVIEW, KEEP],
      }
    : save.error instanceof ApiError && save.error.status !== 409
      ? { kind: 'blockingError', messages: save.error.messages }
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge
              status={row.status === 'posted' ? 'good' : row.status === 'reversed' ? 'warning' : 'neutral'}
            >
              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </Badge>
          </dd>
          <dt className="text-muted-foreground">Portfolio</dt>
          <dd>{row.portfolio.label}</dd>
          <dt className="text-muted-foreground">Security</dt>
          <dd>{row.security?.label ?? 'None (cash only)'}</dd>
          <dt className="text-muted-foreground">Trade date</dt>
          <dd className="tabular">{row.tradeDate.value ?? 'No date'}</dd>
          <dt className="text-muted-foreground">Settle date</dt>
          <dd className="tabular">{row.settleDate.value ?? 'No date'}</dd>
        </dl>

        {banner ? (
          banner.kind === 'permissionLimited' ? (
            <p data-slot="read-only-reason" className="rounded-md border bg-muted px-3 py-2">
              <span className="font-semibold">Read only.</span> {readOnly}
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
                <p className="mt-1 text-xs text-muted-foreground">Not used for this type of transaction.</p>
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
              {blocked && !readOnly ? <p className="mt-1 text-xs text-muted-foreground">{blocked}</p> : null}
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
          <Button disabled={!dirty || save.isPending || Boolean(conflict)} onClick={() => save.mutate(row)}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setStaged({});
              setConflict(null);
              setBaseVersion(null);
              save.reset();
            }}
          >
            Discard changes
          </Button>
          <span className="ml-auto text-xs text-muted-foreground" role="status">
            {dirty
              ? `${Object.keys(staged).length} unsaved ${Object.keys(staged).length === 1 ? 'change' : 'changes'}`
              : 'No unsaved changes'}
          </span>
        </footer>
      )}
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
