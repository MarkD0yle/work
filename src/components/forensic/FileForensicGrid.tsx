import { useState } from "react";
import type { FileEvidence } from "../../lib/file-forensic-data";
import type { ForensicScope } from "../../lib/forensic-scope";
import FileForensicRow, {
  ALL_COLUMNS,
  CURATED_COLUMNS,
} from "./FileForensicRow";

/* Spec v0.1.2 L4 §2.3 + §3.5 — five-column default; toggle expands to 11.
 *
 * No horizontal scroll at standard widths (rule 28). The flex-1 columns
 * shrink-to-fit; if the viewport ever genuinely can't fit "Show all
 * fields" (sub-1400px), browsers will horizontal-scroll only the table
 * region, not the surrounding chrome. */

export default function FileForensicGrid({
  rows,
  scope,
  showAllFields,
}: {
  rows: FileEvidence[];
  scope: ForensicScope;
  showAllFields: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const columns = showAllFields ? ALL_COLUMNS : CURATED_COLUMNS;

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
        No file evidence for this scope.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-5 py-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        {columns.map((c) => (
          <span key={c.key} className={`${c.width} truncate`}>
            {c.label}
          </span>
        ))}
        <span aria-hidden className="ml-1 w-3 shrink-0" />
      </div>
      <ul className="flex-1 overflow-y-auto">
        {rows.map((r) => (
          <FileForensicRow
            key={r.id}
            evidence={r}
            scope={scope}
            expanded={expandedId === r.id}
            onToggleExpand={() =>
              setExpandedId((prev) => (prev === r.id ? null : r.id))
            }
            showAllFields={showAllFields}
          />
        ))}
      </ul>
    </div>
  );
}
