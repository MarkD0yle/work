import type { Tone } from "../styles";
import {
  FIELD_INDEX,
  FORM,
  NO,
  SECTIONS,
  YES,
  validateInput,
  visibleFields,
  type Field,
  type RadioField,
  type SectionKey,
  type ShareClass,
} from "./share-class";

/* Spreadsheet import for the review alternative.
 *
 * Ten rows come straight out of an Excel sheet, one column per field key:
 * fifteen yes/no answers and, where the answer is Yes, the four inputs
 * behind it. Answers are mapped with a forgiving matcher (Yes/No, Y/N,
 * TRUE/FALSE, x, and a near-miss suggestion when nothing fits). Inputs are
 * taken as typed and format-checked. Anything that cannot be mapped, is
 * blank where required, or fails a check surfaces as an issue. */

export const IMPORT_FILE = { name: "share-classes.xlsx", sheet: "Dealing terms", when: "today, 09:14" };

export type RawCells = Record<string, Record<string, string>>;

type RawRow = { label: string; cells: Record<string, string> };

/* A typical retail class: open both ways, fractional, 3% initial charge,
 * swing-priced, nothing else switched on. */
const BASE: Record<string, string> = {
  hedged: "No",
  distributes: "No",
  listed: "No",
  perfFee: "No",
  restricted: "No",
  subsOpen: "Yes",
  subCutoff: "13:00",
  subSettle: "2",
  minInitial: "1,000",
  minSubsequent: "500",
  fractional: "Yes",
  decimals: "3",
  rounding: "Round half up",
  minUnits: "0.001",
  residualCash: "Carried to next deal",
  initialCharge: "Yes",
  initialRate: "3",
  initialRecipient: "Distributor",
  initialDiscountCap: "50",
  initialWaiver: "1,000,000",
  inSpecieSub: "No",
  lockup: "No",
  redsOpen: "Yes",
  redCutoff: "13:00",
  redSettle: "3",
  minRedemption: "500",
  minResidual: "1,000",
  gate: "No",
  redFee: "No",
  notice: "No",
  swing: "Yes",
  swingThreshold: "1",
  swingFactor: "0.25",
  swingMax: "2",
  swingReview: "Quarterly",
};

const INSTITUTIONAL: Record<string, string> = { initialCharge: "No", minInitial: "1,000,000", minSubsequent: "100,000" };

const row = (label: string, over: Record<string, string>): RawRow => ({ label, cells: { ...BASE, ...over } });

/* Note the mixed yes/no spellings, blanks and off-format values a real export
 * carries. Each deliberate problem is commented. */
export const IMPORT_RAW: RawRow[] = [
  row("Class A (Acc)", { hedged: "N", listed: "n", perfFee: "FALSE" }),
  row("Class A (Inc)", { distributes: "Y", distPerYear: "4", distFirstExDate: "2027-01-15", distRecordOffset: "2", distPayOffset: "5" }),
  // Charge rate written as a word; lock-up answer "TBC" is neither yes nor no.
  row("Class B (Acc)", { initialRate: "three", lockup: "TBC" }),
  // Cut-off not in HH:MM; gate answer left blank.
  row("Class C (Acc)", { subCutoff: "1pm", gate: "" }),
  row("Class I (Acc)", {
    ...INSTITUTIONAL,
    restricted: "Yes",
    eligibleInvestors: "Professional only",
    minHolding: "1,000,000",
    jurisdictions: "IE, LU, GB",
    approvalContact: "Onboarding desk",
    gate: "Yes",
    gateThreshold: "10",
    gateLevel: "Fund",
    gateCarry: "5",
    gateProRata: "Equal across requests",
  }),
  // Distributing, but two of its four inputs are blank; notice answer blank.
  row("Class I (Inc)", { ...INSTITUTIONAL, distributes: "Yes", distPerYear: "2", distFirstExDate: "", distRecordOffset: "2", distPayOffset: "", notice: "" }),
  // Hedged with no counterparty; "x" means yes; HWM reset blank; date in the wrong format.
  row("Class S (Acc)", {
    hedged: "Yes",
    hedgeTarget: "100",
    hedgeLower: "95",
    hedgeUpper: "105",
    hedgeCounterparty: "",
    perfFee: "x",
    perfRate: "20",
    perfHurdle: "5",
    perfHwmReset: "",
    perfCrystallisation: "31/12/2026",
  }),
  // Typo with a clear nearest answer; gate blank; settlement typed as "T+3".
  row("Class X (Acc)", { ...INSTITUTIONAL, swing: "Yse", gate: "", redSettle: "T+3" }),
  // Jurisdictions blank; "n/a" is closest to No.
  row("Class Z (Acc)", { ...INSTITUTIONAL, restricted: "Yes", eligibleInvestors: "Internal only", minHolding: "0", jurisdictions: "", approvalContact: "Group treasury", lockup: "n/a" }),
  // Gate blank; holding period written as a word.
  row("Class Z (Inc)", {
    ...INSTITUTIONAL,
    distributes: "Yes",
    distPerYear: "1",
    distFirstExDate: "2027-03-31",
    distRecordOffset: "1",
    distPayOffset: "3",
    gate: "",
    redFee: "Yes",
    redFeeRate: "1.5%",
    redFeeDays: "ninety",
    redFeeRecipient: "Fund",
    redFeeWaiver: "250,000",
  }),
];

/* ───────────── Matching ───────────── */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const YES_WORDS = new Set(["y", "yes", "true", "x", "1"]);
const NO_WORDS = new Set(["n", "no", "false", "0", "none"]);

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type Match = { kind: "blank" } | { kind: "value"; value: string } | { kind: "unmatched"; suggestion?: string };

export function matchOption(field: RadioField, raw: string): Match {
  const n = norm(raw);
  if (!n) return { kind: "blank" };
  const labels = field.options.map((o) => o.value);

  const exact = labels.find((l) => norm(l) === n);
  if (exact) return { kind: "value", value: exact };
  if (labels.includes(YES) && YES_WORDS.has(n)) return { kind: "value", value: YES };
  if (labels.includes(NO) && NO_WORDS.has(n)) return { kind: "value", value: NO };

  // Near miss: a unique option within two edits.
  let best: string | undefined;
  let bestD = 3;
  let tie = false;
  for (const l of labels) {
    const d = levenshtein(n, norm(l));
    if (d < bestD) {
      bestD = d;
      best = l;
      tie = false;
    } else if (d === bestD) tie = true;
  }
  return { kind: "unmatched", suggestion: !tie ? best : undefined };
}

export function importShareClasses(): { rows: ShareClass[]; raw: RawCells } {
  const raw: RawCells = {};
  const rows = IMPORT_RAW.map((r, i) => {
    const id = `SC-IMP${String(i + 1).padStart(2, "0")}`;
    raw[id] = r.cells;
    const values: Record<string, string> = {};
    for (const { field } of Object.values(FIELD_INDEX)) {
      const cell = r.cells[field.key];
      if (cell === undefined || cell.trim() === "") continue;
      if (field.kind === "input") {
        values[field.key] = cell.trim();
        continue;
      }
      const m = matchOption(field, cell);
      if (m.kind === "value") values[field.key] = m.value;
    }
    return { id, label: r.label, values };
  });
  return { rows, raw };
}

/* ───────────── Issues ───────────── */

export type IssueKind = "invalid" | "unrecognised" | "blank";

export const KIND_META: Record<IssueKind, { label: string; tone: Tone; order: number; help: string }> = {
  invalid: { label: "Invalid", tone: "bad", order: 0, help: "The value is present but not in the expected format." },
  unrecognised: { label: "Unrecognised", tone: "bad", order: 1, help: "The cell text is neither Yes nor No." },
  blank: { label: "Blank", tone: "warn", order: 2, help: "A required cell was empty." },
};

export type Issue = {
  id: string;
  rowId: string;
  rowLabel: string;
  field: Field;
  /** The question this field belongs to (itself, for a yes/no answer). */
  question: RadioField;
  section: SectionKey;
  kind: IssueKind;
  /** The spreadsheet cell as imported, when relevant. */
  raw?: string;
  /** Nearest answer for an unrecognised cell, when unambiguous. */
  suggestion?: string;
  /** Short explanation for invalid values. */
  detail?: string;
};

export function collectIssues(rows: ShareClass[], raw: RawCells): Issue[] {
  const out: Issue[] = [];
  for (const r of rows) {
    const cells = raw[r.id] ?? {};
    for (const s of SECTIONS) {
      let question: RadioField | undefined;
      for (const f of visibleFields(FORM[s.id], r.values)) {
        if (f.kind === "radio") question = f;
        if (!question) continue;
        const v = (r.values[f.key] ?? "").trim();
        const cell = cells[f.key]?.trim();
        const base = { id: `${r.id}:${f.key}`, rowId: r.id, rowLabel: r.label, field: f, question, section: s.id };

        if (!v) {
          if (!f.required) continue;
          if (cell) {
            const suggestion = f.kind === "radio" ? (matchOption(f, cell) as { suggestion?: string }).suggestion : undefined;
            out.push({ ...base, kind: "unrecognised", raw: cell, suggestion });
          } else out.push({ ...base, kind: "blank" });
          continue;
        }

        if (f.kind === "input") {
          const err = validateInput(f, v);
          if (err) out.push({ ...base, kind: "invalid", raw: cell, detail: err });
        }
      }
    }
  }
  return out;
}

export type IssueGroup = { key: string; field: Field; question: RadioField; section: SectionKey; items: Issue[]; kind: IssueKind };

/* Grouped by field, most severe first — one choice can then fix every class
 * that shares the problem. */
export function groupIssues(issues: Issue[]): IssueGroup[] {
  const map = new Map<string, IssueGroup>();
  for (const i of issues) {
    const g = map.get(i.field.key) ?? { key: i.field.key, field: i.field, question: i.question, section: i.section, items: [], kind: i.kind };
    g.items.push(i);
    if (KIND_META[i.kind].order < KIND_META[g.kind].order) g.kind = i.kind;
    map.set(i.field.key, g);
  }
  return [...map.values()].sort(
    (a, b) => KIND_META[a.kind].order - KIND_META[b.kind].order || b.items.length - a.items.length,
  );
}

/* Footnotes for the full form: what the spreadsheet said where it didn't map. */
export function importNotes(row: ShareClass, cells: Record<string, string> = {}): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const { field } of Object.values(FIELD_INDEX)) {
    if (field.kind !== "radio") continue;
    const cell = cells[field.key]?.trim();
    if (cell && !row.values[field.key]) notes[field.key] = `Imported “${cell}” — answer Yes or No.`;
  }
  return notes;
}

/* ───────────── Matrix cells ───────────── */

export type CellStatus = "ok" | "blank" | "unrecognised" | "invalid";

const STATUS_ORDER: CellStatus[] = ["invalid", "unrecognised", "blank", "ok"];

/* One question's cell for one class: the answer, and for a Yes how many of
 * its four inputs are filled. Status is the worst issue on the question or
 * any input it reveals. */
export function cellSummary(
  question: RadioField,
  row: ShareClass,
  cells: Record<string, string>,
  rowIssues: Issue[],
): { text: string; full: string; status: CellStatus; answer?: string } {
  const answer = row.values[question.key];
  const kids = answer === YES ? (question.reveal?.[YES] ?? []) : [];
  const keys = new Set([question.key, ...kids.map((k) => k.key)]);
  let status: CellStatus = answer ? "ok" : "blank";
  for (const i of rowIssues) {
    if (!keys.has(i.field.key)) continue;
    const k = i.kind as CellStatus;
    if (STATUS_ORDER.indexOf(k) < STATUS_ORDER.indexOf(status)) status = k;
  }

  if (!answer) {
    const cell = cells[question.key]?.trim();
    return { text: cell ? `“${cell}”` : "—", full: cell ? `Imported “${cell}”` : "Unanswered", status, answer };
  }
  if (answer !== YES) return { text: answer, full: answer, status, answer };

  const filled = kids.filter((k) => (row.values[k.key] ?? "").trim()).length;
  const full = `Yes — ${kids.map((k) => `${k.label}: ${row.values[k.key]?.trim() || "blank"}`).join("; ")}`;
  return { text: `Yes · ${filled}/${kids.length}`, full, status, answer };
}

