/* ETE Fund Configuration — types, reference lists and field definitions.
 *
 * The model follows the real hierarchy:
 *
 *   ETE Fund
 *   └─ Order Type
 *      └─ Settlement Period (T+0 … T+5)
 *
 * Settlement Periods live inside an Order Type and nowhere else. This folder
 * is the ETE Fund Configuration workspace of Fund Connect 2: it shares the
 * page shell, the users and the dark mode, and keeps its own model and mock
 * data. Like the rest of the feature, nothing here imports from outside
 * src/features/fund-connect-2. */

/** A Fund Connect 2 user id, from lib/engine USERS. */
export type UserId = string;

/** Offsets from trade date. Every Order Type carries all six. */
export const SETTLEMENT_DAYS = [0, 1, 2, 3, 4, 5] as const;
export type SettlementDay = (typeof SETTLEMENT_DAYS)[number];

export type SettlementPeriod = {
  day: SettlementDay;
  active: boolean;
  creationAllowed: boolean;
  redemptionAllowed: boolean;
  approvalRequired: boolean;
  /** Continuous Net Settlement. Only applies on some settlement venues. */
  cns: boolean;
  /** Order window on trade date, "HH:MM". */
  tOpen: string;
  tClose: string;
  /** Order window on the day before trade date. Both blank = not accepted. */
  t1Open: string;
  t1Close: string;
};

export const BASKET_TYPES = ["In-kind", "Cash", "Hybrid"] as const;
export type BasketType = (typeof BASKET_TYPES)[number];

export type OrderType = {
  id: string;
  name: string;
  code: string;
  basket: BasketType;
  /** Off keeps the whole configuration but takes the Order Type out of use. */
  enabled: boolean;
  creation: boolean;
  redemption: boolean;
  assistedTrading: boolean;
  cashInLieu: boolean;
  directedTrading: boolean;
  periods: SettlementPeriod[];
};

export type FundDetails = {
  fundName: string;
  fundCode: string;
  issuer: string;
  ticker: string;
  isin: string;
  listingExchange: string;
  assetClass: string;
  benchmark: string;
  region: string;
  currency: string;
  creationUnitSize: string;
  incomeTreatment: string;
  custodian: string;
  transferAgent: string;
  settlementVenue: string;
  cutoffTimezone: string;
  orderChannel: string;
  confirmationRouting: string;
  operationsContact: string;
};

export type DetailKey = keyof FundDetails;

export type Distribution = {
  countries: string[];
  institutionMode: "all" | "selected";
  institutions: string[];
  cobrand: boolean;
  cobrandName: string;
};

export type FundConfig = {
  details: FundDetails;
  orderTypes: OrderType[];
  defaultCreationId: string | null;
  defaultRedemptionId: string | null;
  distribution: Distribution;
};

export type PendingState = "draft" | "awaiting" | "rejected";

/** A change that is not live yet. It never touches the active version. */
export type PendingChange = {
  config: FundConfig;
  state: PendingState;
  createdBy: UserId;
  submittedBy?: UserId;
  submittedAt?: string;
  rejectedBy?: UserId;
  rejectedAt?: string;
  rejectionReason?: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: UserId;
  title: string;
  detail?: string;
  tone?: "neutral" | "positive" | "negative" | "info" | "warning";
};

export type Fund = {
  id: string;
  /** The configuration in use. Null until the fund is first approved. */
  active: FundConfig | null;
  activeVersion: number;
  pending: PendingChange | null;
  lastModifiedBy: UserId;
  lastModifiedAt: string;
  history: AuditEvent[];
};

export type WorkflowState = PendingState | "active";

export const WORKFLOW_LABEL: Record<WorkflowState, string> = {
  draft: "Draft",
  awaiting: "Awaiting approval",
  rejected: "Rejected",
  active: "Active",
};

export function workflowState(fund: Fund): WorkflowState {
  return fund.pending ? fund.pending.state : "active";
}

export function fundStatus(fund: Fund): string {
  return fund.active ? "Active" : "In setup";
}

/** The configuration a reader should see first: the pending one if any. */
export function latestConfig(fund: Fund): FundConfig {
  return (fund.pending?.config ?? fund.active) as FundConfig;
}

export function periodLabel(day: SettlementDay): string {
  return `T+${day}`;
}

/* ------------------------------------------------------------------ */
/* Reference lists                                                     */
/* ------------------------------------------------------------------ */

export const REGIONS = ["Americas", "EMEA", "APAC"];
export const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "CHF", "HKD", "JPY", "AUD"];
export const ASSET_CLASSES = ["Equity", "Fixed income", "Commodity", "Multi-asset"];
export const INCOME_TREATMENTS = ["Distributing", "Accumulating"];
export const EXCHANGES = [
  "NYSE Arca",
  "Nasdaq",
  "Toronto Stock Exchange",
  "London Stock Exchange",
  "Xetra",
  "Euronext Amsterdam",
  "Hong Kong Stock Exchange",
  "Tokyo Stock Exchange",
];
export const SETTLEMENT_VENUES = ["NSCC", "CDS", "Euroclear", "CREST", "Clearstream", "CCASS", "JASDEC"];
/** Venues that offer Continuous Net Settlement. */
export const CNS_VENUES = ["NSCC", "CDS"];
export const TIMEZONES = [
  "New York (ET)",
  "Toronto (ET)",
  "London (GMT/BST)",
  "Frankfurt (CET)",
  "Hong Kong (HKT)",
  "Tokyo (JST)",
];
export const ORDER_CHANNELS = ["FundConnect portal", "FundConnect portal and FIX", "FIX only"];
export const CONFIRMATION_ROUTES = ["Portal and email", "Portal only", "SWIFT MT515"];
export const CUSTODIANS = ["State Street Bank and Trust", "State Street Bank International", "State Street Trust Canada", "State Street Trust (HK)", "State Street Trust and Banking (Japan)"];
export const TRANSFER_AGENTS = ["State Street Transfer Agency", "SS&C GIDS", "Computershare", "Link Fund Solutions"];

export const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Germany",
  "France",
  "Netherlands",
  "Switzerland",
  "Luxembourg",
  "Hong Kong",
  "Singapore",
  "Japan",
  "Australia",
];

export type Institution = { id: string; name: string; country: string; kind: string };

export const INSTITUTIONS: Institution[] = [
  { id: "inst-01", name: "Aldgate Securities", country: "United Kingdom", kind: "Authorised Participant" },
  { id: "inst-02", name: "Bayfront Capital Markets", country: "United States", kind: "Authorised Participant" },
  { id: "inst-03", name: "Calder & Finch Trading", country: "United States", kind: "Market maker" },
  { id: "inst-04", name: "Dufour Banque Privée", country: "France", kind: "Distributor" },
  { id: "inst-05", name: "Eastgate Brokerage", country: "Hong Kong", kind: "Authorised Participant" },
  { id: "inst-06", name: "Fenwick Prime Services", country: "United Kingdom", kind: "Authorised Participant" },
  { id: "inst-07", name: "Grantham Liquidity Partners", country: "Ireland", kind: "Market maker" },
  { id: "inst-08", name: "Hanseatic Wertpapierhandel", country: "Germany", kind: "Authorised Participant" },
  { id: "inst-09", name: "Ironbridge Financial", country: "Canada", kind: "Authorised Participant" },
  { id: "inst-10", name: "Juniper Wealth Platforms", country: "United States", kind: "Distributor" },
  { id: "inst-11", name: "Kowloon Harbour Securities", country: "Hong Kong", kind: "Market maker" },
  { id: "inst-12", name: "Lakeshore Clearing", country: "Canada", kind: "Authorised Participant" },
  { id: "inst-13", name: "Marunouchi Securities", country: "Japan", kind: "Authorised Participant" },
  { id: "inst-14", name: "Noordzee Effecten", country: "Netherlands", kind: "Market maker" },
  { id: "inst-15", name: "Orchard Road Capital", country: "Singapore", kind: "Authorised Participant" },
  { id: "inst-16", name: "Pemberton Global Markets", country: "United States", kind: "Authorised Participant" },
  { id: "inst-17", name: "Rhône Asset Services", country: "Switzerland", kind: "Distributor" },
  { id: "inst-18", name: "Southbank Execution", country: "Australia", kind: "Market maker" },
];

/* ------------------------------------------------------------------ */
/* Fund Details fields                                                 */
/* ------------------------------------------------------------------ */

export type DetailSectionId = "identifiers" | "investment" | "operations" | "routing";

export const DETAIL_SECTIONS: { id: DetailSectionId; label: string; blurb: string }[] = [
  { id: "identifiers", label: "Fund identifiers", blurb: "How the fund is named and found." },
  { id: "investment", label: "Investment information", blurb: "What the fund holds and how units are sized." },
  { id: "operations", label: "Operational settings", blurb: "Who services the fund and where it settles." },
  { id: "routing", label: "Order routing", blurb: "How orders arrive and how confirmations go out." },
];

export type DetailField = {
  key: DetailKey;
  label: string;
  section: DetailSectionId;
  options?: string[];
  hint?: string;
  mono?: boolean;
  inputMode?: "text" | "numeric";
};

export const DETAIL_FIELDS: DetailField[] = [
  { key: "fundName", label: "Fund name", section: "identifiers" },
  { key: "fundCode", label: "Fund code", section: "identifiers", mono: true, hint: "The short code used across FundConnect." },
  { key: "issuer", label: "Issuer", section: "identifiers" },
  { key: "ticker", label: "Exchange ticker", section: "identifiers", mono: true },
  { key: "isin", label: "ISIN", section: "identifiers", mono: true, hint: "12 characters: 2 letters, 9 letters or digits, 1 check digit." },
  { key: "listingExchange", label: "Primary listing exchange", section: "identifiers", options: EXCHANGES },

  { key: "assetClass", label: "Asset class", section: "investment", options: ASSET_CLASSES },
  { key: "benchmark", label: "Benchmark index", section: "investment" },
  { key: "region", label: "Region", section: "investment", options: REGIONS },
  { key: "currency", label: "Base currency", section: "investment", options: CURRENCIES },
  { key: "creationUnitSize", label: "Shares per creation unit", section: "investment", mono: true, inputMode: "numeric" },
  { key: "incomeTreatment", label: "Income treatment", section: "investment", options: INCOME_TREATMENTS },

  { key: "custodian", label: "Custodian", section: "operations", options: CUSTODIANS },
  { key: "transferAgent", label: "Transfer agent", section: "operations", options: TRANSFER_AGENTS },
  {
    key: "settlementVenue",
    label: "Settlement venue",
    section: "operations",
    options: SETTLEMENT_VENUES,
    hint: "Decides whether CNS can be used on a Settlement Period.",
  },
  { key: "cutoffTimezone", label: "Order window time zone", section: "operations", options: TIMEZONES, hint: "All order windows are in this time zone." },

  { key: "orderChannel", label: "How orders are received", section: "routing", options: ORDER_CHANNELS },
  { key: "confirmationRouting", label: "How confirmations are sent", section: "routing", options: CONFIRMATION_ROUTES },
  { key: "operationsContact", label: "Operations contact email", section: "routing" },
];

export function cnsApplies(config: FundConfig): boolean {
  return CNS_VENUES.includes(config.details.settlementVenue);
}

/* ------------------------------------------------------------------ */
/* Navigation targets                                                  */
/* ------------------------------------------------------------------ */

export type TabId = "order-types" | "details" | "distribution" | "review";

/** Where a validation message or a change lives, so Review can link to it. */
export type Target = { tab: TabId; orderTypeId?: string; section?: DetailSectionId };
