import type { ReactNode } from "react";
import type { Status } from "./model";
import { FOCUS, STATUS_META } from "./format";

/* Square-cornered primitives for the Banking Book Rate Risk page. Ink
 * (neutral-900) is the accent: active toggles, focus rings, the selected
 * scenario card. */

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

/** Labelled native select with a square chevron, for the header filters. */
export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  className = "w-36",
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>
        <MicroLabel>{label}</MicroLabel>
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={`h-[26px] appearance-none border border-neutral-200 bg-white pr-7 pl-2.5 text-xs font-medium text-neutral-900 hover:border-neutral-400 ${FOCUS} ${className}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 10 10"
          className="pointer-events-none absolute top-1/2 right-2 h-2.5 w-2.5 -translate-y-1/2 text-neutral-500"
        >
          <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
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

export function LegendItem({ color, children, line }: { color: string; children: ReactNode; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
      {line ? (
        <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: color }} />
      ) : (
        <Swatch color={color} />
      )}
      {children}
    </span>
  );
}

export function StatusChip({ status, label, size = "md" }: { status: Status; label?: string; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold tracking-wide whitespace-nowrap uppercase ${m.chip} ${
        size === "sm" ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {status === "bad" ? <CrossIcon color={m.color} /> : status === "warn" ? <AlertIcon color={m.color} /> : <CheckIcon color={m.color} />}
      {label ?? m.label}
    </span>
  );
}

/** A plain bordered chip for categorical labels (hedge purpose, bucket). */
export function TextChip({ children, swatch }: { children: ReactNode; swatch?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-neutral-700">
      {swatch && <Swatch color={swatch} className="h-2 w-2" />}
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-sm font-medium text-neutral-700">{title}</div>
      <p className="mt-1 max-w-md text-[11px] text-neutral-500">{body}</p>
      {action}
    </div>
  );
}

export type SortDir = "asc" | "desc";

/** A sortable column header: the whole cell is the button, aria-sort on the th. */
export function SortTh<K extends string>({
  col,
  label,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  col: K;
  label: string;
  sort: { key: K; dir: SortDir };
  onSort: (k: K) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const on = sort.key === col;
  return (
    <th
      scope="col"
      aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 text-[10px] font-semibold tracking-wider whitespace-nowrap text-neutral-500 uppercase ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase hover:text-neutral-900 ${FOCUS} ${on ? "text-neutral-900" : ""}`}
      >
        {label}
        <span aria-hidden className={`text-[9px] ${on ? "text-neutral-900" : "text-neutral-300"}`}>
          {on ? (sort.dir === "asc" ? "▲" : "▼") : "▽"}
        </span>
      </button>
    </th>
  );
}

/* --- icons (square-capped strokes) -------------------------------------- */

export function CheckIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <path d="M2 6.4 4.8 9 10 3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
export function CrossIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <path d="M3 3l6 6M9 3 3 9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
export function AlertIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <path d="M6 1.5 11 10.5H1Z" fill={color} />
      <path d="M6 4.8v2.6M6 8.6v.6" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}
