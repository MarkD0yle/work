import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { Chart } from "highcharts";
import { ChartSlotContext } from "./chart-slot";

/* Shared chrome for the gallery cards.
 *
 * The cards carry the numbering, the chart-type label, the one-line note on
 * what the interaction demonstrates, and a local PNG export. Keeping all of
 * that here means the ten chart components stay pure Highcharts config plus
 * whatever state their own interaction needs.
 */

export function ChartCard({
  n,
  title,
  type,
  blurb,
  controls,
  footer,
  children,
}: {
  n: number;
  title: string;
  /** Highcharts series type, shown as a pill — the point of the gallery. */
  type: string;
  blurb: string;
  controls?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const chartRef = useRef<Chart | null>(null);
  const [hasChart, setHasChart] = useState(false);

  const slot = useMemo(
    () => ({
      register: (chart: Chart | null) => {
        chartRef.current = chart;
        setHasChart(Boolean(chart));
      },
    }),
    [],
  );

  const exportPng = useCallback(() => {
    // Offline export: renders client-side, never posts the chart anywhere.
    chartRef.current?.exportChartLocal({
      type: "image/png",
      filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      scale: 2,
    });
  }, [title]);

  return (
    <section className="flex flex-col border border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center bg-neutral-900 font-mono text-[10px] font-semibold text-white tabular-nums">
              {n}
            </span>
            <h2 className="truncate text-sm font-semibold text-neutral-900">
              {title}
            </h2>
            <span className="border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-neutral-500 uppercase">
              {type}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-neutral-500">{blurb}</p>
        </div>
        <button
          type="button"
          onClick={exportPng}
          disabled={!hasChart}
          title="Download PNG"
          aria-label={`Download ${title} as PNG`}
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border border-neutral-200 text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-700 disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M10 3a.75.75 0 0 1 .75.75v6.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72V3.75A.75.75 0 0 1 10 3ZM3.5 13.25a.75.75 0 0 1 .75.75v1.25h11.5V14a.75.75 0 0 1 1.5 0v1.5a1.25 1.25 0 0 1-1.25 1.25H4A1.25 1.25 0 0 1 2.75 15.5V14a.75.75 0 0 1 .75-.75Z" />
          </svg>
        </button>
      </header>

      {controls && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2">
          {controls}
        </div>
      )}

      <div className="min-w-0 flex-1 px-1 py-2">
        <ChartSlotContext.Provider value={slot}>
          {children}
        </ChartSlotContext.Provider>
      </div>

      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          {footer}
        </div>
      )}
    </section>
  );
}

/* --- control primitives ------------------------------------------------- */

export function ControlLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <ControlLabel>{label}</ControlLabel>}
      <div className="flex border border-neutral-200 bg-white" role="group">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`px-2 py-1 text-[11px] font-medium transition ${
                on
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
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

export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-indigo-600"
      />
      {children}
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  format: (value: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <ControlLabel>{label}</ControlLabel>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-28 accent-indigo-600"
      />
      <span className="w-14 font-mono text-[11px] tabular-nums text-neutral-700">
        {format(value)}
      </span>
    </div>
  );
}

/* Small readout used where a chart's selection needs to say something back. */
export function Readout({
  items,
}: {
  items: { label: string; value: string; tone?: "pos" | "neg" }[];
}) {
  return (
    <dl className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-1.5">
          <dt className="text-[10px] tracking-wide text-neutral-400 uppercase">
            {i.label}
          </dt>
          <dd
            className={`font-mono text-[11px] font-semibold tabular-nums ${
              i.tone === "pos"
                ? "text-emerald-600"
                : i.tone === "neg"
                  ? "text-rose-600"
                  : "text-neutral-800"
            }`}
          >
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
