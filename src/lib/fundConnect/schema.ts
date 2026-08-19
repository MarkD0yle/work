/* Fund Connect — form schema and validation. Spec §1 (two-tier validation),
 * §3 (no free text where the value set is finite) and §7 (source-of-truth).
 *
 * Two tiers, deliberately:
 *   draft-valid   enough to save and identify the record. This is what
 *                 removes the incentive to type placeholder data just to
 *                 get past a required field.
 *   submit-valid  the full check, surfaced as a running checklist rather
 *                 than a wall of errors at the end.
 */

import { lookupMaster, masterEntries, nearMisses, type MasterId } from "./reference";

export type FieldKind = "text" | "number" | "select" | "lookup" | "date" | "toggle";

/** draft = needed to save at all · submit = needed to leave draft. */
export type FieldRequirement = "draft" | "submit" | "optional";

export type FieldDef = {
  id: string;
  label: string;
  sectionId: string;
  kind: FieldKind;
  requirement: FieldRequirement;
  /** Finite value set — rendered as a dropdown, never a free-text box. */
  options?: string[];
  /** Reference system this field resolves against. */
  master?: MasterId;
  help?: string;
  unit?: string;
  /** Shows a derived sanity value alongside the entry. Spec §3. */
  highRisk?: boolean;
  /** Header spellings seen in the Excel sheets, for import auto-mapping. */
  importAliases: string[];
};

export type SectionDef = {
  id: string;
  label: string;
  blurb: string;
};

export const SECTIONS: SectionDef[] = [
  { id: "fund", label: "Fund & mandate", blurb: "Which fund the instruction belongs to." },
  { id: "counterparty", label: "Counterparty & accounts", blurb: "Who is on the other side, and where it settles." },
  { id: "order", label: "Order details", blurb: "Instrument, direction, size and dates." },
  { id: "fees", label: "Fees & charges", blurb: "Fee basis applied to this instruction." },
  { id: "settlement", label: "Cash & settlement", blurb: "Currency, method and cut-off." },
  { id: "attest", label: "Review & attestation", blurb: "Risk classification and submitter sign-off." },
];

const CCY = ["GBP", "USD", "EUR", "CHF", "JPY"];

export const FIELDS: FieldDef[] = [
  // 1 — Fund & mandate
  {
    id: "fundCode",
    label: "Fund code",
    sectionId: "fund",
    kind: "lookup",
    master: "fund",
    requirement: "draft",
    help: "Resolved against the fund master.",
    importAliases: ["fund code", "fund", "fund id", "portfolio code"],
  },
  {
    id: "shareClass",
    label: "Share class",
    sectionId: "fund",
    kind: "select",
    requirement: "submit",
    options: ["Acc GBP", "Inc GBP", "Acc USD", "Inc EUR", "Hedged Acc EUR"],
    importAliases: ["share class", "class", "unit class"],
  },
  {
    id: "baseCcy",
    label: "Base currency",
    sectionId: "fund",
    kind: "select",
    requirement: "submit",
    options: CCY,
    importAliases: ["base ccy", "base currency", "fund ccy"],
  },
  {
    id: "domicile",
    label: "Domicile",
    sectionId: "fund",
    kind: "select",
    requirement: "submit",
    options: ["Ireland", "Luxembourg", "United Kingdom", "Cayman Islands"],
    importAliases: ["domicile", "country"],
  },
  {
    id: "mandateType",
    label: "Mandate type",
    sectionId: "fund",
    kind: "select",
    requirement: "submit",
    options: ["Segregated", "Pooled", "Feeder"],
    importAliases: ["mandate type", "mandate"],
  },

  // 2 — Counterparty & accounts
  {
    id: "cptyId",
    label: "Counterparty ID",
    sectionId: "counterparty",
    kind: "lookup",
    master: "counterparty",
    requirement: "draft",
    help: "Resolved against the counterparty master — the resolved name is the check, not the format.",
    importAliases: ["counterparty id", "cpty id", "counterparty", "cpty"],
  },
  {
    id: "dealingAccount",
    label: "Dealing account",
    sectionId: "counterparty",
    kind: "text",
    requirement: "submit",
    help: "8–10 digits.",
    importAliases: ["dealing account", "account", "account no", "account number"],
  },
  {
    id: "custodian",
    label: "Custodian",
    sectionId: "counterparty",
    kind: "select",
    requirement: "submit",
    options: masterEntries("custodian").map((c) => c.name),
    importAliases: ["custodian", "custody agent"],
  },
  {
    id: "ssiBic",
    label: "SSI BIC",
    sectionId: "counterparty",
    kind: "text",
    requirement: "submit",
    help: "8 or 11 characters.",
    importAliases: ["ssi bic", "bic", "swift"],
  },

  // 3 — Order details
  {
    id: "instrumentId",
    label: "Instrument (ISIN)",
    sectionId: "order",
    kind: "lookup",
    master: "instrument",
    requirement: "submit",
    importAliases: ["isin", "instrument", "instrument id", "security"],
  },
  {
    id: "side",
    label: "Side",
    sectionId: "order",
    kind: "select",
    requirement: "submit",
    options: ["Subscribe", "Redeem", "Switch in", "Switch out"],
    importAliases: ["side", "direction", "buy/sell"],
  },
  {
    id: "quantity",
    label: "Quantity",
    sectionId: "order",
    kind: "number",
    requirement: "submit",
    highRisk: true,
    unit: "units",
    importAliases: ["quantity", "qty", "units", "shares"],
  },
  {
    id: "price",
    label: "Price",
    sectionId: "order",
    kind: "number",
    requirement: "submit",
    highRisk: true,
    unit: "per unit",
    importAliases: ["price", "unit price", "nav price"],
  },
  {
    id: "tradeDate",
    label: "Trade date",
    sectionId: "order",
    kind: "date",
    requirement: "submit",
    importAliases: ["trade date", "deal date", "value date"],
  },
  {
    id: "settlementDate",
    label: "Settlement date",
    sectionId: "order",
    kind: "date",
    requirement: "submit",
    importAliases: ["settlement date", "settle date", "sett date"],
  },

  // 4 — Fees & charges
  {
    id: "mgmtFeeBps",
    label: "Management fee",
    sectionId: "fees",
    kind: "number",
    requirement: "submit",
    unit: "bps",
    highRisk: true,
    importAliases: ["mgmt fee (bps)", "mgmt fee", "management fee", "amc"],
  },
  {
    id: "perfFeeBps",
    label: "Performance fee",
    sectionId: "fees",
    kind: "number",
    requirement: "optional",
    unit: "bps",
    importAliases: ["perf fee (bps)", "perf fee", "performance fee"],
  },
  {
    id: "dealingCharge",
    label: "Dealing charge",
    sectionId: "fees",
    kind: "number",
    requirement: "optional",
    unit: "%",
    importAliases: ["dealing charge", "entry charge", "initial charge"],
  },

  // 5 — Cash & settlement
  {
    id: "settleCcy",
    label: "Settlement currency",
    sectionId: "settlement",
    kind: "select",
    requirement: "submit",
    options: CCY,
    importAliases: ["settle ccy", "settlement currency", "settlement ccy"],
  },
  {
    id: "settlementMethod",
    label: "Settlement method",
    sectionId: "settlement",
    kind: "select",
    requirement: "submit",
    options: ["DVP", "FOP", "Cash transfer"],
    importAliases: ["settlement method", "method", "sett method"],
  },
  {
    id: "cutoff",
    label: "Dealing cut-off",
    sectionId: "settlement",
    kind: "select",
    requirement: "submit",
    options: ["10:00 London", "12:00 London", "15:00 London", "17:00 London"],
    importAliases: ["cut-off", "cutoff", "dealing cut-off"],
  },
  {
    id: "paymentRef",
    label: "Payment reference",
    sectionId: "settlement",
    kind: "text",
    requirement: "optional",
    importAliases: ["payment ref", "payment reference", "reference"],
  },

  // 6 — Review & attestation
  {
    id: "firstTimeSetup",
    label: "First-time setup",
    sectionId: "attest",
    kind: "select",
    requirement: "submit",
    options: ["Yes", "No"],
    help: "Drives the review threshold.",
    importAliases: ["first time setup", "new setup"],
  },
  {
    id: "riskCategory",
    label: "Risk category",
    sectionId: "attest",
    kind: "select",
    requirement: "submit",
    options: ["Standard", "Elevated", "High"],
    importAliases: ["risk category", "risk"],
  },
  {
    id: "attestation",
    label: "Values checked against source documents",
    sectionId: "attest",
    kind: "toggle",
    requirement: "submit",
    options: ["Confirmed", "Not confirmed"],
    importAliases: [],
  },
  {
    id: "comments",
    label: "Submitter notes",
    sectionId: "attest",
    kind: "text",
    requirement: "optional",
    importAliases: ["notes", "comments"],
  },
];

export const FIELD_BY_ID: Record<string, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.id, f]),
);

export function fieldsInSection(sectionId: string): FieldDef[] {
  return FIELDS.filter((f) => f.sectionId === sectionId);
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export type IssueLevel = "error" | "warning";
export type Issue = { level: IssueLevel; message: string };

export type ValidationStage = "draft" | "submit";

const BIC = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const ACCOUNT = /^\d{8,10}$/;
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

export function isEmpty(value: string | undefined): boolean {
  return value === undefined || value.trim() === "" || value === "Not confirmed";
}

/** Is this field required at the given tier? */
export function isRequiredAt(field: FieldDef, stage: ValidationStage): boolean {
  if (field.requirement === "optional") return false;
  if (field.requirement === "draft") return true;
  return stage === "submit";
}

export function isMissing(
  field: FieldDef,
  values: Record<string, string>,
  stage: ValidationStage,
): boolean {
  return isRequiredAt(field, stage) && isEmpty(values[field.id]);
}

function num(value: string): number {
  return Number(value.replace(/[, ]/g, ""));
}

/** Validate a value that is actually present. Emptiness is handled by
 *  `isMissing`, so the two can be reported differently — a missing field is
 *  a checklist item, a bad value is an error. */
export function validateValue(
  field: FieldDef,
  values: Record<string, string>,
): Issue | null {
  const raw = values[field.id];
  if (isEmpty(raw)) return null;
  const value = raw.trim();

  if (field.kind === "select" && field.options && !field.options.includes(value)) {
    return { level: "error", message: `"${value}" is not one of the accepted values.` };
  }

  if (field.kind === "lookup" && field.master) {
    if (field.id === "instrumentId" && !ISIN.test(value.toUpperCase())) {
      return { level: "error", message: "Not a well-formed ISIN." };
    }
    const hit = lookupMaster(field.master, value);
    if (!hit) {
      return {
        level: "error",
        message: `${value} does not exist in the ${field.master} master.`,
      };
    }
    if (hit.status !== "active") {
      return {
        level: "error",
        message: `${hit.name} is ${hit.status} in the ${field.master} master.`,
      };
    }
    const similar = nearMisses(field.master, value);
    if (similar.length > 0) {
      return {
        level: "warning",
        message: `Resolves to ${hit.name}. ${similar
          .map((s) => `${s.code} (${s.name})`)
          .join(", ")} is one transposition away — confirm this is the right entity.`,
      };
    }
  }

  if (field.kind === "number") {
    const n = num(value);
    if (!Number.isFinite(n)) return { level: "error", message: "Not a number." };
    if (n < 0) return { level: "error", message: "Cannot be negative." };
    if ((field.id === "quantity" || field.id === "price") && n === 0) {
      return { level: "error", message: "Must be greater than zero." };
    }
    if (field.id === "mgmtFeeBps" && n > 300) {
      return { level: "error", message: "Above the 300 bps mandate ceiling." };
    }
    if (field.id === "dealingCharge" && n > 5) {
      return { level: "warning", message: "Above the 5% house maximum for dealing charges." };
    }
  }

  if (field.id === "dealingAccount" && !ACCOUNT.test(value)) {
    return { level: "error", message: "Dealing accounts are 8–10 digits." };
  }
  if (field.id === "ssiBic" && !BIC.test(value.toUpperCase())) {
    return { level: "error", message: "A BIC is 8 or 11 characters, letters then alphanumerics." };
  }

  if (field.id === "settlementDate") {
    const trade = values.tradeDate;
    if (trade && value < trade) {
      return { level: "error", message: "Settlement cannot precede the trade date." };
    }
    if (trade && value === trade) {
      return { level: "warning", message: "Same-day settlement — confirm the counterparty supports T+0." };
    }
  }

  // Source-of-truth cross-check: the fund master owns the dealing currency.
  if (field.id === "baseCcy") {
    const fund = values.fundCode ? lookupMaster("fund", values.fundCode) : null;
    if (fund?.ccy && fund.ccy !== value) {
      return {
        level: "error",
        message: `Fund master has ${fund.name} dealing in ${fund.ccy}.`,
      };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Derived sanity values — spec §3, "an outlier is visible before submit"
 * ------------------------------------------------------------------ */

export type Derived = { label: string; value: string; level: IssueLevel | null };

const money = (n: number, ccy: string) =>
  `${ccy} ${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

export function notionalOf(values: Record<string, string>): number | null {
  const q = num(values.quantity ?? "");
  const p = num(values.price ?? "");
  if (!Number.isFinite(q) || !Number.isFinite(p) || !q || !p) return null;
  return q * p;
}

/** The read-out shown next to a high-risk numeric field. */
export function derivedFor(
  field: FieldDef,
  values: Record<string, string>,
): Derived | null {
  const ccy = values.baseCcy || "GBP";
  const notional = notionalOf(values);

  if (field.id === "quantity" || field.id === "price") {
    if (notional === null) return null;
    const fund = values.fundCode ? lookupMaster("fund", values.fundCode) : null;
    const avg = fund?.avgTicket;
    if (!avg) return { label: "Notional", value: money(notional, ccy), level: null };
    const ratio = notional / avg;
    return {
      label: "Notional",
      value: `${money(notional, ccy)} · ${ratio.toFixed(1)}× the fund's 90-day average ticket`,
      level: ratio >= 3 ? "warning" : null,
    };
  }

  if (field.id === "mgmtFeeBps") {
    const bps = num(values.mgmtFeeBps ?? "");
    if (!Number.isFinite(bps) || !bps || notional === null) return null;
    return {
      label: "Annual fee on this notional",
      value: money((notional * bps) / 10_000, ccy),
      level: null,
    };
  }

  return null;
}

/** One-line summary of a section, shown when it condenses. Spec §3. */
export function summariseSection(
  sectionId: string,
  values: Record<string, string>,
): string {
  const parts = fieldsInSection(sectionId)
    .filter((f) => f.requirement !== "optional")
    .slice(0, 3)
    .map((f) => {
      const v = values[f.id];
      if (isEmpty(v)) return null;
      if (f.kind === "lookup" && f.master) {
        const hit = lookupMaster(f.master, v);
        return hit ? `${v} ${hit.name}` : v;
      }
      return f.unit ? `${v} ${f.unit}` : v;
    })
    .filter((p): p is string => p !== null);
  return parts.length ? parts.join(" · ") : "Nothing entered yet";
}
