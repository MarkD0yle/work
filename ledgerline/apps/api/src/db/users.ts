/**
 * Seeded demo users and their permissions (SPEC §3).
 * Every denial carries a user-facing explanation: disabled actions always say why.
 */
import type { AccessLevel, DenialReason, User } from '@ledgerline/contracts';

export const SEED_USERS: User[] = [
  {
    id: 'u-ada',
    name: 'Ada',
    team: 'Transaction Operations',
    role: 'Super user',
    segment: 'superUser',
    defaultDensity: 'compact',
  },
  {
    id: 'u-ben',
    name: 'Ben',
    team: 'Transaction Operations',
    role: 'New user',
    segment: 'newUser',
    defaultDensity: 'comfortable',
  },
  {
    id: 'u-cleo',
    name: 'Cleo',
    team: 'Investment Accounting',
    role: 'Controller',
    segment: 'approver',
    defaultDensity: 'standard',
  },
  {
    id: 'u-dev',
    name: 'Dev',
    team: 'Market Data',
    role: 'Market data',
    segment: 'superUser',
    defaultDensity: 'compact',
  },
  {
    id: 'u-eli',
    name: 'Eli',
    team: 'External clients',
    role: 'Client',
    segment: 'client',
    defaultDensity: 'comfortable',
    blotterScope: ['P-0007', 'P-0019'],
  },
  {
    id: 'u-fay',
    name: 'Fay',
    team: 'Administrators',
    role: 'Administrator',
    segment: 'admin',
    defaultDensity: 'standard',
  },
  // Not in the original six: SPEC §15 and the Milestone 6 gate need a reconciliation user (see DECISIONS.md).
  {
    id: 'u-rafa',
    name: 'Rafa',
    team: 'Reconciliation and Control',
    role: 'Reconciliation',
    segment: 'operator',
    defaultDensity: 'standard',
  },
];

export const ACTIONS = [
  ['transaction.view', 'Transactions'],
  ['transaction.create', 'Transactions'],
  ['transaction.edit', 'Transactions'],
  ['transaction.import', 'Transactions'],
  ['transaction.post', 'Transactions'],
  ['transaction.reverse', 'Transactions'],
  ['transaction.delete', 'Transactions'],
  ['transaction.override', 'Transactions'],
  ['price.view', 'Market data'],
  ['price.resolve', 'Market data'],
  ['price.override', 'Market data'],
  ['tolerance.edit', 'Market data'],
  ['exception.view', 'Exceptions'],
  ['exception.assign', 'Exceptions'],
  ['exception.resolve', 'Exceptions'],
  ['exception.rules', 'Exceptions'],
  ['period.view', 'Period close'],
  ['period.close', 'Period close'],
  ['period.reopen', 'Period close'],
  ['period.overrideBlock', 'Period close'],
  ['period.signoff', 'Period close'],
  ['approval.decide', 'Approvals'],
  ['report.run', 'Reports'],
  ['export.run', 'Reports'],
  ['audit.view', 'Audit'],
  ['admin.users', 'Admin'],
  ['admin.permissions', 'Admin'],
] as const;

export type ActionId = (typeof ACTIONS)[number][0];

type Rule = AccessLevel | { deny: DenialReason; why: string };

const ROLE = 'Your role does not include this action.';
const viewOnly = (area: string): Rule => ({
  deny: 'role',
  why: `Your role can view ${area} but not change them.`,
});

/** Per-user overrides on top of a default. Anything not listed falls back to `fallback`. */
const MATRIX: Record<string, { fallback: Rule; rules: Partial<Record<ActionId, Rule>> }> = {
  'u-ada': {
    fallback: 'full',
    rules: {
      'price.override': viewOnly('price overrides'),
      'tolerance.edit': { deny: 'role', why: 'Tolerance rules are owned by Market Data.' },
      'price.resolve': 'edit',
      'period.close': { deny: 'role', why: 'Only controllers in Investment Accounting can close a period.' },
      'period.reopen': {
        deny: 'role',
        why: 'Only controllers in Investment Accounting can reopen a period.',
      },
      'period.overrideBlock': { deny: 'role', why: 'Only controllers can override a close block.' },
      'period.signoff': { deny: 'role', why: 'Only controllers can sign off a close.' },
      'approval.decide': { deny: 'role', why: 'Approvals are decided by controllers.' },
      'admin.users': { deny: 'role', why: 'User administration is limited to administrators.' },
      'admin.permissions': { deny: 'role', why: 'Permission administration is limited to administrators.' },
    },
  },
  'u-ben': {
    fallback: { deny: 'role', why: ROLE },
    rules: {
      'transaction.view': 'edit',
      'transaction.create': 'edit',
      'transaction.edit': 'edit',
      'transaction.import': 'edit',
      'transaction.post': 'edit',
      'transaction.reverse': {
        deny: 'role',
        why: 'Reversing a posted transaction needs full access on transactions. Ask a Transaction Operations super user.',
      },
      'transaction.delete': 'edit',
      'transaction.override': {
        deny: 'role',
        why: 'Overriding calculated values needs full access on transactions.',
      },
      'price.view': 'view',
      'exception.view': 'view',
      'period.view': 'view',
      'report.run': 'view',
      'export.run': 'view',
      'audit.view': 'view',
    },
  },
  'u-cleo': {
    fallback: 'full',
    rules: {
      'transaction.view': 'view',
      'transaction.create': viewOnly('transactions'),
      'transaction.edit': viewOnly('transactions'),
      'transaction.import': viewOnly('transactions'),
      'transaction.post': viewOnly('transactions'),
      'transaction.reverse': viewOnly('transactions'),
      'transaction.delete': viewOnly('transactions'),
      'transaction.override': viewOnly('transactions'),
      'price.view': 'view',
      'price.resolve': viewOnly('prices'),
      'price.override': viewOnly('prices'),
      'tolerance.edit': { deny: 'role', why: 'Tolerance rules are owned by Market Data.' },
      'admin.users': { deny: 'role', why: 'User administration is limited to administrators.' },
      'admin.permissions': { deny: 'role', why: 'Permission administration is limited to administrators.' },
    },
  },
  'u-dev': {
    fallback: { deny: 'role', why: ROLE },
    rules: {
      'transaction.view': 'view',
      'price.view': 'full',
      'price.resolve': 'full',
      'price.override': 'full',
      'tolerance.edit': 'full',
      'exception.view': 'full',
      'exception.assign': 'full',
      'exception.resolve': 'full',
      'period.view': 'view',
      'report.run': 'view',
      'export.run': 'view',
      'audit.view': 'view',
    },
  },
  'u-eli': {
    fallback: { deny: 'role', why: 'Client access is limited to viewing and exporting your own portfolios.' },
    rules: { 'transaction.view': 'view', 'export.run': 'view' },
  },
  'u-fay': {
    fallback: { deny: 'role', why: 'Administrators can view this area but not change it.' },
    rules: {
      'transaction.view': 'view',
      'price.view': 'view',
      'exception.view': 'view',
      'period.view': 'view',
      // Fay is the second approver for controller requests, so Cleo never approves her own.
      'approval.decide': 'full',
      'report.run': 'view',
      'export.run': 'view',
      'audit.view': 'view',
      'admin.users': 'full',
      'admin.permissions': 'full',
    },
  },
  'u-rafa': {
    fallback: { deny: 'role', why: ROLE },
    rules: {
      'transaction.view': 'view',
      'price.view': 'view',
      'exception.view': 'full',
      'exception.assign': 'full',
      'exception.resolve': 'full',
      'exception.rules': 'full',
      'period.view': 'view',
      'report.run': 'view',
      'export.run': 'view',
      'audit.view': 'view',
    },
  },
};

export interface Grant {
  action: ActionId;
  accessLevel: AccessLevel;
  allowed: boolean;
  reason: DenialReason | null;
  explanation: string | null;
  group: string;
}

export function grantsFor(userId: string): Grant[] {
  const entry = MATRIX[userId];
  if (!entry) throw new Error(`No permission matrix for ${userId}`);
  return ACTIONS.map(([action, group]) => {
    const rule = entry.rules[action] ?? entry.fallback;
    return typeof rule === 'string'
      ? { action, accessLevel: rule, allowed: rule !== 'none', reason: null, explanation: null, group }
      : { action, accessLevel: 'none', allowed: false, reason: rule.deny, explanation: rule.why, group };
  });
}
