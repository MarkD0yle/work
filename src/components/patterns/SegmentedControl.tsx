import { border, cx, focus, radius } from "./tokens";

/* SegmentedControl — pick one of 2–5 views of the same data.
 * Period (1D / 1W / 1M), unit (£ / %), lens (By desk / By venue).
 *
 * Tabs — switch between different content on one screen. Underlined, sits
 * at the bottom of a header or card. Use Tabs when the panels hold
 * different things; use SegmentedControl when they re-cut the same thing. */

export type Option<T extends string> = { value: T; label: string; count?: number };

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "sm",
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Accessible group name, e.g. "Period". */
  label: string;
  size?: "xs" | "sm";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex bg-white p-0.5", border.default, radius.control)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              radius.control,
              size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              "font-medium whitespace-nowrap",
              on ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
              focus,
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cx("ml-1 tabular-nums", on ? "text-neutral-300" : "text-neutral-400")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 overflow-x-auto">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px border-b-2 pb-2 text-xs font-medium whitespace-nowrap",
              on ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800",
              focus,
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx("ml-1.5 rounded-full px-1.5 text-[10px] tabular-nums", on ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
