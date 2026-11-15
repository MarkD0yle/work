/**
 * Period Close Console (SPEC 8.3): overview, checklist, close as a job, block override, reopen, sign-off
 * and the close package. Close is blocked while a high-severity exception is open, and says which.
 */
import type {
  AccountingPeriod,
  ActorRef,
  ApprovalRequest,
  CloseCheck,
  CloseChecklist,
  CloseSignOff,
  CloseType,
  Comparison,
  ExceptionRecord,
  ExceptionType,
  Job,
  PeriodOverviewRow,
  PeriodState,
  User,
} from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { XLSX_TYPE, type JobRunner } from '../jobs/runner';
import { actorOf, rowToAudit, writeAudit } from '../lib/audit';
import {
  applyBreakRule,
  CLOSE_CHECKS,
  loadBreakRules,
  OPEN_SQL,
  TYPE_LABELS,
  type ExceptionRaw,
} from '../lib/exceptions';
import { simplePdf, simpleXlsx, type PdfLine } from '../lib/files';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';

export const CLOSE_HANDLER = 'period.close';
export const PACKAGE_HANDLER = 'period.package';
const CLOSE_TYPES: CloseType[] = ['transaction', 'valuation', 'bankAccount', 'generalLedger'];
const CLOSE_LABELS: Record<CloseType, string> = {
  transaction: 'Transaction',
  valuation: 'Valuation',
  bankAccount: 'Bank account',
  generalLedger: 'General ledger',
};

interface PeriodRaw {
  id: string;
  portfolio_id: string;
  portfolio_name: string;
  period_end: string;
  cutoff: string;
  state: PeriodState;
  closes: string;
  version: number;
}
interface ApprovalRaw {
  id: string;
  action_id: string;
  record_refs: string;
  maker: string;
  requested_at: string;
  reason: string;
  before: string | null;
  after: string | null;
  evidence: string | null;
  status: ApprovalRequest['status'];
  checker: string | null;
  decided_at: string | null;
  note: string | null;
}

export function toApproval(raw: ApprovalRaw): ApprovalRequest {
  const json = <T>(text: string | null): T | undefined =>
    text === null ? undefined : (JSON.parse(text) as T);
  const optional = {
    before: json<Record<string, unknown>>(raw.before),
    after: json<Record<string, unknown>>(raw.after),
    evidence: json<ApprovalRequest['evidence']>(raw.evidence),
    checker: json<ActorRef>(raw.checker),
    decidedAt: raw.decided_at ?? undefined,
    note: raw.note ?? undefined,
  };
  return {
    id: raw.id,
    actionId: raw.action_id,
    recordRefs: JSON.parse(raw.record_refs) as ApprovalRequest['recordRefs'],
    maker: JSON.parse(raw.maker) as ActorRef,
    requestedAt: raw.requested_at,
    reason: raw.reason,
    status: raw.status,
    ...(Object.fromEntries(
      Object.entries(optional).filter(([, v]) => v !== undefined),
    ) as Partial<ApprovalRequest>),
  };
}

export function createCloseService(db: Db, clock: Clock) {
  const sqlite = db.$client;
  const PERIOD =
    'SELECT pe.*, p.name AS portfolio_name FROM periods pe JOIN portfolios p ON p.id = pe.portfolio_id';
  const period = (id: string) => sqlite.prepare(`${PERIOD} WHERE pe.id = ?`).get(id) as PeriodRaw | undefined;
  const periodFor = (portfolioId: string, periodEnd: string) =>
    sqlite
      .prepare(`${PERIOD} WHERE pe.portfolio_id = ? AND pe.period_end = ?`)
      .get(portfolioId, periodEnd) as PeriodRaw | undefined;
  const closesOf = (raw: PeriodRaw) => JSON.parse(raw.closes) as Record<CloseType, PeriodState>;
  const toPeriod = (raw: PeriodRaw): AccountingPeriod => ({
    id: raw.id,
    portfolioId: raw.portfolio_id,
    periodEnd: raw.period_end,
    cutoff: raw.cutoff,
    state: raw.state,
    closes: closesOf(raw),
  });

  const openExceptions = (portfolioId: string, periodEnd: string) =>
    sqlite
      .prepare(
        `SELECT * FROM exceptions WHERE portfolio_id = ? AND period_end = ? AND status IN (${OPEN_SQL}) ORDER BY id`,
      )
      .all(portfolioId, periodEnd) as ExceptionRaw[];
  /** The newest request of one kind for a period. */
  const approvalFor = (periodId: string, actionId: string): ApprovalRequest | undefined => {
    const rows = sqlite
      .prepare('SELECT * FROM approvals WHERE action_id = ? ORDER BY requested_at DESC, id DESC')
      .all(actionId) as ApprovalRaw[];
    const raw = rows.find((r) =>
      (JSON.parse(r.record_refs) as ApprovalRequest['recordRefs']).some((ref) => ref.id === periodId),
    );
    return raw ? toApproval(raw) : undefined;
  };
  const signOffOf = (periodId: string): CloseSignOff | undefined => {
    const row = sqlite.prepare('SELECT * FROM close_sign_offs WHERE period_id = ?').get(periodId) as
      | {
          period_id: string;
          signed_by: string;
          at: string;
          note: string | null;
          package_job_id: string | null;
        }
      | undefined;
    return row
      ? {
          periodId: row.period_id,
          signedBy: JSON.parse(row.signed_by) as ActorRef,
          at: row.at,
          ...(row.note ? { note: row.note } : {}),
          ...(row.package_job_id ? { packageJobId: row.package_job_id } : {}),
        }
      : undefined;
  };

  function checks(open: ExceptionRaw[]): CloseCheck[] {
    return CLOSE_CHECKS.map((check) => {
      const mine = open.filter((x) => check.exceptionTypes.includes(x.type));
      const high = mine.filter((x) => x.severity === 'high').length;
      return {
        ...check,
        open: mine.length,
        high,
        status: high ? 'blocked' : mine.length ? 'warning' : 'passed',
      };
    });
  }

  function checklist(raw: PeriodRaw): CloseChecklist {
    const open = openExceptions(raw.portfolio_id, raw.period_end);
    const override = approvalFor(raw.id, 'period.overrideBlock');
    const reopen = approvalFor(raw.id, 'period.reopen');
    const signOff = signOffOf(raw.id);
    return {
      period: toPeriod(raw),
      portfolio: { kind: 'portfolio', id: raw.portfolio_id, label: raw.portfolio_name },
      checks: checks(open),
      blocking: open
        .filter((x) => x.severity === 'high')
        .map((x) => ({
          id: x.id,
          type: x.type,
          label: `${TYPE_LABELS[x.type]}: ${(JSON.parse(x.record_ref) as ExceptionRecord['recordRef']).label}`,
          ...(x.owner ? { owner: JSON.parse(x.owner) as ActorRef } : {}),
        })),
      ...(override ? { override } : {}),
      ...(reopen?.status === 'pending' ? { reopen } : {}),
      ...(signOff ? { signOff } : {}),
    };
  }

  function overview(periodEnd: string, controllerId?: string): PeriodOverviewRow[] {
    const rows = sqlite
      .prepare(
        `${PERIOD} WHERE pe.period_end = ? ${controllerId ? 'AND p.controller_id = ?' : ''} ORDER BY pe.portfolio_id`,
      )
      .all(...(controllerId ? [periodEnd, controllerId] : [periodEnd])) as PeriodRaw[];
    const open = sqlite
      .prepare(
        `SELECT portfolio_id, type, severity FROM exceptions WHERE period_end = ? AND status IN (${OPEN_SQL})`,
      )
      .all(periodEnd) as Pick<ExceptionRaw, 'portfolio_id' | 'type' | 'severity'>[];
    const byPortfolio = new Map<string, typeof open>();
    for (const x of open) byPortfolio.set(x.portfolio_id, [...(byPortfolio.get(x.portfolio_id) ?? []), x]);
    return rows.map((raw) => {
      const mine = (byPortfolio.get(raw.portfolio_id) ?? []) as ExceptionRaw[];
      const list = checks(mine);
      const override = approvalFor(raw.id, 'period.overrideBlock');
      const signOff = signOffOf(raw.id);
      return {
        periodId: raw.id,
        portfolio: { kind: 'portfolio', id: raw.portfolio_id, label: raw.portfolio_name },
        periodEnd: raw.period_end,
        cutoff: raw.cutoff,
        state: raw.state,
        closes: closesOf(raw),
        checksPassed: list.filter((c) => c.status === 'passed').length,
        checksTotal: list.length,
        blocking: mine.filter((x) => x.severity === 'high').length,
        openExceptions: mine.length,
        ...(override ? { overrideStatus: override.status } : {}),
        ...(signOff ? { signOff } : {}),
      };
    });
  }

  /** Changes close states and writes the audit event. Used by the close job and by an approved reopen. */
  function setCloses(
    raw: PeriodRaw,
    types: CloseType[],
    to: PeriodState,
    audit: {
      action: string;
      actor: ActorRef;
      batchId?: string;
      note?: { kind: 'comment' | 'overrideJustification' | 'approvalNote'; text: string };
    },
  ): void {
    const before = closesOf(raw);
    const after = { ...before, ...Object.fromEntries(types.map((t) => [t, to])) } as Record<
      CloseType,
      PeriodState
    >;
    const values = Object.values(after);
    const state: PeriodState = values.every((v) => v === 'closed')
      ? 'closed'
      : values.some((v) => v === 'reopened')
        ? 'reopened'
        : values.some((v) => v === 'closed')
          ? 'closing'
          : 'open';
    sqlite
      .prepare('UPDATE periods SET closes = ?, state = ?, version = version + 1 WHERE id = ?')
      .run(JSON.stringify(after), state, raw.id);
    // A reopened period needs signing off again once it is closed.
    if (to === 'reopened') sqlite.prepare('DELETE FROM close_sign_offs WHERE period_id = ?').run(raw.id);
    writeAudit(db, {
      action: audit.action,
      recordType: 'period',
      recordId: raw.id,
      actor: audit.actor,
      at: clock.now(),
      effectiveDate: raw.period_end,
      before: { state: raw.state, closes: before },
      after: { state, closes: after },
      ...(audit.batchId ? { batchId: audit.batchId } : {}),
      ...(audit.note ? { note: audit.note } : {}),
    });
  }

  return {
    period,
    periodFor,
    toPeriod,
    closesOf,
    checklist,
    overview,
    openExceptions,
    approvalFor,
    signOffOf,
    setCloses,
  };
}

export function registerCloseRoutes(
  app: FastifyInstance,
  db: Db,
  base: string,
  clock: Clock,
  jobs: JobRunner,
): void {
  const sqlite = db.$client;
  const close = createCloseService(db, clock);
  const need = (id: string) => {
    const raw = close.period(id);
    if (!raw)
      throw new HttpError(404, [
        problem('LL-PER-0404', `There is no period ${id}.`, 'Open the close console and choose a portfolio.'),
      ]);
    return raw;
  };
  const nextApprovalId = () => {
    const max =
      (
        sqlite.prepare('SELECT max(CAST(substr(id, 4) AS INTEGER)) AS n FROM approvals').get() as {
          n: number | null;
        }
      ).n ?? 0;
    return `AP-${String(max + 1).padStart(6, '0')}`;
  };
  const requestApproval = (
    user: User,
    input: {
      actionId: string;
      periodId: string;
      reason: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    },
  ): ApprovalRequest => {
    const id = nextApprovalId();
    const maker = actorOf(user);
    const at = clock.now();
    sqlite
      .prepare(
        "INSERT INTO approvals (id, action_id, record_refs, maker, requested_at, reason, before, after, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
      )
      .run(
        id,
        input.actionId,
        JSON.stringify([{ type: 'period', id: input.periodId }]),
        JSON.stringify(maker),
        at,
        input.reason,
        JSON.stringify(input.before),
        JSON.stringify(input.after),
      );
    writeAudit(db, {
      action: `${input.actionId}.request`,
      recordType: 'period',
      recordId: input.periodId,
      actor: maker,
      at,
      before: input.before,
      after: { ...input.after, approval: id, approvalStatus: 'pending' },
      note: { kind: 'overrideJustification', text: input.reason },
    });
    return close.approvalFor(input.periodId, input.actionId) as ApprovalRequest;
  };

  app.get<{ Querystring: { periodEnd?: string; scope?: string } }>(
    `${base}/periods/overview`,
    async (request): Promise<PeriodOverviewRow[]> => {
      requirePermission(db, request.user, 'period.view');
      const periodEnd =
        request.query.periodEnd ??
        (
          sqlite.prepare("SELECT max(period_end) AS p FROM periods WHERE state <> 'closed'").get() as {
            p: string | null;
          }
        ).p ??
        '';
      // "Mine" is the portfolios this user is the controller of. A user who controls none sees them all.
      const owns =
        (
          sqlite
            .prepare('SELECT count(*) AS n FROM portfolios WHERE controller_id = ?')
            .get(request.user.id) as { n: number }
        ).n > 0;
      return close.overview(periodEnd, request.query.scope !== 'all' && owns ? request.user.id : undefined);
    },
  );

  app.get<{ Params: { id: string } }>(
    `${base}/periods/:id/checklist`,
    async (request): Promise<CloseChecklist> => {
      requirePermission(db, request.user, 'period.view');
      return close.checklist(need(request.params.id));
    },
  );

  // ── Close: always a job, so many portfolios close in one run with a result for each ──
  jobs.register(CLOSE_HANDLER, {
    items: (job) => (job.inputs.portfolioIds as string[] | undefined) ?? [],
    processItem: (ctx, portfolioId, result) => {
      requirePermission(db, ctx.user, 'period.close');
      const periodEnd = String(ctx.job.inputs.periodEnd);
      const types = ((ctx.job.inputs.closeTypes as CloseType[] | undefined) ?? CLOSE_TYPES).filter((t) =>
        CLOSE_TYPES.includes(t),
      );
      const raw = close.periodFor(portfolioId, periodEnd);
      const fail = (code: string, text: string, fix: string) =>
        result.failed.push({
          id: portfolioId,
          message: { code, severity: 'error', level: 'row', text, fix, target: portfolioId },
        });
      if (!raw)
        return void fail(
          'LL-PER-0404',
          `${portfolioId} has no period ending ${periodEnd}.`,
          'Check the portfolio and the period.',
        );
      const closes = close.closesOf(raw);
      const todo = types.filter((t) => closes[t] !== 'closed');
      if (todo.length === 0) return void result.skipped.push({ id: portfolioId, reason: 'Already closed.' });
      // Business rule 6: close is blocked while a high-severity exception is open, unless a block override was approved by a second person.
      const blocking = close.openExceptions(portfolioId, periodEnd).filter((x) => x.severity === 'high');
      const override = close.approvalFor(raw.id, 'period.overrideBlock');
      if (blocking.length && override?.status !== 'approved') {
        const named = blocking
          .slice(0, 5)
          .map((x) => `${x.id} (${TYPE_LABELS[x.type]})`)
          .join(', ');
        return void fail(
          'LL-CLS-0001',
          `${raw.portfolio_name} cannot close: ${blocking.length} high-severity ${blocking.length === 1 ? 'exception is' : 'exceptions are'} open: ${named}${blocking.length > 5 ? ' and more' : ''}.`,
          override?.status === 'pending'
            ? `A block override is waiting for approval (${override.id}).`
            : 'Resolve them, or ask for a block override. An override needs a reason and a second approver.',
        );
      }
      close.setCloses(raw, todo, 'closed', {
        action: 'period.close',
        actor: actorOf(ctx.user),
        batchId: ctx.job.id,
        ...(blocking.length && override
          ? {
              note: {
                kind: 'overrideJustification' as const,
                text: `Closed with ${blocking.length} high-severity exception${blocking.length === 1 ? '' : 's'} open. Override ${override.id}: ${override.reason} Approved by ${override.checker?.name ?? 'a second approver'}.`,
              },
            }
          : {}),
      });
      ctx.log(
        blocking.length ? 'warn' : 'info',
        `${raw.portfolio_name}: closed ${todo.map((t) => CLOSE_LABELS[t]).join(', ')}${blocking.length ? ' under an approved block override' : ''}.`,
      );
      result.succeeded.push(portfolioId);
    },
    finish: (ctx, result) => {
      writeAudit(db, {
        action: 'period.close.batch',
        recordType: 'batch',
        recordId: ctx.job.id,
        actor: actorOf(ctx.user),
        at: clock.now(),
        batchId: ctx.job.id,
        after: {
          periodEnd: ctx.job.inputs.periodEnd,
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          skipped: result.skipped.length,
        },
      });
    },
  });

  app.post(`${base}/periods/close`, async (request, reply): Promise<Job> => {
    requirePermission(db, request.user, 'period.close');
    const body = schemas.periodClose.parse(request.body);
    reply.code(202);
    return jobs.submit({
      type: 'periodClose',
      name: `Close ${body.portfolioIds.length} ${body.portfolioIds.length === 1 ? 'portfolio' : 'portfolios'} for ${body.periodEnd}`,
      user: request.user,
      handler: CLOSE_HANDLER,
      inputs: {
        portfolioIds: body.portfolioIds,
        ids: body.portfolioIds,
        periodEnd: body.periodEnd,
        closeTypes: body.closeTypes ?? CLOSE_TYPES,
      },
    });
  });

  // ── Block override and reopen: both ask a second person first ──
  app.post<{ Params: { id: string } }>(
    `${base}/periods/:id/override-block`,
    async (request, reply): Promise<ApprovalRequest> => {
      requirePermission(db, request.user, 'period.overrideBlock');
      const { reason } = schemas.reasonBody.parse(request.body);
      const raw = need(request.params.id);
      const blocking = close
        .openExceptions(raw.portfolio_id, raw.period_end)
        .filter((x) => x.severity === 'high');
      if (blocking.length === 0)
        throw new HttpError(409, [
          problem('LL-CLS-0002', 'Nothing is blocking this close.', 'Close the period in the usual way.'),
        ]);
      if (close.approvalFor(raw.id, 'period.overrideBlock')?.status === 'pending') {
        throw new HttpError(409, [
          problem(
            'LL-CLS-0003',
            'A block override for this period is already waiting for approval.',
            'Ask the approver to decide it, or wait.',
          ),
        ]);
      }
      reply.code(201);
      return sqlite.transaction(() =>
        requestApproval(request.user, {
          actionId: 'period.overrideBlock',
          periodId: raw.id,
          reason,
          before: { blockedBy: blocking.map((x) => x.id) },
          after: { closeAllowedWith: blocking.map((x) => x.id) },
        }),
      )();
    },
  );

  app.post(`${base}/periods/reopen`, async (request, reply): Promise<ApprovalRequest> => {
    requirePermission(db, request.user, 'period.reopen');
    const body = schemas.periodReopen.parse(request.body);
    const raw = need(body.periodId);
    const closes = close.closesOf(raw);
    const types = (body.closeTypes ?? CLOSE_TYPES).filter((t) => closes[t] === 'closed');
    if (types.length === 0)
      throw new HttpError(409, [
        problem(
          'LL-PER-0002',
          'None of those close types is closed, so there is nothing to reopen.',
          'Choose a close type that is closed.',
        ),
      ]);
    if (close.approvalFor(raw.id, 'period.reopen')?.status === 'pending') {
      throw new HttpError(409, [
        problem(
          'LL-PER-0003',
          'A reopen for this period is already waiting for approval.',
          'Ask the approver to decide it, or wait.',
        ),
      ]);
    }
    reply.code(201);
    return sqlite.transaction(() =>
      requestApproval(request.user, {
        actionId: 'period.reopen',
        periodId: raw.id,
        reason: body.reason,
        before: { closes },
        after: { closes: { ...closes, ...Object.fromEntries(types.map((t) => [t, 'reopened'])) } },
      }),
    )();
  });

  app.post<{ Params: { id: string } }>(
    `${base}/periods/:id/signoff`,
    async (request): Promise<CloseSignOff> => {
      requirePermission(db, request.user, 'period.signoff');
      const { note } = schemas.noteBody.parse(request.body ?? {});
      const raw = need(request.params.id);
      if (raw.state !== 'closed') {
        throw new HttpError(409, [
          problem(
            'LL-CLS-0004',
            `${raw.portfolio_name} is ${raw.state}, so it cannot be signed off yet.`,
            'Close every close type first.',
          ),
        ]);
      }
      const actor = actorOf(request.user);
      const at = clock.now();
      sqlite.transaction(() => {
        sqlite
          .prepare(
            'INSERT INTO close_sign_offs (period_id, signed_by, at, note) VALUES (?, ?, ?, ?) ON CONFLICT (period_id) DO UPDATE SET signed_by = excluded.signed_by, at = excluded.at, note = excluded.note',
          )
          .run(raw.id, JSON.stringify(actor), at, note?.trim() || null);
        writeAudit(db, {
          action: 'period.signoff',
          recordType: 'period',
          recordId: raw.id,
          actor,
          at,
          effectiveDate: raw.period_end,
          before: { signedOff: false },
          after: { signedOff: true, signedBy: actor.name },
          ...(note?.trim() ? { note: { kind: 'comment' as const, text: note.trim() } } : {}),
        });
      })();
      return close.signOffOf(raw.id) as CloseSignOff;
    },
  );

  // ── Close package: checklist results, exceptions accepted or overridden with reasons, audit summary ──
  jobs.register(PACKAGE_HANDLER, {
    items: () => ['package'],
    processItem: (_ctx, item, result) => void result.succeeded.push(item),
    finish: (ctx) => {
      const raw = need(String(ctx.job.inputs.periodId));
      const list = close.checklist(raw);
      const signOff = list.signOff;
      const settled = sqlite
        .prepare(
          "SELECT * FROM exceptions WHERE portfolio_id = ? AND period_end = ? AND status IN ('resolved', 'acceptedConditionally', 'overridden') ORDER BY id",
        )
        .all(raw.portfolio_id, raw.period_end) as ExceptionRaw[];
      const audit = (
        sqlite
          .prepare(
            "SELECT * FROM audit_events WHERE record_type = 'period' AND record_id = ? ORDER BY at, id",
          )
          .all(raw.id) as Record<string, string | number | null>[]
      ).map(rowToAudit);
      const closes = close.closesOf(raw);

      const checkRows = list.checks.map((c) => [
        c.label,
        c.status === 'passed' ? 'Passed' : c.status === 'blocked' ? 'Blocked' : 'Open items',
        String(c.open),
        String(c.high),
        c.catches,
      ]);
      const exceptionRows = settled.map((x) => [
        x.id,
        TYPE_LABELS[x.type],
        x.severity,
        x.status,
        x.root_cause_category ?? '',
        x.root_cause ?? '',
      ]);
      const openRows = list.blocking.map((b) => [b.id, b.label, b.owner?.name ?? 'Unassigned']);
      const auditRows = audit.map((e) => [e.at, e.action, e.actor.name, e.note?.text ?? '']);

      const lines: PdfLine[] = [
        { text: `Close package: ${raw.portfolio_name} (${raw.portfolio_id})`, heading: true },
        {
          text: `Period ending ${raw.period_end}. Status: ${raw.state}. Produced ${clock.now()} by ${ctx.user.name}.`,
        },
        {
          text: signOff
            ? `Signed off by ${signOff.signedBy.name} at ${signOff.at}${signOff.note ? `: ${signOff.note}` : '.'}`
            : 'Not signed off.',
        },
        { text: '' },
        { text: 'Close status by type', heading: true },
        ...CLOSE_TYPES.map((t) => ({ text: `${CLOSE_LABELS[t]}: ${closes[t]}` })),
        { text: '' },
        { text: 'Checklist', heading: true },
        ...checkRows.map((r) => ({ text: `${r[1]} - ${r[0]} (${r[2]} open, ${r[3]} high)` })),
        { text: '' },
        { text: `Exceptions resolved, accepted or overridden (${settled.length})`, heading: true },
        ...(exceptionRows.length
          ? exceptionRows.map((r) => ({ text: `${r[0]} ${r[1]} [${r[3]}] ${r[5]}`.slice(0, 118) }))
          : [{ text: 'None.' }]),
        { text: '' },
        { text: `High-severity exceptions still open (${openRows.length})`, heading: true },
        ...(openRows.length
          ? openRows.map((r) => ({ text: `${r[0]} ${r[1]} - owner: ${r[2]}`.slice(0, 118) }))
          : [{ text: 'None.' }]),
        { text: '' },
        { text: `Audit summary (${audit.length} events)`, heading: true },
        ...auditRows.map((r) => ({
          text: `${r[0]} ${r[1]} by ${r[2]}${r[3] ? `: ${r[3]}` : ''}`.slice(0, 118),
        })),
      ];
      const workbook = simpleXlsx([
        {
          name: 'Summary',
          rows: [
            ['Portfolio', raw.portfolio_name],
            ['Portfolio id', raw.portfolio_id],
            ['Period ending', raw.period_end],
            ['Status', raw.state],
            ['Signed off by', signOff?.signedBy.name ?? ''],
            ['Signed off at', signOff?.at ?? ''],
            ['Sign-off note', signOff?.note ?? ''],
            ...CLOSE_TYPES.map((t) => [`${CLOSE_LABELS[t]} close`, closes[t]]),
          ],
        },
        { name: 'Checklist', rows: [['Check', 'Result', 'Open', 'High severity', 'Catches'], ...checkRows] },
        {
          name: 'Exceptions settled',
          rows: [['Exception', 'Type', 'Severity', 'Status', 'Root cause', 'Reason'], ...exceptionRows],
        },
        { name: 'Still open', rows: [['Exception', 'What', 'Owner'], ...openRows] },
        { name: 'Audit', rows: [['At', 'Action', 'By', 'Note'], ...auditRows] },
      ]);
      const stem = `close-package-${raw.portfolio_id}-${raw.period_end}`;
      sqlite
        .prepare('UPDATE close_sign_offs SET package_job_id = ? WHERE period_id = ?')
        .run(ctx.job.id, raw.id);
      ctx.log(
        'info',
        `${list.checks.length} checks, ${settled.length} settled exceptions, ${audit.length} audit events.`,
      );
      return {
        outputs: [
          { name: `${stem}.pdf`, contentType: 'application/pdf', content: simplePdf(lines) },
          { name: `${stem}.xlsx`, contentType: XLSX_TYPE, content: workbook },
        ],
      };
    },
  });

  app.post<{ Params: { id: string } }>(
    `${base}/periods/:id/package`,
    async (request, reply): Promise<Job> => {
      requirePermission(db, request.user, 'period.signoff');
      const raw = need(request.params.id);
      if (!close.signOffOf(raw.id))
        throw new HttpError(409, [
          problem(
            'LL-CLS-0005',
            'The close package is produced after sign-off.',
            'Sign off the period first.',
          ),
        ]);
      reply.code(202);
      return jobs.submit({
        type: 'report',
        name: `Close package: ${raw.portfolio_name} ${raw.period_end}`,
        user: request.user,
        handler: PACKAGE_HANDLER,
        inputs: { periodId: raw.id, periodEnd: raw.period_end, portfolioIds: [raw.portfolio_id] },
      });
    },
  );

  /**
   * Runs the cash-to-custodian check: every unapplied receipt and outstanding wire in the period becomes a cash
   * break, once. New breaks are then offered to the recurring-break rules, which tag matches as proposals.
   */
  app.post(
    `${base}/periods/checks/run`,
    async (request): Promise<{ created: string[]; proposed: string[] }> => {
      requirePermission(db, request.user, 'period.close');
      const body = schemas.checksRun.parse(request.body);
      const monthStart = `${body.periodEnd.slice(0, 8)}01`;
      return sqlite.transaction(() => {
        const cash = sqlite
          .prepare(
            "SELECT * FROM cash_activity WHERE status IN ('unapplied', 'outstanding') AND value_date BETWEEN ? AND ? ORDER BY id",
          )
          .all(monthStart, body.periodEnd) as {
          id: string;
          portfolio_id: string;
          amount: string;
          currency: string;
          status: string;
          reference: string;
        }[];
        let seq =
          (
            sqlite.prepare('SELECT max(CAST(substr(id, 4) AS INTEGER)) AS n FROM exceptions').get() as {
              n: number | null;
            }
          ).n ?? 0;
        const created: string[] = [];
        const at = clock.now();
        const system: ActorRef = { type: 'system', id: 'close-checks', name: 'Close checks' };
        for (const row of cash) {
          if (body.portfolioIds?.length && !body.portfolioIds.includes(row.portfolio_id)) continue;
          const exists = sqlite
            .prepare(
              "SELECT 1 FROM exceptions WHERE type = 'cashBreak' AND period_end = ? AND json_extract(record_ref, '$.id') = ?",
            )
            .get(body.periodEnd, row.id);
          if (exists) continue;
          seq += 1;
          const id = `EX-${String(seq).padStart(6, '0')}`;
          const amount = new Decimal(row.amount).abs();
          const money = (value: string) => ({
            kind: 'currencyAmount',
            value,
            currency: row.currency,
            precision: 2,
            signConvention: 'natural',
            provenance: { origin: 'calculated', source: 'close-checks', asOf: at },
          });
          const type: ExceptionType = 'cashBreak';
          sqlite
            .prepare(
              "INSERT INTO exceptions (id, type, severity, record_ref, portfolio_id, period_end, detected_at, detected_by, owner, status, \"values\", due_by, evidence, thread, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'new', ?, ?, '[]', '[]', 1)",
            )
            .run(
              id,
              type,
              amount.gt(100000) ? 'high' : 'medium',
              JSON.stringify({
                kind: 'cashActivity',
                id: row.id,
                label: `${row.status === 'outstanding' ? 'Outstanding wire' : 'Unapplied receipt'} ${row.reference}`,
              }),
              row.portfolio_id,
              body.periodEnd,
              at,
              JSON.stringify(system),
              JSON.stringify({ expected: money('0.00'), actual: money(amount.toFixed(2)) }),
              body.periodEnd,
            );
          writeAudit(db, {
            action: 'exception.detect',
            recordType: 'exception',
            recordId: id,
            actor: system,
            at,
            effectiveDate: body.periodEnd,
            after: { type, status: 'new', record: row.id },
          });
          created.push(id);
        }
        const proposed = created.length
          ? loadBreakRules(db).flatMap((rule) => applyBreakRule(db, rule, created))
          : [];
        return { created, proposed };
      })();
    },
  );

  // Investment book against accounting book for one portfolio (SPEC 7.9).
  app.post(`${base}/comparisons`, async (request): Promise<Comparison> => {
    requirePermission(db, request.user, 'period.view');
    const body = schemas.comparisonRequest.parse(request.body);
    const positions = sqlite
      .prepare(
        'SELECT x.security_id, x.quantity, x.market_value, x.currency, x.as_of, s.description FROM positions x JOIN securities s ON s.id = x.security_id WHERE x.portfolio_id = ? ORDER BY x.security_id LIMIT 500',
      )
      .all(body.portfolioId) as {
      security_id: string;
      quantity: string;
      market_value: string | null;
      currency: string;
      as_of: string;
      description: string;
    }[];
    // Where a market-value break is open, the accounting book holds the value the break reports.
    const breaks = new Map(
      (
        sqlite
          .prepare(
            `SELECT * FROM exceptions WHERE portfolio_id = ? AND type = 'marketValueBreak' AND status IN (${OPEN_SQL})`,
          )
          .all(body.portfolioId) as ExceptionRaw[]
      ).map((x) => [
        (JSON.parse(x.record_ref) as { id: string }).id,
        x.values ? (JSON.parse(x.values) as NonNullable<ExceptionRecord['values']>).actual?.value : undefined,
      ]),
    );
    const value = (
      kind: 'marketValue' | 'quantity',
      amount: string | null,
      currency: string,
      source: string,
      asOf: string,
    ) => ({
      kind,
      value: amount,
      precision: kind === 'quantity' ? 4 : 2,
      signConvention: 'natural' as const,
      provenance: { origin: 'calculated' as const, source, asOf: `${asOf}T22:00:00Z` },
      ...(kind === 'marketValue' ? { currency } : {}),
      ...(amount === null ? { nullReason: 'missing' as const } : {}),
    });
    return {
      leftLabel: 'Investment book',
      rightLabel: 'Accounting book',
      tolerancePct: '0.5',
      rows: positions.map((p) => ({
        key: p.security_id,
        label: `${p.description} (${p.security_id})`,
        left: value('marketValue', p.market_value, p.currency, 'Investment book', p.as_of),
        right: value(
          'marketValue',
          breaks.has(p.security_id) ? (breaks.get(p.security_id) ?? null) : p.market_value,
          p.currency,
          'Accounting book',
          p.as_of,
        ),
        leftUnits: value('quantity', p.quantity, p.currency, 'Investment book', p.as_of),
        rightUnits: value('quantity', p.quantity, p.currency, 'Accounting book', p.as_of),
      })),
    };
  });
}
