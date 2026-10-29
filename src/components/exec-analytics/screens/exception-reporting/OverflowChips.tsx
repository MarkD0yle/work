import { useRef, useState } from "react";
import { Chip, Popover } from "../../ui";

/** Shows up to `max` chips; a "+N" chip opens a popover listing every item. */
export function OverflowChips({ items, max = 2, label }: { items: string[]; max?: number; label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const extra = items.length - max;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 0 }}>
      {items.slice(0, max).map((c) => <Chip key={c} title={c}>{c}</Chip>)}
      {extra > 0 && (
        <>
          <button ref={ref} type="button" className="ea-chip" aria-haspopup="dialog" aria-expanded={open} aria-label={`${extra} more ${label}`} onClick={() => setOpen((o) => !o)}>+{extra}</button>
          <Popover open={open} onClose={() => setOpen(false)} anchor={ref} pad label={`All ${label}`}>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </Popover>
        </>
      )}
    </div>
  );
}
