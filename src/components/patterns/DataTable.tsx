import { useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { border, cx, focus, surface } from "./tokens";

/* DataTable — the hand-rolled table for up to a few hundred rows.
 *
 * Rules it enforces so every table reads the same:
 *  - Numbers right-aligned with tabular figures; text left-aligned.
 *  - Sentence-case header, one size, sticky.
 *  - Two densities only: compact (blotters, monitors) and comfortable.
 *  - Sort on any column with a `sortValue`; one sort at a time.
 *  - Optional checkbox selection that feeds TableToolbar.
 *  - Empty result renders EmptyState, never a blank box.
 * For thousands of rows, grouping or pivoting use MonitorGrid (ag-grid). */

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Return a value to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  /** Tailwind width class, e.g. "w-32". */
  width?: string;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  density = "compact",
  selectable = false,
  selected,
  onSelectedChange,
  onRowClick,
  activeKey,
  empty,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  density?: "compact" | "comfortable";
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  onRowClick?: (row: T) => void;
  /** Highlights the row open in a side panel. */
  activeKey?: string | null;
  empty?: ReactNode;
  /** Accessible table name. */
  caption: string;
}) {
  const [sort, setSort] = useState<Sort>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const out = [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return sort.dir === "asc" ? out : out.reverse();
  }, [rows, columns, sort]);

  const cellPad = density === "compact" ? "px-3 py-1.5" : "px-4 py-2.5";
  const sel = selected ?? new Set<string>();
  const allOn = rows.length > 0 && rows.every((r) => sel.has(rowKey(r)));
  const someOn = !allOn && rows.some((r) => sel.has(rowKey(r)));

  function toggleAll() {
    onSelectedChange?.(allOn ? new Set() : new Set(rows.map(rowKey)));
  }
  function toggle(k: string) {
    const next = new Set(sel);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectedChange?.(next);
  }
  function cycleSort(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState kind="filtered" title="No rows match" description="Try removing a filter." compact />}</>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className={cx("sticky top-0 z-10", surface.card)}>
          <tr className={cx("border-b", border.divider)}>
            {selectable && (
              <th scope="col" className={cx("w-8", cellPad)}>
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = someOn;
                  }}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                  className={cx(cellPad, ALIGN[c.align ?? "left"], c.width, "font-medium whitespace-nowrap text-neutral-500")}
                >
                  {c.sortValue ? (
                    <button type="button" onClick={() => cycleSort(c.key)} className={cx("inline-flex items-center gap-1 hover:text-neutral-900", focus)}>
                      {c.header}
                      <span aria-hidden className="text-[9px] text-neutral-400">
                        {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const k = rowKey(row);
            const on = sel.has(k);
            const active = activeKey === k;
            return (
              <tr
                key={k}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  "border-b",
                  border.subtle,
                  onRowClick && "cursor-pointer",
                  active ? "bg-neutral-100" : on ? "bg-neutral-50" : surface.hover,
                )}
              >
                {selectable && (
                  <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select row ${k}`} checked={on} onChange={() => toggle(k)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(cellPad, ALIGN[c.align ?? "left"], c.align === "right" && "tabular-nums", "text-neutral-800")}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
