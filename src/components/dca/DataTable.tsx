/* The shared DataTable used by every list screen in the prototype:
 * inline filter chips (no filter modal), applied-filter chips, free-text
 * search, saved views, group-by, bulk bar, hover row actions, exception
 * highlighting, and a right-side drawer with Prev/Next + keyboard nav. */

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Btn, Icons } from "./ui";

export interface Col<T> {
  key: string;
  label: string;
  get: (r: T) => string | number | boolean | null;
  render?: (r: T) => ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  /** participate in "deviates from the column's most common value" tinting */
  exception?: boolean;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  get: (r: T) => string;
  /** primary filters render as always-visible chips; the rest go to "+ More" */
  primary?: boolean;
}

export interface SavedView {
  name: string;
  filters: Record<string, string>;
  groupBy: string | null;
}

export interface HoverAction<T> {
  label: string;
  icon: ReactNode;
  onClick: (r: T) => void;
  show?: (r: T) => boolean;
}

interface Props<T> {
  id: string;
  rows: T[];
  rowId: (r: T) => string;
  columns: Col<T>[];
  filters?: FilterDef<T>[];
  searchText?: (r: T) => string;
  searchPlaceholder?: string;
  groupOptions?: string[];
  defaultViews?: SavedView[];
  initialFilters?: Record<string, string>;
  initialOpenId?: string;
  primaryAction?: { label: string; onClick: () => void };
  showExport?: boolean;
  bulkActions?: { label: string; onClick: (ids: string[]) => void }[];
  hoverActions?: HoverAction<T>[];
  dimRow?: (r: T) => boolean;
  rowFlag?: (r: T) => ReactNode;
  drawer: (r: T, close: () => void) => ReactNode;
  drawerTitle: (r: T) => ReactNode;
  emptyText?: string;
  emptySub?: string;
}

function loadViews(id: string, defaults: SavedView[]): SavedView[] {
  try {
    const raw = localStorage.getItem(`dca-views-${id}`);
    if (raw) {
      const saved = JSON.parse(raw) as SavedView[];
      const names = new Set(saved.map((v) => v.name));
      return [...defaults.filter((d) => !names.has(d.name)), ...saved];
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

function downloadCsv(name: string, header: string[], lines: string[][]) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [header, ...lines].map((l) => l.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>(props: Props<T>) {
  const {
    id,
    rows,
    rowId,
    columns,
    filters = [],
    searchText,
    groupOptions = [],
    defaultViews = [],
    hoverActions = [],
    bulkActions = [],
  } = props;

  const [applied, setApplied] = useState<Record<string, string>>(props.initialFilters ?? {});
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(props.initialOpenId ?? null);
  const [popover, setPopover] = useState<string | null>(null);
  const [views, setViews] = useState<SavedView[]>(() => loadViews(id, defaultViews));
  const [viewName, setViewName] = useState("");

  /* ---- derived rows ---- */

  const filterDefs = useMemo(() => new Map(filters.map((f) => [f.key, f])), [filters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      for (const [k, v] of Object.entries(applied)) {
        const def = filterDefs.get(k);
        if (def && def.get(r) !== v) return false;
      }
      if (q && searchText && !searchText(r).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, applied, query, searchText, filterDefs]);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const def = filterDefs.get(groupBy);
    if (!def) return null;
    const map = new Map<string, T[]>();
    for (const r of filtered) {
      const key = def.get(r);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy, filterDefs]);

  /** flat visible order (for drawer prev/next) */
  const flat = useMemo(
    () => (groups ? groups.flatMap(([, rs]) => rs) : filtered),
    [groups, filtered],
  );

  const openRow = useMemo(
    () => (openId ? rows.find((r) => rowId(r) === openId) ?? null : null),
    [openId, rows, rowId],
  );
  const openIdx = openRow ? flat.findIndex((r) => rowId(r) === openId) : -1;

  /** most common value per exception column, computed over all rows */
  const modes = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of columns) {
      if (!c.exception) continue;
      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = String(c.get(r));
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      let best = "";
      let bestN = -1;
      for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
      m.set(c.key, best);
    }
    return m;
  }, [columns, rows]);

  /* ---- keyboard: Esc closes drawer, ↑/↓ or J/K steps rows ---- */

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") setOpenId(null);
      else if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        const i = flat.findIndex((r) => rowId(r) === openId);
        if (i >= 0 && i < flat.length - 1) setOpenId(rowId(flat[i + 1]));
      } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        const i = flat.findIndex((r) => rowId(r) === openId);
        if (i > 0) setOpenId(rowId(flat[i - 1]));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, flat, rowId]);

  /* ---- saved views ---- */

  const persistViews = (next: SavedView[]) => {
    setViews(next);
    try {
      localStorage.setItem(`dca-views-${id}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const currentSig = JSON.stringify({ f: applied, g: groupBy });
  const activeView = views.find((v) => JSON.stringify({ f: v.filters, g: v.groupBy }) === currentSig);

  /* ---- selection ---- */

  const allVisibleSelected = flat.length > 0 && flat.every((r) => selected.has(rowId(r)));
  const toggleAll = () => {
    setSelected((s) => {
      if (allVisibleSelected) return new Set([...s].filter((k) => !flat.some((r) => rowId(r) === k)));
      const next = new Set(s);
      flat.forEach((r) => next.add(rowId(r)));
      return next;
    });
  };

  const exportRows = (rs: T[]) =>
    downloadCsv(
      id,
      columns.map((c) => c.label),
      rs.map((r) => columns.map((c) => String(c.get(r) ?? ""))),
    );

  /* ---- rendering helpers ---- */

  const optionsFor = (f: FilterDef<T>) => [...new Set(rows.map((r) => f.get(r)))].sort();

  const primaryFilters = filters.filter((f) => f.primary);
  const moreFilters = filters.filter((f) => !f.primary);

  const filterChip = (f: FilterDef<T>) => {
    const val = applied[f.key];
    const open = popover === `f-${f.key}`;
    return (
      <div key={f.key} className="relative">
        <button
          type="button"
          onClick={() => setPopover(open ? null : `f-${f.key}`)}
          className={`dca-chip ${val ? "dca-chip-on" : ""}`}
        >
          {f.label}
          {val ? <span className="font-semibold">: {val}</span> : null}
          {Icons.chevronDown()}
        </button>
        {open && (
          <div className="dca-pop absolute left-0 top-full z-30 mt-1 max-h-64 w-48 overflow-y-auto py-1">
            <button
              type="button"
              className="dca-pop-item"
              onClick={() => {
                setApplied((a) => {
                  const next = { ...a };
                  delete next[f.key];
                  return next;
                });
                setPopover(null);
              }}
            >
              All
            </button>
            {optionsFor(f).map((o) => (
              <button
                key={o}
                type="button"
                className={`dca-pop-item ${val === o ? "dca-pop-item-on" : ""}`}
                onClick={() => {
                  setApplied((a) => ({ ...a, [f.key]: o }));
                  setPopover(null);
                }}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const cellFor = (r: T, c: Col<T>) => {
    const isExc = c.exception && String(c.get(r)) !== modes.get(c.key);
    return (
      <td
        key={c.key}
        className={`px-2.5 py-1.5 ${c.align === "right" ? "text-right" : ""} ${c.mono ? "dca-mono" : ""} ${isExc ? "dca-exc" : ""}`}
      >
        {c.render ? c.render(r) : String(c.get(r) ?? "")}
      </td>
    );
  };

  const rowFor = (r: T) => {
    const rid = rowId(r);
    const dim = props.dimRow?.(r);
    const visibleHovers = hoverActions.filter((h) => !h.show || h.show(r));
    return (
      <tr
        key={rid}
        onClick={() => setOpenId(rid)}
        className={`dca-row group cursor-pointer ${openId === rid ? "dca-row-open" : ""} ${dim ? "dca-dim" : ""}`}
      >
        <td className="w-8 px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="dca-check"
            checked={selected.has(rid)}
            onChange={() =>
              setSelected((s) => {
                const next = new Set(s);
                if (next.has(rid)) next.delete(rid);
                else next.add(rid);
                return next;
              })
            }
            aria-label={`Select ${rid}`}
          />
        </td>
        {columns.map((c) => cellFor(r, c))}
        <td className="relative w-20 px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
          <span className="flex items-center justify-end gap-1">
            {props.rowFlag?.(r)}
            <span className="hidden items-center gap-0.5 group-hover:flex">
              {visibleHovers.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  title={h.label}
                  className="dca-iconbtn"
                  onClick={() => h.onClick(r)}
                >
                  {h.icon}
                </button>
              ))}
            </span>
          </span>
        </td>
      </tr>
    );
  };

  const colCount = columns.length + 2;

  return (
    <div className="relative">
      {popover && <div className="fixed inset-0 z-20" onClick={() => setPopover(null)} />}

      {/* Saved views + header actions */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`dca-tab ${!activeView ? "dca-tab-on" : ""}`}
            onClick={() => {
              setApplied(props.initialFilters ?? {});
              setGroupBy(null);
            }}
          >
            All
          </button>
          {views.map((v) => (
            <button
              key={v.name}
              type="button"
              className={`dca-tab ${activeView?.name === v.name ? "dca-tab-on" : ""}`}
              onClick={() => {
                setApplied(v.filters);
                setGroupBy(v.groupBy);
              }}
            >
              {v.name}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              className="dca-tab dca-faint"
              onClick={() => setPopover(popover === "saveview" ? null : "saveview")}
            >
              + Save view
            </button>
            {popover === "saveview" && (
              <div className="dca-pop absolute left-0 top-full z-30 mt-1 w-56 p-2">
                <p className="dca-muted mb-1.5 text-[11px]">Save current filters as</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    placeholder="View name"
                    className="dca-input h-7 min-w-0 flex-1 text-[12px]"
                  />
                  <Btn
                    small
                    kind="primary"
                    disabled={!viewName.trim()}
                    onClick={() => {
                      persistViews([
                        ...views.filter((v) => v.name !== viewName.trim()),
                        { name: viewName.trim(), filters: applied, groupBy },
                      ]);
                      setViewName("");
                      setPopover(null);
                    }}
                  >
                    Save
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {props.showExport !== false && (
            <Btn small onClick={() => exportRows(flat)}>
              {Icons.export()} Export
            </Btn>
          )}
          {props.primaryAction && (
            <Btn small kind="primary" onClick={props.primaryAction.onClick}>
              {Icons.plus()} {props.primaryAction.label}
            </Btn>
          )}
        </div>
      </div>

      {/* Inline filter bar */}
      <div className="dca-card mb-0 flex flex-wrap items-center gap-1.5 border-b-0 px-2.5 py-2">
        {primaryFilters.map(filterChip)}
        {moreFilters.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className="dca-chip"
              onClick={() => setPopover(popover === "more" ? null : "more")}
            >
              + More filters
            </button>
            {popover === "more" && (
              <div className="dca-pop absolute left-0 top-full z-30 mt-1 w-60 p-2.5">
                {moreFilters.map((f) => (
                  <label key={f.key} className="mb-2 block last:mb-0">
                    <span className="dca-muted mb-0.5 block text-[11px]">{f.label}</span>
                    <select
                      className="dca-input h-7 w-full text-[12px]"
                      value={applied[f.key] ?? ""}
                      onChange={(e) =>
                        setApplied((a) => {
                          const next = { ...a };
                          if (e.target.value) next[f.key] = e.target.value;
                          else delete next[f.key];
                          return next;
                        })
                      }
                    >
                      <option value="">All</option>
                      {optionsFor(f).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {groupOptions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className={`dca-chip ${groupBy ? "dca-chip-on" : ""}`}
              onClick={() => setPopover(popover === "group" ? null : "group")}
            >
              Group by{groupBy ? <span className="font-semibold">: {filterDefs.get(groupBy)?.label}</span> : null}
              {Icons.chevronDown()}
            </button>
            {popover === "group" && (
              <div className="dca-pop absolute left-0 top-full z-30 mt-1 w-44 py-1">
                <button type="button" className="dca-pop-item" onClick={() => { setGroupBy(null); setPopover(null); }}>
                  None
                </button>
                {groupOptions.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`dca-pop-item ${groupBy === k ? "dca-pop-item-on" : ""}`}
                    onClick={() => {
                      setGroupBy(k);
                      setPopover(null);
                    }}
                  >
                    {filterDefs.get(k)?.label ?? k}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="relative ml-auto">
          <span className="dca-faint pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            {Icons.search()}
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={props.searchPlaceholder ?? "Search…"}
            className="dca-input h-7 w-64 pl-8 text-[12px]"
          />
        </div>
      </div>

      {/* Applied filter chips */}
      {Object.keys(applied).length > 0 && (
        <div className="dca-card flex flex-wrap items-center gap-1.5 border-b-0 border-t-0 px-2.5 py-1.5">
          <span className="dca-faint text-[10px] font-semibold uppercase tracking-wide">Filters</span>
          {Object.entries(applied).map(([k, v]) => (
            <button
              key={k}
              type="button"
              className="dca-chip dca-chip-on"
              onClick={() =>
                setApplied((a) => {
                  const next = { ...a };
                  delete next[k];
                  return next;
                })
              }
            >
              {filterDefs.get(k)?.label ?? k}: <span className="font-semibold">{v}</span>
              {Icons.x("h-2.5 w-2.5")}
            </button>
          ))}
          <button type="button" className="dca-faint text-[11px] underline underline-offset-2" onClick={() => setApplied({})}>
            Clear all
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="dca-bulk flex items-center gap-3 px-3 py-2 text-[12px]">
          <span className="font-semibold">{selected.size} selected</span>
          <span className="dca-faint">—</span>
          <button
            type="button"
            className="dca-bulk-btn"
            onClick={() => exportRows(rows.filter((r) => selected.has(rowId(r))))}
          >
            Export CSV
          </button>
          {bulkActions.map((b) => (
            <button
              key={b.label}
              type="button"
              className="dca-bulk-btn"
              onClick={() => {
                b.onClick([...selected]);
                setSelected(new Set());
              }}
            >
              {b.label}
            </button>
          ))}
          <button type="button" className="dca-faint ml-auto underline underline-offset-2" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="dca-card overflow-x-auto">
        {flat.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium">{props.emptyText ?? "No rows match"}</p>
            <p className="dca-faint mt-1 text-xs">{props.emptySub ?? "Adjust or clear the filters above."}</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="dca-thead">
                <th className="w-8 px-2.5 py-2">
                  <input
                    type="checkbox"
                    className="dca-check"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`whitespace-nowrap px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="w-20 px-2.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {groups
                ? groups.map(([g, rs]) => (
                    <FragmentGroup
                      key={g}
                      label={`${filterDefs.get(groupBy!)?.label}: ${g}`}
                      count={rs.length}
                      colCount={colCount}
                      collapsed={collapsed.has(g)}
                      onToggle={() =>
                        setCollapsed((s) => {
                          const next = new Set(s);
                          if (next.has(g)) next.delete(g);
                          else next.add(g);
                          return next;
                        })
                      }
                    >
                      {rs.map(rowFor)}
                    </FragmentGroup>
                  ))
                : filtered.map(rowFor)}
            </tbody>
          </table>
        )}
      </div>
      <p className="dca-faint mt-1.5 text-[11px]">
        {flat.length} row{flat.length === 1 ? "" : "s"}
        {openRow ? " · Esc closes the panel · ↑/↓ or J/K steps rows" : ""}
      </p>

      {/* Right-side drawer */}
      {openRow && (
        <div className="dca-drawer fixed inset-y-0 right-0 z-40 flex w-[480px] max-w-full flex-col">
          <div className="dca-drawer-head flex items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm font-semibold">{props.drawerTitle(openRow)}</div>
            <span className="dca-faint text-[11px]">
              {openIdx + 1} of {flat.length}
            </span>
            <button
              type="button"
              className="dca-iconbtn"
              disabled={openIdx <= 0}
              onClick={() => openIdx > 0 && setOpenId(rowId(flat[openIdx - 1]))}
              aria-label="Previous row"
            >
              {Icons.chevronLeft()}
            </button>
            <button
              type="button"
              className="dca-iconbtn"
              disabled={openIdx >= flat.length - 1}
              onClick={() => openIdx < flat.length - 1 && setOpenId(rowId(flat[openIdx + 1]))}
              aria-label="Next row"
            >
              {Icons.chevronRight()}
            </button>
            <button type="button" className="dca-iconbtn" onClick={() => setOpenId(null)} aria-label="Close panel">
              {Icons.x("h-3.5 w-3.5")}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{props.drawer(openRow, () => setOpenId(null))}</div>
        </div>
      )}
    </div>
  );
}

function FragmentGroup({
  label,
  count,
  colCount,
  collapsed,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  colCount: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="dca-grouphead cursor-pointer" onClick={onToggle}>
        <td colSpan={colCount} className="px-2.5 py-1.5 text-[11px] font-semibold">
          <span className={`mr-1.5 inline-block transition-transform ${collapsed ? "-rotate-90" : ""}`}>
            {Icons.chevronDown()}
          </span>
          {label}
          <span className="dca-faint ml-2 font-normal">{count}</span>
        </td>
      </tr>
      {!collapsed && children}
    </>
  );
}
