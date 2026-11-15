import type {
  BusinessDate,
  FinancialKind,
  FinancialValue,
  GridResponse,
  Message,
  MutationResult,
  Provenance,
  TransactionFinancialField,
  TransactionRow,
  User,
} from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { normaliseBusinessDate } from '../lib/dates';
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
};

const SELECT = `
  SELECT t.*, p.name AS portfolio_name, p.calendar AS portfolio_calendar,
         s.description AS security_label, s.isin, s.cusip, s.sedol, s.ticker, s.asset_class
  FROM transactions t
  JOIN portfolios p ON p.id = t.portfolio_id
  LEFT JOIN securities s ON s.id = t.security_id`;

interface Raw {
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
}

function toRow(raw: Raw): TransactionRow {
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

  const load = (id: string, user: User): Raw => {
    const scope = scopeFor(user);
    const raw = sqlite
      .prepare(`${SELECT} WHERE t.id = ? ${scope ? `AND ${scope.sql}` : ''}`)
      .get(id, ...(scope?.params ?? [])) as Raw | undefined;
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
    const clauses = `${built.where} ${built.orderBy}`;
    const from = `FROM transactions t${/\bp\./.test(clauses) ? ' JOIN portfolios p ON p.id = t.portfolio_id' : ''}${
      /\bs\./.test(clauses) ? ' LEFT JOIN securities s ON s.id = t.security_id' : ''
    }`;
    const ids = sqlite
      .prepare(`SELECT t.id ${from} ${built.where} ${built.orderBy} LIMIT ? OFFSET ?`)
      .pluck()
      .all(...built.params, built.limit, built.offset) as string[];
    const byId = new Map(
      (ids.length
        ? (sqlite.prepare(`${SELECT} WHERE t.id IN (${ids.map(() => '?').join(', ')})`).all(...ids) as Raw[])
        : []
      ).map((raw) => [raw.id, raw]),
    );
    const rows = ids.flatMap((id) => byId.get(id) ?? []);
    const total = sqlite.prepare(`SELECT count(*) AS n ${from} ${built.where}`).get(...built.params) as {
      n: number;
    };
    return { rows: rows.map(toRow), totalRows: total.n, asOf: clock.now() };
  });

  app.get<{ Params: { id: string } }>(
    `${base}/transactions/:id`,
    async (request): Promise<TransactionRow> => {
      requirePermission(db, request.user, 'transaction.view');
      return toRow(load(request.params.id, request.user));
    },
  );

  app.patch<{ Params: { id: string } }>(
    `${base}/transactions/:id`,
    async (request): Promise<MutationResult<TransactionRow>> => {
      requirePermission(db, request.user, 'transaction.edit');
      const patch = schemas.transactionPatch.parse(request.body);
      const fields = Object.keys(patch.changes) as TransactionFinancialField[];
      if (fields.length === 0)
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
        const before = toRow(raw);
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

        const next = { quantity: raw.quantity, price: raw.price, amount: raw.amount };
        for (const field of fields) {
          const decimals = field === 'quantity' ? 4 : field === 'price' ? 6 : minor(raw.currency);
          next[field] = new Decimal(patch.changes[field] as string).toFixed(decimals);
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
            'UPDATE transactions SET quantity = ?, price = ?, amount = ?, overrides = ?, version = version + 1 WHERE id = ?',
          )
          .run(
            next.quantity,
            next.price,
            next.amount,
            Object.keys(overrides).length ? JSON.stringify(overrides) : null,
            raw.id,
          );
        const after = toRow(load(raw.id, request.user));

        const changed = (['quantity', 'price', 'amount'] as const).filter(
          (f) => before[f].value !== after[f].value,
        );
        const pick = (row: TransactionRow) => Object.fromEntries(changed.map((f) => [f, row[f].value]));
        const seq = (sqlite.prepare('SELECT count(*) AS n FROM audit_events').get() as { n: number }).n + 1;
        const auditId = `AU-${String(seq).padStart(7, '0')}`;
        sqlite
          .prepare(
            `INSERT INTO audit_events (id, action, record_type, record_id, actor, at, effective_date, before, after, note, immutable)
           VALUES (?, ?, 'transaction', ?, ?, ?, ?, ?, ?, ?, 1)`,
          )
          .run(
            auditId,
            isOverride ? 'transaction.override' : 'transaction.edit',
            raw.id,
            JSON.stringify(actor),
            at,
            raw.trade_date,
            JSON.stringify(pick(before)),
            JSON.stringify(pick(after)),
            isOverride ? JSON.stringify({ kind: 'overrideJustification', text: reason }) : null,
          );
        return { record: after, auditEventIds: [auditId] };
      })();

      return result;
    },
  );
}
