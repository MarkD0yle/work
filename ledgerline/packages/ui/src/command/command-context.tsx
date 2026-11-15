import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type CommandGroup = 'Actions' | 'Views' | 'Navigation' | 'Workspaces' | 'Entities';

export interface CommandItem {
  id: string;
  group: CommandGroup;
  label: string;
  /** Plain-language description or extra detail, shown under the label. */
  hint?: string;
  /** Already formatted for display, e.g. "Ctrl+Enter" or "g t". */
  shortcut?: string;
  /** When set, the command is listed but cannot run, and this says why. */
  disabledReason?: string;
  /** Extra words to match on. */
  keywords?: string;
  run: () => void;
}

export interface ShortcutEntry {
  keys: string;
  what: string;
}

interface CommandContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  /** Screens register what they offer right now; the palette asks each source when it opens. */
  registerSource: (id: string, getItems: () => CommandItem[]) => () => void;
  collect: () => CommandItem[];
}

export const CommandContext = createContext<CommandContextValue | null>(null);

/** True when the user is typing somewhere, so single-key shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
  );
}

/**
 * Holds the command palette (Ctrl/Cmd+K) and the shortcut sheet (?) for the whole app.
 * The palette is the replacement for ribbon hunting: navigation, views, entities and every action
 * available in the current context, in one searchable list (SPEC 6).
 */
export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sources = useRef(new Map<string, () => CommandItem[]>());

  const registerSource = useCallback((id: string, getItems: () => CommandItem[]) => {
    sources.current.set(id, getItems);
    return () => {
      if (sources.current.get(id) === getItems) sources.current.delete(id);
    };
  }, []);
  const collect = useCallback(() => [...sources.current.values()].flatMap((get) => get()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSheetOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, sheetOpen, setSheetOpen, registerSource, collect }),
    [open, sheetOpen, registerSource, collect],
  );
  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommands(): CommandContextValue {
  const value = useContext(CommandContext);
  if (!value) throw new Error('useCommands must be used inside <CommandProvider>.');
  return value;
}

/**
 * Registers the commands a screen offers. `getItems` is called when the palette opens, so it always
 * reflects the current selection and state. Does nothing outside a CommandProvider (stories, tests).
 */
export function useCommandSource(id: string, getItems: () => CommandItem[]): void {
  const context = useContext(CommandContext);
  const latest = useRef(getItems);
  useEffect(() => {
    latest.current = getItems;
  }, [getItems]);
  const register = context?.registerSource;
  useEffect(() => register?.(id, () => latest.current()), [register, id]);
}
