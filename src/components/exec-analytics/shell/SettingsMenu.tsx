/* eslint-disable react-refresh/only-export-components -- hooks/contexts live beside their components; HMR granularity is not a concern here */
import { Info, Languages, LogOut, Palette, SlidersHorizontal, FileText, Users, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { PRODUCT_NAME, USER_NAME } from "../config/brand";
import { Button, Drawer, Modal, Select, Toggle } from "../ui";
import { clearPersisted } from "../lib/persist";
import { usePrefs } from "./prefs";

export type SettingsId = "factors" | "configure-pdf" | "configure-groups" | "preferences" | "translation" | "glossary" | "about" | "sign-out";
export const SETTINGS_ITEMS: { id: SettingsId; label: string; icon: LucideIcon; separatorBefore?: boolean }[] = [
  { id: "factors", label: "Factors", icon: SlidersHorizontal },
  { id: "configure-pdf", label: "Configure PDF", icon: FileText },
  { id: "configure-groups", label: "Configure Groups", icon: Users },
  { id: "preferences", label: "My Preferences", icon: Palette },
  { id: "translation", label: "Load Translation File", icon: Languages },
  { id: "glossary", label: "Glossary", icon: BookOpen, separatorBefore: true },
  { id: "about", label: "About", icon: Info },
  { id: "sign-out", label: "Sign Out", icon: LogOut, separatorBefore: true },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span>{label}</span>{children}</div>;
}
function ToggleRow({ label, init }: { label: string; init: boolean }) {
  const [v, setV] = useState(init);
  return <Row label={label}><Toggle checked={v} onChange={setV} label={label} /></Row>;
}

const GLOSSARY: [string, string][] = [
  ["bps", "Basis points; one hundredth of a percent."],
  ["PAWR", "Par-adjusted win rate: share of quotes beating par, adjusted for size."],
  ["Reval 30s", "Mid-price movement in the 30 seconds after execution."],
  ["Act−Exp", "Actual cost minus expected cost."],
  ["Spread", "Execution price versus mid at the time of the trade."],
];

export function SettingsHost({ openId, onClose }: { openId: SettingsId | null; onClose: () => void }) {
  const { prefs, setPrefs, resetLayout } = usePrefs();
  if (!openId) return null;
  const apply = <Button variant="primary" onClick={onClose}>Save</Button>;
  const cancel = <Button variant="secondary" onClick={onClose}>Cancel</Button>;
  switch (openId) {
    case "factors":
      return <Drawer title="Factors" onClose={onClose} footer={<>{cancel}{apply}</>}>
        <ToggleRow label="Market impact" init /><ToggleRow label="Spot spread" init /><ToggleRow label="Forward spread" init /><ToggleRow label="Volatility" init={false} /></Drawer>;
    case "configure-pdf":
      return <Drawer title="Configure PDF" onClose={onClose} footer={<>{cancel}{apply}</>}>
        <Select label="Paper size" options={["A4", "Letter"]} /><Select label="Orientation" options={["Landscape", "Portrait"]} /><ToggleRow label="Include charts" init /><ToggleRow label="Include data tables" init /></Drawer>;
    case "configure-groups":
      return <Drawer title="Configure Groups" onClose={onClose} footer={<>{cancel}{apply}</>}>
        <ToggleRow label="G10" init /><ToggleRow label="EM" init /><ToggleRow label="Restricted" init /><ToggleRow label="NDF" init /></Drawer>;
    case "preferences":
      return <Drawer title="My Preferences" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <Select label="Theme" value={prefs.theme} onChange={(e) => setPrefs({ theme: e.target.value as typeof prefs.theme })} options={[{ value: "system", label: "Follow system" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <Row label="Colour-blind safe (adds hatch pattern to heatmaps)"><Toggle checked={prefs.colorBlindSafe} onChange={(v) => setPrefs({ colorBlindSafe: v })} label="Colour-blind safe" /></Row>
        <Select label="Preview screen state" helper="Forces every screen into this state so loading, empty and error layouts can be reviewed." value={prefs.previewState} onChange={(e) => setPrefs({ previewState: e.target.value as typeof prefs.previewState })} options={[{ value: "none", label: "None (normal)" }, { value: "loading", label: "Loading" }, { value: "empty", label: "Empty" }, { value: "error", label: "Error" }]} />
        <div><Button variant="secondary" onClick={() => { resetLayout(); onClose(); }}>Reset layout</Button><p className="ea-help">Clears saved rail, density, tab, filter, date range and panel layout choices.</p></div>
      </Drawer>;
    case "translation":
      return <Drawer title="Load Translation File" onClose={onClose} footer={<>{cancel}<Button variant="primary" disabled>Load</Button></>}>
        <label className="ea-label" htmlFor="ea-tr">Translation file (.json)</label><input id="ea-tr" type="file" accept=".json" /><p className="ea-help">UI only in this phase; the file is not read.</p></Drawer>;
    case "glossary":
      return <Drawer title="Glossary" onClose={onClose}>{GLOSSARY.map(([t, d]) => <div key={t}><b>{t}</b><div className="ea-muted">{d}</div></div>)}</Drawer>;
    case "about":
      return <Modal title="About" onClose={onClose} actions={<Button variant="primary" onClick={onClose}>Close</Button>}><p>{PRODUCT_NAME}</p><p className="ea-muted">Prototype build. All data is mock data.</p></Modal>;
    case "sign-out":
      return <Modal title={`Sign out ${USER_NAME}?`} onClose={onClose} actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={onClose}>Sign out</Button></>}><p className="ea-muted">Authentication is out of scope for this phase; this does nothing.</p></Modal>;
  }
}

export { clearPersisted };
