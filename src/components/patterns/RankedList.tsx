import type { ReactNode } from "react";
import { ProgressBar } from "./ProgressBar";
import { border, cx, focus, surface, text, type Tone } from "./tokens";

/* RankedList — top N of something, sorted, with a bar for scale.
 *
 * Brokers by cost, counterparties by exposure, desks by breaches. The bar
 * is scaled to the largest item, not to 100%, so differences show. Rank
 * number on the left; the value on the right is the exact number.
 * The list sorts itself — callers pass items in any order. */

export type RankedItem = {
  id: string;
  label: ReactNode;
  value: number;
  display?: string;
  sublabel?: string;
  tone?: Tone;
};

export function RankedList({
  items,
  limit = 10,
  order = "desc",
  onSelect,
  label,
}: {
  items: RankedItem[];
  limit?: number;
  /** "asc" when lower is better, e.g. slippage. */
  order?: "asc" | "desc";
  onSelect?: (id: string) => void;
  label: string;
}) {
  const sorted = [...items].sort((a, b) => (order === "desc" ? b.value - a.value : a.value - b.value)).slice(0, limit);
  const max = Math.max(...sorted.map((i) => Math.abs(i.value)), 1);
  return (
    <ol aria-label={label} className={cx("divide-y", border.divide)}>
      {sorted.map((it, i) => {
        const row = (
          <>
            <span className="w-5 shrink-0 text-right text-[11px] text-neutral-400 tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-neutral-900">{it.label}</span>
                <span className="text-xs text-neutral-900 tabular-nums">{it.display ?? it.value.toLocaleString()}</span>
              </div>
              {it.sublabel && <div className={text.muted}>{it.sublabel}</div>}
              <div className="mt-1">
                <ProgressBar value={Math.abs(it.value)} max={max} tone={it.tone ?? "neutral"} label={`${String(it.display ?? it.value)}`} />
              </div>
            </div>
          </>
        );
        return (
          <li key={it.id}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(it.id)} className={cx("flex w-full items-start gap-3 py-2 text-left", surface.hover, focus)}>
                {row}
              </button>
            ) : (
              <div className="flex items-start gap-3 py-2">{row}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
