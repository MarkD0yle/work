import { ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatNumber, formatFull } from "../lib/format";
import type { FormatSpec } from "../config/formats";
import { EMPTY } from "../config/formats";
import { usePersisted } from "../lib/persist";
import { Banner, Checkbox, EmptyState, IconButton, Skeleton, Tip } from "../ui";
import { useEa } from "../ui/context";

export type Density = "compact" | "default" | "comfortable";
const ROW_H: Record<Density, number> = { compact: 28, default: 36, comfortable: 44 };

export type CellCtx = { depth: number; expanded?: boolean; hasChildren?: boolean };
export type Column<T> = {
  id: string;
  header: ReactNode;
  /** Plain header text for aria/tooltips. */
  headerText?: string;
  accessor?: (row: T) => string | number | null | undefined;
  render?: (row: T, ctx: CellCtx) => ReactNode;
  /** Numeric format spec; numbers are right-aligned tabular. */
  format?: FormatSpec;
  align?: "left" | "right";
  width?: number;
  sortable?: boolean;
  sticky?: boolean;
  group?: string;
  /** Cell-level styling, e.g. heatmap fills. `hatch` adds the colour-blind pattern. */
  cellStyle?: (row: T) => { style?: CSSProperties; hatch?: boolean; glyph?: string; title?: string } | null;
  /** Tooltip for truncated or compact values. */
  title?: (row: T) => string | undefined;
  headerProps?: { onClick?: () => void };
};

export type SortState = { id: string; dir: "asc" | "desc" } | null;

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowId: (row: T) => string;
  /** aria label for the table. */
  label: string;
  persistKey?: string;
  defaultDensity?: Density;
  title?: ReactNode;
  actions?: ReactNode;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  defaultSort?: SortState;
  paginate?: boolean;
  pageSizes?: number[];
  /** Virtualize when not paginated; forced on above 200 rows. */
  virtualize?: boolean;
  maxHeight?: number | string;
  pinnedRow?: T;
  getChildren?: (row: T) => T[] | undefined;
  defaultExpanded?: boolean;
  /** role="grid" for editable/heatmap tables. */
  grid?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  empty?: { title: string; hint?: string; action?: ReactNode };
  onRowClick?: (row: T) => void;
  rowClassActive?: (row: T) => boolean;
  /** Marks a row bold with a top-level group style. */
  isGroupRow?: (row: T) => boolean;
  toolbarEnd?: ReactNode;
  hideDensity?: boolean;
  cellPad?: number;
};

type FlatRow<T> = { row: T; depth: number; hasChildren: boolean; expanded: boolean };

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns, rows, rowId, label, persistKey = "table", defaultDensity = "default", title, actions, selectable, selected, onSelectedChange,
    defaultSort = null, paginate = false, pageSizes = [10, 25, 50, 100], virtualize, maxHeight, pinnedRow, getChildren, defaultExpanded = false,
    grid, loading, error, onRetry, empty, onRowClick, rowClassActive, isGroupRow, toolbarEnd, hideDensity,
  } = props;
  const { colorBlindSafe } = useEa();
  const [density, setDensity] = usePersisted<Density>(`density.${persistKey}`, defaultDensity);
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pageSize, setPageSize] = usePersisted<number>(`layout.pageSize.${persistKey}`, pageSizes[0]);
  const [page, setPage] = useState(0);
  const rowH = ROW_H[density];

  const cmp = useMemo(() => {
    if (!sort) return null;
    const col = columns.find((c) => c.id === sort.id);
    const get = col?.accessor;
    if (!get) return null;
    return (a: T, b: T) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === "asc" ? r : -r;
    };
  }, [sort, columns]);

  const flat = useMemo<FlatRow<T>[]>(() => {
    const out: FlatRow<T>[] = [];
    const walk = (list: T[], depth: number) => {
      const sorted = cmp ? [...list].sort(cmp) : list;
      for (const row of sorted) {
        const kids = getChildren?.(row);
        const has = !!kids?.length;
        const isOpen = has && (defaultExpanded ? !expanded.has(`~${rowId(row)}`) : expanded.has(rowId(row)));
        out.push({ row, depth, hasChildren: has, expanded: !!isOpen });
        if (isOpen && kids) walk(kids, depth + 1);
      }
    };
    walk(rows, 0);
    return out;
  }, [rows, cmp, getChildren, expanded, defaultExpanded, rowId]);

  const toggleExpand = (id: string) =>
    setExpanded((s) => { const n = new Set(s); const k = defaultExpanded ? `~${id}` : id; if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const total = flat.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = paginate ? flat.slice(safePage * pageSize, safePage * pageSize + pageSize) : flat;

  // Virtualization (unpaginated, or forced), required above 200 rows.
  const virt = !paginate && (virtualize ?? total > 200) && total > 50;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const start = virt ? Math.max(0, Math.floor(scrollTop / rowH) - 8) : 0;
  const end = virt ? Math.min(visible.length, Math.ceil((scrollTop + viewH) / rowH) + 8) : visible.length;
  const slice = visible.slice(start, end);

  const allIds = useMemo(() => flat.map((f) => rowId(f.row)), [flat, rowId]);
  const selCount = selected ? allIds.filter((i) => selected.has(i)).length : 0;
  const setSel = useCallback((id: string, on: boolean) => {
    if (!selected || !onSelectedChange) return;
    const n = new Set(selected); if (on) n.add(id); else n.delete(id); onSelectedChange(n);
  }, [selected, onSelectedChange]);

  const cols = columns;
  const hasGroups = cols.some((c) => c.group);
  const groupSpans = useMemo(() => {
    const spans: { label: string; span: number }[] = [];
    for (const c of cols) {
      const g = c.group ?? "";
      const last = spans[spans.length - 1];
      if (last && last.label === g) last.span++; else spans.push({ label: g, span: 1 });
    }
    return spans;
  }, [cols]);

  const onSort = (c: Column<T>) => {
    if (!c.sortable) return;
    setSort((s) => (s?.id === c.id ? (s.dir === "asc" ? { id: c.id, dir: "desc" } : null) : { id: c.id, dir: "asc" }));
  };

  const renderCell = (c: Column<T>, f: FlatRow<T>, ci: number) => {
    const { row } = f;
    const special = c.cellStyle?.(row);
    const raw = c.accessor?.(row);
    const isNum = !!c.format;
    const align = c.align ?? (isNum ? "right" : "left");
    let content: ReactNode;
    if (c.render) content = c.render(row, { depth: f.depth, expanded: f.expanded, hasChildren: f.hasChildren });
    else if (isNum) content = formatNumber(typeof raw === "number" ? raw : null, c.format);
    else content = raw === null || raw === undefined || raw === "" ? EMPTY : String(raw);
    const emptyCell = !c.render && (raw === null || raw === undefined || raw === "" || (isNum && typeof raw !== "number"));
    const title = special?.title ?? c.title?.(row) ?? (isNum && typeof raw === "number" && c.format === "notional" ? formatFull(raw) : undefined);
    const treeFirst = ci === 0 && !!getChildren;
    return (
      <td
        key={c.id}
        data-sticky={c.sticky || undefined}
        data-align={align}
        data-num={isNum || undefined}
        data-empty={emptyCell || undefined}
        data-heat={special?.style ? "true" : undefined}
        data-hatch={special?.hatch && colorBlindSafe ? "true" : undefined}
        role={grid ? "gridcell" : undefined}
        title={title}
        style={{ height: rowH, maxWidth: c.width ? c.width : undefined, minWidth: c.width, ...special?.style, paddingLeft: treeFirst ? 12 + f.depth * 16 : undefined }}
      >
        {treeFirst && (
          f.hasChildren
            ? <button type="button" aria-label={f.expanded ? "Collapse" : "Expand"} aria-expanded={f.expanded} onClick={(e) => { e.stopPropagation(); toggleExpand(rowId(row)); }} style={{ border: 0, background: "transparent", padding: 0, marginRight: 4, verticalAlign: "middle", cursor: "pointer", color: "inherit" }}>
                {f.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            : <span style={{ display: "inline-block", width: 18 }} />
        )}
        {content}
        {special?.glyph && <span aria-label="Clipped value" style={{ marginLeft: 4, fontSize: 10 }}>{special.glyph}</span>}
      </td>
    );
  };

  const colCount = cols.length + (selectable ? 1 : 0);
  const sortAria = (c: Column<T>) => (sort?.id === c.id ? (sort.dir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined);

  return (
    <div className="ea-table-wrap" style={{ maxHeight }}>
      {(title || actions || !hideDensity || toolbarEnd) && (
        <div className="ea-table-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>{title}{actions}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {toolbarEnd}
            {!hideDensity && (
              <div className="ea-density" role="group" aria-label="Row density">
                {(["compact", "default", "comfortable"] as Density[]).map((d) => (
                  <button key={d} type="button" aria-pressed={density === d} onClick={() => setDensity(d)}>{d[0].toUpperCase() + d.slice(1)}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {error && <div style={{ padding: 8 }}><Banner tone="error" onRetry={onRetry}>{error}</Banner></div>}
      <div className="ea-table-scroll" ref={scrollRef} onScroll={virt ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined} tabIndex={0} aria-label={`${label} (scrollable)`}>
        <table className="ea-table" role={grid ? "grid" : "table"} aria-label={label} aria-rowcount={total}>
          <thead>
            {hasGroups && (
              <tr>
                {selectable && <th scope="col" aria-hidden style={{ height: 24 }} />}
                {groupSpans.map((g, i) => (
                  <th key={i} scope="colgroup" colSpan={g.span} style={{ height: 24, textAlign: "center", borderLeft: g.label ? "1px solid var(--color-border)" : undefined }}>{g.label}</th>
                ))}
              </tr>
            )}
            <tr>
              {selectable && (
                <th scope="col" style={{ width: 36, top: hasGroups ? 24 : 0, height: 32 }}>
                  <Checkbox label="Select all" checked={allIds.length > 0 && selCount === allIds.length} indeterminate={selCount > 0 && selCount < allIds.length}
                    onChange={(v) => onSelectedChange?.(v ? new Set(allIds) : new Set())} />
                </th>
              )}
              {cols.map((c) => (
                <th key={c.id} scope="col" data-sticky={c.sticky || undefined} data-sortable={c.sortable || undefined} data-align={c.align ?? (c.format ? "right" : "left")}
                  aria-sort={sortAria(c)} style={{ height: 32, top: hasGroups ? 24 : 0, minWidth: c.width }} onClick={() => { c.headerProps?.onClick?.(); onSort(c); }}>
                  {c.sortable ? (
                    <button type="button" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }} onKeyDown={undefined}>
                      {c.header}
                      <span className="ea-sort" aria-hidden>{sort?.id === c.id && sort.dir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}</span>
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="ea-row-skel">
                    {Array.from({ length: colCount }, (_, j) => <td key={j} style={{ height: rowH }}><Skeleton height={10} width={j === 0 ? "70%" : "50%"} /></td>)}
                  </tr>
                ))
              : (
                <>
                  {virt && start > 0 && <tr aria-hidden><td colSpan={colCount} style={{ height: start * rowH, padding: 0, border: 0 }} /></tr>}
                  {slice.map((f) => {
                    const id = rowId(f.row);
                    const isSel = selected?.has(id) || rowClassActive?.(f.row);
                    return (
                      <tr key={id} aria-selected={isSel || undefined} data-group={(f.hasChildren || isGroupRow?.(f.row)) || undefined}
                        onClick={onRowClick ? () => onRowClick(f.row) : undefined} style={onRowClick ? { cursor: "pointer" } : undefined}>
                        {selectable && <td style={{ height: rowH }}><Checkbox label={`Select ${id}`} checked={!!selected?.has(id)} onChange={(v) => setSel(id, v)} /></td>}
                        {cols.map((c, ci) => renderCell(c, f, ci))}
                      </tr>
                    );
                  })}
                  {virt && end < visible.length && <tr aria-hidden><td colSpan={colCount} style={{ height: (visible.length - end) * rowH, padding: 0, border: 0 }} /></tr>}
                  {pinnedRow && (
                    <tr data-pinned>
                      {selectable && <td />}
                      {cols.map((c, ci) => renderCell(c, { row: pinnedRow, depth: 0, hasChildren: false, expanded: false }, ci === 0 && getChildren ? -1 : ci))}
                    </tr>
                  )}
                </>
              )}
          </tbody>
        </table>
        {!loading && total === 0 && (
          <EmptyState title={empty?.title ?? "No results"} hint={empty?.hint ?? "Try changing the filters or date range."} action={empty?.action} />
        )}
      </div>
      {paginate && !loading && total > 0 && (
        <div className="ea-table-foot">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Rows per page
            <select className="ea-select" aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
              {pageSizes.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <span className="ea-num" aria-live="polite">
            {(safePage * pageSize + 1).toLocaleString("en-US")}–{Math.min(total, (safePage + 1) * pageSize).toLocaleString("en-US")} of {total.toLocaleString("en-US")}
          </span>
          <span style={{ display: "inline-flex" }}>
            <IconButton size="sm" label="First page" disabled={safePage === 0} onClick={() => setPage(0)}><ChevronsLeft size={16} /></IconButton>
            <IconButton size="sm" label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></IconButton>
            <IconButton size="sm" label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></IconButton>
            <IconButton size="sm" label="Last page" disabled={safePage >= pages - 1} onClick={() => setPage(pages - 1)}><ChevronsRight size={16} /></IconButton>
          </span>
        </div>
      )}
    </div>
  );
}

export { Tip };
