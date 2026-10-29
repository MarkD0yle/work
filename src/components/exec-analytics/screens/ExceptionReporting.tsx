import { useMemo, useState } from "react";
import { Clock, Play } from "lucide-react";
import { Banner, Button, ConfirmDialog, IconButton, PageHeader, ReadOnlyBadge, SearchInput, TabBar, Tip, Toggle, WithReason } from "../ui";
import { LastLoaded, RefreshButton, usePreviewState, useInitialLoad, useRefresh } from "../shell";
import { DataTable, type Column } from "../table";
import { formatDate, formatTime } from "../lib/format";
import { usePersisted } from "../lib/persist";
import { EXCEPTION_RULES, type ExceptionRule } from "../data/mock";
import { OverflowChips } from "./exception-reporting/OverflowChips";

const TABS = [
  { id: "FX", label: "FX", tip: "FX" },
  { id: "CR", label: "CR", tip: "Credit" },
  { id: "MA", label: "MA", tip: "Margin" },
];
const NO_PERMISSION = "You don't have permission";
const conditionText = (c: ExceptionRule["conditions"][number]) => (c.op === "=" ? `${c.field}: ${c.value}` : `${c.field} ${c.op} ${c.value}`);

export default function ExceptionReporting() {
  const initial = useInitialLoad();
  const preview = usePreviewState();
  const { loadedAt, refreshing, refresh } = useRefresh();
  const [rules, setRules] = useState<ExceptionRule[]>(EXCEPTION_RULES);
  const [tab, setTab] = usePersisted("tab.exception", "FX");
  const [readOnly, setReadOnly] = usePersisted("exception.readOnly", false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState("");

  const rows = useMemo(() => {
    if (preview === "empty") return [];
    const q = query.trim().toLowerCase();
    return rules.filter((r) => r.category === tab && (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)));
  }, [rules, tab, query, preview]);

  const run = (ids: string[]) => {
    const names = rules.filter((r) => ids.includes(r.id)).map((r) => r.name);
    setStatus(names.length === 1 ? `Report ran: ${names[0]}` : `${names.length} reports ran`);
    setSelected(new Set());
  };
  const onRunSelected = () => (selected.size > 1 ? setConfirm(true) : run([...selected]));
  const toggleEnabled = (id: string, enabled: boolean) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled } : r)));

  const columns: Column<ExceptionRule>[] = [
    { id: "name", header: "Name", accessor: (r) => r.name, width: 220 },
    { id: "conditions", header: "Conditions", width: 320, render: (r) => <OverflowChips items={r.conditions.map(conditionText)} label="conditions" /> },
    {
      id: "email", header: "Email", width: 180, accessor: (r) => r.email,
      render: (r) => <Tip label={r.email}><span style={{ display: "block", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email}</span></Tip>,
    },
    { id: "frequency", header: "Frequency", accessor: (r) => r.frequency },
    {
      id: "enabled", header: "Enabled",
      render: (r) => (
        <WithReason reason={readOnly ? NO_PERMISSION : undefined}>
          <span><Toggle checked={r.enabled} label={`Enabled: ${r.name}`} disabled={readOnly} onChange={(v) => toggleEnabled(r.id, v)} /></span>
        </WithReason>
      ),
    },
    {
      id: "actions", header: "Actions",
      render: (r) => (
        <span style={{ display: "inline-flex" }}>
          <IconButton label={`Run ${r.name}`} tip={readOnly ? NO_PERMISSION : "Run"} size="sm" disabled={readOnly} onClick={() => run([r.id])}><Play size={16} strokeWidth={1.5} /></IconButton>
          <IconButton label={`History for ${r.name}`} tip="History" size="sm" onClick={() => setStatus(`Showing history for ${r.name}`)}><Clock size={16} strokeWidth={1.5} /></IconButton>
        </span>
      ),
    },
    {
      id: "modified", header: "Modified", sortable: true, accessor: (r) => r.modifiedAt,
      render: (r) => (
        <div style={{ lineHeight: "16px" }}>
          <div>{r.modifiedBy}</div>
          <div className="ea-caption">{formatDate(r.modifiedAt)} {formatTime(r.modifiedAt)}</div>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="ea-page">
        <PageHeader
          title="Exception reports"
          badge={readOnly ? <ReadOnlyBadge /> : undefined}
          left={<SearchInput label="Search exception reports" value={query} onChange={(e) => setQuery(e.target.value)} />}
          right={
            <>
              <LastLoaded at={loadedAt} />
              <RefreshButton loadedAt={loadedAt} refreshing={refreshing} onRefresh={refresh} />
              <Button variant="tertiary" onClick={() => setReadOnly(!readOnly)}>{readOnly ? "Exit read-only preview" : "Preview read-only mode"}</Button>
              <WithReason reason={readOnly ? NO_PERMISSION : selected.size === 0 ? "Select at least one report to run" : undefined}>
                <span><Button variant="primary" disabled={readOnly || selected.size === 0} onClick={onRunSelected}>Run selected</Button></span>
              </WithReason>
            </>
          }
        />
        {status && <div aria-live="polite"><Banner tone="success">{status}</Banner></div>}
        <TabBar label="Exception report categories" tabs={TABS} value={tab} onChange={(t) => { setTab(t); setSelected(new Set()); }} />
        <DataTable
          label="Exception reports" persistKey="exception" columns={columns} rows={rows} rowId={(r) => r.id}
          selectable selected={selected} onSelectedChange={setSelected} defaultSort={{ id: "modified", dir: "desc" }}
          hideDensity loading={initial || preview === "loading"} error={preview === "error" ? "Couldn't load exception reports." : undefined} onRetry={refresh}
          empty={{ title: "No exception reports in this category", hint: "Reports created for this category will appear here.", action: <Button variant="tertiary">How exception reports work</Button> }}
        />
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Run ${selected.size} reports?`} confirmLabel="Run reports"
          body={`${selected.size} selected exception reports will run now and email their results to each recipient.`}
          onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); run([...selected]); }}
        />
      )}
    </>
  );
}
