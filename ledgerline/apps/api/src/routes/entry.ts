/**
 * Transaction entry: create, the audit timeline for a record, and spreadsheet import (SPEC 8.1).
 * Every path uses the same validation rules, so a record is judged the same however it arrives.
 */
import type {
  AuditEvent,
  GridResponse,
  BulkResult,
  ImportMapping,
  ImportRowResult,
  ImportSourceRow,
  Message,
  MutationResult,
  TransactionRow,
  User,
} from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { actorOf, rowToAudit, writeAudit } from '../lib/audit';
import { buildGridQuery, runGridQuery, type FieldSpec } from '../lib/grid-query';
import { HttpError, problem, requirePermission } from '../lib/http';
import { createTransactionRules, TRADED_TYPES, type TransactionDraft } from '../lib/transaction-rules';
import * as schemas from '../schemas/index';
import { toTransactionRow, TRANSACTION_SELECT, type TransactionRaw } from './transactions';

const AUDIT_FIELDS: Record<string, FieldSpec> = {
  id: { sql: 'e.id', type: 'text' },
  action: { sql: 'e.action', type: 'text' },
  recordType: { sql: 'e.record_type', type: 'text' },
  recordId: { sql: 'e.record_id', type: 'text' },
  actorId: { sql: "json_extract(e.actor, '$.id')", type: 'text' },
  actor: { sql: "json_extract(e.actor, '$.name')", type: 'text' },
  actorType: { sql: "json_extract(e.actor, '$.type')", type: 'text' },
  at: { sql: 'e.at', type: 'text' },
  effectiveDate: { sql: 'e.effective_date', type: 'date' },
  batchId: { sql: 'e.batch_id', type: 'text' },
};

/** Fields a spreadsheet column can be mapped to. `id` marks a correction to an existing unposted transaction. */
export const IMPORT_FIELDS = [
  'id',
  'portfolioId',
  'securityId',
  'type',
  'tradeDate',
  'settleDate',
  'quantity',
  'price',
  'amount',
] as const;
type ImportField = (typeof IMPORT_FIELDS)[number];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (y: number, m: number, d: number) =>
  `${String(y < 100 ? 2000 + y : y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Reads the date forms people paste from spreadsheets. Returns the text unchanged when it is not a date, so validation can name it. */
export function parseImportDate(text: string): string {
  const t = text.trim().toLowerCase();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/.exec(t);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[\s-]*([a-z]{3,9})[\s-]*(\d{2}|\d{4})$/.exec(t);
  const month = m ? MONTHS.findIndex((name) => (m?.[2] ?? '').startsWith(name)) + 1 : 0;
  if (m && month) return iso(Number(m[3]), month, Number(m[1]));
  return text.trim();
}

/** Reads numbers as typed in spreadsheets: thousands separators, (negatives) and shorthand such as 1.5m. */
export function parseImportNumber(text: string): string {
  let t = text.trim().toLowerCase().replaceAll(',', '').replaceAll(' ', '');
  const negative = /^\(.*\)$/.test(t);
  if (negative) t = t.slice(1, -1);
  const m = /^(-?\d+\.?\d*|-?\.\d+)(k|mm|m|bn|b)?$/.exec(t);
  if (!m) return text.trim();
  const scale = { k: 3, m: 6, mm: 6, bn: 9, b: 9 }[m[2] ?? ''] ?? 0;
  let [whole = '0', fraction = ''] = (m[1] as string).replace('-', '').split('.');
  if (scale) {
    fraction = fraction.padEnd(scale, '0');
    whole = (whole + fraction.slice(0, scale)).replace(/^0+(?=\d)/, '');
    fraction = fraction.slice(scale);
  }
  const sign = negative !== (m[1] as string).startsWith('-') ? '-' : '';
  return `${sign}${whole || '0'}${fraction ? `.${fraction}` : ''}`;
}

export function registerEntryRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  const sqlite = db.$client;
  const check = createTransactionRules(db, clock.today);
  const loadRaw = (id: string) =>
    sqlite.prepare(`${TRANSACTION_SELECT} WHERE t.id = ?`).get(id) as TransactionRaw | undefined;
  const nextId = () => {
    const max =
      (
        sqlite
          .prepare("SELECT max(CAST(substr(id, 3) AS INTEGER)) AS n FROM transactions WHERE id LIKE 'T-%'")
          .get() as { n: number | null }
      ).n ?? 0;
    return `T-${String(max + 1).padStart(7, '0')}`;
  };
  const insert = sqlite.prepare(
    `INSERT INTO transactions (id, portfolio_id, security_id, type, trade_date, settle_date, quantity, price, amount, currency, status, warning_code, origin, created_by, created_at, overrides, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unposted', ?, ?, ?, ?, NULL, 1)`,
  );
  const snapshot = (row: TransactionRow) => ({
    portfolioId: row.portfolio.id,
    securityId: row.security?.id ?? null,
    type: row.type,
    tradeDate: row.tradeDate.value,
    settleDate: row.settleDate.value,
    quantity: row.quantity.value,
    price: row.price.value,
    amount: row.amount.value,
  });

  // ── Create ──────────────────────────────────────────────
  app.post(`${base}/transactions`, async (request, reply): Promise<MutationResult<TransactionRow>> => {
    requirePermission(db, request.user, 'transaction.create');
    const body = schemas.transactionCreate.parse(request.body);
    const draft: TransactionDraft = {
      portfolioId: body.portfolioId,
      securityId: body.securityId ?? null,
      type: body.type,
      tradeDate: body.tradeDate,
      settleDate: body.settleDate ?? null,
      quantity: body.quantity ?? null,
      price: body.price ?? null,
      amount: body.amount ?? null,
    };
    const { messages, record } = check(draft, request.user);
    if (!record) throw new HttpError(422, messages);
    // Warnings can be saved through, but only once the user has acknowledged each one. The acknowledgement is audited.
    const warnings = messages.filter((m) => m.severity === 'warning');
    const acknowledged = new Set(body.acknowledgedWarnings ?? []);
    const open = warnings.filter((w) => !acknowledged.has(w.code));
    if (open.length) throw new HttpError(422, warnings, { needsAcknowledgement: open.map((w) => w.code) });

    const actor = actorOf(request.user);
    const at = clock.now();
    const result = sqlite.transaction((): MutationResult<TransactionRow> => {
      const id = nextId();
      insert.run(
        id,
        draft.portfolioId,
        draft.securityId,
        draft.type,
        draft.tradeDate,
        record.settleDate,
        record.quantity,
        record.price,
        record.amount,
        record.currency,
        warnings[0]?.code ?? null,
        'entered',
        request.user.id,
        at,
      );
      const row = toTransactionRow(loadRaw(id) as TransactionRaw);
      const audit = writeAudit(db, {
        action: body.cloneOf ? 'transaction.clone' : 'transaction.create',
        recordType: 'transaction',
        recordId: id,
        actor,
        at,
        effectiveDate: draft.tradeDate,
        after: { ...snapshot(row), ...(body.cloneOf ? { clonedFrom: body.cloneOf } : {}) },
        ...(warnings.length
          ? {
              note: {
                kind: 'warningAcknowledged' as const,
                text: warnings.map((w) => `${w.code}: ${w.text}`).join(' '),
              },
            }
          : {}),
      });
      return { record: row, auditEventIds: [audit] };
    })();
    reply.code(201);
    return result;
  });

  // ── Audit timeline for one record ───────────────────────
  app.get<{ Params: { type: string; id: string } }>(
    `${base}/audit/record/:type/:id`,
    async (request): Promise<AuditEvent[]> => {
      requirePermission(db, request.user, 'audit.view');
      const rows = sqlite
        .prepare(
          'SELECT * FROM audit_events WHERE record_type = ? AND record_id = ? ORDER BY at DESC, id DESC',
        )
        .all(request.params.type, request.params.id) as Record<string, string | number | null>[];
      return rows.map(rowToAudit);
    },
  );

  // The audit list (SPEC 7.10): every event, filterable. Read only: events cannot be edited or deleted.
  app.post(`${base}/audit/query`, async (request): Promise<GridResponse<AuditEvent>> => {
    requirePermission(db, request.user, 'audit.view');
    const query = schemas.gridQuery.parse(request.body);
    const built = buildGridQuery(query, {
      fields: AUDIT_FIELDS,
      defaultSort: { sql: 'e.at', dir: 'DESC' },
      tieBreak: 'e.id',
      today: clock.today,
      quickSearch: (term, params) => {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        params.push(like, like, like);
        return "e.record_id LIKE ? ESCAPE '\\' OR e.action LIKE ? ESCAPE '\\' OR e.batch_id LIKE ? ESCAPE '\\'";
      },
    });
    return runGridQuery<Record<string, string | number | null>, AuditEvent>(sqlite, {
      select: 'SELECT e.*',
      from: 'FROM audit_events e',
      built,
      asOf: clock.now(),
      map: rowToAudit,
    });
  });

  // ── Import ──────────────────────────────────────────────
  const bySecurityKey = {
    id: sqlite.prepare('SELECT id FROM securities WHERE id = ?'),
    isin: sqlite.prepare('SELECT id FROM securities WHERE isin = ?'),
    cusip: sqlite.prepare('SELECT id FROM securities WHERE cusip = ?'),
    sedol: sqlite.prepare('SELECT id FROM securities WHERE sedol = ?'),
    ticker: sqlite.prepare('SELECT id FROM securities WHERE ticker = ? LIMIT 2'),
  };
  const portfolioByName = sqlite.prepare('SELECT id FROM portfolios WHERE lower(name) = lower(?)');
  const portfolioById = sqlite.prepare('SELECT id FROM portfolios WHERE id = ?');

  /** Finds a security by internal id, ISIN, CUSIP, SEDOL or an unambiguous ticker. Returns the text unchanged when nothing matches. */
  function resolveSecurity(text: string, cache: Map<string, string>): string {
    const key = text.trim().toUpperCase();
    const hit = cache.get(key);
    if (hit) return hit;
    let found = key;
    for (const stmt of Object.values(bySecurityKey)) {
      const rows = stmt.all(key) as { id: string }[];
      if (rows.length === 1) {
        found = (rows[0] as { id: string }).id;
        break;
      }
    }
    cache.set(key, found);
    return found;
  }
  const resolvePortfolio = (text: string) => {
    const t = text.trim();
    return (
      ((portfolioById.get(t.toUpperCase()) ?? portfolioByName.get(t)) as { id: string } | undefined)?.id ?? t
    );
  };

  interface Evaluated {
    result: ImportRowResult;
    /** What to write when the row is committed. Absent when the row has an error. */
    apply?: {
      existing: TransactionRaw | null;
      draft: TransactionDraft;
      record: NonNullable<ReturnType<typeof check>['record']>;
      warning: string | null;
    };
  }

  function evaluate(mapping: ImportMapping, rows: ImportSourceRow[], user: User): Evaluated[] {
    const columns = mapping.columns.filter((c): c is { sourceHeader: string; targetField: ImportField } =>
      (IMPORT_FIELDS as readonly string[]).includes(c.targetField),
    );
    const cache = new Map<string, string>();
    const seenIds = new Map<string, number>();
    return rows.map((source, index): Evaluated => {
      const rowNumber = index + 1;
      const value = (field: ImportField): string | undefined => {
        const column = columns.find((c) => c.targetField === field);
        const text = column ? source[column.sourceHeader]?.trim() : undefined;
        return text ? text : undefined;
      };
      const messages: Message[] = [];
      const fail = (code: string, target: string, text: string, fix: string) =>
        messages.push({ code, severity: 'error', level: 'row', text, fix, target });
      if (columns.every((c) => !source[c.sourceHeader]?.trim())) {
        fail('LL-IMP-0010', 'row', 'This row is empty.', 'Exclude it, or fill it in.');
        return { result: { rowNumber, status: 'error', messages, parsed: {} } };
      }

      // A row with an id corrects an existing unposted transaction; without one it creates a new transaction.
      const id = value('id')?.toUpperCase();
      let existing: TransactionRaw | null = null;
      if (id) {
        const raw = loadRaw(id);
        if (!raw || (user.blotterScope && !user.blotterScope.includes(raw.portfolio_id)))
          fail(
            'LL-IMP-0011',
            'id',
            `There is no transaction ${id}.`,
            'Check the id, or clear it to create a new transaction.',
          );
        else if (raw.status !== 'unposted')
          fail(
            'LL-IMP-0012',
            'id',
            `Transaction ${id} is ${raw.status}, so it cannot be corrected by import.`,
            'Reverse it, then import the corrected values as a new transaction.',
          );
        else existing = raw;
        const first = seenIds.get(id);
        if (first)
          fail(
            'LL-IMP-0013',
            'id',
            `Transaction ${id} is also on row ${first}.`,
            'Keep one row per transaction.',
          );
        else seenIds.set(id, rowNumber);
      }

      const pick = (
        field: Exclude<ImportField, 'id'>,
        parse: (text: string) => string,
        current: string | null | undefined,
      ): string | null => {
        const text = value(field);
        return text === undefined ? (current ?? null) : parse(text);
      };
      const type = pick('type', (t) => schemas.transactionTypeAlias(t), existing?.type) ?? '';
      const draft: TransactionDraft = {
        portfolioId: pick('portfolioId', resolvePortfolio, existing?.portfolio_id) ?? '',
        securityId: pick('securityId', (t) => resolveSecurity(t, cache), existing?.security_id),
        type,
        tradeDate: pick('tradeDate', parseImportDate, existing?.trade_date) ?? '',
        settleDate: pick('settleDate', parseImportDate, existing?.settle_date),
        quantity: pick('quantity', parseImportNumber, existing?.quantity),
        price: pick('price', parseImportNumber, existing?.price),
        // A traded record's amount is always recalculated; any pasted amount for it is ignored by the rules.
        amount: TRADED_TYPES.has(type) ? null : pick('amount', parseImportNumber, existing?.amount),
      };
      const checked = check(draft, user);
      messages.push(...checked.messages.map((m) => ({ ...m, level: 'row' as const })));
      const hasError = messages.some((m) => m.severity === 'error');
      const warning = messages.find((m) => m.severity === 'warning');
      const parsed = {
        ...(id ? { id } : {}),
        ...draft,
        ...(checked.record ? { amount: checked.record.amount, currency: checked.record.currency } : {}),
      };
      return {
        result: { rowNumber, status: hasError ? 'error' : warning ? 'warning' : 'valid', messages, parsed },
        ...(!hasError && checked.record
          ? { apply: { existing, draft, record: checked.record, warning: warning?.code ?? null } }
          : {}),
      };
    });
  }

  app.post(`${base}/imports/validate`, async (request): Promise<ImportRowResult[]> => {
    requirePermission(db, request.user, 'transaction.import');
    const body = schemas.importRequest.parse(request.body);
    requireTransactions(body.mapping);
    return evaluate(body.mapping, body.rows, request.user).map((e) => e.result);
  });

  app.post(`${base}/imports/commit`, async (request): Promise<BulkResult> => {
    requirePermission(db, request.user, 'transaction.import');
    const body = schemas.importCommit.parse(request.body);
    requireTransactions(body.mapping);
    if (body.rows.length === 0)
      throw new HttpError(400, [
        problem('LL-IMP-0003', 'There are no rows to import.', 'Paste or upload at least one row.'),
      ]);
    const evaluated = evaluate(body.mapping, body.rows, request.user);
    // No row commits while it has an error: the whole import is refused until every row is fixed or excluded.
    const errors = evaluated.filter((e) => e.result.status === 'error');
    if (errors.length) {
      throw new HttpError(
        422,
        [
          problem(
            'LL-IMP-0001',
            `${errors.length} of ${evaluated.length} rows have errors, so nothing was imported.`,
            'Fix or exclude those rows, then commit again.',
          ),
        ],
        { rows: errors.map((e) => e.result) },
      );
    }
    const warned = evaluated.filter((e) => e.result.status === 'warning');
    if (warned.length && !body.acknowledgeWarnings) {
      throw new HttpError(
        422,
        [
          {
            ...problem(
              'LL-IMP-0002',
              `${warned.length} rows have warnings.`,
              'Review them, then confirm that you want to import them anyway.',
            ),
            severity: 'warning',
          },
        ],
        { needsAcknowledgement: true, rows: warned.map((e) => e.result) },
      );
    }

    const actor = actorOf(request.user);
    const at = clock.now();
    return sqlite.transaction((): BulkResult => {
      const seq =
        (
          sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action = 'import.batch'").get() as {
            n: number;
          }
        ).n + 1;
      const batchId = `IMP-${String(seq).padStart(6, '0')}`;
      // The source file travels with every audit event as evidence.
      const evidence = [{ type: 'file' as const, id: `F-${batchId}`, label: body.fileEvidence.name }];
      const succeeded: string[] = [];
      for (const { apply, result } of evaluated) {
        if (!apply) continue;
        const { existing, draft, record, warning } = apply;
        const note = warning
          ? {
              note: {
                kind: 'warningAcknowledged' as const,
                text: result.messages
                  .filter((m) => m.severity === 'warning')
                  .map((m) => `${m.code}: ${m.text}`)
                  .join(' '),
              },
            }
          : {};
        if (existing) {
          const before = snapshot(toTransactionRow(existing));
          sqlite
            .prepare(
              "UPDATE transactions SET portfolio_id = ?, security_id = ?, type = ?, trade_date = ?, settle_date = ?, quantity = ?, price = ?, amount = ?, currency = ?, warning_code = ?, origin = 'imported', overrides = NULL, version = version + 1 WHERE id = ?",
            )
            .run(
              draft.portfolioId,
              draft.securityId,
              draft.type,
              draft.tradeDate,
              record.settleDate,
              record.quantity,
              record.price,
              record.amount,
              record.currency,
              warning,
              existing.id,
            );
          const after = snapshot(toTransactionRow(loadRaw(existing.id) as TransactionRaw));
          writeAudit(db, {
            action: 'transaction.import.correct',
            recordType: 'transaction',
            recordId: existing.id,
            actor,
            at,
            effectiveDate: draft.tradeDate,
            before,
            after: { ...after, source: 'imported' },
            batchId,
            evidence,
            ...note,
          });
          succeeded.push(existing.id);
        } else {
          const id = nextId();
          insert.run(
            id,
            draft.portfolioId,
            draft.securityId,
            draft.type,
            draft.tradeDate,
            record.settleDate,
            record.quantity,
            record.price,
            record.amount,
            record.currency,
            warning,
            'imported',
            request.user.id,
            at,
          );
          const after = snapshot(toTransactionRow(loadRaw(id) as TransactionRaw));
          writeAudit(db, {
            action: 'transaction.import',
            recordType: 'transaction',
            recordId: id,
            actor,
            at,
            effectiveDate: draft.tradeDate,
            after: { ...after, source: 'imported' },
            batchId,
            evidence,
            ...note,
          });
          succeeded.push(id);
        }
      }
      writeAudit(db, {
        action: 'import.batch',
        recordType: 'batch',
        recordId: batchId,
        actor,
        at,
        batchId,
        evidence,
        after: { file: body.fileEvidence.name, rows: succeeded.length, warnings: warned.length },
      });
      // The mapping that worked becomes this user's last mapping, for quick paste next time.
      sqlite
        .prepare(
          'INSERT INTO import_mappings (user_id, target_type, columns) VALUES (?, ?, ?) ON CONFLICT (user_id, target_type) DO UPDATE SET columns = excluded.columns',
        )
        .run(request.user.id, body.mapping.targetType, JSON.stringify(body.mapping.columns));
      return { jobId: batchId, status: 'completed', succeeded, failed: [], skipped: [] };
    })();
  });

  // The user's last mapping per target type: quick paste starts from it.
  app.get<{ Params: { targetType: string } }>(
    `${base}/imports/mappings/:targetType`,
    async (request): Promise<ImportMapping | null> => {
      const row = sqlite
        .prepare('SELECT target_type, columns FROM import_mappings WHERE user_id = ? AND target_type = ?')
        .get(request.user.id, request.params.targetType) as
        { target_type: ImportMapping['targetType']; columns: string } | undefined;
      return row
        ? { targetType: row.target_type, columns: JSON.parse(row.columns) as ImportMapping['columns'] }
        : null;
    },
  );
  app.put<{ Params: { targetType: string } }>(
    `${base}/imports/mappings/:targetType`,
    async (request): Promise<ImportMapping> => {
      const mapping = schemas.importMapping.parse(request.body);
      sqlite
        .prepare(
          'INSERT INTO import_mappings (user_id, target_type, columns) VALUES (?, ?, ?) ON CONFLICT (user_id, target_type) DO UPDATE SET columns = excluded.columns',
        )
        .run(request.user.id, mapping.targetType, JSON.stringify(mapping.columns));
      return mapping;
    },
  );

  function requireTransactions(mapping: ImportMapping): void {
    if (mapping.targetType !== 'transaction') {
      throw new HttpError(400, [
        problem(
          'LL-IMP-0004',
          `Import of ${mapping.targetType} records is not available yet.`,
          'Only transactions can be imported for now.',
          'mapping.targetType',
        ),
      ]);
    }
  }
}
