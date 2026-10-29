import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* Chrome for the Fund Flows bento: the tile shell, the square view toggle,
 * the period control and the dropdown multi-select. Zero radius throughout;
 * sky is the accent for active states and focus rings. */

export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1";

export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-semibold tracking-widest text-neutral-400 uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/* --- tile ----------------------------------------------------------------- */

export function Tile({
  area,
  title,
  subtitle,
  actions,
  children,
  footer,
  style,
}: {
  area: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      style={{ gridArea: area, ...style }}
      className="flex min-w-0 flex-col border border-neutral-200 bg-white"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <h2 id={id} className="text-sm font-semibold text-neutral-900">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-w-0 flex-1 px-4 pb-3">{children}</div>
      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] leading-snug text-neutral-500">
          {footer}
        </div>
      )}
    </section>
  );
}

/* --- segmented controls ------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "sm",
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  /** accessible name for the group */
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-neutral-200 bg-white">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`${size === "md" ? "h-8 px-3 text-xs" : "h-6 px-2 text-[11px]"} font-medium transition ${FOCUS_RING} ${
              on ? "bg-sky-700 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type View = "chart" | "table";

export function ViewToggle({
  value,
  onChange,
  chartLabel = "Chart",
  subject,
}: {
  value: View;
  onChange: (v: View) => void;
  chartLabel?: string;
  subject: string;
}) {
  return (
    <Segmented<View>
      label={`${subject}: view as`}
      value={value}
      onChange={onChange}
      options={[
        { value: "chart", label: chartLabel },
        { value: "table", label: "Table" },
      ]}
    />
  );
}

/* --- multi-select ------------------------------------------------------------- */

export interface MultiOption<T extends string> {
  id: T;
  label: string;
  swatch?: string;
  meta?: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`h-3 w-3 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function MultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: MultiOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const all = value.length === options.length;
  const none = value.length === 0;
  const toggle = (id: T) =>
    onChange(
      value.includes(id)
        ? value.filter((v) => v !== id)
        : options.map((o) => o.id).filter((o) => o === id || value.includes(o)),
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label}: ${all ? "all" : value.length} of ${options.length} selected`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-2 border pr-2 pl-2.5 text-xs font-medium transition ${FOCUS_RING} ${
          all
            ? "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
            : none
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-sky-300 bg-sky-50 text-sky-950 hover:border-sky-400"
        }`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-neutral-300">
          ·
        </span>
        <span
          aria-hidden="true"
          className={`inline-flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums ${
            all ? "bg-neutral-100 text-neutral-600" : none ? "bg-rose-600 text-white" : "bg-sky-700 text-white"
          }`}
        >
          {all ? "All" : value.length}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Filter by ${label.toLowerCase()}`}
          className="absolute top-full left-0 z-50 mt-1 w-64 border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <MicroLabel>{label}</MicroLabel>
            <div className="flex items-center gap-1 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => onChange(options.map((o) => o.id))}
                disabled={all}
                className={`px-1 text-sky-700 hover:text-sky-900 disabled:text-neutral-300 ${FOCUS_RING}`}
              >
                Select all
              </button>
              <span aria-hidden="true" className="text-neutral-300">
                /
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={none}
                className={`px-1 text-sky-700 hover:text-sky-900 disabled:text-neutral-300 ${FOCUS_RING}`}
              >
                None
              </button>
            </div>
          </div>
          <fieldset className="py-1">
            <legend className="sr-only">{label}</legend>
            {options.map((o) => {
              const checked = value.includes(o.id);
              return (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-800 hover:bg-neutral-50"
                >
                  <span className="relative inline-flex h-3.5 w-3.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      className={`peer h-3.5 w-3.5 cursor-pointer appearance-none border border-neutral-300 bg-white checked:border-sky-700 checked:bg-sky-700 ${FOCUS_RING}`}
                    />
                    <svg
                      viewBox="0 0 14 14"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 hidden h-3.5 w-3.5 text-white peer-checked:block"
                    >
                      <path d="M3.2 7.3 5.9 10 10.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </span>
                  {o.swatch && (
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: o.swatch }} />
                  )}
                  <span className="flex-1">{o.label}</span>
                  {o.meta && (
                    <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{o.meta}</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        </div>
      )}
    </div>
  );
}

/* --- misc ----------------------------------------------------------------------- */

/** Square swatch that carries series identity next to neutral text. */
export function Swatch({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 ${className}`}
      style={{ background: color }}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-neutral-300">
        <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="text-sm font-semibold text-neutral-800">{title}</div>
      <div className="max-w-sm text-xs text-neutral-500">{body}</div>
      {action}
    </div>
  );
}
