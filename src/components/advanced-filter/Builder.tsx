import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cx, focus } from "../patterns/tokens";
import {
  CATEGORIES,
  FIELDS,
  FIELD_BY_KEY,
  MAX_DEPTH,
  OPS,
  activeConditions,
  countConditions,
  describeCondition,
  distinctValues,
  isComplete,
  matchCount,
  opDef,
  valueLabel,
  type Condition,
  type Field,
  type FieldKey,
  type FieldKind,
  type FilterNode,
  type Group,
  type Join,
  type Op,
} from "./model";
import { ICON } from "./icons";

/* The filter builder: a tree of groups and conditions.
 *
 * Each group joins its children with AND or OR and can be negated (NOT) or
 * switched off without deleting it. Each condition picks a field from the
 * criteria catalogue, an operator that suits the field's kind, and a value
 * editor that suits the operator. Every row shows how many transactions it
 * matches on its own, so you can see which condition is doing the work. */

export interface BuilderActions {
  update: (id: string, fn: (n: FilterNode) => FilterNode | null) => void;
  addCondition: (groupId: string, field?: FieldKey) => void;
  addGroup: (groupId: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  setTarget: (groupId: string) => void;
}

/* ---- small parts ------------------------------------------------- */

const KIND_GLYPH: Record<FieldKind, string> = { text: "Aa", number: "#", date: "▦", set: "≡", boolean: "◐" };
const KIND_NAME: Record<FieldKind, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  set: "List",
  boolean: "Yes / no",
};

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

const iconBtn = cx(
  "inline-flex h-7 w-7 shrink-0 items-center justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900",
  focus,
);

function Icon({ d, label }: { d: string; label: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-label={label} role="img">
      <path d={d} strokeLinecap="square" />
    </svg>
  );
}

/** Anchored popover that closes on outside click or Escape. */
function Popover({
  open,
  onClose,
  children,
  align = "left",
  width = 288,
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
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
      style={{ width }}
      className={cx(
        "absolute top-full z-40 mt-1 border border-neutral-300 bg-white shadow-lg",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      {children}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 px-2.5 py-2 text-neutral-400">
      <Icon d={ICON.search} label="" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}

/* ---- criteria (field) picker -------------------------------------- */

function matchesQuery(f: Field, q: string) {
  const s = q.trim().toLowerCase();
  return !s || f.label.toLowerCase().includes(s) || f.category.toLowerCase().includes(s) || KIND_NAME[f.kind].toLowerCase().includes(s);
}

export function FieldList({ onPick, selected, query }: { onPick: (k: FieldKey) => void; selected?: FieldKey; query: string }) {
  const groups = CATEGORIES.map((cat) => ({ cat, fields: FIELDS.filter((f) => f.category === cat && matchesQuery(f, query)) })).filter(
    (g) => g.fields.length > 0,
  );
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

function FieldPicker({ value, onChange }: { value: FieldKey; onChange: (k: FieldKey) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const f = FIELD_BY_KEY[value];
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex h-8 w-44 items-center gap-2 border border-neutral-300 bg-white px-2 text-left text-xs text-neutral-900 hover:border-neutral-400",
          focus,
        )}
      >
        <KindGlyph kind={f.kind} />
        <span className="min-w-0 flex-1 truncate font-medium">{f.label}</span>
        <span className="text-neutral-400">
          <Icon d={ICON.chevron} label="" />
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <SearchBox value={q} onChange={setQ} placeholder="Search criteria" />
        <div className="max-h-80 overflow-y-auto">
          <FieldList
            query={q}
            selected={value}
            onPick={(k) => {
              onChange(k);
              setOpen(false);
              setQ("");
            }}
          />
        </div>
      </Popover>
    </div>
  );
}

/* ---- value editors ----------------------------------------------- */

const inputCls = cx(
  "h-8 border border-neutral-300 bg-white px-2 text-xs text-neutral-900 tabular-nums placeholder:text-neutral-400 hover:border-neutral-400",
  focus,
);

function SetValuePicker({ field, values, onChange }: { field: Field; values: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const all = useMemo(() => distinctValues(field.key), [field.key]);
  const shown = all.filter((o) => valueLabel(field, o.value).toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex min-h-8 w-full flex-wrap items-center gap-1 border bg-white px-1.5 py-1 text-left text-xs hover:border-neutral-400",
          values.length ? "border-neutral-300" : "border-dashed border-neutral-300",
          focus,
        )}
      >
        {values.length === 0 && <span className="px-0.5 text-neutral-400">Choose values…</span>}
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-800">
            {valueLabel(field, v)}
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Remove ${valueLabel(field, v)}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(v);
              }}
              className="text-neutral-400 hover:text-neutral-900"
            >
              ×
            </span>
          </span>
        ))}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width={320}>
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${field.label.toLowerCase()}`} />
        <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-1.5 text-[11px] text-neutral-500">
          <span>
            {values.length} of {all.length} selected
          </span>
          <span className="flex gap-2">
            <button type="button" className={cx("font-medium text-neutral-700 hover:text-neutral-900", focus)} onClick={() => onChange(shown.map((o) => o.value))}>
              Select {q ? "shown" : "all"}
            </button>
            <button type="button" className={cx("font-medium text-neutral-700 hover:text-neutral-900", focus)} onClick={() => onChange([])}>
              Clear
            </button>
          </span>
        </div>
        <ul role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto py-1">
          {shown.map((o) => {
            const on = values.includes(o.value);
            return (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-neutral-800 hover:bg-neutral-50">
                  <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="accent-neutral-900" />
                  <span className="min-w-0 flex-1 truncate">{valueLabel(field, o.value)}</span>
                  <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{o.count}</span>
                </label>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-3 text-center text-xs text-neutral-500">Nothing matches.</li>}
        </ul>
      </Popover>
    </div>
  );
}

function ValueEditor({ c, onChange }: { c: Condition; onChange: (patch: Partial<Condition>) => void }) {
  const f = FIELD_BY_KEY[c.field];
  const { arity } = opDef(f.kind, c.op);
  const type = f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text";
  const placeholder = f.kind === "number" ? (f.unit ? `0 ${f.unit}` : "0") : f.hint ?? "Value";
  if (arity === "none") return <div className="flex-1" />;
  if (arity === "many") return <SetValuePicker field={f} values={c.values} onChange={(values) => onChange({ values })} />;
  if (arity === "days")
    return (
      <div className="flex flex-1 items-center gap-2">
        <input
          aria-label="Number of days"
          type="number"
          min={0}
          value={c.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="7"
          className={cx(inputCls, "w-20")}
        />
        <span className="text-xs text-neutral-500">days</span>
      </div>
    );
  if (arity === "two")
    return (
      <div className="flex flex-1 items-center gap-2">
        <input aria-label="From" type={type} value={c.value} onChange={(e) => onChange({ value: e.target.value })} placeholder={placeholder} className={cx(inputCls, "w-32")} />
        <span className="text-xs text-neutral-500">and</span>
        <input aria-label="To" type={type} value={c.value2} onChange={(e) => onChange({ value2: e.target.value })} placeholder={placeholder} className={cx(inputCls, "w-32")} />
      </div>
    );
  return (
    <div className="flex flex-1 items-center gap-2">
      <input aria-label="Value" type={type} value={c.value} onChange={(e) => onChange({ value: e.target.value })} placeholder={placeholder} className={cx(inputCls, f.kind === "text" ? "w-56" : "w-36")} />
      {f.unit && <span className="text-xs text-neutral-500">{f.unit}</span>}
    </div>
  );
}

/* ---- match badge -------------------------------------------------- */

function MatchBadge({ node, total }: { node: FilterNode; total: number }) {
  const live = activeConditions(node).length > 0;
  const n = live ? matchCount(node) : null;
  if (n == null) return <span className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral-300">—</span>;
  const pct = total ? n / total : 0;
  return (
    <span className="flex w-16 shrink-0 flex-col items-end gap-0.5" title={`${n} of ${total} transactions match this on its own`}>
      <span className={cx("font-mono text-[11px] tabular-nums", n === 0 ? "text-rose-700" : "text-neutral-700")}>{n.toLocaleString()}</span>
      <span className="h-0.5 w-12 bg-neutral-200">
        <span className={cx("block h-full", n === 0 ? "bg-rose-400" : "bg-neutral-500")} style={{ width: `${Math.max(2, pct * 100)}%` }} />
      </span>
    </span>
  );
}

/* ---- condition row ------------------------------------------------ */

function ConditionRow({ c, total, actions, dimmed }: { c: Condition; total: number; actions: BuilderActions; dimmed: boolean }) {
  const f = FIELD_BY_KEY[c.field];
  const set = (patch: Partial<Condition>) => actions.update(c.id, (n) => ({ ...(n as Condition), ...patch }));
  const incomplete = c.enabled && !isComplete(c);
  const opId = useId();

  const changeField = (key: FieldKey) => {
    const nf = FIELD_BY_KEY[key];
    // Keep the operator when the new field offers it; values only survive within a kind.
    const keepOp = OPS[nf.kind].some((o) => o.op === c.op);
    const sameKind = nf.kind === f.kind;
    set({
      field: key,
      op: keepOp ? c.op : OPS[nf.kind][0].op,
      value: sameKind && nf.kind !== "set" ? c.value : "",
      value2: sameKind && nf.kind !== "set" ? c.value2 : "",
      values: [],
    });
  };

  return (
    <div
      className={cx(
        "group/row flex items-start gap-2 border bg-white py-1.5 pr-1.5 pl-2",
        incomplete ? "border-amber-300" : "border-neutral-200",
        (!c.enabled || dimmed) && "opacity-50",
      )}
    >
      <input
        type="checkbox"
        aria-label={c.enabled ? "Turn this condition off" : "Turn this condition on"}
        checked={c.enabled}
        onChange={(e) => set({ enabled: e.target.checked })}
        className="mt-2 accent-neutral-900"
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        <FieldPicker value={c.field} onChange={changeField} />
        <label htmlFor={opId} className="sr-only">
          Operator
        </label>
        <select
          id={opId}
          value={c.op}
          onChange={(e) => set({ op: e.target.value as Op })}
          className={cx("h-8 w-36 border border-neutral-300 bg-white px-1.5 text-xs text-neutral-900 hover:border-neutral-400", focus)}
        >
          {OPS[f.kind].map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
        <ValueEditor c={c} onChange={set} />
      </div>
      {incomplete && <span className="mt-2 shrink-0 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">Needs value</span>}
      <div className="mt-1">
        <MatchBadge node={c} total={total} />
      </div>
      <div className="flex shrink-0 opacity-60 group-hover/row:opacity-100 group-focus-within/row:opacity-100">
        <button type="button" className={iconBtn} onClick={() => actions.duplicate(c.id)} title="Duplicate condition">
          <Icon d={ICON.copy} label="Duplicate condition" />
        </button>
        <button type="button" className={iconBtn} onClick={() => actions.remove(c.id)} title="Delete condition">
          <Icon d={ICON.trash} label="Delete condition" />
        </button>
      </div>
    </div>
  );
}

/* ---- group -------------------------------------------------------- */

const JOIN_TONE: Record<Join, { rail: string; chip: string; on: string }> = {
  AND: { rail: "border-sky-300", chip: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100", on: "bg-sky-700 text-white" },
  OR: { rail: "border-violet-300", chip: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100", on: "bg-violet-700 text-white" },
};

function JoinToggle({ join, onChange }: { join: Join; onChange: (j: Join) => void }) {
  return (
    <div role="radiogroup" aria-label="Match" className="inline-flex border border-neutral-300 bg-white">
      {(["AND", "OR"] as Join[]).map((j) => (
        <button
          key={j}
          type="button"
          role="radio"
          aria-checked={join === j}
          onClick={() => onChange(j)}
          className={cx("px-2.5 py-1 text-[11px] font-semibold tracking-wide", join === j ? JOIN_TONE[j].on : "text-neutral-600 hover:bg-neutral-100", focus)}
          title={j === "AND" ? "Every condition must match" : "Any condition can match"}
        >
          {j === "AND" ? "ALL · AND" : "ANY · OR"}
        </button>
      ))}
    </div>
  );
}

export function GroupBox({
  g,
  depth,
  total,
  actions,
  target,
  dimmed = false,
}: {
  g: Group;
  depth: number;
  total: number;
  actions: BuilderActions;
  target: string;
  dimmed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isRoot = depth === 0;
  const set = (patch: Partial<Group>) => actions.update(g.id, (n) => ({ ...(n as Group), ...patch }));
  const off = dimmed || !g.enabled;
  const isTarget = target === g.id;
  const n = countConditions(g);

  return (
    <section
      aria-label={isRoot ? "Filter" : "Condition group"}
      onFocusCapture={() => actions.setTarget(g.id)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) actions.setTarget(g.id);
      }}
      className={cx(
        isRoot ? "" : "border bg-neutral-50/60",
        !isRoot && (isTarget ? "border-neutral-900" : "border-neutral-200"),
        !isRoot && g.not && "border-rose-300 bg-rose-50/30",
      )}
    >
      <header className={cx("flex flex-wrap items-center gap-2", isRoot ? "pb-3" : "border-b border-neutral-200 px-2.5 py-2")}>
        {!isRoot && (
          <>
            <button type="button" className={iconBtn} aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Expand group" : "Collapse group"}>
              <span className={cx("inline-block transition-transform", collapsed && "-rotate-90")}>
                <Icon d={ICON.chevron} label={collapsed ? "Expand group" : "Collapse group"} />
              </span>
            </button>
            <input
              type="checkbox"
              aria-label={g.enabled ? "Turn this group off" : "Turn this group on"}
              checked={g.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="accent-neutral-900"
            />
          </>
        )}
        <button
          type="button"
          aria-pressed={g.not}
          onClick={() => set({ not: !g.not })}
          title="Negate: rows match when this group does NOT"
          className={cx(
            "border px-2 py-1 text-[11px] font-semibold tracking-wide",
            g.not ? "border-rose-700 bg-rose-700 text-white" : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100",
            focus,
          )}
        >
          NOT
        </button>
        <span className="text-xs text-neutral-600">{isRoot ? "Show transactions that match" : "Match"}</span>
        <JoinToggle join={g.join} onChange={(join) => set({ join })} />
        <span className="text-xs text-neutral-600">of {n === 1 ? "this condition" : `these ${n} conditions`}</span>
        <span className="flex-1" />
        {isTarget && (
          <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase" title="Criteria picked from the library land here">
            Adding here
          </span>
        )}
        {!isRoot && <MatchBadge node={g} total={total} />}
        {!isRoot && (
          <div className="flex">
            <button type="button" className={iconBtn} onClick={() => actions.duplicate(g.id)} title="Duplicate group">
              <Icon d={ICON.copy} label="Duplicate group" />
            </button>
            <button type="button" className={iconBtn} onClick={() => actions.remove(g.id)} title="Delete group">
              <Icon d={ICON.trash} label="Delete group" />
            </button>
          </div>
        )}
      </header>

      {!collapsed && (
        <div className={cx(isRoot ? "" : "p-2.5")}>
          {g.children.length === 0 && (
            <div className="border border-dashed border-neutral-300 bg-white px-3 py-4 text-center text-xs text-neutral-500">
              {isRoot ? "No conditions yet — every transaction shows. " : "Empty group. "}
              Add a condition, or pick criteria from the library.
            </div>
          )}
          <ol className={cx("flex flex-col", g.children.length > 1 && cx("border-l-2 pl-3", JOIN_TONE[g.join].rail))}>
            {g.children.map((child, i) => (
              <li key={child.id} className="relative">
                {i > 0 && (
                  <div className="relative flex py-1">
                    <button
                      type="button"
                      onClick={() => set({ join: g.join === "AND" ? "OR" : "AND" })}
                      title="Switch between AND and OR for this group"
                      className={cx("-ml-4 border px-1.5 py-0.5 text-[10px] font-bold tracking-wider", JOIN_TONE[g.join].chip, focus)}
                    >
                      {g.join}
                    </button>
                  </div>
                )}
                {child.kind === "condition" ? (
                  <ConditionRow c={child} total={total} actions={actions} dimmed={off} />
                ) : (
                  <GroupBox g={child} depth={depth + 1} total={total} actions={actions} target={target} dimmed={off} />
                )}
              </li>
            ))}
          </ol>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => actions.addCondition(g.id)}
              className={cx("inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900", focus)}
            >
              <Icon d={ICON.plus} label="" /> Condition
            </button>
            <button
              type="button"
              disabled={depth + 1 >= MAX_DEPTH}
              onClick={() => actions.addGroup(g.id)}
              title={depth + 1 >= MAX_DEPTH ? `Groups nest up to ${MAX_DEPTH} levels` : "Add a nested group"}
              className={cx(
                "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
                focus,
              )}
            >
              <Icon d={ICON.plus} label="" /> Group
            </button>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="truncate px-3 py-2 text-xs text-neutral-500">
          {activeConditions(g).map(describeCondition).join(` ${g.join} `) || "No active conditions"}
        </div>
      )}
    </section>
  );
}

export { Icon };
