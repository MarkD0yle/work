import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LABELS } from "./model";

const MENU_W = 176;
const MENU_MAX_H = 256;

/* AddMenu — button dropdown listing Label 1–10.
 *
 * The list renders in a portal with fixed positioning so no ancestor
 * (accordion body, modal scroll area, side-panel column) can clip it. It
 * flips upward near the bottom of the viewport, closes on Esc / click-away /
 * scroll / resize / Tab, moves focus into the list on open and back to the
 * button on close. Esc is captured first so a surrounding modal doesn't also
 * close. */
export default function AddMenu({
  onPick,
  disabled,
}: {
  onPick: (label: string) => void;
  disabled?: boolean;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function openMenu() {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8));
    const flip = window.innerHeight - r.bottom < MENU_MAX_H + 12 && r.top > MENU_MAX_H;
    setPos(
      flip
        ? { bottom: window.innerHeight - r.top + 4, left }
        : { top: r.bottom + 4, left },
    );
  }

  function close(refocus = true) {
    setPos(null);
    if (refocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>("button")?.focus();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !buttonRef.current?.contains(t)) setPos(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
        return;
      }
      if (e.key === "Tab") {
        setPos(null);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(
        listRef.current?.querySelectorAll<HTMLElement>("button") ?? [],
      );
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    }
    function onScroll(e: Event) {
      if (!listRef.current?.contains(e.target as Node)) setPos(null);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden>+</span> Add order config
        <span aria-hidden className="text-[10px] text-neutral-400">
          ▼
        </span>
      </button>
      {pos &&
        createPortal(
          <div
            ref={listRef}
            role="menu"
            style={{ ...pos, width: MENU_W, maxHeight: MENU_MAX_H }}
            className="fixed z-[60] overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {LABELS.map((label) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close(false);
                  onPick(label);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none"
              >
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
