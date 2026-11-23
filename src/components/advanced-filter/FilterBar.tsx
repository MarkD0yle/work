import { useState, type ReactNode } from "react";
import { button, cx, focus } from "../patterns/tokens";
import { ConditionEditor } from "./ConditionEditor";
import { ICON } from "./icons";
import { MAX_DEPTH, activeConditions, canCombine, combine, describeCondition, isComplete, mapNode, nodeLabel, type Condition, type Group, type Join } from "./model";
import { Icon, JoinWord, Popover } from "./ui";

/* The filter bar: where conditions are written.
 *
 * Each top-level condition is a chip. Click it to edit in a popover, × to
 * remove, and click the AND / OR word between chips to switch how they
 * join. "+ AND" narrows and "+ OR" widens: both open the same editor
 * empty, and mixing joins groups the current filter so it keeps its
 * meaning. Groups show as one
 * chip; clicking it opens the Logic panel on that group, because changing
 * structure is the panel's job. */

export interface SavedEntry {
  id: string;
  name: string;
  owner: string;
}

/** Tells you, before you pick, what adding with this join will do. */
function JoinHint({ join, root }: { join: Join; root: Group }) {
  const regroups = root.children.length > 1 && join !== root.join;
  return (
    <div className={cx("border-b px-3 py-2 text-[11px]", join === "AND" ? "border-sky-100 bg-sky-50 text-sky-900" : "border-violet-100 bg-violet-50 text-violet-900")}>
      <span className="font-bold tracking-wider">{join}</span> ·{" "}
      {join === "AND" ? "narrow the results: rows must match this as well." : "widen the results: rows can match this instead."}
      {regroups && <span className="mt-0.5 block text-neutral-600">Your current filter becomes one group, so it keeps its meaning.</span>}
    </div>
  );
}

export function FilterBar({
  root,
  onChange,
  onOpenLogic,
  logicOpen,
  saved,
  savedId,
  onLoadSaved,
  onClear,
  onManageSaved,
  right,
}: {
  root: Group;
  onChange: (next: Group, label: string) => void;
  onOpenLogic: (focusId?: string) => void;
  logicOpen: boolean;
  saved: SavedEntry[];
  savedId: string;
  onLoadSaved: (id: string) => void;
  onClear: () => void;
  onManageSaved: () => void;
  right: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const close = () => setOpen(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const groups = root.children.filter((c) => c.kind === "group").length;
  const any = root.children.length > 0;

  const replace = (c: Condition) => {
    onChange(
      mapNode(root, c.id, () => c),
      `Edit ${describeCondition(c)}`,
    );
    close();
  };
  const remove = (id: string, label: string) => {
    onChange(
      mapNode(root, id, () => null),
      `Remove ${label}`,
    );
    close();
  };
  const add = (c: Condition, join: Join) => {
    onChange(combine(root, c, join), `${any ? `${join} ` : "Add "}${describeCondition(c)}`);
    close();
  };

  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-neutral-200 bg-white px-4 py-2">
      <span className="mt-1.5 shrink-0 text-neutral-400">
        <Icon d={ICON.filter} label="Filter" />
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {root.not && (
          <button
            type="button"
            onClick={() => onOpenLogic(root.id)}
            title="The whole filter is negated. Open Logic to change it."
            className={cx("border border-rose-700 bg-rose-700 px-1.5 py-0.5 text-[10px] font-semibold text-white", focus)}
          >
            NOT
          </button>
        )}

        {root.children.map((child, i) => {
          const live = activeConditions(child).length > 0;
          const label = nodeLabel(child);
          return (
            <span key={child.id} className="inline-flex min-w-0 items-center gap-1.5">
              {i > 0 && <JoinWord join={root.join} onToggle={() => onChange({ ...root, join: root.join === "AND" ? "OR" : "AND" }, `Join with ${root.join === "AND" ? "OR" : "AND"}`)} />}
              <span className="relative inline-flex min-w-0">
                <span
                  className={cx(
                    "inline-flex max-w-sm min-w-0 items-center border text-[11px]",
                    child.kind === "group" ? "border-neutral-300 bg-white" : "border-neutral-200 bg-neutral-50",
                    open === child.id && "border-neutral-900",
                    !live && "border-dashed text-neutral-400",
                    child.kind === "condition" && !isComplete(child) && "border-amber-300",
                  )}
                >
                  <button
                    type="button"
                    aria-haspopup={child.kind === "condition" ? "dialog" : undefined}
                    aria-expanded={child.kind === "condition" ? open === child.id : undefined}
                    onClick={() => (child.kind === "group" ? onOpenLogic(child.id) : toggle(child.id))}
                    title={child.kind === "group" ? `${label} · open in Logic` : !child.enabled ? `${label} (off)` : label}
                    className={cx("flex min-w-0 items-center gap-1 py-1 pr-1 pl-2 text-left hover:text-neutral-950", !live && "line-through", focus)}
                  >
                    {child.kind === "group" && (
                      <span className="shrink-0 text-neutral-400">
                        <Icon d={ICON.logic} label="" size={12} />
                      </span>
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => remove(child.id, label)}
                    className={cx("self-stretch px-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900", focus)}
                  >
                    ×
                  </button>
                </span>
                {child.kind === "condition" && (
                  <Popover open={open === child.id} onClose={close}>
                    <ConditionEditor initial={child} onSubmit={replace} onCancel={close} onRemove={() => remove(child.id, label)} />
                  </Popover>
                )}
              </span>
            </span>
          );
        })}

        {/* With nothing yet, one "Add filter". After that, AND narrows and OR widens. */}
        {(any ? (["AND", "OR"] as Join[]) : (["AND"] as Join[])).map((j) => {
          const key = `add-${j}`;
          const allowed = canCombine(root, j);
          return (
            <span key={j} className="relative">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open === key}
                disabled={!allowed}
                onClick={() => toggle(key)}
                title={
                  !any
                    ? "Add a condition"
                    : !allowed
                      ? `Groups nest up to ${MAX_DEPTH} levels. Use Logic to restructure first.`
                      : j === "AND"
                        ? "Narrow: rows must also match the new condition"
                        : "Widen: rows can match the new condition instead"
                }
                className={cx(
                  "inline-flex items-center gap-1 border border-dashed px-2 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                  !any
                    ? "border-neutral-300 text-neutral-600 hover:border-neutral-500 hover:text-neutral-900"
                    : j === "AND"
                      ? "border-sky-300 text-sky-800 hover:border-sky-500 hover:bg-sky-50"
                      : "border-violet-300 text-violet-800 hover:border-violet-500 hover:bg-violet-50",
                  focus,
                )}
              >
                <Icon d={ICON.plus} label="" size={12} /> {any ? j : "Add filter"}
              </button>
              <Popover open={open === key} onClose={close}>
                <ConditionEditor
                  header={any ? <JoinHint join={j} root={root} /> : undefined}
                  onSubmit={(c) => add(c, j)}
                  onCancel={close}
                />
              </Popover>
            </span>
          );
        })}
        {!any && <span className="text-[11px] text-neutral-400">All transactions</span>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="relative">
          <button type="button" aria-haspopup="listbox" aria-expanded={open === "saved"} onClick={() => toggle("saved")} className={button.ghost}>
            Saved <Icon d={ICON.chevron} label="" size={12} />
          </button>
          <Popover open={open === "saved"} onClose={close} align="right" width={280}>
            <ul role="listbox" aria-label="Saved filters" className="max-h-80 overflow-y-auto py-1">
              {saved.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={savedId === s.id}
                    onClick={() => {
                      onLoadSaved(s.id);
                      close();
                    }}
                    className={cx("flex w-full flex-col px-3 py-1.5 text-left hover:bg-neutral-50", savedId === s.id && "bg-neutral-100", focus)}
                  >
                    <span className="truncate text-xs font-medium text-neutral-900">{s.name}</span>
                    <span className="truncate text-[10px] text-neutral-500">{s.owner}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                onManageSaved();
                close();
              }}
              className={cx("w-full border-t border-neutral-200 px-3 py-2 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-50", focus)}
            >
              Save or manage filters…
            </button>
          </Popover>
        </span>
        {any && (
          <button type="button" className={button.ghost} onClick={onClear}>
            Clear
          </button>
        )}
        <button
          type="button"
          aria-expanded={logicOpen}
          aria-controls="filter-panel"
          onClick={() => onOpenLogic()}
          className={cx(logicOpen ? button.primary : button.secondary, "py-1")}
          title="Groups, NOT, impact and saved filters"
        >
          <Icon d={ICON.logic} label="" size={13} /> Logic
          {groups > 0 && <span className={cx("px-1 text-[10px] font-semibold tabular-nums", logicOpen ? "bg-white text-neutral-900" : "bg-neutral-900 text-white")}>{groups}</span>}
        </button>
        <span className="mx-2 h-5 w-px bg-neutral-200" />
        {right}
      </div>
    </div>
  );
}
