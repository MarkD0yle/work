import { useCallback, useState } from "react";

/* usePanelStack — the path a user has drilled through inside one panel.
 *
 * Order → counterparty → credit line. Each push adds a level; Back removes
 * one; jumping to a breadcrumb cuts the stack there. An empty stack means the
 * panel is closed. Pair with PanelTrail for the header. */

export type StackItem = { id: string; title: string };

export function usePanelStack<T extends StackItem>() {
  const [stack, setStack] = useState<T[]>([]);

  /** Start a new path. Use for a click in the main list. */
  const open = useCallback((root: T) => setStack([root]), []);
  /** Go one level deeper. Opening what is already on top does nothing. */
  const push = useCallback((item: T) => setStack((s) => (s[s.length - 1]?.id === item.id ? s : [...s, item])), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  /** Cut the stack back to `index` (0 = root). */
  const jump = useCallback((index: number) => setStack((s) => s.slice(0, index + 1)), []);
  const close = useCallback(() => setStack([]), []);

  return { stack, current: stack[stack.length - 1] ?? null, open, push, pop, jump, close };
}
