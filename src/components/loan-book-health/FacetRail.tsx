import { useMemo } from "react";
import { SEGMENTS } from "./model";
import { ACCENT, FOCUS, gbp, pct } from "./format";
import { BOOK, DIM_KEYS, FACETS, inSlice, type DimKey, type Filters } from "./filters";

/* The left facet rail: the page's only filter surface. Each option shows its
 * share of balance so the rail doubles as a composition view. */

export function FacetRail({
  filters,
  asOf,
  onToggle,
  onClear,
  onReset,
  inView,
}: {
  filters: Filters;
  asOf: number;
  onToggle: (k: DimKey, i: number) => void;
  onClear: (k: DimKey) => void;
  onReset: () => void;
  inView: number;
}) {
  // Facet semantics: each option's share is computed against the other
  // groups' selections, so the rail reads as the composition of the slice.
  const shares = useMemo(
    () =>
      FACETS.map((f) => {
        const per = new Array<number>(f.options.length).fill(0);
        let total = 0;
        for (const s of SEGMENTS) {
          if (!inSlice(s, filters, f.key)) continue;
          per[s[f.key]] += s.bal[asOf];
          total += s.bal[asOf];
        }
        return per.map((v) => (total > 0 ? v / total : 0));
      }),
    [filters, asOf],
  );
  const active = DIM_KEYS.reduce((n, k) => n + filters[k].length, 0);
  const book = BOOK.bal[asOf];

  return (
    <aside
      aria-label="Filters"
      className="flex shrink-0 flex-col border-r border-neutral-200 bg-white"
      style={{ width: 248 }}
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Segments
          </div>
          <div className="mt-0.5 text-xs text-neutral-600" aria-live="polite">
            {active === 0
              ? "No filters active"
              : `${active} filter${active === 1 ? "" : "s"} active`}
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={active === 0}
          className={`border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-white ${FOCUS}`}
        >
          Reset all
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {FACETS.map((f, fi) => {
          const sel = filters[f.key];
          return (
            <fieldset key={f.key} className="border-b border-neutral-100 pb-2 last:border-b-0">
              <legend className="sr-only">{f.label}</legend>
              <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
                  >
                    {f.label}
                  </span>
                  {sel.length > 0 && (
                    <span className="bg-indigo-600 px-1 font-mono text-[10px] leading-4 text-white tabular-nums">
                      {sel.length}
                    </span>
                  )}
                </span>
                {sel.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClear(f.key)}
                    className={`text-[11px] font-medium text-indigo-700 hover:underline ${FOCUS}`}
                    aria-label={`Clear ${f.label} filter`}
                  >
                    Clear
                  </button>
                )}
              </div>
              {f.options.map((o, i) => {
                const on = sel.includes(i);
                const share = shares[fi][i];
                return (
                  <label
                    key={o.label}
                    className={`block cursor-pointer px-4 py-1 transition ${
                      on ? "bg-indigo-50/60" : "hover:bg-neutral-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={on}
                        onChange={() => onToggle(f.key, i)}
                      />
                      <span
                        aria-hidden
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1 ${
                          on ? "border-indigo-600 bg-indigo-600" : "border-neutral-300 bg-white"
                        }`}
                      >
                        {on && (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="#fff" strokeWidth="1.8" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${
                          on ? "font-medium text-neutral-900" : "text-neutral-700"
                        }`}
                      >
                        {o.label}
                        {o.hint && <span className="ml-1.5 text-neutral-400">{o.hint}</span>}
                      </span>
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          share > 0 ? "text-neutral-500" : "text-neutral-300"
                        }`}
                      >
                        {share > 0 ? pct(share, 1) : "—"}
                      </span>
                    </span>
                    <span aria-hidden className="mt-1 ml-[22px] block h-[3px] bg-neutral-100">
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.min(100, share * 100)}%`,
                          background: on ? ACCENT : "#a3a3a3",
                        }}
                      />
                    </span>
                  </label>
                );
              })}
            </fieldset>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Balance in view
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono text-sm font-semibold text-neutral-900 tabular-nums">
            {gbp(inView)}
          </span>
          <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
            {pct(book > 0 ? inView / book : 0, 1)} of {gbp(book)}
          </span>
        </div>
        <div aria-hidden className="mt-1.5 h-1 bg-neutral-200">
          <div
            className="h-full"
            style={{ width: `${book > 0 ? (inView / book) * 100 : 0}%`, background: ACCENT }}
          />
        </div>
      </div>
    </aside>
  );
}
