/* eslint-disable react-hooks/refs -- usePopover returns a state-backed ref handle; the lint rule cannot tell it is safe to read in render */
import { GripVertical, Maximize2, Settings2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Banner, Button, IconButton, Menu, Modal, Skeleton, TabBar, usePopover, type MenuEntry, type TabDef } from "../ui";
import { formatDate, formatTime } from "../lib/format";
import { SIZES, SIZE_COLS, usePanelCtx, type PanelSize } from "./PanelGrid";

export type PanelTable = { columns: string[]; rows: (string | number | null)[][] };
type BodyCtx = { expanded: boolean; height: number };

type Props = {
  title: string;
  /** Preset width; only used outside a PanelGrid (inside, the grid owns it). */
  size?: PanelSize;
  height?: number;
  actions?: ReactNode;
  tabs?: { tabs: TabDef[]; value: string; onChange: (id: string) => void; label: string };
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  empty?: { message?: string; onChangeFilters?: () => void } | boolean;
  /** Extra Settings-menu entries. */
  menu?: MenuEntry[];
  /** Enables "View as table" in the panel menu (required for accessibility). */
  asTable?: PanelTable;
  loadedAt?: Date;
  footer?: ReactNode;
  /** Hides the chart body padding (for tables). */
  flush?: boolean;
  children: ReactNode | ((ctx: BodyCtx) => ReactNode);
  /** Disable Expand where it makes no sense; the button is never omitted. */
  expandDisabled?: boolean;
};

/** The frame every chart sits in. The chart varies; the frame cannot. */
export function ChartPanel(p: Props) {
  const grid = usePanelCtx();
  const size = grid?.size ?? p.size ?? "M";
  const height = p.height ?? 260;
  const [expanded, setExpanded] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const menu = usePopover();
  const [now] = useState(() => Date.now());
  const stale = p.loadedAt && now - p.loadedAt.getTime() > 15 * 60 * 1000;
  const items: MenuEntry[] = [
    ...(p.asTable ? [{ id: "table", label: "View as table", onSelect: () => setAsTable(true) }] : []),
    ...(p.menu ?? []),
    ...(grid ? SIZES.map((s, i): MenuEntry => ({ id: `size-${s}`, label: `${s === size ? "✓ " : ""}Panel size ${s}`, separatorBefore: i === 0 && (!!p.asTable || !!p.menu?.length), onSelect: () => grid.setSize(s) })) : []),
  ];
  const body = (ctx: BodyCtx) => (typeof p.children === "function" ? p.children(ctx) : p.children);
  const emptyCfg = typeof p.empty === "object" ? p.empty : {};
  const rootRef = useRef<HTMLElement>(null);

  let content: ReactNode;
  if (p.error) content = <Banner tone="error" onRetry={p.onRetry}>{p.error}</Banner>;
  else if (p.loading) content = (
    // Skeleton fades in after 200ms (CSS delay) so quick loads do not flash.
    <div className="ea-delayed" style={{ height, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "8px 0" }} aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={1} />)}<Skeleton height={12} width="60%" />
    </div>
  );
  else if (p.empty) content = (
    <div className="ea-empty" style={{ minHeight: height }}>
      <div>{emptyCfg.message ?? "No data for this selection"}</div>
      {emptyCfg.onChangeFilters && <Button variant="secondary" size="compact" onClick={emptyCfg.onChangeFilters}>Change filters</Button>}
    </div>
  );
  else content = body({ expanded: false, height });

  return (
    <section ref={rootRef} className={`ea-panel ${grid ? "" : SIZE_COLS[size]}`} aria-label={p.title}>
      <div className="ea-panel-head">
        <button type="button" className="ea-icon-btn ea-handle" data-size="sm" aria-label={`Reorder ${p.title}. Alt plus arrow keys to move`} {...(grid?.handle ?? {})} disabled={!grid}>
          <GripVertical size={16} />
        </button>
        <div className="ea-panel-title">
          <h3 className="ea-section-title">{p.title}</h3>
          {p.tabs && <TabBar compact {...p.tabs} />}
        </div>
        {p.actions}
        <IconButton ref={menu.triggerRef} size="sm" label="Panel settings" tip={items.length ? "Panel settings" : "No settings for this panel"} disabled={!items.length} aria-haspopup="menu" aria-expanded={menu.open} onClick={menu.toggle}><Settings2 size={16} /></IconButton>
        <Menu open={menu.open} onClose={menu.close} anchor={menu.triggerRef} align="end" items={items} />
        <IconButton size="sm" label="Expand" tip={p.expandDisabled ? "Not available for this panel" : "Expand"} disabled={p.expandDisabled || !!p.error} onClick={() => setExpanded(true)}><Maximize2 size={16} /></IconButton>
      </div>
      <div className="ea-panel-body" data-flush={p.flush || undefined}>{content}</div>
      {(p.footer || stale) && (
        <div className="ea-panel-foot">
          {p.footer}
          {stale && p.loadedAt && <div className="ea-caption">Last loaded {formatDate(p.loadedAt)} {formatTime(p.loadedAt)}</div>}
        </div>
      )}
      {expanded && (
        <Modal title={p.title} wide onClose={() => setExpanded(false)}>
          {p.tabs && <div style={{ marginBottom: 8 }}><TabBar {...p.tabs} /></div>}
          {body({ expanded: true, height: Math.max(420, Math.round(window.innerHeight * 0.62)) })}
        </Modal>
      )}
      {asTable && p.asTable && (
        <Modal title={`${p.title} (table)`} wide onClose={() => setAsTable(false)}>
          <table className="ea-table" style={{ width: "100%" }}>
            <thead><tr>{p.asTable.columns.map((c) => <th key={c} scope="col" style={{ height: 32 }}>{c}</th>)}</tr></thead>
            <tbody>{p.asTable.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} data-num={typeof v === "number" || undefined} data-align={typeof v === "number" ? "right" : undefined} style={{ height: 28 }}>{v ?? "—"}</td>)}</tr>)}</tbody>
          </table>
        </Modal>
      )}
    </section>
  );
}
