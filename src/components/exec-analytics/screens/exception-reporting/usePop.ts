import { useRef, useState } from "react";

/** Minimal open/anchor state for a popover or menu opened from a button. */
export function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return { open, ref, close: () => setOpen(false), toggle: () => setOpen((o) => !o) };
}
