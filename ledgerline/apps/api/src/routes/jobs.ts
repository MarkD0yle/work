/**
 * Jobs (SPEC 7.11): the grid, one job's detail, retry, cancel, live progress and output downloads.
 * Reports run as jobs and leave a file to download.
 */
import type { GridResponse, Job, User } from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { rowToJob, type JobRunner } from '../jobs/runner';
import { buildGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';

const FIELDS: Record<string, FieldSpec> = {
  id: { sql: 'j.id', type: 'text' },
  type: { sql: 'j.type', type: 'text' },
  status: { sql: 'j.status', type: 'text' },
  name: { sql: 'j.name', type: 'text' },
  submittedAt: { sql: 'j.submitted_at', type: 'text' },
  submittedBy: { sql: "json_extract(j.submitted_by, '$.id')", type: 'text' },
};
export const REPORT_HANDLER = 'report.run';
const ACTIVE = new Set(['queued', 'running']);

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
export const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

/** The data behind each seeded report. Values go out as stored: decimal strings and ISO dates. */
const REPORTS: Record<string, { header: string[]; sql: string; dated: string | null }> = {
  'R-holdings': {
    header: ['Portfolio', 'Security', 'Quantity', 'Market value', 'Currency', 'As of'],
    sql: 'SELECT x.portfolio_id, x.security_id, x.quantity, x.market_value, x.currency, x.as_of FROM positions x WHERE 1 = 1',
    dated: null,
  },
  'R-txn-register': {
    header: [
      'Transaction',
      'Portfolio',
      'Security',
      'Type',
      'Trade date',
      'Settle date',
      'Quantity',
      'Price',
      'Amount',
      'Currency',
      'Status',
    ],
    sql: 'SELECT x.id, x.portfolio_id, x.security_id, x.type, x.trade_date, x.settle_date, x.quantity, x.price, x.amount, x.currency, x.status FROM transactions x WHERE 1 = 1',
    dated: 'x.trade_date',
  },
  'R-cash-ledger': {
    header: ['Cash activity', 'Portfolio', 'Date', 'Amount', 'Currency', 'Applied'],
    sql: 'SELECT x.id, x.portfolio_id, x.date, x.amount, x.currency, x.applied FROM cash_activity x WHERE 1 = 1',
    dated: 'x.date',
  },
  'R-exceptions': {
    header: ['Exception', 'Type', 'Severity', 'Status', 'Portfolio', 'Detected at'],
    sql: "SELECT x.id, x.type, x.severity, x.status, x.portfolio_id, x.detected_at FROM exceptions x WHERE x.status NOT IN ('resolved', 'accepted', 'overridden')",
    dated: null,
  },
};

/** A job without its row-by-row result and log: counts only. Used in lists and live updates. */
export function lighten(job: Job): Job {
  const { result, log: _log, inputs, ...light } = job;
  const { ids, ...rest } = inputs as { ids?: unknown[] } & Record<string, unknown>;
  return {
    ...light,
    inputs: ids ? { ...rest, rowCount: ids.length } : rest,
    ...(result
      ? {
          counts: {
            succeeded: result.succeeded.length,
            failed: result.failed.length,
            skipped: result.skipped.length,
          },
        }
      : {}),
  };
}

export function registerJobRoutes(
  app: FastifyInstance,
  db: Db,
  base: string,
  clock: Clock,
  jobs: JobRunner,
): void {
  const sqlite = db.$client;

  /** Clients see only their own jobs. Everyone else can see the whole queue, as an operations team would. */
  const visible = (user: User, job: Job) => user.segment !== 'client' || job.submittedBy.id === user.id;
  function find(user: User, id: string): Job {
    const job = jobs.get(id);
    if (!job || !visible(user, job))
      throw new HttpError(404, [
        problem('LL-JOB-0404', `Job ${id} was not found.`, 'Check the job id, or open the jobs list.'),
      ]);
    return job;
  }
  function own(user: User, job: Job, verb: string): void {
    if (job.submittedBy.id !== user.id && user.segment !== 'admin') {
      throw new HttpError(403, [
        problem(
          'LL-JOB-0403',
          `Only ${job.submittedBy.name} or an administrator can ${verb} this job.`,
          `Ask ${job.submittedBy.name} to ${verb} it.`,
        ),
      ]);
    }
  }

  // ── Report jobs ─────────────────────────────────────────
  jobs.register(REPORT_HANDLER, {
    items: () => ['report'],
    processItem: (_ctx, item, result) => {
      result.succeeded.push(item);
    },
    finish: (ctx) => {
      const reportId = String(ctx.job.inputs.reportId);
      const report = REPORTS[reportId];
      if (!report)
        throw new HttpError(404, [
          problem('LL-RPT-0404', `There is no report ${reportId}.`, 'Choose a report from the list.'),
        ]);
      const portfolioIds = ((ctx.job.inputs.portfolioIds as string[] | undefined) ?? []).filter(Boolean);
      const asOf = (ctx.job.inputs.asOf as string | undefined) ?? clock.today;
      // A user limited to some portfolios gets only those, whatever was asked for.
      const scope = ctx.user.blotterScope;
      const wanted = scope
        ? portfolioIds.length
          ? portfolioIds.filter((p) => scope.includes(p))
          : scope
        : portfolioIds;
      const params: unknown[] = [];
      let sql = report.sql;
      if (scope || wanted.length) {
        sql += ` AND x.portfolio_id IN (${wanted.map(() => '?').join(', ') || 'NULL'})`;
        params.push(...wanted);
      }
      if (report.dated) {
        sql += ` AND ${report.dated} <= ?`;
        params.push(asOf);
      }
      const rows = sqlite
        .prepare(`${sql} ORDER BY 1 LIMIT 50000`)
        .raw()
        .all(...params) as unknown[][];
      ctx.log('info', `${rows.length.toLocaleString('en-US')} rows as of ${asOf}.`);
      return {
        outputs: [
          {
            name: `${reportId.slice(2)}-${asOf}.csv`,
            contentType: 'text/csv',
            content: toCsv(report.header, rows),
          },
        ],
      };
    },
  });

  app.get(`${base}/reports`, async (request) => {
    requirePermission(db, request.user, 'report.run');
    return sqlite.prepare('SELECT id, name, description FROM reports ORDER BY name').all() as {
      id: string;
      name: string;
      description: string;
    }[];
  });

  app.post<{ Params: { id: string } }>(`${base}/reports/:id/run`, async (request, reply): Promise<Job> => {
    requirePermission(db, request.user, 'report.run');
    const report = sqlite.prepare('SELECT id, name FROM reports WHERE id = ?').get(request.params.id) as
      { id: string; name: string } | undefined;
    if (!report || !REPORTS[report.id])
      throw new HttpError(404, [
        problem('LL-RPT-0404', `There is no report ${request.params.id}.`, 'Choose a report from the list.'),
      ]);
    const body = schemas.reportRun.parse(request.body ?? {});
    reply.code(202);
    return jobs.submit({
      type: 'report',
      name: report.name,
      user: request.user,
      handler: REPORT_HANDLER,
      inputs: {
        reportId: report.id,
        asOf: body.asOf ?? clock.today,
        ...(body.portfolioIds?.length ? { portfolioIds: body.portfolioIds } : {}),
      },
    });
  });

  // ── Jobs ────────────────────────────────────────────────
  app.post(`${base}/jobs/query`, async (request): Promise<GridResponse<Job>> => {
    const query = schemas.gridQuery.parse(request.body);
    const built = buildGridQuery(query, {
      fields: FIELDS,
      defaultSort: { sql: 'j.submitted_at', dir: 'DESC' },
      tieBreak: 'j.id',
      today: clock.today,
      ...(request.user.segment === 'client'
        ? { scope: { sql: "json_extract(j.submitted_by, '$.id') = ?", params: [request.user.id] } }
        : {}),
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like, like);
        return "j.id LIKE ? ESCAPE '\\' OR j.name LIKE ? ESCAPE '\\'";
      },
    });
    const rows = sqlite
      .prepare(`SELECT j.* FROM jobs j ${built.where} ${built.orderBy} LIMIT ? OFFSET ?`)
      .all(...built.params, built.limit, built.offset) as Record<string, unknown>[];
    const total = sqlite.prepare(`SELECT count(*) AS n FROM jobs j ${built.where}`).get(...built.params) as {
      n: number;
    };
    // The list carries counts, not every row result: a 5,000-row job would make the list heavy. Detail has them all.
    return {
      rows: rows.map(rowToJob).map(lighten),
      totalRows: total.n,
      asOf: clock.now(),
    };
  });

  app.get<{ Params: { id: string } }>(`${base}/jobs/:id`, async (request): Promise<Job> => {
    const job = find(request.user, request.params.id);
    const result = job.result;
    return {
      ...job,
      ...(result
        ? {
            counts: {
              succeeded: result.succeeded.length,
              failed: result.failed.length,
              skipped: result.skipped.length,
            },
          }
        : {}),
    };
  });

  app.post<{ Params: { id: string } }>(`${base}/jobs/:id/cancel`, async (request): Promise<Job> => {
    const job = find(request.user, request.params.id);
    own(request.user, job, 'cancel');
    if (!ACTIVE.has(job.status)) {
      throw new HttpError(409, [
        problem(
          'LL-JOB-0001',
          `This job is ${job.status}, so there is nothing to cancel.`,
          'Rows already done stay done. To undo them, use the matching action.',
        ),
      ]);
    }
    return jobs.cancel(job.id) as Job;
  });

  // Retry uses the original inputs: nothing is typed again. For row jobs, only rows that failed (or were never reached) run.
  app.post<{ Params: { id: string } }>(`${base}/jobs/:id/retry`, async (request, reply): Promise<Job> => {
    const job = find(request.user, request.params.id);
    own(request.user, job, 'retry');
    if (ACTIVE.has(job.status))
      throw new HttpError(409, [
        problem('LL-JOB-0002', 'This job is still running.', 'Wait for it to finish, or cancel it first.'),
      ]);
    const handler =
      (job.inputs.handler as string | undefined) ?? (job.inputs.reportId ? REPORT_HANDLER : undefined);
    if (!handler)
      throw new HttpError(409, [
        problem(
          'LL-JOB-0003',
          'This kind of job cannot be retried from here.',
          'Start it again from the screen it came from.',
        ),
      ]);
    const ids = job.inputs.ids as string[] | undefined;
    let inputs: Record<string, unknown> = { ...job.inputs, retryOf: job.id };
    if (ids) {
      const settled = new Set([
        ...(job.result?.succeeded ?? []),
        ...(job.result?.skipped.map((s) => s.id) ?? []),
      ]);
      const again = ids.filter((id) => !settled.has(id));
      if (again.length === 0)
        throw new HttpError(409, [
          problem(
            'LL-JOB-0004',
            'Nothing failed in this job, so there is nothing to retry.',
            'Every row succeeded or was skipped for a stated reason.',
          ),
        ]);
      inputs = { ...inputs, ids: again };
    } else if (job.status === 'completed') {
      throw new HttpError(409, [
        problem(
          'LL-JOB-0004',
          'This job completed, so there is nothing to retry.',
          'Run it again from the screen it came from if you need a fresh result.',
        ),
      ]);
    }
    reply.code(202);
    return jobs.submit({
      type: job.type,
      name: /\(retry\)$/.test(job.name) ? job.name : `${job.name} (retry)`,
      user: request.user,
      handler,
      inputs,
    });
  });

  app.get<{ Params: { id: string; idx: string } }>(
    `${base}/jobs/:id/outputs/:idx`,
    async (request, reply) => {
      const job = find(request.user, request.params.id);
      const row = sqlite
        .prepare('SELECT name, content_type, content FROM job_outputs WHERE job_id = ? AND idx = ?')
        .get(job.id, Number(request.params.idx)) as
        { name: string; content_type: string; content: string } | undefined;
      if (!row)
        throw new HttpError(404, [
          problem(
            'LL-JOB-0405',
            'That file is no longer available.',
            'Run the report again to get a fresh copy.',
          ),
        ]);
      const text = row.content_type.startsWith('text/');
      return reply
        .header('Content-Type', text ? `${row.content_type}; charset=utf-8` : row.content_type)
        .header('Content-Disposition', `attachment; filename="${row.name}"`)
        .send(text ? row.content : Buffer.from(row.content, 'base64'));
    },
  );

  // Live progress as server-sent events: one event per job change, for the signed-in user's own jobs.
  app.get(`${base}/jobs/stream`, (request, reply) => {
    const userId = request.user.id;
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(': connected\n\n');
    const send = (job: Job) => {
      if (job.submittedBy.id !== userId) return;
      reply.raw.write(`event: job\ndata: ${JSON.stringify(lighten(job))}\n\n`);
    };
    const unsubscribe = jobs.subscribe(send);
    const beat = setInterval(() => reply.raw.write(': keep-alive\n\n'), 20_000);
    request.raw.on('close', () => {
      clearInterval(beat);
      unsubscribe();
    });
  });
}
