import { useState, type ReactNode } from "react";
import { button, cx, focus } from "../patterns/tokens";
import { ICON, iconBtn } from "./icons";
import { PRESETS, activeConditions, nodeLabel, type Group } from "./model";
import { Icon } from "./ui";

/* Saved: shared filters, your own, the team default, and this session's
 * change history. The bar keeps only a quick switcher; saving, renaming,
 * deleting and choosing a default happen here. */

export interface MyFilter {
  id: string;
  name: string;
  root: Group;
}

export interface HistoryEntry {
  label: string;
  root: Group;
}

export function SavedView({
  current,
  savedId,
  mine,
  defaultId,
  history,
  historyIndex,
  onLoad,
  onSave,
  onRename,
  onDelete,
  onSetDefault,
  onJump,
}: {
  current: Group;
  savedId: string;
  mine: MyFilter[];
  defaultId: string;
  history: HistoryEntry[];
  historyIndex: number;
  onLoad: (id: string) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onJump: (index: number) => void;
}) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const canSave = activeConditions(current).length > 0 && name.trim() !== "";

  const star = (id: string) => (
    <button
      type="button"
      className={cx(iconBtn, defaultId === id && "text-amber-500 hover:text-amber-600")}
      onClick={() => onSetDefault(id)}
      aria-pressed={defaultId === id}
      title={defaultId === id ? "Team default: the team opens the grid with this filter" : "Make this the team default"}
    >
      <Icon d={ICON.star} label="Team default" size={13} />
    </button>
  );

  const row = ({ id, title, sub, actions }: { id: string; title: string; sub: string; actions?: ReactNode }) => (
    <li key={id} className={cx("group/row flex items-center gap-1 border-b border-neutral-100 py-1 pr-1", savedId === id && "bg-neutral-100")}>
      <button type="button" onClick={() => onLoad(id)} className={cx("min-w-0 flex-1 px-2 py-1 text-left", focus)}>
        <span className="block truncate text-xs font-medium text-neutral-900">{title}</span>
        <span className="block truncate text-[10px] text-neutral-500">{sub}</span>
      </button>
      {star(id)}
      {actions}
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Save current filter">
        <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Save current filter</div>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            onSave(name.trim());
            setName("");
          }}
        >
          <input
            aria-label="Filter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={activeConditions(current).length ? "Name, e.g. Q4 close exceptions" : "Add a condition first"}
            className={cx("h-8 min-w-0 flex-1 border border-neutral-300 bg-white px-2 text-xs placeholder:text-neutral-400", focus)}
          />
          <button type="submit" className={button.primary} disabled={!canSave}>
            Save
          </button>
        </form>
        {activeConditions(current).length > 0 && <p className="mt-1 truncate text-[10px] text-neutral-500" title={nodeLabel(current)}>{nodeLabel(current)}</p>}
      </section>

      <section aria-label="My filters">
        <div className="mb-1 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">My filters</div>
        {mine.length === 0 ? (
          <p className="text-[11px] text-neutral-400">None yet. Saved filters stay in this browser.</p>
        ) : (
          <ul>
            {mine.map((m) =>
              renaming === m.id ? (
                <li key={m.id} className="flex gap-1.5 border-b border-neutral-100 py-1.5">
                  <input
                    autoFocus
                    aria-label="New name"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameText.trim()) {
                        onRename(m.id, renameText.trim());
                        setRenaming(null);
                      }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className={cx("h-7 min-w-0 flex-1 border border-neutral-300 px-2 text-xs", focus)}
                  />
                  <button
                    type="button"
                    className={button.secondary}
                    onClick={() => {
                      if (renameText.trim()) onRename(m.id, renameText.trim());
                      setRenaming(null);
                    }}
                  >
                    OK
                  </button>
                </li>
              ) : (
                row({
                  id: m.id,
                  title: m.name,
                  sub: nodeLabel(m.root),
                  actions: (
                    <div className="flex opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                      <button
                        type="button"
                        className={cx(iconBtn, "w-auto px-1 text-[10px] font-medium")}
                        onClick={() => {
                          setRenaming(m.id);
                          setRenameText(m.name);
                        }}
                      >
                        Rename
                      </button>
                      <button type="button" className={iconBtn} onClick={() => onDelete(m.id)} title="Delete">
                        <Icon d={ICON.trash} label={`Delete ${m.name}`} size={12} />
                      </button>
                    </div>
                  ),
                })
              ),
            )}
          </ul>
        )}
      </section>

      <section aria-label="Shared filters">
        <div className="mb-1 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Shared with the team</div>
        <ul>
          {PRESETS.map((p) => (
            row({ id: p.id, title: p.name, sub: `${p.owner} · ${p.note}` })
          ))}
        </ul>
      </section>

      <section aria-label="History">
        <div className="mb-1 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">This session</div>
        <ol className="flex flex-col">
          {history
            .map((h, i) => ({ h, i }))
            .reverse()
            .slice(0, 12)
            .map(({ h, i }) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className={cx(
                    "flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] hover:bg-neutral-50",
                    i === historyIndex ? "font-semibold text-neutral-900" : i > historyIndex ? "text-neutral-400 line-through" : "text-neutral-600",
                    focus,
                  )}
                  title={i === historyIndex ? "Current" : "Go back to this point"}
                >
                  <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", i === historyIndex ? "bg-neutral-900" : "bg-neutral-300")} />
                  <span className="truncate">{h.label}</span>
                </button>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
