import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx, radius, text } from "./tokens";

/* CommandPalette — type to jump or act, from anywhere.
 *
 * ⌘/Ctrl + K opens a search over screens and actions ("Open blotter",
 * "New order", "Export view"). It replaces hunting through a 90-item sidebar
 * and puts shortcuts where people can find them. Filtering is by words, in any
 * order: "ord new" finds "New order". ↑ ↓ move, Enter runs, Esc closes.
 *
 * A palette runs things; it does not hold forms. If an action needs input,
 * run it to open a panel or dialog. Every command must also exist somewhere
 * in the normal UI: the palette is a shortcut, never the only way.
 *
 * Shown above everything (like Modal) but top-aligned, so the list can grow
 * downwards without moving the input. Bind the key with useCommandShortcut. */

export type Command = {
  id: string;
  label: string;
  /** Section heading: "Go to", "Actions". */
  group: string;
  /** Extra words that should find it. */
  keywords?: string;
  /** Shown right-aligned, e.g. "G B". */
  shortcut?: string;
  onRun: () => void;
};

function matches(c: Command, query: string) {
  const hay = `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = "Search screens and actions",
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
}) {
  // Mount fresh each time it opens, so the query and highlight start clean.
  return open ? <PaletteBody onClose={onClose} commands={commands} placeholder={placeholder} /> : null;
}

function PaletteBody({ onClose, commands, placeholder }: { onClose: () => void; commands: Command[]; placeholder: string }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => commands.filter((c) => matches(c, query)), [commands, query]);
  const groups = useMemo(() => {
    const out: { group: string; items: { command: Command; flat: number }[] }[] = [];
    results.forEach((command, flat) => {
      const g = out.find((x) => x.group === command.group) ?? (out.push({ group: command.group, items: [] }), out[out.length - 1]);
      g.items.push({ command, flat });
    });
    return out;
  }, [results]);

  const active = Math.min(index, Math.max(0, results.length - 1));

  // Focus the input on open; hand focus back to whatever opened the palette.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function run(c: Command) {
    onClose();
    c.onRun();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      // The input is the only stop; keep focus from leaking to the page behind.
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex(results.length ? (active + 1) % results.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex(results.length ? (active - 1 + results.length) % results.length : 0);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      run(results[active]);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey} className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      <button type="button" aria-label="Close command palette" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-neutral-900/40" />
      <div className={cx("relative w-full max-w-xl border border-neutral-200 bg-white shadow-xl", radius.container)}>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          aria-label={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          placeholder={placeholder}
          className="w-full border-b border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        <div id={listId} role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <div className={cx("px-4 py-6 text-center", text.muted)}>No command matches “{query}”.</div>}
          {groups.map((g) => (
            <div key={g.group} role="group" aria-label={g.group}>
              <div className={cx("px-4 pt-2 pb-1", text.eyebrow)}>{g.group}</div>
              {g.items.map(({ command, flat }) => (
                <div
                  key={command.id}
                  id={`${listId}-${command.id}`}
                  role="option"
                  aria-selected={flat === active}
                  onMouseMove={() => setIndex(flat)}
                  onClick={() => run(command)}
                  className={cx("flex cursor-pointer items-center justify-between gap-4 px-4 py-2 text-xs", flat === active ? "bg-neutral-900 text-white" : "text-neutral-800")}
                >
                  <span className="truncate">{command.label}</span>
                  {command.shortcut && <kbd className={cx("font-mono text-[10px]", flat === active ? "text-neutral-300" : "text-neutral-500")}>{command.shortcut}</kbd>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={cx("flex gap-4 border-t border-neutral-200 px-4 py-2", text.muted)}>
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
