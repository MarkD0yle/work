/**
 * Zod mirror of the data shapes in @ledgerline/contracts.
 * `contracts.type-test.ts` proves, at compile time, that each schema and its contract type match.
 * Function-bearing contracts (ActionDef, ActionContext) have no runtime schema: they never cross the wire.
 */
import type { ActorRef } from '@ledgerline/contracts';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date, YYYY-MM-DD.');
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Expected a decimal string.');
const unknownRecord = z.record(z.string(), z.unknown());

// ── Actors and references ──
export const actorType = z.enum(['user', 'system', 'job', 'interface', 'external', 'agent']);

/**
 * Recursive (an agent acts on behalf of a user), so Zod cannot infer it: the contract type is stated.
 * The annotation still fails to compile if the schema's output stops fitting ActorRef.
 */
export const actorRef: z.ZodType<ActorRef> = z.object({
  type: actorType,
  id: z.string(),
  name: z.string(),
  onBehalfOf: z.lazy(() => actorRef).exactOptional(),
});

export const entityKind = z.enum([
  'portfolio',
  'security',
  'issuer',
  'account',
  'bank',
  'manager',
  'blotter',
  'report',
  'template',
]);

export const entityRef = z.object({
  kind: entityKind,
  id: z.string(),
  altIds: z.record(z.string(), z.string()).exactOptional(),
  label: z.string(),
});

// ── Financial values ──
export const financialKind = z.enum([
  'amount',
  'currencyAmount',
  'units',
  'quantity',
  'originalFace',
  'price',
  'marketValue',
  'rate',
  'percentage',
  'basisPoints',
]);

/** Known bases plus any string, as in the contract. */
export const accountingBasis = z.string();

export const provenance = z.object({
  origin: z.enum(['calculated', 'entered', 'overridden', 'imported', 'vendor']),
  source: z.string().exactOptional(),
  asOf: z.string().exactOptional(),
  overriddenBy: actorRef.exactOptional(),
  overrideReason: z.string().exactOptional(),
  originalValue: decimalString.exactOptional(),
});

export const financialValue = z.object({
  kind: financialKind,
  value: decimalString.nullable(),
  currency: z.string().length(3).exactOptional(),
  precision: z.number().int().min(0),
  signConvention: z.enum(['natural', 'accounting']),
  basis: accountingBasis.exactOptional(),
  provenance,
  locked: z.object({ reason: z.string() }).exactOptional(),
  nullReason: z.enum(['missing', 'unavailable', 'notApplicable']).exactOptional(),
});

// ── Dates and periods ──
export const dateBasis = z.enum(['trade', 'settle', 'effective', 'ledger', 'valuation']);

export const businessDate = z.object({
  value: isoDate.nullable(),
  basis: dateBasis,
  calendar: z.string().exactOptional(),
  businessDayRule: z.enum(['following', 'modifiedFollowing', 'preceding', 'none']).exactOptional(),
});

export const periodState = z.enum(['open', 'closing', 'closed', 'reopened']);
export const closeType = z.enum(['transaction', 'valuation', 'bankAccount', 'generalLedger']);

export const accountingPeriod = z.object({
  id: z.string(),
  portfolioId: z.string(),
  periodEnd: isoDate,
  cutoff: z.string(),
  state: periodState,
  closes: z.record(closeType, periodState),
});

// ── Messages and UI state ──
export const messageLevel = z.enum(['field', 'row', 'section', 'record', 'operation', 'processing']);

export const message = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  level: messageLevel,
  text: z.string(),
  fix: z.string().exactOptional(),
  target: z.string().exactOptional(),
});

export const actionRef = z.object({ actionId: z.string(), label: z.string() });

const uiStateKind = z.enum([
  'normal',
  'loading',
  'processing',
  'empty',
  'noMatches',
  'warning',
  'blockingError',
  'partialSuccess',
  'permissionLimited',
  'pendingApproval',
  'overridden',
  'failedIntegration',
  'stale',
  'conflict',
  'recovery',
]);

export const uiState = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('normal') }),
  z.object({ kind: z.literal('loading') }),
  z.object({
    kind: z.literal('processing'),
    progress: z.number().exactOptional(),
    jobId: z.string().exactOptional(),
  }),
  z.object({ kind: z.literal('empty'), reason: z.enum(['noData', 'notConfigured']) }),
  z.object({ kind: z.literal('noMatches'), activeFilters: z.number() }),
  z.object({ kind: z.literal('warning'), messages: z.array(message) }),
  z.object({
    kind: z.literal('blockingError'),
    messages: z.array(message),
    recovery: z.array(actionRef).exactOptional(),
  }),
  z.object({
    kind: z.literal('partialSuccess'),
    succeeded: z.number(),
    failed: z.number(),
    skipped: z.number(),
    jobId: z.string(),
  }),
  z.object({
    kind: z.literal('permissionLimited'),
    reason: z.string(),
    requestAccess: actionRef.exactOptional(),
  }),
  z.object({ kind: z.literal('pendingApproval'), approver: actorRef.exactOptional(), since: z.string() }),
  z.object({ kind: z.literal('overridden'), provenance }),
  z.object({ kind: z.literal('failedIntegration'), system: z.string(), retry: actionRef.exactOptional() }),
  z.object({ kind: z.literal('stale'), asOf: z.string(), refresh: actionRef }),
  z.object({ kind: z.literal('conflict'), theirs: actorRef, at: z.string(), resolve: z.array(actionRef) }),
  z.object({ kind: z.literal('recovery'), from: uiStateKind, message: z.string() }),
]);

// ── Permissions ──
export const accessLevel = z.enum(['none', 'view', 'edit', 'full']);
export const denialReason = z.enum([
  'role',
  'segregationOfDuties',
  'recordState',
  'periodClosed',
  'approvalRequired',
  'blotterScope',
]);

export const permission = z.object({
  action: z.string(),
  accessLevel,
  allowed: z.boolean(),
  reason: denialReason.exactOptional(),
  explanation: z.string().exactOptional(),
  group: z.string().exactOptional(),
  blotterScope: z.array(z.string()).exactOptional(),
});

// ── Audit ──
export const evidenceRef = z.object({
  type: z.enum(['file', 'record', 'job', 'link']),
  id: z.string(),
  label: z.string(),
});

export const auditEvent = z.object({
  id: z.string(),
  action: z.string(),
  recordRef: z.object({ type: z.string(), id: z.string() }),
  actor: actorRef,
  at: z.string(),
  effectiveDate: z.string().exactOptional(),
  before: unknownRecord.exactOptional(),
  after: unknownRecord.exactOptional(),
  note: z
    .object({
      kind: z.enum([
        'comment',
        'overrideJustification',
        'failureReason',
        'approvalNote',
        'warningAcknowledged',
      ]),
      text: z.string(),
    })
    .exactOptional(),
  evidence: z.array(evidenceRef).exactOptional(),
  batchId: z.string().exactOptional(),
  immutable: z.boolean(),
});

// ── Jobs and bulk results ──
export const jobType = z.enum([
  'report',
  'export',
  'dataRequest',
  'bulkAction',
  'periodClose',
  'search',
  'import',
]);
export const jobStatus = z.enum(['queued', 'running', 'completed', 'partial', 'failed', 'cancelled']);

export const bulkResult = z.object({
  jobId: z.string(),
  status: jobStatus,
  succeeded: z.array(z.string()),
  failed: z.array(z.object({ id: z.string(), message })),
  skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
});

export const job = z.object({
  id: z.string(),
  type: jobType,
  name: z.string(),
  submittedBy: actorRef,
  submittedAt: z.string(),
  queue: z.string(),
  status: jobStatus,
  progress: z.object({ done: z.number(), total: z.number() }).exactOptional(),
  outputs: z
    .array(
      z.object({ name: z.string(), format: z.enum(['csv', 'xlsx', 'pdf', 'delimited']), url: z.string() }),
    )
    .exactOptional(),
  result: bulkResult.exactOptional(),
  inputs: unknownRecord,
  scheduledFor: z.string().exactOptional(),
  log: z
    .array(z.object({ at: z.string(), level: z.enum(['info', 'warn', 'error']), text: z.string() }))
    .exactOptional(),
});

export const previewRow = z.object({
  id: z.string(),
  before: unknownRecord,
  after: unknownRecord,
  warnings: z.array(message).exactOptional(),
});

// ── Views and workspaces ──
export const filterCondition = z.union([
  z.object({
    field: z.string(),
    op: z.enum(['eq', 'neq', 'in', 'contains', 'gt', 'lt']),
    value: z.unknown(),
  }),
  z.object({ field: z.string(), op: z.literal('between'), from: z.string(), to: z.string() }),
  z.object({
    field: z.string(),
    op: z.literal('relative'),
    period: z.enum(['today', 'yesterday', 'thisPeriod', 'lastPeriod', 'lastNDays']),
    n: z.number().exactOptional(),
  }),
  z.object({ field: z.string(), op: z.enum(['isNull', 'isNotNull']) }),
]);

export const density = z.enum(['compact', 'standard', 'comfortable']);
const sortSpec = z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) });

export const savedView = z.object({
  id: z.string(),
  gridId: z.string(),
  name: z.string(),
  ownership: z.enum(['personal', 'shared', 'default']),
  owner: actorRef,
  defaultForTeam: z.string().exactOptional(),
  state: z.object({
    columns: z.array(
      z.object({
        field: z.string(),
        visible: z.boolean(),
        width: z.number().exactOptional(),
        pinned: z.enum(['left', 'right']).exactOptional(),
      }),
    ),
    sort: z.array(sortSpec),
    filters: z.array(filterCondition),
    quickSearch: z.string().exactOptional(),
    grouping: z.array(z.string()).exactOptional(),
    density: density.exactOptional(),
  }),
  schemaVersion: z.number().int(),
  updatedAt: z.string(),
});

export const workspace = z.object({
  id: z.string(),
  name: z.string(),
  owner: actorRef,
  group: z.string().exactOptional(),
  loadAtStartup: z.boolean(),
  layout: z.enum(['single', 'tabs']),
  poppedOut: z.array(z.string()).exactOptional(),
  isTeamDefault: z.boolean().exactOptional(),
  panels: z.array(
    z.object({ gridId: z.string(), viewId: z.string(), blotterId: z.string().exactOptional() }),
  ),
});

// ── Exceptions ──
export const exceptionType = z.enum([
  'priceStale',
  'priceVariance',
  'priceMissing',
  'cashBreak',
  'positionBreak',
  'marketValueBreak',
  'unsettledTrade',
  'agedIncome',
  'accrualBreak',
  'ratingMissing',
  'impairmentReview',
  'glMappingBreak',
  'importRowError',
]);

export const exceptionStatus = z.enum([
  'new',
  'inProgress',
  'waitingOnOthers',
  'resolved',
  'acceptedConditionally',
  'overridden',
]);

export const exceptionRecord = z.object({
  id: z.string(),
  type: exceptionType,
  severity: z.enum(['low', 'medium', 'high']),
  recordRef: z.union([entityRef, z.object({ kind: z.string(), id: z.string(), label: z.string() })]),
  portfolioId: z.string(),
  detectedAt: z.string(),
  detectedBy: actorRef,
  owner: actorRef.exactOptional(),
  status: exceptionStatus,
  values: z
    .object({
      expected: financialValue.exactOptional(),
      actual: financialValue.exactOptional(),
      tolerance: financialValue.exactOptional(),
    })
    .exactOptional(),
  rootCause: z.string().exactOptional(),
  rootCauseCategory: z.string().exactOptional(),
  dueBy: z.string().exactOptional(),
  matchedRuleId: z.string().exactOptional(),
  proposal: z
    .object({
      by: actorRef,
      summary: z.string(),
      actionId: z.string(),
      inputs: unknownRecord.exactOptional(),
    })
    .exactOptional(),
  evidence: z.array(evidenceRef),
  thread: z.array(z.object({ id: z.string(), author: actorRef, at: z.string(), text: z.string() })),
});

// ── Import ──
export const importMapping = z.object({
  targetType: z.enum(['transaction', 'price', 'impairment', 'cashActivity']),
  columns: z.array(z.object({ sourceHeader: z.string(), targetField: z.string() })),
});

export const importRowResult = z.object({
  rowNumber: z.number().int(),
  status: z.enum(['valid', 'warning', 'error']),
  messages: z.array(message),
  parsed: unknownRecord,
});

// ── Approvals, close sign-off, tolerances ──
export const approvalRequest = z.object({
  id: z.string(),
  actionId: z.string(),
  recordRefs: z.array(z.object({ type: z.string(), id: z.string() })),
  maker: actorRef,
  requestedAt: z.string(),
  reason: z.string(),
  before: unknownRecord.exactOptional(),
  after: unknownRecord.exactOptional(),
  evidence: z.array(evidenceRef).exactOptional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  checker: actorRef.exactOptional(),
  decidedAt: z.string().exactOptional(),
  note: z.string().exactOptional(),
});

export const closeSignOff = z.object({
  periodId: z.string(),
  signedBy: actorRef,
  at: z.string(),
  note: z.string().exactOptional(),
  packageJobId: z.string().exactOptional(),
});

export const toleranceRule = z.object({
  id: z.string(),
  version: z.number().int(),
  assetClass: z.string(),
  currency: z.string().exactOptional(),
  source: z.string().exactOptional(),
  check: z.enum(['dayOverDay', 'vendorVsVendor', 'stale', 'missing']),
  threshold: decimalString,
  holidayAware: z.boolean(),
});

export const recurringBreakRule = z.object({
  id: z.string(),
  name: z.string(),
  match: z.object({
    type: exceptionType,
    counterparty: z.string().exactOptional(),
    portfolioIds: z.array(z.string()).exactOptional(),
    maxAmount: decimalString.exactOptional(),
  }),
  rootCauseCategory: z.string(),
  proposedActionId: z.string(),
  createdBy: actorRef,
});

// ── Session and grid query ──
export const experienceSegment = z.enum(['superUser', 'operator', 'newUser', 'approver', 'client', 'admin']);

export const user = z.object({
  id: z.string(),
  name: z.string(),
  team: z.string(),
  role: z.string(),
  segment: experienceSegment,
  defaultDensity: density,
  blotterScope: z.array(z.string()).exactOptional(),
});

export const gridQuery = z.object({
  startRow: z.number().int().min(0),
  endRow: z.number().int().min(0),
  sort: z.array(sortSpec).exactOptional(),
  filters: z.array(filterCondition).exactOptional(),
  quickSearch: z.string().exactOptional(),
  groupBy: z.array(z.string()).exactOptional(),
  groupKeys: z.array(z.string()).exactOptional(),
});

export const errorBody = z.object({ messages: z.array(message), permission: permission.exactOptional() });

// ── Transactions ──
export const transactionStatus = z.enum(['unposted', 'posted', 'reversed']);
export const transactionFinancialField = z.enum(['quantity', 'price', 'amount']);

export const transactionRow = z.object({
  id: z.string(),
  portfolio: entityRef,
  security: entityRef.nullable(),
  type: z.string(),
  tradeDate: businessDate,
  settleDate: businessDate,
  quantity: financialValue,
  price: financialValue,
  amount: financialValue,
  currency: z.string(),
  status: transactionStatus,
  warning: message.exactOptional(),
  version: z.number().int(),
});

export const transactionPatch = z.object({
  changes: z.partialRecord(transactionFinancialField, decimalString).exactOptional(),
  reason: z.string().exactOptional(),
  dates: z
    .object({ tradeDate: isoDate.exactOptional(), settleDate: isoDate.nullable().exactOptional() })
    .exactOptional(),
});

export const gridGroup = z.object({ field: z.string(), key: z.string().nullable(), count: z.number().int() });

// ── Entity search and calendars ──
export const entitySearchResult = z.object({
  ref: entityRef,
  description: z.string(),
  type: z.string(),
  currency: z.string().exactOptional(),
  status: z.enum(['active', 'inactive']),
  parent: z.string().exactOptional(),
  matchedOn: z.string().exactOptional(),
  restricted: z.object({ reason: z.string() }).exactOptional(),
});

export const marketCalendar = z.object({
  market: z.string(),
  holidays: z.array(z.object({ date: isoDate, name: z.string() })),
});

/** Bodies for creating and updating views and workspaces. The server sets id, owner and timestamps. */
export const savedViewInput = savedView
  .pick({ gridId: true, name: true, ownership: true, state: true, schemaVersion: true })
  .extend({
    defaultForTeam: z.string().exactOptional(),
    /** Reassigns the owner (owner or administrator only). */
    owner: actorRef.exactOptional(),
  });
export const workspaceInput = workspace
  .omit({ id: true, owner: true })
  .extend({ owner: actorRef.exactOptional() });
