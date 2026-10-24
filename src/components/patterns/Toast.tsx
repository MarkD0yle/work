import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { button, cx, radius, tone as toneTokens } from "./tokens";
import { ToastContext, type ToastApi, type ToastOptions } from "./useToast";

/* Toast — confirms an action that already happened, and offers to undo it.
 *
 * "2 orders cancelled · Undo". Bottom right, three at most (the oldest goes
 * first), gone after 6 seconds. The timer pauses while the pointer or focus is
 * on a toast, so Undo can always be reached. Use for things the user did
 * themselves; use Banner for things that happened *to* the screen.
 *
 * Don't use a toast for an error the user must act on, or for anything they
 * need to read twice: it will be gone. Failures use tone "negative", which
 * stays until dismissed and is announced immediately; everything else is
 * announced politely. Mount ToastProvider once per screen. */

const MAX_VISIBLE = 3;
const DEFAULT_MS = 6000;

type Item = ToastOptions & { id: string };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setItems((list) => [...list, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);
  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="region" aria-label="Notifications" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onDismiss }: { item: Item; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const tone = item.tone ?? "neutral";
  const failure = tone === "negative" || tone === "critical";
  // Failures stay until dismissed, whatever duration was asked for.
  const ms = failure ? 0 : (item.duration ?? DEFAULT_MS);

  useEffect(() => {
    if (ms === 0 || paused) return;
    const timer = setTimeout(() => onDismiss(item.id), ms);
    return () => clearTimeout(timer);
  }, [ms, paused, item.id, onDismiss]);

  return (
    <div
      role={failure ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cx("pointer-events-auto flex items-start gap-3 border bg-white p-3 shadow-lg", radius.container, "border-l-4 border-neutral-200", toneTokens[tone].rail)}
    >
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-semibold text-neutral-900">{item.title}</div>
        {item.description && <div className="mt-0.5 text-neutral-600">{item.description}</div>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className={button.secondary}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={() => onDismiss(item.id)} aria-label="Dismiss notification" className={cx(button.ghost, "px-1.5")}>
        ✕
      </button>
    </div>
  );
}
