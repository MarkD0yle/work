import type {
  ApprovalRequest,
  AuditEvent,
  BulkResult,
  CloseChecklist,
  Comparison,
  ExceptionRecord,
  GridResponse,
  Job,
  PeriodOverviewRow,
  PriceRow,
  RecurringBreakRule,
  ToleranceImpact,
  ToleranceRule,
} from '@ledgerline/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { migrateDb, openDb, type Db } from '../db/client';
import { seed } from '../db/seed';
import { evaluatePrice } from './prices';

let db: Db;
let app: ReturnType<typeof buildApp>;
const PERIOD = '2026-11-30';
beforeAll(() => {
  db = openDb(':memory:');
  migrateDb(db);
  seed(db, 'small');
  app = buildApp(db, { today: '2026-11-14', now: () => '2026-11-14T16:30:00.000Z' });
});
afterAll(() => app.close());

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown, userId = 'u-cleo') =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { 'x-ll-user': userId },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
const query = async <T>(path: string, body: Record<string, unknown>, userId = 'u-cleo') =>
  (await call('POST', path, { startRow: 0, endRow: 500, ...body }, userId)).json<GridResponse<T>>();
const exception = async (id: string) => (await call('GET', `/exceptions/${id}`)).json<ExceptionRecord>();
const auditOf = async (type: string, id: string) =>
  (await call('GET', `/audit/record/${type}/${id}`)).json<AuditEvent[]>();
const bulk = (actionId: string, ids: string[], inputs: Record<string, unknown> = {}, userId = 'u-rafa') =>
  call('POST', '/exceptions/bulk', { actionId, ids, inputs }, userId);
const sql = <T>(text: string, ...params: unknown[]) => db.$client.prepare(text).all(...params) as T[];

describe('exception queue', () => {
  it('lists oldest first, and sorts severity high to low rather than by spelling', async () => {
    const page = await query<ExceptionRecord>('/exceptions/query', {});
    const times = page.rows.map((r) => r.detectedAt);
    expect([...times].sort()).toEqual(times);
    const bySeverity = await query<ExceptionRecord>('/exceptions/query', {
      sort: [{ field: 'severity', dir: 'desc' }],
    });
    const order = bySeverity.rows.map((r) => r.severity);
    expect(order.indexOf('medium')).toBeGreaterThan(order.lastIndexOf('high'));
    expect(order.indexOf('low')).toBeGreaterThan(order.lastIndexOf('medium'));
  });

  it('a user can filter to "mine, high severity, new" and bulk-assign', async () => {
    const mine = await query<ExceptionRecord>(
      '/exceptions/query',
      {
        filters: [
          { field: 'ownerId', op: 'eq', value: 'u-rafa' },
          { field: 'severity', op: 'eq', value: 'high' },
          { field: 'status', op: 'eq', value: 'new' },
        ],
      },
      'u-rafa',
    );
    expect(mine.rows.length).toBeGreaterThan(2);
    expect(
      mine.rows.every((r) => r.owner?.id === 'u-rafa' && r.severity === 'high' && r.status === 'new'),
    ).toBe(true);
    const ids = mine.rows.slice(0, 3).map((r) => r.id);
    const result = (await bulk('exception.assign', ids, { ownerId: 'u-cleo' })).json<BulkResult>();
    expect(result.succeeded).toEqual(ids);
    const after = await exception(ids[0] as string);
    expect(after).toMatchObject({ owner: { id: 'u-cleo', name: 'Cleo' }, status: 'inProgress' });
    const [event] = await auditOf('exception', ids[0] as string);
    expect(event).toMatchObject({
      action: 'exception.assign',
      before: { owner: 'Rafa', status: 'new' },
      after: { owner: 'Cleo', status: 'inProgress' },
      batchId: result.jobId,
    });
  });

  it('every resolution needs a note, a resolve needs a root-cause category, and both are audited', async () => {
    const [target] = (
      await query<ExceptionRecord>('/exceptions/query', {
        filters: [
          { field: 'type', op: 'eq', value: 'agedIncome' },
          { field: 'status', op: 'eq', value: 'new' },
        ],
      })
    ).rows as [ExceptionRecord];
    expect((await bulk('exception.resolve', [target.id], { rootCauseCategory: 'timing' })).statusCode).toBe(
      422,
    );
    expect((await bulk('exception.resolve', [target.id], { note: 'Settled on the 14th.' })).statusCode).toBe(
      422,
    );
    expect(
      (await bulk('exception.resolve', [target.id], { note: 'x', rootCauseCategory: 'weather' })).statusCode,
    ).toBe(422);
    expect(
      (await bulk('exception.acceptConditionally', [target.id], { note: 'Vendor asked.' })).statusCode,
    ).toBe(422);
    const ok = await bulk('exception.resolve', [target.id], {
      note: 'Income received on the 14th.',
      rootCauseCategory: 'timing',
    });
    expect(ok.json<BulkResult>().succeeded).toEqual([target.id]);
    expect(await exception(target.id)).toMatchObject({
      status: 'resolved',
      rootCauseCategory: 'timing',
      rootCause: 'Income received on the 14th.',
    });
    const [event] = await auditOf('exception', target.id);
    expect(event).toMatchObject({
      action: 'exception.resolve',
      note: { kind: 'comment', text: 'Income received on the 14th.' },
      after: { status: 'resolved' },
    });
    // Doing it again changes nothing: it is skipped with the reason.
    expect(
      (
        await bulk('exception.resolve', [target.id], { note: 'again', rootCauseCategory: 'timing' })
      ).json<BulkResult>().skipped,
    ).toEqual([{ id: target.id, reason: 'Already resolved.' }]);
    // Ben can look but not resolve.
    expect(
      (await bulk('exception.resolve', [target.id], { note: 'n', rootCauseCategory: 'timing' }, 'u-ben'))
        .statusCode,
    ).toBe(403);
  });

  it('one file can be attached to 50 exceptions in one action', async () => {
    const ids = (
      await query<ExceptionRecord>('/exceptions/query', {
        filters: [{ field: 'status', op: 'in', value: ['new', 'inProgress', 'waitingOnOthers'] }],
      })
    ).rows
      .slice(0, 50)
      .map((r) => r.id);
    expect(ids).toHaveLength(50);
    const result = (
      await bulk('exception.attachEvidence', ids, { evidence: { name: 'custodian-statement-2026-11.pdf' } })
    ).json<BulkResult>();
    expect(result.succeeded).toHaveLength(50);
    const first = await exception(ids[0] as string);
    const last = await exception(ids[49] as string);
    expect(first.evidence.at(-1)).toMatchObject({ type: 'file', label: 'custodian-statement-2026-11.pdf' });
    // The same file, not fifty copies.
    expect(last.evidence.at(-1)?.id).toBe(first.evidence.at(-1)?.id);
    expect((await auditOf('exception', ids[49] as string))[0]?.evidence?.[0]?.label).toBe(
      'custodian-statement-2026-11.pdf',
    );
  });

  it('the thread stays with the exception', async () => {
    const [target] = (
      await query<ExceptionRecord>('/exceptions/query', {
        filters: [{ field: 'type', op: 'eq', value: 'positionBreak' }],
      })
    ).rows as [ExceptionRecord];
    const res = await call(
      'POST',
      `/exceptions/${target.id}/thread`,
      { text: 'Custodian confirms 5,000 units. Our count is short by 200.' },
      'u-rafa',
    );
    expect(res.json<ExceptionRecord>().thread.at(-1)).toMatchObject({
      author: { name: 'Rafa' },
      text: 'Custodian confirms 5,000 units. Our count is short by 200.',
    });
    expect((await call('POST', `/exceptions/${target.id}/thread`, { text: '  ' }, 'u-rafa')).statusCode).toBe(
      400,
    );
    expect((await auditOf('exception', target.id))[0]?.action).toBe('exception.comment');
  });

  it('groups similar exceptions by type', async () => {
    const groups = await query<ExceptionRecord>('/exceptions/query', { groupBy: ['type'], groupKeys: [] });
    expect(groups.groups?.find((g) => g.key === 'cashBreak')?.count).toBe(21);
  });
});

describe('recurring-break rules', () => {
  it('a saved rule tags matching exceptions as proposals; none resolve without a person', async () => {
    const created = await call(
      'POST',
      '/exceptions/rules',
      {
        name: 'Unapplied receipts clear next day',
        match: { type: 'cashBreak', counterparty: 'Unapplied receipt' },
        rootCauseCategory: 'timing',
      },
      'u-rafa',
    );
    expect(created.statusCode).toBe(201);
    const rule = created.json<RecurringBreakRule>();
    expect(rule).toMatchObject({ proposedActionId: 'exception.resolve', createdBy: { name: 'Rafa' } });
    const { tagged } = (await call('POST', `/exceptions/rules/${rule.id}/apply`, {}, 'u-rafa')).json<{
      tagged: string[];
    }>();
    expect(tagged.length).toBeGreaterThanOrEqual(10);
    const one = await exception(tagged[0] as string);
    expect(one.matchedRuleId).toBe(rule.id);
    expect(one.proposal?.summary).toContain('A person must accept this');
    // Tagged, not resolved.
    expect(['new', 'inProgress', 'waitingOnOthers']).toContain(one.status);
    expect(
      (
        await query<ExceptionRecord>('/exceptions/query', {
          filters: [{ field: 'matchedRuleId', op: 'isNotNull' }],
        })
      ).totalRows,
    ).toBe(tagged.length);

    // A person accepts the proposal: only then does it resolve, with the rule's root cause.
    const accepted = (await bulk('exception.acceptProposal', [tagged[0] as string])).json<BulkResult>();
    expect(accepted.succeeded).toEqual([tagged[0]]);
    expect(await exception(tagged[0] as string)).toMatchObject({
      status: 'resolved',
      rootCauseCategory: 'timing',
    });
    expect((await auditOf('exception', tagged[0] as string))[0]).toMatchObject({
      action: 'exception.acceptProposal',
      actor: { name: 'Rafa' },
    });
    // An exception no rule has proposed for is skipped.
    const [untagged] = (
      await query<ExceptionRecord>('/exceptions/query', {
        filters: [{ field: 'type', op: 'eq', value: 'ratingMissing' }],
      })
    ).rows as [ExceptionRecord];
    expect(
      (await bulk('exception.acceptProposal', [untagged.id])).json<BulkResult>().skipped[0]?.reason,
    ).toBe('No rule has proposed a resolution for it.');
  });

  it("next month's matching break arrives already tagged as a proposal, still open", async () => {
    const template = sql<Record<string, string>>(
      "select * from cash_activity where status = 'applied' limit 1",
    )[0] as Record<string, string>;
    db.$client
      .prepare(
        "insert into cash_activity (id, portfolio_id, bank_account, type, amount, currency, value_date, status, reference) values ('C-NEXT-01', ?, ?, 'receipt', '1250.00', ?, '2026-11-13', 'unapplied', 'REF-NEXT-01')",
      )
      .run(template.portfolio_id, template.bank_account, template.currency);
    const run = (await call('POST', '/periods/checks/run', { periodEnd: PERIOD })).json<{
      created: string[];
      proposed: string[];
    }>();
    expect(run.created).toHaveLength(1);
    expect(run.proposed).toEqual(run.created);
    const fresh = await exception(run.created[0] as string);
    expect(fresh).toMatchObject({ type: 'cashBreak', status: 'new', recordRef: { id: 'C-NEXT-01' } });
    expect(fresh.proposal?.inputs).toMatchObject({ rootCauseCategory: 'timing' });
    // Running the check again finds nothing new.
    expect(
      (await call('POST', '/periods/checks/run', { periodEnd: PERIOD })).json<{ created: string[] }>()
        .created,
    ).toEqual([]);
  });

  it('rules are edited and deleted with an audit trail, by people allowed to', async () => {
    expect(
      (
        await call(
          'POST',
          '/exceptions/rules',
          { name: 'x', match: { type: 'cashBreak' }, rootCauseCategory: 'timing' },
          'u-dev',
        )
      ).statusCode,
    ).toBe(403);
    const rule = (
      await call(
        'POST',
        '/exceptions/rules',
        { name: 'Small fees', match: { type: 'cashBreak', maxAmount: '50.00' }, rootCauseCategory: 'timing' },
        'u-rafa',
      )
    ).json<RecurringBreakRule>();
    const updated = (
      await call(
        'PUT',
        `/exceptions/rules/${rule.id}`,
        {
          name: 'Small fees under 100',
          match: { type: 'cashBreak', maxAmount: '100.00' },
          rootCauseCategory: 'custodianError',
        },
        'u-rafa',
      )
    ).json<RecurringBreakRule>();
    expect(updated).toMatchObject({
      id: rule.id,
      name: 'Small fees under 100',
      rootCauseCategory: 'custodianError',
    });
    expect((await call('DELETE', `/exceptions/rules/${rule.id}`, undefined, 'u-rafa')).statusCode).toBe(204);
    expect((await auditOf('exceptionRule', rule.id)).map((e) => e.action)).toEqual([
      'exceptionRule.delete',
      'exceptionRule.update',
      'exceptionRule.create',
    ]);
  });
});

describe('price review', () => {
  it('each price exception names the rule, threshold and actual move', async () => {
    const page = await query<ExceptionRecord>(
      '/exceptions/query',
      { filters: [{ field: 'type', op: 'eq', value: 'priceVariance' }] },
      'u-dev',
    );
    expect(page.rows.length).toBeGreaterThan(0);
    for (const row of page.rows) {
      expect(row.failedRule?.ruleId).toMatch(/^TOL-.+-dod$/);
      expect(row.failedRule?.check).toBe('dayOverDay');
      expect(Number(row.failedRule?.actual)).toBeGreaterThan(Number(row.failedRule?.threshold));
    }
    const stale = (
      await query<ExceptionRecord>(
        '/exceptions/query',
        { filters: [{ field: 'type', op: 'eq', value: 'priceStale' }] },
        'u-dev',
      )
    ).rows[0];
    expect(stale?.failedRule).toMatchObject({ check: 'stale', threshold: '1' });
  });

  it('a price unchanged across a market holiday is not stale', () => {
    const rules: ToleranceRule[] = [
      {
        id: 'TOL-govt-stale',
        version: 1,
        assetClass: 'govt',
        check: 'stale',
        threshold: '1',
        holidayAware: true,
      },
      {
        id: 'TOL-govt-dod',
        version: 1,
        assetClass: 'govt',
        check: 'dayOverDay',
        threshold: '0.02',
        holidayAware: true,
      },
      {
        id: 'TOL-govt-missing',
        version: 1,
        assetClass: 'govt',
        check: 'missing',
        threshold: '0',
        holidayAware: true,
      },
    ];
    const unchanged = {
      price: '99.5',
      prior_price: '99.5',
      price_date: '2026-11-27',
      asset_class: 'govt',
      market: 'US',
    };
    expect(evaluatePrice(unchanged, rules, new Set())).toMatchObject({
      status: 'stale',
      failedRule: { ruleId: 'TOL-govt-stale', actual: '1' },
    });
    // Thursday 26 November is a US market holiday: the market was closed, so no new price was due.
    expect(evaluatePrice(unchanged, rules, new Set(['US:2026-11-26']))).toEqual({ status: 'ok' });
    // The same holiday on another market does not excuse it.
    expect(evaluatePrice(unchanged, rules, new Set(['UK:2026-11-26'])).status).toBe('stale');
    // A rule that is not holiday-aware still flags it.
    expect(
      evaluatePrice(
        unchanged,
        [{ ...(rules[0] as ToleranceRule), holidayAware: false }],
        new Set(['US:2026-11-26']),
      ).status,
    ).toBe('stale');
    expect(evaluatePrice({ ...unchanged, price: '102.5' }, rules, new Set())).toMatchObject({
      status: 'variance',
      failedRule: { threshold: '0.02', actual: '0.030151' },
    });
    expect(evaluatePrice({ ...unchanged, price: null }, rules, new Set())).toMatchObject({
      status: 'missing',
    });
    expect(evaluatePrice({ ...unchanged, price: '100' }, rules, new Set())).toEqual({ status: 'ok' });
  });

  it('changing a tolerance shows how many exceptions appear or clear before it is saved, and saving is audited', async () => {
    const rules = (await call('GET', '/prices/tolerances', undefined, 'u-dev')).json<ToleranceRule[]>();
    const loosen = rules
      .filter((r) => r.check === 'dayOverDay')
      .map((r) => ({ id: r.id, threshold: '0.99' }));
    const tighten = rules
      .filter((r) => r.check === 'dayOverDay')
      .map((r) => ({ id: r.id, threshold: '0.0001' }));
    const same = (
      await call(
        'POST',
        '/prices/tolerances/impact',
        { rules: [{ id: rules[0]?.id, threshold: rules[0]?.threshold }] },
        'u-dev',
      )
    ).json<ToleranceImpact>();
    expect(same).toMatchObject({ priceDate: '2026-11-13', appear: 0, clear: 0 });
    const looser = (
      await call('POST', '/prices/tolerances/impact', { rules: loosen }, 'u-dev')
    ).json<ToleranceImpact>();
    expect(looser.appear).toBe(0);
    expect(looser.clear).toBeGreaterThan(0);
    expect(looser.failingAfter).toBe(looser.failingNow - looser.clear);
    const tighter = (
      await call('POST', '/prices/tolerances/impact', { rules: tighten }, 'u-dev')
    ).json<ToleranceImpact>();
    expect(tighter.appear).toBeGreaterThan(100);
    // Nothing was saved by previewing.
    expect((await call('GET', '/prices/tolerances', undefined, 'u-dev')).json<ToleranceRule[]>()).toEqual(
      rules,
    );

    // Only Market Data may change rules. A saved change is versioned and audited, and the prices are judged again.
    expect((await call('PUT', '/prices/tolerances', { rules: loosen }, 'u-cleo')).statusCode).toBe(403);
    const before =
      sql<{ n: number }>(
        "select count(*) as n from prices where price_date = '2026-11-13' and tolerance_status = 'variance'",
      )[0]?.n ?? 0;
    const saved = (await call('PUT', '/prices/tolerances', { rules: loosen }, 'u-dev')).json<
      ToleranceRule[]
    >();
    const changed = saved.find((r) => r.id === loosen[0]?.id);
    expect(changed).toMatchObject({ threshold: '0.99', version: 2 });
    expect(before).toBeGreaterThan(0);
    expect(
      sql<{ n: number }>(
        "select count(*) as n from prices where price_date = '2026-11-13' and tolerance_status = 'variance'",
      )[0]?.n,
    ).toBe(0);
    expect((await auditOf('toleranceRule', loosen[0]?.id as string))[0]).toMatchObject({
      action: 'tolerance.update',
      actor: { name: 'Dev' },
      after: { threshold: '0.99', version: 2 },
    });
    await call(
      'PUT',
      '/prices/tolerances',
      {
        rules: rules
          .filter((r) => r.check === 'dayOverDay')
          .map((r) => ({ id: r.id, threshold: r.threshold })),
      },
      'u-dev',
    );
  });

  it('lists prices with the prior day beside them and the failed rule', async () => {
    const page = await query<PriceRow>(
      '/prices/query',
      {
        filters: [
          { field: 'priceDate', op: 'eq', value: '2026-11-13' },
          { field: 'toleranceStatus', op: 'eq', value: 'stale' },
        ],
      },
      'u-dev',
    );
    expect(page.totalRows).toBe(35);
    expect(page.rows[0]).toMatchObject({
      toleranceStatus: 'stale',
      failedRule: { check: 'stale' },
      priceDate: { basis: 'valuation' },
    });
    expect(page.rows[0]?.price.value).toBe(page.rows[0]?.priorPrice.value);
  });
});

describe('period close', () => {
  const blockedBy = (portfolioId: string) =>
    sql<{ id: string }>(
      "select id from exceptions where portfolio_id = ? and period_end = ? and severity = 'high' and status in ('new','inProgress','waitingOnOthers')",
      portfolioId,
      PERIOD,
    ).map((r) => r.id);
  const periodId = (portfolioId: string) => `PER-${portfolioId.slice(2)}-2026-11`;
  const closeJob = async (portfolioIds: string[], userId = 'u-cleo') =>
    app.jobs.drain(
      (await call('POST', '/periods/close', { portfolioIds, periodEnd: PERIOD }, userId)).json<Job>().id,
    );
  let clean: string[] = [];
  let blocked = '';

  it('the overview shows every owned portfolio with cutoff and blocking counts on one screen', async () => {
    const mine = (await call('GET', `/periods/overview?periodEnd=${PERIOD}`)).json<PeriodOverviewRow[]>();
    expect(mine).toHaveLength(20);
    expect(mine[0]).toMatchObject({ cutoff: '2026-12-07T18:00:00Z', checksTotal: 10, state: 'open' });
    const all = (await call('GET', `/periods/overview?periodEnd=${PERIOD}&scope=all`)).json<
      PeriodOverviewRow[]
    >();
    expect(all).toHaveLength(60);
    blocked = (mine.find((r) => r.blocking > 0) as PeriodOverviewRow).portfolio.id;
    clean = mine
      .filter((r) => r.blocking === 0)
      .slice(0, 2)
      .map((r) => r.portfolio.id);
    const row = mine.find((r) => r.portfolio.id === blocked) as PeriodOverviewRow;
    expect(row.blocking).toBe(blockedBy(blocked).length);
    expect(row.checksPassed).toBeLessThan(10);
    // Someone who controls no portfolio sees them all.
    expect(
      (await call('GET', `/periods/overview?periodEnd=${PERIOD}`, undefined, 'u-rafa')).json<
        PeriodOverviewRow[]
      >(),
    ).toHaveLength(60);
  });

  it('the checklist names what is blocking', async () => {
    const list = (await call('GET', `/periods/${periodId(blocked)}/checklist`)).json<CloseChecklist>();
    expect(list.checks).toHaveLength(10);
    expect(list.blocking.map((b) => b.id).sort()).toEqual(blockedBy(blocked).sort());
    expect(list.blocking[0]?.label).toMatch(/: /);
    expect(list.checks.some((c) => c.status === 'blocked')).toBe(true);
  });

  it('closing many portfolios is one job with a result per portfolio; a blocked one fails and names its exceptions', async () => {
    const job = await closeJob([...clean, blocked]);
    expect(job.type).toBe('periodClose');
    expect(job.status).toBe('partial');
    expect(job.result?.succeeded.sort()).toEqual([...clean].sort());
    const failure = job.result?.failed[0];
    expect(failure?.id).toBe(blocked);
    expect(failure?.message.code).toBe('LL-CLS-0001');
    for (const id of blockedBy(blocked).slice(0, 5)) expect(failure?.message.text).toContain(id);
    expect(failure?.message.fix).toContain('second approver');
    const closed = sql<{ state: string; closes: string }>(
      'select state, closes from periods where id = ?',
      periodId(clean[0] as string),
    )[0];
    expect(closed?.state).toBe('closed');
    expect((await auditOf('period', periodId(clean[0] as string)))[0]).toMatchObject({
      action: 'period.close',
      before: { state: 'open' },
      after: { state: 'closed' },
      batchId: job.id,
    });
    // Posting into the closed period is now refused, naming the period (business rule 1).
    const again = await closeJob(clean);
    expect(again.result?.skipped.map((s) => s.reason)).toEqual(['Already closed.', 'Already closed.']);
    expect(
      (await call('POST', '/periods/close', { portfolioIds: clean, periodEnd: PERIOD }, 'u-ada')).statusCode,
    ).toBe(403);
  });

  it('a block override needs a reason and a second approver; self-approval is refused', async () => {
    expect(
      (await call('POST', `/periods/${periodId(blocked)}/override-block`, { reason: ' ' })).statusCode,
    ).toBe(400);
    expect(
      (await call('POST', `/periods/${periodId(clean[0] as string)}/override-block`, { reason: 'x' }))
        .statusCode,
    ).toBe(409);
    expect(
      (await call('POST', `/periods/${periodId(blocked)}/override-block`, { reason: 'x' }, 'u-ada'))
        .statusCode,
    ).toBe(403);
    const res = await call('POST', `/periods/${periodId(blocked)}/override-block`, {
      reason: 'Custodian wire confirmed by phone; statement follows Monday.',
    });
    expect(res.statusCode).toBe(201);
    const request = res.json<ApprovalRequest>();
    expect(request).toMatchObject({
      status: 'pending',
      actionId: 'period.overrideBlock',
      maker: { id: 'u-cleo' },
    });
    expect(
      (await call('POST', `/periods/${periodId(blocked)}/override-block`, { reason: 'again' })).statusCode,
    ).toBe(409);

    // Still blocked while the request is pending, and the message says so.
    const pending = await closeJob([blocked]);
    expect(pending.result?.failed[0]?.message.fix).toContain(request.id);

    // Cleo made the request, so she cannot decide it.
    const self = await call('POST', `/approvals/${request.id}/decide`, { decision: 'approve' });
    expect(self.statusCode).toBe(403);
    expect(self.json<{ messages: { code: string; text: string }[] }>().messages[0]).toMatchObject({
      code: 'LL-APR-0001',
    });
    expect(self.json<{ messages: { text: string }[] }>().messages[0]?.text).toContain(
      'segregation of duties',
    );
    expect(
      (await call('POST', '/approvals/decide', { decision: 'approve', ids: [request.id] })).json<BulkResult>()
        .failed[0]?.message.code,
    ).toBe('LL-APR-0001');
    // Someone without the permission cannot either.
    expect(
      (await call('POST', `/approvals/${request.id}/decide`, { decision: 'approve' }, 'u-ada')).statusCode,
    ).toBe(403);

    const approved = (
      await call(
        'POST',
        `/approvals/${request.id}/decide`,
        { decision: 'approve', note: 'Seen the wire confirmation.' },
        'u-fay',
      )
    ).json<ApprovalRequest>();
    expect(approved).toMatchObject({
      status: 'approved',
      checker: { name: 'Fay' },
      note: 'Seen the wire confirmation.',
    });
    const job = await closeJob([blocked]);
    expect(job.status).toBe('completed');
    const [event] = await auditOf('period', periodId(blocked));
    expect(event).toMatchObject({ action: 'period.close', note: { kind: 'overrideJustification' } });
    expect(event?.note?.text).toContain('Custodian wire confirmed by phone');
    expect(event?.note?.text).toContain('Approved by Fay');
    expect(
      (await call('GET', `/periods/${periodId(blocked)}/checklist`)).json<CloseChecklist>().override?.status,
    ).toBe('approved');
  });

  it('sign-off records who and when, and produces a downloadable close package', async () => {
    const id = periodId(blocked);
    expect((await call('POST', `/periods/${id}/package`)).statusCode).toBe(409);
    expect((await call('POST', `/periods/${id}/signoff`, { note: 'x' }, 'u-ada')).statusCode).toBe(403);
    const signed = (
      await call('POST', `/periods/${id}/signoff`, {
        note: 'Closed under override; wire statement due Monday.',
      })
    ).json<{ signedBy: { name: string }; at: string; note: string }>();
    expect(signed).toMatchObject({
      signedBy: { name: 'Cleo' },
      at: '2026-11-14T16:30:00.000Z',
      note: 'Closed under override; wire statement due Monday.',
    });
    const res = await call('POST', `/periods/${id}/package`);
    expect(res.statusCode).toBe(202);
    const job = app.jobs.drain(res.json<Job>().id);
    expect(job.status).toBe('completed');
    expect(job.outputs?.map((o) => o.format)).toEqual(['pdf', 'xlsx']);
    const pdf = await call('GET', `/jobs/${job.id}/outputs/0`);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.rawPayload.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(pdf.rawPayload.toString('latin1')).toContain('Signed off by Cleo');
    expect(pdf.rawPayload.toString('latin1')).toContain('High-severity exceptions still open');
    const xlsx = await call('GET', `/jobs/${job.id}/outputs/1`);
    expect(xlsx.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(xlsx.rawPayload.toString('utf8')).toContain('Closed under override; wire statement due Monday.');
    expect(xlsx.rawPayload.toString('utf8')).toContain('period.signoff');
    // A period that is not fully closed cannot be signed off.
    const open = sql<{ id: string }>(
      "select id from periods where period_end = ? and state = 'open' limit 1",
      PERIOD,
    )[0]?.id as string;
    expect((await call('POST', `/periods/${open}/signoff`, {})).statusCode).toBe(409);
  });

  it('reopen needs a reason and the permission, goes to a second approver, and all of it is audited', async () => {
    const id = periodId(clean[0] as string);
    expect((await call('POST', '/periods/reopen', { periodId: id, reason: '' })).statusCode).toBe(400);
    expect(
      (await call('POST', '/periods/reopen', { periodId: id, reason: 'Late trade' }, 'u-ada')).statusCode,
    ).toBe(403);
    const request = (
      await call('POST', '/periods/reopen', {
        periodId: id,
        closeTypes: ['transaction'],
        reason: 'Late corporate action notice from the custodian.',
      })
    ).json<ApprovalRequest>();
    expect(request).toMatchObject({ status: 'pending', actionId: 'period.reopen' });
    expect((await call('GET', `/periods/${id}/checklist`)).json<CloseChecklist>().reopen?.id).toBe(
      request.id,
    );
    // Nothing is reopened until someone else approves.
    expect(sql<{ state: string }>('select state from periods where id = ?', id)[0]?.state).toBe('closed');
    await call('POST', `/approvals/${request.id}/decide`, { decision: 'approve' }, 'u-fay');
    const after = sql<{ state: string; closes: string }>(
      'select state, closes from periods where id = ?',
      id,
    )[0];
    expect(after?.state).toBe('reopened');
    expect(JSON.parse(after?.closes ?? '{}')).toMatchObject({ transaction: 'reopened', valuation: 'closed' });
    const history = await auditOf('period', id);
    expect(history.map((e) => e.action).slice(0, 2)).toEqual(['period.reopen', 'period.reopen.request']);
    expect(history[0]?.note?.text).toContain('Late corporate action notice from the custodian.');
    expect(history[0]?.note?.text).toContain('Approved by Fay');
    expect(history[1]?.note?.text).toBe('Late corporate action notice from the custodian.');
  });

  it('a rejected request returns to its maker with the note', async () => {
    const id = periodId(clean[1] as string);
    const request = (
      await call('POST', '/periods/reopen', { periodId: id, reason: 'Want to rebook a fee.' })
    ).json<ApprovalRequest>();
    expect(
      (await call('POST', `/approvals/${request.id}/decide`, { decision: 'reject' }, 'u-fay')).statusCode,
    ).toBe(422);
    await call(
      'POST',
      `/approvals/${request.id}/decide`,
      { decision: 'reject', note: 'Book the fee in December instead.' },
      'u-fay',
    );
    expect(sql<{ state: string }>('select state from periods where id = ?', id)[0]?.state).toBe('closed');
    const mine = await query<ApprovalRequest>('/approvals/query', {
      filters: [
        { field: 'makerId', op: 'eq', value: 'u-cleo' },
        { field: 'status', op: 'eq', value: 'rejected' },
      ],
    });
    expect(mine.rows.find((r) => r.id === request.id)).toMatchObject({
      status: 'rejected',
      note: 'Book the fee in December instead.',
      checker: { name: 'Fay' },
    });
    // A user who is not an approver sees only their own requests: none here.
    expect((await query<ApprovalRequest>('/approvals/query', {}, 'u-ada')).totalRows).toBe(0);
    expect(
      (await call('POST', `/approvals/${request.id}/decide`, { decision: 'approve' }, 'u-fay')).statusCode,
    ).toBe(409);
  });
});

describe('comparison and audit list', () => {
  it('compares the investment book with the accounting book, and shows a market-value break as a difference', async () => {
    const [mv] = sql<{ portfolio_id: string; record_ref: string }>(
      "select portfolio_id, record_ref from exceptions where type = 'marketValueBreak' and status in ('new','inProgress') limit 1",
    );
    const comparison = (
      await call('POST', '/comparisons', { kind: 'books', portfolioId: mv?.portfolio_id })
    ).json<Comparison>();
    expect(comparison).toMatchObject({
      leftLabel: 'Investment book',
      rightLabel: 'Accounting book',
      tolerancePct: '0.5',
    });
    expect(comparison.rows.length).toBeGreaterThan(0);
    expect(comparison.rows[0]?.left).toMatchObject({
      kind: 'marketValue',
      provenance: { source: 'Investment book' },
    });
  });

  it('the audit list is filterable and shows every action of the close with before and after', async () => {
    const page = await query<AuditEvent>('/audit/query', {
      filters: [{ field: 'recordType', op: 'eq', value: 'period' }],
    });
    const actions = new Set(page.rows.map((e) => e.action));
    for (const action of [
      'period.close',
      'period.overrideBlock.request',
      'period.overrideBlock.approved',
      'period.signoff',
      'period.reopen.request',
      'period.reopen',
      'period.reopen.rejected',
    ])
      expect(actions, action).toContain(action);
    expect(page.rows.every((e) => e.immutable)).toBe(true);
    const closes = page.rows.filter((e) => e.action === 'period.close');
    expect(closes.every((e) => e.before && e.after)).toBe(true);
    const byActor = await query<AuditEvent>('/audit/query', {
      filters: [{ field: 'actorId', op: 'eq', value: 'u-fay' }],
    });
    expect(byActor.rows.every((e) => e.actor.id === 'u-fay')).toBe(true);
    expect((await call('POST', '/audit/query', { startRow: 0, endRow: 10 }, 'u-eli')).statusCode).toBe(403);
  });
});
