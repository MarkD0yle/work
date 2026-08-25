/* Fund Connect 2 — schema: the shared Fund Connect form plus an ETF
 * identity & listing section in front of it.
 *
 * The base sections (fund & mandate, counterparty, order, fees, settlement,
 * attestation) and all their validation come from src/lib/fundConnect —
 * unchanged, so Fund Connect is unaffected. What FC2 adds is the identity
 * every primary-market grid row is keyed on: region, provider, long/short
 * name, ticker, trust and the house fund number.
 */

import {
  FIELDS as BASE_FIELDS,
  SECTIONS as BASE_SECTIONS,
  validateValue as baseValidateValue,
  type FieldDef,
  type Issue,
  type SectionDef,
} from "../fundConnect/schema";
import { lookupMaster } from "../fundConnect/reference";

export {
  derivedFor,
  isEmpty,
  isMissing,
  isRequiredAt,
  notionalOf,
  type Derived,
  type FieldDef,
  type FieldKind,
  type FieldRequirement,
  type Issue,
  type IssueLevel,
  type SectionDef,
  type ValidationStage,
} from "../fundConnect/schema";

/* Fictional issuers only — see the repo naming rules. */
export const REGIONS = ["US", "EMEA", "APAC"];
export const PROVIDERS = [
  "Meridian AM",
  "Northwind AM",
  "Aurora Capital",
  "Helix Investments",
];
export const TRUSTS = ["ETF Trust I", "ETF Trust II", "UCITS ICAV"];

const IDENTITY_FIELDS: FieldDef[] = [
  {
    id: "fundLongName",
    label: "Fund long name",
    sectionId: "identity",
    kind: "text",
    requirement: "draft",
    help: "Full legal name, as it appears on the listing.",
    importAliases: ["fund long name", "long name", "fund name", "legal name"],
  },
  {
    id: "fundShortName",
    label: "Fund short name",
    sectionId: "identity",
    kind: "text",
    requirement: "submit",
    importAliases: ["fund short name", "short name"],
  },
  {
    id: "ticker",
    label: "Ticker",
    sectionId: "identity",
    kind: "text",
    requirement: "submit",
    help: "2–6 characters, letters and digits.",
    importAliases: ["ticker", "ticker symbol", "symbol"],
  },
  {
    id: "region",
    label: "Fund region",
    sectionId: "identity",
    kind: "select",
    requirement: "submit",
    options: REGIONS,
    importAliases: ["region", "fund region"],
  },
  {
    id: "provider",
    label: "Provider",
    sectionId: "identity",
    kind: "select",
    requirement: "submit",
    options: PROVIDERS,
    importAliases: ["provider", "issuer", "sponsor"],
  },
  {
    id: "trust",
    label: "Trust",
    sectionId: "identity",
    kind: "select",
    requirement: "submit",
    options: TRUSTS,
    importAliases: ["trust", "umbrella"],
  },
  {
    id: "fundNumber",
    label: "Fund number",
    sectionId: "identity",
    kind: "text",
    requirement: "optional",
    help: "House number — assigned automatically when the draft is raised.",
    importAliases: ["fund number", "number", "fund no"],
  },
];

/* Fund distribution — cobrand channels and their dealing terms. Rendered as
 * a compact table (components/fund-connect2/CobrandTable), stored in the
 * single `cobrands` field in a readable serialised form so audit and delta
 * review stay legible. Codes live in ./cobrands. */
const DISTRIBUTION_SECTION: SectionDef = {
  id: "distribution",
  label: "Fund distribution",
  blurb: "Which cobrand channels offer the fund, and on what dealing terms.",
};

const DISTRIBUTION_FIELDS: FieldDef[] = [
  {
    id: "cobrands",
    label: "Cobrands",
    sectionId: "distribution",
    kind: "text",
    requirement: "optional",
    importAliases: [],
  },
];

const BASE_WITH_DISTRIBUTION: SectionDef[] = (() => {
  const out = [...BASE_SECTIONS];
  out.splice(out.findIndex((s) => s.id === "attest"), 0, DISTRIBUTION_SECTION);
  return out;
})();

export const SECTIONS: SectionDef[] = [
  {
    id: "identity",
    label: "Identity & listing",
    blurb: "What the ETF is called, who issues it, and where it sits.",
  },
  ...BASE_WITH_DISTRIBUTION,
];

export const FIELDS: FieldDef[] = [...IDENTITY_FIELDS, ...BASE_FIELDS, ...DISTRIBUTION_FIELDS];

export const FIELD_BY_ID: Record<string, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.id, f]),
);

export function fieldsInSection(sectionId: string): FieldDef[] {
  return FIELDS.filter((f) => f.sectionId === sectionId);
}

const TICKER = /^[A-Z0-9]{2,6}$/;

/** Base validation plus the identity rules the base schema doesn't know. */
export function validateValue(
  field: FieldDef,
  values: Record<string, string>,
): Issue | null {
  const raw = values[field.id]?.trim() ?? "";
  if (raw !== "") {
    if (field.id === "ticker" && !TICKER.test(raw.toUpperCase())) {
      return { level: "error", message: "Tickers are 2–6 letters or digits." };
    }
    if (field.id === "fundNumber" && !/^\d{3,6}$/.test(raw)) {
      return { level: "error", message: "Fund numbers are 3–6 digits." };
    }
    // "ctry" is the serialised marker for a country scope with no market
    // picked yet (see ./cobrands) — fine while drafting, not fit to submit.
    if (field.id === "cobrands" && /\bctry\b/.test(raw)) {
      return {
        level: "error",
        message: "A cobrand is scoped to countries but has no market picked.",
      };
    }
  }
  return baseValidateValue(field, values);
}

/** One-line summary of a section — FC2 copy of the base helper, over the
 *  extended field set. */
export function summariseSection(
  sectionId: string,
  values: Record<string, string>,
): string {
  const parts = fieldsInSection(sectionId)
    .filter((f) => f.requirement !== "optional")
    .slice(0, 3)
    .map((f) => {
      const v = values[f.id];
      if (v === undefined || v.trim() === "" || v === "Not confirmed") return null;
      if (f.kind === "lookup" && f.master) {
        const hit = lookupMaster(f.master, v);
        return hit ? `${v} ${hit.name}` : v;
      }
      return f.unit ? `${v} ${f.unit}` : v;
    })
    .filter((p): p is string => p !== null);
  return parts.length ? parts.join(" · ") : "Nothing entered yet";
}
