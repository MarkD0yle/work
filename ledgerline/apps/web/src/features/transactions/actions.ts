import type { ActionContext, ActionDef, BulkResult, Permission, TransactionRow } from '@ledgerline/contracts';
import { post } from '../../api/client';

const bulk = (actionId: string) => (ids: string[], inputs?: Record<string, unknown>) =>
  post<BulkResult>('/transactions/bulk', {
    actionId,
    ids,
    ...(typeof inputs?.reason === 'string' ? { reason: inputs.reason } : {}),
  });

/** Looks the action up in the user's permissions. A missing entry is a denial with a reason, never a silent allow. */
const permitted =
  (action: string) =>
  (ctx: ActionContext<TransactionRow>): Permission =>
    ctx.permissions.find((p) => p.action === action) ?? {
      action,
      accessLevel: 'none',
      allowed: false,
      reason: 'role',
      explanation: 'Your role does not include this action.',
    };

const eligibleWhen =
  (action: string, test: (row: TransactionRow) => string | null) =>
  (row: TransactionRow): Permission => {
    const why = test(row);
    return why
      ? { action, accessLevel: 'none', allowed: false, reason: 'recordState', explanation: why }
      : { action, accessLevel: 'full', allowed: true };
  };

/**
 * The Transactions action registry (SPEC 7.8). The toolbar, selection bar, context menu and command palette
 * are all built from this one list, and a future assistant would call the same definitions through the same
 * permissions. Post, Reverse and Delete change the ledger, so each confirms first and needs human confirmation from an agent.
 */
export const transactionActions: ActionDef<TransactionRow>[] = [
  {
    id: 'transaction.post',
    label: 'Post',
    description: 'Posts unposted transactions to the ledger.',
    tier: 'destructive',
    appliesTo: 'multi',
    consequence: 'reversibleWithAudit',
    shortcut: 'Mod+Enter',
    available: permitted('transaction.post'),
    eligibility: eligibleWhen('transaction.post', (row) =>
      row.status === 'unposted'
        ? null
        : row.status === 'posted'
          ? 'Already posted.'
          : 'Reversed. It cannot be posted again.',
    ),
    agentRequiresConfirmation: true,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: bulk('transaction.post'),
  },
  {
    id: 'transaction.reverse',
    label: 'Reverse',
    description:
      'Reverses posted transactions. The original and the reversal both stay in the audit history.',
    tier: 'destructive',
    appliesTo: 'multi',
    consequence: 'reversibleWithAudit',
    available: permitted('transaction.reverse'),
    eligibility: eligibleWhen('transaction.reverse', (row) =>
      row.status === 'posted'
        ? null
        : row.status === 'unposted'
          ? 'Not posted, so there is nothing to reverse.'
          : 'Already reversed.',
    ),
    agentRequiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Optional note recorded in the audit history.' } },
      additionalProperties: false,
    },
    execute: bulk('transaction.reverse'),
  },
  {
    id: 'transaction.delete',
    label: 'Delete',
    description: 'Deletes unposted transactions. A posted transaction must be reversed instead.',
    tier: 'destructive',
    appliesTo: 'multi',
    consequence: 'irreversible',
    shortcut: 'Delete',
    available: permitted('transaction.delete'),
    eligibility: eligibleWhen('transaction.delete', (row) =>
      row.status === 'unposted'
        ? null
        : `It is ${row.status}. Only unposted transactions can be deleted; reverse it instead.`,
    ),
    agentRequiresConfirmation: true,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: bulk('transaction.delete'),
  },
];
