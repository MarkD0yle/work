import { useId, useState, type ReactNode } from "react";
import { TONE, TONE_DOT, btnGhost, labelClass, type Tone } from "./styles";

/* Building blocks shared by the three accordion + modal examples.
 *
 *   AccordionItem   one numbered, collapsible section of the parent form
 *   InlineEntry     a saved modal result, rendered as a row inside a section
 *   RadioPills      a single radio group drawn as a segmented control
 *   Chip / DistributionBar / Progress   small summary visuals
 */

export type SectionStatus = "complete" | "incomplete" | "optional";

export function AccordionItem({
  index,
  title,
  summary,
  status,
  open,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  /** One line shown in the header while collapsed (and dimmed while open). */
  summary?: ReactNode;
  status: SectionStatus;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const headerId = useId();
  return (
    <section
      className={`border bg-white transition ${
        open ? "border-neutral-400 shadow-sm" : "border-neutral-200"
      }`}
    >
      <h3>
        <button
          id={headerId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50"
        >
          <StepBadge index={index} status={status} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">
              {title}
            </span>
            {summary && (
              <span className="mt-0.5 block truncate text-xs text-neutral-500">
                {summary}
              </span>
            )}
          </span>
          {status === "optional" && (
            <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Optional
            </span>
          )}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </h3>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-neutral-100 px-5 pt-4 pb-5"
        >
          {children}
        </div>
      )}
    </section>
  );
}

function StepBadge({ index, status }: { index: number; status: SectionStatus }) {
  if (status === "complete") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-emerald-600 text-white">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-label="Complete">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-neutral-300 bg-white font-mono text-xs font-semibold text-neutral-600">
      {index}
    </span>
  );
}

/* InlineEntry — how a saved modal result lives inside the parent form.
 * Collapsed it is one dense row (title, meta, summary chips, actions); the
 * caret reveals `details` for a closer look without reopening the modal. */
export function InlineEntry({
  title,
  meta,
  badges,
  details,
  muted,
  onEdit,
  onRemove,
}: {
  title: string;
  meta?: ReactNode;
  badges?: ReactNode;
  details?: ReactNode;
  /** Dims the row — e.g. a superseded assessment kept for history. */
  muted?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <div
      className={`border-l-2 border border-neutral-200 bg-white ${
        muted ? "border-l-neutral-300 opacity-60" : "border-l-neutral-900"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {details && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={expanded ? "Hide details" : "Show details"}
            className="-ml-1 p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-neutral-900">{title}</div>
          {meta && <div className="mt-0.5 text-[11px] text-neutral-500">{meta}</div>}
        </div>
        {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <button type="button" onClick={onEdit} className={btnGhost}>
              Edit
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className={`${btnGhost} hover:bg-red-50 hover:text-red-700`}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {details && expanded && (
        <div id={detailsId} className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
          {details}
        </div>
      )}
    </div>
  );
}

export function Chip({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/* RadioPills — one radio group as a segmented control. Real radio inputs
 * (visually hidden) keep arrow-key navigation and form semantics intact. */
export function RadioPills<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  disabled,
  size = "sm",
}: {
  name: string;
  label: string;
  value: T | undefined;
  options: { value: T; label: string; tone?: Tone }[];
  onChange: (next: T) => void;
  disabled?: boolean;
  size?: "xs" | "sm";
}) {
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs";
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap">
      {options.map((o, i) => {
        const checked = value === o.value;
        const tone = o.tone ?? "info";
        return (
          <label
            key={o.value}
            className={`relative cursor-pointer border font-medium whitespace-nowrap transition select-none focus-within:z-10 focus-within:ring-2 focus-within:ring-neutral-900/20 ${pad} ${
              i > 0 ? "-ml-px" : ""
            } ${
              checked
                ? `z-10 ${TONE[tone]}`
                : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
            } ${disabled ? "pointer-events-none opacity-40" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/* Stacked horizontal bar showing how a set of answers splits across tones. */
export function DistributionBar({
  parts,
}: {
  parts: { label: string; count: number; tone: Tone }[];
}) {
  const total = parts.reduce((s, p) => s + p.count, 0) || 1;
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden bg-neutral-100">
        {parts.map((p) =>
          p.count > 0 ? (
            <span
              key={p.label}
              className={TONE_DOT[p.tone]}
              style={{ width: `${(p.count / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 ${TONE_DOT[p.tone]}`} />
            {p.label} <span className="font-medium text-neutral-800 tabular-nums">{p.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-24 bg-neutral-200">
        <div
          className={done === total ? "h-full bg-emerald-500" : "h-full bg-neutral-900"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-neutral-500 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

export function FieldBlock({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={`flex items-center gap-1 ${labelClass}`}>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}

export function EmptyEntries({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-neutral-200 px-4 py-5 text-center text-xs text-neutral-500">
      {children}
    </div>
  );
}

/* Footer row under the accordion — overall progress + submit. */
export function FormFooter({
  done,
  total,
  onSubmit,
  submitLabel,
  submitted,
}: {
  done: number;
  total: number;
  onSubmit: () => void;
  submitLabel: string;
  submitted: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white px-5 py-3">
      <div className="flex items-center gap-3 text-xs text-neutral-600">
        <Progress done={done} total={total} />
        <span>
          {submitted
            ? "Submitted for review."
            : done === total
              ? "All required sections complete."
              : `${total - done} required section${total - done === 1 ? "" : "s"} left.`}
        </span>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={done !== total || submitted}
        className="inline-flex items-center gap-1.5 bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitted ? "Submitted" : submitLabel}
      </button>
    </div>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}
