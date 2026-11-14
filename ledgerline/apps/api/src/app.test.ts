import type { Permission, User } from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { migrateDb, openDb, schema, type Db } from './db/client';
import { seed, summarise, VOLUMES, type SeedResult } from './db/seed';
import * as schemas from './schemas/index';

let db: Db;
let result: SeedResult;
let app: ReturnType<typeof buildApp>;

beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  result = seed(db, 'small');
  app = buildApp(db);
});
afterAll(() => app.close());

const get = (url: string, userId?: string) =>
  app.inject({
    method: 'GET',
    url: `/api/v1${url}`,
    ...(userId ? { headers: { 'x-ll-user': userId } } : {}),
  });

describe('seed', () => {
  it('is deterministic: a second seed gives identical counts and content', () => {
    const second = openDb(':memory:');
    migrateDb(second);
    const again = seed(second, 'small');
    expect(again.counts).toEqual(result.counts);
    expect(again.checksum).toBe(result.checksum);
    expect(summarise(db).checksum).toBe(result.checksum);
    second.$client.close();
  });

  it('matches the volumes and shapes in API.md', () => {
    const v = VOLUMES.small;
    expect(result.counts).toMatchObject({
      portfolios: 60,
      securities: v.securities,
      transactions: v.transactions,
      prices: v.held * v.priceDays,
      cash_activity: v.cash,
      periods: 12 * 60,
      users: 7,
    });
    const share = (sql: string) => (db.$client.prepare(sql).get() as { share: number }).share;
    expect(share("select avg(status = 'unposted') share from transactions")).toBeCloseTo(0.05, 1);
    expect(share("select avg(tolerance_status = 'stale') share from prices")).toBeCloseTo(0.03, 1);
    expect(share("select avg(status = 'unapplied') share from cash_activity")).toBeCloseTo(0.01, 1);
  });

  it('keeps unposted transactions inside the open period', () => {
    const row = db.$client
      .prepare("select min(trade_date) earliest from transactions where status = 'unposted'")
      .get() as {
      earliest: string;
    };
    expect(row.earliest >= '2026-11-01').toBe(true);
  });

  it('has the current month open, prior months closed and exactly one reopened period', () => {
    const states = db.$client
      .prepare('select period_end, state, count(*) n from periods group by 1, 2')
      .all() as {
      period_end: string;
      state: string;
      n: number;
    }[];
    expect(states.filter((s) => s.state === 'open')).toEqual([
      { period_end: '2026-11-30', state: 'open', n: 60 },
    ]);
    expect(states.filter((s) => s.state === 'reopened')).toEqual([
      { period_end: '2026-10-31', state: 'reopened', n: 1 },
    ]);
  });

  it('never stores a legacy placeholder date or a non-decimal amount', () => {
    const bad = db.$client
      .prepare(
        "select count(*) n from transactions where trade_date in ('1900-01-01','9999-12-31','0001-01-01') or amount glob '*[^0-9.-]*'",
      )
      .get() as { n: number };
    expect(bad.n).toBe(0);
  });

  it('generates every exception type with valid records', () => {
    const rows = db.select().from(schema.exceptions).all();
    expect(new Set(rows.map((r) => r.type)).size).toBe(schemas.exceptionType.options.length);
    for (const row of rows.slice(0, 50)) {
      const { periodEnd: _p, version: _v, ...record } = row;
      const clean = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null));
      expect(() => schemas.exceptionRecord.parse(clean)).not.toThrow();
    }
  });

  it('JPY amounts carry no decimals', () => {
    const row = db.$client
      .prepare("select count(*) n from transactions where currency = 'JPY' and amount like '%.%'")
      .get() as { n: number };
    expect(row.n).toBe(0);
  });
});

describe('session endpoints', () => {
  it('lists the seeded users without auth, for the role switcher', async () => {
    const res = await get('/users');
    expect(res.statusCode).toBe(200);
    const users = schemas.user.array().parse(res.json());
    expect(users.map((u) => u.name)).toEqual(['Ada', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Rafa']);
  });

  it('rejects a missing or unknown user with a message that says what to do', async () => {
    for (const res of [await get('/me'), await get('/me', 'u-nobody')]) {
      expect(res.statusCode).toBe(401);
      const body = schemas.errorBody.parse(res.json());
      expect(body.messages[0]?.fix).toMatch(/role switcher/);
    }
  });

  it('returns the current user and their startup workspaces', async () => {
    const res = await get('/me', 'u-ada');
    const body = res.json<{ user: User; startupWorkspaces: { id: string }[] }>();
    expect(schemas.user.parse(body.user)).toMatchObject({ name: 'Ada', defaultDensity: 'compact' });
    expect(body.startupWorkspaces.map((w) => w.id)).toEqual(['W-txn-ops']);
  });

  it('Ben cannot reverse, and the denial explains why (business rule 3)', async () => {
    const perms = schemas.permission.array().parse((await get('/me/permissions', 'u-ben')).json());
    const reverse = perms.find((p) => p.action === 'transaction.reverse');
    expect(reverse).toMatchObject({ allowed: false, reason: 'role' });
    expect(reverse?.explanation).toMatch(/full access/);
    expect(perms.find((p) => p.action === 'transaction.post')?.allowed).toBe(true);
  });

  it('every denied permission for every user carries an explanation', async () => {
    const users = (await get('/users')).json<User[]>();
    for (const user of users) {
      const perms = (await get('/me/permissions', user.id)).json<Permission[]>();
      expect(perms.length).toBeGreaterThan(20);
      for (const p of perms.filter((x) => !x.allowed))
        expect(p.explanation, `${user.name} ${p.action}`).toBeTruthy();
    }
  });

  it('Eli is limited to two portfolios in blotter scope', async () => {
    const perms = (await get('/me/permissions', 'u-eli')).json<Permission[]>();
    expect(perms.find((p) => p.action === 'transaction.view')).toMatchObject({
      allowed: true,
      blotterScope: ['P-0007', 'P-0019'],
    });
    expect(
      perms
        .filter((p) => p.allowed)
        .map((p) => p.action)
        .sort(),
    ).toEqual(['export.run', 'transaction.view']);
  });

  it('unknown paths return a structured message', async () => {
    const res = await get('/nope', 'u-ada');
    expect(res.statusCode).toBe(404);
    expect(schemas.errorBody.parse(res.json()).messages[0]?.code).toBe('LL-API-0404');
  });
});
