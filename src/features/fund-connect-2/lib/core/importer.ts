/* Fund Connect — Excel import. Spec §2, build step 1.
 *
 * This is the step that goes after the confirmed root cause: a value
 * re-typed by hand from a spreadsheet. Two entry points (a pasted range and
 * a file), one pipeline: parse → auto-map columns by header → preview the
 * first few mapped rows against the target fields → commit.
 *
 * Two rules the pipeline never breaks:
 *   - the mapping is always shown and always editable before commit;
 *   - imported values run the same validation as typed ones (spec §2) —
 *     import removes the typing, not the checks.
 */

import {
  FIELDS,
  FIELD_BY_ID,
  validateValue,
  type FieldDef,
  type Issue,
} from "./schema";

export type Grid = { headers: string[]; rows: string[][] };

export type ColumnMapping = {
  /** Header text exactly as it appeared in the sheet. */
  header: string;
  index: number;
  fieldId: string | null;
  /** True when the mapping came from header matching rather than the user. */
  auto: boolean;
};

export type PreviewCell = {
  fieldId: string;
  label: string;
  raw: string;
  /** Normalised value that would be written to the form. */
  value: string;
  issue: Issue | null;
  /** Set when normalisation changed the value, e.g. a reformatted date. */
  note: string | null;
};

export type PreviewRow = {
  index: number;
  cells: PreviewCell[];
  errors: number;
  warnings: number;
};

/** A range pasted straight out of Excel arrives tab-separated; a saved file
 *  is usually comma-separated. Detect rather than ask. */
export function parseDelimited(text: string): Grid {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const split = (line: string) =>
    splitLine(line, delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

  const [headerLine, ...rest] = lines;
  const headers = split(headerLine);
  const rows = rest.map((line) => {
    const cells = split(line);
    // Pad short rows so column indices stay aligned with the header.
    while (cells.length < headers.length) cells.push("");
    return cells;
  });
  return { headers, rows };
}

/** Split on the delimiter, respecting double-quoted cells. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      out.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell);
  return out;
}

const normaliseHeader = (h: string) =>
  h.toLowerCase().replace(/[_/]/g, " ").replace(/\s+/g, " ").replace(/:$/, "").trim();

/** Auto-detect the column → field mapping by header name. Ambiguity is left
 *  unmapped rather than guessed — an unmapped column is obvious in the
 *  mapping table, a wrongly guessed one is not. */
export function autoMap(headers: string[]): ColumnMapping[] {
  const taken = new Set<string>();
  return headers.map((header, index) => {
    const key = normaliseHeader(header);
    const exact = FIELDS.find(
      (f) =>
        !taken.has(f.id) &&
        (normaliseHeader(f.label) === key || f.importAliases.includes(key)),
    );
    const match =
      exact ??
      FIELDS.find(
        (f) =>
          !taken.has(f.id) &&
          f.importAliases.some((a) => key.startsWith(a) || a.startsWith(key)),
      );
    if (match) taken.add(match.id);
    return { header, index, fieldId: match?.id ?? null, auto: Boolean(match) };
  });
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normaliseDate(raw: string): string | null {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const slash = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const named = v.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{2,4})$/);
  if (named) {
    const [, d, mon, y] = named;
    const month = MONTHS[mon.toLowerCase()];
    if (!month) return null;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${month}-${d.padStart(2, "0")}`;
  }
  return null;
}

/* Spreadsheet shorthand seen in the source sheets, mapped to the finite
 * value sets the form actually accepts. Anything not listed here falls
 * through to a case-insensitive option match and then to an error — a
 * value that cannot be mapped is never silently written. */
const SYNONYMS: Record<string, Record<string, string>> = {
  side: {
    sub: "Subscribe",
    subs: "Subscribe",
    buy: "Subscribe",
    b: "Subscribe",
    red: "Redeem",
    sell: "Redeem",
    s: "Redeem",
    "switch in": "Switch in",
    "switch out": "Switch out",
  },
  settlementMethod: { dvp: "DVP", fop: "FOP", cash: "Cash transfer" },
  firstTimeSetup: { y: "Yes", n: "No", true: "Yes", false: "No" },
  mandateType: { seg: "Segregated", segregated: "Segregated", pooled: "Pooled" },
};

/** Turn a raw cell into the value the form would hold. Returns the value
 *  plus a note when normalisation changed it, so the preview can show the
 *  user what import did rather than doing it invisibly. */
export function normaliseCell(
  field: FieldDef,
  raw: string,
): { value: string; note: string | null } {
  const v = raw.trim();
  if (v === "") return { value: "", note: null };

  if (field.kind === "number") {
    const cleaned = v.replace(/[£$€,\s]/g, "").replace(/%$/, "");
    return {
      value: cleaned,
      note: cleaned === v ? null : `read as ${cleaned}`,
    };
  }

  if (field.kind === "date") {
    const iso = normaliseDate(v);
    if (!iso) return { value: v, note: "date not recognised" };
    return { value: iso, note: iso === v ? null : `read as ${iso}` };
  }

  if (field.kind === "select" && field.options) {
    const synonym = SYNONYMS[field.id]?.[v.toLowerCase()];
    if (synonym) return { value: synonym, note: `mapped to ${synonym}` };
    const option = field.options.find((o) => o.toLowerCase() === v.toLowerCase());
    if (option) return { value: option, note: option === v ? null : `mapped to ${option}` };
    return { value: v, note: null };
  }

  if (field.kind === "lookup") {
    const upper = v.toUpperCase();
    return { value: upper, note: upper === v ? null : `read as ${upper}` };
  }

  return { value: v, note: null };
}

/** Build the preview rows. `base` is the record's current values, so
 *  cross-field checks (settlement vs trade date, currency vs fund master)
 *  are evaluated against what the form would actually end up holding. */
export function buildPreview(
  grid: Grid,
  mapping: ColumnMapping[],
  base: Record<string, string>,
  limit = 5,
): PreviewRow[] {
  const mapped = mapping.filter((m) => m.fieldId);
  return grid.rows.slice(0, limit).map((row, index) => {
    const candidate: Record<string, string> = { ...base };
    const staged: { field: FieldDef; raw: string; value: string; note: string | null }[] = [];

    for (const m of mapped) {
      const field = FIELD_BY_ID[m.fieldId as string];
      if (!field) continue;
      const raw = row[m.index] ?? "";
      const { value, note } = normaliseCell(field, raw);
      candidate[field.id] = value;
      staged.push({ field, raw, value, note });
    }

    const cells = staged.map(({ field, raw, value, note }) => ({
      fieldId: field.id,
      label: field.label,
      raw,
      value,
      issue: validateValue(field, candidate),
      note,
    }));

    return {
      index,
      cells,
      errors: cells.filter((c) => c.issue?.level === "error").length,
      warnings: cells.filter((c) => c.issue?.level === "warning").length,
    };
  });
}

/** The field writes a preview row would commit. */
export function rowEntries(row: PreviewRow): { fieldId: string; value: string }[] {
  return row.cells
    .filter((c) => c.value !== "")
    .map((c) => ({ fieldId: c.fieldId, value: c.value }));
}

/* A range copied out of the dealing sheet. Deliberately imperfect: dates in
 * two formats, a thousands separator, shorthand for Side, a counterparty ID
 * one transposition away from a real one, and a trailing column the form has
 * no home for. */
export const SAMPLE_PASTE = [
  "Fund Code\tShare Class\tBase Ccy\tCounterparty ID\tDealing Account\tCustodian\tSSI BIC\tISIN\tSide\tQuantity\tPrice\tTrade Date\tSettlement Date\tMgmt Fee (bps)\tSettle Ccy\tSettlement Method\tCut-off\tDesk Owner",
  "GB00FCAP01\tAcc GBP\tGBP\tCPT-4471\t48120073\tNorthern Trust (London)\tCNORGB2L\tIE00B4L5Y983\tSUB\t61,250\t78.40\t17/08/2026\t19/08/2026\t65\tGBP\tDVP\t12:00 London\tP. Raman",
  "GB00FCAP02\tInc GBP\tGBP\tCPT-3389\t48120145\tState Street (Edinburgh)\tSBOSGB2X\tGB00B03MLX29\tRED\t12,000\t24.05\t17-Aug-26\t19-Aug-26\t45\tGBP\tDVP\t15:00 London\tP. Raman",
  "LU00FCAP07\tHedged Acc EUR\tEUR\tCPT-2210\t48120211\tBNY Mellon (Brussels)\tIRVTBEBB\tLU0378818131\tSUB\t8,400\t112.60\t17/08/2026\t20/08/2026\t72\tEUR\tDVP\t12:00 London\tM. Laurent",
  "GB00FCAP01\tAcc GBP\tGBP\tCPT-4417\t4812009\tNorthern Trust (London)\tCNORGB2L\tIE00BK5BQT80\tSUB\t3,100\t101.85\t18/08/2026\t20/08/2026\t65\tGBP\tDVP\t12:00 London\tP. Raman",
].join("\n");
