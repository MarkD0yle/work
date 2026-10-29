import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Banner, Button, ConfirmDialog, IconButton, Input, Modal, PageHeader, SearchInput, TabBar } from "../ui";
import { DateRange, LastLoaded, RefreshButton, useInitialLoad, usePreviewState, useRefresh } from "../shell";
import { DataTable, type Column } from "../table";
import { formatDate, formatNumber, formatTime } from "../lib/format";
import { AS_OF, addDays, type DateRangeValue } from "../lib/dates";
import { usePersisted } from "../lib/persist";
import { buildReportFiles, type ReportFile } from "../data/mock";

const TABS = [
  { id: "manual", label: "Manual uploads" },
  { id: "automated", label: "Automated uploads" },
  { id: "deleted", label: "Deleted reports" },
];
// Default spans the full seed so the footer reads "1–10 of 1,042" across tabs on first load.
const DEFAULT_RANGE: DateRangeValue = { preset: "Custom", start: addDays(AS_OF, -310), end: AS_OF };
const restoredSource = (f: ReportFile): ReportFile["source"] => (f.createdBy === "Automated Import" ? "automated" : "manual");

export default function ReviewReports() {
  const initial = useInitialLoad();
  const preview = usePreviewState();
  const { loadedAt, refreshing, refresh } = useRefresh();
  const [files, setFiles] = useState<ReportFile[]>(buildReportFiles);
  const [applied, setApplied] = usePersisted<DateRangeValue>("range.review", DEFAULT_RANGE);
  const [draft, setDraft] = useState(applied);
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = usePersisted("tab.review", "manual");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detail, setDetail] = useState<ReportFile | null>(null);
  const [status, setStatus] = useState("");
  const dateRef = useRef<HTMLDivElement>(null);

  const viewResults = () => {
    setApplying(true);
    window.setTimeout(() => { setApplied(draft); setSelected(new Set()); setApplying(false); }, 400);
  };

  const inRange = useMemo(() => files.filter((f) => f.createdAt.slice(0, 10) >= applied.start && f.createdAt.slice(0, 10) <= applied.end), [files, applied]);
  const rows = useMemo(() => {
    if (preview === "empty") return [];
    const q = query.trim().toLowerCase();
    return inRange.filter((f) => f.source === tab && (!q || `${f.fileName} ${f.createdBy} ${f.notes ?? ""}`.toLowerCase().includes(q)));
  }, [inRange, tab, query, preview]);

  const setNote = (id: string, notes: string) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, notes } : f)));
  const moveSelected = (to: "deleted" | "restore") => {
    setFiles((fs) => fs.map((f) => (selected.has(f.id) ? { ...f, source: to === "deleted" ? "deleted" : restoredSource(f) } : f)));
    setStatus(`${selected.size} ${selected.size === 1 ? "report" : "reports"} ${to === "deleted" ? "moved to Deleted reports" : "restored"}`);
    setSelected(new Set());
  };

  const columns: Column<ReportFile>[] = [
    {
      id: "createdAt", header: "Date created", sortable: true, accessor: (f) => f.createdAt, width: 160,
      render: (f) => (
        <button type="button" onClick={() => setDetail(f)} style={{ border: 0, background: "transparent", padding: 0, font: "inherit", color: "var(--color-accent)", textDecoration: "underline", cursor: "pointer" }}>
          {formatDate(f.createdAt)}
        </button>
      ),
    },
    { id: "createdBy", header: "Created by", accessor: (f) => f.createdBy },
    { id: "fileName", header: "File name", accessor: (f) => f.fileName },
    { id: "trades", header: "Trades", accessor: (f) => f.trades, format: "count" },
    {
      id: "download", header: "Download",
      render: (f) => <IconButton label={`Download ${f.fileName}`} tip="Download" size="sm" onClick={() => setStatus(`Download started: ${f.fileName}`)}><Download size={16} strokeWidth={1.5} /></IconButton>,
    },
    {
      id: "notes", header: "Notes", width: 240,
      render: (f) => <Input label={`Note for ${f.fileName}`} hideLabel size="compact" placeholder="Add note" value={f.notes ?? ""} onChange={(e) => setNote(f.id, e.target.value)} />,
    },
  ];

  const count = selected.size;
  const noun = count === 1 ? "report" : "reports";
  return (
    <div className="ea-page">
      <PageHeader title="Review reports" />
      <div ref={dateRef} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBottom: 16 }}>
        <DateRange label="Report date range" value={draft} onChange={setDraft} />
        <Button variant="primary" loading={applying} onClick={viewResults}>View results</Button>
      </div>
      <TabBar label="Report sources" tabs={TABS} value={tab} onChange={(t) => { setTab(t); setSelected(new Set()); }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <SearchInput label="Search reports" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LastLoaded at={loadedAt} />
          <RefreshButton loadedAt={loadedAt} refreshing={refreshing} onRefresh={refresh} />
        </div>
      </div>
      <div aria-live="polite">{status && <Banner tone="success">{status}</Banner>}</div>
      {count > 0 && (
        <div role="toolbar" aria-label="Bulk actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="ea-num">{formatNumber(count, "count")} selected</span>
          <Button size="compact" icon={<Download size={16} strokeWidth={1.5} />} onClick={() => setStatus(`Download started for ${count} ${noun}`)}>Download</Button>
          {tab === "deleted"
            ? <Button size="compact" onClick={() => moveSelected("restore")}>Restore</Button>
            : <Button size="compact" onClick={() => setConfirmDelete(true)}>Delete</Button>}
        </div>
      )}
      <DataTable
        label="Report files" persistKey="review" columns={columns} rows={rows} rowId={(f) => f.id} selectable selected={selected} onSelectedChange={setSelected}
        defaultSort={{ id: "createdAt", dir: "desc" }} paginate hideDensity grid
        loading={initial || preview === "loading" || applying} error={preview === "error" ? "Couldn't load reports." : undefined} onRetry={refresh}
        empty={{
          title: "No reports in this date range", hint: "Try a wider range, then press View results.",
          action: <Button onClick={() => dateRef.current?.querySelector<HTMLElement>("select")?.focus()}>Change dates</Button>,
        }}
      />
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${count} ${noun}?`} confirmLabel="Delete"
          body={`${count} ${noun} will move to Deleted reports. You can restore them from that tab.`}
          onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); moveSelected("deleted"); }}
        />
      )}
      {detail && (
        <Modal title="Report details" onClose={() => setDetail(null)} actions={<Button onClick={() => setDetail(null)}>Close</Button>}>
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 24px", margin: 0 }}>
            <dt className="ea-muted">File name</dt><dd style={{ margin: 0 }}>{detail.fileName}</dd>
            <dt className="ea-muted">Created</dt><dd style={{ margin: 0 }}>{formatDate(detail.createdAt)} {formatTime(detail.createdAt)}</dd>
            <dt className="ea-muted">Created by</dt><dd style={{ margin: 0 }}>{detail.createdBy}</dd>
            <dt className="ea-muted">Trades</dt><dd style={{ margin: 0 }} className="ea-num">{formatNumber(detail.trades, "count")}</dd>
            <dt className="ea-muted">Notes</dt><dd style={{ margin: 0 }}>{detail.notes || "—"}</dd>
          </dl>
        </Modal>
      )}
    </div>
  );
}
