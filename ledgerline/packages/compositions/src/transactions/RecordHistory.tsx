import { AuditTimeline } from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { fetchRecordAudit, problemOf } from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';

/** Plain names for the actions users see most. Anything else is put into words from its id. */
export const ACTION_LABELS: Record<string, string> = {
  'transaction.create': 'Created',
  'transaction.clone': 'Created as a clone',
  'transaction.edit': 'Edited',
  'transaction.override': 'Calculated value overridden',
  'transaction.post': 'Posted',
  'transaction.reverse': 'Reversed',
  'transaction.delete': 'Deleted',
  'transaction.import': 'Created by import',
  'transaction.import.correct': 'Corrected by import',
  'exception.detect': 'Detected',
  'exception.assign': 'Assigned',
  'exception.resolve': 'Resolved',
  'exception.accept': 'Accepted',
  'exception.acceptConditionally': 'Accepted conditionally',
  'exception.override': 'Overridden',
  'exception.escalate': 'Escalated',
  'exception.attachEvidence': 'Evidence attached',
  'exception.acceptProposal': 'Proposal accepted',
  'exception.propose': 'Tagged by a recurring-break rule',
  'exception.comment': 'Comment added',
  'period.close': 'Closed',
  'period.reopen': 'Reopened',
  'period.reopen.request': 'Reopen requested',
  'period.reopen.rejected': 'Reopen rejected',
  'period.overrideBlock.request': 'Block override requested',
  'period.overrideBlock.approved': 'Block override approved',
  'period.overrideBlock.rejected': 'Block override rejected',
  'period.signoff': 'Signed off',
  'approval.approve': 'Approved',
  'approval.reject': 'Rejected',
  'tolerance.update': 'Tolerance changed',
};
export const FIELD_LABELS: Record<string, string> = {
  portfolioId: 'Portfolio',
  securityId: 'Security',
  clonedFrom: 'Cloned from',
  rootCauseCategory: 'Root cause',
  matchedRuleId: 'Matched rule',
};

export interface RecordHistoryProps {
  recordType: string;
  recordId: string;
  userId: string;
  /** What the record is called in the empty state, e.g. "transaction". */
  noun?: string;
}

/** The audit history of one record, newest first: who did what, when, what changed and on what evidence (SPEC 7.10). */
export function RecordHistory({ recordType, recordId, userId, noun = recordType }: RecordHistoryProps) {
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
        No history is recorded for this {noun}. It was loaded with the opening data, before audit history
        began.
      </p>
    );
  }
  return (
    <div data-slot="record-history">
      <AuditTimeline events={audit.data} actionLabels={ACTION_LABELS} fieldLabels={FIELD_LABELS} />
    </div>
  );
}
