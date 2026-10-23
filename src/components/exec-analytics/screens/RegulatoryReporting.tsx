import { usePop } from "./exception-reporting/usePop";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, Clock, Play, Settings } from "lucide-react";
import { Badge, Banner, Button, ConfirmDialog, IconButton, Input, Menu, Modal, PageHeader, Select, Toggle, Tip } from "../ui";
import { useInitialLoad, usePreviewState, useRefresh } from "../shell";
import { DataTable, type Column } from "../table";
import { formatDate } from "../lib/format";
import { AS_OF, addDays } from "../lib/dates";
import { REG_REPORTS, type RegReport } from "../data/mock";
import { CCYS, DEFAULT_CFG, FREQUENCIES, TYPE_LABEL, configKey, isDirty, validate, type RegRow, type Row } from "./regulatory-reporting/model";
import { ConditionsEditor, ConfigDrawer, GroupByCell, RowMenu } from "./regulatory-reporting/RowControls";

const seed = (): Row[] => REG_REPORTS.map((r) => { const d = { ...r, cfg: { ...DEFAULT_CFG } }; return { draft: d, saved: d }; });

function AddReportButton({ variant, onAdd }: { variant: "primary" | "secondary"; onAdd: (t: RegReport["type"]) => void }) {
  const { open, ref, close, toggle } = usePop();
  return (
    <>
      <Button ref={ref} variant={variant} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>Add report</Button>
      <Menu open={open} onClose={close} anchor={ref}
        items={(Object.keys(TYPE_LABEL) as RegReport["type"][]).map((t) => ({ id: t, label: TYPE_LABEL[t], onSelect: () => onAdd(t) }))} />
    </>
  );
}

export default function RegulatoryReporting() {
  const initial = useInitialLoad();
  const preview = usePreviewState();
  const { refresh } = useRefresh();
  const [rows, setRows] = useState<Row[]>(seed);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const nextId = useRef(1);

  const shown = preview === "empty" ? [] : rows;
  const dupes = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(configKey(r.draft), (counts.get(configKey(r.draft)) ?? 0) + 1));
    return (r: RegRow) => (counts.get(configKey(r)) ?? 0) > 1;
  }, [rows]);

  const patch = (id: string, p: Partial<RegRow>) => setRows((rs) => rs.map((r) => (r.draft.id === id ? { ...r, draft: { ...r.draft, ...p } } : r)));
  const save = (id: string) => setRows((rs) => rs.map((r) => (r.draft.id === id ? { ...r, saved: r.draft } : r)));
  const add = (type: RegReport["type"]) => {
    const draft: RegRow = { id: `new${nextId.current++}`, name: "", type, ccy: "USD", conditions: [], groupBy: [], email: "", enabled: false, hasHistory: false, cfg: { ...DEFAULT_CFG } };
    setRows((rs) => [{ draft, saved: null }, ...rs]);
  };
  const byId = (id: string | null) => rows.find((r) => r.draft.id === id)?.draft;
  const label = (r: RegRow) => r.name || "Untitled report";

  const columns: Column<Row>[] = [
    {
      id: "name", header: "Name", width: 220,
      render: ({ draft: r, saved }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isDirty({ draft: r, saved }) && <span role="img" aria-label="Unsaved changes" title="Unsaved changes" style={{ flex: "none", width: 8, height: 8, background: "var(--color-accent)" }} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <Input label={`Name of ${label(r)}`} hideLabel size="compact" placeholder="Untitled report" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
            {dupes(r) && <span><Badge tone="warning">Duplicate</Badge></span>}
          </div>
        </div>
      ),
    },
    {
      id: "type", header: "Type", width: 180,
      render: ({ draft: r }) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {TYPE_LABEL[r.type]}
          <IconButton label={`Configure ${label(r)}`} tip="Configure" size="sm" onClick={() => setDrawerId(r.id)}><Settings size={16} strokeWidth={1.5} /></IconButton>
        </span>
      ),
    },
    { id: "ccy", header: "Ccy", width: 90, render: ({ draft: r }) => <Select label={`Currency for ${label(r)}`} hideLabel size="compact" value={r.ccy} options={CCYS} onChange={(e) => patch(r.id, { ccy: e.target.value })} /> },
    { id: "conditions", header: "Conditions", render: ({ draft: r }) => <ConditionsEditor items={r.conditions} onChange={(v) => patch(r.id, { conditions: v })} /> },
    { id: "groupBy", header: "Group by", width: 240, render: ({ draft: r }) => <GroupByCell value={r.groupBy} onChange={(v) => patch(r.id, { groupBy: v })} /> },
    {
      id: "email", header: "Email", width: 220,
      render: ({ draft: r }) => <Input label={`Email for ${label(r)}`} hideLabel type="email" size="compact" placeholder="name@example.com" value={r.email} error={validate(r).email} onChange={(e) => patch(r.id, { email: e.target.value })} />,
    },
    { id: "enabled", header: "Enabled", render: ({ draft: r }) => <Toggle label={`Enabled: ${label(r)}`} checked={r.enabled} onChange={(v) => patch(r.id, { enabled: v })} /> },
    {
      id: "frequency", header: "Frequency", width: 140,
      render: ({ draft: r }) => (
        <Tip label={r.enabled ? "" : "Turn on Enabled to choose a frequency"}>
          <span style={{ display: "block", width: "100%" }}>
            <Select label={`Frequency for ${label(r)}`} hideLabel size="compact" disabled={!r.enabled} value={r.frequency ?? ""} error={validate(r).frequency}
              options={[{ value: "", label: "Select…" }, ...FREQUENCIES]} onChange={(e) => patch(r.id, { frequency: e.target.value || undefined })} />
          </span>
        </Tip>
      ),
    },
    {
      id: "actions", header: "Actions", width: 200,
      render: (row) => {
        const r = row.draft; const errs = validate(r); const hasErr = Object.keys(errs).length > 0;
        return (
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {hasErr && <Tip label="Fix the highlighted fields before saving or running"><span role="img" aria-label="Row has errors" style={{ display: "inline-flex", color: "var(--status-error)" }}><AlertCircle size={16} strokeWidth={1.5} /></span></Tip>}
            <IconButton label={`Run ${label(r)} now`} tip="Run now" size="sm" onClick={() => setStatus(`Report started: ${label(r)}`)}><Play size={16} strokeWidth={1.5} /></IconButton>
            <IconButton label={`History for ${label(r)}`} tip={r.hasHistory ? "History" : "No history yet. Run this report to create one"} size="sm" disabled={!r.hasHistory} onClick={() => setHistoryId(r.id)}><Clock size={16} strokeWidth={1.5} /></IconButton>
            <RowMenu name={label(r)} onDelete={() => setDeleteId(r.id)} />
            {isDirty(row) && (hasErr
              ? <Tip label="Fix errors before saving"><span><Button variant="tertiary" size="compact" disabled>Save</Button></span></Tip>
              : <Button variant="tertiary" size="compact" onClick={() => save(r.id)}>Save</Button>)}
          </span>
        );
      },
    },
  ];

  const isEmpty = shown.length === 0;
  const del = byId(deleteId); const drawer = byId(drawerId); const hist = byId(historyId);
  return (
    <div className="ea-page">
      <PageHeader title="Regulatory reports" right={<AddReportButton variant={isEmpty ? "secondary" : "primary"} onAdd={add} />} />
      <div aria-live="polite">{status && <Banner tone="success">{status}</Banner>}</div>
      <DataTable
        label="Regulatory reports" persistKey="regulatory" columns={columns} rows={shown} rowId={(r) => r.draft.id} grid hideDensity
        loading={initial || preview === "loading"} error={preview === "error" ? "Couldn't load regulatory reports." : undefined} onRetry={refresh}
        empty={{ title: "No regulatory reports yet", hint: "Add a report to configure, schedule and run it.", action: <AddReportButton variant="primary" onAdd={add} /> }}
      />
      {drawer && (
        <ConfigDrawer key={drawer.id} row={drawer} onClose={() => setDrawerId(null)} onApply={(type, cfg) => patch(drawer.id, { type, cfg })} />
      )}
      {del && (
        <ConfirmDialog
          title={`Delete ${label(del)}?`} confirmLabel="Delete report"
          body={`“${label(del)}” and its schedule will be removed. Past results are not affected.`}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => { setRows((rs) => rs.filter((r) => r.draft.id !== del.id)); setStatus(`Deleted ${label(del)}`); setDeleteId(null); }}
        />
      )}
      {hist && (
        <Modal title={`History: ${label(hist)}`} onClose={() => setHistoryId(null)} actions={<Button onClick={() => setHistoryId(null)}>Close</Button>}>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {[1, 8, 15].map((d) => <li key={d}>Ran on {formatDate(addDays(AS_OF, -d))}</li>)}
          </ul>
        </Modal>
      )}
    </div>
  );
}
