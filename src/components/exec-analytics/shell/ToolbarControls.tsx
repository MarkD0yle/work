/* eslint-disable react-hooks/refs -- usePopover returns a state-backed ref handle; the lint rule cannot tell it is safe to read in render */
import { Download, Filter as FilterIcon, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Menu, usePopover } from "../ui";
import { formatDate, formatTime } from "../lib/format";

export function FilterButton({ count = 0, onClick, expanded }: { count?: number; onClick: () => void; expanded?: boolean }) {
  return (
    <Button variant="secondary" size="compact" icon={<FilterIcon size={16} strokeWidth={1.5} />} onClick={onClick} aria-expanded={expanded}>
      Filters{count > 0 && <span className="ea-badge" data-tone="info" aria-label={`${count} active`}>{count}</span>}
    </Button>
  );
}

/** One export menu. Handlers are stubs (UI only this phase). */
export function ExportMenu({ formats = ["PDF", "Excel", "CSV"], onExport }: { formats?: string[]; onExport?: (f: string) => void }) {
  const p = usePopover();
  const [note, setNote] = useState("");
  return (
    <>
      <Button ref={p.triggerRef} variant="secondary" size="compact" icon={<Download size={16} strokeWidth={1.5} />} aria-haspopup="menu" aria-expanded={p.open} onClick={p.toggle}>Export</Button>
      <Menu open={p.open} onClose={p.close} anchor={p.triggerRef}
        items={formats.map((f) => ({ id: f, label: f, onSelect: () => { setNote(`${f} export requested`); onExport?.(f); } }))} />
      <span className="ea-sr" role="status" aria-live="polite">{note}</span>
    </>
  );
}

export function RefreshButton({ loadedAt, refreshing, onRefresh }: { loadedAt: Date; refreshing?: boolean; onRefresh: () => void }) {
  return (
    <IconButton label="Refresh" tip={`Last loaded ${formatDate(loadedAt)} ${formatTime(loadedAt)}`} onClick={onRefresh} disabled={refreshing}>
      <RefreshCw size={20} strokeWidth={1.5} className={refreshing ? "ea-spin" : undefined} />
    </IconButton>
  );
}

export function LastLoaded({ at }: { at: Date }) {
  return <span className="ea-caption">Last loaded {formatDate(at)} {formatTime(at)}</span>;
}
