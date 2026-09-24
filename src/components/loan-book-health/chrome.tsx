import type { ReactNode } from "react";
import { ACCENT, FOCUS, SPARK_INK } from "./format";

/* Loan Book Health: card chrome, the segmented control and sparklines.
 * Square corners throughout (the zero-radius rule). */

export function Micro({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-semibold tracking-widest text-neutral-500 uppercase ${className}`}
    >
      {children}
    </span>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-neutral-200 bg-white">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`px-2 py-1 text-[11px] font-medium transition ${FOCUS} ${
              on ? "bg-indigo-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}


export function Card({
  title,
  subtitle,
  controls,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col border border-neutral-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </header>
      {children}
    </section>
  );
}

/** 12-point sparkline: muted line, current point in the accent (square). */
export function Sparkline({
  values,
  height = 28,
  label,
  className = "",
}: {
  values: number[];
  height?: number;
  label: string;
  className?: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * 100,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const last = pts[pts.length - 1];
  return (
    <div role="img" aria-label={label} className={`relative ${className}`} style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <polyline
          points={pts.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={SPARK_INK}
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden
        className="absolute block"
        style={{
          width: 6,
          height: 6,
          left: `calc(${last[0]}% - 3px)`,
          top: last[1] - 3,
          background: ACCENT,
          boxShadow: "0 0 0 1.5px #fff",
        }}
      />
    </div>
  );
}

export function EmptyInline({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-xs text-neutral-500">{text}</div>;
}
