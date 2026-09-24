import type { ReactNode } from "react";
import { COLOR, type Quartile } from "./model";

/* Chrome for the Private Markets page. Square corners throughout. */

export const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:ring-offset-1 focus-visible:outline-none";

export type View = "chart" | "table";

export function ViewToggle({
  view,
  onChange,
  label,
}: {
  view: View;
  onChange: (v: View) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={`${label}: chart or table`}
      className="flex shrink-0 border border-neutral-200 bg-white"
    >
      {(["chart", "table"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`px-2 py-1 text-[11px] font-medium transition ${FOCUS} ${
            view === v
              ? "bg-fuchsia-700 text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          {v === "chart" ? "Chart" : "Table"}
        </button>
      ))}
    </div>
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
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col border border-neutral-200 bg-white ${className}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] leading-snug text-neutral-500">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Label/value pairs under a card header. */
export function Readout({
  items,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode }[];
}) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 px-4 pt-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-1.5">
          <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            {i.label}
          </dt>
          <dd className="text-[12px] font-semibold text-neutral-900">
            {i.value}
            {i.note && (
              <span className="ml-1 font-normal text-neutral-500">{i.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const Q_CLASS: Record<Quartile, string> = {
  1: "border-emerald-700 bg-emerald-700 text-white",
  2: "border-emerald-200 bg-emerald-50 text-emerald-800",
  3: "border-amber-200 bg-amber-50 text-amber-800",
  4: "border-rose-200 bg-rose-50 text-rose-700",
};

const Q_WORD: Record<Quartile, string> = {
  1: "Top quartile",
  2: "Second quartile",
  3: "Third quartile",
  4: "Bottom quartile",
};

export function QuartileBadge({
  q,
  context,
}: {
  q: Quartile;
  context?: string;
}) {
  const text = `${Q_WORD[q]}${context ? ` vs ${context}` : ""}`;
  return (
    <span
      title={text}
      aria-label={text}
      className={`inline-flex h-5 w-7 shrink-0 items-center justify-center border font-mono text-[10px] font-semibold ${Q_CLASS[q]}`}
    >
      Q{q}
    </span>
  );
}

export function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <span
      aria-hidden
      className="inline-block h-0 w-3 shrink-0 border-t-2 border-dashed align-middle"
      style={{ borderColor: color }}
    />
  ) : (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 align-middle"
      style={{ background: color }}
    />
  );
}

/** Tiny DPI + RVPI bar on a fixed 0–3.5× scale, with a tick at 1.0×. */
export function MiniMultiples({
  dpi,
  rvpi,
  width = 44,
  max = 3.5,
}: {
  dpi: number;
  rvpi: number;
  width?: number;
  max?: number;
}) {
  const d = Math.min(1, dpi / max);
  const t = Math.min(1, (dpi + rvpi) / max);
  return (
    <span
      aria-hidden
      className="relative inline-block h-2 shrink-0 bg-neutral-100"
      style={{ width }}
    >
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${d * 100}%`, background: COLOR.accent }}
      />
      <span
        className="absolute inset-y-0"
        style={{
          left: `${d * 100}%`,
          width: `${Math.max(0, t - d) * 100}%`,
          background: COLOR.accentLight,
          borderLeft: d > 0 ? "1px solid #fff" : undefined,
        }}
      />
      <span
        className="absolute -top-0.5 -bottom-0.5 w-px bg-neutral-500"
        style={{ left: `${(1 / max) * 100}%` }}
      />
    </span>
  );
}

/* Table cell classes shared by the chart twins and the main tables. */
const TH_BASE =
  "px-3 py-2 text-[10px] font-semibold tracking-widest whitespace-nowrap text-neutral-500 uppercase";
const TD_BASE = "px-3 py-1.5 font-mono text-[12px] tabular-nums text-neutral-800";
export const TH = `${TH_BASE} text-right`;
export const THL = `${TH_BASE} text-left`;
export const TD = `${TD_BASE} text-right`;
export const TDL = `${TD_BASE} text-left`;
