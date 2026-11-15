/**
 * Price Review (SPEC 8.4): prices with their tolerance result, the user-owned tolerance rules, and a preview
 * of what a rule change would do before it is saved. Stale checks know about market holidays.
 */
import type {
  FailedRule,
  GridResponse,
  PriceRow,
  ToleranceImpact,
  ToleranceRule,
} from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { actorOf, writeAudit } from '../lib/audit';
import { addBusinessDays } from '../lib/dates';
import { loadToleranceRules } from '../lib/exceptions';
import { buildGridQuery, runGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import * as schemas from '../schemas/index';

const FIELDS: Record<string, FieldSpec> = {
  id: { sql: 'x.id', type: 'text' },
  securityId: { sql: 'x.security_id', type: 'text' },
  security: { sql: 's.description', type: 'text' },
  assetClass: { sql: 's.asset_class', type: 'text' },
  priceDate: { sql: 'x.price_date', type: 'date' },
  price: { sql: 'x.price', type: 'decimal' },
  priorPrice: { sql: 'x.prior_price', type: 'decimal' },
  currency: { sql: 'x.currency', type: 'text' },
  source: { sql: 'x.source', type: 'text' },
  toleranceStatus: { sql: 'x.tolerance_status', type: 'text' },
};

export interface PriceFacts {
  price: string | null;
  prior_price: string | null;
  price_date: string;
  asset_class: string;
  market: string;
}
export type PriceVerdict =
  { status: 'ok' } | { status: 'stale' | 'variance' | 'missing'; failedRule: FailedRule };

/**
 * Judges one price against the rules for its asset class. A missing price fails the missing rule; a move larger
 * than the day-over-day threshold is a variance; an unchanged price is stale, unless the rule is holiday-aware
 * and the market was closed on the previous weekday (business rule 10).
 */
export function evaluatePrice(
  facts: PriceFacts,
  rules: ToleranceRule[],
  holidays: ReadonlySet<string>,
): PriceVerdict {
  const rule = (check: ToleranceRule['check']) =>
    rules.find((r) => r.assetClass === facts.asset_class && r.check === check);
  if (facts.price === null) {
    const missing = rule('missing');
    return missing
      ? {
          status: 'missing',
          failedRule: { ruleId: missing.id, check: 'missing', threshold: missing.threshold },
        }
      : { status: 'ok' };
  }
  if (facts.prior_price === null) return { status: 'ok' };
  const price = new Decimal(facts.price);
  const prior = new Decimal(facts.prior_price);
  const move = prior.isZero() ? new Decimal(0) : price.minus(prior).abs().div(prior.abs());
  const variance = rule('dayOverDay');
  if (variance && move.gt(variance.threshold)) {
    return {
      status: 'variance',
      failedRule: {
        ruleId: variance.id,
        check: 'dayOverDay',
        threshold: variance.threshold,
        actual: move.toDecimalPlaces(6).toString(),
      },
    };
  }
  const stale = rule('stale');
  // Only the prior close is known, so a price counts as unchanged for one market day. A rule that allows more days passes it.
  if (stale && price.eq(prior) && new Decimal(stale.threshold).lte(1)) {
    const previousWeekday = addBusinessDays(facts.price_date, -1);
    if (stale.holidayAware && holidays.has(`${facts.market}:${previousWeekday}`)) return { status: 'ok' };
    return {
      status: 'stale',
      failedRule: { ruleId: stale.id, check: 'stale', threshold: stale.threshold, actual: '1' },
    };
  }
  return { status: 'ok' };
}

export function registerPriceRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  const sqlite = db.$client;
  const SELECT = 'SELECT x.*, s.description, s.asset_class, s.market, s.isin';
  const FROM = 'FROM prices x JOIN securities s ON s.id = x.security_id';
  const holidays = () =>
    new Set(
      (
        sqlite.prepare('SELECT market, date FROM market_holidays').all() as { market: string; date: string }[]
      ).map((h) => `${h.market}:${h.date}`),
    );
  const latestDate = () =>
    (sqlite.prepare('SELECT max(price_date) AS d FROM prices').get() as { d: string }).d;
  type Raw = PriceFacts & {
    id: string;
    security_id: string;
    description: string;
    isin: string;
    currency: string;
    source: string;
    tolerance_status: PriceRow['toleranceStatus'];
  };

  app.post(`${base}/prices/query`, async (request): Promise<GridResponse<PriceRow>> => {
    requirePermission(db, request.user, 'price.view');
    const query = schemas.gridQuery.parse(request.body);
    const rules = loadToleranceRules(db);
    const closed = holidays();
    const built = buildGridQuery(query, {
      fields: FIELDS,
      defaultSort: { sql: 'x.price_date', dir: 'DESC' },
      tieBreak: 'x.id',
      today: clock.today,
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like, like, term.toUpperCase());
        return "x.security_id LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\' OR s.isin = ?";
      },
    });
    const money = (value: string | null, raw: Raw, source: string) => ({
      kind: 'price' as const,
      value,
      currency: raw.currency,
      precision: 6,
      signConvention: 'natural' as const,
      provenance: { origin: 'vendor' as const, source },
      ...(value === null ? { nullReason: 'unavailable' as const } : {}),
    });
    return runGridQuery<Raw, PriceRow>(sqlite, {
      select: SELECT,
      from: FROM,
      built,
      asOf: clock.now(),
      map: (raw) => {
        const verdict = evaluatePrice(raw, rules, closed);
        return {
          id: raw.id,
          security: {
            kind: 'security',
            id: raw.security_id,
            label: raw.description,
            altIds: { isin: raw.isin },
          },
          assetClass: raw.asset_class,
          priceDate: { value: raw.price_date, basis: 'valuation' },
          price: money(raw.price, raw, raw.source),
          priorPrice: money(raw.prior_price, raw, `${raw.source}, prior day`),
          source: raw.source,
          toleranceStatus: raw.tolerance_status,
          // The rule is shown for the stored result. If the rules changed since, it is the rule that would fail now.
          ...(raw.tolerance_status !== 'ok' && verdict.status !== 'ok'
            ? { failedRule: verdict.failedRule }
            : {}),
        };
      },
    });
  });

  app.get(`${base}/prices/tolerances`, async (request): Promise<ToleranceRule[]> => {
    requirePermission(db, request.user, 'price.view');
    return loadToleranceRules(db);
  });

  /** The rules as they would be with the edits applied. Unknown ids are refused. */
  function proposed(edits: { id: string; threshold: string; holidayAware?: boolean }[]): {
    current: ToleranceRule[];
    next: ToleranceRule[];
  } {
    const current = loadToleranceRules(db);
    for (const edit of edits) {
      if (!current.some((r) => r.id === edit.id))
        throw new HttpError(404, [
          problem(
            'LL-TOL-0404',
            `There is no tolerance rule ${edit.id}.`,
            'Refresh the rules and try again.',
            edit.id,
          ),
        ]);
    }
    const next = current.map((r) => {
      const edit = edits.find((e) => e.id === r.id);
      return edit
        ? { ...r, threshold: edit.threshold, holidayAware: edit.holidayAware ?? r.holidayAware }
        : r;
    });
    return { current, next };
  }
  function todaysPrices(): { date: string; rows: Raw[] } {
    const date = latestDate();
    return { date, rows: sqlite.prepare(`${SELECT} ${FROM} WHERE x.price_date = ?`).all(date) as Raw[] };
  }

  // Re-evaluates the latest prices under proposed rules and says how many exceptions would appear or clear (SPEC 8.4).
  app.post(`${base}/prices/tolerances/impact`, async (request): Promise<ToleranceImpact> => {
    requirePermission(db, request.user, 'price.view');
    const { rules: edits } = schemas.toleranceEdits.parse(request.body);
    const { current, next } = proposed(edits);
    const { date, rows } = todaysPrices();
    const closed = holidays();
    const impact: ToleranceImpact = { priceDate: date, appear: 0, clear: 0, failingNow: 0, failingAfter: 0 };
    for (const row of rows) {
      const now = evaluatePrice(row, current, closed).status !== 'ok';
      const after = evaluatePrice(row, next, closed).status !== 'ok';
      if (now) impact.failingNow += 1;
      if (after) impact.failingAfter += 1;
      if (!now && after) impact.appear += 1;
      if (now && !after) impact.clear += 1;
    }
    return impact;
  });

  // Saves rule changes: each changed rule gets a new version and an audit event, then the latest prices are judged again.
  app.put(`${base}/prices/tolerances`, async (request): Promise<ToleranceRule[]> => {
    requirePermission(db, request.user, 'tolerance.edit');
    const { rules: edits } = schemas.toleranceEdits.parse(request.body);
    const { current, next } = proposed(edits);
    const actor = actorOf(request.user);
    const at = clock.now();
    sqlite.transaction(() => {
      for (const rule of next) {
        const before = current.find((r) => r.id === rule.id) as ToleranceRule;
        if (before.threshold === rule.threshold && before.holidayAware === rule.holidayAware) continue;
        sqlite
          .prepare(
            'UPDATE tolerance_rules SET threshold = ?, holiday_aware = ?, version = version + 1 WHERE id = ?',
          )
          .run(rule.threshold, rule.holidayAware ? 1 : 0, rule.id);
        writeAudit(db, {
          action: 'tolerance.update',
          recordType: 'toleranceRule',
          recordId: rule.id,
          actor,
          at,
          before: { threshold: before.threshold, holidayAware: before.holidayAware, version: before.version },
          after: { threshold: rule.threshold, holidayAware: rule.holidayAware, version: before.version + 1 },
        });
      }
      const { rows } = todaysPrices();
      const closed = holidays();
      const update = sqlite.prepare(
        'UPDATE prices SET tolerance_status = ?, version = version + 1 WHERE id = ?',
      );
      for (const row of rows) {
        const status = evaluatePrice(row, next, closed).status;
        if (status !== row.tolerance_status) update.run(status, row.id);
      }
    })();
    return loadToleranceRules(db);
  });
}
