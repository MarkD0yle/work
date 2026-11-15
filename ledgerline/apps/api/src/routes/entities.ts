import type {
  AccountingPeriod,
  EntityKind,
  EntitySearchResult,
  MarketCalendar,
  User,
} from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { HttpError, problem } from '../lib/http';
import * as schemas from '../schemas/index';

const LIMIT = 50;
const SEARCHABLE: EntityKind[] = ['portfolio', 'security', 'manager', 'report'];

interface SecurityRaw {
  id: string;
  isin: string;
  cusip: string | null;
  sedol: string | null;
  ticker: string | null;
  description: string;
  asset_class: string;
  currency: string;
  issuer: string;
  status: 'active' | 'inactive';
}

interface PortfolioRaw {
  id: string;
  name: string;
  type: string;
  base_currency: string;
  manager: string;
  status: 'active' | 'inactive';
}

const security = (raw: SecurityRaw, matchedOn?: string): EntitySearchResult => ({
  ref: {
    kind: 'security',
    id: raw.id,
    label: raw.description,
    altIds: Object.fromEntries(
      Object.entries({ isin: raw.isin, cusip: raw.cusip, sedol: raw.sedol, ticker: raw.ticker }).filter(
        (e): e is [string, string] => Boolean(e[1]),
      ),
    ),
  },
  description: raw.description,
  type: raw.asset_class,
  currency: raw.currency,
  status: raw.status,
  parent: raw.issuer,
  ...(matchedOn ? { matchedOn } : {}),
});

const portfolio = (raw: PortfolioRaw, user: User, matchedOn?: string): EntitySearchResult => ({
  ref: { kind: 'portfolio', id: raw.id, label: raw.name },
  description: raw.name,
  type: raw.type,
  currency: raw.base_currency,
  status: raw.status,
  parent: raw.manager,
  ...(matchedOn ? { matchedOn } : {}),
  // Restricted records are returned with the reason, never silently omitted (business rule 4).
  ...(user.blotterScope && !user.blotterScope.includes(raw.id)
    ? { restricted: { reason: 'Outside your account scope.' } }
    : {}),
});

/** Turns free text into an FTS5 query: every word must match as a prefix. Punctuation never reaches the query language. */
function ftsQuery(q: string): string | null {
  const words = q.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.length ? words.map((w) => `"${w}"*`).join(' ') : null;
}

export function registerEntityRoutes(app: FastifyInstance, db: Db, base: string): void {
  const sqlite = db.$client;
  const byIsin = sqlite.prepare('SELECT * FROM securities WHERE isin = ?');
  const byCusip = sqlite.prepare('SELECT * FROM securities WHERE cusip = ?');
  const bySedol = sqlite.prepare('SELECT * FROM securities WHERE sedol = ?');
  const byTicker = sqlite.prepare('SELECT * FROM securities WHERE ticker = ? LIMIT 20');
  const byId = sqlite.prepare('SELECT * FROM securities WHERE id = ?');

  interface Criteria {
    held: boolean;
    includeInactive: boolean;
    type?: string;
    currency?: string;
  }

  function searchSecurities(q: string, c: Criteria): EntitySearchResult[] {
    const { held, includeInactive } = c;
    const where = [
      held ? 's.held = 1' : '',
      includeInactive ? '' : "s.status = 'active'",
      c.type ? 's.asset_class = ?' : '',
      c.currency ? 's.currency = ?' : '',
    ].filter(Boolean);
    const whereParams = [c.type, c.currency].filter((v): v is string => Boolean(v));
    const fits = (r: EntitySearchResult) =>
      (!c.type || r.type === c.type) &&
      (!c.currency || r.currency === c.currency) &&
      (includeInactive || r.status === 'active');
    if (!q) {
      // Criteria only (sheet mode): the first matches, without a text search.
      return (
        sqlite
          .prepare(
            `SELECT s.* FROM securities s ${where.length ? `WHERE ${where.join(' AND ')}` : ''} LIMIT ?`,
          )
          .all(...whereParams, LIMIT) as SecurityRaw[]
      ).map((raw) => security(raw));
    }
    const upper = q.toUpperCase();
    // Exact identifier matches rank first.
    const exact: EntitySearchResult[] = [];
    for (const [stmt, name] of [
      [byId, 'id'],
      [byIsin, 'isin'],
      [byCusip, 'cusip'],
      [bySedol, 'sedol'],
      [byTicker, 'ticker'],
    ] as const) {
      for (const raw of stmt.all(upper) as SecurityRaw[]) exact.push(security(raw, name));
    }
    const seen = new Set(exact.map((r) => r.ref.id));
    const match = ftsQuery(q);
    const text = match
      ? (sqlite
          .prepare(
            `SELECT s.* FROM securities_fts f JOIN securities s ON s.rowid = f.rowid
             WHERE securities_fts MATCH ? ${where.map((w) => `AND ${w}`).join(' ')}
             LIMIT ?`,
          )
          .all(match, ...whereParams, LIMIT) as SecurityRaw[])
      : [];
    return [
      ...exact.filter(fits),
      ...text.filter((raw) => !seen.has(raw.id)).map((raw) => security(raw)),
    ].slice(0, LIMIT);
  }

  function searchPortfolios(q: string, user: User, includeInactive: boolean): EntitySearchResult[] {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = sqlite
      .prepare(
        `SELECT * FROM portfolios WHERE (id LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\') ${includeInactive ? '' : "AND status = 'active'"} ORDER BY id LIMIT ?`,
      )
      .all(like, like, LIMIT) as PortfolioRaw[];
    return rows
      .map((raw) => portfolio(raw, user, raw.id.toUpperCase() === q.toUpperCase() ? 'id' : undefined))
      .sort((a, b) => Number(Boolean(b.matchedOn)) - Number(Boolean(a.matchedOn)));
  }

  function search(kind: EntityKind, q: string, user: User, c: Criteria): EntitySearchResult[] {
    const { includeInactive } = c;
    switch (kind) {
      case 'security':
        return searchSecurities(q, c);
      case 'portfolio':
        return searchPortfolios(q, user, includeInactive).filter(
          (r) => (!c.type || r.type === c.type) && (!c.currency || r.currency === c.currency),
        );
      case 'manager': {
        const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        return (
          sqlite
            .prepare(
              "SELECT manager, count(*) n FROM portfolios WHERE manager LIKE ? ESCAPE '\\' GROUP BY manager ORDER BY manager",
            )
            .all(like) as { manager: string; n: number }[]
        ).map((m) => ({
          ref: { kind: 'manager', id: m.manager, label: m.manager },
          description: m.manager,
          type: `${m.n} portfolios`,
          status: 'active',
        }));
      }
      case 'report': {
        const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        return (
          sqlite
            .prepare(
              "SELECT id, name, description FROM reports WHERE name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' ORDER BY name",
            )
            .all(like, like) as { id: string; name: string; description: string }[]
        ).map((r) => ({
          ref: { kind: 'report', id: r.id, label: r.name },
          description: r.description,
          type: 'Report',
          status: 'active',
        }));
      }
      default:
        throw new HttpError(400, [
          problem(
            'LL-ENT-0001',
            `Search is not available for ${kind} records yet.`,
            `Search one of: ${SEARCHABLE.join(', ')}.`,
            'kind',
          ),
        ]);
    }
  }

  function resolve(kind: string, id: string, user: User): EntitySearchResult | null {
    if (kind === 'security') {
      const raw = byId.get(id) as SecurityRaw | undefined;
      return raw ? security(raw) : null;
    }
    if (kind === 'portfolio') {
      const raw = sqlite.prepare('SELECT * FROM portfolios WHERE id = ?').get(id) as PortfolioRaw | undefined;
      return raw ? portfolio(raw, user) : null;
    }
    return null;
  }

  app.get<{
    Querystring: {
      kind?: string;
      q?: string;
      scope?: string;
      includeInactive?: string;
      type?: string;
      currency?: string;
    };
  }>(`${base}/entities/search`, async (request): Promise<EntitySearchResult[]> => {
    const kind = schemas.entityKind.parse(request.query.kind);
    const q = (request.query.q ?? '').trim();
    const { type, currency } = request.query;
    // Text is needed unless criteria narrow the list (sheet mode).
    if (!q && !type && !currency) return [];
    return search(kind, q, request.user, {
      held: request.query.scope === 'held',
      includeInactive: request.query.includeInactive === 'true',
      ...(type ? { type } : {}),
      ...(currency ? { currency } : {}),
    });
  });

  app.get<{ Querystring: { kind?: string } }>(
    `${base}/entities/recent`,
    async (request): Promise<EntitySearchResult[]> => {
      const kind = schemas.entityKind.parse(request.query.kind);
      const rows = sqlite
        .prepare(
          'SELECT entity_id FROM entity_recents WHERE user_id = ? AND kind = ? ORDER BY seq DESC LIMIT 10',
        )
        .all(request.user.id, kind) as { entity_id: string }[];
      return rows.flatMap((r) => resolve(kind, r.entity_id, request.user) ?? []);
    },
  );

  app.post(`${base}/entities/recent`, async (request, reply) => {
    const body = schemas.entityRef.pick({ kind: true, id: true }).parse(request.body);
    const seq = (
      sqlite.prepare('SELECT coalesce(max(seq), 0) + 1 AS n FROM entity_recents').get() as { n: number }
    ).n;
    sqlite
      .prepare(
        'INSERT INTO entity_recents (user_id, kind, entity_id, seq) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, kind, entity_id) DO UPDATE SET seq = excluded.seq',
      )
      .run(request.user.id, body.kind, body.id, seq);
    reply.code(204);
  });

  // ── Periods and calendars, for date and period fields ───
  app.get<{ Querystring: { portfolioId?: string } }>(
    `${base}/periods`,
    async (request): Promise<AccountingPeriod[]> => {
      const id = request.query.portfolioId;
      if (!id)
        throw new HttpError(400, [
          problem(
            'LL-PER-0400',
            'A portfolio is needed to list periods.',
            'Send portfolioId.',
            'portfolioId',
          ),
        ]);
      if (request.user.blotterScope && !request.user.blotterScope.includes(id)) return [];
      const rows = sqlite
        .prepare(
          'SELECT id, portfolio_id, period_end, cutoff, state, closes FROM periods WHERE portfolio_id = ? ORDER BY period_end DESC',
        )
        .all(id) as {
        id: string;
        portfolio_id: string;
        period_end: string;
        cutoff: string;
        state: AccountingPeriod['state'];
        closes: string;
      }[];
      return rows.map((r) => ({
        id: r.id,
        portfolioId: r.portfolio_id,
        periodEnd: r.period_end,
        cutoff: r.cutoff,
        state: r.state,
        closes: JSON.parse(r.closes) as AccountingPeriod['closes'],
      }));
    },
  );

  app.get<{ Params: { market: string } }>(
    `${base}/calendars/:market`,
    async (request): Promise<MarketCalendar> => {
      const market = request.params.market.toUpperCase();
      const holidays = sqlite
        .prepare('SELECT date, name FROM market_holidays WHERE market = ? ORDER BY date')
        .all(market) as MarketCalendar['holidays'];
      return { market, holidays };
    },
  );
}
