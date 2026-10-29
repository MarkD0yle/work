import { nextId } from "../styles";
import type { Tone } from "../styles";

/* Shared model for the "modal-on-modal" alternatives.
 *
 * The scenario: a fund set-up dialog holds an accordion; one section lists
 * the fund's share classes in a table (headers always visible, empty until a
 * class is added). An "Add share class" dropdown offers ten class labels.
 * Picking one opens an editor with three sections — Basic info, Order
 * creation settings, Order redemption settings. Each section asks five
 * yes/no questions; answering Yes reveals four inputs beneath the question.
 * Saving writes a row into the table. The alternatives differ only in WHERE
 * that editor lives, so the form itself is declared once, here. */

/* ───────────── Field model ───────────── */

export type Option = { value: string; label: string; tone?: Tone };

export type RadioField = {
  kind: "radio";
  key: string;
  /** The question. */
  label: string;
  /** Chip text when answered Yes. */
  short: string;
  options: Option[];
  required?: boolean;
  hint?: string;
  /** Fields revealed beneath the question when a given answer is chosen. */
  reveal?: Record<string, Field[]>;
};

export type InputField = {
  kind: "input";
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  type?: "text" | "time" | "date";
  numeric?: boolean;
  /** Suffix shown after the value in summaries ("%", "d"). */
  unit?: string;
};

export type Field = RadioField | InputField;

export const YES = "Yes";
export const NO = "No";
const YES_NO: Option[] = [
  { value: YES, label: "Yes" },
  { value: NO, label: "No", tone: "muted" },
];

function input(key: string, label: string, extra: Omit<InputField, "kind" | "key" | "label"> = {}): InputField {
  return { kind: "input", key, label, required: true, ...extra };
}

type Four = [InputField, InputField, InputField, InputField];

function question(key: string, label: string, short: string, inputs: Four, hint?: string): RadioField {
  return { kind: "radio", key, label, short, options: YES_NO, required: true, hint, reveal: { [YES]: inputs } };
}

const pct = (key: string, label: string, placeholder?: string) => input(key, label, { numeric: true, unit: "%", placeholder });
const days = (key: string, label: string, hint?: string) => input(key, label, { numeric: true, unit: "d", hint });
const amount = (key: string, label: string) => input(key, label, { numeric: true, hint: "In class currency." });
const time = (key: string, label: string) => input(key, label, { type: "time" });
const date = (key: string, label: string) => input(key, label, { type: "date" });

/* ───────────── Sections ───────────── */

export const SECTIONS = [
  { id: "basic", label: "Basic info", blurb: "Hedging, income, listing, performance fee and investor restrictions." },
  { id: "creation", label: "Order creation settings", blurb: "How subscriptions are accepted, charged and locked." },
  { id: "redemption", label: "Order redemption settings", blurb: "How redemptions are cut off, gated, charged and priced." },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["id"];

export const FORM: Record<SectionKey, Field[]> = {
  basic: [
    question("hedged", "Is the class currency-hedged?", "Hedged", [
      pct("hedgeTarget", "Hedge ratio target", "100"),
      pct("hedgeLower", "Lower tolerance", "95"),
      pct("hedgeUpper", "Upper tolerance", "105"),
      input("hedgeCounterparty", "Hedging counterparty", { placeholder: "e.g. State Street" }),
    ]),
    question("distributes", "Does the class distribute income?", "Distributing", [
      input("distPerYear", "Payments per year", { numeric: true, placeholder: "4" }),
      date("distFirstExDate", "First ex-date"),
      days("distRecordOffset", "Record date offset", "Business days after ex-date."),
      days("distPayOffset", "Payment date offset", "Business days after record date."),
    ]),
    question("listed", "Is the class listed on an exchange?", "Listed", [
      input("exchange", "Exchange", { placeholder: "e.g. Euronext Dublin" }),
      input("ticker", "Ticker"),
      date("listingDate", "Listing date"),
      input("marketMaker", "Market maker"),
    ]),
    question("perfFee", "Does the class charge a performance fee?", "Perf. fee", [
      pct("perfRate", "Fee rate", "20"),
      pct("perfHurdle", "Hurdle rate", "5"),
      input("perfHwmReset", "High-water mark reset", { numeric: true, unit: "yrs", placeholder: "3" }),
      date("perfCrystallisation", "Crystallisation date"),
    ]),
    question("restricted", "Is the class restricted to specific investors?", "Restricted", [
      input("eligibleInvestors", "Eligible investor type", { placeholder: "e.g. Professional only" }),
      amount("minHolding", "Minimum holding"),
      input("jurisdictions", "Permitted jurisdictions", { placeholder: "e.g. IE, LU, GB" }),
      input("approvalContact", "Approval contact"),
    ]),
  ],

  creation: [
    question("subsOpen", "Is the class open to subscriptions?", "Subs open", [
      time("subCutoff", "Cut-off time"),
      days("subSettle", "Settlement", "T+n business days."),
      amount("minInitial", "Minimum initial"),
      amount("minSubsequent", "Minimum subsequent"),
    ]),
    question("fractional", "Are fractional units allowed?", "Fractional", [
      input("decimals", "Decimal places", { numeric: true, placeholder: "3" }),
      input("rounding", "Rounding method", { placeholder: "e.g. Round half up" }),
      input("minUnits", "Minimum units per order", { numeric: true }),
      input("residualCash", "Residual cash treatment", { placeholder: "e.g. Carried to next deal" }),
    ]),
    question("initialCharge", "Is an initial charge applied?", "Initial charge", [
      pct("initialRate", "Charge rate", "3"),
      input("initialRecipient", "Recipient", { placeholder: "e.g. Distributor" }),
      pct("initialDiscountCap", "Discount cap", "50"),
      amount("initialWaiver", "Waiver threshold"),
    ]),
    question("inSpecieSub", "Are in-specie subscriptions accepted?", "In-specie subs", [
      amount("inSpecieSubMin", "Minimum value"),
      input("inSpecieSubAssets", "Eligible asset types", { placeholder: "e.g. Listed equities" }),
      time("inSpecieSubValuation", "Valuation point"),
      input("inSpecieSubContact", "Transfer agent contact"),
    ]),
    question("lockup", "Is there a subscription lock-up?", "Lock-up", [
      days("lockupDays", "Lock-up period"),
      pct("lockupPenalty", "Early-exit penalty"),
      input("lockupStart", "Lock-up starts from", { placeholder: "e.g. Trade date" }),
      input("lockupExemptions", "Exemptions", { placeholder: "e.g. Death, disability" }),
    ]),
  ],

  redemption: [
    question("redsOpen", "Is the class open to redemptions?", "Reds open", [
      time("redCutoff", "Cut-off time"),
      days("redSettle", "Settlement", "T+n business days."),
      amount("minRedemption", "Minimum redemption"),
      amount("minResidual", "Minimum residual holding"),
    ]),
    question("gate", "Is a redemption gate applied?", "Gate", [
      pct("gateThreshold", "Threshold", "10"),
      input("gateLevel", "Gate level", { placeholder: "Fund or class" }),
      days("gateCarry", "Carry-forward period"),
      input("gateProRata", "Pro-rata rule", { placeholder: "e.g. Equal across requests" }),
    ]),
    question("redFee", "Is a redemption fee charged?", "Red. fee", [
      pct("redFeeRate", "Fee rate", "1"),
      days("redFeeDays", "Holding period"),
      input("redFeeRecipient", "Recipient", { placeholder: "e.g. Fund" }),
      amount("redFeeWaiver", "Waiver threshold"),
    ]),
    question("notice", "Is a notice period required?", "Notice", [
      days("noticeDays", "Notice period"),
      input("noticeMethod", "Notice method", { placeholder: "e.g. SWIFT" }),
      time("noticeCancel", "Cancellation deadline"),
      input("noticeContact", "Contact"),
    ]),
    question("swing", "Is swing pricing applied?", "Swing", [
      pct("swingThreshold", "Swing threshold", "1"),
      pct("swingFactor", "Swing factor", "0.25"),
      pct("swingMax", "Maximum swing", "2"),
      input("swingReview", "Review frequency", { placeholder: "e.g. Quarterly" }),
    ]),
  ],
};

/* Every field a section can show, in display order, including anything a
 * question reveals. */
export function flattenFields(fields: Field[]): Field[] {
  const out: Field[] = [];
  for (const f of fields) {
    out.push(f);
    if (f.kind === "radio") for (const kids of Object.values(f.reveal ?? {})) out.push(...flattenFields(kids));
  }
  return out;
}

export const FIELD_INDEX: Record<string, { field: Field; section: SectionKey }> = Object.fromEntries(
  SECTIONS.flatMap((s) => flattenFields(FORM[s.id]).map((f) => [f.key, { field: f, section: s.id }])),
);

export const QUESTIONS: Record<SectionKey, RadioField[]> = {
  basic: FORM.basic.filter((f): f is RadioField => f.kind === "radio"),
  creation: FORM.creation.filter((f): f is RadioField => f.kind === "radio"),
  redemption: FORM.redemption.filter((f): f is RadioField => f.kind === "radio"),
};

/* ───────────── Record ───────────── */

export type ShareClass = {
  id: string;
  /** The dropdown label the record was created from. */
  label: string;
  values: Record<string, string>;
};

/* The ten options behind the "Add share class" dropdown. */
export const CLASS_LABELS: { label: string; hint: string }[] = [
  { label: "Class A (Acc)", hint: "Retail · accumulating" },
  { label: "Class A (Inc)", hint: "Retail · distributing" },
  { label: "Class B (Acc)", hint: "Retail · deferred charge" },
  { label: "Class C (Acc)", hint: "Clean · adviser platforms" },
  { label: "Class I (Acc)", hint: "Institutional · accumulating" },
  { label: "Class I (Inc)", hint: "Institutional · distributing" },
  { label: "Class S (Acc)", hint: "Seed · early investors" },
  { label: "Class X (Acc)", hint: "Segregated mandates" },
  { label: "Class Z (Acc)", hint: "Zero fee · internal" },
  { label: "Class Z (Inc)", hint: "Zero fee · distributing" },
];

export function newShareClass(label: string): ShareClass {
  const values: Record<string, string> = {};
  if (label.includes("(Acc)")) values.distributes = NO;
  if (label.includes("(Inc)")) values.distributes = YES;
  return { id: nextId("SC"), label, values };
}

/* One complete row so each example opens with something in the table. */
export const SEED_ROW: ShareClass = {
  id: "SC-SEED1",
  label: "Class I (Acc)",
  values: {
    hedged: NO,
    distributes: NO,
    listed: NO,
    perfFee: NO,
    restricted: YES,
    eligibleInvestors: "Professional only",
    minHolding: "1,000,000",
    jurisdictions: "IE, LU, GB, CH",
    approvalContact: "Client onboarding desk",
    subsOpen: YES,
    subCutoff: "13:00",
    subSettle: "2",
    minInitial: "1,000,000",
    minSubsequent: "100,000",
    fractional: YES,
    decimals: "3",
    rounding: "Round half up",
    minUnits: "0.001",
    residualCash: "Carried to next deal",
    initialCharge: NO,
    inSpecieSub: NO,
    lockup: NO,
    redsOpen: YES,
    redCutoff: "13:00",
    redSettle: "3",
    minRedemption: "100,000",
    minResidual: "1,000,000",
    gate: YES,
    gateThreshold: "10",
    gateLevel: "Fund",
    gateCarry: "5",
    gateProRata: "Equal across requests",
    redFee: NO,
    notice: NO,
    swing: YES,
    swingThreshold: "1",
    swingFactor: "0.25",
    swingMax: "2",
    swingReview: "Quarterly",
  },
};

/* ───────────── Validation & completeness ───────────── */

/* Format check on a filled input; undefined means fine. */
export function validateInput(f: InputField, raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (f.numeric && !/^-?\d[\d,]*(\.\d+)?\s*%?$/.test(v)) return "Expected a number";
  if (f.type === "time" && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) return "Expected a time (HH:MM)";
  if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Expected a date (YYYY-MM-DD)";
  return undefined;
}

/* The fields currently on screen for a section: the questions plus whatever
 * the chosen answers reveal, in display order. */
export function visibleFields(fields: Field[], values: Record<string, string>): Field[] {
  const out: Field[] = [];
  for (const f of fields) {
    out.push(f);
    if (f.kind === "radio" && f.reveal) {
      const v = values[f.key];
      if (v && f.reveal[v]) out.push(...visibleFields(f.reveal[v], values));
    }
  }
  return out;
}

function ok(f: Field, values: Record<string, string>): boolean {
  const v = (values[f.key] ?? "").trim();
  if (!v) return !f.required;
  return f.kind === "input" ? validateInput(f, v) === undefined : true;
}

export function sectionComplete(sc: ShareClass, section: SectionKey): boolean {
  return visibleFields(FORM[section], sc.values).every((f) => ok(f, sc.values));
}

export function completeCount(sc: ShareClass): number {
  return SECTIONS.filter((s) => sectionComplete(sc, s.id)).length;
}

/* A row may be saved once Basic info is complete; the other two sections can
 * be finished later and the table flags the gap. */
export function canSave(sc: ShareClass): boolean {
  return sectionComplete(sc, "basic");
}

/* What a section's five answers add up to — drives the table, the previews
 * and the import summary. */
export type SectionSummary = {
  total: number;
  answered: number;
  yes: RadioField[];
  /** Revealed inputs still blank. */
  missing: number;
  /** Revealed inputs that fail a format check. */
  invalid: number;
  complete: boolean;
};

export function sectionSummary(sc: ShareClass, section: SectionKey): SectionSummary {
  const qs = QUESTIONS[section];
  const answered = qs.filter((q) => sc.values[q.key]).length;
  const yes = qs.filter((q) => sc.values[q.key] === YES);
  let missing = 0;
  let invalid = 0;
  for (const q of yes) {
    for (const k of q.reveal?.[YES] ?? []) {
      const v = (sc.values[k.key] ?? "").trim();
      if (!v) missing++;
      else if (k.kind === "input" && validateInput(k, v)) invalid++;
    }
  }
  return { total: qs.length, answered, yes, missing, invalid, complete: answered === qs.length && missing === 0 && invalid === 0 };
}

/* Radio vs input tally for a field list, including everything any answer can
 * reveal — used to label each section honestly. */
export function fieldCounts(fields: Field[]): { radios: number; inputs: number } {
  let radios = 0;
  let inputs = 0;
  for (const f of flattenFields(fields)) {
    if (f.kind === "radio") radios++;
    else inputs++;
  }
  return { radios, inputs };
}

export const FORM_COUNTS = SECTIONS.reduce(
  (acc, s) => {
    const c = fieldCounts(FORM[s.id]);
    return { radios: acc.radios + c.radios, inputs: acc.inputs + c.inputs };
  },
  { radios: 0, inputs: 0 },
);
