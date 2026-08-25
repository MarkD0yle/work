/* Fund Connect 2 — upload mapping over the extended schema.
 *
 * Parsing (parseDelimited) is shared with Fund Connect. Auto-mapping,
 * normalisation and preview are re-declared here because the base versions
 * close over the base field list, and FC2's sheets carry the identity
 * columns (region, provider, names, ticker, trust) as well. The rules are
 * identical: ambiguity is left unmapped, and nothing is written silently.
 */

import {
  parseDelimited,
  type ColumnMapping,
  type Grid,
  type PreviewCell,
  type PreviewRow,
} from "../fundConnect/importer";
import { FIELD_BY_ID, FIELDS, validateValue, type FieldDef } from "./schema";

export { parseDelimited };
export type { ColumnMapping, Grid, PreviewCell, PreviewRow };

const normaliseHeader = (h: string) =>
  h.toLowerCase().replace(/[_/]/g, " ").replace(/\s+/g, " ").replace(/:$/, "").trim();

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
  region: { usa: "US", america: "US", europe: "EMEA", asia: "APAC" },
};

export function normaliseCell(
  field: FieldDef,
  raw: string,
): { value: string; note: string | null } {
  const v = raw.trim();
  if (v === "") return { value: "", note: null };

  if (field.kind === "number") {
    const cleaned = v.replace(/[£$€,\s]/g, "").replace(/%$/, "");
    return { value: cleaned, note: cleaned === v ? null : `read as ${cleaned}` };
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

  if (field.kind === "lookup" || field.id === "ticker") {
    const upper = v.toUpperCase();
    return { value: upper, note: upper === v ? null : `read as ${upper}` };
  }

  return { value: v, note: null };
}

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

    const cells: PreviewCell[] = staged.map(({ field, raw, value, note }) => ({
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

export function rowEntries(row: PreviewRow): { fieldId: string; value: string }[] {
  return row.cells
    .filter((c) => c.value !== "")
    .map((c) => ({ fieldId: c.fieldId, value: c.value }));
}

/* A pasted range with the identity columns in front. Deliberately imperfect:
 * a lower-case region, dates in two formats, shorthand for Side, a
 * counterparty one transposition off, and a trailing column with no home. */
export const SAMPLE_PASTE = [
  "Region\tProvider\tFund Long Name\tFund Short Name\tTicker\tTrust\tFund Code\tShare Class\tBase Ccy\tCounterparty ID\tDealing Account\tCustodian\tSSI BIC\tISIN\tSide\tQuantity\tPrice\tTrade Date\tSettlement Date\tMgmt Fee (bps)\tSettle Ccy\tSettlement Method\tCut-off\tDesk Owner",
  "EMEA\tMeridian AM\tMeridian Global Climate Leaders UCITS ETF\tGlobal Climate Leaders\tMGCL\tUCITS ICAV\tGB00FCAP01\tAcc GBP\tGBP\tCPT-4471\t48120073\tNorthern Trust (London)\tCNORGB2L\tIE00B4L5Y983\tSUB\t61,250\t78.40\t24/08/2026\t26/08/2026\t65\tGBP\tDVP\t12:00 London\tP. Raman",
  "us\tNorthwind AM\tNorthwind US Small Cap Value ETF\tUS Small Cap Value\tNWSV\tETF Trust I\tGB00FCAP02\tInc GBP\tGBP\tCPT-3389\t48120145\tState Street (Edinburgh)\tSBOSGB2X\tGB00B03MLX29\tRED\t12,000\t24.05\t24-Aug-26\t26-Aug-26\t45\tGBP\tDVP\t15:00 London\tP. Raman",
  "APAC\tAurora Capital\tAurora Asia Pacific Income UCITS ETF\tAsia Pacific Income\tAAPI\tUCITS ICAV\tLU00FCAP07\tHedged Acc EUR\tEUR\tCPT-2210\t48120211\tBNY Mellon (Brussels)\tIRVTBEBB\tLU0378818131\tSUB\t8,400\t112.60\t24/08/2026\t27/08/2026\t72\tEUR\tDVP\t12:00 London\tM. Laurent",
  "EMEA\tMeridian AM\tMeridian Global Climate Leaders UCITS ETF\tGlobal Climate Leaders\tMGCL\tUCITS ICAV\tGB00FCAP01\tAcc GBP\tGBP\tCPT-4417\t4812009\tNorthern Trust (London)\tCNORGB2L\tIE00BK5BQT80\tSUB\t3,100\t101.85\t25/08/2026\t27/08/2026\t65\tGBP\tDVP\t12:00 London\tP. Raman",
].join("\n");
