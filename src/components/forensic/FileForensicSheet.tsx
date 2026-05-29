import { useCallback, useEffect, useRef } from "react";
import type { UseFileForensicResult } from "../../hooks/useFileForensic";
import { useForensicHeight } from "../../hooks/useForensicHeight";
import FileForensicHeader from "./FileForensicHeader";
import FileForensicGrid from "./FileForensicGrid";
import ForensicFooter from "./ForensicFooter";

/* Spec v0.1.2 L4 §1-§3 — bottom-sheet shell.
 *
 * Hard rules satisfied here:
 *   25. Bottom sheet only — never modal/side/full-page.
 *   27. Click-outside (overview area) closes; L3 panel click does not
 *       (the L3 panel sits inside an aside that calls stopPropagation on
 *       this sheet's backdrop click — see ops-overview.tsx).
 *   31. Reads quieter than the L3 panel — neutral surfaces only.
 */

export default function FileForensicSheet({ forensic }: { forensic: UseFileForensicResult }) {
  const { pct, setPct, minPct, maxPct } = useForensicHeight();
  const dragStateRef = useRef<{ startY: number; startPct: number } | null>(null);

  const onClose = forensic.close;

  // Spec §3.2 — Esc closes (collapses expanded row first is handled in
  // the row component; the sheet only sees the unhandled key).
  useEffect(() => {
    if (!forensic.scope) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forensic.scope, onClose]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStateRef.current = { startY: e.clientY, startPct: pct };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pct],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return;
      const vh = window.innerHeight;
      const dy = e.clientY - dragStateRef.current.startY;
      // Drag UP grows the sheet (negative dy → larger pct).
      const deltaPct = (-dy / vh) * 100;
      setPct(dragStateRef.current.startPct + deltaPct);
    },
    [setPct],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStateRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [],
  );

  if (!forensic.scope) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="File forensic sheet"
      className="pointer-events-none fixed inset-0 z-40"
    >
      {/* Backdrop dim — click-through to overview clicks is handled by
          the parent (ops-overview.tsx wraps the overview content in an
          on-click that calls forensic.close()). Backdrop itself is just
          a visual dim. */}
      <div className="pointer-events-none absolute inset-0 bg-neutral-900/40" />
      <aside
        style={{ height: `${pct}vh`, minHeight: 480, maxHeight: 900 }}
        className="pointer-events-auto absolute right-0 bottom-0 left-0 flex animate-[forensic-slide-up_240ms_ease-out] flex-col overflow-hidden rounded-t-lg border-t border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — spec §2.2, resizable §3.3 */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize sheet"
          aria-valuemin={minPct}
          aria-valuemax={maxPct}
          aria-valuenow={pct}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex h-2.5 shrink-0 cursor-row-resize items-center justify-center bg-neutral-100 hover:bg-neutral-200"
        >
          <span aria-hidden className="h-0.5 w-10 rounded-full bg-neutral-400" />
        </div>

        <FileForensicHeader
          scope={forensic.scope}
          rows={forensic.rows}
          onClose={forensic.close}
        />

        <FileForensicGrid
          rows={forensic.rows}
          scope={forensic.scope}
          showAllFields={forensic.showAllFields}
        />

        <ForensicFooter
          rows={forensic.rows}
          showAllFields={forensic.showAllFields}
          onToggleShowAll={forensic.toggleShowAllFields}
          onRefresh={forensic.refresh}
          loading={forensic.loading}
          lastPolledAt={forensic.lastPolledAt}
        />
      </aside>
    </div>
  );
}
