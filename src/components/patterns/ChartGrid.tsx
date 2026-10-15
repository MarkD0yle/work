import type { ReactNode } from "react";
import { cx, space, tone as toneTokens, type Tone } from "./tokens";

/* ChartGrid — lays chart cards on one grid with one gap.
 *
 * A chart card is a SectionCard with a chart inside; this owns only the
 * arrangement. `span` lets a primary chart take two columns so the
 * screen has a lead chart and supporting ones, not four equal boxes.
 *
 * Legend — the swatch + label row under or beside a chart. Put it next to
 * the chart it explains, never in a separate card. */

const COLS = { 1: "grid-cols-1", 2: "lg:grid-cols-2", 3: "md:grid-cols-2 xl:grid-cols-3" } as const;

export function ChartGrid({ columns = 2, children }: { columns?: keyof typeof COLS; children: ReactNode }) {
  return <div className={cx("grid grid-cols-1", space.gap, COLS[columns])}>{children}</div>;
}

export function ChartSpan({ span = 2, children }: { span?: 1 | 2 | 3; children: ReactNode }) {
  const cls = span === 3 ? "lg:col-span-2 xl:col-span-3" : span === 2 ? "lg:col-span-2" : "";
  return <div className={cx("min-w-0", cls)}>{children}</div>;
}

export function Legend({ items }: { items: { label: string; tone: Tone; shape?: "square" | "line" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
          <span aria-hidden className={cx(it.shape === "line" ? "h-0.5 w-3" : "h-2.5 w-2.5", toneTokens[it.tone].solid)} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
