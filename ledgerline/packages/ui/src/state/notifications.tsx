import type { Message } from '@ledgerline/contracts';
import { Bell, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/button';
import { cn } from '../lib/cn';
import { MessageText } from './message-list';
import { SEVERITY_TONE, ToneIcon } from './tone';

export interface NotificationItem {
  id: number;
  /** ISO timestamp of when it was raised. */
  at: string;
  message: Message;
  /** Where it came from, e.g. "Transactions". */
  source?: string;
}

/** Tries to move focus to a message target (a field name or row id). Returns true when it did. */
export type TargetResolver = (target: string) => boolean;

interface NotificationContextValue {
  items: NotificationItem[];
  notify: (message: Message, source?: string) => void;
  clear: () => void;
  /** Grids and forms register how to focus their own targets. Returns an unregister function. */
  registerTargetResolver: (resolver: TargetResolver) => () => void;
  focusTarget: (target: string) => boolean;
}

/** Exported for components that work with or without a provider (e.g. LLGrid in a story). */
export const NotificationContext = createContext<NotificationContextValue | null>(null);

function focusByAttribute(target: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-ll-target="${CSS.escape(target)}"]`);
  if (!el) return false;
  el.scrollIntoView?.({ block: 'nearest' });
  el.focus();
  return document.activeElement === el;
}

/**
 * Session history of every message, plus the two live regions that announce them:
 * errors assertively, everything else politely (SPEC 7.7).
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [assertive, setAssertive] = useState('');
  const [polite, setPolite] = useState('');
  const nextId = useRef(1);
  const resolvers = useRef(new Set<TargetResolver>());

  const notify = useCallback((message: Message, source?: string) => {
    const id = nextId.current++;
    setItems((prev) => [
      { id, at: new Date().toISOString(), message, ...(source ? { source } : {}) },
      ...prev,
    ]);
    const spoken = [message.text, message.fix].filter(Boolean).join(' ');
    if (message.severity === 'error') setAssertive(spoken);
    else setPolite(spoken);
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const registerTargetResolver = useCallback((resolver: TargetResolver) => {
    resolvers.current.add(resolver);
    return () => {
      resolvers.current.delete(resolver);
    };
  }, []);

  const focusTarget = useCallback((target: string) => {
    for (const resolve of resolvers.current) if (resolve(target)) return true;
    return focusByAttribute(target);
  }, []);

  const value = useMemo(
    () => ({ items, notify, clear, registerTargetResolver, focusTarget }),
    [items, notify, clear, registerTargetResolver, focusTarget],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="assertive" aria-atomic="true" data-slot="live-assertive">
        {assertive}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-slot="live-polite">
        {polite}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used inside <NotificationProvider>.');
  return value;
}

export function NotificationToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { items } = useNotifications();
  const errors = items.filter((i) => i.message.severity === 'error').length;
  return (
    <Button
      variant="ghost"
      aria-expanded={open}
      aria-controls="ll-notification-panel"
      onClick={onToggle}
      className="relative"
    >
      <Bell aria-hidden />
      <span className="sr-only">Notifications</span>
      <span
        className="tabular"
        aria-label={`${items.length} this session${errors ? `, ${errors} errors` : ''}`}
      >
        {items.length}
      </span>
    </Button>
  );
}

export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  className?: string;
}

/** Docked panel listing every message raised this session. Choosing a message jumps to its field or row. */
export function NotificationPanel({ open, onClose, className }: NotificationPanelProps) {
  const { items, clear, focusTarget } = useNotifications();
  const [notFound, setNotFound] = useState<number | null>(null);
  if (!open) return null;
  return (
    <aside
      id="ll-notification-panel"
      aria-label="Notifications"
      data-slot="notification-panel"
      className={cn('flex w-80 shrink-0 flex-col border-l bg-card', className)}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="flex-1 font-semibold">Notifications</h2>
        <Button variant="ghost" onClick={clear} disabled={items.length === 0}>
          Clear
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close notifications" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>
      {items.length === 0 ? (
        <p className="p-3 text-muted-foreground">
          No messages this session. Warnings and errors will be listed here.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {items.map((item) => {
            const target = item.message.target;
            const body = (
              <>
                <ToneIcon tone={SEVERITY_TONE[item.message.severity]} className="mt-0.5" />
                <span className="flex min-w-0 flex-col text-left">
                  <MessageText message={item.message} />
                  <span className="text-2xs text-muted-foreground">
                    {item.at.slice(11, 16)} UTC{item.source ? ` · ${item.source}` : ''}
                    {target ? ` · ${target}` : ''}
                  </span>
                  {notFound === item.id ? (
                    <span className="text-2xs text-warning">That record is not on screen any more.</span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={item.id} className="border-b">
                {target ? (
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 hover:bg-accent"
                    onClick={() => setNotFound(focusTarget(target) ? null : item.id)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start gap-2 px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
