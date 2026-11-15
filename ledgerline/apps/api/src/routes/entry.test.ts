import type {
  AuditEvent,
  BulkResult,
  ImportMapping,
  ImportRowResult,
  MutationResult,
  TransactionRow,
} from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { migrateDb, openDb, type Db } from '../db/client';
import { seed } from '../db/seed';
import * as schemas from '../schemas/index';
import { parseImportDate, parseImportNumber } from './entry';

let db: Db;
let app: ReturnType<typeof buildApp>;
let base: { id: string; portfolio_id: string; security_id: string; isin: string; price: string };
beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  seed(db, 'small');
  app = buildApp(db, { today: '2026-11-14', now: () => '2026-11-14T16:30:00.000Z' });
  // An unposted buy in an open period, in a portfolio everyone can see, gives every test realistic values.
  base = db.$client
    .prepare(
      `select t.id, t.portfolio_id, t.security_id, s.isin, t.price from transactions t join securities s on s.id = t.security_id
       join portfolios p on p.id = t.portfolio_id
       where t.status = 'unposted' and t.type = 'buy' and t.trade_date >= '2026-11-02' and s.status = 'active' and p.status = 'active' and s.isin is not null
       order by t.id limit 1`,
    )
    .get() as typeof base;
});
afterAll(() => app.close());

const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, userId = 'u-ada') =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { 'x-ll-user': userId },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
const good = () => ({
  portfolioId: base.portfolio_id,
  securityId: base.security_id,
  type: 'buy',
  tradeDate: '2026-11-13',
  settleDate: '2026-11-16',
  quantity: '1000',
  price: base.price,
});
const count = () => (db.$client.prepare('select count(*) as n from transactions').get() as { n: number }).n;
const mapping: ImportMapping = {
  targetType: 'transaction',
  columns: [
    { sourceHeader: 'Id', targetField: 'id' },
    { sourceHeader: 'Portfolio', targetField: 'portfolioId' },
    { sourceHeader: 'Security', targetField: 'securityId' },
    { sourceHeader: 'Type', targetField: 'type' },
    { sourceHeader: 'Trade date', targetField: 'tradeDate' },
    { sourceHeader: 'Settle date', targetField: 'settleDate' },
    { sourceHeader: 'Quantity', targetField: 'quantity' },
    { sourceHeader: 'Price', targetField: 'price' },
  ],
};
const sheetRow = (over: Record<string, string> = {}) => ({
  Portfolio: base.portfolio_id,
  Security: base.isin,
  Type: 'Purchase',
  'Trade date': '13/11/2026',
  'Settle date': '16 Nov 2026',
  Quantity: '1.5k',
  Price: base.price,
  ...over,
});

describe('spreadsheet value parsing', () => {
  it('reads the date forms people paste', () => {
    expect(parseImportDate('2026-11-13')).toBe('2026-11-13');
    expect(parseImportDate('13/11/2026')).toBe('2026-11-13');
    expect(parseImportDate('13.11.26')).toBe('2026-11-13');
    expect(parseImportDate('13 Nov 2026')).toBe('2026-11-13');
    expect(parseImportDate('13-November-26')).toBe('2026-11-13');
    expect(parseImportDate('soon')).toBe('soon');
  });
  it('reads numbers without ever using a float', () => {
    expect(parseImportNumber('1,250,000.50')).toBe('1250000.50');
    expect(parseImportNumber('(1,200)')).toBe('-1200');
    expect(parseImportNumber('1.5m')).toBe('1500000');
    expect(parseImportNumber('2.25k')).toBe('2250');
    expect(parseImportNumber('0.0000015bn')).toBe('1500');
    expect(parseImportNumber('1.2345678k')).toBe('1234.5678');
    expect(parseImportNumber('abc')).toBe('abc');
  });
});

describe('POST /transactions', () => {
  it('creates an unposted transaction, calculates the amount and audits it', async () => {
    const res = await call('POST', '/transactions', good());
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json<MutationResult<TransactionRow>>();
    schemas.transactionRow.parse(body.record);
    expect(body.record.status).toBe('unposted');
    expect(body.record.amount.value).not.toBeNull();
    expect(body.record.amount.provenance?.origin).toBeDefined();
    const audit = (await call('GET', `/audit/record/transaction/${body.record.id}`)).json<AuditEvent[]>();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('transaction.create');
    expect(audit[0]?.after).toMatchObject({ quantity: body.record.quantity.value, tradeDate: '2026-11-13' });
    audit.forEach((e) => schemas.auditEvent.parse(e));
  });

  it('refuses errors with a message per field', async () => {
    const before = count();
    const res = await call('POST', '/transactions', { ...good(), settleDate: '2026-11-10', quantity: '-5' });
    expect(res.statusCode).toBe(422);
    const { messages } = res.json<{ messages: { code: string; target: string }[] }>();
    expect(messages.map((m) => m.code)).toEqual(expect.arrayContaining(['LL-VAL-0118', 'LL-VAL-0073']));
    expect(messages.find((m) => m.code === 'LL-VAL-0118')?.target).toBe('settleDate');
    expect(count()).toBe(before);
  });

  it('holds a warning until it is acknowledged, then records the acknowledgement', async () => {
    const late = { ...good(), settleDate: '2026-11-27' };
    const first = await call('POST', '/transactions', late);
    expect(first.statusCode).toBe(422);
    expect(first.json<{ needsAcknowledgement: string[] }>().needsAcknowledgement).toEqual(['LL-VAL-0142']);
    const second = await call('POST', '/transactions', { ...late, acknowledgedWarnings: ['LL-VAL-0142'] });
    expect(second.statusCode, second.body).toBe(201);
    const id = second.json<MutationResult<TransactionRow>>().record.id;
    const audit = (await call('GET', `/audit/record/transaction/${id}`)).json<AuditEvent[]>();
    expect(audit[0]?.note?.kind).toBe('warningAcknowledged');
  });

  it('records where a clone came from', async () => {
    const res = await call('POST', '/transactions', { ...good(), cloneOf: base.id });
    const id = res.json<MutationResult<TransactionRow>>().record.id;
    const audit = (await call('GET', `/audit/record/transaction/${id}`)).json<AuditEvent[]>();
    expect(audit[0]?.action).toBe('transaction.clone');
    expect(audit[0]?.after).toMatchObject({ clonedFrom: base.id });
  });

  it('is refused for a user without create permission', async () => {
    expect((await call('POST', '/transactions', good(), 'u-dev')).statusCode).toBe(403);
  });
});

describe('imports', () => {
  it('validates rows, resolving identifiers, dates and shorthand numbers', async () => {
    const res = await call('POST', '/imports/validate', {
      mapping,
      rows: [
        sheetRow(),
        sheetRow({ Security: 'NOPE', Quantity: 'lots' }),
        sheetRow({ 'Settle date': '2026-11-01' }),
      ],
    });
    expect(res.statusCode, res.body).toBe(200);
    const rows = res.json<ImportRowResult[]>();
    rows.forEach((r) => schemas.importRowResult.parse(r));
    expect(rows.map((r) => r.status)).toEqual(['valid', 'error', 'error']);
    expect(rows[0]?.parsed).toMatchObject({
      securityId: base.security_id,
      type: 'buy',
      tradeDate: '2026-11-13',
      settleDate: '2026-11-16',
      quantity: '1500',
    });
    expect(rows[1]?.messages.map((m) => m.target)).toEqual(
      expect.arrayContaining(['securityId', 'quantity']),
    );
    expect(rows[2]?.messages[0]?.code).toBe('LL-VAL-0118');
  });

  it('commits nothing while any row has an error', async () => {
    const before = count();
    const res = await call('POST', '/imports/commit', {
      mapping,
      rows: [sheetRow(), sheetRow({ Quantity: 'lots' })],
      fileEvidence: { name: 'trades.csv' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ rows: ImportRowResult[] }>().rows.map((r) => r.rowNumber)).toEqual([2]);
    expect(count()).toBe(before);
  });

  it('asks before importing rows with warnings', async () => {
    const rows = [sheetRow({ 'Settle date': '2026-11-27' })];
    const first = await call('POST', '/imports/commit', {
      mapping,
      rows,
      fileEvidence: { name: 'late.csv' },
    });
    expect(first.statusCode).toBe(422);
    expect(first.json<{ needsAcknowledgement: boolean }>().needsAcknowledgement).toBe(true);
    const second = await call('POST', '/imports/commit', {
      mapping,
      rows,
      fileEvidence: { name: 'late.csv' },
      acknowledgeWarnings: true,
    });
    expect(second.statusCode, second.body).toBe(200);
  });

  it('commits new rows and corrections, each audited as imported with the file as evidence', async () => {
    const before = count();
    const res = await call('POST', '/imports/commit', {
      mapping,
      rows: [sheetRow(), { Id: base.id, Quantity: '2,500' }],
      fileEvidence: { name: 'trades.csv' },
    });
    expect(res.statusCode, res.body).toBe(200);
    const result = res.json<BulkResult>();
    schemas.bulkResult.parse(result);
    expect(result.succeeded).toHaveLength(2);
    expect(result.succeeded[1]).toBe(base.id);
    expect(count()).toBe(before + 1);
    for (const id of result.succeeded) {
      const [event] = (await call('GET', `/audit/record/transaction/${id}`)).json<AuditEvent[]>();
      expect(event?.after).toMatchObject({ source: 'imported' });
      expect(event?.evidence?.[0]).toMatchObject({ type: 'file', label: 'trades.csv' });
      expect(event?.batchId).toBe(result.jobId);
    }
    const corrected = (await call('GET', `/transactions/${base.id}`)).json<TransactionRow>();
    expect(corrected.quantity.value).toBe('2500.0000');
    expect(corrected.quantity.provenance?.origin).toBe('imported');
    const correction = (await call('GET', `/audit/record/transaction/${base.id}`)).json<AuditEvent[]>()[0];
    expect(correction?.action).toBe('transaction.import.correct');
    expect(correction?.before).toBeDefined();
    // The mapping that worked is remembered for the next quick paste.
    expect((await call('GET', '/imports/mappings/transaction')).json<ImportMapping>().columns).toHaveLength(
      mapping.columns.length,
    );
  });

  it('refuses corrections to posted transactions and duplicate ids', async () => {
    const posted = (
      db.$client.prepare("select id from transactions where status = 'posted' limit 1").get() as {
        id: string;
      }
    ).id;
    const rows = (
      await call('POST', '/imports/validate', {
        mapping,
        rows: [
          { Id: posted, Quantity: '5' },
          { Id: base.id, Quantity: '5' },
          { Id: base.id, Quantity: '6' },
        ],
      })
    ).json<ImportRowResult[]>();
    expect(rows[0]?.messages[0]?.code).toBe('LL-IMP-0012');
    expect(rows[1]?.status).not.toBe('error');
    expect(rows[2]?.messages.map((m) => m.code)).toContain('LL-IMP-0013');
  });

  it('validates 5,000 rows in under 5 seconds', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) =>
      sheetRow(i % 100 === 7 ? { Quantity: 'bad' } : { Quantity: String(1000 + i) }),
    );
    const started = performance.now();
    const res = await call('POST', '/imports/validate', { mapping, rows });
    const elapsed = performance.now() - started;
    const out = res.json<ImportRowResult[]>();
    expect(out).toHaveLength(5000);
    expect(out.filter((r) => r.status === 'error')).toHaveLength(50);
    expect(elapsed).toBeLessThan(5000);
  });

  it('is refused for a user without import permission', async () => {
    expect(
      (await call('POST', '/imports/validate', { mapping, rows: [sheetRow()] }, 'u-dev')).statusCode,
    ).toBe(403);
  });
});
