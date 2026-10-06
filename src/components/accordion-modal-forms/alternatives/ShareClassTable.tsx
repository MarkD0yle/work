import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Chip, PlusIcon } from "../kit";
import { btnGhost, btnPrimary } from "../styles";
import { CLASS_LABELS, SECTIONS, completeCount, sectionSummary, type SectionKey, type ShareClass } from "./share-class";

/* ShareClassTable — the section's table. Column headers always render; the
 * body shows an empty-state row until the first class is saved. One column
 * per form section summarises its five answers: chips for every Yes, and a
 * count of what is still unanswered or blank. A row in `editingId` is tinted
 * and (optionally) followed by an editor row supplied by `renderEditor` —
 * that is how the inline alternative keeps the editor in the table.
 * `highlightId` flashes a row that was just saved. */

export function ShareClassTable({
  rows,
  editingId,
  highlightId,
  lockWhileEditing = false,
  compact = false,
  onEdit,
  onRemove,
  renderEditor,
}: {
  rows: ShareClass[];
  editingId?: string | null;
  highlightId?: string | null;
  /** Disable other rows' actions while one row is being edited. */
  lockWhileEditing?: boolean;
  /** Counts only, no chips (e.g. while a side panel takes the width). */
  compact?: boolean;
  onEdit: (row: ShareClass) => void;
  onRemove: (row: ShareClass) => void;
  renderEditor?: (row: ShareClass) => ReactNode;
}) {
  const colCount = SECTIONS.length + 3;
  const thClass = "px-3 py-2 text-left text-[10px] font-semibold tracking-widest text-neutral-500 uppercase whitespace-nowrap";
  const tdClass = "px-3 py-2.5 align-top text-xs text-neutral-700";

  return (
    <div className="overflow-x-auto border border-neutral-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr>
            <th scope="col" className={thClass}>
              Class
            </th>
            {SECTIONS.map((s) => (
              <th key={s.id} scope="col" className={thClass}>
                {s.label}
              </th>
            ))}
            <th scope="col" className={thClass}>
              Status
            </th>
            <th scope="col" className={thClass} />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={colCount} className="px-4 py-8 text-center text-xs text-neutral-500">
                No share classes yet. Use <span className="font-medium text-neutral-800">Add share class</span> to
                create the first one.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const editing = r.id === editingId;
            const locked = lockWhileEditing && editingId != null && !editing;
            const done = completeCount(r);
            const hint = CLASS_LABELS.find((l) => l.label === r.label)?.hint;
            return (
              <Fragment key={r.id}>
                <tr
                  className={`transition-colors duration-700 ${
                    editing ? "bg-sky-50/70" : r.id === highlightId ? "bg-emerald-50" : "bg-white"
                  }`}
                >
                  <td className={tdClass}>
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={`mt-1 h-2 w-2 shrink-0 ${editing ? "bg-sky-500" : "bg-neutral-900"}`}
                      />
                      <div className="min-w-0">
                        <div className="font-medium whitespace-nowrap text-neutral-900">{r.label}</div>
                        {hint && <div className="mt-0.5 text-[11px] text-neutral-500">{hint}</div>}
                      </div>
                    </div>
                  </td>
                  {SECTIONS.map((s) => (
                    <td key={s.id} className={tdClass}>
                      <SectionCell row={r} section={s.id} compact={compact} />
                    </td>
                  ))}
                  <td className={tdClass}>
                    {editing ? (
                      <Chip tone="info">Editing</Chip>
                    ) : done === SECTIONS.length ? (
                      <Chip tone="good">Complete</Chip>
                    ) : (
                      <Chip tone="warn">
                        {done}/{SECTIONS.length} sections
                      </Chip>
                    )}
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    {!editing && (
                      <div className="-my-1 inline-flex items-center">
                        <button type="button" onClick={() => onEdit(r)} disabled={locked} className={`${btnGhost} disabled:opacity-40`}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(r)}
                          disabled={locked}
                          className={`${btnGhost} hover:bg-red-50 hover:text-red-700 disabled:opacity-40`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {editing && renderEditor && (
                  <tr>
                    <td colSpan={colCount} className="p-0">
                      {renderEditor(r)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* One section's five answers in a cell: a chip per Yes, then what is left. */
function SectionCell({ row, section, compact }: { row: ShareClass; section: SectionKey; compact: boolean }) {
  const s = sectionSummary(row, section);
  if (s.answered === 0) return <span className="text-neutral-300">—</span>;
  const gaps = [
    s.answered < s.total ? `${s.total - s.answered} unanswered` : "",
    s.missing ? `${s.missing} input${s.missing === 1 ? "" : "s"} blank` : "",
    s.invalid ? `${s.invalid} invalid` : "",
  ].filter(Boolean);
  return (
    <div className="min-w-0" style={{ minWidth: compact ? 0 : 150 }}>
      {!compact &&
        (s.yes.length ? (
          <div className="flex flex-wrap gap-1">
            {s.yes.map((q) => (
              <Chip key={q.key} tone="info">
                {q.short}
              </Chip>
            ))}
          </div>
        ) : (
          <span className="text-neutral-500">All no</span>
        ))}
      <div className={`text-[11px] tabular-nums ${compact ? "" : "mt-1"} ${gaps.length ? "text-amber-700" : "text-neutral-400"}`}>
        {compact && `${s.yes.length} yes · `}
        {gaps.length ? gaps.join(" · ") : `${s.answered}/${s.total} answered`}
      </div>
    </div>
  );
}

/* AddMenu — the "Add share class ▾" button dropdown listing the ten labels.
 * Labels already in the table are shown but disabled, so the menu doubles as
 * a progress view of which classes remain. */
export function AddMenu({
  added,
  onPick,
  disabled,
  disabledHint,
}: {
  added: Set<string>;
  onPick: (label: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => firstItem.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const remaining = CLASS_LABELS.filter((l) => !added.has(l.label)).length;
  // First still-available label takes initial focus when the menu opens.
  const firstAvailable = CLASS_LABELS.find((l) => !added.has(l.label))?.label;

  return (
    <div ref={ref} className="relative inline-flex items-center gap-3">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || remaining === 0}
        onClick={() => setOpen((v) => !v)}
        className={btnPrimary}
      >
        <PlusIcon /> Add share class
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span className="text-[11px] text-neutral-500">
        {disabled && disabledHint ? disabledHint : `${remaining} of ${CLASS_LABELS.length} available`}
      </span>

      {open && (
        <div
          role="menu"
          aria-label="Share class to add"
          className="absolute top-full left-0 z-30 mt-1 w-72 border border-neutral-300 bg-white shadow-xl"
        >
          <div className="border-b border-neutral-200 px-3 py-2 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Choose a class
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {CLASS_LABELS.map((l) => {
              const isAdded = added.has(l.label);
              return (
                <li key={l.label}>
                  <button
                    ref={l.label === firstAvailable ? firstItem : undefined}
                    type="button"
                    role="menuitem"
                    disabled={isAdded}
                    onClick={() => {
                      setOpen(false);
                      onPick(l.label);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:cursor-default disabled:hover:bg-white"
                  >
                    <span className={`min-w-0 flex-1 ${isAdded ? "opacity-40" : ""}`}>
                      <span className="block text-sm font-medium text-neutral-900">{l.label}</span>
                      <span className="block text-[11px] text-neutral-500">{l.hint}</span>
                    </span>
                    {isAdded && (
                      <span className="text-[10px] font-semibold tracking-widest text-emerald-700 uppercase">Added</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
