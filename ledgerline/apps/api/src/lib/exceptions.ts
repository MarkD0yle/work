/** Shared exception logic: reading rows, the close checks they belong to, and recurring-break rules. */
import type {
  ActorRef,
  CloseCheck,
  ExceptionRecord,
  ExceptionStatus,
  ExceptionType,
  FailedRule,
  RecurringBreakRule,
  ToleranceRule,
} from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import type { Db } from '../db/client';

/** Statuses that still need someone to act. Close is blocked while a high-severity exception is in one of these. */
export const OPEN_STATUSES: ExceptionStatus[] = ['new', 'inProgress', 'waitingOnOthers'];
export const OPEN_SQL = OPEN_STATUSES.map((s) => `'${s}'`).join(', ');
export const PRICE_TYPES: ExceptionType[] = ['priceStale', 'priceVariance', 'priceMissing'];

/** The close checklist (SPEC 8.3). Each check owns the exception types it raises. */
export const CLOSE_CHECKS: Pick<CloseCheck, 'id' | 'label' | 'catches' | 'exceptionTypes'>[] = [
  {
    id: 'aged-unsettled',
    label: 'Aged income and unsettled trades',
    catches: 'Trade-date vs settle-date timing breaks',
    exceptionTypes: ['agedIncome', 'unsettledTrade'],
  },
  {
    id: 'cash-custodian',
    label: 'Cash to custodian',
    catches: 'Unapplied receipts, outstanding wires',
    exceptionTypes: ['cashBreak'],
  },
  {
    id: 'positions-par',
    label: 'Positions and par, multi-party',
    catches: 'Count and par mismatches',
    exceptionTypes: ['positionBreak'],
  },
  {
    id: 'prices',
    label: 'Missing, stale and variant prices',
    catches: 'Prices outside thresholds',
    exceptionTypes: ['priceMissing', 'priceStale', 'priceVariance'],
  },
  {
    id: 'ratings',
    label: 'Regulatory rating completeness',
    catches: 'Unrated holdings',
    exceptionTypes: ['ratingMissing'],
  },
  {
    id: 'accruals',
    label: 'Due and accrued',
    catches: 'Unrecorded or overstated accruals',
    exceptionTypes: ['accrualBreak'],
  },
  {
    id: 'market-value',
    label: 'Market value',
    catches: 'Differences outside tolerance',
    exceptionTypes: ['marketValueBreak'],
  },
  {
    id: 'earned-income',
    label: 'Earned income month over month',
    catches: 'Missed accruals, misclassification',
    exceptionTypes: [],
  },
  {
    id: 'impairments',
    label: 'Impairments',
    catches: 'Charges not matching credit-loss analysis',
    exceptionTypes: ['impairmentReview'],
  },
  {
    id: 'gl-mapping',
    label: 'GL to accounting reports',
    catches: 'Mapping breaks',
    exceptionTypes: ['glMappingBreak', 'importRowError'],
  },
];

export const TYPE_LABELS: Record<ExceptionType, string> = {
  priceStale: 'Stale price',
  priceVariance: 'Price variance',
  priceMissing: 'Missing price',
  cashBreak: 'Cash break',
  positionBreak: 'Position break',
  marketValueBreak: 'Market value break',
  unsettledTrade: 'Unsettled trade',
  agedIncome: 'Aged income',
  accrualBreak: 'Accrual break',
  ratingMissing: 'Missing rating',
  impairmentReview: 'Impairment review',
  glMappingBreak: 'GL mapping break',
  importRowError: 'Import row error',
};

export interface ExceptionRaw {
  id: string;
  type: ExceptionType;
  severity: ExceptionRecord['severity'];
  record_ref: string;
  portfolio_id: string;
  portfolio_name?: string;
  period_end: string;
  detected_at: string;
  detected_by: string;
  owner: string | null;
  status: ExceptionStatus;
  values: string | null;
  root_cause: string | null;
  root_cause_category: string | null;
  due_by: string | null;
  matched_rule_id: string | null;
  proposal: string | null;
  evidence: string;
  thread: string;
  version: number;
  asset_class?: string | null;
}

const CHECK_OF: Partial<Record<ExceptionType, ToleranceRule['check']>> = {
  priceVariance: 'dayOverDay',
  priceStale: 'stale',
  priceMissing: 'missing',
};

/** For a price exception: which tolerance rule failed, its threshold and what was observed. */
export function failedRuleFor(raw: ExceptionRaw, rules: ToleranceRule[]): FailedRule | undefined {
  const check = CHECK_OF[raw.type];
  if (!check || !raw.asset_class) return undefined;
  const rule = rules.find((r) => r.assetClass === raw.asset_class && r.check === check);
  if (!rule) return undefined;
  const values = raw.values ? (JSON.parse(raw.values) as NonNullable<ExceptionRecord['values']>) : undefined;
  let actual: string | undefined;
  if (
    check === 'dayOverDay' &&
    values?.expected?.value &&
    values.actual?.value &&
    !new Decimal(values.expected.value).isZero()
  ) {
    actual = new Decimal(values.actual.value)
      .minus(values.expected.value)
      .abs()
      .div(new Decimal(values.expected.value).abs())
      .toDecimalPlaces(6)
      .toString();
  } else if (check === 'stale') {
    // The seeded stale exceptions are one market day past the rule: the price did not move since the prior close.
    actual = new Decimal(rule.threshold).plus(1).toString();
  }
  return { ruleId: rule.id, check, threshold: rule.threshold, ...(actual === undefined ? {} : { actual }) };
}

export function toException(raw: ExceptionRaw, rules: ToleranceRule[] = []): ExceptionRecord {
  const json = <T>(text: string | null): T | undefined =>
    text === null ? undefined : (JSON.parse(text) as T);
  const optional = {
    owner: json<ActorRef>(raw.owner),
    values: json<NonNullable<ExceptionRecord['values']>>(raw.values),
    rootCause: raw.root_cause ?? undefined,
    rootCauseCategory: raw.root_cause_category ?? undefined,
    dueBy: raw.due_by ?? undefined,
    matchedRuleId: raw.matched_rule_id ?? undefined,
    proposal: json<NonNullable<ExceptionRecord['proposal']>>(raw.proposal),
    portfolioName: raw.portfolio_name ?? undefined,
    failedRule: failedRuleFor(raw, rules),
  };
  return {
    id: raw.id,
    type: raw.type,
    severity: raw.severity,
    recordRef: JSON.parse(raw.record_ref) as ExceptionRecord['recordRef'],
    portfolioId: raw.portfolio_id,
    periodEnd: raw.period_end,
    detectedAt: raw.detected_at,
    detectedBy: JSON.parse(raw.detected_by) as ActorRef,
    status: raw.status,
    evidence: JSON.parse(raw.evidence) as ExceptionRecord['evidence'],
    thread: JSON.parse(raw.thread) as ExceptionRecord['thread'],
    ...(Object.fromEntries(
      Object.entries(optional).filter(([, v]) => v !== undefined),
    ) as Partial<ExceptionRecord>),
  };
}

export function loadToleranceRules(db: Db): ToleranceRule[] {
  return (
    db.$client.prepare('SELECT * FROM tolerance_rules ORDER BY asset_class, "check"').all() as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: r.id as string,
    version: r.version as number,
    assetClass: r.asset_class as string,
    check: r.check as ToleranceRule['check'],
    threshold: r.threshold as string,
    holidayAware: Boolean(r.holiday_aware),
    ...(r.currency ? { currency: r.currency as string } : {}),
    ...(r.source ? { source: r.source as string } : {}),
  }));
}

export function loadBreakRules(db: Db): RecurringBreakRule[] {
  return (
    db.$client.prepare('SELECT * FROM recurring_break_rules ORDER BY id').all() as Record<string, string>[]
  ).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    match: JSON.parse(r.match as string) as RecurringBreakRule['match'],
    rootCauseCategory: r.root_cause_category as string,
    proposedActionId: r.proposed_action_id as string,
    createdBy: JSON.parse(r.created_by as string) as ActorRef,
  }));
}

/** Does a recurring-break rule describe this exception? Amounts compare on the size of the break (expected minus actual). */
export function ruleMatches(rule: RecurringBreakRule, raw: ExceptionRaw): boolean {
  if (rule.match.type !== raw.type) return false;
  if (rule.match.portfolioIds?.length && !rule.match.portfolioIds.includes(raw.portfolio_id)) return false;
  if (rule.match.counterparty) {
    const ref = JSON.parse(raw.record_ref) as { label?: string };
    if (!ref.label?.toLowerCase().includes(rule.match.counterparty.toLowerCase())) return false;
  }
  if (rule.match.maxAmount) {
    const values = raw.values
      ? (JSON.parse(raw.values) as NonNullable<ExceptionRecord['values']>)
      : undefined;
    if (!values?.expected?.value || !values.actual?.value) return false;
    if (new Decimal(values.expected.value).minus(values.actual.value).abs().gt(rule.match.maxAmount))
      return false;
  }
  return true;
}

const SYSTEM_RULES: ActorRef = { type: 'system', id: 'recurring-break-rules', name: 'Recurring-break rules' };

/**
 * Tags open, untagged exceptions that a rule describes as proposals (SPEC 8.2). A proposal changes nothing
 * by itself: the exception stays open until a person accepts it. Returns the ids tagged.
 */
export function applyBreakRule(db: Db, rule: RecurringBreakRule, onlyIds?: string[]): string[] {
  const sqlite = db.$client;
  const rows = sqlite
    .prepare(
      `SELECT * FROM exceptions WHERE type = ? AND status IN (${OPEN_SQL}) AND matched_rule_id IS NULL ORDER BY id`,
    )
    .all(rule.match.type) as ExceptionRaw[];
  const tagged: string[] = [];
  for (const raw of rows) {
    if (onlyIds && !onlyIds.includes(raw.id)) continue;
    if (!ruleMatches(rule, raw)) continue;
    const proposal: NonNullable<ExceptionRecord['proposal']> = {
      by: SYSTEM_RULES,
      summary: `Matches the rule "${rule.name}": root cause ${rule.rootCauseCategory}. A person must accept this before it resolves.`,
      actionId: rule.proposedActionId,
      inputs: { rootCauseCategory: rule.rootCauseCategory, ruleId: rule.id },
    };
    sqlite
      .prepare('UPDATE exceptions SET matched_rule_id = ?, proposal = ?, version = version + 1 WHERE id = ?')
      .run(rule.id, JSON.stringify(proposal), raw.id);
    tagged.push(raw.id);
  }
  return tagged;
}
