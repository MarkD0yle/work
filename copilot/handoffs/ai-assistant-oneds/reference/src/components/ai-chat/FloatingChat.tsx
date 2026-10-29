import { useEffect, useRef, type ReactNode } from "react";
import { Maximize2, Minus, SquarePen, Sparkles, X } from "lucide-react";
import { IconButton, type OpenArtifact } from "./blocks";
import { Composer, ThreadView } from "./Thread";
import type { Chat } from "./useChat";

/* Floating assistant: a launcher button that opens a docked chat window over
 * whatever page the user is on.
 *
 * The rule that keeps it small: the widget holds the conversation only.
 * Anything that needs the side panel — opening a chart large, checking
 * sources, changing data sources — expands to full screen with that panel
 * already open, rather than squeezing a second panel into 400px. Same thread,
 * same state; only the frame changes.
 *
 * Desktop: 420px window anchored bottom-right. Phone: takes the whole screen,
 * because a floating card on a 390px screen is just a worse full screen.
 * Escape minimises back to the launcher and returns focus to it.
 */

export function FloatingLauncher({ onOpen, busy, focusOnMount }: { onOpen: () => void; busy: boolean; focusOnMount: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label="Open assistant"
      className="fixed right-6 bottom-6 z-[60] flex h-14 items-center gap-2.5 bg-neutral-900 pr-5 pl-4 text-[14px] font-medium text-white shadow-lg shadow-neutral-900/25 transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      <span className="relative">
        <Sparkles size={18} />
        {/* An answer is still streaming while minimised — show it is alive. */}
        {busy && <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse bg-emerald-400" aria-hidden />}
      </span>
      Ask Assistant
    </button>
  );
}

export function FloatingWindow({
  chat,
  onMinimise,
  onExpand,
  onContext,
  onOpen,
  onSources,
}: {
  chat: Chat;
  onMinimise: () => void;
  onExpand: () => void;
  onContext: () => void;
  onOpen: OpenArtifact;
  onSources: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus the input once on open — not on every render, or it would steal
  // focus from buttons inside the thread.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMinimise();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMinimise]);

  return (
    <div
      role="dialog"
      aria-label="Assistant"
      className="ai-float-in fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(680px,calc(100vh-48px))] sm:w-[420px] sm:border sm:border-neutral-200 sm:shadow-2xl sm:shadow-neutral-900/20"
    >
      <WidgetHeader
        chat={chat}
        onExpand={onExpand}
        closeLabel="Minimise"
        closeIcon={
          <>
            <Minus size={16} className="hidden sm:block" />
            <X size={16} className="sm:hidden" />
          </>
        }
        onClose={onMinimise}
      />

      <ThreadView chat={chat} compact onOpen={onOpen} onSources={onSources} />
      <Composer chat={chat} inputRef={inputRef} compact onContext={onContext} />
    </div>
  );
}

/* Header shared by the floating window and the docked pane: what this chat is
 * about, then New chat · Expand · close. Same order in both, so muscle memory
 * carries over when the user switches layout. */
export function WidgetHeader({
  chat,
  onExpand,
  closeLabel,
  closeIcon,
  onClose,
}: {
  chat: Chat;
  onExpand: () => void;
  closeLabel: string;
  closeIcon: ReactNode;
  onClose: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 pr-2 pl-4">
      <div className="grid h-7 w-7 shrink-0 place-items-center bg-neutral-900 text-white" aria-hidden>
        <Sparkles size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-neutral-900">{chat.messages.length ? chat.title : "Assistant"}</div>
        <div className="flex items-center gap-1.5 truncate text-[11px] text-neutral-500">
          <span className="h-1.5 w-1.5 shrink-0 bg-emerald-500" aria-hidden />
          {chat.scope.name}
        </div>
      </div>
      <IconButton label="New chat" onClick={chat.reset}>
        <SquarePen size={15} />
      </IconButton>
      <IconButton label="Expand to full screen" onClick={onExpand}>
        <Maximize2 size={15} />
      </IconButton>
      <IconButton label={closeLabel} onClick={onClose}>
        {closeIcon}
      </IconButton>
    </header>
  );
}
