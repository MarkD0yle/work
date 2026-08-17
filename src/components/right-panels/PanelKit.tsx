import { type ReactNode } from "react";
import { SPARK_STROKE, TONES, type Tone } from "./panel-tokens";

/* PanelKit — the shared chrome every right-panel example is built from.
 *
 * The ten examples on the Right Panel Patterns page differ in *content
 * pattern* (a trade ticket, a tabbed 360, a live depth ladder…), not in
 * chrome. Factoring the frame out here keeps those differences honest: when
 * two panels look different it is because the pattern differs, not because
 * someone re-derived the header padding.
 *
 * A panel is a region, not a modal — it docks inside a sized parent column,
 * never traps focus, and never overlays the work surface. Compose as:
 *
 *   <PanelFrame>
 *     <PanelHeader … />
 *     <PanelBody>…</PanelBody>
 *     <PanelFooter>…</PanelFooter>   // optional, pinned
 *   </PanelFrame>
 */

/* ---------------------------------------------------------------- frame */

export function PanelFrame({
  accent = "neutral",
  label,
  children,
}: {
  /** Left edge accent — the panel's loudest severity signal. */
  accent?: Tone;
  label: string;
  children: ReactNode;
}) {
  const border =
    accent === "neutral" ? "border-l-neutral-200" : TONES[accent].border;
  return (
    <aside
      role="region"
      aria-label={label}
      className={`flex h-full min-h-0 flex-col overflow-hidden border-l-2 bg-white ${border}`}
    >
      {children}
    </aside>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  subtitle,
  tone,
  badge,
  onClose,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  /** Renders a status dot beside the title. */
  tone?: Tone;
  badge?: ReactNode;
  onClose?: () => void;
  /** Extra header content — tabs, a segmented control, a search box. */
  children?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-neutral-200 px-5 pt-4">
      <div className="flex items-start gap-3 pb-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              {eyebrow}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            {tone && (
              <span
                aria-hidden
                className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${TONES[tone].dot}`}
              />
            )}
            <h2 className="truncate text-base font-semibold tracking-tight text-neutral-900">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <div className="mt-1 text-xs text-neutral-500">{subtitle}</div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-1 shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      {children}
    </header>
  );
}

export function PanelBody({
  children,
  padded = false,
}: {
  children: ReactNode;
  /** Most panels use PanelSection for their own padding; set for freeform. */
  padded?: boolean;
}) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto ${padded ? "p-5" : ""}`}>
      {children}
    </div>
  );
}

/* Pinned action bar. Sits outside the scroll region so the primary action is
 * always reachable — the whole point of a docked panel over a drawer. */
export function PanelFooter({
  children,
  note,
}: {
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <footer className="shrink-0 border-t border-neutral-200 bg-white px-5 py-3">
      {note && <div className="mb-2 text-[11px] text-neutral-500">{note}</div>}
      <div className="flex items-center gap-2">{children}</div>
    </footer>
  );
}

/* -------------------------------------------------------------- sections */

export function PanelSection({
  title,
  trailing,
  children,
  last = false,
  dense = false,
}: {
  title?: string;
  trailing?: ReactNode;
  children: ReactNode;
  last?: boolean;
  dense?: boolean;
}) {
  return (
    <section
      className={`px-5 ${dense ? "py-3" : "py-4"} ${
        last ? "" : "border-b border-neutral-200"
      }`}
    >
      {(title || trailing) && (
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          {title && (
            <h3 className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              {title}
            </h3>
          )}
          {trailing && (
            <span className="text-[11px] text-neutral-500">{trailing}</span>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* Dense label/value rows — the workhorse of reference and detail panels. */
export function KeyValueRows({
  rows,
}: {
  rows: { label: string; value: ReactNode; mono?: boolean }[];
}) {
  return (
    <dl className="divide-y divide-neutral-100">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline gap-3 py-1.5">
          <dt className="w-32 shrink-0 text-xs text-neutral-500">{r.label}</dt>
          <dd
            className={`min-w-0 flex-1 text-right text-xs font-medium text-neutral-900 ${
              r.mono === false ? "" : "tabular-nums"
            }`}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* 2-up bordered grid — for the four or six figures that anchor a panel. */
export function MetaGrid({
  items,
  cols = 2,
}: {
  items: { label: string; value: ReactNode; tone?: Tone }[];
  cols?: 2 | 3;
}) {
  return (
    <section
      className={`grid ${cols === 3 ? "grid-cols-3" : "grid-cols-2"} border-b border-neutral-200`}
    >
      {items.map((item, i) => {
        const borders = [
          i % cols !== 0 ? "border-l border-neutral-200" : "",
          i >= cols ? "border-t border-neutral-200" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={item.label} className={`px-5 py-3 ${borders}`}>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              {item.label}
            </div>
            <div
              className={`mt-1 text-sm font-semibold tabular-nums ${
                item.tone ? TONES[item.tone].text : "text-neutral-900"
              }`}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ bits */

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${t.bg} ${t.text} ${t.border}`}
    >
      {children}
    </span>
  );
}

/* Panel-internal tab strip. Underline tabs so it never reads as a page-level
 * nav — the panel is subordinate to the surface behind it. */
export function PanelTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Panel sections">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-xs font-medium transition ${
              on
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${
                  on
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* Horizontal utilisation / threshold bar. `marker` drops a tick at a limit. */
export function MeterBar({
  value,
  tone = "info",
  marker,
}: {
  /** 0–100. */
  value: number;
  tone?: Tone;
  marker?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
      <div
        className={`h-full rounded-full ${TONES[tone].solid}`}
        style={{ width: `${pct}%` }}
      />
      {marker !== undefined && (
        <div
          aria-hidden
          className="absolute top-0 h-full w-px bg-neutral-900"
          style={{ left: `${Math.max(0, Math.min(100, marker))}%` }}
        />
      )}
    </div>
  );
}

/* Tiny line sparkline — panels rarely have room for a real chart. */
export function MiniSpark({
  points,
  tone = "info",
  width = 96,
  height = 24,
}: {
  points: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / span) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = SPARK_STROKE[tone];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

/* ---------------------------------------------------------------- inputs */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          {label}
        </span>
        {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}


export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "neutral",
  full = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** `positive`/`negative` give the buy/sell colouring a ticket needs. */
  tone?: Tone;
  full?: boolean;
}) {
  const bg =
    tone === "positive"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : tone === "negative"
        ? "bg-rose-600 hover:bg-rose-700"
        : "bg-neutral-900 hover:bg-neutral-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "flex-1" : ""} rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:bg-neutral-300 ${bg}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${full ? "flex-1" : ""} rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100`}
    >
      {children}
    </button>
  );
}

/* Empty / resting state — what the column shows with nothing selected. */
export function PanelEmpty({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-neutral-400"
        >
          <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11Zm9 0v11h3.5v-11H12Z" />
        </svg>
      </div>
      <div className="text-sm font-medium text-neutral-700">{title}</div>
      <div className="text-xs text-neutral-500">{detail}</div>
    </div>
  );
}
