import { useId, useState, type ReactNode } from "react";

/* AccordionCard — bordered card with a full-width header toggle. Modelled on
 * TriageBlock in pages/heatmap.tsx. Uncontrolled by default; pass `open` +
 * `onToggle` to control it. */
export default function AccordionCard({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className="overflow-clip rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-inset"
      >
        <span className="text-xs font-semibold tracking-widest text-neutral-700 uppercase">
          {title}
        </span>
        <span className="text-xs font-medium text-neutral-400">({count})</span>
        <span aria-hidden className="ml-auto text-xs text-neutral-400">
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <div id={bodyId} className="border-t border-neutral-100 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}
