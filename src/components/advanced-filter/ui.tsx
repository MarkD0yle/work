import { useEffect, useRef, type ReactNode } from "react";
import { cx, focus } from "../patterns/tokens";
import { CATEGORIES, FIELDS, type Field, type FieldKey, type FieldKind } from "./model";

/* Small shared parts for the filter bar, the condition editor and the panel. */

const KIND_GLYPH: Record<FieldKind, string> = { text: "Aa", number: "#", date: "▦", set: "≡", boolean: "◐" };
const KIND_NAME: Record<FieldKind, string> = { text: "Text", number: "Number", date: "Date", set: "List", boolean: "Yes / no" };

export function KindGlyph({ kind }: { kind: FieldKind }) {
  return (
    <span
      aria-hidden
      title={KIND_NAME[kind]}
      className="inline-flex h-4 w-5 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 font-mono text-[9px] font-semibold text-neutral-500"
    >
      {KIND_GLYPH[kind]}
    </span>
  );
}

export function Icon({ d, label, size = 14 }: { d: string; label: string; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" aria-label={label || undefined} aria-hidden={!label} role={label ? "img" : undefined}>
      <path d={d} strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  );
}

/** Anchored popover: place inside a `relative` wrapper. Closes on outside click or Escape. */
export function Popover({
  open,
  onClose,
  children,
  align = "left",
  width = 300,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const host = ref.current?.parentElement;
      if (host && !host.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      data-popover-open
      style={{ width }}
      className={cx("absolute top-full z-40 mt-1 border border-neutral-300 bg-white shadow-lg", align === "right" ? "right-0" : "left-0")}
    >
      {children}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, autoFocus = true }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 px-2.5 py-2 text-neutral-400">
      <Icon d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM11 11l3 3" label="" />
      <input
        autoFocus={autoFocus}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}

function matchesQuery(f: Field, q: string) {
  const s = q.trim().toLowerCase();
  return !s || f.label.toLowerCase().includes(s) || f.category.toLowerCase().includes(s) || KIND_NAME[f.kind].toLowerCase().includes(s);
}

/** The criteria catalogue, grouped by category. */
export function FieldList({ onPick, selected, query }: { onPick: (k: FieldKey) => void; selected?: FieldKey; query: string }) {
  const groups = CATEGORIES.map((cat) => ({ cat, fields: FIELDS.filter((f) => f.category === cat && matchesQuery(f, query)) })).filter((g) => g.fields.length > 0);
  if (groups.length === 0) return <div className="px-3 py-4 text-center text-xs text-neutral-500">No criteria match “{query}”.</div>;
  return (
    <div className="py-1">
      {groups.map(({ cat, fields }) => (
        <div key={cat} className="py-1">
          <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{cat}</div>
          {fields.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onPick(f.key)}
              className={cx(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-50",
                selected === f.key ? "bg-neutral-100 font-semibold text-neutral-900" : "text-neutral-700",
                focus,
              )}
            >
              <KindGlyph kind={f.kind} />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              {f.hint && <span className="truncate text-[10px] text-neutral-400">{f.hint}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** ALL / ANY switch for a group's join. */
export function JoinToggle({ join, onChange }: { join: "AND" | "OR"; onChange: (j: "AND" | "OR") => void }) {
  return (
    <div role="radiogroup" aria-label="Match" className="inline-flex border border-neutral-300 bg-white">
      {(["AND", "OR"] as const).map((j) => (
        <button
          key={j}
          type="button"
          role="radio"
          aria-checked={join === j}
          onClick={() => onChange(j)}
          title={j === "AND" ? "Every condition must match" : "Any condition can match"}
          className={cx(
            "px-2 py-0.5 text-[10px] font-semibold tracking-wide",
            join === j ? (j === "AND" ? "bg-sky-700 text-white" : "bg-violet-700 text-white") : "text-neutral-600 hover:bg-neutral-100",
            focus,
          )}
        >
          {j === "AND" ? "ALL" : "ANY"}
        </button>
      ))}
    </div>
  );
}

/** The AND / OR word between siblings; clicking it switches the group's join. */
export function JoinWord({ join, onToggle, className }: { join: "AND" | "OR"; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Switch to ${join === "AND" ? "OR" : "AND"}`}
      className={cx(
        "border px-1 py-px text-[9px] font-bold tracking-wider",
        join === "AND" ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" : "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
        focus,
        className,
      )}
    >
      {join}
    </button>
  );
}
