import { useEffect, useRef, type ReactNode } from "react";
import { CHIP, FOCUS, type Tone } from "./format";

/* Square-cornered primitives for the Mortgage Pipeline page. Ink
 * (neutral-900) is the accent: active toggles, focus rings, the selected
 * stage, checked boxes. */

export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold tracking-widest text-neutral-400 uppercase ${className}`}>
      {children}
    </span>
  );
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-col gap-1">
      <MicroLabel>{label}</MicroLabel>
      <div role="group" aria-label={label} className="flex border border-neutral-200 bg-white">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} font-medium whitespace-nowrap transition ${FOCUS} ${
                on ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type View = "chart" | "table";

/** Chart | Table toggle for a chart card's header (the accessible twin). */
export function ViewToggle({ value, onChange, name }: { value: View; onChange: (v: View) => void; name: string }) {
  return (
    <div role="group" aria-label={`${name} view`} className="flex shrink-0 border border-neutral-200 bg-white">
      {(["chart", "table"] as const).map((v) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={`px-2 py-0.5 text-[11px] font-medium capitalize transition ${FOCUS} ${
              on ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
            }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  right,
  id,
}: {
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
  id?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-neutral-900">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Swatch({ color, className = "h-2.5 w-2.5" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 ${className}`} style={{ background: color }} />;
}

export function LegendItem({
  color,
  children,
  line,
  dashed,
}: {
  color: string;
  children: ReactNode;
  line?: boolean;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
      {line ? (
        dashed ? (
          <span aria-hidden className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
        ) : (
          <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: color }} />
        )
      ) : (
        <Swatch color={color} />
      )}
      {children}
    </span>
  );
}

export function Chip({
  tone,
  children,
  size = "md",
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 border font-semibold tracking-wide whitespace-nowrap uppercase ${CHIP[tone]} ${
        size === "sm" ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/* Square checkbox. The native control is kept (keyboard, form semantics,
 * indeterminate for screen readers) but drawn square: native checkboxes
 * render with rounded corners, which the zero-radius rule forbids. */
export function Check({
  checked,
  indeterminate = false,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 align-middle">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-label={id ? undefined : label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-3.5 w-3.5 cursor-pointer appearance-none border ${
          on ? "border-neutral-900 bg-neutral-900" : "border-neutral-300 bg-white hover:border-neutral-500"
        } ${FOCUS}`}
      />
      {on && (
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 h-3.5 w-3.5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-hidden
        >
          {indeterminate && !checked ? <path d="M4 8h8" /> : <path d="M3.5 8.5l3 3 6-7" />}
        </svg>
      )}
    </span>
  );
}

export type SortDir = "asc" | "desc";

/** A sortable column header: the `th` carries aria-sort, the button sorts. */
export function SortTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
  className = "",
  title,
}: {
  label: ReactNode;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-2 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase ${FOCUS} ${
          active ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-800"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span aria-hidden className={active ? "" : "opacity-0"}>
          {active && dir === "desc" ? "↓" : "↑"}
        </span>
      </button>
    </th>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-sm font-medium text-neutral-700">{title}</div>
      <p className="mt-1 max-w-md text-[11px] text-neutral-500">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* --- icons (square-capped strokes) -------------------------------------- */

export function AlertIcon({ color, className = "h-3 w-3" }: { color: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={`shrink-0 ${className}`}>
      <path d="M6 1.5 11 10.5H1Z" fill={color} />
      <path d="M6 4.8v2.6M6 8.6v.6" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}
export function ClockIcon({ color, className = "h-3 w-3" }: { color: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={`shrink-0 ${className}`}>
      <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M6 3.5V6h2" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
export function CheckIcon({ color, className = "h-3 w-3" }: { color: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={`shrink-0 ${className}`}>
      <path d="M2 6.4 4.8 9 10 3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
