/**
 * What an external client sees (SPEC 8.6): positions and month-end statements, always inside their blotter scope.
 * A record outside the scope is refused with the reason, never shown empty.
 */
import type { GridResponse, PositionRow, Statement, User } from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { simplePdf, type PdfLine } from '../lib/files';
import { buildGridQuery, runGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';

const FIELDS: Record<string, FieldSpec> = {
  id: { sql: 'x.id', type: 'text' },
  portfolioId: { sql: 'x.portfolio_id', type: 'text' },
  portfolio: { sql: 'p.name', type: 'text' },
  securityId: { sql: 'x.security_id', type: 'text' },
  security: { sql: 's.description', type: 'text' },
  assetClass: { sql: 's.asset_class', type: 'text' },
  quantity: { sql: 'x.quantity', type: 'decimal' },
  marketValue: { sql: 'x.market_value', type: 'decimal' },
  currency: { sql: 'x.currency', type: 'text' },
};
const OUTSIDE = (what: string) =>
  new HttpError(403, [
    problem(
      'LL-SCOPE-0001',
      `${what} is outside your account scope.`,
      'You can see only the portfolios on your account. Ask your administrator if one is missing.',
    ),
  ]);

export function registerClientRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  const sqlite = db.$client;
  const scopeOf = (user: User, column: string) =>
    user.blotterScope
      ? {
          sql: `${column} IN (${user.blotterScope.map(() => '?').join(', ') || 'NULL'})`,
          params: [...user.blotterScope],
        }
      : undefined;
  interface PositionRaw {
    id: string;
    portfolio_id: string;
    portfolio_name: string;
    security_id: string;
    description: string;
    asset_class: string;
    quantity: string;
    market_value: string | null;
    currency: string;
    as_of: string;
  }
  const FROM =
    'FROM positions x JOIN portfolios p ON p.id = x.portfolio_id JOIN securities s ON s.id = x.security_id';
  const toPosition = (raw: PositionRaw): PositionRow => ({
    id: raw.id,
    portfolio: { kind: 'portfolio', id: raw.portfolio_id, label: raw.portfolio_name },
    security: { kind: 'security', id: raw.security_id, label: raw.description },
    assetClass: raw.asset_class,
    quantity: {
      kind: 'quantity',
      value: raw.quantity,
      precision: 4,
      signConvention: 'natural',
      provenance: { origin: 'calculated', source: 'Positions', asOf: `${raw.as_of}T22:00:00Z` },
    },
    marketValue: {
      kind: 'marketValue',
      value: raw.market_value,
      currency: raw.currency,
      precision: 2,
      signConvention: 'natural',
      provenance: { origin: 'calculated', source: 'Positions', asOf: `${raw.as_of}T22:00:00Z` },
      ...(raw.market_value === null ? { nullReason: 'unavailable' as const } : {}),
    },
    asOf: { value: raw.as_of, basis: 'valuation' },
  });

  app.post(`${base}/positions/query`, async (request): Promise<GridResponse<PositionRow>> => {
    requirePermission(db, request.user, 'transaction.view');
    const query = schemas.gridQuery.parse(request.body);
    // Asking for a portfolio outside the scope is refused with the reason, not answered with an empty list.
    for (const f of query.filters ?? []) {
      if (
        f.field === 'portfolioId' &&
        f.op === 'eq' &&
        request.user.blotterScope &&
        !request.user.blotterScope.includes(String(f.value))
      )
        throw OUTSIDE(`Portfolio ${String(f.value)}`);
    }
    const scope = scopeOf(request.user, 'x.portfolio_id');
    const built = buildGridQuery(query, {
      fields: FIELDS,
      defaultSort: { sql: 'x.portfolio_id', dir: 'ASC' },
      tieBreak: 'x.id',
      today: clock.today,
      ...(scope ? { scope } : {}),
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like, like, like);
        return "s.description LIKE ? ESCAPE '\\' OR x.security_id LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\'";
      },
    });
    return runGridQuery<PositionRaw, PositionRow>(sqlite, {
      select: 'SELECT x.*, p.name AS portfolio_name, s.description, s.asset_class',
      from: FROM,
      built,
      asOf: clock.now(),
      map: toPosition,
    });
  });

  interface StatementRaw {
    id: string;
    portfolio_id: string;
    portfolio_name: string;
    period_end: string;
    name: string;
  }
  const STATEMENTS =
    'SELECT st.id, st.portfolio_id, st.period_end, st.name, p.name AS portfolio_name FROM statements st JOIN portfolios p ON p.id = st.portfolio_id';

  // Month-end statements in scope, newest first.
  app.get(`${base}/statements`, async (request): Promise<Statement[]> => {
    requirePermission(db, request.user, 'export.run');
    const scope = scopeOf(request.user, 'st.portfolio_id');
    const rows = sqlite
      .prepare(
        `${STATEMENTS} ${scope ? `WHERE ${scope.sql}` : ''} ORDER BY st.period_end DESC, st.portfolio_id LIMIT 500`,
      )
      .all(...(scope?.params ?? [])) as StatementRaw[];
    return rows.map((r) => ({
      id: r.id,
      portfolio: { kind: 'portfolio', id: r.portfolio_id, label: r.portfolio_name },
      periodEnd: r.period_end,
      name: r.name,
      url: `/statements/${r.id}/download`,
    }));
  });

  app.get<{ Params: { id: string } }>(`${base}/statements/:id/download`, async (request, reply) => {
    requirePermission(db, request.user, 'export.run');
    const raw = sqlite.prepare(`${STATEMENTS} WHERE st.id = ?`).get(request.params.id) as
      StatementRaw | undefined;
    if (!raw)
      throw new HttpError(404, [
        problem(
          'LL-STM-0404',
          `There is no statement ${request.params.id}.`,
          'Choose a statement from the list.',
        ),
      ]);
    if (request.user.blotterScope && !request.user.blotterScope.includes(raw.portfolio_id))
      throw OUTSIDE('That statement');
    const positions = sqlite
      .prepare(
        `SELECT x.*, p.name AS portfolio_name, s.description, s.asset_class ${FROM} WHERE x.portfolio_id = ? ORDER BY s.description`,
      )
      .all(raw.portfolio_id) as PositionRaw[];
    const activity = sqlite
      .prepare(
        "SELECT type, count(*) AS n FROM transactions WHERE portfolio_id = ? AND status = 'posted' AND trade_date BETWEEN ? AND ? GROUP BY type ORDER BY type",
      )
      .all(raw.portfolio_id, `${raw.period_end.slice(0, 8)}01`, raw.period_end) as {
      type: string;
      n: number;
    }[];
    const lines: PdfLine[] = [
      { text: `${raw.name}`, heading: true },
      { text: `${raw.portfolio_name} (${raw.portfolio_id}). Period ending ${raw.period_end}.` },
      { text: '' },
      { text: 'Posted transactions in the period', heading: true },
      ...(activity.length ? activity.map((a) => ({ text: `${a.type}: ${a.n}` })) : [{ text: 'None.' }]),
      { text: '' },
      { text: `Holdings (${positions.length})`, heading: true },
      ...positions.map((p) => ({
        text: `${p.description.slice(0, 52).padEnd(54)} ${p.quantity.padStart(18)}  ${(p.market_value ?? 'n/a').padStart(16)} ${p.currency}`,
      })),
    ];
    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="statement-${raw.portfolio_id}-${raw.period_end}.pdf"`,
      )
      .send(simplePdf(lines));
  });
}
