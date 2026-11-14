/**
 * Turns the shared GridQuery (sort, filters, quick search, row window) into SQL.
 * Each list endpoint supplies a whitelist of fields, so nothing from the request reaches SQL as text.
 */
import type { FilterCondition, GridQuery } from '@ledgerline/contracts';
import { addBusinessDays, addDays, endOfMonth, shiftMonthEnd } from './dates';
import { HttpError, problem } from './http';

export interface FieldSpec {
  /** SQL expression for the column. */
  sql: string;
  /** Decimals are stored as text; compare and sort them as numbers. */
  type: 'text' | 'date' | 'decimal';
}

export interface BuiltQuery {
  where: string;
  orderBy: string;
  params: unknown[];
  limit: number;
  offset: number;
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
    defaultSort: string;
    /** Unique column appended to every sort so paging is stable. */
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

  const sort = (query.sort ?? []).map((s) => {
    const spec = options.fields[s.field] ?? unknownField(s.field, options.fields);
    return `${expr(spec)} ${s.dir === 'desc' ? 'DESC' : 'ASC'}`;
  });

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    orderBy: `ORDER BY ${[...(sort.length ? sort : [options.defaultSort]), options.tieBreak].join(', ')}`,
    params,
    limit: Math.min(query.endRow - query.startRow, MAX_PAGE),
    offset: query.startRow,
  };
}
