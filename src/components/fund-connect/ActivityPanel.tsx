import { useState } from "react";
import { formatStamp, userName } from "../../lib/fundConnect/engine";
import { FIELD_BY_ID } from "../../lib/fundConnect/schema";
import type { FundRecord } from "../../lib/fundConnect/types";

/* Field-level audit trail, review notes and version chain. Spec §4 and §6.
 *
 * Every write is here: old value, new value, actor, timestamp, and whether
 * it came from the import or a keyboard. That is what turns a future
 * incident into a lookup instead of an investigation. */

type Tab = "activity" | "flags" | "versions";

const VIA_LABEL: Record<string, string> = {
  manual: "typed",
  import: "import",
  system: "workflow",
};

export default function ActivityPanel({
  record,
  versions,
  onOpenVersion,
}: {
  record: FundRecord;
  versions: FundRecord[];
  onOpenVersion: (versionId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("activity");
  const flags = record.flags;

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-neutral-200 bg-white">
      <div className="flex shrink-0 border-b border-neutral-200">
        {(
          [
            ["activity", `Audit (${record.audit.length})`],
            ["flags", `Flags (${flags.filter((f) => !f.resolved).length})`],
            ["versions", `Versions (${versions.length})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 border-b-2 px-2 py-2.5 text-[11px] font-medium tracking-wide uppercase ${
              tab === id
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "activity" && (
          <ol className="divide-y divide-neutral-100">
            {record.audit.map((entry) => (
              <li key={entry.id} className="px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-800">
                    {entry.fieldId
                      ? (FIELD_BY_ID[entry.fieldId]?.label ?? entry.fieldId)
                      : "Workflow"}
                  </span>
                  <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                    {formatStamp(entry.at)}
                  </span>
                </div>
                {(entry.from || entry.to) && (
                  <p className="mt-0.5 font-mono text-[11px] break-words text-neutral-600">
                    <span className="text-neutral-400 line-through">{entry.from || "empty"}</span>
                    <span className="mx-1 text-neutral-400">→</span>
                    <span className="text-neutral-900">{entry.to || "empty"}</span>
                  </p>
                )}
                {entry.note && (
                  <p className="mt-0.5 text-[11px] text-neutral-600">{entry.note}</p>
                )}
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  {userName(entry.actor)} · {VIA_LABEL[entry.via] ?? entry.via}
                </p>
              </li>
            ))}
          </ol>
        )}

        {tab === "flags" && (
          <ol className="divide-y divide-neutral-100">
            {flags.length === 0 && (
              <li className="px-3 py-4 text-xs text-neutral-500">
                No fields have been rejected on this version.
              </li>
            )}
            {flags.map((flag, i) => (
              <li key={`${flag.fieldId}-${i}`} className="px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-800">
                    {FIELD_BY_ID[flag.fieldId]?.label ?? flag.fieldId}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 text-[10px] font-medium ${
                      flag.resolved
                        ? "bg-neutral-100 text-neutral-500"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {flag.resolved ? "Resolved" : "Open"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{flag.note}</p>
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  {userName(flag.by)} · {formatStamp(flag.at)}
                </p>
              </li>
            ))}
          </ol>
        )}

        {tab === "versions" && (
          <ol className="divide-y divide-neutral-100">
            {versions.map((v) => (
              <li key={v.versionId}>
                <button
                  type="button"
                  onClick={() => onOpenVersion(v.versionId)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-neutral-50 ${
                    v.versionId === record.versionId ? "bg-neutral-50" : ""
                  }`}
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-mono text-xs text-neutral-900">v{v.version}</span>
                    <span className="text-[10px] text-neutral-400 tabular-nums">
                      {formatStamp(v.updatedAt)}
                    </span>
                  </span>
                  <span className="text-[11px] text-neutral-600">
                    {v.state === "approved"
                      ? `Approved by ${userName(v.approvedBy)}`
                      : v.supersedes
                        ? `Amendment of ${v.supersedes}`
                        : "Original"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
