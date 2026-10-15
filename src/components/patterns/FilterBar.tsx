import type { ReactNode } from "react";
import { border, button, cx, focus, radius, surface } from "./tokens";

/* FilterBar — narrow a list or a screen.
 *
 * Search first (most used), then filters left to right in order of use,
 * then "Clear" once anything is active. Active filters show as removable
 * chips under the controls, so the user always sees why rows are missing.
 * Filters are slots: pass FilterSelect, ChipToggle or any control. */

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search",
  children,
  active = [],
  onClearAll,
  trailing,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  /** Filter controls. */
  children?: ReactNode;
  /** Applied filters, shown as removable chips. */
  active?: { key: string; label: string; onRemove: () => void }[];
  onClearAll?: () => void;
  /** Right-aligned extras, e.g. a saved-view picker. */
  trailing?: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-2 border-b px-4 py-2.5", border.divider, surface.card)}>
      <div className="flex flex-wrap items-center gap-2">
        {onSearch && (
          <label className="relative min-w-48 flex-1 sm:max-w-72">
            <span className="sr-only">{searchPlaceholder}</span>
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-neutral-400">
              ⌕
            </span>
            <input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className={cx("h-8 w-full border border-neutral-300 bg-white pr-2 pl-7 text-xs placeholder:text-neutral-400", radius.control, focus)}
            />
          </label>
        )}
        {children}
        {active.length > 0 && onClearAll && (
          <button type="button" onClick={onClearAll} className={button.ghost}>
            Clear all
          </button>
        )}
        {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
      </div>
      {active.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap gap-1.5">
          {active.map((f) => (
            <li key={f.key}>
              <button
                type="button"
                onClick={f.onRemove}
                aria-label={`Remove filter ${f.label}`}
                className={cx("inline-flex items-center gap-1 border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100", radius.pill, focus)}
              >
                {f.label}
                <span aria-hidden className="text-neutral-400">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T | "") => void;
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        className={cx(
          "h-8 border bg-white px-2 text-xs",
          value ? "border-neutral-900 text-neutral-900" : "border-neutral-300 text-neutral-600",
          radius.control,
          focus,
        )}
      >
        <option value="">{label}: All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ChipToggle({
  label,
  pressed,
  onChange,
  count,
}: {
  label: string;
  pressed: boolean;
  onChange: (v: boolean) => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-medium",
        radius.control,
        pressed ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
        focus,
      )}
    >
      {label}
      {count !== undefined && <span className={cx("tabular-nums", pressed ? "text-neutral-300" : "text-neutral-400")}>{count}</span>}
    </button>
  );
}
