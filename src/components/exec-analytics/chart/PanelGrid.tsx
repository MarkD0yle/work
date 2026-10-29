/* eslint-disable react-refresh/only-export-components -- hooks/contexts live beside their components; HMR granularity is not a concern here */
import { createContext, useContext, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { usePersisted } from "../lib/persist";

export type PanelSize = "S" | "M" | "L" | "XL";
export const SIZE_COLS: Record<PanelSize, string> = { S: "ea-col-4", M: "ea-col-6", L: "ea-col-8", XL: "ea-col-12" };
const SIZES: PanelSize[] = ["S", "M", "L", "XL"];

export type PanelCtx = {
  size: PanelSize; setSize: (s: PanelSize) => void;
  handle: { draggable: true; onDragStart: (e: DragEvent) => void; onDragEnd: () => void; onKeyDown: (e: KeyboardEvent) => void };
};
const Ctx = createContext<PanelCtx | null>(null);
export const usePanelCtx = () => useContext(Ctx);
export { SIZES };

export type PanelDef = { id: string; size: PanelSize; render: () => ReactNode };

/** 12-col grid whose panels reorder by drag (or Alt+Arrow on the handle) and resize by preset only. Persisted. */
export function PanelGrid({ id, panels }: { id: string; panels: PanelDef[] }) {
  const [order, setOrder] = usePersisted<string[]>(`layout.${id}.order`, panels.map((p) => p.id));
  const [sizes, setSizes] = usePersisted<Record<string, PanelSize>>(`layout.${id}.sizes`, {});
  const [dragId, setDragId] = useState<string | null>(null);
  const ids = panels.map((p) => p.id);
  const ordered = [...order.filter((i) => ids.includes(i)), ...ids.filter((i) => !order.includes(i))];
  const move = (from: string, to: string) => {
    if (from === to) return;
    const n = ordered.filter((i) => i !== from);
    n.splice(n.indexOf(to) + (ordered.indexOf(from) < ordered.indexOf(to) ? 1 : 0), 0, from);
    setOrder(n);
  };
  return (
    <div className="ea-grid">
      {ordered.map((pid) => {
        const p = panels.find((x) => x.id === pid)!;
        const size = sizes[pid] ?? p.size;
        const ctx: PanelCtx = {
          size, setSize: (s) => setSizes((c) => ({ ...c, [pid]: s })),
          handle: {
            draggable: true,
            onDragStart: (e) => { setDragId(pid); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", pid); },
            onDragEnd: () => setDragId(null),
            onKeyDown: (e) => {
              if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
              e.preventDefault();
              const i = ordered.indexOf(pid); const j = e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : i + 1;
              if (j >= 0 && j < ordered.length) move(pid, ordered[j]);
            },
          },
        };
        return (
          <div key={pid} className={SIZE_COLS[size]} style={{ opacity: dragId === pid ? 0.5 : 1, minWidth: 0 }}
            onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, pid); setDragId(null); }}>
            <Ctx.Provider value={ctx}>{p.render()}</Ctx.Provider>
          </div>
        );
      })}
    </div>
  );
}
