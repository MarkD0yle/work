import type { ActorRef, AuditEvent } from '@ledgerline/contracts';
import type { Db } from '../db/client';

export interface AuditInput {
  action: string;
  recordType: string;
  recordId: string;
  actor: ActorRef;
  at: string;
  effectiveDate?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: NonNullable<AuditEvent['note']>;
  /** Shared by every row event of one bulk run, and by the run's own event. */
  batchId?: string;
}

/** Writes one immutable audit event and returns its id. Every data-changing action calls this. */
export function writeAudit(db: Db, event: AuditInput): string {
  const sqlite = db.$client;
  const seq = (sqlite.prepare('SELECT count(*) AS n FROM audit_events').get() as { n: number }).n + 1;
  const id = `AU-${String(seq).padStart(7, '0')}`;
  sqlite
    .prepare(
      `INSERT INTO audit_events (id, action, record_type, record_id, actor, at, effective_date, before, after, note, batch_id, immutable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(
      id,
      event.action,
      event.recordType,
      event.recordId,
      JSON.stringify(event.actor),
      event.at,
      event.effectiveDate ?? null,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
      event.note ? JSON.stringify(event.note) : null,
      event.batchId ?? null,
    );
  return id;
}

export const actorOf = (user: { id: string; name: string }): ActorRef => ({
  type: 'user',
  id: user.id,
  name: user.name,
});
