import { GRID_SORT_MODES, type GridSortMode } from "../../lib/grid-sort";

/* Spec v0.1.2 §2.4 — sort dropdown in the grid header. URL-syncs via the
 * parent so reload preserves the user's pick. */

export default function GridSortControl({
  value,
  onChange,
}: {
  value: GridSortMode;
  onChange: (v: GridSortMode) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-widest text-neutral-500 uppercase">
      Sort
      <div className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as GridSortMode)}
          className="appearance-none rounded-full border border-neutral-300 bg-white py-0.5 pr-6 pl-2.5 text-[11px] font-medium normal-case tracking-normal text-neutral-700 hover:bg-neutral-50"
        >
          {GRID_SORT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 text-[9px] text-neutral-500"
        >
          ▾
        </span>
      </div>
    </label>
  );
}
