/**
 * SQLite schema for the mock accounting engine.
 * Decimals are stored as TEXT (canonical decimal strings), never REAL.
 * Business dates are ISO YYYY-MM-DD TEXT; null means no date.
 */
import type {
  AccessLevel,
  ActorRef,
  ApprovalRequest,
  AuditEvent,
  BulkResult,
  CloseType,
  DenialReason,
  Density,
  EvidenceRef,
  ExceptionRecord,
  ExceptionStatus,
  ExceptionType,
  ExperienceSegment,
  ImportMapping,
  Job,
  JobStatus,
  JobType,
  PeriodState,
  Provenance,
  RecurringBreakRule,
  SavedView,
  ToleranceRule,
  TransactionFinancialField,
  Workspace,
} from '@ledgerline/contracts';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();
const bool = (name: string) => integer(name, { mode: 'boolean' });

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  team: text('team').notNull(),
  role: text('role').notNull(),
  segment: text('segment').$type<ExperienceSegment>().notNull(),
  defaultDensity: text('default_density').$type<Density>().notNull(),
  blotterScope: json<string[]>('blotter_scope'),
});

export const permissions = sqliteTable(
  'permissions',
  {
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    accessLevel: text('access_level').$type<AccessLevel>().notNull(),
    allowed: bool('allowed').notNull(),
    reason: text('reason').$type<DenialReason>(),
    explanation: text('explanation'),
    group: text('group'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.action] })],
);

export const portfolios = sqliteTable('portfolios', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'generalAccount' | 'separateAccount' | 'fund'>().notNull(),
  baseCurrency: text('base_currency').notNull(),
  calendar: text('calendar').notNull(),
  manager: text('manager').notNull(),
  controllerId: text('controller_id').notNull(),
  status: text('status').$type<'active' | 'inactive'>().notNull(),
});

export const securities = sqliteTable(
  'securities',
  {
    id: text('id').primaryKey(),
    isin: text('isin').notNull(),
    cusip: text('cusip'),
    sedol: text('sedol'),
    ticker: text('ticker'),
    description: text('description').notNull(),
    assetClass: text('asset_class').notNull(),
    currency: text('currency').notNull(),
    issuer: text('issuer').notNull(),
    market: text('market').notNull(),
    status: text('status').$type<'active' | 'inactive'>().notNull(),
    held: bool('held').notNull(),
  },
  (t) => [
    uniqueIndex('securities_isin').on(t.isin),
    index('securities_cusip').on(t.cusip),
    index('securities_sedol').on(t.sedol),
    index('securities_ticker').on(t.ticker),
    index('securities_held').on(t.held),
  ],
);

export const marketHolidays = sqliteTable(
  'market_holidays',
  {
    market: text('market').notNull(),
    date: text('date').notNull(),
    name: text('name').notNull(),
  },
  (t) => [primaryKey({ columns: [t.market, t.date] })],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    portfolioId: text('portfolio_id').notNull(),
    securityId: text('security_id'),
    type: text('type').notNull(),
    tradeDate: text('trade_date').notNull(),
    settleDate: text('settle_date'),
    quantity: text('quantity'),
    price: text('price'),
    amount: text('amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status').$type<'unposted' | 'posted' | 'reversed'>().notNull(),
    /** Stable message code when the record carries a warning, e.g. LL-VAL-0142. */
    warningCode: text('warning_code'),
    origin: text('origin').$type<'entered' | 'imported' | 'calculated'>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    /** Provenance of overridden fields, keyed by field name. */
    overrides: json<Partial<Record<TransactionFinancialField, Provenance>>>('overrides'),
    version: integer('version').notNull(),
  },
  (t) => [
    index('transactions_portfolio').on(t.portfolioId),
    index('transactions_security').on(t.securityId),
    index('transactions_trade_date').on(t.tradeDate),
    index('transactions_status').on(t.status, t.tradeDate),
  ],
);

export const prices = sqliteTable(
  'prices',
  {
    id: text('id').primaryKey(),
    securityId: text('security_id').notNull(),
    priceDate: text('price_date').notNull(),
    /** Null when the vendor sent nothing (missing). */
    price: text('price'),
    priorPrice: text('prior_price'),
    currency: text('currency').notNull(),
    source: text('source').notNull(),
    toleranceStatus: text('tolerance_status').$type<'ok' | 'stale' | 'variance' | 'missing'>().notNull(),
    version: integer('version').notNull(),
  },
  (t) => [
    uniqueIndex('prices_security_date').on(t.securityId, t.priceDate),
    index('prices_date_status').on(t.priceDate, t.toleranceStatus),
  ],
);

export const toleranceRules = sqliteTable('tolerance_rules', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  assetClass: text('asset_class').notNull(),
  currency: text('currency'),
  source: text('source'),
  check: text('check').$type<ToleranceRule['check']>().notNull(),
  threshold: text('threshold').notNull(),
  holidayAware: bool('holiday_aware').notNull(),
});

export const positions = sqliteTable(
  'positions',
  {
    id: text('id').primaryKey(),
    portfolioId: text('portfolio_id').notNull(),
    securityId: text('security_id').notNull(),
    quantity: text('quantity').notNull(),
    originalFace: text('original_face'),
    marketValue: text('market_value'),
    currency: text('currency').notNull(),
    asOf: text('as_of').notNull(),
  },
  (t) => [uniqueIndex('positions_portfolio_security').on(t.portfolioId, t.securityId)],
);

export const cashActivity = sqliteTable(
  'cash_activity',
  {
    id: text('id').primaryKey(),
    portfolioId: text('portfolio_id').notNull(),
    bankAccount: text('bank_account').notNull(),
    type: text('type').$type<'receipt' | 'disbursement' | 'wire' | 'fee' | 'interest'>().notNull(),
    amount: text('amount').notNull(),
    currency: text('currency').notNull(),
    valueDate: text('value_date').notNull(),
    status: text('status').$type<'applied' | 'unapplied' | 'outstanding'>().notNull(),
    reference: text('reference').notNull(),
  },
  (t) => [index('cash_portfolio_date').on(t.portfolioId, t.valueDate), index('cash_status').on(t.status)],
);

export const periods = sqliteTable(
  'periods',
  {
    id: text('id').primaryKey(),
    portfolioId: text('portfolio_id').notNull(),
    periodEnd: text('period_end').notNull(),
    cutoff: text('cutoff').notNull(),
    state: text('state').$type<PeriodState>().notNull(),
    closes: json<Record<CloseType, PeriodState>>('closes').notNull(),
    version: integer('version').notNull(),
  },
  (t) => [uniqueIndex('periods_portfolio_end').on(t.portfolioId, t.periodEnd)],
);

export const exceptions = sqliteTable(
  'exceptions',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<ExceptionType>().notNull(),
    severity: text('severity').$type<ExceptionRecord['severity']>().notNull(),
    recordRef: json<ExceptionRecord['recordRef']>('record_ref').notNull(),
    portfolioId: text('portfolio_id').notNull(),
    periodEnd: text('period_end').notNull(),
    detectedAt: text('detected_at').notNull(),
    detectedBy: json<ActorRef>('detected_by').notNull(),
    owner: json<ActorRef>('owner'),
    status: text('status').$type<ExceptionStatus>().notNull(),
    values: json<NonNullable<ExceptionRecord['values']>>('values'),
    rootCause: text('root_cause'),
    rootCauseCategory: text('root_cause_category'),
    dueBy: text('due_by'),
    matchedRuleId: text('matched_rule_id'),
    proposal: json<NonNullable<ExceptionRecord['proposal']>>('proposal'),
    evidence: json<EvidenceRef[]>('evidence').notNull(),
    thread: json<ExceptionRecord['thread']>('thread').notNull(),
    version: integer('version').notNull(),
  },
  (t) => [
    index('exceptions_portfolio_period').on(t.portfolioId, t.periodEnd, t.severity, t.status),
    index('exceptions_detected').on(t.detectedAt),
  ],
);

export const rootCauses = sqliteTable('root_causes', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
});

export const recurringBreakRules = sqliteTable('recurring_break_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  match: json<RecurringBreakRule['match']>('match').notNull(),
  rootCauseCategory: text('root_cause_category').notNull(),
  proposedActionId: text('proposed_action_id').notNull(),
  createdBy: json<ActorRef>('created_by').notNull(),
});

export const views = sqliteTable(
  'views',
  {
    id: text('id').primaryKey(),
    gridId: text('grid_id').notNull(),
    name: text('name').notNull(),
    ownership: text('ownership').$type<SavedView['ownership']>().notNull(),
    owner: json<ActorRef>('owner').notNull(),
    /** Role the view is the team default for, when ownership is 'default'. */
    defaultForRole: text('default_for_role'),
    state: json<SavedView['state']>('state').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('views_grid').on(t.gridId)],
);

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  owner: json<ActorRef>('owner').notNull(),
  group: text('group'),
  loadAtStartup: bool('load_at_startup').notNull(),
  layout: text('layout').$type<Workspace['layout']>().notNull(),
  poppedOut: json<string[]>('popped_out'),
  isTeamDefault: bool('is_team_default'),
  panels: json<Workspace['panels']>('panels').notNull(),
});

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<JobType>().notNull(),
    name: text('name').notNull(),
    submittedBy: json<ActorRef>('submitted_by').notNull(),
    submittedAt: text('submitted_at').notNull(),
    queue: text('queue').notNull(),
    status: text('status').$type<JobStatus>().notNull(),
    progress: json<NonNullable<Job['progress']>>('progress'),
    outputs: json<NonNullable<Job['outputs']>>('outputs'),
    result: json<BulkResult>('result'),
    inputs: json<Record<string, unknown>>('inputs').notNull(),
    scheduledFor: text('scheduled_for'),
    log: json<NonNullable<Job['log']>>('log'),
  },
  (t) => [index('jobs_status').on(t.status)],
);

export const approvals = sqliteTable(
  'approvals',
  {
    id: text('id').primaryKey(),
    actionId: text('action_id').notNull(),
    recordRefs: json<ApprovalRequest['recordRefs']>('record_refs').notNull(),
    maker: json<ActorRef>('maker').notNull(),
    requestedAt: text('requested_at').notNull(),
    reason: text('reason').notNull(),
    before: json<Record<string, unknown>>('before'),
    after: json<Record<string, unknown>>('after'),
    evidence: json<EvidenceRef[]>('evidence'),
    status: text('status').$type<ApprovalRequest['status']>().notNull(),
    checker: json<ActorRef>('checker'),
    decidedAt: text('decided_at'),
    note: text('note'),
  },
  (t) => [index('approvals_status').on(t.status)],
);

export const closeSignOffs = sqliteTable('close_sign_offs', {
  periodId: text('period_id').primaryKey(),
  signedBy: json<ActorRef>('signed_by').notNull(),
  at: text('at').notNull(),
  note: text('note'),
  packageJobId: text('package_job_id'),
});

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    recordType: text('record_type').notNull(),
    recordId: text('record_id').notNull(),
    actor: json<ActorRef>('actor').notNull(),
    at: text('at').notNull(),
    effectiveDate: text('effective_date'),
    before: json<Record<string, unknown>>('before'),
    after: json<Record<string, unknown>>('after'),
    note: json<NonNullable<AuditEvent['note']>>('note'),
    evidence: json<EvidenceRef[]>('evidence'),
    batchId: text('batch_id'),
    immutable: bool('immutable').notNull(),
  },
  (t) => [index('audit_record').on(t.recordType, t.recordId, t.at), index('audit_batch').on(t.batchId)],
);

export const statements = sqliteTable(
  'statements',
  {
    id: text('id').primaryKey(),
    portfolioId: text('portfolio_id').notNull(),
    periodEnd: text('period_end').notNull(),
    name: text('name').notNull(),
    url: text('url').notNull(),
  },
  (t) => [index('statements_portfolio').on(t.portfolioId, t.periodEnd)],
);

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  params: json<Record<string, unknown>>('params').notNull(),
});

export const importMappings = sqliteTable(
  'import_mappings',
  {
    userId: text('user_id').notNull(),
    targetType: text('target_type').$type<ImportMapping['targetType']>().notNull(),
    columns: json<ImportMapping['columns']>('columns').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType] })],
);
