import type { ForensicScope } from "../../lib/forensic-scope";
import type { FileEvidence } from "../../lib/file-forensic-data";

/* Spec v0.1.2 L4 §2.2 — header zone.
 *
 * No decorative colour bar. Title hierarchy via typography. The legacy
 * orange "Data Received" header is intentionally removed (Appendix A). */

export default function FileForensicHeader({
  scope,
  rows,
  onClose,
}: {
  scope: ForensicScope;
  rows: FileEvidence[];
  onClose: () => void;
}) {
  const received = rows.filter((r) => r.status === "received").length;
  const lastCheck = rows.reduce<string | null>(
    (acc, r) => (acc === null || r.lastCheck > acc ? r.lastCheck : acc),
    null,
  );
  return (
    <header className="flex items-start gap-3 border-b border-neutral-200 bg-neutral-50/80 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          <span>Data received</span>
          <span aria-hidden className="text-neutral-300">
            ·
          </span>
          <span className="truncate text-neutral-700">
            {scope.clientName} {scope.mandateName}
          </span>
          <span aria-hidden className="text-neutral-300">
            ·
          </span>
          <span className="text-red-700">{scope.breachLabel}</span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          {rows.length} expected file{rows.length === 1 ? "" : "s"} · {received}{" "}
          received
          {lastCheck && (
            <>
              {" "}
              · last check{" "}
              <span className="font-mono tabular-nums text-neutral-700">
                {lastCheck}
              </span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close file forensic sheet"
        className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </header>
  );
}
