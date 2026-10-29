import { useEffect, useRef } from "react";

export const FOCUS = "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none";

/* Square checkbox. The native control is kept (keyboard, form semantics,
 * indeterminate for screen readers) but drawn square: native checkboxes
 * render with rounded corners, which the zero-radius rule forbids. */
export function Check({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 align-middle">
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-3.5 w-3.5 cursor-pointer appearance-none border ${
          on ? "border-violet-600 bg-violet-600" : "border-neutral-300 bg-white hover:border-neutral-400"
        } ${FOCUS} focus-visible:ring-offset-1`}
      />
      {on && (
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 h-3.5 w-3.5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-hidden
        >
          {indeterminate && !checked ? <path d="M4 8h8" /> : <path d="M3.5 8.5l3 3 6-7" />}
        </svg>
      )}
    </span>
  );
}
