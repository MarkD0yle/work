import type { ReactNode } from "react";
import type { Cause, SignOff, Zone } from "./model";
import { CAUSE_COLOR, FOCUS, SIGNOFF_META, STATUS, ZONE_META } from "./format";

/* Square-cornered primitives for the VaR Backtesting page. Ink (neutral-900)
 * is the accent: active toggles, focus rings, the selected desk. */

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

export function ZoneChip({ zone, size = "md" }: { zone: Zone; size?: "sm" | "md" }) {
  const m = ZONE_META[zone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold tracking-wide uppercase ${m.chip} ${
        size === "sm" ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      <Swatch color={m.color} className="h-2 w-2" />
      {m.label}
    </span>
  );
}

export function CauseChip({ cause }: { cause: Cause }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-neutral-700">
      <Swatch color={CAUSE_COLOR[cause]} className="h-2 w-2" />
      {cause}
    </span>
  );
}

export function PassFail({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${pass ? "text-emerald-700" : "text-rose-700"}`}
    >
      {pass ? <CheckIcon color={STATUS.good} /> : <CrossIcon color={STATUS.bad} />}
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

export function SignOffBadge({ status }: { status: SignOff }) {
  const m = SIGNOFF_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap ${m.text}`}>
      {status === "Approved" ? (
        <CheckIcon color={m.color} />
      ) : status === "Challenged" ? (
        <AlertIcon color={m.color} />
      ) : (
        <ClockIcon color={m.color} />
      )}
      {status}
    </span>
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
