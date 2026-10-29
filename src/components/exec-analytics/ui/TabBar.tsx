import { useRef, type KeyboardEvent } from "react";
import { Tip } from "./Overlay";

export type TabDef = { id: string; label: string; tip?: string };

export function TabBar({ tabs, value, onChange, label, compact }: { tabs: TabDef[]; value: string; onChange: (id: string) => void; label: string; compact?: boolean }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(tabs[n].id);
    refs.current[tabs[n].id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="ea-tabs" data-compact={compact || undefined} onKeyDown={onKey}>
      {tabs.map((t) => {
        const btn = (
          <button
            key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" className="ea-tab" aria-selected={t.id === value}
            tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}
          >{t.label}</button>
        );
        return t.tip ? <Tip key={t.id} label={t.tip}>{btn}</Tip> : btn;
      })}
    </div>
  );
}
