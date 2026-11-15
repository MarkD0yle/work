import type { ActionContext, Permission, TransactionRow } from '@ledgerline/contracts';
import { resolveActions, validateRegistry } from '@ledgerline/ui';
import { describe, expect, it } from 'vitest';
import { createTransactionActions, transactionActions } from './actions';

const row = (status: TransactionRow['status']) => ({ id: `T-${status}`, status }) as TransactionRow;
const allow = (action: string): Permission => ({ action, accessLevel: 'full', allowed: true });
const ctx = (selection: TransactionRow[], permissions: Permission[]): ActionContext<TransactionRow> => ({
  selection,
  state: { kind: 'normal' },
  permissions,
});

describe('transaction action registry', () => {
  it('every registered action has a description and an explicit agentRequiresConfirmation', () => {
    expect(validateRegistry(transactionActions)).toEqual([]);
    for (const action of transactionActions) {
      expect(action.description.trim().length, action.id).toBeGreaterThan(10);
      expect(typeof action.agentRequiresConfirmation, action.id).toBe('boolean');
      expect(action.inputSchema, action.id).toBeDefined();
    }
  });

  it('Post, Reverse and Delete are destructive, confirm first, and need human confirmation from an agent', () => {
    for (const id of ['transaction.post', 'transaction.reverse', 'transaction.delete']) {
      const action = transactionActions.find((a) => a.id === id);
      expect(action, id).toMatchObject({ tier: 'destructive', agentRequiresConfirmation: true });
      expect(action?.consequence, id).not.toBe('none');
    }
  });

  it('Ben sees Reverse disabled with the reason from his permissions', () => {
    const ben: Permission[] = [
      allow('transaction.post'),
      {
        action: 'transaction.reverse',
        accessLevel: 'none',
        allowed: false,
        reason: 'role',
        explanation: 'Reversing a posted transaction needs full access on transactions.',
      },
    ];
    const resolved = resolveActions(transactionActions, ctx([row('posted')], ben));
    expect(resolved.find((a) => a.def.id === 'transaction.reverse')).toMatchObject({
      enabled: false,
      reason: 'Reversing a posted transaction needs full access on transactions.',
    });
    // A permission that is missing altogether is a denial with a reason, not a silent allow.
    expect(resolved.find((a) => a.def.id === 'transaction.delete')).toMatchObject({
      enabled: false,
      reason: 'Your role does not include this action.',
    });
  });

  it('New, Import and Clone only open a screen: no confirm step, and Clone needs exactly one row', () => {
    const calls: string[] = [];
    const actions = createTransactionActions({
      onNew: () => calls.push('new'),
      onClone: (id) => calls.push(`clone ${id}`),
      onImport: () => calls.push('import'),
    });
    const create = [allow('transaction.create'), allow('transaction.import')];
    const one = resolveActions(actions, ctx([row('posted')], create));
    const none = resolveActions(actions, ctx([], create));
    const two = resolveActions(actions, ctx([row('posted'), row('unposted')], create));
    const find = (list: typeof one, id: string) => list.find((a) => a.def.id === id);
    for (const id of ['transaction.new', 'transaction.import', 'transaction.clone'])
      expect(find(one, id)?.def.consequence, id).toBe('none');
    expect(find(none, 'transaction.new')?.enabled).toBe(true);
    expect(find(none, 'transaction.clone')?.enabled).toBe(false);
    expect(find(two, 'transaction.clone')?.enabled).toBe(false);
    expect(find(one, 'transaction.clone')?.enabled).toBe(true);
    void find(one, 'transaction.clone')?.def.execute(['T-posted']);
    void find(none, 'transaction.new')?.def.execute([]);
    void find(none, 'transaction.import')?.def.execute([]);
    expect(calls).toEqual(['clone T-posted', 'new', 'import']);
    // Without the permission the action is listed, disabled, with the reason.
    expect(find(resolveActions(actions, ctx([], [])), 'transaction.new')).toMatchObject({ enabled: false });
  });

  it('each record is eligible for exactly the actions its status allows', () => {
    const all = ['transaction.post', 'transaction.reverse', 'transaction.delete'].map(allow);
    const enabledFor = (status: TransactionRow['status']) =>
      resolveActions(transactionActions, ctx([row(status)], all))
        .filter((a) => a.enabled)
        .map((a) => a.def.id);
    expect(enabledFor('unposted')).toEqual(['transaction.post', 'transaction.delete']);
    expect(enabledFor('posted')).toEqual(['transaction.reverse']);
    expect(enabledFor('reversed')).toEqual([]);
    const mixed = resolveActions(
      transactionActions,
      ctx([row('unposted'), row('posted'), row('reversed')], all),
    ).find((a) => a.def.id === 'transaction.post');
    expect(mixed?.eligible).toHaveLength(1);
    expect(mixed?.ineligible.map((i) => i.reason)).toEqual([
      'Already posted.',
      'Reversed. It cannot be posted again.',
    ]);
  });
});
