import type { ActionContext, ActionDef, BulkResult, Permission, TransactionRow } from '@ledgerline/contracts';
import { post } from '../services';

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
export interface TransactionActionHandlers {
  /** Opens the entry form for a new transaction. */
  onNew: () => void;
  /** Opens the entry form filled in from an existing transaction. */
  onClone: (id: string) => void;
  /** Opens quick paste and file import. */
  onImport: () => void;
}

/** Result of an action that only opens a screen: nothing has changed yet, so there is nothing to report. */
const opened = (): Promise<BulkResult> =>
  Promise.resolve({ jobId: 'local', status: 'completed', succeeded: [], failed: [], skipped: [] });

export const createTransactionActions = (
  handlers: TransactionActionHandlers,
): ActionDef<TransactionRow>[] => [
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
  // These three only open a screen; nothing changes until the user saves there.
  {
    id: 'transaction.new',
    label: 'New transaction',
    description: 'Opens a form to enter one transaction. It is saved as unposted.',
    tier: 'primary',
    appliesTo: 'none',
    consequence: 'none',
    available: permitted('transaction.create'),
    agentRequiresConfirmation: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => {
      handlers.onNew();
      return opened();
    },
  },
  {
    id: 'transaction.import',
    label: 'Paste or import',
    description:
      'Pastes rows from a spreadsheet, or uploads a CSV or XLSX file, to create or correct unposted transactions.',
    tier: 'secondary',
    appliesTo: 'none',
    consequence: 'none',
    available: permitted('transaction.import'),
    agentRequiresConfirmation: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => {
      handlers.onImport();
      return opened();
    },
  },
  {
    id: 'transaction.clone',
    label: 'Clone',
    description:
      'Starts a new unposted transaction from the selected one. Nothing is saved until you save the form.',
    tier: 'secondary',
    appliesTo: 'single',
    consequence: 'none',
    available: permitted('transaction.create'),
    agentRequiresConfirmation: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: (ids) => {
      if (ids[0]) handlers.onClone(ids[0]);
      return opened();
    },
  },
];

/** The registry with handlers that do nothing, for checks that only read the definitions. */
export const transactionActions = createTransactionActions({
  onNew: () => {},
  onClone: () => {},
  onImport: () => {},
});
