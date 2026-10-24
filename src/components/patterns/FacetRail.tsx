import { useState } from "react";
import { button, cx, focus, text } from "./tokens";

/* FacetRail — a vertical filter list that shows what each choice would return.
 *
 * For lists with many dimensions (desk, venue, status, currency) where a
 * horizontal FilterBar would run out of room. Each facet is a collapsible
 * group of checkboxes with a count beside every option. Choices inside a facet
 * are OR; across facets they are AND. An option with a count of 0 is disabled,
 * so the user can't pick a combination that returns nothing. Compute counts
 * against the *other* facets' selections, as the result would be.
 *
 * Long facets show the first few options and a "Show all". Clear is per facet
 * and for the whole rail, and only appears when something is applied. */

export type FacetOption = { value: string; label: string; count: number };
export type Facet = { id: string; label: string; options: FacetOption[] };

export function FacetRail({
  facets,
  selected,
  onChange,
  onClearAll,
  resultCount,
  visibleOptions = 5,
  label = "Filters",
}: {
  facets: Facet[];
  /** Selected values per facet id. A missing key means nothing selected. */
  selected: Record<string, string[]>;
  onChange: (facetId: string, next: string[]) => void;
  onClearAll: () => void;
  /** Rows the current selection returns. */
  resultCount?: number;
  visibleOptions?: number;
  label?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const total = Object.values(selected).reduce((n, v) => n + v.length, 0);

  const flip = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <aside aria-label={label} className="flex h-full flex-col bg-white">
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className={text.title}>{label}</h2>
          {resultCount !== undefined && (
            <p className={cx("tabular-nums", text.muted)} aria-live="polite">
              {resultCount.toLocaleString()} results
            </p>
          )}
        </div>
        {total > 0 && (
          <button type="button" onClick={onClearAll} className={button.ghost}>
            Clear all ({total})
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {facets.map((f) => {
          const chosen = selected[f.id] ?? [];
          const isOpen = !collapsed.has(f.id);
          const showAll = expanded.has(f.id);
          // Never hide a ticked option behind "Show all".
          const options = showAll ? f.options : f.options.filter((o, i) => i < visibleOptions || chosen.includes(o.value));
          const hiddenCount = f.options.length - options.length;
          const panelId = `facet-${f.id}`;
          return (
            <section key={f.id} className="border-b border-neutral-200">
              <div className="flex items-center justify-between px-4 py-2.5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setCollapsed((c) => flip(c, f.id))}
                  className={cx("flex items-center gap-1.5", text.eyebrow, focus)}
                >
                  <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                  {f.label}
                  {chosen.length > 0 && <span className="bg-neutral-900 px-1 text-white tabular-nums">{chosen.length}</span>}
                </button>
                {chosen.length > 0 && (
                  <button type="button" onClick={() => onChange(f.id, [])} aria-label={`Clear ${f.label}`} className={cx(text.muted, "hover:text-neutral-900 hover:underline", focus)}>
                    Clear
                  </button>
                )}
              </div>
              {isOpen && (
                <div id={panelId} className="px-4 pb-3">
                  <ul className="flex flex-col">
                    {options.map((o) => {
                      const on = chosen.includes(o.value);
                      const none = o.count === 0 && !on;
                      return (
                        <li key={o.value}>
                          <label className={cx("flex items-center gap-2 py-1 text-xs", none ? "text-neutral-400" : "cursor-pointer text-neutral-800")}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={none}
                              onChange={() => onChange(f.id, on ? chosen.filter((v) => v !== o.value) : [...chosen, o.value])}
                              className={cx("h-3.5 w-3.5 accent-neutral-900", focus)}
                            />
                            <span className="flex-1 truncate">{o.label}</span>
                            <span className="tabular-nums">{o.count}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {(hiddenCount > 0 || (showAll && f.options.length > visibleOptions)) && (
                    <button type="button" onClick={() => setExpanded((x) => flip(x, f.id))} className={cx("mt-1", text.muted, "hover:text-neutral-900 hover:underline", focus)}>
                      {showAll ? "Show fewer" : `Show all ${f.options.length}`}
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
