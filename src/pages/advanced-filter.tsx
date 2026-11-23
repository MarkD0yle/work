import { useCallback, useEffect, useRef, useState } from "react";
import type { GridApi } from "ag-grid-community";
import { cx, focus } from "../components/patterns/tokens";
import { NativeFilterGrid } from "../components/advanced-filter/NativeFilterGrid";
import { ROWS, SAVED_FILTERS, type Row } from "../components/advanced-filter/native";
import { BUSINESS_DATE } from "../components/advanced-filter/model";

export const title = "Advanced Filter";
export const section = "patterns";
export const fullWidth = true;

/* Advanced Filter — AG Grid Enterprise's own Advanced Filter, restyled.
 *
 * The expression bar and the builder are AG Grid's. The page only decides
 * where they live and how they look:
 *  - the expression bar renders into the toolbar (advancedFilterParent);
 *  - the builder, normally a floating dialog, is pinned as a panel docked
 *    to the right, and the grid narrows while it is open;
 *  - colours, pills and buttons come from theme params and
 *    components/advanced-filter/native-filter.css.
 *
 * Saved filters are AdvancedFilterModel objects applied with
 * api.setAdvancedFilterModel(); the picker shows which one is active by
 * comparing it with api.getAdvancedFilterModel(). */

const DOCK_WIDTH = 520;

export default function AdvancedFilterPage() {
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const gridArea = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<GridApi<Row> | null>(null);
  const [count, setCount] = useState(ROWS.length);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [dock, setDock] = useState({ top: 0, height: 0 });
  const [savedId, setSavedId] = useState("close-review");

  const apply = useCallback(
    (id: string) => {
      const s = SAVED_FILTERS.find((f) => f.id === id);
      if (!api || !s) return;
      api.setAdvancedFilterModel(s.model);
      setSavedId(id);
    },
    [api],
  );

  // Open on the team's default filter.
  useEffect(() => {
    if (api) api.setAdvancedFilterModel(SAVED_FILTERS[0].model);
  }, [api]);

  // Which saved filter, if any, is the one AG Grid is running.
  useEffect(() => {
    if (!api) return;
    const sync = () => {
      const current = JSON.stringify(api.getAdvancedFilterModel() ?? null);
      setSavedId(SAVED_FILTERS.find((f) => JSON.stringify(f.model) === current)?.id ?? "");
    };
    api.addEventListener("filterChanged", sync);
    return () => {
      if (!api.isDestroyed()) api.removeEventListener("filterChanged", sync);
    };
  }, [api]);

  // Keep the docked builder aligned with the grid area.
  useEffect(() => {
    if (!builderOpen) return;
    const measure = () => {
      const r = gridArea.current?.getBoundingClientRect();
      if (r) setDock({ top: r.top, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [builderOpen]);

  const saved = SAVED_FILTERS.find((f) => f.id === savedId);

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed "Home" pill. */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white py-3 pr-6 pl-36">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Ledgerline · AG Grid Enterprise Advanced Filter</div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Transactions</h1>
        </div>
        <div className="text-right text-[11px] text-neutral-500">
          600-row slice of the seed · 60 portfolios
          <br />
          Business date {BUSINESS_DATE}
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2">
        <label htmlFor="saved-filter" className="sr-only">
          Saved filter
        </label>
        <select
          id="saved-filter"
          value={savedId}
          onChange={(e) => apply(e.target.value)}
          title={saved?.note || "Saved filters"}
          className={cx("h-8 w-56 shrink-0 border border-neutral-300 bg-white px-1.5 text-xs text-neutral-900 hover:border-neutral-400", focus)}
        >
          {savedId === "" && <option value="">Custom filter</option>}
          {SAVED_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        {/* AG Grid renders its expression bar, Apply and Builder buttons here. */}
        <div ref={setBar} className="af-bar min-w-0 flex-1" />

        {/* AG Grid only suggests where the caret expects a column, operator or
            join; these are its own shortcuts for opening the list. */}
        <span className="hidden shrink-0 text-[10px] text-neutral-400 md:inline" title="Suggestions open where a column, an operator or AND / OR comes next. ↓ or Ctrl+Space opens them.">
          <kbd className="border border-neutral-300 bg-neutral-50 px-1 font-mono text-neutral-600">↓</kbd> suggests
        </span>

        <div className="shrink-0 pl-2 text-[11px] text-neutral-600 tabular-nums" title={`${count} of ${ROWS.length} transactions match`}>
          <span className="text-sm font-semibold text-neutral-900">{count}</span> / {ROWS.length}
        </div>
      </div>

      <div
        ref={gridArea}
        className="min-h-0 flex-1 bg-white"
        style={
          {
            paddingRight: builderOpen ? DOCK_WIDTH : 0,
            "--af-dock-top": `${dock.top}px`,
            "--af-dock-height": `${dock.height}px`,
            "--af-dock-width": `${DOCK_WIDTH}px`,
          } as React.CSSProperties
        }
      >
        {bar && <NativeFilterGrid barParent={bar} onReady={setApi} onCount={setCount} onBuilderVisible={setBuilderOpen} />}
      </div>
    </div>
  );
}
