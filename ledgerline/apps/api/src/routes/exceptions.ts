/**
 * Exception Queue (SPEC 8.2): the list, one exception with its thread and evidence, bulk actions,
 * and recurring-break rules. Every resolution writes an audit event with a note.
 */
import type {
  ActorRef,
  BulkResult,
  EvidenceRef,
  ExceptionRecord,
  GridResponse,
  Message,
  RecurringBreakRule,
  User,
} from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { actorOf, writeAudit } from '../lib/audit';
import {
  applyBreakRule,
  loadBreakRules,
  loadToleranceRules,
  OPEN_STATUSES,
  toException,
  type ExceptionRaw,
} from '../lib/exceptions';
import { buildGridQuery, runGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';

const FIELDS: Record<string, FieldSpec> = {
  id: { sql: 'x.id', type: 'text' },
  type: { sql: 'x.type', type: 'text' },
  severity: {
    sql: 'x.severity',
    type: 'text',
    sortSql: "CASE x.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
  },
  status: { sql: 'x.status', type: 'text' },
  portfolioId: { sql: 'x.portfolio_id', type: 'text' },
  portfolio: { sql: 'p.name', type: 'text' },
  periodEnd: { sql: 'x.period_end', type: 'date' },
  detectedAt: { sql: 'x.detected_at', type: 'text' },
  dueBy: { sql: 'x.due_by', type: 'date' },
  ownerId: { sql: "json_extract(x.owner, '$.id')", type: 'text' },
  owner: { sql: "json_extract(x.owner, '$.name')", type: 'text' },
  rootCauseCategory: { sql: 'x.root_cause_category', type: 'text' },
  /** Filter with isNotNull for "proposed by a rule". */
  matchedRuleId: { sql: 'x.matched_rule_id', type: 'text' },
  record: { sql: "json_extract(x.record_ref, '$.label')", type: 'text' },
};
const SELECT = 'SELECT x.*, p.name AS portfolio_name, s.asset_class';
const FROM =
  "FROM exceptions x JOIN portfolios p ON p.id = x.portfolio_id LEFT JOIN securities s ON s.id = json_extract(x.record_ref, '$.id')";

/** What each bulk action needs and does. `closes` actions end the exception; the others leave it open. */
const ACTIONS = {
  'exception.assign': { permission: 'exception.assign', label: 'Assign', closes: false },
  'exception.escalate': { permission: 'exception.assign', label: 'Escalate', closes: false },
  'exception.attachEvidence': { permission: 'exception.resolve', label: 'Attach evidence', closes: false },
  'exception.resolve': { permission: 'exception.resolve', label: 'Resolve', closes: true },
  'exception.accept': { permission: 'exception.resolve', label: 'Accept', closes: true },
  'exception.acceptConditionally': {
    permission: 'exception.resolve',
    label: 'Accept conditionally',
    closes: true,
  },
  'exception.override': { permission: 'exception.resolve', label: 'Override', closes: true },
  'exception.acceptProposal': { permission: 'exception.resolve', label: 'Accept proposal', closes: true },
} as const;
type ActionId = keyof typeof ACTIONS;
const BULK_LIMIT = 1000;
const SEVERITY_UP = { low: 'medium', medium: 'high', high: 'high' } as const;

export function registerExceptionRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  const sqlite = db.$client;
  const one = (id: string) =>
    sqlite.prepare(`${SELECT} ${FROM} WHERE x.id = ?`).get(id) as ExceptionRaw | undefined;
  const missing = (field: string, text: string, fix: string) =>
    new HttpError(422, [{ ...problem('LL-EXC-0001', text, fix, field), level: 'field' }]);

  app.post(`${base}/exceptions/query`, async (request): Promise<GridResponse<ExceptionRecord>> => {
    requirePermission(db, request.user, 'exception.view');
    const query = schemas.gridQuery.parse(request.body);
    const rules = loadToleranceRules(db);
    const built = buildGridQuery(query, {
      fields: FIELDS,
      // Oldest first: age is what matters in a queue (SPEC 8.2).
      defaultSort: { sql: 'x.detected_at', dir: 'ASC' },
      tieBreak: 'x.id',
      today: clock.today,
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like, like, like);
        return "x.id LIKE ? ESCAPE '\\' OR json_extract(x.record_ref, '$.label') LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\'";
      },
    });
    return runGridQuery<ExceptionRaw, ExceptionRecord>(sqlite, {
      select: SELECT,
      from: FROM,
      built,
      asOf: clock.now(),
      map: (raw) => toException(raw, rules),
    });
  });

  app.get(`${base}/exceptions/root-causes`, async (request) => {
    requirePermission(db, request.user, 'exception.view');
    return sqlite.prepare('SELECT id, label FROM root_causes ORDER BY label').all() as {
      id: string;
      label: string;
    }[];
  });

  // ── Recurring-break rules ───────────────────────────────
  app.get(`${base}/exceptions/rules`, async (request): Promise<RecurringBreakRule[]> => {
    requirePermission(db, request.user, 'exception.view');
    return loadBreakRules(db);
  });

  const saveRule = (user: User, id: string | null, body: unknown): RecurringBreakRule => {
    requirePermission(db, user, 'exception.rules');
    const input = schemas.breakRuleInput.parse(body);
    if (!sqlite.prepare('SELECT 1 FROM root_causes WHERE id = ?').get(input.rootCauseCategory)) {
      throw missing(
        'rootCauseCategory',
        `"${input.rootCauseCategory}" is not a root-cause category.`,
        'Choose one from the list.',
      );
    }
    const actor = actorOf(user);
    return sqlite.transaction((): RecurringBreakRule => {
      const before = id ? loadBreakRules(db).find((r) => r.id === id) : undefined;
      if (id && !before)
        throw new HttpError(404, [
          problem('LL-EXC-0404', `There is no rule ${id}.`, 'It may have been deleted.'),
        ]);
      const max =
        (
          sqlite
            .prepare('SELECT max(CAST(substr(id, 5) AS INTEGER)) AS n FROM recurring_break_rules')
            .get() as { n: number | null }
        ).n ?? 0;
      const rule: RecurringBreakRule = {
        id: id ?? `RBR-${String(max + 1).padStart(4, '0')}`,
        name: input.name.trim(),
        match: input.match as RecurringBreakRule['match'],
        rootCauseCategory: input.rootCauseCategory,
        // A rule only ever proposes a resolution. It never resolves by itself.
        proposedActionId: 'exception.resolve',
        createdBy: before?.createdBy ?? actor,
      };
      sqlite
        .prepare(
          'INSERT INTO recurring_break_rules (id, name, match, root_cause_category, proposed_action_id, created_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, match = excluded.match, root_cause_category = excluded.root_cause_category',
        )
        .run(
          rule.id,
          rule.name,
          JSON.stringify(rule.match),
          rule.rootCauseCategory,
          rule.proposedActionId,
          JSON.stringify(rule.createdBy),
        );
      writeAudit(db, {
        action: before ? 'exceptionRule.update' : 'exceptionRule.create',
        recordType: 'exceptionRule',
        recordId: rule.id,
        actor,
        at: clock.now(),
        ...(before
          ? {
              before: { name: before.name, match: before.match, rootCauseCategory: before.rootCauseCategory },
            }
          : {}),
        after: { name: rule.name, match: rule.match, rootCauseCategory: rule.rootCauseCategory },
      });
      return rule;
    })();
  };
  app.post(`${base}/exceptions/rules`, async (request, reply) => {
    reply.code(201);
    return saveRule(request.user, null, request.body);
  });
  app.put<{ Params: { id: string } }>(`${base}/exceptions/rules/:id`, async (request) =>
    saveRule(request.user, request.params.id, request.body),
  );
  app.delete<{ Params: { id: string } }>(`${base}/exceptions/rules/:id`, async (request, reply) => {
    requirePermission(db, request.user, 'exception.rules');
    const before = loadBreakRules(db).find((r) => r.id === request.params.id);
    if (!before)
      throw new HttpError(404, [
        problem('LL-EXC-0404', `There is no rule ${request.params.id}.`, 'It may already have been deleted.'),
      ]);
    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM recurring_break_rules WHERE id = ?').run(before.id);
      writeAudit(db, {
        action: 'exceptionRule.delete',
        recordType: 'exceptionRule',
        recordId: before.id,
        actor: actorOf(request.user),
        at: clock.now(),
        before: { name: before.name, match: before.match },
      });
    })();
    return reply.code(204).send();
  });
  // Applying a rule tags the open exceptions it describes as proposals. Nothing resolves: a person accepts each one.
  app.post<{ Params: { id: string } }>(
    `${base}/exceptions/rules/:id/apply`,
    async (request): Promise<{ tagged: string[] }> => {
      requirePermission(db, request.user, 'exception.rules');
      const rule = loadBreakRules(db).find((r) => r.id === request.params.id);
      if (!rule)
        throw new HttpError(404, [
          problem('LL-EXC-0404', `There is no rule ${request.params.id}.`, 'It may have been deleted.'),
        ]);
      return sqlite.transaction(() => {
        const tagged = applyBreakRule(db, rule);
        const actor = actorOf(request.user);
        for (const id of tagged) {
          writeAudit(db, {
            action: 'exception.propose',
            recordType: 'exception',
            recordId: id,
            actor,
            at: clock.now(),
            before: { matchedRuleId: null },
            after: { matchedRuleId: rule.id, proposedRootCause: rule.rootCauseCategory },
            note: {
              kind: 'comment',
              text: `Tagged by the rule "${rule.name}". Still open: a person must accept the proposal.`,
            },
          });
        }
        return { tagged };
      })();
    },
  );

  // ── One exception ───────────────────────────────────────
  app.get<{ Params: { id: string } }>(`${base}/exceptions/:id`, async (request): Promise<ExceptionRecord> => {
    requirePermission(db, request.user, 'exception.view');
    const raw = one(request.params.id);
    if (!raw)
      throw new HttpError(404, [
        problem(
          'LL-EXC-0404',
          `There is no exception ${request.params.id}.`,
          'Check the id, or open the exception queue.',
        ),
      ]);
    return toException(raw, loadToleranceRules(db));
  });

  // The thread stays with the exception, so the discussion needs no email (SPEC 8.2).
  app.post<{ Params: { id: string } }>(
    `${base}/exceptions/:id/thread`,
    async (request): Promise<ExceptionRecord> => {
      requirePermission(db, request.user, 'exception.view');
      const { text } = schemas.threadComment.parse(request.body);
      const raw = one(request.params.id);
      if (!raw)
        throw new HttpError(404, [
          problem('LL-EXC-0404', `There is no exception ${request.params.id}.`, 'Check the id.'),
        ]);
      const thread = JSON.parse(raw.thread) as ExceptionRecord['thread'];
      const at = clock.now();
      const entry = {
        id: `${raw.id}-C${String(thread.length + 1).padStart(3, '0')}`,
        author: actorOf(request.user),
        at,
        text: text.trim(),
      };
      sqlite.transaction(() => {
        sqlite
          .prepare('UPDATE exceptions SET thread = ?, version = version + 1 WHERE id = ?')
          .run(JSON.stringify([...thread, entry]), raw.id);
        writeAudit(db, {
          action: 'exception.comment',
          recordType: 'exception',
          recordId: raw.id,
          actor: entry.author,
          at,
          before: { comments: thread.length },
          after: { comments: thread.length + 1 },
          note: { kind: 'comment', text: entry.text },
        });
      })();
      return toException(one(raw.id) as ExceptionRaw, loadToleranceRules(db));
    },
  );

  // ── Bulk actions ────────────────────────────────────────
  app.post(`${base}/exceptions/bulk`, async (request): Promise<BulkResult> => {
    const body = schemas.bulkRequest.parse(request.body);
    if (!(body.actionId in ACTIONS)) {
      throw new HttpError(400, [
        problem(
          'LL-BLK-0001',
          `"${body.actionId}" is not an action for exceptions.`,
          `Use one of: ${Object.keys(ACTIONS).join(', ')}.`,
          'actionId',
        ),
      ]);
    }
    const actionId = body.actionId as ActionId;
    const action = ACTIONS[actionId];
    requirePermission(db, request.user, action.permission);
    if (body.ids.length > BULK_LIMIT)
      throw new HttpError(400, [
        problem(
          'LL-BLK-0002',
          `${body.ids.length} exceptions is too many for one run.`,
          `Select ${BULK_LIMIT} or fewer.`,
          'ids',
        ),
      ]);
    const inputs = schemas.exceptionInputs.parse(body.inputs ?? {});
    const note = (inputs.note ?? body.reason ?? '').trim();

    // What each action must be given. A resolution without a note is refused: the audit trail needs the why.
    if (action.closes && actionId !== 'exception.acceptProposal' && !note)
      throw missing('note', `${action.label} needs a note.`, 'Say why. It is recorded in the audit history.');
    if (actionId === 'exception.resolve' && !inputs.rootCauseCategory)
      throw missing(
        'rootCauseCategory',
        'Resolve needs a root cause.',
        'Choose a root-cause category. Free text is extra, not instead.',
      );
    if (
      inputs.rootCauseCategory &&
      !sqlite.prepare('SELECT 1 FROM root_causes WHERE id = ?').get(inputs.rootCauseCategory)
    ) {
      throw missing(
        'rootCauseCategory',
        `"${inputs.rootCauseCategory}" is not a root-cause category.`,
        'Choose one from the list.',
      );
    }
    if (actionId === 'exception.acceptConditionally' && !inputs.challengeRef?.trim())
      throw missing(
        'challengeRef',
        'Accepting conditionally needs the challenge it depends on.',
        'Enter the reference of the vendor or custodian challenge.',
      );
    if (actionId === 'exception.attachEvidence' && !inputs.evidence?.name.trim())
      throw missing(
        'evidence',
        'Choose a file to attach.',
        'Pick the statement or document that supports these exceptions.',
      );
    let owner: ActorRef | undefined;
    if (actionId === 'exception.assign') {
      const row = inputs.ownerId
        ? (sqlite.prepare('SELECT id, name FROM users WHERE id = ?').get(inputs.ownerId) as
            { id: string; name: string } | undefined)
        : undefined;
      if (!row) throw missing('ownerId', 'Choose who to assign to.', 'Pick a person from the list.');
      owner = { type: 'user', id: row.id, name: row.name };
    }

    const actor = actorOf(request.user);
    const at = clock.now();
    return sqlite.transaction((): BulkResult => {
      const seq =
        (
          sqlite
            .prepare("SELECT count(*) AS n FROM audit_events WHERE action LIKE 'exception.%.batch'")
            .get() as { n: number }
        ).n + 1;
      const batchId = `XB-${String(seq).padStart(6, '0')}`;
      // One file, however many exceptions it is attached to: the same evidence id on every one.
      const file: EvidenceRef | undefined = inputs.evidence
        ? { type: 'file', id: `F-${batchId}`, label: inputs.evidence.name.trim() }
        : undefined;
      const result: BulkResult = {
        jobId: batchId,
        status: 'completed',
        succeeded: [],
        failed: [],
        skipped: [],
      };
      const fail = (id: string, code: string, text: string, fix: string) => {
        const message: Message = { code, severity: 'error', level: 'row', text, fix, target: id };
        result.failed.push({ id, message });
      };

      for (const id of body.ids) {
        const raw = sqlite.prepare('SELECT * FROM exceptions WHERE id = ?').get(id) as
          ExceptionRaw | undefined;
        if (!raw) {
          fail(id, 'LL-EXC-0404', `Exception ${id} was not found.`, 'It may have been removed.');
          continue;
        }
        if (!OPEN_STATUSES.includes(raw.status)) {
          result.skipped.push({
            id,
            reason: `Already ${raw.status === 'acceptedConditionally' ? 'accepted conditionally' : raw.status}.`,
          });
          continue;
        }
        const proposal = raw.proposal
          ? (JSON.parse(raw.proposal) as NonNullable<ExceptionRecord['proposal']>)
          : undefined;
        if (actionId === 'exception.acceptProposal' && !proposal) {
          result.skipped.push({ id, reason: 'No rule has proposed a resolution for it.' });
          continue;
        }
        const evidence = JSON.parse(raw.evidence) as EvidenceRef[];
        const before = {
          status: raw.status,
          severity: raw.severity,
          owner: raw.owner ? (JSON.parse(raw.owner) as ActorRef).name : null,
          rootCauseCategory: raw.root_cause_category,
          evidence: evidence.length,
        };
        const next = {
          status: raw.status,
          severity: raw.severity,
          owner: raw.owner,
          rootCause: raw.root_cause,
          rootCauseCategory: raw.root_cause_category,
          evidence,
        };
        let text = note;
        switch (actionId) {
          case 'exception.assign':
            next.owner = JSON.stringify(owner);
            if (raw.status === 'new') next.status = 'inProgress';
            break;
          case 'exception.escalate':
            next.severity = SEVERITY_UP[raw.severity];
            next.status = 'waitingOnOthers';
            break;
          case 'exception.attachEvidence':
            next.evidence = [...evidence, file as EvidenceRef];
            text = text || `Attached ${(file as EvidenceRef).label}.`;
            break;
          case 'exception.resolve':
            next.status = 'resolved';
            next.rootCauseCategory = inputs.rootCauseCategory as string;
            next.rootCause = note;
            break;
          case 'exception.accept':
            next.status = 'resolved';
            next.rootCause = `Accepted: ${note}`;
            if (inputs.rootCauseCategory) next.rootCauseCategory = inputs.rootCauseCategory;
            break;
          case 'exception.acceptConditionally':
            next.status = 'acceptedConditionally';
            next.rootCause = `Accepted pending challenge ${inputs.challengeRef as string}: ${note}`;
            next.evidence = [
              ...evidence,
              {
                type: 'link',
                id: (inputs.challengeRef as string).trim(),
                label: `Challenge ${(inputs.challengeRef as string).trim()}`,
              },
            ];
            break;
          case 'exception.override':
            next.status = 'overridden';
            next.rootCause = `Overridden: ${note}`;
            break;
          case 'exception.acceptProposal': {
            const category =
              (proposal?.inputs?.rootCauseCategory as string | undefined) ?? raw.root_cause_category;
            next.status = 'resolved';
            next.rootCauseCategory = category;
            text = text || (proposal?.summary ?? 'Accepted the proposed resolution.');
            next.rootCause = `Proposal accepted. ${text}`;
            break;
          }
        }
        sqlite
          .prepare(
            'UPDATE exceptions SET status = ?, severity = ?, owner = ?, root_cause = ?, root_cause_category = ?, evidence = ?, version = version + 1 WHERE id = ?',
          )
          .run(
            next.status,
            next.severity,
            next.owner,
            next.rootCause,
            next.rootCauseCategory,
            JSON.stringify(next.evidence),
            id,
          );
        writeAudit(db, {
          action: actionId,
          recordType: 'exception',
          recordId: id,
          actor,
          at,
          effectiveDate: raw.period_end,
          before,
          after: {
            status: next.status,
            severity: next.severity,
            owner: next.owner ? (JSON.parse(next.owner) as ActorRef).name : null,
            rootCauseCategory: next.rootCauseCategory,
            evidence: next.evidence.length,
          },
          batchId,
          ...(text
            ? {
                note: {
                  kind:
                    actionId === 'exception.override'
                      ? ('overrideJustification' as const)
                      : ('comment' as const),
                  text,
                },
              }
            : {}),
          ...(file ? { evidence: [file] } : {}),
        });
        result.succeeded.push(id);
      }
      writeAudit(db, {
        action: `${actionId}.batch`,
        recordType: 'batch',
        recordId: batchId,
        actor,
        at,
        batchId,
        after: {
          requested: body.ids.length,
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          skipped: result.skipped.length,
        },
        ...(note ? { note: { kind: 'comment' as const, text: note } } : {}),
        ...(file ? { evidence: [file] } : {}),
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
