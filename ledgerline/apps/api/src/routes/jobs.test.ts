import type { BulkResult, GridResponse, Job, Permission, PreviewRow } from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { migrateDb, openDb, type Db } from '../db/client';
import { seed } from '../db/seed';
import { JobRunner } from '../jobs/runner';
import * as schemas from '../schemas/index';

let db: Db;
let app: ReturnType<typeof buildApp>;
const clock = { today: '2026-11-14', now: () => '2026-11-14T16:30:00.000Z' };
beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  seed(db, 'small');
  app = buildApp(db, clock);
});
afterAll(() => app.close());

const call = (method: 'GET' | 'POST', url: string, payload?: unknown, userId = 'u-ada') =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { 'x-ll-user': userId },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
const idsWhere = (where: string, limit: number) =>
  (
    db.$client.prepare(`select id from transactions where ${where} order by id limit ?`).all(limit) as {
      id: string;
    }[]
  ).map((r) => r.id);
const statusOf = (id: string) =>
  (db.$client.prepare('select status from transactions where id = ?').get(id) as { status: string }).status;

describe('eligibility and preview', () => {
  it('500 selected with 40 ineligible: 460 eligible, and the 40 explained by reason', async () => {
    const ids = [
      ...idsWhere("status = 'posted'", 460),
      ...idsWhere("status = 'unposted'", 30),
      ...idsWhere("status = 'reversed'", 10),
    ];
    const res = await call('POST', '/transactions/eligibility', { actionId: 'transaction.reverse', ids });
    const rows = res.json<{ id: string; permission: Permission }[]>();
    expect(rows).toHaveLength(500);
    expect(rows.filter((r) => r.permission.allowed)).toHaveLength(460);
    const reasons = new Map<string, number>();
    for (const r of rows.filter((x) => !x.permission.allowed))
      reasons.set(r.permission.explanation ?? '', (reasons.get(r.permission.explanation ?? '') ?? 0) + 1);
    expect(Object.fromEntries(reasons)).toEqual({
      'Not posted, so there is nothing to reverse.': 30,
      'Already reversed.': 10,
    });
  });

  it('preview shows before and after, and what would fail, without changing anything', async () => {
    const [ok] = idsWhere(
      "status = 'unposted' and type = 'buy' and settle_date is not null and trade_date >= '2026-11-02'",
      1,
    ) as [string];
    db.$client
      .prepare(
        "insert into transactions select 'T-NOSETTLE', portfolio_id, security_id, type, trade_date, null, quantity, price, amount, currency, 'unposted', null, origin, created_by, created_at, null, 1 from transactions where id = ?",
      )
      .run(ok);
    const rows = (
      await call('POST', '/transactions/preview', { actionId: 'transaction.post', ids: [ok, 'T-NOSETTLE'] })
    ).json<PreviewRow[]>();
    rows.forEach((r) => schemas.previewRow.parse(r));
    expect(rows[0]).toMatchObject({ id: ok, before: { status: 'unposted' }, after: { status: 'posted' } });
    expect(rows[1]?.after).toEqual({ status: 'unposted' });
    expect(rows[1]?.warnings?.[0]?.code).toBe('LL-VAL-0119');
    expect(statusOf(ok)).toBe('unposted');
  });
});

describe('bulk actions as jobs', () => {
  it('runs more than 200 rows as a job, in chunks, with one audit event per row and one for the batch', async () => {
    const ids = idsWhere("status = 'posted'", 260);
    const res = await call('POST', '/transactions/bulk', {
      actionId: 'transaction.reverse',
      ids,
      reason: 'Month-end correction',
    });
    expect(res.statusCode).toBe(202);
    const queued = res.json<BulkResult>();
    expect(queued.status).toBe('queued');
    // Nothing has happened yet: the request returned at once.
    expect(statusOf(ids[0] as string)).toBe('posted');

    const done = app.jobs.drain(queued.jobId);
    schemas.job.parse(done);
    expect(done.status).toBe('completed');
    expect(done.progress).toEqual({ done: 260, total: 260 });
    expect(done.result?.succeeded).toHaveLength(260);
    expect(statusOf(ids[259] as string)).toBe('reversed');
    const audit = db.$client
      .prepare(
        'select action, count(*) as n from audit_events where batch_id = ? group by action order by action',
      )
      .all(queued.jobId);
    expect(audit).toEqual([
      { action: 'transaction.reverse', n: 260 },
      { action: 'transaction.reverse.batch', n: 1 },
    ]);
    const note = db.$client
      .prepare("select note from audit_events where batch_id = ? and action = 'transaction.reverse' limit 1")
      .get(queued.jobId) as { note: string };
    expect(JSON.parse(note.note)).toMatchObject({ text: 'Month-end correction' });
  });

  it('a partial job retries only what failed, with the original inputs, and never repeats a row', async () => {
    const good = idsWhere("status = 'unposted' and type = 'income' and trade_date >= '2026-11-02'", 5);
    const template = good[0] as string;
    const bad = Array.from({ length: 205 }, (_, i) => `T-BAD${String(i).padStart(4, '0')}`);
    const insert = db.$client.prepare(
      "insert into transactions select ?, portfolio_id, security_id, 'buy', trade_date, null, '10', '100', '1000', currency, 'unposted', null, origin, created_by, created_at, null, 1 from transactions where id = ?",
    );
    for (const id of bad) insert.run(id, template);
    const first = app.jobs.drain(
      (
        await call('POST', '/transactions/bulk', { actionId: 'transaction.post', ids: [...good, ...bad] })
      ).json<BulkResult>().jobId,
    );
    expect(first.status).toBe('partial');
    expect(first.result?.succeeded).toEqual(good);
    expect(first.result?.failed).toHaveLength(205);
    expect(first.result?.failed[0]?.message.code).toBe('LL-VAL-0119');

    // Fix the cause, then retry: no inputs are sent again.
    db.$client.prepare("update transactions set settle_date = trade_date where id like 'T-BAD%'").run();
    const retry = await call('POST', `/jobs/${first.id}/retry`);
    expect(retry.statusCode).toBe(202);
    const second = app.jobs.drain(retry.json<Job>().id);
    expect(second.inputs).toMatchObject({ actionId: 'transaction.post', retryOf: first.id });
    expect((second.inputs.ids as string[]).sort()).toEqual([...bad].sort());
    expect(second.status).toBe('completed');
    expect(statusOf(bad[0] as string)).toBe('posted');

    // Retrying a job with nothing left to do is refused, and posting posted rows again only skips them.
    expect((await call('POST', `/jobs/${second.id}/retry`)).statusCode).toBe(409);
    const again = (
      await call('POST', '/transactions/bulk', { actionId: 'transaction.post', ids: good })
    ).json<BulkResult>();
    expect(again.succeeded).toEqual([]);
    expect(again.skipped.map((s) => s.reason)).toEqual(Array.from({ length: 5 }, () => 'Already posted.'));
    const posts = db.$client
      .prepare("select count(*) as n from audit_events where action = 'transaction.post' and record_id = ?")
      .get(good[0]) as { n: number };
    expect(posts.n).toBe(1);
  });

  it('carries on after a restart from the rows not yet done', async () => {
    const ids = idsWhere("status = 'posted'", 230);
    const { jobId } = (
      await call('POST', '/transactions/bulk', { actionId: 'transaction.reverse', ids })
    ).json<BulkResult>();
    // One chunk only, as if the API stopped mid-run.
    (app.jobs as unknown as { step: (id: string, reschedule: boolean) => void }).step(jobId, false);
    const midway = app.jobs.get(jobId) as Job;
    expect(midway.status).toBe('running');
    expect(midway.progress).toEqual({ done: 50, total: 230 });
    app.jobs.stop();

    // A new API on the same database picks the job up.
    const restarted = buildApp(db, clock);
    const after = restarted.jobs.drain(jobId);
    expect(after.status).toBe('completed');
    expect(after.result?.succeeded).toHaveLength(230);
    expect(after.log?.some((l) => l.text === 'Continued after a restart.')).toBe(true);
    const events = db.$client
      .prepare("select count(*) as n from audit_events where batch_id = ? and action = 'transaction.reverse'")
      .get(jobId) as { n: number };
    expect(events.n).toBe(230);
    await restarted.close();
    app = buildApp(db, clock);
  });

  it('cancel stops a running job and leaves the remaining rows untouched', async () => {
    const ids = idsWhere("status = 'posted'", 210);
    const { jobId } = (
      await call('POST', '/transactions/bulk', { actionId: 'transaction.reverse', ids })
    ).json<BulkResult>();
    (app.jobs as unknown as { step: (id: string, reschedule: boolean) => void }).step(jobId, false);
    const cancelled = (await call('POST', `/jobs/${jobId}/cancel`)).json<Job>();
    expect(cancelled.status).toBe('cancelled');
    expect(statusOf(ids[209] as string)).toBe('posted');
    expect(statusOf(ids[0] as string)).toBe('reversed');
    expect((await call('POST', `/jobs/${jobId}/cancel`)).statusCode).toBe(409);
    // Someone else cannot cancel or retry it.
    expect((await call('POST', `/jobs/${jobId}/retry`, undefined, 'u-ben')).statusCode).toBe(403);
  });

  it('refuses the job without the permission, and more rows than one run can carry', async () => {
    const ids = idsWhere("status = 'posted'", 201);
    expect(
      (await call('POST', '/transactions/bulk', { actionId: 'transaction.reverse', ids }, 'u-ben'))
        .statusCode,
    ).toBe(403);
    const tooMany = Array.from({ length: 5001 }, (_, i) => `T-${i}`);
    expect(
      (await call('POST', '/transactions/bulk', { actionId: 'transaction.post', ids: tooMany })).statusCode,
    ).toBe(400);
  });
});

describe('reports and the jobs list', () => {
  it('a report runs as a job and leaves a CSV to download', async () => {
    const reports = (await call('GET', '/reports')).json<{ id: string; name: string }[]>();
    expect(reports.map((r) => r.id)).toContain('R-txn-register');
    const res = await call('POST', '/reports/R-txn-register/run', { asOf: '2026-11-13' });
    expect(res.statusCode).toBe(202);
    const job = app.jobs.drain(res.json<Job>().id);
    expect(job.status).toBe('completed');
    expect(job.outputs).toEqual([
      { name: 'txn-register-2026-11-13.csv', format: 'csv', url: `/api/v1/jobs/${job.id}/outputs/0` },
    ]);
    const file = await call('GET', `/jobs/${job.id}/outputs/0`);
    expect(file.headers['content-type']).toContain('text/csv');
    expect(file.headers['content-disposition']).toContain('txn-register-2026-11-13.csv');
    const lines = file.body.trim().split('\n');
    expect(lines[0]).toBe(
      'Transaction,Portfolio,Security,Type,Trade date,Settle date,Quantity,Price,Amount,Currency,Status',
    );
    expect(lines.length).toBeGreaterThan(1000);
  });

  it('a client gets only their own portfolios in a report, and only their own jobs in the list', async () => {
    db.$client
      .prepare(
        "update permissions set allowed = 1, access_level = 'view' where user_id = 'u-eli' and action = 'report.run'",
      )
      .run();
    const job = app.jobs.drain(
      (await call('POST', '/reports/R-txn-register/run', {}, 'u-eli')).json<Job>().id,
    );
    const scope = JSON.parse(
      (
        db.$client.prepare("select blotter_scope from users where id = 'u-eli'").get() as {
          blotter_scope: string;
        }
      ).blotter_scope,
    ) as string[];
    const body = (await call('GET', `/jobs/${job.id}/outputs/0`, undefined, 'u-eli')).body
      .trim()
      .split('\n')
      .slice(1);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((line) => scope.includes(line.split(',')[1] as string))).toBe(true);
    const mine = (await call('POST', '/jobs/query', { startRow: 0, endRow: 50 }, 'u-eli')).json<
      GridResponse<Job>
    >();
    expect(mine.rows.every((j) => j.submittedBy.id === 'u-eli')).toBe(true);
    expect((await call('GET', '/jobs/J-000001', undefined, 'u-eli')).statusCode).toBe(404);
  });

  it('lists jobs newest first and filters to mine', async () => {
    const all = (await call('POST', '/jobs/query', { startRow: 0, endRow: 100 })).json<GridResponse<Job>>();
    expect(all.totalRows).toBeGreaterThan(4);
    const times = all.rows.map((j) => j.submittedAt);
    expect([...times].sort().reverse()).toEqual(times);
    const mine = (
      await call('POST', '/jobs/query', {
        startRow: 0,
        endRow: 100,
        filters: [{ field: 'submittedBy', op: 'eq', value: 'u-cleo' }],
      })
    ).json<GridResponse<Job>>();
    expect(mine.rows.map((j) => j.id)).toEqual(['J-000001']);
  });

  it('a failed seeded job retries with its original inputs', async () => {
    const res = await call('POST', '/jobs/J-000002/retry');
    expect(res.statusCode, res.body).toBe(202);
    const job = app.jobs.drain(res.json<Job>().id);
    expect(job.inputs).toMatchObject({ reportId: 'R-txn-register', retryOf: 'J-000002' });
    expect(job.status).toBe('completed');
    expect(job.outputs?.[0]?.format).toBe('csv');
  });

  it('a job with no handler does not stay running for ever after a restart', () => {
    db.$client
      .prepare(
        "insert into jobs (id, type, name, submitted_by, submitted_at, queue, status, inputs) values ('J-900000', 'search', 'Orphan', '{\"type\":\"user\",\"id\":\"u-ada\",\"name\":\"Ada\"}', '2026-11-14T00:00:00Z', 'default', 'running', '{}')",
      )
      .run();
    const runner = new JobRunner(db, { now: clock.now });
    runner.resume();
    expect(runner.get('J-900000')?.status).toBe('failed');
    runner.stop();
  });
});
