import type { ActionContext, ActionDef, BulkResult, Permission } from '@ledgerline/contracts';
import { describe, expect, it } from 'vitest';
import {
  formatShortcut,
  groupIneligible,
  layoutActions,
  matchesShortcut,
  resolveAction,
  resolveActions,
  validateRegistry,
} from './registry';

interface Row {
  id: string;
  status: 'unposted' | 'posted';
}
const ok: Permission = { action: 'x', accessLevel: 'full', allowed: true };
const no = (explanation: string): Permission => ({
  action: 'x',
  accessLevel: 'none',
  allowed: false,
  reason: 'role',
  explanation,
});
const done: BulkResult = { jobId: 'j', status: 'completed', succeeded: [], failed: [], skipped: [] };
const def = (over: Partial<ActionDef<Row>> & Pick<ActionDef<Row>, 'id'>): ActionDef<Row> => ({
  label: over.id,
  description: `Does ${over.id}.`,
  tier: 'secondary',
  appliesTo: 'multi',
  consequence: 'none',
  available: () => ok,
  agentRequiresConfirmation: false,
  execute: async () => done,
  ...over,
});
const ctx = (selection: Row[]): ActionContext<Row> => ({
  selection,
  state: { kind: 'normal' },
  permissions: [],
});
const rows = (statuses: Row['status'][]): Row[] => statuses.map((status, i) => ({ id: `T-${i}`, status }));

const post = def({
  id: 'transaction.post',
  label: 'Post',
  tier: 'destructive',
  consequence: 'reversibleWithAudit',
  agentRequiresConfirmation: true,
  shortcut: 'Mod+Enter',
  eligibility: (row) => (row.status === 'unposted' ? ok : no('Already posted.')),
});

describe('resolveAction', () => {
  it('500 selected with 40 ineligible gives 460 eligible and the 40 grouped by reason', () => {
    const selection = [
      ...rows(Array<Row['status']>(460).fill('unposted')),
      ...rows(Array<Row['status']>(40).fill('posted')),
    ];
    const resolved = resolveAction(post, ctx(selection));
    expect(resolved.enabled).toBe(true);
    expect(resolved.eligible).toHaveLength(460);
    expect(groupIneligible(resolved.ineligible)).toEqual([{ reason: 'Already posted.', count: 40 }]);
  });

  it('an action the user may not use is disabled with the explanation', () => {
    const reverse = def({
      id: 'reverse',
      available: () => no('Reversing needs full access on transactions.'),
    });
    expect(resolveAction(reverse, ctx(rows(['posted'])))).toMatchObject({
      enabled: false,
      reason: 'Reversing needs full access on transactions.',
    });
  });

  it('says what to select when the selection does not fit', () => {
    const open = def({ id: 'open', appliesTo: 'single' });
    expect(resolveAction(open, ctx([])).reason).toBe('Select a record first.');
    expect(resolveAction(open, ctx(rows(['posted', 'posted']))).reason).toBe(
      'Select only one record for this action.',
    );
    expect(resolveAction(open, ctx(rows(['posted']))).enabled).toBe(true);
    expect(resolveAction(post, ctx([])).reason).toBe('Select one or more records first.');
  });

  it('is disabled, with the record reason, when nothing selected is eligible', () => {
    expect(resolveAction(post, ctx(rows(['posted'])))).toMatchObject({
      enabled: false,
      reason: 'Already posted.',
    });
    expect(resolveAction(post, ctx(rows(['posted', 'posted']))).reason).toBe(
      'None of the 2 selected records can be used: Already posted.',
    );
  });

  it('grid-level actions need no selection', () => {
    const refresh = def({ id: 'refresh', appliesTo: 'none' });
    expect(resolveAction(refresh, ctx([])).enabled).toBe(true);
  });

  it('every disabled action carries a reason', () => {
    const all = [
      post,
      def({ id: 'open', appliesTo: 'single' }),
      def({ id: 'denied', available: () => ({ ...ok, allowed: false }) }),
    ];
    for (const selection of [[], rows(['posted']), rows(['posted', 'unposted'])]) {
      for (const r of resolveActions(all, ctx(selection)))
        if (!r.enabled) expect(r.reason, r.def.id).toBeTruthy();
    }
  });
});

describe('layoutActions', () => {
  it('shows at most 3 actions: primary first, then destructive; the rest overflow', () => {
    const defs = [
      def({ id: 'copy' }),
      def({ id: 'delete', tier: 'destructive', consequence: 'irreversible' }),
      post,
      def({ id: 'open', tier: 'primary' }),
      def({ id: 'reverse', tier: 'destructive', consequence: 'reversibleWithAudit' }),
      def({ id: 'export', tier: 'overflow' }),
    ];
    const { visible, overflow } = layoutActions(resolveActions(defs, ctx(rows(['unposted']))));
    expect(visible.map((a) => a.def.id)).toEqual(['open', 'delete', 'transaction.post']);
    expect(overflow.map((a) => a.def.id)).toEqual(['reverse', 'copy', 'export']);
    expect(visible.length).toBeLessThanOrEqual(3);
  });

  it('nothing is lost between the two lists', () => {
    const defs = Array.from({ length: 8 }, (_, i) =>
      def({ id: `a${i}`, tier: i % 2 ? 'primary' : 'overflow' }),
    );
    const { visible, overflow } = layoutActions(resolveActions(defs, ctx(rows(['unposted']))));
    expect([...visible, ...overflow].map((a) => a.def.id).sort()).toEqual(defs.map((d) => d.id).sort());
  });
});

describe('validateRegistry', () => {
  it('accepts a complete registry', () => {
    expect(validateRegistry([post, def({ id: 'copy', shortcut: 'Mod+C' })])).toEqual([]);
  });

  it('rejects an action with no description or no explicit agentRequiresConfirmation', () => {
    const { agentRequiresConfirmation: _dropped, ...withoutFlag } = def({ id: 'a' });
    const problems = validateRegistry([def({ id: 'b', description: ' ' }), withoutFlag as ActionDef<Row>]);
    expect(problems).toEqual([
      'Action "b": needs a plain-language description (shown in the palette and used by agents).',
      'Action "a": agentRequiresConfirmation must be set explicitly.',
    ]);
  });

  it('an action with a consequence must require human confirmation for agents', () => {
    expect(validateRegistry([{ ...post, agentRequiresConfirmation: false }])).toEqual([
      'Action "transaction.post": has consequence "reversibleWithAudit", so agentRequiresConfirmation must be true.',
    ]);
  });

  it('catches duplicate ids, clashing shortcuts and destructive actions that would skip confirm', () => {
    const problems = validateRegistry([
      def({ id: 'x', shortcut: 'Mod+Shift+C' }),
      def({ id: 'x' }),
      def({ id: 'y', shortcut: 'shift+mod+c' }),
      def({ id: 'z', tier: 'destructive' }),
    ]);
    expect(problems).toEqual([
      'Action "x": the id is used twice.',
      'Action "y": shortcut shift+mod+c is already used by "x".',
      'Action "z": is destructive but declares no consequence, so it would skip the confirm step.',
    ]);
  });
});

describe('shortcuts', () => {
  const key = (
    k: string,
    mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
  ) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

  it('reads the same everywhere: Ctrl on Windows and Linux, symbols on macOS', () => {
    expect(formatShortcut('Mod+Shift+C', false)).toBe('Ctrl+Shift+C');
    expect(formatShortcut('Mod+Shift+C', true)).toBe('⌘⇧C');
    expect(formatShortcut('Enter', false)).toBe('Enter');
    expect(formatShortcut('Mod+Enter', true)).toBe('⌘↵');
  });

  it('matches exactly: modifiers must be the same', () => {
    expect(matchesShortcut(key('c', { ctrlKey: true }), 'Mod+C')).toBe(true);
    expect(matchesShortcut(key('c', { metaKey: true }), 'Mod+C')).toBe(true);
    expect(matchesShortcut(key('C', { ctrlKey: true, shiftKey: true }), 'Mod+C')).toBe(false);
    expect(matchesShortcut(key('C', { ctrlKey: true, shiftKey: true }), 'Mod+Shift+C')).toBe(true);
    expect(matchesShortcut(key('c'), 'Mod+C')).toBe(false);
    expect(matchesShortcut(key('Enter'), 'Enter')).toBe(true);
    expect(matchesShortcut(key('Enter', { ctrlKey: true }), 'Enter')).toBe(false);
    expect(matchesShortcut(key('Delete'), 'Delete')).toBe(true);
  });
});
