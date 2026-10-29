import type { ReactNode } from "react";
import { TONE_CLASS, type Tone } from "./format";

/* Document chrome for the Capital Adequacy report: numbered sections,
 * figure captions with a Chart | Table twin, footnotes and the navy-accented
 * controls. Square corners throughout (the zero-radius rule). */

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1";

export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold tracking-widest text-neutral-500 uppercase ${className}`}>
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
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
            className={`${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs"} font-medium transition ${FOCUS} ${
              on ? "bg-blue-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectField<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  width,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  width: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </label>
      <div className="relative" style={{ width }}>
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const hit = options.find((o) => String(o.value) === e.target.value);
            if (hit) onChange(hit.value);
          }}
          className={`w-full appearance-none border border-neutral-300 bg-white py-1.5 pr-7 pl-2.5 text-xs font-medium text-neutral-900 hover:border-neutral-400 ${FOCUS}`}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-neutral-500"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

export type View = "chart" | "table";

export function ViewToggle({ value, onChange, label }: { value: View; onChange: (v: View) => void; label: string }) {
  return (
    <Segmented<View>
      size="sm"
      label={`${label} view`}
      value={value}
      onChange={onChange}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "Table" },
      ]}
    />
  );
}

export function Section({
  id,
  n,
  title,
  lead,
  children,
}: {
  id: string;
  n: number;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="border-t border-neutral-200 pt-10 pb-12"
      data-section
    >
      <div className="flex items-baseline gap-4">
        <span className="w-6 font-mono text-base font-semibold text-blue-900 tabular-nums">{n}</span>
        <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight text-neutral-950">
          {title}
        </h2>
      </div>
      {lead && <div className="mt-2 max-w-3xl pl-10 text-sm leading-relaxed text-neutral-600">{lead}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Figure({
  label,
  title,
  meta,
  view,
  onView,
  actions,
  children,
}: {
  label: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  view?: View;
  onView?: (v: View) => void;
  children: ReactNode;
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-neutral-200 pb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[10px] font-semibold tracking-widest text-blue-900 uppercase">
              {label}
            </span>
            <span className="text-sm font-semibold text-neutral-900">{title}</span>
          </div>
          {meta && <div className="mt-0.5 text-[11px] text-neutral-500">{meta}</div>}
        </div>
        {actions}
        {view && onView && <ViewToggle value={view} onChange={onView} label={title} />}
      </figcaption>
      <div className="pt-3">{children}</div>
    </figure>
  );
}

export function Footnotes({ items }: { items: { mark: string; text: ReactNode }[] }) {
  return (
    <ol className="mt-8 flex flex-col gap-1 border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-500">
      {items.map((f) => (
        <li key={f.mark} className="flex gap-1.5">
          <span className="w-3 shrink-0 text-right font-mono text-neutral-400">{f.mark}</span>
          <span>{f.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function Delta({ text, tone, srLabel }: { text: string; tone: Tone; srLabel?: string }) {
  const arrow = tone === "flat" ? "▬" : text.startsWith("+") ? "▲" : "▼";
  return (
    <span className={`whitespace-nowrap ${TONE_CLASS[tone]}`}>
      <span aria-hidden className="mr-1 text-[9px]">
        {arrow}
      </span>
      {text}
      {srLabel && <span className="sr-only"> {srLabel}</span>}
    </span>
  );
}

/** Compact table used as the accessible twin of each chart. */
export function TwinTable({
  caption,
  head,
  rows,
  foot,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
  foot?: ReactNode[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-neutral-200">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-2 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-2 py-1.5 text-left font-medium text-neutral-800">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="px-2 py-1.5 text-right font-mono text-neutral-800 tabular-nums">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-neutral-300">
              {foot.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-2 py-1.5 text-left font-semibold text-neutral-900">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="px-2 py-1.5 text-right font-mono font-semibold text-neutral-900 tabular-nums">
                    {c}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-neutral-300 bg-neutral-50 px-5 py-6">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 text-neutral-400">
          <rect x="1.75" y="1.75" width="12.5" height="12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5v4.5M8 10.5v1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {title}
      </div>
      {children && <div className="text-xs text-neutral-600">{children}</div>}
    </div>
  );
}
