import type { ReactNode } from "react";

/* Climate & Transition — chrome primitives. Square corners throughout (the
 * repo's zero-radius rule); the olive accent marks active state and focus. */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-1";

export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-semibold tracking-widest text-neutral-500 uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/** Small framework tag on a scorecard (TCFD, PCAF …). */
export function FrameworkTag({ children }: { children: ReactNode }) {
  return (
    <span className="border border-neutral-200 bg-neutral-50 px-1.5 py-px font-mono text-[9px] tracking-wide text-neutral-500 uppercase">
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
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className="flex border border-neutral-200 bg-white"
      role="group"
      aria-label={label}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`${size === "sm" ? "h-6 px-2 text-[11px]" : "h-8 px-3 text-xs"} font-medium whitespace-nowrap transition ${FOCUS} ${
              on ? "bg-lime-800 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectField<T extends string>({
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="leading-none">
        <MicroLabel>{label}</MicroLabel>
      </label>
      <div className="relative" style={{ width }}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={`h-8 w-full appearance-none border border-neutral-200 bg-white pr-7 pl-2.5 text-xs font-medium text-neutral-800 hover:border-neutral-300 ${FOCUS}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-neutral-400"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

/** Label stacked over a control group (segmented buttons). */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="leading-none">
        <MicroLabel>{label}</MicroLabel>
      </span>
      {children}
    </div>
  );
}

export type View = "chart" | "table";

export function ViewToggle({
  value,
  onChange,
  label,
}: {
  value: View;
  onChange: (v: View) => void;
  label: string;
}) {
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

export function Card({
  title,
  subtitle,
  actions,
  footer,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col border border-neutral-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2.5 text-[11px] text-neutral-500">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Signed delta; colour = direction × whether up is good. */
export function Delta({
  value,
  text,
  goodWhen,
  suffix,
}: {
  value: number;
  text: string;
  goodWhen: "up" | "down";
  suffix?: ReactNode;
}) {
  const flat = Math.abs(value) < 1e-9;
  const good = flat ? null : (value > 0) === (goodWhen === "up");
  const tone = good === null ? "text-neutral-500" : good ? "text-emerald-700" : "text-rose-600";
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className={`text-xs font-semibold ${tone}`}>
        <span aria-hidden className="mr-0.5 text-[9px]">
          {flat ? "■" : value > 0 ? "▲" : "▼"}
        </span>
        {text}
      </span>
      {suffix && <span className="text-[11px] text-neutral-500">{suffix}</span>}
    </span>
  );
}

/* Compact table styles shared by the chart-card table twins. */
export const TH =
  "px-3 py-2 text-left text-[10px] font-semibold tracking-wider text-neutral-500 uppercase whitespace-nowrap";
export const TD = "px-3 py-1.5 text-xs text-neutral-700 whitespace-nowrap";
export const TDN = "px-3 py-1.5 text-right font-mono text-xs text-neutral-800 tabular-nums whitespace-nowrap";

/* ------------------------------------------------------------------ *
 * Icons (16px grid, currentColor)
 * ------------------------------------------------------------------ */

type IconProps = { className?: string };

export function IconCheck({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
export function IconClock({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.5V8h3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
export function IconDash({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
/** Engaging: speech bubble. */
export function IconTalk({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M2.5 3h11v7.5H7L4 13v-2.5H2.5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
/** Escalated: stepped arrow up. */
export function IconEscalate({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M8 2.5 3 7.5h3V13h4V7.5h3z" fill="currentColor" />
    </svg>
  );
}
/** Voted against: ballot box with a cross. */
export function IconVote({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 5.5l5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
/** Divestment review: exit arrow. */
export function IconExit({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M9 2.5H2.5v11H9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8h7m-2.5-3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
export function IconFlag({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M3.5 14V2.5h8l-1.8 3 1.8 3h-8" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
export function IconMonitor({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="6.5" y="6.5" width="3" height="3" fill="currentColor" />
    </svg>
  );
}
