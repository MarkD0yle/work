import raw from "./ledgerline-transactions.json";

/* Advanced filter model for the Ledgerline transactions grid.
 *
 * The data is a 600-row slice exported from Ledgerline's seeded SQLite
 * database (transactions joined to portfolios and securities). Everything a
 * filter needs lives here: the field catalogue, the operators each kind of
 * field offers, the tree of groups and conditions, an evaluator, and a
 * translation into AG Grid's AdvancedFilterModel so the same filter can be
 * run by AG Grid's own engine. */

/* ---- data -------------------------------------------------------- */

/** Ledgerline's business date for the seed: relative dates count from here. */
export const BUSINESS_DATE = "2026-11-14";

interface RawTxn {
  id: string;
  portfolioId: string;
  portfolio: string;
  portfolioType: string;
  manager: string;
  securityId: string | null;
  security: string | null;
  isin: string | null;
  ticker: string | null;
  assetClass: string | null;
  market: string | null;
  type: string;
  tradeDate: string;
  settleDate: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
  currency: string;
  status: string;
  warningCode: string | null;
  origin: string;
  createdBy: string;
}

export interface Txn {
  id: string;
  portfolioId: string;
  portfolio: string;
  portfolioType: string;
  manager: string;
  security: string | null;
  isin: string | null;
  ticker: string | null;
  assetClass: string | null;
  market: string | null;
  type: string;
  tradeDate: string;
  settleDate: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;
  currency: string;
  status: string;
  warningCode: string | null;
  origin: string;
  createdBy: string;
  /** Calendar days from trade to settlement. */
  settleLag: number | null;
  /** Calendar days from trade date to the business date. */
  age: number;
  hasWarning: boolean;
}

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);
const num = (s: string | null) => (s == null || s === "" ? null : Number(s));

export const TRANSACTIONS: Txn[] = (raw as RawTxn[]).map((r) => ({
  id: r.id,
  portfolioId: r.portfolioId,
  portfolio: r.portfolio,
  portfolioType: r.portfolioType,
  manager: r.manager,
  security: r.security,
  isin: r.isin,
  ticker: r.ticker,
  assetClass: r.assetClass,
  market: r.market,
  type: r.type,
  tradeDate: r.tradeDate,
  settleDate: r.settleDate,
  quantity: num(r.quantity),
  price: num(r.price),
  amount: Number(r.amount),
  currency: r.currency,
  status: r.status,
  warningCode: r.warningCode,
  origin: r.origin,
  createdBy: r.createdBy,
  settleLag: r.settleDate ? daysBetween(r.tradeDate, r.settleDate) : null,
  age: daysBetween(r.tradeDate, BUSINESS_DATE),
  hasWarning: r.warningCode != null,
}));

/* ---- fields ------------------------------------------------------ */

export type FieldKind = "text" | "number" | "date" | "set" | "boolean";
export type FieldKey = keyof Txn;

export interface Field {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  category: Category;
  hint?: string;
  /** Display labels for set values. */
  labels?: Record<string, string>;
  /** Number shown with a unit in the value input. */
  unit?: string;
}

export type Category = "Trade" | "Amounts" | "Security" | "Portfolio" | "Control";
export const CATEGORIES: Category[] = ["Trade", "Amounts", "Security", "Portfolio", "Control"];

export const TYPE_LABEL: Record<string, string> = {
  buy: "Buy",
  sell: "Sell",
  income: "Income",
  corporateAction: "Corporate action",
  repo: "Repo",
  margin: "Margin",
  maturity: "Maturity",
  fee: "Fee",
};
export const STATUS_LABEL: Record<string, string> = { posted: "Posted", unposted: "Unposted", reversed: "Reversed" };
export const ASSET_LABEL: Record<string, string> = {
  govt: "Government",
  corporate: "Corporate",
  muni: "Municipal",
  mbs: "MBS",
  tba: "TBA",
  equity: "Equity",
  future: "Future",
  swap: "Swap",
  fxForward: "FX forward",
};
export const PORTFOLIO_TYPE_LABEL: Record<string, string> = {
  generalAccount: "General account",
  separateAccount: "Separate account",
  fund: "Fund",
};
export const ORIGIN_LABEL: Record<string, string> = { entered: "Entered", imported: "Imported", calculated: "Calculated" };
export const CREATED_BY_LABEL: Record<string, string> = {
  "u-ada": "Ada (Transaction Ops)",
  "u-ben": "Ben (Transaction Ops)",
  "interface-custody-feed": "Custody feed",
};
export const WARNING_LABEL: Record<string, string> = {
  "LL-VAL-0142": "LL-VAL-0142 · Price off vendor",
  "LL-VAL-0207": "LL-VAL-0207 · Settle date on holiday",
  "LL-VAL-0311": "LL-VAL-0311 · Quantity over position",
};
export const MARKET_LABEL: Record<string, string> = { US: "United States", EU: "Eurozone", UK: "United Kingdom", JP: "Japan" };

export const FIELDS: Field[] = [
  { key: "id", label: "Transaction ID", kind: "text", category: "Trade", hint: "T-0000123" },
  { key: "type", label: "Transaction type", kind: "set", category: "Trade", labels: TYPE_LABEL },
  { key: "status", label: "Status", kind: "set", category: "Trade", labels: STATUS_LABEL },
  { key: "tradeDate", label: "Trade date", kind: "date", category: "Trade" },
  { key: "settleDate", label: "Settle date", kind: "date", category: "Trade" },
  { key: "settleLag", label: "Settlement lag", kind: "number", category: "Trade", unit: "days" },
  { key: "age", label: "Age", kind: "number", category: "Trade", unit: "days", hint: "Days since trade date" },
  { key: "amount", label: "Amount", kind: "number", category: "Amounts" },
  { key: "quantity", label: "Quantity", kind: "number", category: "Amounts" },
  { key: "price", label: "Price", kind: "number", category: "Amounts" },
  { key: "currency", label: "Currency", kind: "set", category: "Amounts" },
  { key: "security", label: "Security", kind: "text", category: "Security", hint: "Description" },
  { key: "isin", label: "ISIN", kind: "text", category: "Security" },
  { key: "ticker", label: "Ticker", kind: "text", category: "Security" },
  { key: "assetClass", label: "Asset class", kind: "set", category: "Security", labels: ASSET_LABEL },
  { key: "market", label: "Market", kind: "set", category: "Security", labels: MARKET_LABEL },
  { key: "portfolio", label: "Portfolio", kind: "text", category: "Portfolio" },
  { key: "portfolioId", label: "Portfolio ID", kind: "text", category: "Portfolio", hint: "P-0018" },
  { key: "portfolioType", label: "Portfolio type", kind: "set", category: "Portfolio", labels: PORTFOLIO_TYPE_LABEL },
  { key: "manager", label: "Manager", kind: "set", category: "Portfolio" },
  { key: "origin", label: "Origin", kind: "set", category: "Control", labels: ORIGIN_LABEL },
  { key: "createdBy", label: "Created by", kind: "set", category: "Control", labels: CREATED_BY_LABEL },
  { key: "warningCode", label: "Warning code", kind: "set", category: "Control", labels: WARNING_LABEL },
  { key: "hasWarning", label: "Has warning", kind: "boolean", category: "Control" },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, Field>;

export function valueLabel(field: Field, v: string) {
  return field.labels?.[v] ?? v;
}

/** Distinct values of a set field with row counts, most common first. */
export function distinctValues(key: FieldKey): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of TRANSACTIONS) {
    const v = r[key];
    if (v == null) continue;
    counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/* ---- operators --------------------------------------------------- */

export type Op =
  // text
  | "contains"
  | "notContains"
  | "equals"
  | "notEqual"
  | "startsWith"
  | "endsWith"
  // number and date
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "notBetween"
  // date only
  | "lastNDays"
  | "olderThanNDays"
  | "thisMonth"
  | "lastMonth"
  | "ytd"
  // set
  | "anyOf"
  | "noneOf"
  // boolean
  | "isTrue"
  | "isFalse"
  // any
  | "blank"
  | "notBlank";

/** What the value editor needs to show for an operator. */
export type Arity = "none" | "one" | "two" | "many" | "days";

export interface OpDef {
  op: Op;
  label: string;
  arity: Arity;
}

const blankOps: OpDef[] = [
  { op: "blank", label: "is blank", arity: "none" },
  { op: "notBlank", label: "is not blank", arity: "none" },
];

export const OPS: Record<FieldKind, OpDef[]> = {
  text: [
    { op: "contains", label: "contains", arity: "one" },
    { op: "notContains", label: "does not contain", arity: "one" },
    { op: "equals", label: "equals", arity: "one" },
    { op: "notEqual", label: "does not equal", arity: "one" },
    { op: "startsWith", label: "starts with", arity: "one" },
    { op: "endsWith", label: "ends with", arity: "one" },
    ...blankOps,
  ],
  number: [
    { op: "eq", label: "=", arity: "one" },
    { op: "neq", label: "≠", arity: "one" },
    { op: "gt", label: ">", arity: "one" },
    { op: "gte", label: "≥", arity: "one" },
    { op: "lt", label: "<", arity: "one" },
    { op: "lte", label: "≤", arity: "one" },
    { op: "between", label: "between", arity: "two" },
    { op: "notBetween", label: "not between", arity: "two" },
    ...blankOps,
  ],
  date: [
    { op: "eq", label: "on", arity: "one" },
    { op: "neq", label: "not on", arity: "one" },
    { op: "lt", label: "before", arity: "one" },
    { op: "gt", label: "after", arity: "one" },
    { op: "lte", label: "on or before", arity: "one" },
    { op: "gte", label: "on or after", arity: "one" },
    { op: "between", label: "between", arity: "two" },
    { op: "notBetween", label: "not between", arity: "two" },
    { op: "lastNDays", label: "in the last", arity: "days" },
    { op: "olderThanNDays", label: "older than", arity: "days" },
    { op: "thisMonth", label: "this month", arity: "none" },
    { op: "lastMonth", label: "last month", arity: "none" },
    { op: "ytd", label: "year to date", arity: "none" },
    ...blankOps,
  ],
  set: [
    { op: "anyOf", label: "is any of", arity: "many" },
    { op: "noneOf", label: "is none of", arity: "many" },
    ...blankOps,
  ],
  boolean: [
    { op: "isTrue", label: "is yes", arity: "none" },
    { op: "isFalse", label: "is no", arity: "none" },
  ],
};

export function opDef(kind: FieldKind, op: Op): OpDef {
  return OPS[kind].find((o) => o.op === op) ?? OPS[kind][0];
}

/* ---- tree -------------------------------------------------------- */

export type Join = "AND" | "OR";

export interface Condition {
  kind: "condition";
  id: string;
  field: FieldKey;
  op: Op;
  value: string;
  value2: string;
  values: string[];
  enabled: boolean;
}

export interface Group {
  kind: "group";
  id: string;
  join: Join;
  /** Negates the whole group: NOT ( … ). */
  not: boolean;
  enabled: boolean;
  children: FilterNode[];
}

export type FilterNode = Condition | Group;

let seq = 0;
export const uid = (p: string) => `${p}${(seq += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newCondition(field: FieldKey = "status"): Condition {
  const f = FIELD_BY_KEY[field];
  return { kind: "condition", id: uid("c"), field, op: OPS[f.kind][0].op, value: "", value2: "", values: [], enabled: true };
}

export function newGroup(join: Join = "AND", children: FilterNode[] = []): Group {
  return { kind: "group", id: uid("g"), join, not: false, enabled: true, children };
}

/** A condition is complete when it has every value its operator needs. */
export function isComplete(c: Condition): boolean {
  const { kind } = FIELD_BY_KEY[c.field];
  const a = opDef(kind, c.op).arity;
  if (a === "none") return true;
  if (a === "many") return c.values.length > 0;
  if (a === "two") return c.value.trim() !== "" && c.value2.trim() !== "";
  if (a === "days") return c.value.trim() !== "" && Number(c.value) >= 0;
  if (kind === "number") return c.value.trim() !== "" && !Number.isNaN(Number(c.value));
  return c.value.trim() !== "";
}

/** Conditions that count: enabled, complete, inside enabled groups. */
export function activeConditions(n: FilterNode): Condition[] {
  if (!n.enabled) return [];
  if (n.kind === "condition") return isComplete(n) ? [n] : [];
  return n.children.flatMap(activeConditions);
}

export function countConditions(n: FilterNode): number {
  return n.kind === "condition" ? 1 : n.children.reduce((s, c) => s + countConditions(c), 0);
}

/* ---- dates ------------------------------------------------------- */

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(toTime(d) + n * DAY);
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const prevMonthStart = (d: string) => {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
};

/** A relative date operator as an inclusive range [from, to]; either end may be open. */
export function relativeRange(c: Condition): { from?: string; to?: string } | null {
  const n = Math.max(0, Math.floor(Number(c.value) || 0));
  switch (c.op) {
    case "lastNDays":
      return { from: addDays(BUSINESS_DATE, -n), to: BUSINESS_DATE };
    case "olderThanNDays":
      return { to: addDays(BUSINESS_DATE, -n - 1) };
    case "thisMonth":
      return { from: monthStart(BUSINESS_DATE), to: BUSINESS_DATE };
    case "lastMonth":
      return { from: prevMonthStart(BUSINESS_DATE), to: addDays(monthStart(BUSINESS_DATE), -1) };
    case "ytd":
      return { from: `${BUSINESS_DATE.slice(0, 4)}-01-01`, to: BUSINESS_DATE };
    default:
      return null;
  }
}

/* ---- evaluation -------------------------------------------------- */

const lc = (v: unknown) => String(v).toLowerCase();

export function testCondition(c: Condition, row: Txn): boolean {
  const field = FIELD_BY_KEY[c.field];
  const v = row[c.field];
  const isBlank = v == null || v === "";
  if (c.op === "blank") return isBlank;
  if (c.op === "notBlank") return !isBlank;
  if (c.op === "isTrue") return v === true;
  if (c.op === "isFalse") return v !== true;

  switch (field.kind) {
    case "text": {
      // Negative text operators let blanks through, as AG Grid does.
      if (isBlank) return c.op === "notContains" || c.op === "notEqual";
      const s = lc(v);
      const q = lc(c.value.trim());
      if (c.op === "contains") return s.includes(q);
      if (c.op === "notContains") return !s.includes(q);
      if (c.op === "equals") return s === q;
      if (c.op === "notEqual") return s !== q;
      if (c.op === "startsWith") return s.startsWith(q);
      if (c.op === "endsWith") return s.endsWith(q);
      return false;
    }
    case "set": {
      if (c.op === "anyOf") return !isBlank && c.values.includes(String(v));
      if (c.op === "noneOf") return isBlank || !c.values.includes(String(v));
      return false;
    }
    case "number":
    case "date": {
      if (isBlank) return c.op === "neq" || c.op === "notBetween";
      const rel = relativeRange(c);
      if (rel) {
        const s = String(v);
        return (rel.from == null || s >= rel.from) && (rel.to == null || s <= rel.to);
      }
      const parse = (x: string) => (field.kind === "number" ? Number(x) : x);
      const x = (field.kind === "number" ? Number(v) : String(v)) as number | string;
      const a = parse(c.value.trim());
      const b = parse(c.value2.trim());
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      switch (c.op) {
        case "eq":
          return x === a;
        case "neq":
          return x !== a;
        case "gt":
          return x > a;
        case "gte":
          return x >= a;
        case "lt":
          return x < a;
        case "lte":
          return x <= a;
        case "between":
          return x >= lo && x <= hi;
        case "notBetween":
          return x < lo || x > hi;
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

/** True when the row passes. Disabled or incomplete nodes are ignored; a
 * group with nothing active passes everything. */
export function testNode(n: FilterNode, row: Txn): boolean {
  return evalNode(n, row) ?? true;
}

function evalNode(n: FilterNode, row: Txn): boolean | null {
  if (!n.enabled) return null;
  if (n.kind === "condition") return isComplete(n) ? testCondition(n, row) : null;
  const results = n.children.map((c) => evalNode(c, row)).filter((r): r is boolean => r !== null);
  if (results.length === 0) return null;
  const r = n.join === "AND" ? results.every(Boolean) : results.some(Boolean);
  return n.not ? !r : r;
}

/** Rows matching a node on its own, ignoring the rest of the tree. */
export function matchCount(n: FilterNode, rows: Txn[] = TRANSACTIONS): number | null {
  if (evalNode(n, rows[0]) === null && n.kind === "condition") return null;
  let k = 0;
  for (const r of rows) if (evalNode(n, r) !== false) k += 1;
  return k;
}

/* ---- describing -------------------------------------------------- */

function fmtNum(field: Field, s: string) {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  const out = n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return field.unit ? `${out} ${field.unit}` : out;
}

/** Plain-English sentence fragment for one condition. */
export function describeCondition(c: Condition): string {
  const f = FIELD_BY_KEY[c.field];
  const d = opDef(f.kind, c.op);
  const val = (s: string) => (f.kind === "number" ? fmtNum(f, s) : f.kind === "text" ? `“${s}”` : s);
  switch (d.arity) {
    case "none":
      return `${f.label} ${d.label}`;
    case "many": {
      const vs = c.values.map((v) => valueLabel(f, v));
      const list = vs.length <= 3 ? vs.join(", ") : `${vs.slice(0, 2).join(", ")} +${vs.length - 2} more`;
      return `${f.label} ${d.label} ${list || "…"}`;
    }
    case "two":
      return `${f.label} ${d.label} ${val(c.value) || "…"} and ${val(c.value2) || "…"}`;
    case "days":
      return `${f.label} ${d.label} ${c.value || "…"} days`;
    default:
      return `${f.label} ${d.label} ${c.value ? val(c.value) : "…"}`;
  }
}

/* ---- AG Grid AdvancedFilterModel --------------------------------- */

/* AG Grid's Advanced Filter supports nested AND/OR joins of column
 * conditions, but has no NOT, no "between", no "any of" and no relative
 * dates. Those are rewritten into what it does support:
 *
 *   any of / none of   → OR of equals / AND of not-equal
 *   between            → AND of ≥ and ≤
 *   relative dates     → absolute ranges against the business date
 *   NOT ( … )          → pushed down with De Morgan's laws, flipping each
 *                        operator. A negated comparison also lets blanks
 *                        through, so NOT (x > 5) becomes (x ≤ 5 OR blank).
 *
 * "Starts with" and "ends with" have no negated form in AG Grid, so a
 * negated one cannot be expressed; it is reported back instead. */

export interface AgColumnCondition {
  /** Matches the column's cellDataType: date columns here are ISO strings, so "dateString". */
  filterType: "text" | "number" | "dateString" | "boolean";
  colId: string;
  type: string;
  filter?: string | number;
}
export interface AgJoin {
  filterType: "join";
  type: Join;
  conditions: AgModel[];
}
export type AgModel = AgColumnCondition | AgJoin;

export interface AgTranslation {
  model: AgModel | null;
  /** Conditions AG Grid can't express, by description. */
  unsupported: string[];
}

const agFilterType = (f: Field): AgColumnCondition["filterType"] =>
  f.kind === "set" ? "text" : f.kind === "date" ? "dateString" : f.kind === "boolean" ? "boolean" : f.kind;

const join = (type: Join, conditions: AgModel[]): AgModel =>
  conditions.length === 1 ? conditions[0] : { filterType: "join", type, conditions };

/** One condition as an AG Grid model, as written or negated. Every form
 * states what it does with blanks, so the result matches the evaluator
 * whatever AG Grid's own blank defaults are. */
function condToAg(c: Condition, neg: boolean, unsupported: string[]): AgModel | null {
  const f = FIELD_BY_KEY[c.field];
  const L = (type: string, filter?: string | number): AgModel => {
    const out: AgColumnCondition = { filterType: agFilterType(f), colId: f.key, type };
    if (filter !== undefined) out.filter = filter;
    return out;
  };
  const val = (s: string): string | number => (f.kind === "number" ? Number(s) : s.trim());
  const AND = (...m: AgModel[]) => join("AND", m);
  const OR = (...m: AgModel[]) => join("OR", m);
  const blank = L("blank");
  const v = val(c.value);
  const pick = (pos: AgModel, negated: AgModel) => (neg ? negated : pos);

  switch (c.op) {
    case "blank":
      return pick(blank, L("notBlank"));
    case "notBlank":
      return pick(L("notBlank"), blank);
    case "isTrue":
      return pick(L("true"), L("false"));
    case "isFalse":
      return pick(L("false"), L("true"));
    // Text: "does not contain" and "!=" let blanks through.
    case "contains":
      return pick(L("contains", v), L("notContains", v));
    case "notContains":
      return pick(L("notContains", v), L("contains", v));
    case "equals":
      return pick(L("equals", v), L("notEqual", v));
    case "notEqual":
      return pick(L("notEqual", v), L("equals", v));
    case "startsWith":
    case "endsWith":
      if (neg) {
        unsupported.push(`NOT (${describeCondition(c)})`);
        return null;
      }
      return L(c.op, v);
    // Numbers and dates: blanks fail every comparison and pass every negation.
    case "eq":
      return pick(L("equals", v), OR(L("notEqual", v), blank));
    case "neq":
      return pick(OR(L("notEqual", v), blank), L("equals", v));
    case "gt":
      return pick(L("greaterThan", v), OR(L("lessThanOrEqual", v), blank));
    case "gte":
      return pick(L("greaterThanOrEqual", v), OR(L("lessThan", v), blank));
    case "lt":
      return pick(L("lessThan", v), OR(L("greaterThanOrEqual", v), blank));
    case "lte":
      return pick(L("lessThanOrEqual", v), OR(L("greaterThan", v), blank));
    case "between":
    case "notBetween": {
      const a = val(c.value);
      const b = val(c.value2);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const inside = AND(L("greaterThanOrEqual", lo), L("lessThanOrEqual", hi));
      const outside = OR(L("lessThan", lo), L("greaterThan", hi), blank);
      return c.op === "between" ? pick(inside, outside) : pick(outside, inside);
    }
    case "anyOf":
    case "noneOf": {
      const any = OR(...c.values.map((x) => L("equals", x)));
      const none = OR(AND(...c.values.map((x) => L("notEqual", x))), blank);
      return c.op === "anyOf" ? pick(any, none) : pick(none, any);
    }
    default: {
      const r = relativeRange(c);
      if (!r) return null;
      const present = (m: (AgModel | null)[]) => m.filter((x): x is AgModel => x !== null);
      const inside = AND(
        ...present([r.from ? L("greaterThanOrEqual", r.from) : null, r.to ? L("lessThanOrEqual", r.to) : null]),
      );
      const outside = OR(...present([r.from ? L("lessThan", r.from) : null, r.to ? L("greaterThan", r.to) : null]), blank);
      return pick(inside, outside);
    }
  }
}

function nodeToAg(n: FilterNode, neg: boolean, unsupported: string[]): AgModel | null {
  if (!n.enabled) return null;
  if (n.kind === "condition") return isComplete(n) ? condToAg(n, neg, unsupported) : null;
  const negHere = n.not ? !neg : neg;
  const parts = n.children.map((c) => nodeToAg(c, negHere, unsupported)).filter((m): m is AgModel => m !== null);
  if (parts.length === 0) return null;
  const type: Join = negHere ? (n.join === "AND" ? "OR" : "AND") : n.join;
  return join(type, parts);
}

export function toAgModel(root: Group): AgTranslation {
  const unsupported: string[] = [];
  const model = nodeToAg(root, false, unsupported);
  return { model: unsupported.length ? null : model, unsupported };
}

/** AG Grid's Advanced Filter text syntax for a model, e.g.
 * [Status] = "unposted" AND ([Amount] > 1000000 OR [Currency] = "GBP"). */
const AG_OP_TEXT: Record<string, string> = {
  contains: "contains",
  notContains: "does not contain",
  equals: "=",
  notEqual: "!=",
  startsWith: "begins with",
  endsWith: "ends with",
  greaterThan: ">",
  greaterThanOrEqual: ">=",
  lessThan: "<",
  lessThanOrEqual: "<=",
  blank: "is blank",
  notBlank: "is not blank",
  true: "is true",
  false: "is false",
};

export function agExpression(m: AgModel | null, top = true): string {
  if (!m) return "";
  if (m.filterType === "join") {
    const inner = m.conditions.map((c) => agExpression(c, false)).join(` ${m.type} `);
    return top ? inner : `(${inner})`;
  }
  const label = FIELD_BY_KEY[m.colId as FieldKey]?.label ?? m.colId;
  const op = AG_OP_TEXT[m.type] ?? m.type;
  if (m.filter === undefined) return `[${label}] ${op}`;
  const v = typeof m.filter === "number" ? String(m.filter) : `"${m.filter}"`;
  return `[${label}] ${op} ${v}`;
}

/* ---- presets ----------------------------------------------------- */

const C = (field: FieldKey, op: Op, v: Partial<Pick<Condition, "value" | "value2" | "values">> = {}): Condition => ({
  ...newCondition(field),
  op,
  value: v.value ?? "",
  value2: v.value2 ?? "",
  values: v.values ?? [],
});

export interface Preset {
  id: string;
  name: string;
  owner: string;
  note: string;
  build: () => Group;
}

export const PRESETS: Preset[] = [
  {
    id: "unposted-warnings",
    name: "Unposted with warnings",
    owner: "Transaction Ops",
    note: "Records that won't post until someone acknowledges the warning.",
    build: () => newGroup("AND", [C("status", "anyOf", { values: ["unposted"] }), C("warningCode", "notBlank")]),
  },
  {
    id: "large-non-usd",
    name: "Large non-USD trades",
    owner: "Cleo · Controller",
    note: "Buys and sells over 1m outside USD, for the FX revaluation check.",
    build: () =>
      newGroup("AND", [
        C("type", "anyOf", { values: ["buy", "sell"] }),
        C("currency", "noneOf", { values: ["USD"] }),
        C("amount", "gt", { value: "1000000" }),
      ]),
  },
  {
    id: "repo-margin-month",
    name: "Repo & margin this month, manual only",
    owner: "Funding desk",
    note: "Excludes the custody feed so only hand-keyed financing is left.",
    build: () => {
      const feed = newGroup("AND", [C("createdBy", "anyOf", { values: ["interface-custody-feed"] })]);
      feed.not = true;
      return newGroup("AND", [C("type", "anyOf", { values: ["repo", "margin"] }), C("tradeDate", "thisMonth"), feed]);
    },
  },
  {
    id: "close-review",
    name: "Month-end close review",
    owner: "Investment Accounting",
    note: "Anything that would hold up close: reversals, stale unposted, calculated rows with warnings.",
    build: () =>
      newGroup("OR", [
        C("status", "anyOf", { values: ["reversed"] }),
        newGroup("AND", [C("status", "anyOf", { values: ["unposted"] }), C("age", "gt", { value: "3" })]),
        newGroup("AND", [C("origin", "anyOf", { values: ["calculated"] }), C("hasWarning", "isTrue")]),
      ]),
  },
  {
    id: "fi-slow-settle",
    name: "Fixed income settling T+3 or later",
    owner: "Settlements",
    note: "Bond trades whose settle date sits three or more calendar days out.",
    build: () =>
      newGroup("AND", [
        C("assetClass", "anyOf", { values: ["govt", "corporate", "muni", "mbs"] }),
        C("type", "anyOf", { values: ["buy", "sell"] }),
        C("settleLag", "gte", { value: "3" }),
      ]),
  },
];

/* ---- tree edits (immutable) -------------------------------------- */

export function mapNode(root: Group, id: string, fn: (n: FilterNode) => FilterNode | null): Group {
  const walk = (n: FilterNode): FilterNode | null => {
    if (n.id === id) return fn(n);
    if (n.kind === "condition") return n;
    return { ...n, children: n.children.map(walk).filter((c): c is FilterNode => c !== null) };
  };
  return walk(root) as Group;
}

export function cloneNode(n: FilterNode): FilterNode {
  if (n.kind === "condition") return { ...n, id: uid("c"), values: [...n.values] };
  return { ...n, id: uid("g"), children: n.children.map(cloneNode) };
}

export function findNode(root: FilterNode, id: string): FilterNode | null {
  if (root.id === id) return root;
  if (root.kind === "condition") return null;
  for (const c of root.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export function depthOf(root: FilterNode, id: string, d = 0): number {
  if (root.id === id) return d;
  if (root.kind === "condition") return -1;
  for (const c of root.children) {
    const hit = depthOf(c, id, d + 1);
    if (hit >= 0) return hit;
  }
  return -1;
}

export const MAX_DEPTH = 3;
