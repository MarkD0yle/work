import { useEffect, useRef, useState } from "react";

/* Spec §2.1 — reusable multi-select dropdown.
 *
 * Closed: just the label, with a count badge when selections are active.
 * Open: search + checkbox list + Apply / Select all / Clear.
 *
 * Hard rule (spec §8.33): does NOT filter live as the user clicks
 * checkboxes. Selection is staged in a local draft state; Apply commits
 * it back to the parent's filter state, which is what triggers the data
 * reflow. */

export default function PipelineFilterDropdown({
  label,
  options,
  selected,
  onApply,
  showSearch = true,
}: {
  label: string;
  options: string[];
  selected: string[];
  onApply: (next: string[]) => void;
  showSearch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset draft to current selection whenever the dropdown opens. Closing
  // without Apply throws away the draft (spec §3.1 — apply on user action).
  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQuery("");
    }
  }, [open, selected]);

  // Click-outside close (discards draft).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filteredOptions = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const count = selected.length;
  const active = count > 0;

  function toggle(value: string) {
    setDraft((d) =>
      d.includes(value) ? d.filter((x) => x !== value) : [...d, value],
    );
  }

  function selectAll() {
    setDraft(filteredOptions.slice());
  }
  function clearDraft() {
    setDraft([]);
  }
  function apply() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
          active
            ? "border-neutral-400 bg-white font-semibold text-neutral-900"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        {active && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
        <span aria-hidden className="text-[9px] text-neutral-400">▼</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 w-64 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          {showSearch && options.length > 5 && (
            <div className="border-b border-neutral-100 p-2">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-400">
                No matches
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = draft.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt)}
                      className="h-3.5 w-3.5 rounded border-neutral-300"
                    />
                    <span className="truncate text-neutral-700">{opt}</span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-neutral-100 bg-neutral-50/60 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="text-neutral-600 hover:text-neutral-900"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="text-neutral-600 hover:text-neutral-900"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              className="ml-auto rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
