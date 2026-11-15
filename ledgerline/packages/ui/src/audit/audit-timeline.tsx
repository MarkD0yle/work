import type { ActorRef, AuditEvent } from '@ledgerline/contracts';
import { Lock } from 'lucide-react';
import { formatTimestamp } from '../financial/provenance';
import { cn } from '../lib/cn';

const ACTOR_TYPE: Record<ActorRef['type'], string> = {
  user: 'User',
  system: 'System',
  job: 'Job',
  interface: 'Interface',
  external: 'External',
  agent: 'Agent',
};
const NOTE_LABELS: Record<NonNullable<AuditEvent['note']>['kind'], string> = {
  comment: 'Note',
  overrideJustification: 'Reason',
  failureReason: 'Why it failed',
  approvalNote: 'Approval note',
  warningAcknowledged: 'Warning acknowledged',
};

/** Turns an action id into words: "period.reopen.request" reads "Period reopen request". */
export function describeAction(action: string, labels: Record<string, string> = {}): string {
  if (labels[action]) return labels[action];
  const words = action
    .split('.')
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
const humanise = (field: string) => {
  const words = field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const shown = (value: unknown): string =>
  value === null || value === undefined || value === ''
    ? 'none'
    : Array.isArray(value)
      ? value.map(shown).join(', ') || 'none'
      : typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>)
            .map(([k, v]) => `${humanise(k)}: ${shown(v)}`)
            .join(', ')
        : String(value);

/** Fields that differ between before and after. An event with no "before" lists what it recorded. */
export function auditChanges(event: AuditEvent): { field: string; before?: string; after: string }[] {
  const after = event.after ?? {};
  if (!event.before) return Object.keys(after).map((field) => ({ field, after: shown(after[field]) }));
  const before = event.before;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .map((field) => ({ field, before: shown(before[field]), after: shown(after[field]) }));
}

/** Who acted, with the kind of actor. An agent always shows the person it acted for. */
export function ActorLabel({ actor }: { actor: ActorRef }) {
  return (
    <span data-slot="audit-actor" data-actor-type={actor.type}>
      {actor.name}
      {actor.type === 'user' ? '' : ` (${ACTOR_TYPE[actor.type].toLowerCase()})`}
      {actor.onBehalfOf ? `, on behalf of ${actor.onBehalfOf.name}` : ''}
    </span>
  );
}

export interface AuditTimelineProps {
  events: AuditEvent[];
  /** Plain-language names for action ids and field names. Anything not listed is put into words automatically. */
  actionLabels?: Record<string, string>;
  fieldLabels?: Record<string, string>;
  /** Show which record each event belongs to. Off for the history of a single record. */
  showRecord?: boolean;
  className?: string;
}

/**
 * Audit events, newest first (SPEC 7.10): who (and what kind of actor), when, the effective date, what changed
 * from and to, the note and the evidence. Events are immutable: each shows a lock, and nothing here edits or deletes.
 */
export function AuditTimeline({
  events,
  actionLabels = {},
  fieldLabels = {},
  showRecord = false,
  className,
}: AuditTimelineProps) {
  return (
    <ol
      aria-label="History, newest first"
      data-slot="audit-timeline"
      className={cn('flex flex-col', className)}
    >
      {events.map((event) => {
        const changed = auditChanges(event);
        return (
          <li key={event.id} className="border-b px-4 py-3 last:border-b-0">
            <p className="flex items-center gap-1.5 font-medium">
              {describeAction(event.action, actionLabels)}
              {event.immutable ? (
                <span
                  title="This event cannot be edited or deleted."
                  className="inline-flex items-center gap-1 text-2xs font-normal text-muted-foreground"
                >
                  <Lock aria-hidden className="size-3" />
                  Locked
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              <ActorLabel actor={event.actor} /> ·{' '}
              <time dateTime={event.at}>{formatTimestamp(event.at)}</time>
              {event.effectiveDate ? ` · effective ${event.effectiveDate}` : ''}
              {showRecord ? (
                <>
                  {' '}
                  · {humanise(event.recordRef.type)} <span className="font-mono">{event.recordRef.id}</span>
                </>
              ) : null}
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
                    <dt className="text-muted-foreground">{fieldLabels[c.field] ?? humanise(c.field)}</dt>
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
