import type {
  ActorRef,
  BulkResult,
  BusinessDate,
  FinancialKind,
  FinancialValue,
  GridResponse,
  Message,
  MutationResult,
  Permission,
  PreviewRow,
  Provenance,
  TransactionFinancialField,
  TransactionRow,
  User,
} from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import type { JobRunner } from '../jobs/runner';
import { writeAudit } from '../lib/audit';
import { endOfMonth, normaliseBusinessDate } from '../lib/dates';
import { buildGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';

const MINOR_UNITS: Record<string, number> = { JPY: 0 };
const minor = (currency: string) => MINOR_UNITS[currency] ?? 2;
const PAR_PRICED = new Set(['govt', 'corporate', 'muni', 'mbs', 'tba']);

const WARNINGS: Record<string, Pick<Message, 'text' | 'fix'>> = {
  'LL-VAL-0142': {
    text: 'Settlement date is later than usual for this security type.',
    fix: 'Check the settlement date, or acknowledge to keep it.',
  },
  'LL-VAL-0207': {
    text: 'Price differs from the latest vendor price by more than tolerance.',
    fix: 'Check the price against the trade ticket.',
  },
  'LL-VAL-0311': {
    text: 'Quantity is larger than the current position.',
    fix: 'Confirm this is not a duplicate entry.',
  },
};

const FIELDS: Record<string, FieldSpec> = {
  id: { sql: 't.id', type: 'text' },
  portfolioId: { sql: 't.portfolio_id', type: 'text' },
  portfolio: { sql: 'p.name', type: 'text' },
  securityId: { sql: 't.security_id', type: 'text' },
  security: { sql: 's.description', type: 'text' },
  type: { sql: 't.type', type: 'text' },
  tradeDate: { sql: 't.trade_date', type: 'date' },
  settleDate: { sql: 't.settle_date', type: 'date' },
  quantity: { sql: 't.quantity', type: 'decimal' },
  price: { sql: 't.price', type: 'decimal' },
  amount: { sql: 't.amount', type: 'decimal' },
  currency: { sql: 't.currency', type: 'text' },
  status: { sql: 't.status', type: 'text' },
  createdBy: { sql: 't.created_by', type: 'text' },
  /** Filter with isNotNull for "rows with warnings". */
  warning: { sql: 't.warning_code', type: 'text' },
};

export const TRANSACTION_SELECT = `
  SELECT t.*, p.name AS portfolio_name, p.calendar AS portfolio_calendar,
         s.description AS security_label, s.isin, s.cusip, s.sedol, s.ticker, s.asset_class,
         (SELECT px.price FROM prices px WHERE px.security_id = t.security_id AND px.price_date <= t.trade_date AND px.price IS NOT NULL
          ORDER BY px.price_date DESC LIMIT 1) AS vendor_price
  FROM transactions t
  JOIN portfolios p ON p.id = t.portfolio_id
  LEFT JOIN securities s ON s.id = t.security_id`;

export interface TransactionRaw {
  id: string;
  portfolio_id: string;
  portfolio_name: string;
  portfolio_calendar: string;
  security_id: string | null;
  security_label: string | null;
  isin: string | null;
  cusip: string | null;
  sedol: string | null;
  ticker: string | null;
  asset_class: string | null;
  type: string;
  trade_date: string;
  settle_date: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
  currency: string;
  status: TransactionRow['status'];
  warning_code: string | null;
  origin: 'entered' | 'imported' | 'calculated';
  created_at: string;
  overrides: string | null;
  version: number;
  vendor_price: string | null;
}

export function toTransactionRow(raw: TransactionRaw): TransactionRow {
  const overrides = (raw.overrides ? JSON.parse(raw.overrides) : {}) as Partial<
    Record<TransactionFinancialField, Provenance>
  >;
  const base: Provenance = {
    origin: raw.origin,
    source: raw.origin === 'imported' ? 'Custody feed' : 'Transaction entry',
    asOf: raw.created_at,
  };
  const traded = raw.quantity !== null && raw.price !== null;
  const value = (
    field: TransactionFinancialField,
    kind: FinancialKind,
    stored: string | null,
    precision: number,
    provenance: Provenance,
  ): FinancialValue => ({
    kind,
    value: stored,
    ...(kind === 'currencyAmount' || kind === 'price' ? { currency: raw.currency } : {}),
    precision,
    signConvention: 'natural',
    provenance: overrides[field] ?? provenance,
    // Income, fees and margin have no quantity or price: that is "not applicable", not "missing".
    ...(stored === null ? { nullReason: 'notApplicable' as const } : {}),
    // Posted and reversed records are read-only as a whole: the Status column says so once per row.
    // `locked` is kept for field-level locks, so a posted row is not a wall of lock icons.
  });
  const date = (v: string | null, basis: BusinessDate['basis']): BusinessDate => ({
    value: normaliseBusinessDate(v),
    basis,
    calendar: raw.portfolio_calendar,
  });
  const altIds = Object.fromEntries(
    Object.entries({ isin: raw.isin, cusip: raw.cusip, sedol: raw.sedol, ticker: raw.ticker }).filter(
      (e): e is [string, string] => Boolean(e[1]),
    ),
  );
  const warning = raw.warning_code ? WARNINGS[raw.warning_code] : undefined;
  return {
    id: raw.id,
    portfolio: { kind: 'portfolio', id: raw.portfolio_id, label: raw.portfolio_name },
    security: raw.security_id
      ? { kind: 'security', id: raw.security_id, label: raw.security_label ?? raw.security_id, altIds }
      : null,
    type: raw.type,
    tradeDate: date(raw.trade_date, 'trade'),
    settleDate: date(raw.settle_date, 'settle'),
    quantity: value('quantity', 'quantity', raw.quantity, 4, base),
    price: value('price', 'price', raw.price, 6, base),
    // The amount of a traded record is quantity × price, so it is calculated; changing it is an override.
    amount: value(
      'amount',
      'currencyAmount',
      raw.amount,
      minor(raw.currency),
      traded ? { ...base, origin: 'calculated', source: 'Quantity × price' } : base,
    ),
    currency: raw.currency,
    // Shown beside the price as a comparison. Only for records that have a price of their own.
    ...(raw.price !== null
      ? {
          vendorPrice: {
            kind: 'price' as const,
            value: raw.vendor_price,
            currency: raw.currency,
            precision: 6,
            signConvention: 'natural' as const,
            provenance: { origin: 'vendor' as const, source: 'Vendor price on or before the trade date' },
            ...(raw.vendor_price === null ? { nullReason: 'unavailable' as const } : {}),
          },
        }
      : {}),
    status: raw.status,
    ...(raw.warning_code && warning
      ? { warning: { code: raw.warning_code, severity: 'warning', level: 'row', target: raw.id, ...warning } }
      : {}),
    version: raw.version,
  };
}

function scopeFor(user: User): { sql: string; params: unknown[] } | undefined {
  // Clients only ever see portfolios in their blotter scope (business rule 4).
  if (!user.blotterScope) return undefined;
  return {
    sql: `t.portfolio_id IN (${user.blotterScope.map(() => '?').join(', ') || 'NULL'})`,
    params: user.blotterScope,
  };
}

export function registerTransactionRoutes(
  app: FastifyInstance,
  db: Db,
  base: string,
  clock: { today: string; now: () => string },
): void {
  const sqlite = db.$client;

  const load = (id: string, user: User): TransactionRaw => {
    const scope = scopeFor(user);
    const raw = sqlite
      .prepare(`${TRANSACTION_SELECT} WHERE t.id = ? ${scope ? `AND ${scope.sql}` : ''}`)
      .get(id, ...(scope?.params ?? [])) as TransactionRaw | undefined;
    if (!raw)
      throw new HttpError(404, [
        problem(
          'LL-TXN-0404',
          `Transaction ${id} was not found.`,
          'It may be outside your portfolio scope. Check the id.',
          id,
        ),
      ]);
    return raw;
  };

  app.post(`${base}/transactions/query`, async (request): Promise<GridResponse<TransactionRow>> => {
    requirePermission(db, request.user, 'transaction.view');
    const query = schemas.gridQuery.parse(request.body);
    const scope = scopeFor(request.user);
    const built = buildGridQuery(query, {
      fields: FIELDS,
      defaultSort: { sql: 't.trade_date', dir: 'DESC' },
      tieBreak: 't.id',
      today: clock.today,
      ...(scope ? { scope } : {}),
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        const upper = term.toUpperCase();
        params.push(like, like, like, upper, upper, upper, upper);
        return `t.id LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR s.ticker = ? OR s.isin = ? OR s.cusip = ? OR s.sedol = ?`;
      },
    });
    // Page by id first, then fetch the full rows for that page only. The id query joins a table only when a
    // filter, search or sort actually needs it, so deep pages walk an index instead of 200,000 joined rows.
    const clauses = `${built.where} ${built.orderBy} ${built.group?.sql ?? ''}`;
    const from = `FROM transactions t${/\bp\./.test(clauses) ? ' JOIN portfolios p ON p.id = t.portfolio_id' : ''}${
      /\bs\./.test(clauses) ? ' LEFT JOIN securities s ON s.id = t.security_id' : ''
    }`;
    if (built.group) {
      // One row per group value, with its record count. Groups are ordered by value so paging is stable.
      const groups = sqlite
        .prepare(
          `SELECT ${built.group.sql} AS key, count(*) AS count ${from} ${built.where} GROUP BY ${built.group.sql} ORDER BY ${built.group.sql} LIMIT ? OFFSET ?`,
        )
        .all(...built.params, built.limit, built.offset) as { key: string | null; count: number }[];
      const total = sqlite
        .prepare(`SELECT count(DISTINCT coalesce(${built.group.sql}, '')) AS n ${from} ${built.where}`)
        .get(...built.params) as { n: number };
      const field = built.group.field;
      return {
        rows: [],
        groups: groups.map((g) => ({ field, ...g })),
        totalRows: total.n,
        asOf: clock.now(),
      };
    }
    const ids = sqlite
      .prepare(`SELECT t.id ${from} ${built.where} ${built.orderBy} LIMIT ? OFFSET ?`)
      .pluck()
      .all(...built.params, built.limit, built.offset) as string[];
    const byId = new Map(
      (ids.length
        ? (sqlite
            .prepare(`${TRANSACTION_SELECT} WHERE t.id IN (${ids.map(() => '?').join(', ')})`)
            .all(...ids) as TransactionRaw[])
        : []
      ).map((raw) => [raw.id, raw]),
    );
    const rows = ids.flatMap((id) => byId.get(id) ?? []);
    const total = sqlite.prepare(`SELECT count(*) AS n ${from} ${built.where}`).get(...built.params) as {
      n: number;
    };
    return { rows: rows.map(toTransactionRow), totalRows: total.n, asOf: clock.now() };
  });

  app.get<{ Params: { id: string } }>(
    `${base}/transactions/:id`,
    async (request): Promise<TransactionRow> => {
      requirePermission(db, request.user, 'transaction.view');
      return toTransactionRow(load(request.params.id, request.user));
    },
  );

  app.patch<{ Params: { id: string } }>(
    `${base}/transactions/:id`,
    async (request): Promise<MutationResult<TransactionRow>> => {
      requirePermission(db, request.user, 'transaction.edit');
      const patch = schemas.transactionPatch.parse(request.body);
      const changes = patch.changes ?? {};
      const dates = patch.dates ?? {};
      const fields = Object.keys(changes) as TransactionFinancialField[];
      if (fields.length === 0 && Object.keys(dates).length === 0)
        throw new HttpError(400, [
          problem('LL-TXN-0001', 'No changes were sent.', 'Send at least one field to change.'),
        ]);

      const ifMatch = request.headers['if-match'];
      if (!ifMatch)
        throw new HttpError(400, [
          problem('LL-TXN-0002', 'The record version is missing.', 'Reload the record and try again.'),
        ]);

      const actor = { type: 'user' as const, id: request.user.id, name: request.user.name };
      const at = clock.now();

      const result = sqlite.transaction((): MutationResult<TransactionRow> => {
        const raw = load(request.params.id, request.user);
        const before = toTransactionRow(raw);
        if (String(raw.version) !== String(ifMatch).replace(/"/g, '')) {
          throw new HttpError(
            409,
            [
              problem(
                'LL-TXN-0409',
                'Someone else changed this transaction.',
                'Review their change, then apply yours again.',
                raw.id,
              ),
            ],
            { record: before },
          );
        }
        if (raw.status !== 'unposted') {
          throw new HttpError(422, [
            problem(
              'LL-TXN-0003',
              `This transaction is ${raw.status}, so it cannot be edited.`,
              raw.status === 'posted'
                ? 'Reverse it, then enter a corrected transaction.'
                : 'Enter a new transaction instead.',
              raw.id,
            ),
          ]);
        }

        const overrides = (raw.overrides ? JSON.parse(raw.overrides) : {}) as Partial<
          Record<TransactionFinancialField, Provenance>
        >;
        const isOverride = fields.some(
          (f) => before[f].provenance.origin === 'calculated' || before[f].provenance.origin === 'overridden',
        );
        const reason = patch.reason?.trim();
        if (isOverride) {
          // Business rule 5: overrides need the permission and a reason, and audit keeps the original value.
          requirePermission(db, request.user, 'transaction.override');
          if (!reason) {
            throw new HttpError(400, [
              {
                ...problem(
                  'LL-VAL-0001',
                  'An override needs a reason.',
                  'Say why the calculated value is being replaced.',
                  'reason',
                ),
                level: 'field',
              },
            ]);
          }
        }

        // Business dates. Entry into a closed period is blocked, and the message says who can reopen it.
        const tradeDate = dates.tradeDate ?? raw.trade_date;
        const settleDate = dates.settleDate === undefined ? raw.settle_date : dates.settleDate;
        if (dates.tradeDate && dates.tradeDate !== raw.trade_date) {
          const period = sqlite
            .prepare('SELECT period_end, closes FROM periods WHERE portfolio_id = ? AND period_end = ?')
            .get(raw.portfolio_id, endOfMonth(tradeDate)) as
            { period_end: string; closes: string } | undefined;
          const state = period
            ? (JSON.parse(period.closes) as Record<string, string>).transaction
            : undefined;
          if (period && (state === 'closed' || state === 'closing')) {
            const reopeners = sqlite
              .prepare(
                "SELECT DISTINCT u.role, u.team FROM permissions p JOIN users u ON u.id = p.user_id WHERE p.action = 'period.reopen' AND p.allowed = 1",
              )
              .all() as { role: string; team: string }[];
            const who =
              reopeners.map((r) => `a ${r.role.toLowerCase()} in ${r.team}`).join(' or ') || 'a controller';
            throw new HttpError(422, [
              problem(
                'LL-PER-0001',
                `Trade date ${tradeDate} is in the period ending ${period.period_end}, which is ${state} for transactions in ${raw.portfolio_name}.`,
                `Use a date in an open period, or ask ${who} to reopen the period.`,
                'tradeDate',
              ),
            ]);
          }
        }
        if (settleDate !== null && settleDate < tradeDate) {
          throw new HttpError(422, [
            problem(
              'LL-VAL-0118',
              'Settlement date is before trade date.',
              `Choose a settlement date on or after ${tradeDate}.`,
              'settleDate',
            ),
          ]);
        }

        const next = { quantity: raw.quantity, price: raw.price, amount: raw.amount };
        for (const field of fields) {
          const decimals = field === 'quantity' ? 4 : field === 'price' ? 6 : minor(raw.currency);
          next[field] = new Decimal(changes[field] as string).toFixed(decimals);
          const origin = before[field].provenance.origin;
          if (origin === 'calculated' || origin === 'overridden') {
            overrides[field] = {
              origin: 'overridden',
              overriddenBy: actor,
              overrideReason: reason as string,
              asOf: at,
              originalValue: before[field].provenance.originalValue ?? (before[field].value as string),
            };
          }
        }
        // A calculated amount follows quantity and price until it is overridden.
        if (
          !overrides.amount &&
          !fields.includes('amount') &&
          next.quantity !== null &&
          next.price !== null
        ) {
          const par = raw.asset_class !== null && PAR_PRICED.has(raw.asset_class);
          next.amount = new Decimal(next.quantity)
            .mul(next.price)
            .div(par ? 100 : 1)
            .toFixed(minor(raw.currency));
        }

        sqlite
          .prepare(
            'UPDATE transactions SET quantity = ?, price = ?, amount = ?, trade_date = ?, settle_date = ?, overrides = ?, version = version + 1 WHERE id = ?',
          )
          .run(
            next.quantity,
            next.price,
            next.amount,
            tradeDate,
            settleDate,
            Object.keys(overrides).length ? JSON.stringify(overrides) : null,
            raw.id,
          );
        const after = toTransactionRow(load(raw.id, request.user));

        const snapshot = (row: TransactionRow): Record<string, string | null> => ({
          quantity: row.quantity.value,
          price: row.price.value,
          amount: row.amount.value,
          tradeDate: row.tradeDate.value,
          settleDate: row.settleDate.value,
        });
        const [was, now] = [snapshot(before), snapshot(after)];
        const changed = Object.keys(was).filter((key) => was[key] !== now[key]);
        const pick = (values: Record<string, string | null>) =>
          Object.fromEntries(changed.map((key) => [key, values[key]]));
        const auditId = writeAudit(db, {
          action: isOverride ? 'transaction.override' : 'transaction.edit',
          recordType: 'transaction',
          recordId: raw.id,
          actor,
          at,
          effectiveDate: tradeDate,
          before: pick(was),
          after: pick(now),
          ...(isOverride ? { note: { kind: 'overrideJustification' as const, text: reason as string } } : {}),
        });
        return { record: after, auditEventIds: [auditId] };
      })();

      return result;
    },
  );
}

// ─────────────────────────────────────────────────────────────
// Bulk actions (SPEC 7.4). Up to INLINE_LIMIT rows run in the request; more run as a job.
// One function judges a row, so eligibility, preview, inline runs and jobs can never disagree.
// ─────────────────────────────────────────────────────────────

const BULK_ACTIONS = {
  'transaction.post': { from: 'unposted', to: 'posted', done: 'Already posted.', label: 'Post' },
  'transaction.reverse': { from: 'posted', to: 'reversed', done: 'Already reversed.', label: 'Reverse' },
  'transaction.delete': { from: 'unposted', to: null, done: '', label: 'Delete' },
} as const;
export type BulkActionId = keyof typeof BULK_ACTIONS;
export const INLINE_LIMIT = 200;
/** The most rows one bulk request may carry, inline or as a job. */
export const BULK_LIMIT = 5000;
export const BULK_HANDLER = 'transaction.bulk';
const TRADED = new Set(['buy', 'sell', 'repo', 'maturity']);

export interface BulkRun {
  actionId: BulkActionId;
  actor: ActorRef;
  scope: string[] | undefined;
  at: string;
  note: string | undefined;
  /** Shared by every audit event of the run. For a job this is the job id. */
  batchId: string;
}

type Verdict =
  | { kind: 'run'; raw: TransactionRaw }
  | { kind: 'skip'; raw: TransactionRaw; reason: string }
  | { kind: 'fail'; raw?: TransactionRaw; message: Message };

export function createTransactionBulk(db: Db) {
  const sqlite = db.$client;
  const load = sqlite.prepare(`${TRANSACTION_SELECT} WHERE t.id = ?`);
  const periodOf = sqlite.prepare(
    'SELECT period_end, closes FROM periods WHERE portfolio_id = ? AND period_end = ?',
  );
  const failure = (id: string, code: string, text: string, fix: string): Message => ({
    code,
    severity: 'error',
    level: 'row',
    text,
    fix,
    target: id,
  });

  /** What would happen to one row. Nothing is changed here. */
  function judge(actionId: BulkActionId, id: string, scope: string[] | undefined): Verdict {
    const action = BULK_ACTIONS[actionId];
    const raw = load.get(id) as TransactionRaw | undefined;
    if (!raw || (scope && !scope.includes(raw.portfolio_id))) {
      return {
        kind: 'fail',
        message: failure(
          id,
          'LL-TXN-0404',
          `Transaction ${id} was not found.`,
          'It may have been deleted, or it is outside your portfolio scope.',
        ),
      };
    }
    // Rows already in the target state are skipped, never repeated: a retry cannot post a row twice.
    if (action.to && raw.status === action.to) return { kind: 'skip', raw, reason: action.done };
    if (raw.status !== action.from) {
      // Business rule 2: cannot reverse an unposted transaction; cannot delete a posted one.
      return {
        kind: 'skip',
        raw,
        reason:
          actionId === 'transaction.reverse'
            ? 'Not posted, so there is nothing to reverse.'
            : actionId === 'transaction.delete'
              ? `It is ${raw.status}. Only unposted transactions can be deleted; reverse it instead.`
              : `It is ${raw.status}. Only unposted transactions can be posted.`,
      };
    }
    if (actionId === 'transaction.post') {
      // Business rule 1: cannot post into a closed period; the message names the period and who can reopen it.
      const period = periodOf.get(raw.portfolio_id, endOfMonth(raw.trade_date)) as
        { period_end: string; closes: string } | undefined;
      const state = period ? (JSON.parse(period.closes) as Record<string, string>).transaction : undefined;
      if (period && (state === 'closed' || state === 'closing')) {
        return {
          kind: 'fail',
          raw,
          message: failure(
            id,
            'LL-PER-0001',
            `The period ending ${period.period_end} is ${state} for transactions in ${raw.portfolio_name}.`,
            'Ask a controller in Investment Accounting to reopen the period, or change the trade date.',
          ),
        };
      }
      if (raw.settle_date !== null && raw.settle_date < raw.trade_date) {
        return {
          kind: 'fail',
          raw,
          message: failure(
            id,
            'LL-VAL-0118',
            'Settlement date is before trade date.',
            'Correct the dates, then post again.',
          ),
        };
      }
      if (raw.settle_date === null && TRADED.has(raw.type)) {
        return {
          kind: 'fail',
          raw,
          message: failure(
            id,
            'LL-VAL-0119',
            'Settlement date is missing.',
            'Add the settlement date, then post again.',
          ),
        };
      }
    }
    return { kind: 'run', raw };
  }

  function processRow(run: BulkRun, id: string, result: BulkResult): void {
    const verdict = judge(run.actionId, id, run.scope);
    if (verdict.kind === 'fail') {
      result.failed.push({ id, message: verdict.message });
      return;
    }
    if (verdict.kind === 'skip') {
      result.skipped.push({ id, reason: verdict.reason });
      return;
    }
    const { raw } = verdict;
    const action = BULK_ACTIONS[run.actionId];
    if (action.to)
      sqlite
        .prepare('UPDATE transactions SET status = ?, version = version + 1 WHERE id = ?')
        .run(action.to, id);
    else sqlite.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    writeAudit(db, {
      action: run.actionId,
      recordType: 'transaction',
      recordId: id,
      actor: run.actor,
      at: run.at,
      effectiveDate: raw.trade_date,
      before: { status: raw.status },
      after: { status: action.to ?? 'deleted' },
      batchId: run.batchId,
      ...(run.note ? { note: { kind: 'comment' as const, text: run.note } } : {}),
    });
    result.succeeded.push(id);
  }

  /** One audit event for the batch, sharing the batch id with every row's event. */
  function finish(run: BulkRun, requested: number, result: BulkResult): void {
    writeAudit(db, {
      action: `${run.actionId}.batch`,
      recordType: 'batch',
      recordId: run.batchId,
      actor: run.actor,
      at: run.at,
      batchId: run.batchId,
      after: {
        requested,
        succeeded: result.succeeded.length,
        failed: result.failed.length,
        skipped: result.skipped.length,
      },
      ...(run.note ? { note: { kind: 'comment' as const, text: run.note } } : {}),
    });
  }

  return { judge, processRow, finish };
}

export function registerTransactionBulkRoutes(
  app: FastifyInstance,
  db: Db,
  base: string,
  clock: { today: string; now: () => string },
  jobs: JobRunner,
): void {
  const sqlite = db.$client;
  const bulk = createTransactionBulk(db);
  const actorOf = (user: User): ActorRef => ({ type: 'user', id: user.id, name: user.name });

  function actionOf(actionId: string): BulkActionId {
    if (!(actionId in BULK_ACTIONS)) {
      throw new HttpError(400, [
        problem(
          'LL-BLK-0001',
          `"${actionId}" is not a bulk action for transactions.`,
          `Use one of: ${Object.keys(BULK_ACTIONS).join(', ')}.`,
          'actionId',
        ),
      ]);
    }
    return actionId as BulkActionId;
  }
  function checkSize(ids: string[]): void {
    if (ids.length > BULK_LIMIT) {
      throw new HttpError(400, [
        problem(
          'LL-BLK-0002',
          `${ids.length} records is too many for one run.`,
          `Select ${BULK_LIMIT.toLocaleString('en-US')} or fewer.`,
          'ids',
        ),
      ]);
    }
  }

  // The job form of the same action. It runs as the user who submitted it, with their permissions as they are now.
  jobs.register(BULK_HANDLER, {
    items: (job) => (job.inputs.ids as string[] | undefined) ?? [],
    processItem: (ctx, id, result) => {
      const actionId = actionOf(String(ctx.job.inputs.actionId));
      requirePermission(db, ctx.user, actionId);
      bulk.processRow(
        {
          actionId,
          actor: actorOf(ctx.user),
          scope: ctx.user.blotterScope,
          at: clock.now(),
          note: (ctx.job.inputs.reason as string | undefined)?.trim() || undefined,
          batchId: ctx.job.id,
        },
        id,
        result,
      );
    },
    finish: (ctx, result) => {
      const actionId = actionOf(String(ctx.job.inputs.actionId));
      bulk.finish(
        {
          actionId,
          actor: actorOf(ctx.user),
          scope: ctx.user.blotterScope,
          at: clock.now(),
          note: (ctx.job.inputs.reason as string | undefined)?.trim() || undefined,
          batchId: ctx.job.id,
        },
        ((ctx.job.inputs.ids as string[] | undefined) ?? []).length,
        result,
      );
    },
  });

  // Per-row eligibility before submit (SPEC 7.4): ineligible rows are counted and explained, never dropped silently.
  app.post(
    `${base}/transactions/eligibility`,
    async (request): Promise<{ id: string; permission: Permission }[]> => {
      const body = schemas.bulkRequest.parse(request.body);
      const actionId = actionOf(body.actionId);
      checkSize(body.ids);
      return body.ids.map((id) => {
        const verdict = bulk.judge(actionId, id, request.user.blotterScope);
        return {
          id,
          permission:
            verdict.kind === 'skip' || (verdict.kind === 'fail' && !verdict.raw)
              ? {
                  action: actionId,
                  accessLevel: 'none',
                  allowed: false,
                  reason: 'recordState',
                  explanation: verdict.kind === 'skip' ? verdict.reason : verdict.message.text,
                }
              : { action: actionId, accessLevel: 'full', allowed: true },
        };
      });
    },
  );

  // What the action would do to each eligible row, with anything that would make it fail (SPEC 7.4 preview).
  app.post(`${base}/transactions/preview`, async (request): Promise<PreviewRow[]> => {
    const body = schemas.bulkRequest.parse(request.body);
    const actionId = actionOf(body.actionId);
    requirePermission(db, request.user, actionId);
    checkSize(body.ids);
    const after = BULK_ACTIONS[actionId].to ?? 'deleted';
    return body.ids.flatMap((id): PreviewRow[] => {
      const verdict = bulk.judge(actionId, id, request.user.blotterScope);
      if (!verdict.raw || verdict.kind === 'skip') return [];
      const row = toTransactionRow(verdict.raw);
      const warnings = [
        ...(verdict.kind === 'fail' ? [verdict.message] : []),
        ...(row.warning ? [row.warning] : []),
      ];
      return [
        {
          id,
          before: { status: verdict.raw.status },
          after: { status: verdict.kind === 'fail' ? verdict.raw.status : after },
          ...(warnings.length ? { warnings } : {}),
        },
      ];
    });
  });

  app.post(`${base}/transactions/bulk`, async (request, reply): Promise<BulkResult> => {
    const body = schemas.bulkRequest.parse(request.body);
    const actionId = actionOf(body.actionId);
    // Permission for the action as a whole. Ben cannot reverse (business rule 3).
    requirePermission(db, request.user, actionId);
    checkSize(body.ids);
    const note = body.reason?.trim() || undefined;
    const noun = body.ids.length === 1 ? 'transaction' : 'transactions';

    if (body.ids.length > INLINE_LIMIT) {
      // Large runs are jobs: the user can leave, and the result waits in the job tray.
      const job = jobs.submit({
        type: 'bulkAction',
        name: `${BULK_ACTIONS[actionId].label} ${body.ids.length.toLocaleString('en-US')} ${noun}`,
        user: request.user,
        handler: BULK_HANDLER,
        inputs: { actionId, ids: body.ids, ...(note ? { reason: note } : {}) },
      });
      reply.code(202);
      return { jobId: job.id, status: 'queued', succeeded: [], failed: [], skipped: [] };
    }

    return sqlite.transaction((): BulkResult => {
      const seq =
        (
          sqlite
            .prepare(
              "SELECT count(*) AS n FROM audit_events WHERE action LIKE '%.batch' AND batch_id LIKE 'B-%'",
            )
            .get() as { n: number }
        ).n + 1;
      const run: BulkRun = {
        actionId,
        actor: actorOf(request.user),
        scope: request.user.blotterScope,
        at: clock.now(),
        note,
        batchId: `B-${String(seq).padStart(6, '0')}`,
      };
      const result: BulkResult = {
        jobId: run.batchId,
        status: 'completed',
        succeeded: [],
        failed: [],
        skipped: [],
      };
      for (const id of body.ids) bulk.processRow(run, id, result);
      bulk.finish(run, body.ids.length, result);
      result.status =
        result.failed.length === 0 && result.skipped.length === 0
          ? 'completed'
          : result.succeeded.length === 0
            ? 'failed'
            : 'partial';
      return result;
    })();
  });
}
