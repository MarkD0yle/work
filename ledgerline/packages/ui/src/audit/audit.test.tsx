import type { AuditEvent } from '@ledgerline/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditTimeline, auditChanges, describeAction } from './audit-timeline';

const base = {
  recordRef: { type: 'period', id: 'PER-0011-2026-11' },
  at: '2026-11-14T16:30:00.000Z',
  immutable: true,
} as const;
const events: AuditEvent[] = [
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
    before: { status: 'new', owner: null },
    after: { status: 'resolved', owner: 'Rafa' },
    note: { kind: 'comment', text: 'Receipt applied on the 14th.' },
    evidence: [{ type: 'file', id: 'F-1', label: 'custodian-statement.pdf' }],
  },
  {
    ...base,
    id: 'AU-2',
    action: 'period.close',
    actor: { type: 'user', id: 'u-cleo', name: 'Cleo' },
    effectiveDate: '2026-11-30',
    before: { state: 'open', closes: { transaction: 'open' } },
    after: { state: 'closed', closes: { transaction: 'closed' } },
    batchId: 'J-000012',
  },
  {
    ...base,
    id: 'AU-1',
    action: 'exception.detect',
    actor: { type: 'system', id: 'close-checks', name: 'Close checks' },
    after: { type: 'cashBreak' },
  },
];

describe('AuditTimeline', () => {
  it('agent events show the user they acted on behalf of', () => {
    render(<AuditTimeline events={events} />);
    const [agent, user, system] = screen.getAllByRole('listitem');
    expect(agent?.querySelector('[data-slot="audit-actor"]')).toHaveTextContent(
      'Reconciliation assistant (agent), on behalf of Rafa',
    );
    expect(user?.querySelector('[data-slot="audit-actor"]')).toHaveTextContent(/^Cleo$/);
    expect(system?.querySelector('[data-slot="audit-actor"]')).toHaveTextContent('Close checks (system)');
  });

  it('shows time, effective date, before and after, note, evidence and batch', () => {
    render(<AuditTimeline events={events} />);
    const [agent, close] = screen.getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(within(agent).getByText('Exception resolve')).toBeInTheDocument();
    expect(agent).toHaveTextContent('Statusnew changed to → resolved');
    expect(agent).toHaveTextContent('Ownernone changed to → Rafa');
    expect(agent).toHaveTextContent('Note: Receipt applied on the 14th.');
    expect(agent).toHaveTextContent('Evidence: custodian-statement.pdf');
    expect(close).toHaveTextContent('2026-11-14 16:30 UTC · effective 2026-11-30 · batch J-000012');
    expect(close).toHaveTextContent('ClosesTransaction: open changed to → Transaction: closed');
  });

  it('immutable events show a lock, and nothing offers to edit or delete', () => {
    render(<AuditTimeline events={events} />);
    expect(screen.getAllByText('Locked')).toHaveLength(3);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('names the record when events from several records are shown together', () => {
    render(
      <AuditTimeline events={events.slice(1, 2)} showRecord actionLabels={{ 'period.close': 'Closed' }} />,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('Period PER-0011-2026-11');
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('puts action ids into words and lists only what changed', () => {
    expect(describeAction('period.overrideBlock.request')).toBe('Period override block request');
    expect(auditChanges(events[1] as AuditEvent).map((c) => c.field)).toEqual(['state', 'closes']);
    expect(
      auditChanges({
        ...(events[1] as AuditEvent),
        after: { state: 'open', closes: { transaction: 'open' } },
      }),
    ).toEqual([]);
  });
});
