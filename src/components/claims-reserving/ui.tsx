import type { ReactNode } from "react";

/* Square chrome shared by the Claims & Reserving page. */

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1";

export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold tracking-widest text-neutral-500 uppercase ${className}`}>
      {children}
    </span>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex border border-neutral-300 bg-white" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} font-medium transition ${FOCUS} ${
              on ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type CardView = "chart" | "table";

/** Card with a title block and a Chart | Table toggle on the right. */
export function ChartPanel({
  title,
  subtitle,
  view,
  onView,
  legend,
  footer,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  view: CardView;
  onView: (v: CardView) => void;
  legend?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col border border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{subtitle}</p>
        </div>
        <Seg
          size="sm"
          label={`${title} view`}
          value={view}
          onChange={onView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </header>
      {legend && view === "chart" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5 text-[11px] text-neutral-600">
          {legend}
        </div>
      )}
      <div className="min-w-0 flex-1 px-2 py-2">{children}</div>
      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">{footer}</div>
      )}
    </section>
  );
}

/* --- icons (square-cornered strokes) ------------------------------------ */

export function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}
export function IconUp({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M6 2 10.5 9.5h-9z" fill="currentColor" />
    </svg>
  );
}
export function IconDown({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M6 10 1.5 2.5h9z" fill="currentColor" />
    </svg>
  );
}
export function IconAlert({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M6 1 11 10.5H1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter" />
      <path d="M6 4.5v3M6 8.5v1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
export function IconOpen({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 3.5V6h2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
export function IconChevron({ open, className = "h-3 w-3" }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`${className} transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M4 2 8 6 4 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}
