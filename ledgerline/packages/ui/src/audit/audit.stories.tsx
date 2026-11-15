import type { AuditEvent } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuditTimeline } from './audit-timeline';

const meta: Meta = { title: 'Audit/AuditTimeline' };
export default meta;

const base = {
  recordRef: { type: 'period', id: 'PER-0011-2026-11' },
  at: '2026-11-14T16:30:00.000Z',
  immutable: true,
} as const;
const events: AuditEvent[] = [
  {
    ...base,
    id: 'AU-4',
    action: 'period.reopen',
    actor: { type: 'user', id: 'u-cleo', name: 'Cleo' },
    effectiveDate: '2026-11-30',
    before: { state: 'closed' },
    after: { state: 'reopened' },
    note: { kind: 'approvalNote', text: 'Late corporate action notice. Approved by Fay.' },
  },
  {
    ...base,
    id: 'AU-3',
    action: 'exception.resolve',
    actor: {
      type: 'agent',
      id: 'agent-recon',
      name: 'Reconciliation assistant',
      onBehalfOf: { type: 'user', id: 'u-rafa', name: 'Rafa' },
    },
    before: { status: 'new' },
    after: { status: 'resolved' },
    note: { kind: 'comment', text: 'Receipt applied on the 14th.' },
    evidence: [{ type: 'file', id: 'F-1', label: 'custodian-statement.pdf' }],
  },
  {
    ...base,
    id: 'AU-2',
    action: 'period.close',
    actor: { type: 'job', id: 'J-000012', name: 'Close 3 portfolios' },
    before: { state: 'open' },
    after: { state: 'closed' },
    batchId: 'J-000012',
  },
  {
    ...base,
    id: 'AU-1',
    action: 'exception.detect',
    actor: { type: 'system', id: 'close-checks', name: 'Close checks' },
    after: { type: 'cashBreak', status: 'new' },
  },
];

export const Timeline: StoryObj = {
  render: () => <AuditTimeline events={events} className="max-w-xl rounded-md border" />,
};
export const AcrossRecords: StoryObj = {
  render: () => <AuditTimeline events={events} showRecord className="max-w-xl rounded-md border" />,
};
