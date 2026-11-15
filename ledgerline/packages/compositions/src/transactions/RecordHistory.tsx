import type { AuditEvent } from '@ledgerline/contracts';
import { formatTimestamp } from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { fetchRecordAudit, problemOf } from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';

const ACTION_LABELS: Record<string, string> = {
  'transaction.create': 'Created',
  'transaction.clone': 'Created as a clone',
  'transaction.edit': 'Edited',
  'transaction.override': 'Calculated value overridden',
  'transaction.post': 'Posted',
  'transaction.reverse': 'Reversed',
  'transaction.delete': 'Deleted',
  'transaction.import': 'Created by import',
  'transaction.import.correct': 'Corrected by import',
};
const FIELD_LABELS: Record<string, string> = {
  portfolioId: 'Portfolio',
  securityId: 'Security',
  type: 'Type',
  tradeDate: 'Trade date',
  settleDate: 'Settle date',
  quantity: 'Quantity',
  price: 'Price',
  amount: 'Amount',
  status: 'Status',
  clonedFrom: 'Cloned from',
  source: 'Source',
};
const NOTE_LABELS: Record<NonNullable<AuditEvent['note']>['kind'], string> = {
  comment: 'Comment',
  overrideJustification: 'Reason for override',
  failureReason: 'Why it failed',
  approvalNote: 'Approval note',
  warningAcknowledged: 'Warning acknowledged',
};

const humanise = (action: string) => {
  const last = action.split('.').pop() ?? action;
  return last.charAt(0).toUpperCase() + last.slice(1);
};
const shown = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? 'none'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

/** Fields that differ between before and after. An event with no "before" (a create) lists what it recorded about its origin. */
function changes(event: AuditEvent): { field: string; before?: string; after: string }[] {
  const after = event.after ?? {};
  if (!event.before) {
    return ['clonedFrom', 'source'].flatMap((field) =>
      after[field] === undefined ? [] : [{ field, after: shown(after[field]) }],
    );
  }
  const before = event.before;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .map((field) => ({ field, before: shown(before[field]), after: shown(after[field]) }));
}

export interface RecordHistoryProps {
  recordType: string;
  recordId: string;
  userId: string;
}

/** The audit history of one record, newest first: who did what, when, what changed and on what evidence (SPEC 7.10). */
export function RecordHistory({ recordType, recordId, userId }: RecordHistoryProps) {
  const audit = useQuery({
    queryKey: ['audit', userId, recordType, recordId],
    queryFn: () => fetchRecordAudit(recordType, recordId),
  });
  if (audit.isPending) return <LoadingPanel label="Loading history…" />;
  if (audit.error)
    return (
      <ErrorPanel messages={problemOf(audit.error)?.messages ?? []} onRetry={() => void audit.refetch()} />
    );
  if (audit.data.length === 0) {
    return (
      <p className="p-4 text-muted-foreground" data-slot="history-empty">
        No history is recorded for this transaction. It was loaded with the opening data, before audit history
        began.
      </p>
    );
  }
  return (
    <ol aria-label="History, newest first" data-slot="record-history" className="flex flex-col">
      {audit.data.map((event) => {
        const changed = changes(event);
        return (
          <li key={event.id} className="border-b px-4 py-3 last:border-b-0">
            <p className="font-medium">{ACTION_LABELS[event.action] ?? humanise(event.action)}</p>
            <p className="text-xs text-muted-foreground">
              {event.actor.name} · <time dateTime={event.at}>{formatTimestamp(event.at)}</time>
              {event.batchId ? (
                <>
                  {' '}
                  · batch <span className="font-mono">{event.batchId}</span>
                </>
              ) : null}
            </p>
            {changed.length ? (
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                {changed.map((c) => (
                  <div key={c.field} className="contents">
                    <dt className="text-muted-foreground">{FIELD_LABELS[c.field] ?? c.field}</dt>
                    <dd className="font-mono">
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
            ) : null}
            {event.note ? (
              <p className="mt-1.5 text-xs">
                <span className="font-medium">{NOTE_LABELS[event.note.kind]}:</span> {event.note.text}
              </p>
            ) : null}
            {event.evidence?.length ? (
              <p className="mt-1.5 text-xs">
                <span className="font-medium">Evidence:</span> {event.evidence.map((e) => e.label).join(', ')}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
