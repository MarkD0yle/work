import type { ReactNode } from "react";
import type { DealStatus } from "./model";
import { CHIP, FOCUS, STATUS, STATUS_META } from "./format";

/* Square-cornered primitives for the CLO Deal Monitor. Ink (neutral-900)
 * is the accent: active toggles, focus rings, the selected deal and the
 * selected quality-test row. */

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
  hideLabel = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  hideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {!hideLabel && <MicroLabel>{label}</MicroLabel>}
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
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-neutral-900">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

export function Swatch({ color, className = "h-2.5 w-2.5" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 ${className}`} style={{ background: color }} />;
}

export function LegendItem({ color, children, line, dashed }: { color: string; children: ReactNode; line?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
      {line ? (
        <span
          aria-hidden
          className="inline-block h-0 w-4 border-t-2"
          style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
        />
      ) : (
        <Swatch color={color} />
      )}
      {children}
    </span>
  );
}

export function StatusChip({ status, size = "md" }: { status: DealStatus; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold tracking-wide whitespace-nowrap uppercase ${m.chip} ${
        size === "sm" ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      <Swatch color={m.color} className="h-2 w-2" />
      {m.label}
    </span>
  );
}

export type TestState = "pass" | "thin" | "fail";

/** Pass / Thin / Fail chip for a single test, always icon + label. */
export function TestChip({ state, size = "md" }: { state: TestState; size?: "sm" | "md" }) {
  const meta = {
    pass: { label: "Pass", chip: CHIP.good, icon: <CheckIcon color={STATUS.good} /> },
    thin: { label: "Thin", chip: CHIP.warn, icon: <AlertIcon color={STATUS.warn} /> },
    fail: { label: "Fail", chip: CHIP.bad, icon: <CrossIcon color={STATUS.bad} /> },
  }[state];
  return (
    <span
      className={`inline-flex items-center gap-1 border font-semibold tracking-wide whitespace-nowrap uppercase ${meta.chip} ${
        size === "sm" ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-sm font-medium text-neutral-700">{title}</div>
      <p className="mt-1 max-w-sm text-[11px] text-neutral-500">{body}</p>
      {action}
    </div>
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
export function ChevronIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 10"
      className="pointer-events-none absolute top-1/2 right-2 h-2.5 w-2.5 -translate-y-1/2 text-neutral-500"
    >
      <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
