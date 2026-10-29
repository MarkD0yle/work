import { Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Banner, Button, ConfirmDialog, Chip, Direction, IconButton, Popover, TabBar, usePopover } from "../../ui";
import { DataTable, type Column } from "../../table";
import { cpName, TRADES, type Trade } from "../../data/mock";
import { formatDate, formatTime } from "../../lib/format";
import { usePersisted } from "../../lib/persist";
import { useRefresh } from "../../shell";

type View = { id: string; name: string };
const DEFAULT_VIEWS: View[] = [{ id: "v1", name: "Default 1" }, { id: "v2", name: "Default 2" }];
const hrs = (s: string) => Number(s.slice(0, 2)) + Number(s.slice(3, 5)) / 60;

/** Compact visual bar on a 24h track; overnight windows wrap. Label uses an en dash. */
function TradeTime({ t }: { t: Trade }) {
  const s = (hrs(t.start) / 24) * 100, e = (hrs(t.end) / 24) * 100;
  const seg = (l: number, w: number, k: string) => <span key={k} style={{ position: "absolute", left: `${l}%`, width: `${w}%`, top: 0, bottom: 0, background: "var(--data-neutral-4)" }} />;
  const segs = e > s ? [seg(s, e - s, "a")] : [seg(s, 100 - s, "a"), seg(0, e, "b")];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 110 }}>
      <span className="ea-num">{`${t.start} – ${t.end}`}</span>
      <span aria-hidden style={{ position: "relative", height: 4, background: "var(--color-border)" }}>{segs}</span>
    </div>
  );
}

function Counterparties({ ids }: { ids: string[] }) {
  const { open, triggerRef, close, toggle } = usePopover();
  const rest = ids.slice(2);
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
      {ids.slice(0, 2).map((id) => <Chip key={id} title={cpName(id)}>{cpName(id).replace("Counterparty ", "CP ").slice(0, 14)}</Chip>)}
      {rest.length > 0 && (
        <>
          <Button ref={triggerRef} variant="tertiary" size="compact" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>{`+${rest.length}`}</Button>
          <Popover open={open} onClose={close} anchor={triggerRef} pad label="More counterparties">
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {rest.map((id) => <li key={id}>{cpName(id)}</li>)}
            </ul>
          </Popover>
        </>
      )}
    </span>
  );
}

const COLUMNS: Column<Trade>[] = [
  { id: "pair", header: "Ccy pair", accessor: (r) => r.pair, sortable: true },
  { id: "ccy", header: "Ccy", accessor: (r) => r.ccy, sortable: true },
  { id: "dir", header: "Direction", accessor: (r) => r.direction, sortable: true, render: (r) => <Direction value={r.direction} /> },
  { id: "amount", header: "Amount", accessor: (r) => r.notional, format: "notional", sortable: true },
  { id: "product", header: "Product", accessor: (r) => r.product, sortable: true },
  { id: "tenor", header: "Tenor", accessor: (r) => r.tenor, sortable: true },
  { id: "time", header: "Trade time", accessor: (r) => r.start, sortable: true, width: 150, render: (r) => <TradeTime t={r} /> },
  { id: "tz", header: "Timezone", accessor: (r) => r.tz, sortable: true },
  { id: "ref", header: "Reference value (bps)", headerText: "Reference value in basis points", accessor: (r) => r.refValueBps, format: "bps", sortable: true },
  { id: "cps", header: "Counterparties", accessor: (r) => r.counterparties.length, width: 280, render: (r) => <Counterparties ids={r.counterparties} /> },
  { id: "algo", header: "Algo", accessor: (r) => r.algo ?? null, sortable: true },
];

export function TradeList({ activeId, onSelect, loading, error, onRetry }: {
  activeId: string | null; onSelect: (t: Trade | null) => void; loading: boolean; error?: string; onRetry: () => void;
}) {
  const [views, setViews] = usePersisted<View[]>("liquiditycost.views", DEFAULT_VIEWS);
  const [view, setView] = usePersisted<string>("tab.liquiditycost.view", "v1");
  const [rowsByView, setRowsByView] = useState<Record<string, Trade[]>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const { loadedAt, refreshing, refresh } = useRefresh();
  const current = views.some((v) => v.id === view) ? view : views[0].id;
  const rows = useMemo(() => rowsByView[current] ?? TRADES, [rowsByView, current]);
  const setRows = (fn: (r: Trade[]) => Trade[]) => setRowsByView((m) => ({ ...m, [current]: fn(m[current] ?? TRADES) }));

  const addView = () => {
    const n = views.length + 1;
    const id = `v${Date.now()}`;
    setViews([...views, { id, name: `Default ${n}` }]);
    setView(id);
    setChecked(new Set());
  };
  const addRow = () => {
    const id = `t${Date.now()}`;
    setRows((r) => [...r, { id, pair: "EUR/USD", ccy: "EUR", direction: "buy", notional: 5_000_000, product: "Spot", tenor: "Spot", start: "09:00", end: "17:00", tz: "London", refValueBps: 0.5, counterparties: ["cp1", "cp2"], algo: "TWAP" }]);
    setNote("Row added");
  };
  const doDelete = () => {
    setRows((r) => r.filter((x) => !checked.has(x.id)));
    if (activeId && checked.has(activeId)) onSelect(null);
    setNote(`${checked.size} ${checked.size === 1 ? "row" : "rows"} deleted`);
    setChecked(new Set()); setConfirm(false);
  };
  const delReason = "Select at least one row to delete";

  return (
    <section aria-label="Trade list" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TabBar label="Saved views" value={current} onChange={(id) => { setView(id); setChecked(new Set()); }} tabs={views.map((v) => ({ id: v.id, label: v.name }))} />
        <IconButton label="Add view" size="sm" onClick={addView}><Plus size={16} strokeWidth={1.5} /></IconButton>
      </div>
      {note && <Banner tone="info">{note}</Banner>}
      <DataTable<Trade>
        label="Planned trades" persistKey="liquiditycost.trades" columns={COLUMNS} rows={rows} rowId={(r) => r.id}
        selectable selected={checked} onSelectedChange={setChecked}
        onRowClick={(r) => onSelect(r.id === activeId ? null : r)} rowClassActive={(r) => r.id === activeId}
        loading={loading} error={error} onRetry={onRetry} defaultDensity="default"
        empty={{ title: "No trades in this view", hint: "Add a row to start analysing a planned trade." }}
        actions={
          <div style={{ display: "flex", gap: 4 }}>
            <IconButton label="Add row" size="sm" onClick={addRow}><Plus size={16} strokeWidth={1.5} /></IconButton>
            <IconButton label="Import trades" size="sm" onClick={() => setNote("Import is not connected in this prototype")}><Upload size={16} strokeWidth={1.5} /></IconButton>
            <IconButton label="Refresh trades" tip={`Refresh trades. Last loaded ${formatDate(loadedAt)} ${formatTime(loadedAt)}`} size="sm" disabled={refreshing} onClick={refresh}><RefreshCw size={16} strokeWidth={1.5} className={refreshing ? "ea-spin" : undefined} /></IconButton>
            <IconButton label="Delete selected" tip={checked.size ? `Delete ${checked.size} selected` : delReason} size="sm" disabled={!checked.size} onClick={() => setConfirm(true)}><Trash2 size={16} strokeWidth={1.5} /></IconButton>
          </div>
        }
      />
      {confirm && (
        <ConfirmDialog
          title={`Delete ${checked.size} ${checked.size === 1 ? "trade" : "trades"}?`}
          body={`The selected ${checked.size === 1 ? "trade" : "trades"} will be removed from the view "${views.find((v) => v.id === current)?.name}". This cannot be undone.`}
          confirmLabel="Delete" onConfirm={doDelete} onCancel={() => setConfirm(false)}
        />
      )}
    </section>
  );
}
