import { useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { button, cx, focus, text } from "./tokens";

/* ComparePanel — two or three pinned records, side by side.
 *
 * For "which one?" decisions: quotes from different brokers, this trade
 * against its amendment, candidate funds. The user pins items from the main
 * list; the panel lines their fields up in columns. Rows where the values
 * differ are tinted, and "Differences only" hides the rest. Set `better` on a
 * numeric field to mark the winning value in each row.
 *
 * Three items is the ceiling: a fourth column leaves no room for the values.
 * With fewer than two items it asks the user to pin another, rather than
 * showing a table of one. */

export type CompareItem = { id: string; title: string; subtitle?: string };

export type CompareField = {
  label: string;
  /** One value per item, in the same order as `items`. */
  values: Array<string | number | null>;
  /** Optional display for a value (units, currency). Raw values are still compared. */
  format?: (v: string | number | null) => ReactNode;
  mono?: boolean;
  /** Marks the best number in the row. */
  better?: "high" | "low";
};

export const COMPARE_MAX = 3;

function bestIndex(values: CompareField["values"], better: "high" | "low"): number {
  let best = -1;
  values.forEach((v, i) => {
    if (typeof v !== "number") return;
    if (best === -1 || (better === "high" ? v > (values[best] as number) : v < (values[best] as number))) best = i;
  });
  // A tie is not a win.
  const tied = values.filter((v) => v === values[best]).length > 1;
  return tied ? -1 : best;
}

export function ComparePanel({
  items,
  fields,
  onRemove,
  onClear,
}: {
  items: CompareItem[];
  fields: CompareField[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [diffOnly, setDiffOnly] = useState(false);

  if (items.length < 2) {
    return (
      <EmptyState
        kind="first"
        title={items.length === 0 ? "Nothing pinned yet" : "Pin one more to compare"}
        description={`Pin 2 to ${COMPARE_MAX} items from the list. Their fields line up here.`}
        compact
      />
    );
  }

  const rows = fields.map((f) => ({ f, differs: f.values.some((v) => String(v) !== String(f.values[0])), best: f.better ? bestIndex(f.values, f.better) : -1 }));
  const shown = diffOnly ? rows.filter((r) => r.differs) : rows;
  const differing = rows.filter((r) => r.differs).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-2.5">
        <label className={cx("flex items-center gap-2", text.body)}>
          <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className={cx("h-3.5 w-3.5 accent-neutral-900", focus)} />
          Differences only
          <span className={cx("tabular-nums", text.muted)}>
            ({differing} of {fields.length})
          </span>
        </label>
        <button type="button" onClick={onClear} className={button.ghost}>
          Clear all
        </button>
      </div>

      <table className="w-full table-fixed border-collapse text-xs">
        <caption className="sr-only">Comparison of {items.map((i) => i.title).join(", ")}</caption>
        <thead>
          <tr className="border-b border-neutral-200 align-top">
            <th scope="col" className="w-24 px-5 py-3 text-left">
              <span className="sr-only">Field</span>
            </th>
            {items.map((item) => (
              <th key={item.id} scope="col" className="px-2 py-3 text-left font-normal">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-neutral-900">{item.title}</div>
                    {item.subtitle && <div className={cx("truncate", text.muted)}>{item.subtitle}</div>}
                  </div>
                  <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title} from comparison`} className={cx("px-1 text-neutral-400 hover:text-neutral-900", focus)}>
                    ✕
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(({ f, differs, best }) => (
            <tr key={f.label} className={cx("border-b border-neutral-100", differs && "bg-amber-50")}>
              <th scope="row" className={cx("px-5 py-2 text-left align-top", text.label)}>
                {f.label}
              </th>
              {f.values.map((v, i) => (
                <td key={items[i]?.id ?? i} className={cx("px-2 py-2 align-top text-neutral-900", f.mono && "font-mono tabular-nums", best === i && "font-semibold text-emerald-700")}>
                  {v === null || v === "" ? "—" : f.format ? f.format(v) : v}
                  {best === i && <span className="sr-only"> (best)</span>}
                </td>
              ))}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={items.length + 1}>
                <EmptyState kind="clear" title="No differences" description="All fields match." compact />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
