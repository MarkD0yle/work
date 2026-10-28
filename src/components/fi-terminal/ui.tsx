import type { ReactNode } from "react";
import { t, type Side } from "./tokens";

/* Reusable FI terminal pieces. Square corners, 1px rules, amber headers. */

export function Panel({
  n,
  title,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  /** Bloomberg-style panel number, e.g. 1 → "1)". */
  n?: number;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col border ${t.border} ${t.panel} ${className}`}>
      <header className={`flex h-7 shrink-0 items-center gap-2 border-b ${t.border} px-2.5`}>
        {n !== undefined && <span className="text-[10px] font-bold text-amber-400">{n})</span>}
        <h2 className={t.label}>{title}</h2>
        <div className="flex-1" />
        {actions}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex border ${t.borderStrong}`}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${t.focus} ${
              on ? "bg-amber-400 text-black" : "text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The big two-button Buy / Sell switch. Direction is the one thing a ticket must never get wrong. */
export function SideToggle({ side, onChange, buyLabel = "Buy", sellLabel = "Sell" }: {
  side: Side;
  onChange: (s: Side) => void;
  buyLabel?: string;
  sellLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Trade direction" className="grid grid-cols-2 gap-1">
      {(["Buy", "Sell"] as const).map((s) => {
        const on = side === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s)}
            className={`py-2 text-[12px] font-bold uppercase tracking-widest transition ${t.focus} ${
              on
                ? s === "Buy"
                  ? "bg-sky-500 text-black"
                  : "bg-rose-500 text-black"
                : "bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-neutral-200"
            }`}
          >
            {s === "Buy" ? buyLabel : sellLabel}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, sub, valueClass = t.value }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className={t.colHead}>{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-neutral-500 tabular-nums">{sub}</p>}
    </div>
  );
}

/** Label / value row for definition-style panels. */
export function Row({ k, v, vClass = t.value }: { k: ReactNode; v: ReactNode; vClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-neutral-500">{k}</span>
      <span className={`tabular-nums ${vClass}`}>{v}</span>
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "amber" | "up" | "down" | "sky" }) {
  const map = {
    neutral: "border-neutral-700 text-neutral-400",
    amber: "border-amber-400/50 text-amber-300",
    up: "border-emerald-500/50 text-emerald-300",
    down: "border-rose-500/50 text-rose-300",
    sky: "border-sky-500/50 text-sky-300",
  } as const;
  return <span className={`inline-flex items-center border px-1 text-[9px] font-semibold uppercase tracking-wider ${map[tone]}`}>{children}</span>;
}
