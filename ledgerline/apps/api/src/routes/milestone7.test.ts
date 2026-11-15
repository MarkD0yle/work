import type {
  AuditEvent,
  GridResponse,
  Permission,
  PositionRow,
  Statement,
  TransactionRow,
  User,
} from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { migrateDb, openDb, type Db } from '../db/client';
import { seed } from '../db/seed';

let db: Db;
let app: ReturnType<typeof buildApp>;
beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  seed(db, 'small');
  app = buildApp(db, { today: '2026-11-14', now: () => '2026-11-14T16:30:00.000Z' });
});
afterAll(() => app.close());
const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, userId = 'u-fay') =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { 'x-ll-user': userId },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
const audit = async (id: string) => (await call('GET', `/audit/record/user/${id}`)).json<AuditEvent[]>();

describe('admin', () => {
  it('only an administrator can list users or change them', async () => {
    expect((await call('GET', '/admin/users')).json<User[]>().map((u) => u.id)).toContain('u-eli');
    for (const [method, url, body] of [
      ['GET', '/admin/users', undefined],
      ['PUT', '/admin/users/u-ben', { blotterScope: ['P-0001'] }],
      ['GET', '/admin/users/u-ben/permissions', undefined],
      [
        'PUT',
        '/admin/users/u-ben/permissions',
        { changes: [{ action: 'transaction.reverse', accessLevel: 'full' }] },
      ],
    ] as const) {
      const res = await call(method, url, body, 'u-cleo');
      expect(res.statusCode, url).toBe(403);
    }
  });

  it('changing an access level takes effect at once and is audited with before and after', async () => {
    // Ben cannot reverse (business rule 3). Fay gives him full access; now he can.
    const posted = (
      db.$client.prepare("select id from transactions where status = 'posted' limit 1").get() as {
        id: string;
      }
    ).id;
    const reverse = () =>
      call('POST', '/transactions/bulk', { actionId: 'transaction.reverse', ids: [posted] }, 'u-ben');
    expect((await reverse()).statusCode).toBe(403);
    const res = await call('PUT', '/admin/users/u-ben/permissions', {
      changes: [{ action: 'transaction.reverse', accessLevel: 'full' }],
    });
    expect(res.json<Permission[]>().find((p) => p.action === 'transaction.reverse')).toMatchObject({
      accessLevel: 'full',
      allowed: true,
    });
    expect((await reverse()).statusCode).toBe(200);
    expect((await audit('u-ben'))[0]).toMatchObject({
      action: 'admin.permission.update',
      actor: { name: 'Fay' },
      before: { 'transaction.reverse': 'none' },
      after: { 'transaction.reverse': 'full' },
    });

    // Taking it away again denies it, with an explanation the user will see.
    const back = (
      await call('PUT', '/admin/users/u-ben/permissions', {
        changes: [{ action: 'transaction.reverse', accessLevel: 'none' }],
      })
    ).json<Permission[]>();
    const denied = back.find((p) => p.action === 'transaction.reverse');
    expect(denied).toMatchObject({ allowed: false, reason: 'role' });
    expect(denied?.explanation).toContain('Ask an administrator');
    // A change that changes nothing writes no audit event.
    const before = (await audit('u-ben')).length;
    await call('PUT', '/admin/users/u-ben/permissions', {
      changes: [{ action: 'transaction.reverse', accessLevel: 'none' }],
    });
    expect((await audit('u-ben')).length).toBe(before);
    expect(
      (
        await call('PUT', '/admin/users/u-ben/permissions', {
          changes: [{ action: 'made.up', accessLevel: 'view' }],
        })
      ).statusCode,
    ).toBe(422);
  });

  it('an administrator cannot remove their own administrator access', async () => {
    const res = await call('PUT', '/admin/users/u-fay/permissions', {
      changes: [{ action: 'admin.permissions', accessLevel: 'none' }],
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ messages: { code: string; fix: string }[] }>().messages[0]).toMatchObject({
      code: 'LL-ADM-0003',
    });
    expect((await call('GET', '/admin/users')).statusCode).toBe(200);
  });

  it('a blotter scope limits what the user sees, and the change is audited', async () => {
    const all = (await call('POST', '/transactions/query', { startRow: 0, endRow: 1 }, 'u-ben')).json<
      GridResponse<TransactionRow>
    >().totalRows;
    const scoped = (
      await call('PUT', '/admin/users/u-ben', { blotterScope: ['P-0002', 'P-0001', 'P-0001'] })
    ).json<User>();
    expect(scoped.blotterScope).toEqual(['P-0001', 'P-0002']);
    const rows = (await call('POST', '/transactions/query', { startRow: 0, endRow: 500 }, 'u-ben')).json<
      GridResponse<TransactionRow>
    >();
    expect(rows.totalRows).toBeLessThan(all);
    expect(rows.rows.every((r) => ['P-0001', 'P-0002'].includes(r.portfolio.id))).toBe(true);
    expect((await audit('u-ben'))[0]).toMatchObject({
      action: 'admin.user.update',
      before: { blotterScope: null },
      after: { blotterScope: ['P-0001', 'P-0002'] },
    });
    expect((await call('PUT', '/admin/users/u-ben', { blotterScope: ['P-9999'] })).statusCode).toBe(422);
    // An empty scope removes the limit.
    expect(
      (await call('PUT', '/admin/users/u-ben', { blotterScope: [] })).json<User>().blotterScope,
    ).toBeUndefined();
    expect(
      (await call('POST', '/transactions/query', { startRow: 0, endRow: 1 }, 'u-ben')).json<
        GridResponse<TransactionRow>
      >().totalRows,
    ).toBe(all);
  });
});

describe('client home', () => {
  const scope = ['P-0007', 'P-0019'];

  it('a client sees positions only for their own portfolios', async () => {
    const page = (await call('POST', '/positions/query', { startRow: 0, endRow: 500 }, 'u-eli')).json<
      GridResponse<PositionRow>
    >();
    expect(page.totalRows).toBeGreaterThan(0);
    expect(page.rows.every((r) => scope.includes(r.portfolio.id))).toBe(true);
    expect(page.rows[0]).toMatchObject({
      quantity: { kind: 'quantity' },
      marketValue: { kind: 'marketValue' },
      asOf: { basis: 'valuation' },
    });
    const everyone = (await call('POST', '/positions/query', { startRow: 0, endRow: 1 }, 'u-ada')).json<
      GridResponse<PositionRow>
    >();
    expect(everyone.totalRows).toBeGreaterThan(page.totalRows);
  });

  it('a portfolio outside the scope is refused with the reason, not shown as empty', async () => {
    const res = await call(
      'POST',
      '/positions/query',
      { startRow: 0, endRow: 10, filters: [{ field: 'portfolioId', op: 'eq', value: 'P-0001' }] },
      'u-eli',
    );
    expect(res.statusCode).toBe(403);
    expect(res.json<{ messages: { text: string }[] }>().messages[0]?.text).toBe(
      'Portfolio P-0001 is outside your account scope.',
    );
  });

  it('lists month-end statements in scope, newest first, each downloadable as a PDF', async () => {
    const list = (await call('GET', '/statements', undefined, 'u-eli')).json<Statement[]>();
    expect(list.length).toBeGreaterThan(1);
    expect(list.every((s) => scope.includes(s.portfolio.id))).toBe(true);
    expect(list[0]?.periodEnd).toBe('2026-10-31');
    const dates = list.map((s) => s.periodEnd);
    expect([...dates].sort().reverse()).toEqual(dates);
    const file = await call('GET', list[0]?.url as string, undefined, 'u-eli');
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toContain(
      `statement-${list[0]?.portfolio.id}-2026-10-31.pdf`,
    );
    expect(file.rawPayload.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(file.rawPayload.toString('latin1')).toContain('Holdings');
  });

  it("another client's statement is refused with the reason", async () => {
    const res = await call('GET', '/statements/ST-0001-2026-10/download', undefined, 'u-eli');
    expect(res.statusCode).toBe(403);
    expect(res.json<{ messages: { text: string }[] }>().messages[0]?.text).toBe(
      'That statement is outside your account scope.',
    );
    expect((await call('GET', '/statements/ST-nope/download', undefined, 'u-eli')).statusCode).toBe(404);
  });
});

describe('query plans', () => {
  const plan = (sql: string, ...params: unknown[]) =>
    (db.$client.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[])
      .map((r) => r.detail)
      .join(' | ');

  it('the lists read most use an index, not a full scan', () => {
    expect(plan('SELECT * FROM audit_events e ORDER BY e.at DESC, e.id DESC LIMIT 100')).toContain(
      'audit_at',
    );
    expect(
      plan("SELECT * FROM audit_events WHERE record_type = 'period' AND record_id = ? ORDER BY at DESC", 'x'),
    ).toContain('audit_record');
    expect(
      plan(
        "SELECT * FROM exceptions WHERE portfolio_id = ? AND period_end = ? AND status IN ('new')",
        'P-0001',
        '2026-11-30',
      ),
    ).toContain('exceptions_portfolio_period');
    expect(
      plan("SELECT * FROM exceptions WHERE status IN ('new', 'inProgress') AND type = 'cashBreak'"),
    ).toContain('exceptions_status');
    expect(plan('SELECT * FROM jobs j ORDER BY j.submitted_at DESC LIMIT 20')).toContain('jobs_submitted');
    expect(
      plan("SELECT * FROM prices WHERE price_date = ? AND tolerance_status <> 'ok'", '2026-11-13'),
    ).toContain('prices_date_status');
    expect(plan('SELECT * FROM positions WHERE portfolio_id = ?', 'P-0001')).toContain(
      'positions_portfolio_security',
    );
    expect(
      plan("SELECT id FROM transactions t WHERE t.status = 'unposted' ORDER BY t.trade_date DESC LIMIT 100"),
    ).toContain('transactions_status');
  });
});
