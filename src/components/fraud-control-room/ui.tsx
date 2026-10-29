import type { CSSProperties, ReactNode } from "react";
import { C } from "./theme";

/* Chrome for the Fraud Control Room wall: panels, dark segmented controls,
 * the digit-flash ticker and the page-scoped CSS (keyframes + focus ring).
 * Square corners throughout. */

const CSS = `
.fcr { background: ${C.page}; color: ${C.t1}; color-scheme: dark; }
.fcr-panel { background: ${C.panel}; border: 1px solid ${C.line}; }
.fcr-focus:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 1px; }
.fcr-seg-btn { color: ${C.t2}; }
.fcr-seg-btn:hover { color: ${C.t1}; background: ${C.raised}; }
.fcr-seg-btn[aria-pressed="true"] { color: ${C.t1}; background: rgba(34, 211, 238, 0.14); box-shadow: inset 0 -2px 0 ${C.accent}; }
.fcr-btn { color: ${C.t2}; border: 1px solid ${C.line2}; background: transparent; }
.fcr-btn:hover { color: ${C.t1}; border-color: #3b4656; background: ${C.raised}; }
.fcr-row:hover > td { background: rgba(255, 255, 255, 0.025); }
.fcr-scroll { scrollbar-color: ${C.line2} transparent; scrollbar-width: thin; }
.fcr-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.fcr-scroll::-webkit-scrollbar-thumb { background: ${C.line2}; }
.fcr-scroll::-webkit-scrollbar-track { background: transparent; }
@keyframes fcr-flash { from { background-color: rgba(34, 211, 238, 0.32); } to { background-color: rgba(34, 211, 238, 0); } }
.fcr-flash { animation: fcr-flash 300ms ease-out; }
@keyframes fcr-row-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: none; }
}
.fcr-row-in > td { animation: fcr-row-in 420ms ease-out; }
.fcr-row-in > td:first-child { box-shadow: inset 2px 0 0 ${C.accent}; }
@keyframes fcr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.fcr-pulse { animation: fcr-pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .fcr-flash, .fcr-row-in > td, .fcr-pulse { animation: none !important; }
}
`;

export function FcrStyles() {
  return <style>{CSS}</style>;
}

export function MicroLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      className="text-[10px] font-semibold tracking-widest uppercase"
      style={{ color: C.t2, ...style }}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  meta,
  right,
  children,
  className = "",
  style,
  bodyClassName = "",
}: {
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  bodyClassName?: string;
}) {
  return (
    <section className={`fcr-panel flex min-h-0 min-w-0 flex-col ${className}`} style={style}>
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-3"
        style={{ borderColor: C.line, height: 34 }}
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="shrink-0 text-[12px] font-semibold" style={{ color: C.t1 }}>
            {title}
          </h2>
          {meta && (
            <span className="truncate text-[10px]" style={{ color: C.t2 }}>
              {meta}
            </span>
          )}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function DarkSegmented<T extends string>({
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
    <div role="group" aria-label={label} className="flex border" style={{ borderColor: C.line2 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`fcr-seg-btn fcr-focus font-medium whitespace-nowrap transition-colors ${
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type View = "chart" | "table";

export function ViewToggle({
  view,
  onChange,
  name,
}: {
  view: View;
  onChange: (v: View) => void;
  name: string;
}) {
  return (
    <DarkSegmented
      label={`${name} view`}
      size="sm"
      value={view}
      onChange={onChange}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "Table" },
      ]}
    />
  );
}

/**
 * Renders a value one character per span, keyed by position from the right
 * and the character itself. A digit that changes gets a new key, remounts,
 * and plays the 300 ms flash; digits that did not change keep their node and
 * stay still.
 */
export function FlashText({ text }: { text: string }) {
  const chars = Array.from(text);
  return (
    <span aria-hidden="true">
      {chars.map((c, i) => {
        const pos = chars.length - i;
        return (
          <span key={`${pos}:${c}`} className={/\d/.test(c) ? "fcr-flash" : undefined}>
            {c}
          </span>
        );
      })}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center"
      style={{ color: C.t2 }}
    >
      <span className="text-[10px] font-semibold tracking-widest uppercase">No data</span>
      <span className="text-[11px]">{children}</span>
    </div>
  );
}

/* Compact dark table used by the Chart | Table twins. */
export function TwinTable({
  head,
  rows,
  height,
  label,
}: {
  head: { label: string; align?: "left" | "right" }[];
  rows: ReactNode[][];
  height: number;
  label: string;
}) {
  return (
    <div className="fcr-scroll overflow-y-auto px-2 py-1" style={{ height }}>
      <table className="w-full border-collapse text-[11px]" aria-label={label}>
        <thead className="sticky top-0" style={{ background: C.panel }}>
          <tr>
            {head.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={`border-b px-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase ${
                  h.align === "right" ? "text-right" : "text-left"
                }`}
                style={{ color: C.t2, borderColor: C.line }}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="fcr-row">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`border-b px-1.5 py-1 ${
                    head[j]?.align === "right" ? "text-right font-mono tabular-nums" : "text-left"
                  }`}
                  style={{ borderColor: C.line, color: C.t1 }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
