import type { BulkResult, GridResponse, TransactionRow } from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { migrateDb, openDb, type Db } from '../db/client';
import { seed } from '../db/seed';
import * as schemas from '../schemas/index';

let db: Db;
let app: ReturnType<typeof buildApp>;
beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  seed(db, 'small');
  app = buildApp(db, { today: '2026-11-14', now: () => '2026-11-14T16:30:00.000Z' });
});
afterAll(() => app.close());

const bulk = (userId: string, actionId: string, ids: string[], extra: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/transactions/bulk',
    headers: { 'x-ll-user': userId },
    payload: { actionId, ids, ...extra },
  });
const idsWhere = (where: string, limit = 5) =>
  (
    db.$client.prepare(`select id from transactions where ${where} order by id limit ?`).all(limit) as {
      id: string;
    }[]
  ).map((r) => r.id);
const statusOf = (id: string) =>
  (
    db.$client.prepare('select status from transactions where id = ?').get(id) as
      { status: string } | undefined
  )?.status;
const auditFor = (batchId: string) =>
  db.$client
    .prepare('select action, record_id, before, after from audit_events where batch_id = ? order by id')
    .all(batchId) as Record<string, string>[];

describe('POST /transactions/bulk', () => {
  it('posts unposted transactions, with one audit event per row plus one for the batch', async () => {
    const ids = idsWhere("status = 'unposted'", 3);
    const res = await bulk('u-ada', 'transaction.post', ids);
    expect(res.statusCode).toBe(200);
    const result = schemas.bulkResult.parse(res.json());
    expect(result).toMatchObject({ status: 'completed', succeeded: ids, failed: [], skipped: [] });
    for (const id of ids) expect(statusOf(id)).toBe('posted');
    const audit = auditFor(result.jobId);
    expect(audit.map((a) => a.action)).toEqual([
      'transaction.post',
      'transaction.post',
      'transaction.post',
      'transaction.post.batch',
    ]);
    expect(JSON.parse(audit[0]?.before as string)).toEqual({ status: 'unposted' });
    expect(JSON.parse(audit[0]?.after as string)).toEqual({ status: 'posted' });
    expect(JSON.parse(audit[3]?.after as string)).toEqual({
      requested: 3,
      succeeded: 3,
      failed: 0,
      skipped: 0,
    });
  });

  it('retrying a posted row cannot post it twice', async () => {
    const [id] = idsWhere("status = 'unposted'", 1) as [string];
    await bulk('u-ada', 'transaction.post', [id]);
    const version = (
      db.$client.prepare('select version from transactions where id = ?').get(id) as { version: number }
    ).version;
    const again = (await bulk('u-ada', 'transaction.post', [id])).json<BulkResult>();
    expect(again).toMatchObject({
      status: 'failed',
      succeeded: [],
      skipped: [{ id, reason: 'Already posted.' }],
    });
    expect(
      (db.$client.prepare('select version from transactions where id = ?').get(id) as { version: number })
        .version,
    ).toBe(version);
    expect(
      (
        db.$client
          .prepare("select count(*) n from audit_events where record_id = ? and action = 'transaction.post'")
          .get(id) as { n: number }
      ).n,
    ).toBe(1);
  });

  it('partial success: succeeded, failed and skipped are reported separately, with a reason for each', async () => {
    const [good] = idsWhere("status = 'unposted'", 1) as [string];
    const [posted] = idsWhere("status = 'posted'", 1) as [string];
    // An unposted record dated in a closed period, as could arrive from an import.
    const [closed] = idsWhere("status = 'unposted' and id <> '" + good + "'", 1) as [string];
    db.$client
      .prepare("update transactions set trade_date = '2026-09-15', settle_date = '2026-09-17' where id = ?")
      .run(closed);

    const result = (
      await bulk('u-ada', 'transaction.post', [good, posted, closed, 'T-9999999'])
    ).json<BulkResult>();
    expect(result.status).toBe('partial');
    expect(result.succeeded).toEqual([good]);
    expect(result.skipped).toEqual([{ id: posted, reason: 'Already posted.' }]);
    expect(result.failed.map((f) => f.id)).toEqual([closed, 'T-9999999']);
    // Business rule 1: the message names the period and who can reopen it.
    expect(result.failed[0]?.message).toMatchObject({ code: 'LL-PER-0001', target: closed });
    expect(result.failed[0]?.message.text).toContain('period ending 2026-09-30 is closed');
    expect(result.failed[0]?.message.fix).toContain('controller in Investment Accounting');
    expect(statusOf(closed)).toBe('unposted');
  });

  it('cannot reverse an unposted transaction; cannot delete a posted one (business rule 2)', async () => {
    const [unposted] = idsWhere("status = 'unposted'", 1) as [string];
    const [posted] = idsWhere("status = 'posted'", 1) as [string];
    const reverse = (
      await bulk('u-ada', 'transaction.reverse', [unposted, posted], {
        reason: 'Entered against the wrong portfolio',
      })
    ).json<BulkResult>();
    expect(reverse.succeeded).toEqual([posted]);
    expect(reverse.skipped).toEqual([
      { id: unposted, reason: 'Not posted, so there is nothing to reverse.' },
    ]);
    expect(statusOf(posted)).toBe('reversed');
    const note = db.$client
      .prepare("select note from audit_events where record_id = ? and action = 'transaction.reverse'")
      .get(posted) as { note: string };
    expect(JSON.parse(note.note)).toEqual({ kind: 'comment', text: 'Entered against the wrong portfolio' });

    const [stillPosted] = idsWhere("status = 'posted'", 1) as [string];
    const del = (await bulk('u-ada', 'transaction.delete', [unposted, stillPosted])).json<BulkResult>();
    expect(del.succeeded).toEqual([unposted]);
    expect(del.skipped[0]?.reason).toMatch(/Only unposted transactions can be deleted; reverse it instead/);
    expect(statusOf(unposted)).toBeUndefined();
    expect(statusOf(stillPosted)).toBe('posted');
  });

  it('Ben cannot reverse: 403 with the explanation, and nothing changes (business rule 3)', async () => {
    const [posted] = idsWhere("status = 'posted'", 1) as [string];
    const res = await bulk('u-ben', 'transaction.reverse', [posted]);
    expect(res.statusCode).toBe(403);
    const body = schemas.errorBody.parse(res.json());
    expect(body.permission).toMatchObject({ action: 'transaction.reverse', allowed: false });
    expect(body.messages[0]?.text).toMatch(/full access on transactions/);
    expect(statusOf(posted)).toBe('posted');
    // Ben can post.
    expect((await bulk('u-ben', 'transaction.post', idsWhere("status = 'unposted'", 1))).statusCode).toBe(
      200,
    );
  });

  it("records outside a client's scope are reported as not found, never changed", async () => {
    const [outside] = idsWhere("status = 'unposted' and portfolio_id not in ('P-0007','P-0019')", 1) as [
      string,
    ];
    expect((await bulk('u-eli', 'transaction.post', [outside])).statusCode).toBe(403);
    expect(statusOf(outside)).toBe('unposted');
  });

  it('rejects unknown actions, empty selections and runs too large for inline', async () => {
    expect((await bulk('u-ada', 'transaction.explode', ['T-0000001'])).statusCode).toBe(400);
    expect((await bulk('u-ada', 'transaction.post', [])).statusCode).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => `T-${String(i + 1).padStart(7, '0')}`);
    const res = await bulk('u-ada', 'transaction.post', many);
    expect(res.statusCode).toBe(400);
    expect(schemas.errorBody.parse(res.json()).messages[0]?.code).toBe('LL-BLK-0002');
  });

  it('the grid shows the new status afterwards', async () => {
    const [id] = idsWhere("status = 'unposted'", 1) as [string];
    await bulk('u-ada', 'transaction.post', [id]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transactions/query',
      headers: { 'x-ll-user': 'u-ada' },
      payload: { startRow: 0, endRow: 1, quickSearch: id },
    });
    expect(res.json<GridResponse<TransactionRow>>().rows[0]).toMatchObject({ id, status: 'posted' });
  });
});
