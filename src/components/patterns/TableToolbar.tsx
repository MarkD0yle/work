import type { ReactNode } from "react";
import { border, button, cx, surface, text } from "./tokens";

/* TableToolbar — the bar directly above a table.
 *
 * Two modes, never both at once:
 *  - Browse: title + row count on the left, view actions (density,
 *    columns, export) on the right.
 *  - Selection: once rows are selected the bar swaps to "N selected" and
 *    the bulk actions, so the user can't miss what an action will touch.
 * Filters live in FilterBar, not here. */

export type BulkAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function TableToolbar({
  title,
  count,
  total,
  selectedCount = 0,
  onClearSelection,
  bulkActions = [],
  actions,
}: {
  title?: string;
  /** Rows shown after filters. */
  count: number;
  /** Rows before filters — shows "12 of 340". */
  total?: number;
  selectedCount?: number;
  onClearSelection?: () => void;
  bulkActions?: BulkAction[];
  /** View actions: density, columns, export. */
  actions?: ReactNode;
}) {
  const selecting = selectedCount > 0;
  return (
    <div
      className={cx(
        "flex min-h-11 flex-wrap items-center gap-3 border-b px-4 py-2",
        border.divider,
        selecting ? "bg-neutral-900 text-white" : surface.card,
      )}
    >
      {selecting ? (
        <>
          <span className="text-xs font-semibold tabular-nums" aria-live="polite">
            {selectedCount} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={cx(
                  "inline-flex items-center px-3 py-1.5 text-xs font-medium disabled:opacity-40",
                  a.variant === "primary" ? "bg-white text-neutral-900 hover:bg-neutral-200" : "border border-neutral-600 text-white hover:bg-neutral-800",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          {onClearSelection && (
            <button type="button" onClick={onClearSelection} className="ml-auto text-xs text-neutral-300 hover:text-white">
              Clear selection
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            {title && <h2 className={text.title}>{title}</h2>}
            <span className={cx(text.muted, "tabular-nums")} aria-live="polite">
              {total !== undefined && total !== count ? `${count.toLocaleString()} of ${total.toLocaleString()}` : count.toLocaleString()} rows
            </span>
          </div>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </>
      )}
    </div>
  );
}

/** Standard export button so every table offers export the same way. */
export function ExportButton({ onClick, label = "Export" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className={button.secondary}>
      <span aria-hidden>↓</span>
      {label}
    </button>
  );
}
