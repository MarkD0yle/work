import type { ReactNode } from "react";
import type { Regime, Status } from "./model";
import { REGIME_CHIP, REGIME_SHORT, FOCUS, STATUS_CHIP } from "./format";

/* Square-cornered primitives for the Settlement Fails console. Ink
 * (neutral-900) is the accent: active toggles, focus rings, selected chips. */

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
  options: { value: T; label: string }[];
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

/** A toggle chip for the market multi-select. */
export function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition ${FOCUS} ${
        on
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-neutral-800"
      }`}
    >
      {children}
    </button>
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
    <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-2.5">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-neutral-900">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
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

export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block border px-1.5 py-px text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase ${STATUS_CHIP[status]}`}
    >
      {status}
    </span>
  );
}

export function RegimeChip({ regime }: { regime: Regime }) {
  return (
    <span
      className={`inline-block border px-1.5 py-px text-[9px] font-semibold tracking-wide whitespace-nowrap uppercase ${REGIME_CHIP[regime]}`}
    >
      {REGIME_SHORT[regime]}
    </span>
  );
}

/** "Clear" affordance for a cross-filter, shown only while one is active. */
export function ClearButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-neutral-700 ${FOCUS}`}
    >
      {children}
      <span aria-hidden>✕</span>
    </button>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <span className="text-sm font-medium text-neutral-700">{title}</span>
      {body && <span className="max-w-md text-[11px] text-neutral-500">{body}</span>}
      {action}
    </div>
  );
}

/* --- icons (square-capped strokes) -------------------------------------- */

export function AlertIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <path d="M6 1.5 11 10.5H1Z" fill={color} />
      <path d="M6 4.8v2.6M6 8.6v.6" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}
export function CheckIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <path d="M2 6.4 4.8 9 10 3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
