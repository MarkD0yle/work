import { useEffect, useMemo, useRef, useState } from "react";
import { cx, focus } from "../patterns/tokens";
import { ConditionEditor } from "./ConditionEditor";
import { ICON, iconBtn } from "./icons";
import {
  MAX_DEPTH,
  TRANSACTIONS,
  activeConditions,
  canMove,
  canWrap,
  countConditions,
  describeCondition,
  isComplete,
  mapNode,
  moveNode,
  moveSibling,
  newGroup,
  nodeLabel,
  testCondition,
  ungroup,
  ungroupBlocker,
  wrapInGroup,
  type Condition,
  type FilterNode,
  type Group,
} from "./model";
import { Icon, JoinToggle, JoinWord } from "./ui";

/* Logic: the filter's structure as an outline.
 *
 * Conditions read as one line of plain text; clicking one opens the shared
 * editor in place. Everything here is about shape: groups and nesting, NOT,
 * switching parts off, and moving things around by drag, by the up / down
 * buttons, or by wrapping a condition in a group of its own. Ungroup is only
 * offered when it can't change the result. */

type Change = (next: Group, label: string) => void;
type Drop = { group: string; before: string | null };

interface Ctx {
  root: Group;
  change: Change;
  editing: string | null;
  setEditing: (id: string | null) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  drop: Drop | null;
  setDrop: (d: Drop | null) => void;
  focusId: string | null;
  alone: Map<string, number>;
}

function useDropTarget(ctx: Ctx, group: string, before: string | null) {
  const active = ctx.drop?.group === group && ctx.drop.before === before;
  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!ctx.dragId || ctx.dragId === before || !canMove(ctx.root, ctx.dragId, group)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!active) ctx.setDrop({ group, before });
    },
    onDrop: (e: React.DragEvent) => {
      if (!ctx.dragId) return;
      e.preventDefault();
      e.stopPropagation();
      const moved = ctx.dragId;
      ctx.change(moveNode(ctx.root, moved, group, before), "Move condition");
      ctx.setDragId(null);
      ctx.setDrop(null);
    },
  };
  return { active, handlers };
}

function DropLine({ on }: { on: boolean }) {
  return <div aria-hidden className={cx("h-0.5", on ? "bg-neutral-900" : "bg-transparent")} />;
}

function RowActions({ ctx, node }: { ctx: Ctx; node: FilterNode }) {
  const { root, change } = ctx;
  const parent = useMemo(() => {
    const walk = (g: Group): Group | null => {
      for (const c of g.children) {
        if (c.id === node.id) return g;
        if (c.kind === "group") {
          const hit = walk(c);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(root);
  }, [root, node.id]);
  const i = parent ? parent.children.findIndex((c) => c.id === node.id) : -1;
  const name = node.kind === "group" ? "group" : "condition";
  const blocker = node.kind === "group" ? ungroupBlocker(root, node.id) : null;
  return (
    <div className="flex shrink-0 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100">
      <button type="button" className={iconBtn} disabled={i <= 0} onClick={() => change(moveSibling(root, node.id, -1), `Move ${name} up`)} title="Move up">
        <Icon d={ICON.up} label={`Move ${name} up`} size={12} />
      </button>
      <button type="button" className={iconBtn} disabled={!parent || i >= parent.children.length - 1} onClick={() => change(moveSibling(root, node.id, 1), `Move ${name} down`)} title="Move down">
        <Icon d={ICON.down} label={`Move ${name} down`} size={12} />
      </button>
      {node.kind === "condition" ? (
        <button
          type="button"
          className={iconBtn}
          disabled={!canWrap(root, node.id)}
          onClick={() => change(wrapInGroup(root, node.id).root, "Wrap in group")}
          title={canWrap(root, node.id) ? "Wrap in a group, to combine it with others differently" : `Groups nest up to ${MAX_DEPTH} levels`}
        >
          <Icon d={ICON.wrap} label="Wrap in group" size={12} />
        </button>
      ) : (
        <button type="button" className={iconBtn} disabled={!!blocker} onClick={() => change(ungroup(root, node.id), "Ungroup")} title={blocker ?? "Ungroup: lift its conditions into the parent"}>
          <Icon d={ICON.unwrap} label="Ungroup" size={12} />
        </button>
      )}
      <button type="button" className={iconBtn} onClick={() => change(mapNode(root, node.id, () => null), `Delete ${node.kind === "group" ? nodeLabel(node) : describeCondition(node)}`)} title={`Delete ${name}`}>
        <Icon d={ICON.trash} label={`Delete ${name}`} size={12} />
      </button>
    </div>
  );
}

function Grip({ ctx, id }: { ctx: Ctx; id: string }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        ctx.setDragId(id);
      }}
      onDragEnd={() => {
        ctx.setDragId(null);
        ctx.setDrop(null);
      }}
      title="Drag to move"
      className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
    >
      <Icon d={ICON.grip} label="" size={14} />
    </span>
  );
}

function ConditionLine({ ctx, c, dimmed }: { ctx: Ctx; c: Condition; dimmed: boolean }) {
  const { root, change } = ctx;
  if (ctx.editing === c.id)
    return (
      <ConditionEditor
        framed
        initial={c}
        onCancel={() => ctx.setEditing(null)}
        onRemove={() => {
          change(mapNode(root, c.id, () => null), `Remove ${describeCondition(c)}`);
          ctx.setEditing(null);
        }}
        onSubmit={(next) => {
          change(mapNode(root, c.id, () => next), `Edit ${describeCondition(next)}`);
          ctx.setEditing(null);
        }}
      />
    );
  const n = ctx.alone.get(c.id);
  const incomplete = !isComplete(c);
  return (
    <div className={cx("group/row flex items-center gap-1 border bg-white py-0.5 pr-0.5", incomplete ? "border-amber-300" : "border-neutral-200", ctx.dragId === c.id && "opacity-40")}>
      <Grip ctx={ctx} id={c.id} />
      <input
        type="checkbox"
        aria-label={c.enabled ? "Turn this condition off" : "Turn this condition on"}
        checked={c.enabled}
        onChange={(e) => change(mapNode(root, c.id, (x) => ({ ...(x as Condition), enabled: e.target.checked })), `${e.target.checked ? "Turn on" : "Turn off"} ${describeCondition(c)}`)}
        className="accent-neutral-900"
      />
      <button
        type="button"
        onClick={() => ctx.setEditing(c.id)}
        className={cx("min-w-0 flex-1 px-1.5 py-1 text-left text-xs text-neutral-800 hover:text-neutral-950", (!c.enabled || dimmed) && "text-neutral-400 line-through", focus)}
        title="Edit"
      >
        {describeCondition(c)}
      </button>
      {incomplete && <span className="shrink-0 text-[10px] font-semibold text-amber-700">Needs value</span>}
      {n === 0 && c.enabled && (
        <span className="shrink-0 text-rose-600" title="Matches no transactions on its own">
          <Icon d={ICON.warn} label="Matches nothing on its own" size={13} />
        </span>
      )}
      <RowActions ctx={ctx} node={c} />
    </div>
  );
}

function GroupNode({ ctx, g, depth, dimmed = false }: { ctx: Ctx; g: Group; depth: number; dimmed?: boolean }) {
  const { root, change } = ctx;
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const isRoot = depth === 0;
  const off = dimmed || !g.enabled;
  const focused = ctx.focusId === g.id && !isRoot;
  const set = (patch: Partial<Group>, label: string) => change(mapNode(root, g.id, (n) => ({ ...(n as Group), ...patch })), label);
  const end = useDropTarget(ctx, g.id, null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);

  const header = (
    <header className={cx("group/row flex items-center gap-1.5", isRoot ? "pb-2" : "border-b border-neutral-200 py-1 pr-0.5 pl-0.5")}>
      {!isRoot && (
        <>
          <Grip ctx={ctx} id={g.id} />
          <button type="button" className={iconBtn} aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Expand" : "Collapse"}>
            <span className={cx("inline-block transition-transform", collapsed && "-rotate-90")}>
              <Icon d={ICON.chevron} label={collapsed ? "Expand group" : "Collapse group"} size={12} />
            </span>
          </button>
          <input
            type="checkbox"
            aria-label={g.enabled ? "Turn this group off" : "Turn this group on"}
            checked={g.enabled}
            onChange={(e) => set({ enabled: e.target.checked }, e.target.checked ? "Turn group on" : "Turn group off")}
            className="accent-neutral-900"
          />
        </>
      )}
      <button
        type="button"
        aria-pressed={g.not}
        onClick={() => set({ not: !g.not }, g.not ? "Remove NOT" : "Add NOT")}
        title="Negate: rows match when this group does NOT"
        className={cx("border px-1.5 py-0.5 text-[10px] font-semibold", g.not ? "border-rose-700 bg-rose-700 text-white" : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100", focus)}
      >
        NOT
      </button>
      <span className="text-xs text-neutral-600">Match</span>
      <JoinToggle join={g.join} onChange={(join) => set({ join }, `Match ${join === "AND" ? "all" : "any"}`)} />
      <span className="text-xs text-neutral-500">of {countConditions(g)}</span>
      <span className="flex-1" />
      {!isRoot && <RowActions ctx={ctx} node={g} />}
    </header>
  );

  return (
    <section
      ref={ref}
      aria-label={isRoot ? "Filter logic" : "Condition group"}
      className={cx(
        !isRoot && "border bg-neutral-50",
        !isRoot && (g.not ? "border-rose-300" : "border-neutral-200"),
        focused && "outline-2 outline-offset-2 outline-neutral-900",
        ctx.dragId === g.id && "opacity-40",
        off && !isRoot && "opacity-60",
      )}
    >
      {header}
      {collapsed ? (
        <div className="truncate px-2 py-1.5 text-[11px] text-neutral-500">{nodeLabel(g)}</div>
      ) : (
        <div className={cx(!isRoot && "p-1.5")}>
          {g.children.length === 0 && ctx.editing !== `add:${g.id}` && (
            <div className="border border-dashed border-neutral-300 bg-white px-3 py-3 text-center text-[11px] text-neutral-500">
              {isRoot ? "No conditions. Add one here or from the bar." : "Empty group."}
            </div>
          )}
          <ol className={cx("flex flex-col", g.children.length > 1 && cx("ml-1 border-l-2 pl-2.5", g.join === "AND" ? "border-sky-300" : "border-violet-300"))}>
            {g.children.map((child, i) => (
              <ChildRow key={child.id} ctx={ctx} parent={g} child={child} index={i} depth={depth} dimmed={off} />
            ))}
          </ol>
          {ctx.editing === `add:${g.id}` && (
            <div className="mt-1.5">
              <ConditionEditor
                framed
                onCancel={() => ctx.setEditing(null)}
                onSubmit={(c) => {
                  change(mapNode(root, g.id, (n) => ({ ...(n as Group), children: [...(n as Group).children, c] })), `Add ${describeCondition(c)}`);
                  ctx.setEditing(null);
                }}
              />
            </div>
          )}
          <div {...end.handlers} className={cx("mt-1", ctx.dragId && "min-h-6")}>
            <DropLine on={end.active} />
            <div className="flex items-center gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => ctx.setEditing(`add:${g.id}`)}
                className={cx("inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900", focus)}
              >
                <Icon d={ICON.plus} label="" size={12} /> Condition
              </button>
              <button
                type="button"
                disabled={depth + 1 >= MAX_DEPTH}
                onClick={() => {
                  const ng = newGroup(g.join === "AND" ? "OR" : "AND", []);
                  change(mapNode(root, g.id, (n) => ({ ...(n as Group), children: [...(n as Group).children, ng] })), "Add group");
                  ctx.setEditing(`add:${ng.id}`);
                }}
                title={depth + 1 >= MAX_DEPTH ? `Groups nest up to ${MAX_DEPTH} levels` : "Add a nested group"}
                className={cx(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40",
                  focus,
                )}
              >
                <Icon d={ICON.plus} label="" size={12} /> Group
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChildRow({ ctx, parent, child, index, depth, dimmed }: { ctx: Ctx; parent: Group; child: FilterNode; index: number; depth: number; dimmed: boolean }) {
  const before = useDropTarget(ctx, parent.id, child.id);
  return (
    <li {...before.handlers}>
      <DropLine on={before.active} />
      {index > 0 && (
        <div className="flex py-0.5">
          <JoinWord
            join={parent.join}
            className="-ml-5"
            onToggle={() => ctx.change(mapNode(ctx.root, parent.id, (n) => ({ ...(n as Group), join: parent.join === "AND" ? "OR" : "AND" })), "Switch join")}
          />
        </div>
      )}
      {child.kind === "condition" ? <ConditionLine ctx={ctx} c={child} dimmed={dimmed} /> : <GroupNode ctx={ctx} g={child} depth={depth + 1} dimmed={dimmed} />}
    </li>
  );
}

export function LogicTree({ root, onChange, focusId }: { root: Group; onChange: Change; focusId: string | null }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  // Each condition's count on its own, for the "matches nothing" flag.
  const alone = useMemo(() => {
    const m = new Map<string, number>();
    const walk = (n: FilterNode) => {
      if (n.kind === "group") return n.children.forEach(walk);
      if (isComplete(n)) m.set(n.id, TRANSACTIONS.filter((r) => testCondition(n, r)).length);
    };
    walk(root);
    return m;
  }, [root]);

  const ctx: Ctx = { root, change: onChange, editing, setEditing, dragId, setDragId, drop, setDrop, focusId, alone };
  const groups = root.children.filter((c) => c.kind === "group").length;

  return (
    <div>
      <p className="mb-3 text-[11px] text-neutral-500">
        {activeConditions(root).length} active conditions{groups ? `, ${groups} group${groups === 1 ? "" : "s"}` : ""}. Drag <span className="font-mono">⠿</span> to move, or use the arrows. Click a
        condition to edit it.
      </p>
      <GroupNode ctx={ctx} g={root} depth={0} />
    </div>
  );
}
