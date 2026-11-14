/**
 * @ledgerline/contracts
 * Shared types for every package. Imports nothing.
 * Change by semver only. A breaking change is a major release with a migration note.
 */

// ─────────────────────────────────────────────────────────────
// Actors and references
// ─────────────────────────────────────────────────────────────

export type ActorType = 'user' | 'system' | 'job' | 'interface' | 'external' | 'agent';

export interface ActorRef {
  type: ActorType;
  id: string;
  name: string;
  /** For agents: the user the agent acted on behalf of. */
  onBehalfOf?: ActorRef;
}

export type EntityKind =
  'portfolio' | 'security' | 'issuer' | 'account' | 'bank' | 'manager' | 'blotter' | 'report' | 'template';

export interface EntityRef {
  kind: EntityKind;
  id: string;
  /** Alternate identifiers, e.g. { isin: '...', cusip: '...', sedol: '...', ticker: '...' } */
  altIds?: Record<string, string>;
  label: string;
}

// ─────────────────────────────────────────────────────────────
// Financial values
// ─────────────────────────────────────────────────────────────

export type FinancialKind =
  | 'amount'
  | 'currencyAmount'
  | 'units'
  | 'quantity'
  | 'originalFace'
  | 'price'
  | 'marketValue'
  | 'rate'
  | 'percentage'
  | 'basisPoints';

export type AccountingBasis = 'gaap' | 'statutory' | 'tax' | 'management' | 'ifrs' | (string & {});

export interface Provenance {
  origin: 'calculated' | 'entered' | 'overridden' | 'imported' | 'vendor';
  source?: string;
  /** ISO timestamp */
  asOf?: string;
  overriddenBy?: ActorRef;
  overrideReason?: string;
  /** Value before override, as a decimal string. */
  originalValue?: string;
}

export interface FinancialValue {
  kind: FinancialKind;
  /** Decimal string, e.g. "1250000.0000". Null means missing, not zero. */
  value: string | null;
  /** ISO 4217. Required for currencyAmount and marketValue. */
  currency?: string;
  /** Display decimals. Comes from the precision registry. */
  precision: number;
  signConvention: 'natural' | 'accounting';
  basis?: AccountingBasis;
  provenance: Provenance;
  locked?: { reason: string };
  /** Distinguishes missing / unavailable / not applicable when value is null. */
  nullReason?: 'missing' | 'unavailable' | 'notApplicable';
}

// ─────────────────────────────────────────────────────────────
// Dates and periods
// ─────────────────────────────────────────────────────────────

export type DateBasis = 'trade' | 'settle' | 'effective' | 'ledger' | 'valuation';

export interface BusinessDate {
  /** ISO date YYYY-MM-DD. Null is explicit; legacy placeholders are converted at the API boundary. */
  value: string | null;
  basis: DateBasis;
  calendar?: string;
  businessDayRule?: 'following' | 'modifiedFollowing' | 'preceding' | 'none';
}

export type PeriodState = 'open' | 'closing' | 'closed' | 'reopened';
export type CloseType = 'transaction' | 'valuation' | 'bankAccount' | 'generalLedger';

export interface AccountingPeriod {
  id: string;
  portfolioId: string;
  periodEnd: string;
  /** ISO timestamp */
  cutoff: string;
  state: PeriodState;
  closes: Record<CloseType, PeriodState>;
}

// ─────────────────────────────────────────────────────────────
// Messages and UI state
// ─────────────────────────────────────────────────────────────

export type MessageLevel = 'field' | 'row' | 'section' | 'record' | 'operation' | 'processing';

export interface Message {
  /** Stable code, e.g. LL-VAL-0142 */
  code: string;
  severity: 'info' | 'warning' | 'error';
  level: MessageLevel;
  /** What happened. */
  text: string;
  /** What to do next. */
  fix?: string;
  /** Field name or row id. */
  target?: string;
}

export interface ActionRef {
  actionId: string;
  label: string;
}

export type UiState =
  | { kind: 'normal' }
  | { kind: 'loading' }
  | { kind: 'processing'; progress?: number; jobId?: string }
  | { kind: 'empty'; reason: 'noData' | 'notConfigured' }
  | { kind: 'noMatches'; activeFilters: number }
  | { kind: 'warning'; messages: Message[] }
  | { kind: 'blockingError'; messages: Message[]; recovery?: ActionRef[] }
  | { kind: 'partialSuccess'; succeeded: number; failed: number; skipped: number; jobId: string }
  | { kind: 'permissionLimited'; reason: string; requestAccess?: ActionRef }
  | { kind: 'pendingApproval'; approver?: ActorRef; since: string }
  | { kind: 'overridden'; provenance: Provenance }
  | { kind: 'failedIntegration'; system: string; retry?: ActionRef }
  | { kind: 'stale'; asOf: string; refresh: ActionRef }
  | { kind: 'conflict'; theirs: ActorRef; at: string; resolve: ActionRef[] }
  | { kind: 'recovery'; from: UiState['kind']; message: string };

// ─────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────

export type AccessLevel = 'none' | 'view' | 'edit' | 'full';

export type DenialReason =
  'role' | 'segregationOfDuties' | 'recordState' | 'periodClosed' | 'approvalRequired' | 'blotterScope';

export interface Permission {
  /** e.g. 'transaction.post' */
  action: string;
  accessLevel: AccessLevel;
  allowed: boolean;
  reason?: DenialReason;
  /** User-facing. Required when allowed is false. */
  explanation?: string;
  group?: string;
  blotterScope?: string[];
}

// ─────────────────────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────────────────────

export interface EvidenceRef {
  type: 'file' | 'record' | 'job' | 'link';
  id: string;
  label: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  recordRef: { type: string; id: string };
  actor: ActorRef;
  /** ISO timestamp */
  at: string;
  effectiveDate?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: {
    kind: 'comment' | 'overrideJustification' | 'failureReason' | 'approvalNote' | 'warningAcknowledged';
    text: string;
  };
  evidence?: EvidenceRef[];
  batchId?: string;
  immutable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Jobs and bulk results
// ─────────────────────────────────────────────────────────────

export type JobType =
  'report' | 'export' | 'dataRequest' | 'bulkAction' | 'periodClose' | 'search' | 'import';
export type JobStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface BulkResult {
  jobId: string;
  status: JobStatus;
  succeeded: string[];
  failed: { id: string; message: Message }[];
  skipped: { id: string; reason: string }[];
}

export interface Job {
  id: string;
  type: JobType;
  name: string;
  submittedBy: ActorRef;
  submittedAt: string;
  queue: string;
  status: JobStatus;
  progress?: { done: number; total: number };
  outputs?: { name: string; format: 'csv' | 'xlsx' | 'pdf' | 'delimited'; url: string }[];
  result?: BulkResult;
  inputs: Record<string, unknown>;
  scheduledFor?: string;
  log?: { at: string; level: 'info' | 'warn' | 'error'; text: string }[];
}

// ─────────────────────────────────────────────────────────────
// Actions (one registry for UI and agents)
// ─────────────────────────────────────────────────────────────

export type ActionTier = 'primary' | 'secondary' | 'overflow' | 'destructive';
export type Consequence = 'none' | 'reversible' | 'reversibleWithAudit' | 'irreversible';

export interface ActionContext<Row> {
  selection: Row[];
  state: UiState;
  permissions: Permission[];
}

export interface ActionDef<Row = unknown> {
  id: string;
  label: string;
  /** Plain-language description. Shown in palette and used by agents. */
  description: string;
  tier: ActionTier;
  appliesTo: 'none' | 'single' | 'multi' | 'any';
  consequence: Consequence;
  shortcut?: string;
  /** Evaluated per context; disabled actions show the explanation. */
  available: (ctx: ActionContext<Row>) => Permission;
  /** Per-row eligibility for bulk use. */
  eligibility?: (row: Row) => Permission;
  requiresReason?: boolean;
  requiresApproval?: boolean;
  /** Agents may call this action only with human confirmation when true. */
  agentRequiresConfirmation: boolean;
  /** JSON Schema of the action's inputs, so agents can call it. */
  inputSchema?: Record<string, unknown>;
  /** Optional preview of the outcome per row before commit. */
  preview?: (ids: string[], inputs?: Record<string, unknown>) => Promise<PreviewRow[]>;
  execute: (ids: string[], inputs?: Record<string, unknown>) => Promise<BulkResult>;
}

export interface PreviewRow {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  warnings?: Message[];
}

// ─────────────────────────────────────────────────────────────
// Views and workspaces
// ─────────────────────────────────────────────────────────────

export type FilterCondition =
  | { field: string; op: 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'lt'; value: unknown }
  | { field: string; op: 'between'; from: string; to: string }
  | {
      field: string;
      op: 'relative';
      period: 'today' | 'yesterday' | 'thisPeriod' | 'lastPeriod' | 'lastNDays';
      n?: number;
    }
  | { field: string; op: 'isNull' | 'isNotNull' };

export type Density = 'compact' | 'standard' | 'comfortable';

export interface SavedView {
  id: string;
  gridId: string;
  name: string;
  ownership: 'personal' | 'shared' | 'default';
  owner: ActorRef;
  state: {
    columns: { field: string; visible: boolean; width?: number; pinned?: 'left' | 'right' }[];
    sort: { field: string; dir: 'asc' | 'desc' }[];
    filters: FilterCondition[];
    quickSearch?: string;
    grouping?: string[];
    density?: Density;
  };
  schemaVersion: number;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner: ActorRef;
  group?: string;
  loadAtStartup: boolean;
  layout: 'single' | 'tabs';
  /** Panels the user has popped out into their own windows. */
  poppedOut?: string[];
  isTeamDefault?: boolean;
  panels: { gridId: string; viewId: string; blotterId?: string }[];
}

// ─────────────────────────────────────────────────────────────
// Exceptions
// ─────────────────────────────────────────────────────────────

export type ExceptionType =
  | 'priceStale'
  | 'priceVariance'
  | 'priceMissing'
  | 'cashBreak'
  | 'positionBreak'
  | 'marketValueBreak'
  | 'unsettledTrade'
  | 'agedIncome'
  | 'accrualBreak'
  | 'ratingMissing'
  | 'impairmentReview'
  | 'glMappingBreak'
  | 'importRowError';

export type ExceptionStatus =
  'new' | 'inProgress' | 'waitingOnOthers' | 'resolved' | 'acceptedConditionally' | 'overridden';

export interface ExceptionRecord {
  id: string;
  type: ExceptionType;
  severity: 'low' | 'medium' | 'high';
  recordRef: EntityRef | { kind: string; id: string; label: string };
  portfolioId: string;
  detectedAt: string;
  detectedBy: ActorRef;
  owner?: ActorRef;
  status: ExceptionStatus;
  /** e.g. expected vs actual */
  values?: { expected?: FinancialValue; actual?: FinancialValue; tolerance?: FinancialValue };
  rootCause?: string;
  rootCauseCategory?: string;
  /** ISO date by which this exception should be resolved. */
  dueBy?: string;
  /** Recurring-break rule that tagged this exception, if any. */
  matchedRuleId?: string;
  /** Agent-proposed resolution awaiting a human decision. */
  proposal?: { by: ActorRef; summary: string; actionId: string; inputs?: Record<string, unknown> };
  evidence: EvidenceRef[];
  thread: { id: string; author: ActorRef; at: string; text: string }[];
}

// ─────────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────────

export interface ImportMapping {
  targetType: 'transaction' | 'price' | 'impairment' | 'cashActivity';
  columns: { sourceHeader: string; targetField: string }[];
}

export interface ImportRowResult {
  rowNumber: number;
  status: 'valid' | 'warning' | 'error';
  messages: Message[];
  parsed: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Approvals, close sign-off, tolerances
// ─────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  actionId: string;
  recordRefs: { type: string; id: string }[];
  maker: ActorRef;
  requestedAt: string;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  evidence?: EvidenceRef[];
  status: 'pending' | 'approved' | 'rejected';
  checker?: ActorRef;
  decidedAt?: string;
  note?: string;
}

export interface CloseSignOff {
  periodId: string;
  signedBy: ActorRef;
  at: string;
  note?: string;
  packageJobId?: string;
}

export interface ToleranceRule {
  id: string;
  version: number;
  assetClass: string;
  currency?: string;
  source?: string;
  check: 'dayOverDay' | 'vendorVsVendor' | 'stale' | 'missing';
  /** Decimal string; percentage as fraction, or market days for stale. */
  threshold: string;
  holidayAware: boolean;
}

export interface RecurringBreakRule {
  id: string;
  name: string;
  match: { type: ExceptionType; counterparty?: string; portfolioIds?: string[]; maxAmount?: string };
  rootCauseCategory: string;
  proposedActionId: string;
  createdBy: ActorRef;
}

// ─────────────────────────────────────────────────────────────
// Session and grid query (added 0.1.0, see docs/DECISIONS.md)
// ─────────────────────────────────────────────────────────────

export type ExperienceSegment = 'superUser' | 'operator' | 'newUser' | 'approver' | 'client' | 'admin';

export interface User {
  id: string;
  name: string;
  /** Team name, e.g. 'Transaction Operations'. */
  team: string;
  /** Short role label shown in the role switcher. */
  role: string;
  segment: ExperienceSegment;
  defaultDensity: Density;
  /** Blotter (portfolio) ids the user is limited to. Absent means unrestricted. */
  blotterScope?: string[];
}

/** Body of every POST /…/query list endpoint. */
export interface GridQuery {
  startRow: number;
  endRow: number;
  sort?: { field: string; dir: 'asc' | 'desc' }[];
  filters?: FilterCondition[];
  quickSearch?: string;
  groupBy?: string[];
  groupKeys?: string[];
}

export interface GridResponse<Row> {
  rows: Row[];
  totalRows: number;
  /** ISO timestamp */
  asOf: string;
}

// ─────────────────────────────────────────────────────────────
// Transactions (added 0.2.0)
// ─────────────────────────────────────────────────────────────

export type TransactionStatus = 'unposted' | 'posted' | 'reversed';

/** Financial fields of a transaction that can be edited or overridden. */
export type TransactionFinancialField = 'quantity' | 'price' | 'amount';

/** One transaction as the grid and the detail panel see it. */
export interface TransactionRow {
  id: string;
  portfolio: EntityRef;
  /** Null for cash-only records such as fees. */
  security: EntityRef | null;
  type: string;
  tradeDate: BusinessDate;
  settleDate: BusinessDate;
  quantity: FinancialValue;
  price: FinancialValue;
  amount: FinancialValue;
  currency: string;
  status: TransactionStatus;
  /** Present when the record carries a warning the user can acknowledge. */
  warning?: Message;
  /** Optimistic concurrency: send as If-Match on writes. */
  version: number;
}

/** Body of PATCH /transactions/:id. */
export interface TransactionPatch {
  /** New decimal strings by field. */
  changes: Partial<Record<TransactionFinancialField, string>>;
  /** Required when a calculated value is changed (an override). */
  reason?: string;
}

/** Every mutation returns the record and the audit events it wrote. */
export interface MutationResult<T> {
  record: T;
  auditEventIds: string[];
}
