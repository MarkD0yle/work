/**
 * The action registry (SPEC 7.8). One `ActionDef[]` per grid or record feeds the toolbar, the selection bar,
 * the context menu, the command palette and, later, an assistant. Everything here is pure logic, so every
 * surface shows the same label, shortcut, availability and reason.
 */
import type { ActionContext, ActionDef, Permission } from '@ledgerline/contracts';

export interface ResolvedAction<Row> {
  def: ActionDef<Row>;
  /** False when the action cannot run now. It still shows, disabled, with `reason`. */
  enabled: boolean;
  /** Why it is unavailable. Always set when `enabled` is false: disabled actions explain why. */
  reason?: string;
  /** Records the action would run on. */
  eligible: Row[];
  /** Selected records it would skip, each with the reason. Never dropped silently. */
  ineligible: { row: Row; reason: string }[];
}

const SELECTION_REASON = {
  single: (n: number) => (n === 0 ? 'Select a record first.' : 'Select only one record for this action.'),
  multi: () => 'Select one or more records first.',
} as const;

/** Works out whether an action can run in this context, on which records, and if not, why. */
export function resolveAction<Row>(def: ActionDef<Row>, ctx: ActionContext<Row>): ResolvedAction<Row> {
  const n = ctx.selection.length;
  const off = (reason: string): ResolvedAction<Row> => ({
    def,
    enabled: false,
    reason,
    eligible: [],
    ineligible: [],
  });

  if (def.appliesTo === 'single' && n !== 1) return off(SELECTION_REASON.single(n));
  if (def.appliesTo === 'multi' && n === 0) return off(SELECTION_REASON.multi());

  const permission: Permission = def.available(ctx);
  if (!permission.allowed) return off(permission.explanation ?? 'You are not allowed to do this.');

  if (def.appliesTo === 'none' || !def.eligibility)
    return { def, enabled: true, eligible: ctx.selection, ineligible: [] };

  const eligible: Row[] = [];
  const ineligible: ResolvedAction<Row>['ineligible'] = [];
  for (const row of ctx.selection) {
    const p = def.eligibility(row);
    if (p.allowed) eligible.push(row);
    else ineligible.push({ row, reason: p.explanation ?? 'Not eligible.' });
  }
  if (n > 0 && eligible.length === 0) {
    const reasons = [...new Set(ineligible.map((i) => i.reason))];
    return {
      def,
      enabled: false,
      reason:
        n === 1
          ? (reasons[0] as string)
          : `None of the ${n} selected records can be used: ${reasons.join(' ')}`,
      eligible,
      ineligible,
    };
  }
  return { def, enabled: true, eligible, ineligible };
}

export const resolveActions = <Row>(defs: ActionDef<Row>[], ctx: ActionContext<Row>): ResolvedAction<Row>[] =>
  defs.map((def) => resolveAction(def, ctx));

/** Ineligible records grouped by reason, largest group first, for the confirm step. */
export function groupIneligible<Row>(
  ineligible: ResolvedAction<Row>['ineligible'],
): { reason: string; count: number }[] {
  const groups = new Map<string, number>();
  for (const { reason } of ineligible) groups.set(reason, (groups.get(reason) ?? 0) + 1);
  return [...groups].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

const TIER_ORDER = { primary: 0, destructive: 1, secondary: 2, overflow: 3 } as const;

/**
 * Splits actions into the few shown as buttons and the rest in the overflow menu.
 * At most `max` (3) are visible: primary actions first, then destructive ones; everything else overflows.
 */
export function layoutActions<Row>(
  actions: ResolvedAction<Row>[],
  max = 3,
): { visible: ResolvedAction<Row>[]; overflow: ResolvedAction<Row>[] } {
  const candidates = actions
    .filter((a) => a.def.tier === 'primary' || a.def.tier === 'destructive')
    .sort((a, b) => TIER_ORDER[a.def.tier] - TIER_ORDER[b.def.tier]);
  const visible = candidates.slice(0, max);
  const shown = new Set(visible.map((a) => a.def.id));
  return {
    visible,
    overflow: actions
      .filter((a) => !shown.has(a.def.id))
      .sort((a, b) => TIER_ORDER[a.def.tier] - TIER_ORDER[b.def.tier]),
  };
}

/**
 * Checks a registry before it ships. Returns a list of problems; empty means valid.
 * Used by unit tests so an action can never reach users (or an assistant) half-described.
 */
export function validateRegistry(defs: ActionDef<never>[] | ActionDef<unknown>[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const shortcuts = new Map<string, string>();
  for (const def of defs as ActionDef<unknown>[]) {
    const at = `Action "${def.id}"`;
    if (ids.has(def.id)) problems.push(`${at}: the id is used twice.`);
    ids.add(def.id);
    if (!def.label?.trim()) problems.push(`${at}: needs a label.`);
    if (!def.description?.trim())
      problems.push(`${at}: needs a plain-language description (shown in the palette and used by agents).`);
    if (typeof def.agentRequiresConfirmation !== 'boolean')
      problems.push(`${at}: agentRequiresConfirmation must be set explicitly.`);
    // SPEC §14: an agent needs human confirmation for anything with a consequence.
    if (def.consequence !== 'none' && def.agentRequiresConfirmation === false)
      problems.push(
        `${at}: has consequence "${def.consequence}", so agentRequiresConfirmation must be true.`,
      );
    if (def.tier === 'destructive' && def.consequence === 'none')
      problems.push(`${at}: is destructive but declares no consequence, so it would skip the confirm step.`);
    if (def.shortcut) {
      const key = normaliseShortcut(def.shortcut);
      const clash = shortcuts.get(key);
      if (clash) problems.push(`${at}: shortcut ${def.shortcut} is already used by "${clash}".`);
      shortcuts.set(key, def.id);
    }
  }
  return problems;
}

// ── Shortcuts ──────────────────────────────────────────────
// Written as "Mod+Shift+C", "Enter", "Delete". "Mod" is Ctrl on Windows and Linux, Cmd on macOS.

const normaliseShortcut = (shortcut: string): string =>
  shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .sort()
    .join('+');

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform ?? '');

/** How a shortcut reads to the user: "Ctrl+Shift+C" or "⌘⇧C". The same text is used on every surface. */
export function formatShortcut(shortcut: string, mac = isMac()): string {
  const parts = shortcut.split('+').map((p) => p.trim());
  if (!mac) return parts.map((p) => (p === 'Mod' ? 'Ctrl' : p)).join('+');
  const symbols: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Enter: '↵', Delete: '⌫' };
  return parts.map((p) => symbols[p] ?? p).join('');
}

export function matchesShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  shortcut: string,
): boolean {
  const parts = shortcut.split('+').map((p) => p.trim().toLowerCase());
  const key = parts.find((p) => !['mod', 'shift', 'alt'].includes(p));
  if (!key) return false;
  const mod = event.ctrlKey || event.metaKey;
  return (
    event.key.toLowerCase() === key &&
    mod === parts.includes('mod') &&
    event.shiftKey === parts.includes('shift') &&
    event.altKey === parts.includes('alt')
  );
}
