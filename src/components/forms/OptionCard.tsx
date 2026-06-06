import type { ReactNode } from "react";

/* OptionCard — a large, clickable choice tile for radio or checkbox groups.
 * Selection is shown by a tinted border + a check/dot indicator so the state
 * reads at a glance, not just by subtle fill. `type` switches the indicator
 * shape (round = single choice, square = multi). */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  badge,
  icon,
  type = "radio",
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  type?: "radio" | "checkbox";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={type === "radio" ? "radio" : "checkbox"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {icon && (
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            selected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{title}</span>
          {badge}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
        )}
      </span>
      <span
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] font-bold text-white ${
          type === "radio" ? "rounded-full" : "rounded"
        } ${selected ? "border-neutral-900 bg-neutral-900" : "border-neutral-300 bg-white"}`}
      >
        {selected &&
          (type === "radio" ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ) : (
            "✓"
          ))}
      </span>
    </button>
  );
}
