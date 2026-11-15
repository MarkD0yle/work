import type { GridQuery, GridResponse, MutationResult, TransactionRow } from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
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

const as = (userId: string) => ({ 'x-ll-user': userId });
async function query(body: Partial<GridQuery>, userId = 'u-ada') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/transactions/query',
    headers: as(userId),
    payload: { startRow: 0, endRow: 50, ...body },
  });
  return { res, body: res.json<GridResponse<TransactionRow>>() };
}
const sqlCount = (where: string) =>
  (db.$client.prepare(`select count(*) n from transactions t ${where}`).get() as { n: number }).n;

describe('POST /transactions/query', () => {
  it('returns a page of valid rows, the server total and an as-of time', async () => {
    const { res, body } = await query({});
    expect(res.statusCode).toBe(200);
    expect(body.rows).toHaveLength(50);
    expect(body.totalRows).toBe(5000);
    expect(body.asOf).toBe(NOW);
    for (const row of body.rows) expect(() => schemas.transactionRow.parse(row)).not.toThrow();
  });

  it('defaults to newest trade date first and pages without overlap', async () => {
    const first = (await query({ startRow: 0, endRow: 100 })).body.rows;
    const second = (await query({ startRow: 100, endRow: 200 })).body.rows;
    const dates = [...first, ...second].map((r) => r.tradeDate.value as string);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set([...first, ...second].map((r) => r.id)).size).toBe(200);
  });

  it('sorts decimal columns as numbers, not as text', async () => {
    const { body } = await query({ sort: [{ field: 'amount', dir: 'desc' }], endRow: 200 });
    const amounts = body.rows.map((r) => new Decimal(r.amount.value as string));
    for (let i = 1; i < amounts.length; i += 1) expect(amounts[i - 1]?.gte(amounts[i] as Decimal)).toBe(true);
    expect(amounts[0]?.gt(1_000_000)).toBe(true);
  });

  it('applies every filter operator and reports the filtered total', async () => {
    const eq = await query({ filters: [{ field: 'status', op: 'eq', value: 'unposted' }] });
    expect(eq.body.totalRows).toBe(sqlCount("where status = 'unposted'"));
    expect(eq.body.rows.every((r) => r.status === 'unposted')).toBe(true);

    const inOp = await query({ filters: [{ field: 'type', op: 'in', value: ['buy', 'sell'] }] });
    expect(inOp.body.totalRows).toBe(sqlCount("where type in ('buy','sell')"));

    const between = await query({
      filters: [{ field: 'tradeDate', op: 'between', from: '2026-11-02', to: '2026-11-06' }],
    });
    expect(between.body.totalRows).toBe(sqlCount("where trade_date between '2026-11-02' and '2026-11-06'"));

    const gt = await query({ filters: [{ field: 'amount', op: 'gt', value: '1000000' }] });
    expect(gt.body.totalRows).toBe(sqlCount('where cast(amount as real) > 1000000'));
    expect(gt.body.rows.every((r) => new Decimal(r.amount.value as string).gt(1_000_000))).toBe(true);

    const isNull = await query({ filters: [{ field: 'securityId', op: 'isNull' }] });
    expect(isNull.body.rows.every((r) => r.security === null && r.type === 'fee')).toBe(true);

    const both = await query({
      filters: [
        { field: 'status', op: 'neq', value: 'posted' },
        { field: 'currency', op: 'eq', value: 'JPY' },
      ],
    });
    expect(both.body.totalRows).toBe(sqlCount("where status <> 'posted' and currency = 'JPY'"));
  });

  it('"yesterday" is the previous business day of the engine date, stored relative', async () => {
    // Engine date is Saturday 2026-11-14, so yesterday is Friday the 13th.
    const { body } = await query({ filters: [{ field: 'tradeDate', op: 'relative', period: 'yesterday' }] });
    expect(body.totalRows).toBe(sqlCount("where trade_date = '2026-11-13'"));
    expect(body.totalRows).toBeGreaterThan(0);
  });

  it('quick search matches ids, descriptions and exact identifiers', async () => {
    const sample = (await query({ filters: [{ field: 'securityId', op: 'isNotNull' }], endRow: 1 })).body
      .rows[0] as TransactionRow;
    const byId = await query({ quickSearch: sample.id });
    expect(byId.body.rows.map((r) => r.id)).toEqual([sample.id]);
    const isin = sample.security?.altIds?.isin as string;
    const byIsin = await query({ quickSearch: isin.toLowerCase() });
    expect(byIsin.body.totalRows).toBeGreaterThan(0);
    expect(byIsin.body.rows.every((r) => r.security?.altIds?.isin === isin)).toBe(true);
    expect((await query({ quickSearch: 'zzzz-no-such-thing' })).body).toMatchObject({
      rows: [],
      totalRows: 0,
    });
    // LIKE wildcards in the search text are literal.
    expect((await query({ quickSearch: '_' })).body.totalRows).toBe(0);
  });

  it('gives JPY amounts no decimals and marks non-traded quantity as not applicable', async () => {
    const jpy = (await query({ filters: [{ field: 'currency', op: 'eq', value: 'JPY' }] })).body.rows;
    expect(jpy.length).toBeGreaterThan(0);
    for (const r of jpy) {
      expect(r.amount.precision).toBe(0);
      expect(r.amount.value).not.toContain('.');
    }
    const income = (await query({ filters: [{ field: 'type', op: 'eq', value: 'income' }], endRow: 5 })).body
      .rows;
    for (const r of income) expect(r.quantity).toMatchObject({ value: null, nullReason: 'notApplicable' });
  });

  it('marks traded amounts as calculated and seeded overrides as overridden with the original value', async () => {
    const all = (await query({ endRow: 1000 })).body.rows;
    const traded = all.find((r) => r.quantity.value !== null && r.amount.provenance.origin !== 'overridden');
    expect(traded?.amount.provenance.origin).toBe('calculated');
    const overridden = all.find((r) => r.amount.provenance.origin === 'overridden');
    expect(overridden?.amount.provenance).toMatchObject({
      overrideReason: expect.any(String),
      originalValue: expect.any(String),
    });
  });

  it('rejects unknown fields and bad windows with a message, never SQL', async () => {
    const bad = await query({ sort: [{ field: 'amount; drop table transactions', dir: 'asc' }] });
    expect(bad.res.statusCode).toBe(400);
    expect(schemas.errorBody.parse(bad.res.json()).messages[0]?.code).toBe('LL-QRY-0001');
    expect((await query({ filters: [{ field: 'nope', op: 'eq', value: 1 }] })).res.statusCode).toBe(400);
    expect((await query({ startRow: 10, endRow: 10 })).res.statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/transactions/query',
          headers: as('u-ada'),
          payload: { startRow: 'x' },
        })
      ).statusCode,
    ).toBe(400);
    expect(sqlCount('')).toBe(5000);
  });

  it('Eli sees only portfolios in blotter scope', async () => {
    const { body } = await query({ endRow: 1000 }, 'u-eli');
    expect(body.totalRows).toBe(sqlCount("where portfolio_id in ('P-0007','P-0019')"));
    expect(new Set(body.rows.map((r) => r.portfolio.id))).toEqual(new Set(['P-0007', 'P-0019']));
  });
});

describe('GET and PATCH /transactions/:id', () => {
  const find = async (filters: GridQuery['filters']) => {
    const rows = (await query({ filters: filters ?? [], endRow: 500 })).body.rows;
    const row = rows.find((r) => r.quantity.value !== null && r.amount.provenance.origin === 'calculated');
    if (!row) throw new Error('No matching seeded transaction');
    return row;
  };
  const patch = (id: string, version: number | null, payload: unknown, userId = 'u-ada') =>
    app.inject({
      method: 'PATCH',
      url: `/api/v1/transactions/${id}`,
      headers: { ...as(userId), ...(version === null ? {} : { 'if-match': String(version) }) },
      payload: payload as object,
    });
  const unposted = () => find([{ field: 'status', op: 'eq', value: 'unposted' }]);

  it('returns one transaction; out-of-scope records are not found for Eli', async () => {
    const row = await unposted();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/transactions/${row.id}`,
      headers: as('u-ada'),
    });
    expect(schemas.transactionRow.parse(res.json())).toEqual(row);
    const outside = (
      await query({ filters: [{ field: 'portfolioId', op: 'eq', value: 'P-0001' }], endRow: 1 })
    ).body.rows[0] as TransactionRow;
    expect(
      (await app.inject({ method: 'GET', url: `/api/v1/transactions/${outside.id}`, headers: as('u-eli') }))
        .statusCode,
    ).toBe(404);
  });

  it('an override cannot save without a reason', async () => {
    const row = await unposted();
    for (const reason of [undefined, '', '   ']) {
      const res = await patch(row.id, row.version, {
        changes: { amount: '123.45' },
        ...(reason === undefined ? {} : { reason }),
      });
      expect(res.statusCode).toBe(400);
      expect(schemas.errorBody.parse(res.json()).messages[0]).toMatchObject({
        code: 'LL-VAL-0001',
        target: 'reason',
      });
    }
    const unchanged = await app.inject({
      method: 'GET',
      url: `/api/v1/transactions/${row.id}`,
      headers: as('u-ada'),
    });
    expect(unchanged.json<TransactionRow>()).toEqual(row);
  });

  it('an override with a reason saves, keeps the original value and writes audit with before and after', async () => {
    const row = await unposted();
    const target = new Decimal(row.amount.value as string).plus(10).toFixed(row.amount.precision);
    const res = await patch(row.id, row.version, {
      changes: { amount: target },
      reason: 'Agreed with broker',
    });
    expect(res.statusCode).toBe(200);
    const { record, auditEventIds } = res.json<MutationResult<TransactionRow>>();
    expect(record.version).toBe(row.version + 1);
    expect(record.amount).toMatchObject({
      value: target,
      provenance: {
        origin: 'overridden',
        overriddenBy: { id: 'u-ada' },
        overrideReason: 'Agreed with broker',
        originalValue: row.amount.value,
        asOf: NOW,
      },
    });

    expect(auditEventIds).toHaveLength(1);
    const audit = db.$client
      .prepare('select * from audit_events where id = ?')
      .get(auditEventIds[0]) as Record<string, string | number>;
    expect(audit).toMatchObject({
      action: 'transaction.override',
      record_type: 'transaction',
      record_id: row.id,
      at: NOW,
      immutable: 1,
    });
    expect(JSON.parse(audit.before as string)).toEqual({ amount: row.amount.value });
    expect(JSON.parse(audit.after as string)).toEqual({ amount: target });
    expect(JSON.parse(audit.note as string)).toEqual({
      kind: 'overrideJustification',
      text: 'Agreed with broker',
    });
    expect(JSON.parse(audit.actor as string)).toMatchObject({ type: 'user', id: 'u-ada' });

    // A second override keeps the first original value.
    const again = await patch(row.id, record.version, {
      changes: { amount: '1.00' },
      reason: 'Second correction',
    });
    expect(again.json<MutationResult<TransactionRow>>().record.amount.provenance.originalValue).toBe(
      row.amount.value,
    );
  });

  it('editing price recalculates the amount and audits both, with no reason needed', async () => {
    const row = await unposted();
    const res = await patch(row.id, row.version, { changes: { price: '50' } });
    expect(res.statusCode).toBe(200);
    const { record, auditEventIds } = res.json<MutationResult<TransactionRow>>();
    expect(record.price.value).toBe('50.000000');
    expect(record.amount.value).not.toBe(row.amount.value);
    expect(record.amount.provenance.origin).toBe('calculated');
    const audit = db.$client
      .prepare('select action, before, after, note from audit_events where id = ?')
      .get(auditEventIds[0]) as Record<string, string | null>;
    expect(audit.action).toBe('transaction.edit');
    expect(Object.keys(JSON.parse(audit.after as string)).sort()).toEqual(['amount', 'price']);
    expect(audit.note).toBeNull();
  });

  it('a stale version is a conflict that returns the current record', async () => {
    const row = await unposted();
    const res = await patch(row.id, row.version + 7, { changes: { price: '51' } });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ record: TransactionRow }>().record.id).toBe(row.id);
    expect((await patch(row.id, null, { changes: { price: '51' } })).statusCode).toBe(400);
  });

  it('a posted transaction cannot be edited, and the message says what to do', async () => {
    const row = await find([{ field: 'status', op: 'eq', value: 'posted' }]);
    expect(row.amount.locked).toBeUndefined();
    const res = await patch(row.id, row.version, { changes: { price: '1' } });
    expect(res.statusCode).toBe(422);
    expect(schemas.errorBody.parse(res.json()).messages[0]?.fix).toMatch(/Reverse it/);
  });

  it('permissions are enforced server-side with an explanation', async () => {
    const row = await unposted();
    // Ben can edit but cannot override.
    const ben = await patch(row.id, row.version, { changes: { amount: '5.00' }, reason: 'Trying' }, 'u-ben');
    expect(ben.statusCode).toBe(403);
    expect(schemas.errorBody.parse(ben.json()).permission).toMatchObject({
      action: 'transaction.override',
      allowed: false,
    });
    // Cleo is view-only on transaction entry.
    const cleo = await patch(row.id, row.version, { changes: { price: '5' } }, 'u-cleo');
    expect(schemas.errorBody.parse(cleo.json()).permission?.explanation).toMatch(/view transactions/);
    // Fay cannot edit either; Rafa can view.
    expect((await query({}, 'u-rafa')).res.statusCode).toBe(200);
  });
});
