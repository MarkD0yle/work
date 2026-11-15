/**
 * Approval Queue (SPEC 8.5): maker-checker for reopens and close-block overrides.
 * The maker can never decide their own request. A rejection goes back to the maker with the note.
 */
import type {
  ApprovalRequest,
  BulkResult,
  CloseType,
  GridResponse,
  Message,
  PeriodState,
  User,
} from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { actorOf, writeAudit } from '../lib/audit';
import { buildGridQuery, runGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';
import { createCloseService, toApproval } from './close';

const FIELDS: Record<string, FieldSpec> = {
  id: { sql: 'a.id', type: 'text' },
  actionId: { sql: 'a.action_id', type: 'text' },
  status: { sql: 'a.status', type: 'text' },
  makerId: { sql: "json_extract(a.maker, '$.id')", type: 'text' },
  maker: { sql: "json_extract(a.maker, '$.name')", type: 'text' },
  requestedAt: { sql: 'a.requested_at', type: 'text' },
  record: { sql: "json_extract(a.record_refs, '$[0].id')", type: 'text' },
};
type Raw = Parameters<typeof toApproval>[0];

export function registerApprovalRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  const sqlite = db.$client;
  const close = createCloseService(db, clock);
  const SOD = (maker: string): Message => ({
    code: 'LL-APR-0001',
    severity: 'error',
    level: 'operation',
    text: `You made this request, so you cannot decide it. Approvals need a second person (segregation of duties).`,
    fix: `Ask another approver to decide it. ${maker} cannot approve their own request.`,
  });

  // Approvers see every request. Everyone else sees the ones they made, so a rejection reaches its maker.
  app.post(`${base}/approvals/query`, async (request): Promise<GridResponse<ApprovalRequest>> => {
    const query = schemas.gridQuery.parse(request.body);
    const approver = sqlite
      .prepare("SELECT allowed FROM permissions WHERE user_id = ? AND action = 'approval.decide'")
      .get(request.user.id) as { allowed: number } | undefined;
    const built = buildGridQuery(query, {
      fields: FIELDS,
      defaultSort: { sql: 'a.requested_at', dir: 'DESC' },
      tieBreak: 'a.id',
      today: clock.today,
      ...(approver?.allowed
        ? {}
        : { scope: { sql: "json_extract(a.maker, '$.id') = ?", params: [request.user.id] } }),
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like, like, like);
        return "a.id LIKE ? ESCAPE '\\' OR a.reason LIKE ? ESCAPE '\\' OR a.record_refs LIKE ? ESCAPE '\\'";
      },
    });
    return runGridQuery<Raw, ApprovalRequest>(sqlite, {
      select: 'SELECT a.*',
      from: 'FROM approvals a',
      built,
      asOf: clock.now(),
      map: toApproval,
    });
  });

  /** Decides one request. Returns the message when it cannot be decided, otherwise null. */
  function decide(
    user: User,
    id: string,
    decision: 'approve' | 'reject',
    note: string,
    batchId?: string,
  ): Message | 'skipped' | null {
    const raw = sqlite.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Raw | undefined;
    if (!raw)
      return {
        code: 'LL-APR-0404',
        severity: 'error',
        level: 'row',
        text: `There is no approval request ${id}.`,
        fix: 'It may have been withdrawn.',
        target: id,
      };
    const approval = toApproval(raw);
    if (approval.status !== 'pending') return 'skipped';
    // Business rule 9: a user cannot approve (or reject) their own request.
    if (approval.maker.id === user.id) return { ...SOD(approval.maker.name), target: id };
    const checker = actorOf(user);
    const at = clock.now();
    const status = decision === 'approve' ? 'approved' : 'rejected';
    sqlite
      .prepare('UPDATE approvals SET status = ?, checker = ?, decided_at = ?, note = ? WHERE id = ?')
      .run(status, JSON.stringify(checker), at, note || null, id);
    const periodId = approval.recordRefs.find((r) => r.type === 'period')?.id;
    writeAudit(db, {
      action: `approval.${decision}`,
      recordType: 'approval',
      recordId: id,
      actor: checker,
      at,
      before: { status: 'pending', maker: approval.maker.name },
      after: {
        status,
        checker: checker.name,
        action: approval.actionId,
        ...(periodId ? { period: periodId } : {}),
      },
      ...(batchId ? { batchId } : {}),
      ...(note ? { note: { kind: 'approvalNote' as const, text: note } } : {}),
    });
    if (!periodId) return null;
    const period = close.period(periodId);
    if (!period) return null;
    if (decision === 'reject' || approval.actionId === 'period.overrideBlock') {
      // The decision is recorded on the period too, so its history shows who allowed or refused what.
      writeAudit(db, {
        action: `${approval.actionId}.${status}`,
        recordType: 'period',
        recordId: periodId,
        actor: checker,
        at,
        before: { approval: id, approvalStatus: 'pending' },
        after: { approval: id, approvalStatus: status, requestedBy: approval.maker.name },
        note: { kind: 'approvalNote', text: note || approval.reason },
      });
      return null;
    }
    if (approval.actionId === 'period.reopen') {
      const wanted = (approval.after?.closes ?? {}) as Record<CloseType, PeriodState>;
      const types = (Object.keys(wanted) as CloseType[]).filter((t) => wanted[t] === 'reopened');
      close.setCloses(period, types, 'reopened', {
        action: 'period.reopen',
        actor: approval.maker,
        note: {
          kind: 'approvalNote',
          text: `${approval.reason} Approved by ${checker.name}${note ? `: ${note}` : '.'}`,
        },
      });
    }
    return null;
  }

  app.post<{ Params: { id: string } }>(
    `${base}/approvals/:id/decide`,
    async (request): Promise<ApprovalRequest> => {
      requirePermission(db, request.user, 'approval.decide');
      const body = schemas.approvalDecision.parse(request.body);
      const note = body.note?.trim() ?? '';
      if (body.decision === 'reject' && !note) {
        throw new HttpError(422, [
          {
            ...problem(
              'LL-APR-0002',
              'A rejection needs a note.',
              'Say why, so the person who asked knows what to change.',
              'note',
            ),
            level: 'field',
          },
        ]);
      }
      return sqlite.transaction(() => {
        const outcome = decide(request.user, request.params.id, body.decision, note);
        if (outcome === 'skipped')
          throw new HttpError(409, [
            problem('LL-APR-0003', 'This request has already been decided.', 'Refresh the queue.'),
          ]);
        if (outcome) throw new HttpError(outcome.code === 'LL-APR-0001' ? 403 : 404, [outcome]);
        return toApproval(
          sqlite.prepare('SELECT * FROM approvals WHERE id = ?').get(request.params.id) as Raw,
        );
      })();
    },
  );

  app.post(`${base}/approvals/decide`, async (request): Promise<BulkResult> => {
    requirePermission(db, request.user, 'approval.decide');
    const body = schemas.approvalDecision.parse(request.body);
    const ids = body.ids ?? [];
    const note = body.note?.trim() ?? '';
    if (ids.length === 0)
      throw new HttpError(400, [
        problem('LL-BLK-0005', 'No requests were selected.', 'Select at least one request.', 'ids'),
      ]);
    if (body.decision === 'reject' && !note) {
      throw new HttpError(422, [
        {
          ...problem(
            'LL-APR-0002',
            'A rejection needs a note.',
            'Say why, so the person who asked knows what to change.',
            'note',
          ),
          level: 'field',
        },
      ]);
    }
    return sqlite.transaction((): BulkResult => {
      const seq =
        (
          sqlite
            .prepare("SELECT count(*) AS n FROM audit_events WHERE action = 'approval.decide.batch'")
            .get() as { n: number }
        ).n + 1;
      const batchId = `AB-${String(seq).padStart(6, '0')}`;
      const result: BulkResult = {
        jobId: batchId,
        status: 'completed',
        succeeded: [],
        failed: [],
        skipped: [],
      };
      for (const id of ids) {
        const outcome = decide(request.user, id, body.decision, note, batchId);
        if (outcome === 'skipped') result.skipped.push({ id, reason: 'Already decided.' });
        else if (outcome) result.failed.push({ id, message: outcome });
        else result.succeeded.push(id);
      }
      writeAudit(db, {
        action: 'approval.decide.batch',
        recordType: 'batch',
        recordId: batchId,
        actor: actorOf(request.user),
        at: clock.now(),
        batchId,
        after: {
          decision: body.decision,
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          skipped: result.skipped.length,
        },
      });
      result.status =
        result.failed.length + result.skipped.length === 0
          ? 'completed'
          : result.succeeded.length === 0
            ? 'failed'
            : 'partial';
      return result;
    })();
  });
}
