/**
 * Turns the shared GridQuery (sort, filters, quick search, row window) into SQL.
 * Each list endpoint supplies a whitelist of fields, so nothing from the request reaches SQL as text.
 */
import type { FilterCondition, GridQuery, GridResponse } from '@ledgerline/contracts';
import type { Db } from '../db/client';
import { addBusinessDays, addDays, endOfMonth, shiftMonthEnd } from './dates';
import { HttpError, problem } from './http';

export interface FieldSpec {
  /** SQL expression for the column. */
  sql: string;
  /** Decimals are stored as text; compare and sort them as numbers. */
  type: 'text' | 'date' | 'decimal';
  /** Sort by this instead, when the stored text does not sort in a meaningful order (severity: high, medium, low). */
  sortSql?: string;
}

export interface BuiltQuery {
  where: string;
  orderBy: string;
  params: unknown[];
  limit: number;
  offset: number;
  /** Set when the query asks for a group level: return one row per value of this expression, not records. */
  group?: { field: string; sql: string };
}

const MAX_PAGE = 1000;

function unknownField(field: string, fields: Record<string, FieldSpec>): never {
  throw new HttpError(400, [
    problem(
      'LL-QRY-0001',
      `"${field}" is not a field of this list.`,
      `Use one of: ${Object.keys(fields).join(', ')}.`,
      field,
    ),
  ]);
}

const expr = (spec: FieldSpec) => (spec.type === 'decimal' ? `CAST(${spec.sql} AS REAL)` : spec.sql);
const bind = (spec: FieldSpec, value: unknown) => (spec.type === 'decimal' ? Number(value) : value);

function relativeRange(c: Extract<FilterCondition, { op: 'relative' }>, today: string): [string, string] {
  switch (c.period) {
    case 'today':
      return [today, today];
    case 'yesterday': {
      // "Yesterday" means the previous business day: on a Monday it is Friday.
      const day = addBusinessDays(today, -1);
      return [day, day];
    }
    case 'thisPeriod':
      return [addDays(shiftMonthEnd(today, -1), 1), endOfMonth(today)];
    case 'lastPeriod':
      return [addDays(shiftMonthEnd(today, -2), 1), shiftMonthEnd(today, -1)];
    case 'lastNDays':
      return [addDays(today, -(c.n ?? 7)), today];
  }
}

function condition(
  c: FilterCondition,
  fields: Record<string, FieldSpec>,
  today: string,
  params: unknown[],
): string {
  const spec = fields[c.field] ?? unknownField(c.field, fields);
  const col = expr(spec);
  switch (c.op) {
    case 'eq':
      params.push(bind(spec, c.value));
      return `${col} = ?`;
    case 'neq':
      params.push(bind(spec, c.value));
      return `${col} <> ?`;
    case 'gt':
      params.push(bind(spec, c.value));
      return `${col} > ?`;
    case 'lt':
      params.push(bind(spec, c.value));
      return `${col} < ?`;
    case 'in': {
      const values = Array.isArray(c.value) ? c.value : [c.value];
      if (values.length === 0) return '0';
      params.push(...values.map((v) => bind(spec, v)));
      return `${col} IN (${values.map(() => '?').join(', ')})`;
    }
    case 'contains':
      params.push(`%${String(c.value).replace(/[\\%_]/g, '\\$&')}%`);
      return `${spec.sql} LIKE ? ESCAPE '\\'`;
    case 'between':
      params.push(bind(spec, c.from), bind(spec, c.to));
      return `${col} BETWEEN ? AND ?`;
    case 'relative': {
      const [from, to] = relativeRange(c, today);
      params.push(from, to);
      return `${spec.sql} BETWEEN ? AND ?`;
    }
    case 'isNull':
      return `${spec.sql} IS NULL`;
    case 'isNotNull':
      return `${spec.sql} IS NOT NULL`;
  }
}

export function buildGridQuery(
  query: GridQuery,
  options: {
    fields: Record<string, FieldSpec>;
    /** Builds the quick-search clause; pushes its own params. */
    quickSearch: (term: string, params: unknown[]) => string;
    defaultSort: { sql: string; dir: 'ASC' | 'DESC' };
    /** Unique column appended to every sort so paging is stable. It follows the first sort's direction, so one index can serve both. */
    tieBreak: string;
    today: string;
    /** Extra clauses applied before user filters, e.g. blotter scope. */
    scope?: { sql: string; params: unknown[] };
  },
): BuiltQuery {
  if (query.endRow <= query.startRow) {
    throw new HttpError(400, [
      problem('LL-QRY-0002', 'The row window is empty.', 'Send endRow greater than startRow.'),
    ]);
  }
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (options.scope) {
    clauses.push(options.scope.sql);
    params.push(...options.scope.params);
  }
  for (const c of query.filters ?? []) clauses.push(condition(c, options.fields, options.today, params));
  const term = query.quickSearch?.trim();
  if (term) clauses.push(`(${options.quickSearch(term, params)})`);

  // Grouping (server-side row model): groupKeys pin the levels already opened; the next groupBy field,
  // if any, is the level being asked for.
  const groupBy = query.groupBy ?? [];
  const groupKeys = query.groupKeys ?? [];
  groupKeys.forEach((key, level) => {
    const field = groupBy[level];
    if (!field) return;
    const spec = options.fields[field] ?? unknownField(field, options.fields);
    if (key === '' || key === null) clauses.push(`${spec.sql} IS NULL`);
    else {
      clauses.push(`${spec.sql} = ?`);
      params.push(key);
    }
  });
  const groupField = groupBy[groupKeys.length];
  const groupSpec = groupField
    ? (options.fields[groupField] ?? unknownField(groupField, options.fields))
    : undefined;

  const requested = (query.sort ?? []).map((s) => {
    const spec = options.fields[s.field] ?? unknownField(s.field, options.fields);
    return { sql: spec.sortSql ?? expr(spec), dir: s.dir === 'desc' ? ('DESC' as const) : ('ASC' as const) };
  });
  const sort = requested.length ? requested : [options.defaultSort];
  const tieDir = (sort[0] as (typeof sort)[number]).dir;

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    orderBy: `ORDER BY ${[...sort.map((x) => `${x.sql} ${x.dir}`), `${options.tieBreak} ${tieDir}`].join(', ')}`,
    params,
    limit: Math.min(query.endRow - query.startRow, MAX_PAGE),
    offset: query.startRow,
    ...(groupField && groupSpec ? { group: { field: groupField, sql: groupSpec.sql } } : {}),
  };
}

/**
 * Runs a built query against one table expression and returns the shared grid response:
 * records for a normal page, or one row per value with its count when a group level is asked for.
 */
export function runGridQuery<Raw, Row>(
  sqlite: Db['$client'],
  options: { select: string; from: string; built: BuiltQuery; map: (raw: Raw) => Row; asOf: string },
): GridResponse<Row> {
  const { built, from } = options;
  if (built.group) {
    const groups = sqlite
      .prepare(
        `SELECT ${built.group.sql} AS key, count(*) AS count ${from} ${built.where} GROUP BY ${built.group.sql} ORDER BY ${built.group.sql} LIMIT ? OFFSET ?`,
      )
      .all(...built.params, built.limit, built.offset) as { key: string | null; count: number }[];
    const total = sqlite
      .prepare(`SELECT count(DISTINCT coalesce(${built.group.sql}, '')) AS n ${from} ${built.where}`)
      .get(...built.params) as { n: number };
    const field = built.group.field;
    return { rows: [], groups: groups.map((g) => ({ field, ...g })), totalRows: total.n, asOf: options.asOf };
  }
  const rows = sqlite
    .prepare(`${options.select} ${from} ${built.where} ${built.orderBy} LIMIT ? OFFSET ?`)
    .all(...built.params, built.limit, built.offset) as Raw[];
  const total = sqlite.prepare(`SELECT count(*) AS n ${from} ${built.where}`).get(...built.params) as {
    n: number;
  };
  return { rows: rows.map(options.map), totalRows: total.n, asOf: options.asOf };
}
