import { useState, type ReactNode } from "react";

/* Spec v0.1.1 §6 — default lens is "Needs my attention", not "All".
 *
 *   needs_attention := (status: red OR amber) AND (owner: me OR unowned)
 *
 * The lens dropdown stays visible (most-used dimension). The remaining
 * dimensional filters (process / data / rule / system + region) collapse
 * behind a single "Filter" button. */

export type Lens =
  | "needs_attention"
  | "all"
  | "red"
  | "amber"
  | "mine"
  | "unacked"
  | "process"
  | "data"
  | "rule"
  | "system";

export const LENS_LABEL: Record<Lens, string> = {
  needs_attention: "Needs my attention",
  all: "All",
  red: "Red only",
  amber: "Amber+",
  unacked: "Unacked",
  mine: "Mine",
  process: "Process",
  data: "Data",
  rule: "Rule",
  system: "System",
};

const PRIMARY_LENSES: Lens[] = [
  "needs_attention",
  "mine",
  "red",
  "amber",
  "unacked",
  "all",
];

const CATEGORY_LENSES: Lens[] = ["process", "data", "rule", "system"];

export default function LensBar({
  value,
  onChange,
  scopedCount,
  totalCount,
}: {
  value: Lens;
  onChange: (v: Lens) => void;
  scopedCount: number;
  totalCount: number;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const categoryActive = CATEGORY_LENSES.includes(value);
  // Active filter count shown on the Filter button.
  const filterCount = categoryActive ? 1 : 0;

  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Lens
        </span>

        {/* Primary lens picker — dropdown so "Needs my attention" can fit
            without taking a whole row of pills. */}
        <div className="relative">
          <LensDropdown value={value} onChange={onChange} />
        </div>

        {/* Collapsed filter button — spec §6.3 */}
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
            filterCount > 0
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          <span>Filter</span>
          {filterCount > 0 && (
            <span className="rounded-full bg-blue-700 px-1.5 text-[10px] font-semibold text-white">
              {filterCount}
            </span>
          )}
          <span className="text-[10px] text-neutral-400">
            {filterOpen ? "▲" : "▼"}
          </span>
        </button>

        <span className="ml-auto text-xs text-neutral-500">
          Scoping {scopedCount} of {totalCount} monitors
        </span>
      </div>

      {/* Expanded dimensional filters (collapsed by default) */}
      {filterOpen && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2">
          <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            By category
          </span>
          {CATEGORY_LENSES.map((l) => (
            <FilterPill
              key={l}
              active={value === l}
              onClick={() => onChange(l)}
            >
              {LENS_LABEL[l]}
            </FilterPill>
          ))}
          {categoryActive && (
            <button
              type="button"
              onClick={() => onChange("needs_attention")}
              className="ml-auto text-[11px] text-blue-700 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LensDropdown({
  value,
  onChange,
}: {
  value: Lens;
  onChange: (v: Lens) => void;
}) {
  // Use a native select for keyboard accessibility; styled chip-shaped to
  // match the rest of the filter row.
  const isPrimary = PRIMARY_LENSES.includes(value);
  const displayValue = isPrimary ? value : "needs_attention";
  return (
    <div className="relative inline-flex items-center">
      <select
        value={displayValue}
        onChange={(e) => onChange(e.target.value as Lens)}
        className="appearance-none rounded-full border border-blue-500 bg-blue-50 py-1 pr-7 pl-3 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        {PRIMARY_LENSES.map((l) => (
          <option key={l} value={l}>
            {LENS_LABEL[l]}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 text-[10px] text-blue-700"
      >
        ▾
      </span>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-neutral-700 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}
