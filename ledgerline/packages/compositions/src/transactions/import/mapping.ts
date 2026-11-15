import type { ImportMapping } from '@ledgerline/contracts';

export interface ImportField {
  field: string;
  label: string;
  /** Header spellings that map to this field without asking, compared without case, spaces or punctuation. */
  aliases: string[];
  numeric?: boolean;
  chars: number;
}

/** What a transaction row can carry. `id` marks a correction to an existing unposted transaction. */
export const IMPORT_FIELDS: ImportField[] = [
  {
    field: 'id',
    label: 'Transaction',
    aliases: ['id', 'transaction', 'transactionid', 'txn', 'txnid', 'ref', 'reference'],
    chars: 11,
  },
  {
    field: 'portfolioId',
    label: 'Portfolio',
    aliases: ['portfolio', 'portfolioid', 'account', 'fund'],
    chars: 12,
  },
  {
    field: 'securityId',
    label: 'Security',
    aliases: ['security', 'securityid', 'isin', 'cusip', 'sedol', 'ticker', 'instrument'],
    chars: 14,
  },
  { field: 'type', label: 'Type', aliases: ['type', 'transactiontype', 'trantype', 'side'], chars: 9 },
  { field: 'tradeDate', label: 'Trade date', aliases: ['tradedate', 'trade', 'td', 'dealdate'], chars: 11 },
  {
    field: 'settleDate',
    label: 'Settle date',
    aliases: ['settledate', 'settlementdate', 'settle', 'sd', 'valuedate'],
    chars: 11,
  },
  {
    field: 'quantity',
    label: 'Quantity',
    aliases: ['quantity', 'qty', 'units', 'nominal', 'face', 'shares'],
    numeric: true,
    chars: 14,
  },
  { field: 'price', label: 'Price', aliases: ['price', 'px', 'cleanprice'], numeric: true, chars: 11 },
  {
    field: 'amount',
    label: 'Amount',
    aliases: ['amount', 'amt', 'cash', 'net', 'netamount', 'proceeds'],
    numeric: true,
    chars: 14,
  },
];
const BY_FIELD = new Map(IMPORT_FIELDS.map((f) => [f.field, f]));
export const importField = (field: string) => BY_FIELD.get(field);

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The field a column header means, or null when it is not recognised. */
export function matchHeader(header: string): string | null {
  const key = squash(header);
  return key ? (IMPORT_FIELDS.find((f) => f.aliases.includes(key))?.field ?? null) : null;
}

export interface DetectedTable {
  /** One name per column: the header row, the names from the last mapping, or "Column 1…". */
  headers: string[];
  rows: Record<string, string>[];
  /** Target field per header. A header with no entry is not imported. */
  targets: Record<string, string>;
  /** How the columns were recognised, so the screen can say so. */
  basis: 'headers' | 'lastMapping' | 'none';
}

/**
 * Works out what the columns of a paste or file are. A first row that reads as headers is used as headers;
 * otherwise the user's last mapping is applied by position (quick paste); otherwise nothing is assumed.
 */
export function detectTable(cells: string[][], last: ImportMapping | null): DetectedTable {
  const width = cells.reduce((n, r) => Math.max(n, r.length), 0);
  const first = cells[0] ?? [];
  const matched = first.map(matchHeader);
  const distinct = new Set(matched.filter(Boolean));
  const hasHeaders = distinct.size >= 2 || (distinct.size === 1 && width === 1);
  const used = new Set<string>();
  const unique = (name: string, i: number) => {
    let out = name.trim() || `Column ${i + 1}`;
    while (used.has(out)) out = `${out} (${i + 1})`;
    used.add(out);
    return out;
  };

  let headers: string[];
  let basis: DetectedTable['basis'];
  const targets: Record<string, string> = {};
  if (hasHeaders) {
    headers = Array.from({ length: width }, (_, i) => unique(first[i] ?? '', i));
    const remembered = new Map(last?.columns.map((c) => [squash(c.sourceHeader), c.targetField]));
    const taken = new Set<string>();
    headers.forEach((header, i) => {
      const target = matched[i] ?? remembered.get(squash(header));
      if (target && !taken.has(target)) {
        targets[header] = target;
        taken.add(target);
      }
    });
    basis = 'headers';
  } else if (last && last.columns.length >= width && width > 0) {
    headers = Array.from({ length: width }, (_, i) => unique(last.columns[i]?.sourceHeader ?? '', i));
    headers.forEach((header, i) => {
      const target = last.columns[i]?.targetField;
      if (target) targets[header] = target;
    });
    basis = 'lastMapping';
  } else {
    headers = Array.from({ length: width }, (_, i) => unique('', i));
    basis = 'none';
  }
  const body = hasHeaders ? cells.slice(1) : cells;
  return {
    headers,
    rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))),
    targets,
    basis,
  };
}

/** Why a mapping cannot be used yet, in the user's terms. Null when it can. */
export function mappingProblem(targets: Record<string, string>): string | null {
  const fields = new Set(Object.values(targets));
  if (fields.size === 0) return 'Choose what at least one column is.';
  if (!fields.has('id')) {
    const missing = ['portfolioId', 'type', 'tradeDate']
      .filter((f) => !fields.has(f))
      .map((f) => importField(f)?.label);
    if (missing.length)
      return `New transactions need ${missing.join(', ')}. Map those columns, or map a Transaction column to correct existing ones.`;
  }
  return null;
}

/** True when every column is recognised and nothing is missing, so quick paste can skip the mapping step. */
export const mappingComplete = (headers: string[], targets: Record<string, string>) =>
  headers.every((h) => targets[h]) && mappingProblem(targets) === null;

export const toMapping = (headers: string[], targets: Record<string, string>): ImportMapping => ({
  targetType: 'transaction',
  columns: headers.flatMap((h) => (targets[h] ? [{ sourceHeader: h, targetField: targets[h] }] : [])),
});
