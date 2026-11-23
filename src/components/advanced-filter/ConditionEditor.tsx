import { useMemo, useState, type ReactNode } from "react";
import { button, cx, focus } from "../patterns/tokens";
import {
  FIELD_BY_KEY,
  OPS,
  TRANSACTIONS,
  distinctValues,
  isComplete,
  newCondition,
  opDef,
  testCondition,
  valueLabel,
  type Condition,
  type Field,
  type FieldKey,
  type Op,
} from "./model";
import { FieldList, KindGlyph, SearchBox } from "./ui";

/* The one condition editor. The filter bar opens it in a popover; the
 * panel opens it in place. It works on its own copy and only hands the
 * condition back on Add / Done, so the grid never sees a half-made one.
 *
 * Adding starts on the criteria list; once a field is picked the editor
 * shows the operators that suit it and a value input that suits the
 * operator, with a live count of what the condition matches on its own. */

const inputCls = cx(
  "h-8 w-full min-w-0 border border-neutral-300 bg-white px-2 text-xs text-neutral-900 tabular-nums placeholder:text-neutral-400 hover:border-neutral-400",
  focus,
);

function SetValueList({
  field,
  values,
  onChange,
}: {
  field: Field;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const all = useMemo(() => distinctValues(field.key), [field.key]);
  const shown = all.filter((o) =>
    valueLabel(field, o.value).toLowerCase().includes(q.trim().toLowerCase()),
  );
  const toggle = (v: string) =>
    onChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
    );
  return (
    <div className="border border-neutral-300">
      {all.length > 8 && (
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={`Search ${field.label.toLowerCase()}`}
          autoFocus={false}
        />
      )}
      <div className="flex items-center justify-between border-b border-neutral-100 px-2.5 py-1 text-[11px] text-neutral-500">
        <span>
          {values.length} of {all.length} selected
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            className={cx(
              "font-medium text-neutral-700 hover:text-neutral-900",
              focus,
            )}
            onClick={() =>
              onChange([...new Set([...values, ...shown.map((o) => o.value)])])
            }
          >
            Select {q ? "shown" : "all"}
          </button>
          <button
            type="button"
            className={cx(
              "font-medium text-neutral-700 hover:text-neutral-900",
              focus,
            )}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </span>
      </div>
      <ul
        role="listbox"
        aria-multiselectable
        className="max-h-48 overflow-y-auto py-0.5"
      >
        {shown.map((o) => (
          <li key={o.value}>
            <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-xs text-neutral-800 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-neutral-900"
              />
              <span className="min-w-0 flex-1 truncate">
                {valueLabel(field, o.value)}
              </span>
              <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
                {o.count}
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-3 text-center text-xs text-neutral-500">
            Nothing matches.
          </li>
        )}
      </ul>
    </div>
  );
}

function ValueInputs({
  c,
  onChange,
}: {
  c: Condition;
  onChange: (patch: Partial<Condition>) => void;
}) {
  const f = FIELD_BY_KEY[c.field];
  const { arity } = opDef(f.kind, c.op);
  const type =
    f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text";
  const placeholder = f.kind === "number" ? "0" : (f.hint ?? "Value");
  if (arity === "none")
    return <p className="text-[11px] text-neutral-500">No value needed.</p>;
  if (arity === "many")
    return (
      <SetValueList
        field={f}
        values={c.values}
        onChange={(values) => onChange({ values })}
      />
    );
  if (arity === "days")
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          aria-label="Number of days"
          type="number"
          min={0}
          value={c.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="7"
          className={cx(inputCls, "w-24")}
        />
        <span className="text-xs text-neutral-500">days</span>
      </div>
    );
  if (arity === "two")
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          aria-label="From"
          type={type}
          value={c.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={placeholder}
          className={inputCls}
        />
        <span className="text-xs text-neutral-500">and</span>
        <input
          aria-label="To"
          type={type}
          value={c.value2}
          onChange={(e) => onChange({ value2: e.target.value })}
          placeholder={placeholder}
          className={inputCls}
        />
      </div>
    );
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        aria-label="Value"
        type={type}
        value={c.value}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder={placeholder}
        className={inputCls}
      />
      {f.unit && <span className="text-xs text-neutral-500">{f.unit}</span>}
    </div>
  );
}

/** Switch field, keeping the operator and values where they still make sense. */
function withField(c: Condition, key: FieldKey): Condition {
  const from = FIELD_BY_KEY[c.field];
  const to = FIELD_BY_KEY[key];
  const keepOp = OPS[to.kind].some((o) => o.op === c.op);
  const sameKind = from.kind === to.kind && to.kind !== "set";
  return {
    ...c,
    field: key,
    op: keepOp ? c.op : OPS[to.kind][0].op,
    value: sameKind ? c.value : "",
    value2: sameKind ? c.value2 : "",
    values: [],
  };
}

export function ConditionEditor({
  initial,
  onSubmit,
  onCancel,
  onRemove,
  framed = false,
  header,
}: {
  /** Omit to add a new condition. */
  initial?: Condition;
  onSubmit: (c: Condition) => void;
  onCancel: () => void;
  onRemove?: () => void;
  /** Draw a border, for use in place rather than in a popover. */
  framed?: boolean;
  /** Shown above the editor, e.g. what the new condition's join will do. */
  header?: ReactNode;
}) {
  const adding = !initial;
  const [draft, setDraft] = useState<Condition | null>(initial ?? null);
  const [picking, setPicking] = useState(adding);
  const [q, setQ] = useState("");

  const pick = (key: FieldKey) => {
    setDraft((d) => (d ? withField(d, key) : newCondition(key)));
    setPicking(false);
    setQ("");
  };

  const ready = !!draft && isComplete(draft);
  const alone = useMemo(
    () =>
      draft && isComplete(draft)
        ? TRANSACTIONS.filter((r) => testCondition(draft, r)).length
        : null,
    [draft],
  );
  const submit = () => draft && ready && onSubmit(draft);

  const shell = cx("bg-white", framed && "border border-neutral-900 shadow-sm");

  if (picking || !draft) {
    return (
      <div className={shell}>
        {header}
        <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          <span>
            {adding && !draft
              ? "Add filter · pick a criterion"
              : "Change criterion"}
          </span>
          {draft && (
            <button
              type="button"
              className={cx(
                "font-medium tracking-normal text-neutral-600 normal-case hover:text-neutral-900",
                focus,
              )}
              onClick={() => setPicking(false)}
            >
              Back
            </button>
          )}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search 24 criteria" />
        <div className="max-h-72 overflow-y-auto">
          <FieldList query={q} selected={draft?.field} onPick={pick} />
        </div>
      </div>
    );
  }

  const f = FIELD_BY_KEY[draft.field];
  return (
    <div className={shell}>
      {header}
      <form
        className="flex flex-col gap-2.5 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          onClick={() => setPicking(true)}
          title="Change criterion"
          className={cx(
            "flex items-center gap-2 border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left hover:border-neutral-400",
            focus,
          )}
        >
          <KindGlyph kind={f.kind} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-900">
            {f.label}
          </span>
          <span className="text-[10px] text-neutral-500">
            {f.category} · change
          </span>
        </button>

        <select
          aria-label="Operator"
          value={draft.op}
          onChange={(e) => setDraft({ ...draft, op: e.target.value as Op })}
          className={cx(
            "h-8 w-full border border-neutral-300 bg-white px-1.5 text-xs text-neutral-900 hover:border-neutral-400",
            focus,
          )}
        >
          {OPS[f.kind].map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>

        <ValueInputs
          c={draft}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
        />

        <div className="text-[11px] text-neutral-500 tabular-nums">
          {alone == null ? (
            "Fill in a value to see how many rows it matches."
          ) : (
            <>
              Matches{" "}
              <span
                className={cx(
                  "font-semibold",
                  alone === 0 ? "text-rose-700" : "text-neutral-900",
                )}
              >
                {alone}
              </span>{" "}
              of {TRANSACTIONS.length} on its own
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-100 pt-2.5">
          {onRemove && (
            <button
              type="button"
              className={cx(
                button.ghost,
                "text-rose-700 hover:bg-rose-50 hover:text-rose-800",
              )}
              onClick={onRemove}
            >
              Remove
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className={button.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={button.primary} disabled={!ready}>
            {adding ? "Add" : "Done"}
          </button>
        </div>
      </form>
    </div>
  );
}
