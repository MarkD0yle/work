import type { ReactNode } from "react";
import { button, cx, text } from "./tokens";

/* EmptyState — what an empty region says.
 *
 * Three kinds, because "nothing here" means different things:
 *  - clear:    nothing needs you (good news — say so)
 *  - filtered: your filters hid everything (offer to clear them)
 *  - first:    nothing exists yet (offer to create the first one)
 */

const GLYPH = { clear: "✓", filtered: "∅", first: "+" } as const;

export function EmptyState({
  kind = "filtered",
  title,
  description,
  action,
  compact = false,
}: {
  kind?: keyof typeof GLYPH;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}) {
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "px-4 py-6" : "px-6 py-12")}>
      <span
        aria-hidden
        className={cx(
          "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm",
          kind === "clear" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
        )}
      >
        {GLYPH[kind]}
      </span>
      <div className={text.title}>{title}</div>
      {description && <p className={cx("mt-1 max-w-sm", text.muted)}>{description}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className={cx("mt-4", button.secondary)}>
          {action.label}
        </button>
      )}
    </div>
  );
}
