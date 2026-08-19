/* Domain types for the Div Claim Automation prototype. */

export type Role = "Maker" | "Approver" | "Operations";

export interface User {
  name: string;
  role: Role;
}

export type AssetType = "Equity" | "Fixed Income";
export type BusinessEntity = "Prime" | "Agency" | "ALL";
export type KeyDateType = "Record Date" | "Ex Date";
export type Basis = "Settle" | "Trade" | "Trade + Settle" | "Contractual Settlement";
export type Transmission = "PD" | "PD-1" | "PD-2";

export interface Rule {
  id: string;
  country: string;
  countryCode: string;
  assetType: AssetType;
  entity: BusinessEntity;
  active: boolean;
  effectiveDate: string;
  keyDateType: KeyDateType;
  basis: Basis;
  /** e.g. "EX-2", "RD-2" */
  entitlementPeriod: string;
  /** e.g. "RD+1" */
  generationDate: string;
  transmission: Transmission;
  /** e.g. "SD <= RD"; empty string renders as N/A */
  sdCondition: string;
  tdCondition: string;
  /** set when a request lands this rule in production during the session */
  isNew?: boolean;
}

export interface TradeActionRule {
  id: string;
  marketKey: string;
  assetType: AssetType;
  active: boolean;
  tradeStatus: string;
  settlementDateType: string;
  tradeTiming: string;
  settlementTiming: string;
}

export interface TaxMarker {
  id: string;
  country: string;
  taxType: string;
  ratePct: number;
  markerCode: string;
  active: boolean;
}

export type RequestType = "Dividend Claim Rule" | "Trade Action Rule" | "Tax Marker";
export type RequestStatus = "Draft" | "Submitted" | "In Review" | "Approved" | "Rejected";

export interface FieldChange {
  field: string;
  before: string | null;
  after: string;
}

export interface WfRequest {
  id: string;
  type: RequestType;
  /** production record id, or null for a create */
  targetId: string | null;
  targetLabel: string;
  status: RequestStatus;
  submittedBy: string;
  submittedAt: string;
  updatedAt: string;
  assignee: string | null;
  reason: string;
  rejectionReason?: string;
  changes: FieldChange[];
  payload: {
    entity: "rule" | "ta" | "tm";
    targetId: string | null;
    values: Record<string, string | number | boolean>;
  };
  timeline: { label: string; actor: string; time: string }[];
}

export type EventStatus = "Announced" | "Confirmed" | "Paid";

export interface DivEvent {
  id: string;
  ticker: string;
  security: string;
  country: string;
  eventType: "Cash Dividend";
  exDate: string;
  recordDate: string;
  payDate: string;
  grossRate: number;
  currency: string;
  status: EventStatus;
}

export interface Entitlement {
  id: string;
  eventId: string;
  client: string;
  account: string;
  security: string;
  qty: number;
  grossRate: number;
  taxRatePct: number;
  taxMarkerId: string;
  basis: "Settle" | "Trade";
  ruleId: string;
}

export type ClaimStatus = "Matched" | "Discrepancy" | "Pending";

export interface Claim {
  id: string;
  eventId: string;
  client: string;
  expected: number;
  received: number;
  status: ClaimStatus;
  resolvedComment?: string;
}

export interface Notif {
  id: string;
  /** user name this notification belongs to */
  forUser: string;
  text: string;
  requestId?: string;
  read: boolean;
  time: string;
}

/* ---- In-page routing ---- */

export type Route =
  | { screen: "home" }
  | { screen: "rules"; openId?: string }
  | { screen: "tradeActions"; openId?: string }
  | { screen: "taxMarkers"; openId?: string }
  | { screen: "myRequests"; openId?: string; statusFilter?: string }
  | { screen: "approvals"; openId?: string }
  | { screen: "events"; openId?: string }
  | { screen: "entitlements"; eventId?: string; openId?: string }
  | { screen: "claims"; statusFilter?: string; openId?: string };

export interface Toast {
  id: number;
  text: string;
  link?: { label: string; route: Route };
}
