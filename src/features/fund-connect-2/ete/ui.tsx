import { useId, type ReactNode } from "react";
import type { Issue } from "./engine";
import { WORKFLOW_LABEL, type WorkflowState } from "./model";
import { btn, control, cx, focusRing, label as labelCls, muted, toneSoft, type Tone } from "./styles";

/* ETE Fund Configuration — small building blocks.
 *
 * Status is never colour alone: every badge carries its word, every
 * validation message starts with "Error" or "Warning", and switches print
 * their state next to the track. */

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-medium tracking-wide whitespace-nowrap uppercase", toneSoft[tone])}>
      {children}
    </span>
  );
}

const WORKFLOW_TONE: Record<WorkflowState, Tone> = { draft: "neutral", awaiting: "info", rejected: "bad", active: "good" };

export function WorkflowBadge({ state }: { state: WorkflowState }) {
  return <Badge tone={WORKFLOW_TONE[state]}>{WORKFLOW_LABEL[state]}</Badge>;
}

export function Notice({
  tone = "info",
  title,
  children,
  actions,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div role={tone === "bad" || tone === "warn" ? "alert" : "status"} className={cx("flex flex-wrap items-start gap-3 border px-3 py-2 text-xs", toneSoft[tone])}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Validation messages for one field, shown right under it. */
export function Messages({ issues, id }: { issues: Issue[]; id?: string }) {
  if (issues.length === 0) return null;
  return (
    <ul id={id} className="mt-1 flex flex-col gap-0.5">
      {issues.map((i) => (
        <li key={i.id} className={cx("text-[11px]", i.severity === "error" ? "text-red-700" : "text-amber-800")}>
          <span className="font-semibold">{i.severity === "error" ? "Error: " : "Warning: "}</span>
          {i.message}
        </li>
      ))}
    </ul>
  );
}

function borderFor(issues: Issue[]): string {
  if (issues.some((i) => i.severity === "error")) return "border-red-400";
  if (issues.length) return "border-amber-400";
  return "border-neutral-300";
}

function ChangedTag({ was }: { was?: string }) {
  if (was === undefined) return null;
  return (
    <span className="bg-amber-100 px-1 text-[10px] font-semibold text-amber-900 uppercase" title={`Active version: ${was || "Not set"}`}>
      Changed
    </span>
  );
}

type FieldBase = {
  label: string;
  hint?: string;
  issues?: Issue[];
  disabled?: boolean;
  /** The active version's value, when this one differs from it. */
  was?: string;
};

export function TextField({
  label,
  value,
  onChange,
  hint,
  issues = [],
  disabled,
  was,
  mono,
  inputMode,
  placeholder,
}: FieldBase & { value: string; onChange: (v: string) => void; mono?: boolean; inputMode?: "text" | "numeric"; placeholder?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cx("flex items-center gap-1.5", labelCls)}>
        {label}
        <ChangedTag was={was} />
      </label>
      <input
        id={id}
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={issues.some((i) => i.severity === "error") || undefined}
        aria-describedby={issues.length || hint ? `${id}-note` : undefined}
        className={cx("mt-1", control, borderFor(issues), mono && "font-mono tabular-nums")}
      />
      {issues.length > 0 ? <Messages issues={issues} id={`${id}-note`} /> : hint && <p id={`${id}-note`} className={cx("mt-1 text-[11px]", "text-neutral-500")}>{hint}</p>}
      {was !== undefined && <p className="mt-0.5 text-[11px] text-neutral-500">Active version: {was || "Not set"}</p>}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  issues = [],
  disabled,
  was,
  emptyLabel = "Not set",
}: FieldBase & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] | string[]; emptyLabel?: string | null }) {
  const id = useId();
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cx("flex items-center gap-1.5", labelCls)}>
        {label}
        <ChangedTag was={was} />
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={issues.some((i) => i.severity === "error") || undefined}
        aria-describedby={issues.length || hint ? `${id}-note` : undefined}
        className={cx("mt-1", control, borderFor(issues))}
      >
        {emptyLabel !== null && <option value="">{emptyLabel}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {issues.length > 0 ? <Messages issues={issues} id={`${id}-note`} /> : hint && <p id={`${id}-note`} className="mt-1 text-[11px] text-neutral-500">{hint}</p>}
      {was !== undefined && <p className="mt-0.5 text-[11px] text-neutral-500">Active version: {was || "Not set"}</p>}
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className={cx("flex items-start gap-2 text-xs", disabled ? "text-neutral-500" : "text-neutral-800")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">
        {label}
        {hint && <span className="block text-[11px] text-neutral-500">{hint}</span>}
      </span>
    </label>
  );
}

/** On/off control that prints its state, so it never relies on colour. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  onText = "On",
  offText = "Off",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Accessible name, e.g. "In-Kind in use". */
  label: string;
  onText?: string;
  offText?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("inline-flex items-center gap-2 text-xs font-medium disabled:opacity-60", checked ? "text-neutral-900" : "text-neutral-500", focusRing)}
    >
      <span aria-hidden className={cx("relative inline-block h-4 w-7 rounded-full border", checked ? "border-neutral-900 bg-neutral-900" : "border-neutral-400 bg-white")}>
        <span className={cx("absolute top-0.5 h-2.5 w-2.5 rounded-full", checked ? "right-0.5 bg-white" : "left-0.5 bg-neutral-400")} />
      </span>
      {checked ? onText : offText}
    </button>
  );
}

/** An open and close time for one order window. */
export function TimeWindow({
  legend,
  open,
  close,
  onOpen,
  onClose,
  disabled,
  issues = [],
  hint,
}: {
  legend: string;
  open: string;
  close: string;
  onOpen: (v: string) => void;
  onClose: (v: string) => void;
  disabled?: boolean;
  issues?: Issue[];
  hint?: string;
}) {
  const id = useId();
  const time = cx(control, borderFor(issues), "font-mono tabular-nums");
  return (
    <fieldset className="min-w-0">
      <legend className={labelCls}>{legend}</legend>
      <div className="mt-1 flex items-center gap-1.5">
        <input type="time" aria-label={`${legend}, opens`} value={open} disabled={disabled} onChange={(e) => onOpen(e.target.value)} aria-describedby={issues.length ? id : undefined} className={time} />
        <span className={muted}>to</span>
        <input type="time" aria-label={`${legend}, closes`} value={close} disabled={disabled} onChange={(e) => onClose(e.target.value)} aria-describedby={issues.length ? id : undefined} className={time} />
      </div>
      {issues.length > 0 ? <Messages issues={issues} id={id} /> : hint && <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>}
    </fieldset>
  );
}

export function Collapsible({
  title,
  blurb,
  open,
  onToggle,
  trailing,
  children,
}: {
  title: string;
  blurb?: string;
  open: boolean;
  onToggle: () => void;
  /** Counts shown on the header row: issues, changes. */
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="border border-neutral-200 bg-white">
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50", focusRing)}>
          <span aria-hidden className="w-3 text-xs text-neutral-500">
            {open ? "−" : "+"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">{title}</span>
            {blurb && <span className="block text-[11px] text-neutral-500">{blurb}</span>}
          </span>
          {trailing && <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{trailing}</span>}
        </button>
      </h3>
      {open && (
        <div id={id} className="border-t border-neutral-200 px-4 py-4">
          {children}
        </div>
      )}
    </section>
  );
}

export type TabItem<T extends string> = { value: T; label: string; note?: string; noteTone?: Tone };

export function TabBar<T extends string>({ tabs, value, onChange, label }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 overflow-x-auto">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px flex items-center gap-1.5 border-b-2 pt-1 pb-2 text-xs font-medium whitespace-nowrap",
              on ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900",
              focusRing,
            )}
          >
            {t.label}
            {t.note && <Badge tone={t.noteTone}>{t.note}</Badge>}
          </button>
        );
      })}
    </div>
  );
}

/** Counts of errors and warnings, as words. Renders nothing when clean. */
export function IssueCounts({ errors, warnings }: { errors: number; warnings: number }) {
  return (
    <>
      {errors > 0 && <Badge tone="bad">{errors === 1 ? "1 error" : `${errors} errors`}</Badge>}
      {warnings > 0 && <Badge tone="warn">{warnings === 1 ? "1 warning" : `${warnings} warnings`}</Badge>}
    </>
  );
}

export function EmptyNote({ title, children, action }: { title: string; children?: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="text-sm font-semibold text-neutral-900">{title}</div>
      {children && <p className={cx("mx-auto mt-1 max-w-md", muted)}>{children}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className={cx("mt-4", btn.secondary)}>
          {action.label}
        </button>
      )}
    </div>
  );
}
