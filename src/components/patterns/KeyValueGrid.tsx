import type { ReactNode } from "react";
import { border, cx, text } from "./tokens";

/* KeyValueGrid — the facts about one record.
 *
 * Order detail, trade economics, a review step's summary. Label above
 * value in columns for scanning; `layout="rows"` puts label left / value
 * right for narrow side panels. Empty values render an em dash so a gap
 * reads as "none", not "broken". Mark changed fields to show a diff. */

export type KeyValue = {
  label: string;
  value: ReactNode;
  /** Shows the old value struck through — amendments and reviews. */
  previous?: ReactNode;
  mono?: boolean;
};

const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" } as const;

export function KeyValueGrid({
  items,
  columns = 2,
  layout = "stacked",
}: {
  items: KeyValue[];
  columns?: keyof typeof COLS;
  layout?: "stacked" | "rows";
}) {
  const show = (v: ReactNode) => (v === null || v === undefined || v === "" ? "—" : v);

  if (layout === "rows") {
    return (
      <dl className={cx("divide-y", border.divide)}>
        {items.map((it) => (
          <div key={it.label} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className={text.label}>{it.label}</dt>
            <dd className={cx("text-right text-xs text-neutral-900", it.mono && "font-mono tabular-nums")}>
              {it.previous !== undefined && <s className="mr-1.5 text-neutral-400">{show(it.previous)}</s>}
              {show(it.value)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cx("grid gap-x-6 gap-y-3", COLS[columns])}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className={text.label}>{it.label}</dt>
          <dd className={cx("mt-0.5 truncate text-xs text-neutral-900", it.mono && "font-mono tabular-nums", it.previous !== undefined && "bg-amber-50")}>
            {it.previous !== undefined && <s className="mr-1.5 text-neutral-400">{show(it.previous)}</s>}
            {show(it.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
