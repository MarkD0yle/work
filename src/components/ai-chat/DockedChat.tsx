import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { PanelRightClose, Sparkles, X } from "lucide-react";
import type { OpenArtifact } from "./blocks";
import { WidgetHeader } from "./FloatingChat";
import { Composer, ThreadView } from "./Thread";
import type { Chat } from "./useChat";

/* Docked assistant: a side pane that pushes the page over instead of
 * covering it (Copilot in Edge / Office, Claude in Chrome).
 *
 * Floating suits a quick question; docked suits working alongside a dense
 * screen — a blotter, a risk grid — where a window over the right-hand
 * columns would hide exactly what the user is asking about. So the page
 * reflows to make room, and the user sets the width by dragging the left
 * edge (or with arrow keys on it). Width is clamped so neither side becomes
 * unusable.
 *
 * Closing leaves a slim strip on the right edge rather than nothing, so the
 * pane is always one click away and the page doesn't jump by the full width.
 *
 * Below `lg` there is no room to share, so the pane overlays the page at
 * full width and closing falls back to a corner button.
 */

export const DOCK_MIN = 320;
export const DOCK_MAX = 640;
const STEP = 16;

const clamp = (w: number) => Math.min(DOCK_MAX, Math.max(DOCK_MIN, Math.round(w)));

export function DockedPane({
  chat,
  width,
  onWidth,
  onClose,
  onExpand,
  onContext,
  onOpen,
  onSources,
}: {
  chat: Chat;
  width: number;
  onWidth: (w: number) => void;
  onClose: () => void;
  onExpand: () => void;
  onContext: () => void;
  onOpen: OpenArtifact;
  onSources: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The pane grows leftwards, so dragging left (negative dx) widens it.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) onWidth(clamp(drag.current.w - (e.clientX - drag.current.x)));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === "ArrowLeft" ? width + STEP : e.key === "ArrowRight" ? width - STEP : e.key === "Home" ? DOCK_MAX : e.key === "End" ? DOCK_MIN : null;
    if (next === null) return;
    e.preventDefault();
    onWidth(clamp(next));
  };

  return (
    <aside
      aria-label="Assistant"
      style={{ "--dock-w": `${width}px` } as React.CSSProperties}
      className="fixed inset-0 z-[60] flex flex-col bg-white lg:relative lg:inset-auto lg:z-auto lg:h-full lg:w-[var(--dock-w)] lg:shrink-0 lg:border-l lg:border-neutral-200"
    >
      {/* Resize handle: a 6px hit area over the border, with a visible grip on hover/focus. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize assistant"
        aria-valuemin={DOCK_MIN}
        aria-valuemax={DOCK_MAX}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKey}
        className="group absolute inset-y-0 -left-[3px] z-10 hidden w-[6px] cursor-col-resize touch-none focus-visible:outline-none lg:block"
      >
        <span className="absolute inset-y-0 left-[2px] w-[2px] bg-transparent transition-colors group-hover:bg-neutral-900 group-focus-visible:bg-neutral-900" />
      </div>

      <WidgetHeader
        chat={chat}
        onExpand={onExpand}
        closeLabel="Close assistant"
        closeIcon={
          <>
            <PanelRightClose size={16} className="hidden lg:block" />
            <X size={16} className="lg:hidden" />
          </>
        }
        onClose={onClose}
      />
      <ThreadView chat={chat} compact onOpen={onOpen} onSources={onSources} />
      <Composer chat={chat} inputRef={inputRef} compact onContext={onContext} />
    </aside>
  );
}

/* Collapsed state: a 44px strip on desktop, a corner button on small screens. */
export function DockRail({ onOpen, busy }: { onOpen: () => void; busy: boolean }) {
  const dot = busy && <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse bg-emerald-400" aria-hidden />;
  return (
    <>
      <div className="hidden h-full w-11 shrink-0 flex-col items-center border-l border-neutral-200 bg-white pt-3 lg:flex">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open assistant"
          title="Open assistant"
          className="flex flex-col items-center gap-3 px-2 py-3 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          <span className="relative grid h-7 w-7 place-items-center bg-neutral-900 text-white">
            <Sparkles size={14} />
            {dot}
          </span>
          <span className="text-[12px] font-medium [writing-mode:vertical-rl]">Assistant</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open assistant"
        className="fixed right-6 bottom-6 z-[60] grid h-14 w-14 place-items-center bg-neutral-900 text-white shadow-lg shadow-neutral-900/25 lg:hidden"
      >
        <span className="relative">
          <Sparkles size={18} />
          {dot}
        </span>
      </button>
    </>
  );
}
