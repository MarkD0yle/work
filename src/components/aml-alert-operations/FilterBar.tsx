import { useEffect, useState } from "react";
import {
  DIMENSIONS,
  PRESETS,
  SCENARIO_BY_CODE,
  type DimKey,
  type Filters,
  type Preset,
} from "./data";
import { Check, FOCUS } from "./ui";

/* Chip-based filter builder, one row: date preset, active filter chips, an
 * "+ Add filter" popover (dimension list → checkbox values with counts) and
 * Clear all. Clicking a chip reopens its values; ✕ removes it. */

type Panel = { anchor: "add"; dim: DimKey | null } | { anchor: DimKey; dim: DimKey };

const DIM_BY_KEY = new Map(DIMENSIONS.map((d) => [d.key, d]));

function valueLabel(dim: DimKey, v: string) {
  if (dim !== "scenario") return v;
  const s = SCENARIO_BY_CODE.get(v);
  return s ? `${s.code} · ${s.name}` : v;
}

function chipText(dim: DimKey, vals: string[]) {
  const d = DIM_BY_KEY.get(dim)!;
  const first = vals[0];
  return `${d.short}: ${first}${vals.length > 1 ? ` +${vals.length - 1}` : ""}`;
}

export function FilterBar({
  preset,
  onPreset,
  filters,
  onFilters,
  facetCounts,
  scopeNote,
}: {
  preset: Preset;
  onPreset: (p: Preset) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  /** Alerts generated in range for each value of a dimension, other filters applied. */
  facetCounts: (dim: DimKey) => Map<string, number>;
  scopeNote: string;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const active = DIMENSIONS.filter((d) => (filters[d.key]?.length ?? 0) > 0);

  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-aml-popover]")) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const toggleValue = (dim: DimKey, v: string) => {
    const cur = filters[dim] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    const f = { ...filters };
    if (next.length) f[dim] = next;
    else delete f[dim];
    onFilters(f);
  };
  const removeDim = (dim: DimKey) => {
    const f = { ...filters };
    delete f[dim];
    onFilters(f);
    setPanel(null);
  };

  const renderValues = (dim: DimKey, withBack: boolean) => {
    const d = DIM_BY_KEY.get(dim)!;
    const counts = facetCounts(dim);
    const sel = filters[dim] ?? [];
    return (
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2">
          {withBack ? (
            <button
              type="button"
              onClick={() => setPanel({ anchor: "add", dim: null })}
              className={`inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 ${FOCUS}`}
            >
              <span aria-hidden>←</span> {d.label}
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-neutral-800">{d.label}</span>
          )}
          <span className="text-[10px] tracking-wide text-neutral-400 uppercase">Alerts in range</span>
        </div>
        <fieldset className="max-h-72 overflow-y-auto py-1">
          <legend className="sr-only">{d.label}</legend>
          {d.values.map((v) => {
            const on = sel.includes(v);
            const n = counts.get(v) ?? 0;
            return (
              <label
                key={v}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-50 ${
                  on ? "text-neutral-900" : "text-neutral-600"
                }`}
              >
                <Check checked={on} onChange={() => toggleValue(dim, v)} label={valueLabel(dim, v)} />
                <span className="min-w-0 flex-1 truncate">{valueLabel(dim, v)}</span>
                <span className="font-mono text-[11px] text-neutral-400 tabular-nums">{n.toLocaleString("en-GB")}</span>
              </label>
            );
          })}
        </fieldset>
        <div className="flex items-center justify-between border-t border-neutral-100 px-3 py-2">
          <button
            type="button"
            disabled={sel.length === 0}
            onClick={() => removeDim(dim)}
            className={`text-[11px] text-neutral-500 hover:text-neutral-900 disabled:opacity-40 ${FOCUS}`}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setPanel(null)}
            className={`bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-neutral-700 ${FOCUS}`}
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  const popoverCls =
    "absolute top-full left-0 z-50 mt-1 border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center border border-neutral-200 bg-white" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            onClick={() => onPreset(p)}
            className={`px-2.5 py-1 font-mono text-[11px] font-medium transition ${FOCUS} ${
              preset === p ? "bg-violet-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <span className="h-5 w-px bg-neutral-200" aria-hidden />

      {active.map((d) => {
        const vals = filters[d.key]!;
        const open = panel?.anchor === d.key;
        return (
          <div key={d.key} className="relative" data-aml-popover>
            <div className="flex items-stretch border border-violet-200 bg-violet-50 text-xs text-violet-900">
              <button
                type="button"
                aria-expanded={open}
                aria-haspopup="dialog"
                title={vals.map((v) => valueLabel(d.key, v)).join(", ")}
                onClick={() => setPanel(open ? null : { anchor: d.key, dim: d.key })}
                className={`py-1 pr-1.5 pl-2 font-medium hover:bg-violet-100 ${FOCUS}`}
              >
                {chipText(d.key, vals)}
              </button>
              <button
                type="button"
                aria-label={`Remove ${d.label} filter`}
                onClick={() => removeDim(d.key)}
                className={`border-l border-violet-200 px-1.5 text-violet-500 hover:bg-violet-100 hover:text-violet-900 ${FOCUS}`}
              >
                ✕
              </button>
            </div>
            {open && (
              <div role="dialog" aria-label={`${d.label} filter`} className={`${popoverCls} w-72`}>
                {renderValues(d.key, false)}
              </div>
            )}
          </div>
        );
      })}

      <div className="relative" data-aml-popover>
        <button
          type="button"
          aria-expanded={panel?.anchor === "add"}
          aria-haspopup="dialog"
          onClick={() => setPanel(panel?.anchor === "add" ? null : { anchor: "add", dim: null })}
          className={`inline-flex items-center gap-1 border border-dashed border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 ${FOCUS}`}
        >
          <span aria-hidden className="text-sm leading-none">+</span> Add filter
        </button>
        {panel?.anchor === "add" && (
          <div role="dialog" aria-label="Add filter" className={`${popoverCls} w-72`}>
            {panel.dim ? (
              renderValues(panel.dim, true)
            ) : (
              <ul className="py-1">
                <li className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                  Filter by
                </li>
                {DIMENSIONS.map((d) => {
                  const n = filters[d.key]?.length ?? 0;
                  return (
                    <li key={d.key}>
                      <button
                        type="button"
                        onClick={() => setPanel({ anchor: "add", dim: d.key })}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 ${FOCUS}`}
                      >
                        <span>{d.label}</span>
                        <span className="flex items-center gap-2 text-neutral-400">
                          {n > 0 && (
                            <span className="bg-violet-100 px-1 font-mono text-[10px] text-violet-800">{n}</span>
                          )}
                          <span aria-hidden>›</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {active.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onFilters({});
            setPanel(null);
          }}
          className={`text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 ${FOCUS}`}
        >
          Clear all
        </button>
      )}

      <span className="ml-auto text-[11px] text-neutral-500">{scopeNote}</span>
    </div>
  );
}
