/* Seed data for the Div Claim Automation prototype. Everything is mock. */

import type {
  Rule,
  TradeActionRule,
  TaxMarker,
  WfRequest,
  DivEvent,
  Entitlement,
  Claim,
  Notif,
  User,
  Role,
  AssetType,
  BusinessEntity,
  KeyDateType,
  Basis,
  Transmission,
} from "./types";

export const TODAY = "2026-08-19";

export const USERS: Record<Role, User> = {
  Maker: { name: "Kim", role: "Maker" },
  Approver: { name: "Lee", role: "Approver" },
  Operations: { name: "Park", role: "Operations" },
};

export const REGION: Record<string, string> = {
  US: "Americas",
  CA: "Americas",
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  CH: "Europe",
  NL: "Europe",
  IT: "Europe",
  ES: "Europe",
  SE: "Europe",
  JP: "APAC",
  KR: "APAC",
  AU: "APAC",
  NZ: "APAC",
  HK: "APAC",
  SG: "APAC",
};

export const COUNTRIES: { name: string; code: string }[] = [
  { name: "United States", code: "US" },
  { name: "United Kingdom", code: "GB" },
  { name: "Germany", code: "DE" },
  { name: "France", code: "FR" },
  { name: "Japan", code: "JP" },
  { name: "South Korea", code: "KR" },
  { name: "Australia", code: "AU" },
  { name: "New Zealand", code: "NZ" },
  { name: "Hong Kong", code: "HK" },
  { name: "Singapore", code: "SG" },
  { name: "Canada", code: "CA" },
  { name: "Switzerland", code: "CH" },
  { name: "Netherlands", code: "NL" },
  { name: "Italy", code: "IT" },
  { name: "Spain", code: "ES" },
  { name: "Sweden", code: "SE" },
];

/* ---- Dividend claim rules (30) — mostly uniform with deliberate exceptions ---- */

function R(
  n: number,
  code: string,
  assetType: AssetType,
  entity: BusinessEntity,
  overrides: Partial<Rule> = {},
): Rule {
  const country = COUNTRIES.find((c) => c.code === code)?.name ?? code;
  return {
    id: `DCR-${String(n).padStart(3, "0")}`,
    country,
    countryCode: code,
    assetType,
    entity,
    active: true,
    effectiveDate: "2026-01-02",
    keyDateType: "Record Date" as KeyDateType,
    basis: "Settle" as Basis,
    entitlementPeriod: "EX-2",
    generationDate: "RD+1",
    transmission: "PD" as Transmission,
    sdCondition: "SD <= RD",
    tdCondition: "",
    ...overrides,
  };
}

export const SEED_RULES: Rule[] = [
  R(1, "US", "Equity", "Prime"),
  R(2, "US", "Equity", "Agency"),
  R(3, "GB", "Equity", "Prime"),
  R(4, "GB", "Fixed Income", "ALL"),
  R(5, "US", "Fixed Income", "ALL"),
  R(6, "DE", "Equity", "Agency"),
  R(7, "DE", "Equity", "Prime"),
  R(8, "DE", "Fixed Income", "ALL"),
  R(9, "FR", "Equity", "Prime"),
  R(10, "FR", "Equity", "Agency"),
  R(11, "JP", "Equity", "Prime", { transmission: "PD-2", keyDateType: "Ex Date" }), // exception
  R(12, "JP", "Equity", "Agency"),
  R(13, "JP", "Fixed Income", "ALL"),
  R(14, "KR", "Equity", "Prime", { basis: "Contractual Settlement", tdCondition: "TD <= RD" }), // exception
  R(15, "KR", "Fixed Income", "ALL"),
  R(16, "AU", "Equity", "Prime"),
  R(17, "AU", "Equity", "Agency"),
  R(18, "NZ", "Equity", "Prime"),
  R(19, "NZ", "Fixed Income", "ALL", { entitlementPeriod: "RD-2", basis: "Trade", sdCondition: "" }), // exception
  R(20, "AU", "Fixed Income", "ALL", { generationDate: "RD+2", isNew: true }), // updated via REQ-005
  R(21, "HK", "Equity", "Prime"),
  R(22, "HK", "Equity", "Agency", { active: false }),
  R(23, "SG", "Equity", "Prime"),
  R(24, "SG", "Fixed Income", "ALL"),
  R(25, "CA", "Equity", "Prime"),
  R(26, "CH", "Equity", "Prime", { entitlementPeriod: "EX-1" }), // exception
  R(27, "NL", "Equity", "Prime"),
  R(28, "IT", "Equity", "ALL", { active: false }),
  R(29, "ES", "Equity", "Prime"),
  R(30, "SE", "Equity", "Prime", { basis: "Trade + Settle" }), // exception
];

/* ---- Trade action rules (10) ---- */

export const SEED_TA_RULES: TradeActionRule[] = [
  { id: "TAR-001", marketKey: "XNYS / US", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+1" },
  { id: "TAR-002", marketKey: "XNAS / US", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+1" },
  { id: "TAR-003", marketKey: "XLON / GB", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-004", marketKey: "XETR / DE", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Contractual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-005", marketKey: "XPAR / FR", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-006", marketKey: "XTKS / JP", assetType: "Equity", active: true, tradeStatus: "Open", settlementDateType: "Contractual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-007", marketKey: "XKRX / KR", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Contractual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-008", marketKey: "XASX / AU", assetType: "Equity", active: true, tradeStatus: "Settled", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-009", marketKey: "XHKG / HK", assetType: "Equity", active: false, tradeStatus: "Open", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+2" },
  { id: "TAR-010", marketKey: "XSES / SG", assetType: "Fixed Income", active: true, tradeStatus: "Settled", settlementDateType: "Actual", tradeTiming: "T", settlementTiming: "T+2" },
];

/* ---- Tax markers (8) ---- */

export const SEED_TAX_MARKERS: TaxMarker[] = [
  { id: "TM-001", country: "United States", taxType: "Withholding", ratePct: 15, markerCode: "US-W15", active: true },
  { id: "TM-002", country: "United Kingdom", taxType: "Withholding", ratePct: 0, markerCode: "GB-W00", active: true },
  { id: "TM-003", country: "Germany", taxType: "Withholding", ratePct: 26.375, markerCode: "DE-W26", active: true },
  { id: "TM-004", country: "France", taxType: "Withholding", ratePct: 12.8, markerCode: "FR-W12", active: true },
  { id: "TM-005", country: "Japan", taxType: "Withholding", ratePct: 15.315, markerCode: "JP-W15", active: true },
  { id: "TM-006", country: "South Korea", taxType: "Withholding", ratePct: 22, markerCode: "KR-W22", active: true },
  { id: "TM-007", country: "Australia", taxType: "Withholding", ratePct: 30, markerCode: "AU-W30", active: true },
  { id: "TM-008", country: "Switzerland", taxType: "Withholding", ratePct: 35, markerCode: "CH-W35", active: false },
];

/* ---- Requests (mixed states, tells the demo story) ---- */

export const SEED_REQUESTS: WfRequest[] = [
  {
    id: "REQ-001",
    type: "Dividend Claim Rule",
    targetId: "DCR-012",
    targetLabel: "DCR-012",
    status: "Draft",
    submittedBy: "Kim",
    submittedAt: "2026-08-18 16:40",
    updatedAt: "2026-08-18 16:40",
    assignee: null,
    reason: "Align JP agency transmission with revised custodian cutoff.",
    changes: [{ field: "Claim Transmission", before: "PD", after: "PD-1" }],
    payload: { entity: "rule", targetId: "DCR-012", values: { transmission: "PD-1" } },
    timeline: [{ label: "Draft created", actor: "Kim", time: "2026-08-18 16:40" }],
  },
  {
    id: "REQ-002",
    type: "Dividend Claim Rule",
    targetId: "DCR-007",
    targetLabel: "DCR-007",
    status: "Rejected",
    submittedBy: "Kim",
    submittedAt: "2026-08-17 10:12",
    updatedAt: "2026-08-18 09:05",
    assignee: "Lee",
    reason: "Move DE prime equity to record-date based entitlement window.",
    rejectionReason:
      "Entitlement period conflicts with market convention for DE — should be EX-1, please confirm with market ops.",
    changes: [{ field: "Claim Entitlement Period", before: "EX-2", after: "RD-2" }],
    payload: { entity: "rule", targetId: "DCR-007", values: { entitlementPeriod: "RD-2" } },
    timeline: [
      { label: "Submitted", actor: "Kim", time: "2026-08-17 10:12" },
      { label: "Review started", actor: "Lee", time: "2026-08-17 14:30" },
      { label: "Rejected", actor: "Lee", time: "2026-08-18 09:05" },
    ],
  },
  {
    id: "REQ-003",
    type: "Dividend Claim Rule",
    targetId: null,
    targetLabel: "New",
    status: "Submitted",
    submittedBy: "Kim",
    submittedAt: "2026-08-18 11:20",
    updatedAt: "2026-08-18 11:20",
    assignee: "Lee",
    reason: "New coverage: FR fixed income agency book goes live next month.",
    changes: [
      { field: "Country", before: null, after: "France" },
      { field: "Asset Type", before: null, after: "Fixed Income" },
      { field: "Business Entity", before: null, after: "Agency" },
      { field: "Claim Entitlement Period", before: null, after: "EX-2" },
      { field: "Claim Generation Date", before: null, after: "RD+1" },
      { field: "Claim Transmission", before: null, after: "PD" },
    ],
    payload: {
      entity: "rule",
      targetId: null,
      values: {
        country: "France",
        countryCode: "FR",
        assetType: "Fixed Income",
        entity: "Agency",
        active: true,
        effectiveDate: "2026-09-01",
        keyDateType: "Record Date",
        basis: "Settle",
        entitlementPeriod: "EX-2",
        generationDate: "RD+1",
        transmission: "PD",
        sdCondition: "SD <= RD",
        tdCondition: "",
      },
    },
    timeline: [{ label: "Submitted", actor: "Kim", time: "2026-08-18 11:20" }],
  },
  {
    id: "REQ-004",
    type: "Dividend Claim Rule",
    targetId: "DCR-003",
    targetLabel: "DCR-003",
    status: "In Review",
    submittedBy: "Kim",
    submittedAt: "2026-08-18 09:00",
    updatedAt: "2026-08-19 08:45",
    assignee: "Lee",
    reason: "GB custodian requests earlier transmission ahead of pay date.",
    changes: [{ field: "Claim Transmission", before: "PD", after: "PD-1" }],
    payload: { entity: "rule", targetId: "DCR-003", values: { transmission: "PD-1" } },
    timeline: [
      { label: "Submitted", actor: "Kim", time: "2026-08-18 09:00" },
      { label: "Review started", actor: "Lee", time: "2026-08-19 08:45" },
    ],
  },
  {
    id: "REQ-005",
    type: "Dividend Claim Rule",
    targetId: "DCR-020",
    targetLabel: "DCR-020",
    status: "Approved",
    submittedBy: "Kim",
    submittedAt: "2026-08-16 15:02",
    updatedAt: "2026-08-17 09:40",
    assignee: "Lee",
    reason: "AU fixed income claims need an extra day before generation.",
    changes: [{ field: "Claim Generation Date", before: "RD+1", after: "RD+2" }],
    payload: { entity: "rule", targetId: "DCR-020", values: { generationDate: "RD+2" } },
    timeline: [
      { label: "Submitted", actor: "Kim", time: "2026-08-16 15:02" },
      { label: "Review started", actor: "Lee", time: "2026-08-16 17:20" },
      { label: "Approved", actor: "Lee", time: "2026-08-17 09:40" },
      { label: "In production", actor: "System", time: "2026-08-17 09:40" },
    ],
  },
  {
    id: "REQ-006",
    type: "Tax Marker",
    targetId: "TM-004",
    targetLabel: "TM-004",
    status: "Submitted",
    submittedBy: "Lee",
    submittedAt: "2026-08-19 08:10",
    updatedAt: "2026-08-19 08:10",
    assignee: "Lee",
    reason: "FR treaty rate update effective next quarter.",
    changes: [{ field: "Rate %", before: "12.8", after: "10" }],
    payload: { entity: "tm", targetId: "TM-004", values: { ratePct: 10 } },
    timeline: [{ label: "Submitted", actor: "Lee", time: "2026-08-19 08:10" }],
  },
];

/* ---- Dividend events (12, four dated today) ---- */

export const SEED_EVENTS: DivEvent[] = [
  { id: "EVT-2401", ticker: "MSFT", security: "Microsoft Corp", country: "United States", eventType: "Cash Dividend", exDate: TODAY, recordDate: "2026-08-20", payDate: "2026-09-10", grossRate: 0.75, currency: "USD", status: "Confirmed" },
  { id: "EVT-2402", ticker: "JNJ", security: "Johnson & Johnson", country: "United States", eventType: "Cash Dividend", exDate: TODAY, recordDate: "2026-08-20", payDate: "2026-09-08", grossRate: 1.24, currency: "USD", status: "Confirmed" },
  { id: "EVT-2403", ticker: "HSBA", security: "HSBC Holdings plc", country: "United Kingdom", eventType: "Cash Dividend", exDate: TODAY, recordDate: "2026-08-21", payDate: "2026-09-25", grossRate: 0.1, currency: "GBP", status: "Announced" },
  { id: "EVT-2404", ticker: "SAP", security: "SAP SE", country: "Germany", eventType: "Cash Dividend", exDate: TODAY, recordDate: "2026-08-21", payDate: "2026-08-27", grossRate: 2.2, currency: "EUR", status: "Confirmed" },
  { id: "EVT-2405", ticker: "8306", security: "Mitsubishi UFJ Fin Grp", country: "Japan", eventType: "Cash Dividend", exDate: "2026-08-21", recordDate: "2026-08-24", payDate: "2026-09-30", grossRate: 25, currency: "JPY", status: "Announced" },
  { id: "EVT-2406", ticker: "005930", security: "Samsung Electronics", country: "South Korea", eventType: "Cash Dividend", exDate: "2026-08-21", recordDate: "2026-08-24", payDate: "2026-09-18", grossRate: 361, currency: "KRW", status: "Confirmed" },
  { id: "EVT-2407", ticker: "BHP", security: "BHP Group Ltd", country: "Australia", eventType: "Cash Dividend", exDate: "2026-08-24", recordDate: "2026-08-25", payDate: "2026-09-24", grossRate: 0.9, currency: "AUD", status: "Announced" },
  { id: "EVT-2408", ticker: "NESN", security: "Nestlé SA", country: "Switzerland", eventType: "Cash Dividend", exDate: "2026-08-25", recordDate: "2026-08-26", payDate: "2026-09-01", grossRate: 3.05, currency: "CHF", status: "Announced" },
  { id: "EVT-2409", ticker: "TTE", security: "TotalEnergies SE", country: "France", eventType: "Cash Dividend", exDate: "2026-08-26", recordDate: "2026-08-27", payDate: "2026-10-01", grossRate: 0.79, currency: "EUR", status: "Announced" },
  { id: "EVT-2410", ticker: "AAPL", security: "Apple Inc", country: "United States", eventType: "Cash Dividend", exDate: "2026-08-11", recordDate: "2026-08-12", payDate: "2026-08-14", grossRate: 0.26, currency: "USD", status: "Paid" },
  { id: "EVT-2411", ticker: "VOD", security: "Vodafone Group plc", country: "United Kingdom", eventType: "Cash Dividend", exDate: "2026-08-06", recordDate: "2026-08-07", payDate: "2026-08-14", grossRate: 0.045, currency: "GBP", status: "Paid" },
  { id: "EVT-2412", ticker: "DBS", security: "DBS Group Holdings", country: "Singapore", eventType: "Cash Dividend", exDate: "2026-08-27", recordDate: "2026-08-28", payDate: "2026-09-15", grossRate: 0.54, currency: "SGD", status: "Announced" },
];

/* ---- Trade entitlements (~20) ---- */

const CLIENTS = [
  "Alpine Global Fund",
  "Meridian Pension Trust",
  "Northgate Asset Mgmt",
  "Harborline Capital",
  "Vantera Investments",
  "Oakfield Insurance",
];

function E(
  n: number,
  eventId: string,
  clientIdx: number,
  qty: number,
  taxMarkerId: string,
  ruleId: string,
  basis: "Settle" | "Trade" = "Settle",
): Entitlement {
  const ev = SEED_EVENTS.find((e) => e.id === eventId)!;
  const tm = SEED_TAX_MARKERS.find((t) => t.id === taxMarkerId)!;
  const client = CLIENTS[clientIdx % CLIENTS.length];
  return {
    id: `ENT-${String(n).padStart(3, "0")}`,
    eventId,
    client,
    account: `${client.split(" ")[0].toUpperCase().slice(0, 3)}-${4100 + n}`,
    security: `${ev.ticker} · ${ev.security}`,
    qty,
    grossRate: ev.grossRate,
    taxRatePct: tm.ratePct,
    taxMarkerId,
    basis,
    ruleId,
  };
}

export const SEED_ENTITLEMENTS: Entitlement[] = [
  E(1, "EVT-2401", 0, 120000, "TM-001", "DCR-001"),
  E(2, "EVT-2401", 1, 48000, "TM-001", "DCR-001"),
  E(3, "EVT-2401", 2, 260000, "TM-001", "DCR-002"),
  E(4, "EVT-2402", 0, 76000, "TM-001", "DCR-001"),
  E(5, "EVT-2402", 3, 31500, "TM-001", "DCR-001"),
  E(6, "EVT-2403", 1, 540000, "TM-002", "DCR-003"),
  E(7, "EVT-2403", 4, 205000, "TM-002", "DCR-003"),
  E(8, "EVT-2404", 0, 18500, "TM-003", "DCR-007"),
  E(9, "EVT-2404", 5, 9200, "TM-003", "DCR-006"),
  E(10, "EVT-2405", 2, 850000, "TM-005", "DCR-011", "Trade"),
  E(11, "EVT-2405", 3, 420000, "TM-005", "DCR-012"),
  E(12, "EVT-2406", 0, 15400, "TM-006", "DCR-014", "Trade"),
  E(13, "EVT-2406", 1, 8800, "TM-006", "DCR-014", "Trade"),
  E(14, "EVT-2407", 4, 96000, "TM-007", "DCR-016"),
  E(15, "EVT-2407", 5, 44000, "TM-007", "DCR-017"),
  E(16, "EVT-2409", 2, 67000, "TM-004", "DCR-009"),
  E(17, "EVT-2410", 0, 310000, "TM-001", "DCR-001"),
  E(18, "EVT-2410", 3, 125000, "TM-001", "DCR-002"),
  E(19, "EVT-2411", 1, 1200000, "TM-002", "DCR-003"),
  E(20, "EVT-2412", 4, 88000, "TM-001", "DCR-023"),
];

/* ---- Dividend claims (10, three with discrepancies) ---- */

export const SEED_CLAIMS: Claim[] = [
  { id: "CLM-101", eventId: "EVT-2410", client: "Alpine Global Fund", expected: 68510, received: 68510, status: "Matched" },
  { id: "CLM-102", eventId: "EVT-2410", client: "Harborline Capital", expected: 27625, received: 27625, status: "Matched" },
  { id: "CLM-103", eventId: "EVT-2411", client: "Meridian Pension Trust", expected: 54000, received: 51300, status: "Discrepancy" },
  { id: "CLM-104", eventId: "EVT-2402", client: "Alpine Global Fund", expected: 80104, received: 0, status: "Pending" },
  { id: "CLM-105", eventId: "EVT-2404", client: "Oakfield Insurance", expected: 14898, received: 13560, status: "Discrepancy" },
  { id: "CLM-106", eventId: "EVT-2404", client: "Alpine Global Fund", expected: 29964, received: 29964, status: "Matched" },
  { id: "CLM-107", eventId: "EVT-2405", client: "Northgate Asset Mgmt", expected: 17993750, received: 17993750, status: "Matched" },
  { id: "CLM-108", eventId: "EVT-2406", client: "Alpine Global Fund", expected: 4335624, received: 4128900, status: "Discrepancy" },
  { id: "CLM-109", eventId: "EVT-2401", client: "Northgate Asset Mgmt", expected: 165750, received: 0, status: "Pending" },
  { id: "CLM-110", eventId: "EVT-2403", client: "Vantera Investments", expected: 20500, received: 20500, status: "Matched" },
];

/* ---- Notifications (three unread for the Maker) ---- */

export const SEED_NOTIFS: Notif[] = [
  { id: "NTF-001", forUser: "Kim", text: "Your request REQ-002 was rejected — click to view reason", requestId: "REQ-002", read: false, time: "2026-08-18 09:05" },
  { id: "NTF-002", forUser: "Kim", text: "REQ-005 approved — DCR-020 updated in production", requestId: "REQ-005", read: false, time: "2026-08-17 09:40" },
  { id: "NTF-003", forUser: "Kim", text: "Reminder: draft REQ-001 has not been submitted", requestId: "REQ-001", read: false, time: "2026-08-19 07:30" },
];

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtQty(n: number): string {
  return n.toLocaleString("en-US");
}

export function nowStamp(): string {
  return `${TODAY} ${new Date().toTimeString().slice(0, 5)}`;
}
