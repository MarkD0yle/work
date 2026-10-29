import { heatClass } from "./heat";
import { cx, focus, text } from "./tokens";

/* Heatmap — a value at every row × column crossing.
 *
 * Exposure by desk × tenor, exceptions by system × day. Colour is bucketed
 * into five steps so a cell can be read without a legend lookup; the value
 * is printed in each cell anyway. Use "diverging" when zero is the middle
 * (P&L, variance), "sequential" when more is simply more (counts, risk). */

export function Heatmap({
  rows,
  columns,
  values,
  scale = "sequential",
  format = (v) => v.toLocaleString(),
  onSelect,
  label,
}: {
  rows: string[];
  columns: string[];
  /** values[row][col] */
  values: number[][];
  scale?: "sequential" | "diverging";
  format?: (v: number) => string;
  onSelect?: (row: number, col: number) => void;
  label: string;
}) {
  const max = Math.max(...values.flat().map(Math.abs), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-[11px]">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {columns.map((c) => (
              <th key={c} scope="col" className={cx("px-1 pb-1 text-center font-medium", text.label)}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row" className={cx("pr-2 text-left font-medium whitespace-nowrap", text.label)}>
                {r}
              </th>
              {columns.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                const cls = cx("h-8 min-w-12 px-1 text-center tabular-nums", heatClass(v, max, scale));
                return (
                  <td key={c} className="p-0">
                    {onSelect ? (
                      <button type="button" onClick={() => onSelect(ri, ci)} aria-label={`${r}, ${c}: ${format(v)}`} className={cx("w-full hover:ring-2 hover:ring-neutral-900 hover:ring-inset", cls, focus)}>
                        {format(v)}
                      </button>
                    ) : (
                      <div className={cx("flex items-center justify-center", cls)}>{format(v)}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
