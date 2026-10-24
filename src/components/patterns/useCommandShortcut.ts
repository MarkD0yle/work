import { useEffect } from "react";

/* useCommandShortcut — binds ⌘K / Ctrl+K to open the palette.
 *
 * Call it once, in the component that owns the palette's `open` state. It is
 * removed on unmount, so a screen that doesn't mount it doesn't claim the key.
 * The browser's own ⌘K (focus the address bar) is overridden only while the
 * palette is available. */

export function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
