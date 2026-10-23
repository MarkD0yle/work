import { usePop } from "../exception-reporting/usePop";
import { useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { Button, Checkbox, Drawer, IconButton, Menu, Popover, Select, Toggle } from "../../ui";
import { OverflowChips } from "../exception-reporting/OverflowChips";
import { GROUP_OPTIONS, PERIODS, TYPE_LABEL, type Cfg, type RegRow } from "./model";

export function RowMenu({ name, onDelete }: { name: string; onDelete: () => void }) {
  const { open, ref, close, toggle } = usePop();
  return (
    <>
      <IconButton ref={ref} label={`More actions for ${name}`} tip="More actions" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><MoreHorizontal size={16} strokeWidth={1.5} /></IconButton>
      <Menu open={open} onClose={close} anchor={ref} align="end" items={[{ id: "delete", label: "Delete…", onSelect: onDelete }]} />
    </>
  );
}

export function ConditionsEditor({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const { open, ref, close, toggle } = usePop();
  const [text, setText] = useState("");
  const add = () => { const t = text.trim(); if (t) { onChange([...items, t]); setText(""); } };
  return (
    <>
      <button ref={ref} type="button" className="ea-chip" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        {items.length === 0 ? "Everything" : `${items.length} ${items.length === 1 ? "condition" : "conditions"}`}
      </button>
      <Popover open={open} onClose={close} anchor={ref} pad label="Edit conditions">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 280 }}>
          {items.length === 0 && <span className="ea-muted">No conditions: all trades are included.</span>}
          {items.map((c, i) => (
            <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>{c}</span>
              <Button variant="tertiary" size="compact" aria-label={`Remove ${c}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <input className="ea-input" data-size="compact" aria-label="New condition" placeholder="Field: value" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button size="compact" onClick={add} disabled={!text.trim()}>Add</Button>
          </div>
        </div>
      </Popover>
    </>
  );
}

export function GroupByCell({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { open, ref, close, toggle } = usePop();
  const setGroup = (g: string, on: boolean) => onChange(GROUP_OPTIONS.filter((o) => (o === g ? on : value.includes(o))));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {value.length ? <OverflowChips items={value} label="group by fields" /> : <span className="ea-muted">None</span>}
      <IconButton ref={ref} label="Edit group by" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}><Pencil size={16} strokeWidth={1.5} /></IconButton>
      <Popover open={open} onClose={close} anchor={ref} pad label="Group by">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {GROUP_OPTIONS.map((g) => (
            <label key={g} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Checkbox label={g} checked={value.includes(g)} onChange={(v) => setGroup(g, v)} />{g}
            </label>
          ))}
        </div>
      </Popover>
    </div>
  );
}

export function ConfigDrawer({ row, onClose, onApply }: { row: RegRow; onClose: () => void; onApply: (type: RegRow["type"], cfg: Cfg) => void }) {
  const [type, setType] = useState(row.type);
  const [cfg, setCfg] = useState(row.cfg);
  return (
    <Drawer
      title={`Configure ${row.name || "untitled report"}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { onApply(type, cfg); onClose(); }}>Apply</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Select label="Report type" value={type} onChange={(e) => setType(e.target.value as RegRow["type"])} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
        <Select label="Reporting period" value={cfg.period} onChange={(e) => setCfg({ ...cfg, period: e.target.value })} options={PERIODS} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Include cancelled trades
          <Toggle label="Include cancelled trades" checked={cfg.includeCancelled} onChange={(v) => setCfg({ ...cfg, includeCancelled: v })} />
        </div>
      </div>
    </Drawer>
  );
}
