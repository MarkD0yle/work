import type { ReactNode } from "react";
import type { ActionStatus, StressStatus } from "./model";
import { ACTION_META, FOCUS, STATUS, STRESS_META, TONE_CHIP, TONE_TEXT, type Tone } from "./format";

/* Square-cornered primitives for the Pension Scheme Funding page. Ink
 * (neutral-900) is the accent: active toggles, focus rings, the selected
 * stress row. The numbered SectionHeading is what makes the page read as
 * a trustee report rather than a grid of tiles. */

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
    <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 lg:px-5">
      <div className="min-w-0">
        <h3 id={id} className="text-sm font-semibold text-neutral-900">
          {title}
        </h3>
        {sub && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/** Numbered report section: a small numeral, the title, a one-line lead. */
export function SectionHeading({
  n,
  id,
  title,
  lead,
  right,
}: {
  n: string;
  id: string;
  title: string;
  lead?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-neutral-300 pt-5">
      <div className="flex items-baseline gap-4">
        <span aria-hidden className="font-mono text-[11px] font-semibold tracking-widest text-neutral-400 tabular-nums">
          {n}
        </span>
        <div>
          <h2 id={id} className="text-lg font-semibold tracking-tight text-neutral-950">
            <span className="sr-only">Section {n}: </span>
            {title}
          </h2>
          {lead && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral-500">{lead}</p>}
        </div>
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2">{right}</div>}
    </div>
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
          <span
            aria-hidden
            className="inline-block h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: color }}
          />
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

export function Chip({ tone, children, size = "md" }: { tone: Tone; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold tracking-wide whitespace-nowrap uppercase ${TONE_CHIP[tone]} ${
        size === "sm" ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {children}
    </span>
  );
}

export function StressChip({ status }: { status: StressStatus }) {
  const m = STRESS_META[status];
  const color = m.tone === "good" ? STATUS.good : m.tone === "warn" ? STATUS.warn : STATUS.bad;
  return (
    <Chip tone={m.tone}>
      {status === "covered" ? <CheckIcon color={color} /> : status === "tight" ? <AlertIcon color={color} /> : <CrossIcon color={color} />}
      {m.label}
    </Chip>
  );
}

export function ActionChip({ status, overdue }: { status: ActionStatus; overdue: boolean }) {
  const key = overdue ? "Overdue" : status;
  return (
    <Chip tone={ACTION_META[key].tone}>
      {key === "Complete" ? (
        <CheckIcon color={STATUS.good} />
      ) : key === "Overdue" ? (
        <AlertIcon color={STATUS.bad} />
      ) : key === "In progress" ? (
        <ClockIcon color={STATUS.warn} />
      ) : (
        <DotIcon color={STATUS.neutral} />
      )}
      {key}
    </Chip>
  );
}

/** Signed change with direction tone and a "vs" caption. */
export function Delta({ text, tone, vs }: { text: string; tone: Tone; vs?: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-xs">
      <span className={`font-medium ${TONE_TEXT[tone]}`}>
        {tone === "good" ? "▲ " : tone === "bad" ? "▼ " : ""}
        {text}
      </span>
      {vs && <span className="text-[11px] text-neutral-400">vs {vs}</span>}
    </span>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  className = "w-40",
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

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
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
      {action}
    </div>
  );
}

export function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:border-neutral-900 ${FOCUS}`}
    >
      {children}
    </button>
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
export function ClockIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M6 3.5V6h2" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
export function DotIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
      <rect x="3" y="3" width="6" height="6" fill={color} />
    </svg>
  );
}
