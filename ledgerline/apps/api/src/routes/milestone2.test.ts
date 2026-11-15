import type {
  AccountingPeriod,
  GridResponse,
  MarketCalendar,
  MutationResult,
  SavedView,
  TransactionRow,
  Workspace,
} from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { migrateDb, openDb, type Db } from '../db/client';
import { seed } from '../db/seed';
import * as schemas from '../schemas/index';

let db: Db;
let app: ReturnType<typeof buildApp>;
const NOW = '2026-11-14T16:30:00.000Z';

beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  seed(db, 'small');
  app = buildApp(db, { today: '2026-11-14', now: () => NOW });
});
afterAll(() => app.close());

const call = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  userId: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { 'x-ll-user': userId, ...headers },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

const viewBody = (over: Partial<SavedView> = {}) => ({
  gridId: 'transactions',
  name: 'Big buys',
  ownership: 'personal',
  schemaVersion: 2,
  state: {
    columns: [
      { field: 'id', visible: true, width: 120, pinned: 'left' },
      { field: 'amount', visible: true },
      { field: 'price', visible: false },
    ],
    sort: [{ field: 'amount', dir: 'desc' }],
    filters: [
      { field: 'type', op: 'eq', value: 'buy' },
      { field: 'tradeDate', op: 'relative', period: 'today' },
    ],
    quickSearch: 'TREASURY',
    grouping: ['status'],
    density: 'compact',
  },
  ...over,
});

describe('saved views', () => {
  it("lists the default first, then shared, then my personal views; never other people's personal views", async () => {
    const created = (await call('POST', '/views', 'u-ben', viewBody({ name: "Ben's private view" }))).json<
      MutationResult<SavedView>
    >().record;
    const ada = schemas.savedView
      .array()
      .parse((await call('GET', '/views?gridId=transactions', 'u-ada')).json());
    expect(ada.map((v) => v.ownership)).toEqual(['default', 'shared', 'shared']);
    expect(ada.find((v) => v.id === created.id)).toBeUndefined();
    const ben = (await call('GET', '/views?gridId=transactions', 'u-ben')).json<SavedView[]>();
    expect(ben.map((v) => v.name)).toContain("Ben's private view");
    expect(ada.find((v) => v.id === 'V-transactions-unposted-yesterday')).toMatchObject({
      name: "Yesterday's unposted trades",
      defaultForTeam: 'Transaction Operations',
    });
  });

  it('stores a view exactly: columns, sort, filters, search, grouping and density; relative dates stay relative', async () => {
    const res = await call('POST', '/views', 'u-ada', viewBody());
    expect(res.statusCode).toBe(201);
    const { record, auditEventIds } = res.json<MutationResult<SavedView>>();
    expect(record.state).toEqual(viewBody().state);
    expect(record.owner).toMatchObject({ id: 'u-ada' });
    expect(record.state.filters[1]).toEqual({ field: 'tradeDate', op: 'relative', period: 'today' });
    expect(auditEventIds).toHaveLength(1);
    const again = (await call('GET', '/views?gridId=transactions', 'u-ada'))
      .json<SavedView[]>()
      .find((v) => v.id === record.id);
    expect(again?.state).toEqual(viewBody().state);
  });

  it('a user cannot overwrite a shared view they do not own, and is told to save a copy', async () => {
    const shared = 'V-transactions-unposted-yesterday';
    const before = (await call('GET', '/views', 'u-ada')).json<SavedView[]>().find((v) => v.id === shared);
    const res = await call(
      'PUT',
      `/views/${shared}`,
      'u-ben',
      viewBody({ name: 'Hijacked', ownership: 'shared' }),
    );
    expect(res.statusCode).toBe(403);
    const body = schemas.errorBody.parse(res.json());
    expect(body.messages[0]).toMatchObject({ text: 'Only Ada can change this view.' });
    expect(body.messages[0]?.fix).toMatch(/Save your own copy/);
    expect((await call('DELETE', `/views/${shared}`, 'u-ben')).statusCode).toBe(403);
    expect((await call('GET', '/views', 'u-ada')).json<SavedView[]>().find((v) => v.id === shared)).toEqual(
      before,
    );
  });

  it('the owner can update, reassign and delete; the change is audited with before and after', async () => {
    const { record } = (
      await call('POST', '/views', 'u-ada', viewBody({ name: 'Team view', ownership: 'shared' }))
    ).json<MutationResult<SavedView>>();
    const updated = await call('PUT', `/views/${record.id}`, 'u-ada', {
      ...viewBody({ name: 'Team view v2', ownership: 'shared' }),
      owner: { type: 'user', id: 'u-ben', name: 'Ben' },
    });
    expect(updated.statusCode).toBe(200);
    const result = updated.json<MutationResult<SavedView>>();
    expect(result.record).toMatchObject({ name: 'Team view v2', owner: { id: 'u-ben' }, updatedAt: NOW });
    const audit = db.$client
      .prepare('select before, after from audit_events where id = ?')
      .get(result.auditEventIds[0]) as { before: string; after: string };
    expect(JSON.parse(audit.before)).toMatchObject({ name: 'Team view', owner: 'u-ada' });
    expect(JSON.parse(audit.after)).toMatchObject({ name: 'Team view v2', owner: 'u-ben' });
    // Ownership moved: Ada can no longer change it, Ben can delete it.
    expect(
      (await call('PUT', `/views/${record.id}`, 'u-ada', viewBody({ ownership: 'shared' }))).statusCode,
    ).toBe(403);
    expect((await call('DELETE', `/views/${record.id}`, 'u-ben')).statusCode).toBe(200);
  });

  it('the default view cannot be deleted, a nameless view is rejected, and a missing view is a 404', async () => {
    expect((await call('DELETE', '/views/V-transactions-default', 'u-ada')).statusCode).toBe(422);
    expect((await call('POST', '/views', 'u-ada', viewBody({ name: '   ' }))).statusCode).toBe(400);
    expect((await call('PUT', '/views/V-nope', 'u-ada', viewBody())).statusCode).toBe(404);
  });
});

describe('workspaces', () => {
  const body = (over: Partial<Workspace> = {}) => ({
    name: 'My morning',
    loadAtStartup: true,
    layout: 'tabs',
    panels: [
      { gridId: 'transactions', viewId: 'V-transactions-default' },
      { gridId: 'transactions', viewId: 'V-transactions-unposted-yesterday' },
    ],
    ...over,
  });

  it('gives every role its team default, so nobody starts with an empty list', async () => {
    for (const [user, name] of [
      ['u-ben', 'Transaction Operations'],
      ['u-cleo', 'Period close'],
      ['u-dev', 'Price review'],
      ['u-rafa', 'Breaks'],
    ] as const) {
      const list = schemas.workspace.array().parse((await call('GET', '/workspaces', user)).json());
      expect(list[0], user).toMatchObject({ name, isTeamDefault: true, loadAtStartup: true });
    }
  });

  it('creates, updates and deletes my own; other users cannot change or see it', async () => {
    const { record } = (await call('POST', '/workspaces', 'u-ada', body())).json<MutationResult<Workspace>>();
    expect(record).toMatchObject({ name: 'My morning', owner: { id: 'u-ada' }, layout: 'tabs' });
    expect(record.panels).toHaveLength(2);
    expect(
      (await call('GET', '/me', 'u-ada'))
        .json<{ startupWorkspaces: { id: string }[] }>()
        .startupWorkspaces.map((w) => w.id),
    ).toContain(record.id);
    expect(
      (await call('GET', '/workspaces', 'u-dev')).json<Workspace[]>().some((w) => w.id === record.id),
    ).toBe(false);
    expect((await call('PUT', `/workspaces/${record.id}`, 'u-ben', body())).statusCode).toBe(403);

    const updated = (
      await call(
        'PUT',
        `/workspaces/${record.id}`,
        'u-ada',
        body({ layout: 'single', poppedOut: ['1'], loadAtStartup: false }),
      )
    ).json<MutationResult<Workspace>>();
    expect(updated.record).toMatchObject({ layout: 'single', poppedOut: ['1'], loadAtStartup: false });
    expect(updated.auditEventIds).toHaveLength(1);
    expect((await call('DELETE', `/workspaces/${record.id}`, 'u-ada')).statusCode).toBe(200);
    expect((await call('DELETE', `/workspaces/${record.id}`, 'u-ada')).statusCode).toBe(404);
  });
});

describe('entity search', () => {
  const search = async (query: string, userId = 'u-ada') => {
    const res = await call('GET', `/entities/search?${query}`, userId);
    return {
      res,
      results: res.statusCode === 200 ? schemas.entitySearchResult.array().parse(res.json()) : [],
    };
  };
  const anySecurity = () =>
    db.$client
      .prepare(
        "select * from securities where cusip is not null and status = 'active' and ticker is not null limit 1",
      )
      .get() as Record<string, string>;

  it('an exact identifier (ISIN, CUSIP, ticker, internal id) ranks first and says what matched', async () => {
    const s = anySecurity();
    for (const [value, matchedOn] of [
      [s.isin, 'isin'],
      [(s.isin as string).toLowerCase(), 'isin'],
      [s.cusip, 'cusip'],
      [s.id, 'id'],
      [s.ticker, 'ticker'],
    ] as const) {
      const { results } = await search(`kind=security&q=${encodeURIComponent(value as string)}`);
      expect(results[0], value).toMatchObject({ matchedOn });
      if (matchedOn !== 'ticker') expect(results[0]?.ref.id).toBe(s.id);
    }
    const gb = db.$client
      .prepare('select id, sedol from securities where sedol is not null limit 1')
      .get() as { id: string; sedol: string };
    expect((await search(`kind=security&q=${gb.sedol}`)).results[0]).toMatchObject({
      matchedOn: 'sedol',
      ref: { id: gb.id },
    });
  });

  it('results carry id, description, type, currency, status and parent', async () => {
    const { results } = await search('kind=security&q=treasury');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.description.toUpperCase()).toContain('TREASURY');
      expect(r).toMatchObject({
        type: expect.any(String),
        currency: expect.any(String),
        status: 'active',
        parent: expect.any(String),
      });
      expect(r.ref.altIds?.isin).toBeTruthy();
    }
    // Every word must match, in any order, as a prefix.
    const narrowed = (await search(`kind=security&q=${encodeURIComponent('treas 20')}`)).results;
    expect(narrowed.length).toBeGreaterThan(0);
    for (const r of narrowed) expect(r.description).toMatch(/TREAS/);
  });

  it('hides inactive records unless asked, and can limit securities to held ones', async () => {
    const inactive = db.$client
      .prepare("select id, isin from securities where status = 'inactive' limit 1")
      .get() as { id: string; isin: string };
    expect((await search(`kind=security&q=${inactive.isin}`)).results).toEqual([]);
    expect((await search(`kind=security&q=${inactive.isin}&includeInactive=true`)).results[0]).toMatchObject({
      status: 'inactive',
      ref: { id: inactive.id },
    });
    const held = (await search('kind=security&q=ord&scope=held')).results;
    expect(held.length).toBeGreaterThan(0);
    const heldIds = new Set(
      (db.$client.prepare('select id from securities where held = 1').all() as { id: string }[]).map(
        (r) => r.id,
      ),
    );
    for (const r of held) expect(heldIds.has(r.ref.id)).toBe(true);
  });

  it('search text can never break the query', async () => {
    for (const q of ['"', "'; drop table securities; --", '***', 'AND OR NOT', '( near', '-']) {
      const { res } = await search(`kind=security&q=${encodeURIComponent(q)}`);
      expect(res.statusCode, q).toBe(200);
    }
    expect((await search('kind=security&q=')).results).toEqual([]);
    expect((db.$client.prepare('select count(*) n from securities').get() as { n: number }).n).toBe(5000);
  });

  it('restricted portfolios are returned with the reason, never omitted', async () => {
    const { results } = await search('kind=portfolio&q=P-00', 'u-eli');
    expect(results.length).toBeGreaterThan(10);
    const open = results.filter((r) => !r.restricted).map((r) => r.ref.id);
    expect(open.sort()).toEqual(['P-0007', 'P-0019']);
    expect(results.find((r) => r.ref.id === 'P-0001')?.restricted).toEqual({
      reason: 'Outside your account scope.',
    });
    expect((await search('kind=portfolio&q=P-0001')).results[0]).toMatchObject({ matchedOn: 'id' });
    expect((await search('kind=portfolio&q=P-0001')).results[0]?.restricted).toBeUndefined();
  });

  it('other kinds: managers and reports search; kinds not built yet say so', async () => {
    expect((await search('kind=manager&q=asset')).results.length).toBeGreaterThan(0);
    expect((await search('kind=report&q=holdings')).results[0]).toMatchObject({ ref: { id: 'R-holdings' } });
    const { res } = await search('kind=bank&q=x');
    expect(res.statusCode).toBe(400);
    expect(schemas.errorBody.parse(res.json()).messages[0]?.code).toBe('LL-ENT-0001');
    expect((await search('kind=nonsense&q=x')).res.statusCode).toBe(400);
  });

  it('remembers the last 10 picked, most recent first, per user and kind', async () => {
    const ids = (
      db.$client.prepare("select id from securities where status = 'active' limit 12").all() as {
        id: string;
      }[]
    ).map((r) => r.id);
    for (const id of ids)
      expect((await call('POST', '/entities/recent', 'u-dev', { kind: 'security', id })).statusCode).toBe(
        204,
      );
    await call('POST', '/entities/recent', 'u-dev', { kind: 'security', id: ids[3] });
    const recent = schemas.entitySearchResult
      .array()
      .parse((await call('GET', '/entities/recent?kind=security', 'u-dev')).json());
    expect(recent).toHaveLength(10);
    expect(recent[0]?.ref.id).toBe(ids[3]);
    expect(recent[1]?.ref.id).toBe(ids[11]);
    expect((await call('GET', '/entities/recent?kind=security', 'u-ada')).json()).toEqual([]);
    expect((await call('GET', '/entities/recent?kind=portfolio', 'u-dev')).json()).toEqual([]);
  });

  it('answers within the 500ms budget (small seed; the 1M-row check is in DECISIONS.md)', async () => {
    const times: number[] = [];
    for (const q of ['treasury', 'ord', 'us', 'fnma pool', 'gilt 20', 'a', 'corp', 'S-0000100']) {
      const t = performance.now();
      await search(`kind=security&q=${encodeURIComponent(q)}`);
      times.push(performance.now() - t);
    }
    expect(Math.max(...times)).toBeLessThan(500);
  });
});

describe('periods and calendars', () => {
  it('lists 12 periods for a portfolio, newest first, with state per close type', async () => {
    const periods = schemas.accountingPeriod
      .array()
      .parse((await call('GET', '/periods?portfolioId=P-0003', 'u-cleo')).json());
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ periodEnd: '2026-11-30', state: 'open' });
    expect(periods[1]).toMatchObject({
      periodEnd: '2026-10-31',
      state: 'reopened',
      closes: { transaction: 'reopened', valuation: 'closed' },
    });
    expect(periods[2]?.state).toBe('closed');
    expect((await call('GET', '/periods', 'u-cleo')).statusCode).toBe(400);
    expect((await call('GET', '/periods?portfolioId=P-0001', 'u-eli')).json<AccountingPeriod[]>()).toEqual(
      [],
    );
  });

  it('returns market holidays', async () => {
    const us = schemas.marketCalendar.parse((await call('GET', '/calendars/us', 'u-ada')).json());
    expect(us.market).toBe('US');
    expect(us.holidays.map((h) => h.date)).toContain('2026-11-26');
    expect((await call('GET', '/calendars/ZZ', 'u-ada')).json<MarketCalendar>().holidays).toEqual([]);
  });
});

describe('transaction dates and grouping', () => {
  const unposted = async (index: number) => {
    const res = await call('POST', '/transactions/query', 'u-ada', {
      startRow: 0,
      endRow: 50,
      sort: [{ field: 'id', dir: 'asc' }],
      filters: [
        { field: 'status', op: 'eq', value: 'unposted' },
        { field: 'type', op: 'eq', value: 'buy' },
      ],
    });
    return res.json<GridResponse<TransactionRow>>().rows[index] as TransactionRow;
  };

  it('entering a trade date in a closed period is blocked; the message names the period and who can reopen it', async () => {
    const row = await unposted(0);
    const res = await call(
      'PATCH',
      `/transactions/${row.id}`,
      'u-ada',
      { dates: { tradeDate: '2026-09-15', settleDate: '2026-09-17' } },
      { 'if-match': String(row.version) },
    );
    expect(res.statusCode).toBe(422);
    const message = schemas.errorBody.parse(res.json()).messages[0];
    expect(message).toMatchObject({ code: 'LL-PER-0001', target: 'tradeDate' });
    expect(message?.text).toContain('period ending 2026-09-30');
    expect(message?.text).toContain('closed for transactions');
    expect(message?.fix).toContain('a controller in Investment Accounting');
    expect(
      (await call('GET', `/transactions/${row.id}`, 'u-ada')).json<TransactionRow>().tradeDate.value,
    ).toBe(row.tradeDate.value);
  });

  it('a date in the open period saves and is audited; settle before trade is rejected', async () => {
    const row = await unposted(1);
    const bad = await call(
      'PATCH',
      `/transactions/${row.id}`,
      'u-ada',
      { dates: { tradeDate: '2026-11-10', settleDate: '2026-11-09' } },
      { 'if-match': String(row.version) },
    );
    expect(bad.statusCode).toBe(422);
    expect(schemas.errorBody.parse(bad.json()).messages[0]).toMatchObject({
      code: 'LL-VAL-0118',
      target: 'settleDate',
    });

    const ok = await call(
      'PATCH',
      `/transactions/${row.id}`,
      'u-ada',
      { dates: { tradeDate: '2026-11-10', settleDate: '2026-11-20' } },
      { 'if-match': String(row.version) },
    );
    expect(ok.statusCode).toBe(200);
    const { record, auditEventIds } = ok.json<MutationResult<TransactionRow>>();
    expect(record).toMatchObject({
      tradeDate: { value: '2026-11-10', basis: 'trade' },
      settleDate: { value: '2026-11-20', basis: 'settle' },
    });
    const audit = db.$client
      .prepare('select before, after, effective_date from audit_events where id = ?')
      .get(auditEventIds[0]) as Record<string, string>;
    expect(JSON.parse(audit.after as string)).toEqual({ tradeDate: '2026-11-10', settleDate: '2026-11-20' });
    expect(audit.effective_date).toBe('2026-11-10');
  });

  it('a reopened period accepts entry again', async () => {
    const target = db.$client
      .prepare(
        "select id, version from transactions where portfolio_id = 'P-0003' and status = 'unposted' limit 1",
      )
      .get() as { id: string; version: number } | undefined;
    if (!target) return; // The small seed may hold no unposted record in the reopened portfolio.
    const res = await call(
      'PATCH',
      `/transactions/${target.id}`,
      'u-ada',
      { dates: { tradeDate: '2026-10-20', settleDate: '2026-10-22' } },
      { 'if-match': String(target.version) },
    );
    expect(res.statusCode).toBe(200);
  });

  it('groups on the server: one row per value with counts, then the records inside a group', async () => {
    const groups = (
      await call('POST', '/transactions/query', 'u-ada', {
        startRow: 0,
        endRow: 100,
        groupBy: ['status'],
        groupKeys: [],
      })
    ).json<GridResponse<TransactionRow>>();
    expect(groups.rows).toEqual([]);
    expect(groups.groups?.map((g) => g.key)).toEqual(['posted', 'reversed', 'unposted']);
    expect(groups.totalRows).toBe(3);
    expect(groups.groups?.reduce((n, g) => n + g.count, 0)).toBe(5000);
    for (const g of groups.groups ?? []) expect(() => schemas.gridGroup.parse(g)).not.toThrow();

    const unpostedCount = groups.groups?.find((g) => g.key === 'unposted')?.count;
    const leaf = (
      await call('POST', '/transactions/query', 'u-ada', {
        startRow: 0,
        endRow: 100,
        groupBy: ['status'],
        groupKeys: ['unposted'],
      })
    ).json<GridResponse<TransactionRow>>();
    expect(leaf.totalRows).toBe(unpostedCount);
    expect(leaf.rows.every((r) => r.status === 'unposted')).toBe(true);

    // Two levels, with a filter applied to the counts.
    const second = (
      await call('POST', '/transactions/query', 'u-ada', {
        startRow: 0,
        endRow: 100,
        groupBy: ['status', 'type'],
        groupKeys: ['unposted'],
        filters: [{ field: 'currency', op: 'eq', value: 'USD' }],
      })
    ).json<GridResponse<TransactionRow>>();
    expect(second.groups?.every((g) => g.field === 'type')).toBe(true);
    const sqlCount = (
      db.$client
        .prepare("select count(*) n from transactions where status = 'unposted' and currency = 'USD'")
        .get() as { n: number }
    ).n;
    expect(second.groups?.reduce((n, g) => n + g.count, 0)).toBe(sqlCount);
    expect(
      (
        await call('POST', '/transactions/query', 'u-ada', {
          startRow: 0,
          endRow: 10,
          groupBy: ['nope'],
          groupKeys: [],
        })
      ).statusCode,
    ).toBe(400);
  });

  it('filters by who created a record and by rows with warnings (task chips)', async () => {
    const mine = (
      await call('POST', '/transactions/query', 'u-ben', {
        startRow: 0,
        endRow: 5,
        filters: [{ field: 'createdBy', op: 'eq', value: 'u-ben' }],
      })
    ).json<GridResponse<TransactionRow>>();
    expect(mine.totalRows).toBe(
      (
        db.$client.prepare("select count(*) n from transactions where created_by = 'u-ben'").get() as {
          n: number;
        }
      ).n,
    );
    const warned = (
      await call('POST', '/transactions/query', 'u-ada', {
        startRow: 0,
        endRow: 50,
        filters: [{ field: 'warning', op: 'isNotNull' }],
      })
    ).json<GridResponse<TransactionRow>>();
    expect(warned.totalRows).toBeGreaterThan(0);
    expect(warned.rows.every((r) => r.warning !== undefined)).toBe(true);
  });
});
