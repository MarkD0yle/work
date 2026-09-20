import { formatStamp, userName } from "../../lib/fundConnect/engine";
import { FIELD_BY_ID } from "../../lib/fundConnect/schema";
import type { FundRecord } from "../../lib/fundConnect/types";

/* Field-level audit trail. Spec §4.
 *
 * Every write is here: old value, new value, actor, timestamp, and whether
 * it came from the import or a keyboard. That is what turns a future
 * incident into a lookup instead of an investigation. */

const VIA_LABEL: Record<string, string> = {
  manual: "typed",
  import: "import",
  system: "workflow",
};

export default function ActivityPanel({ record }: { record: FundRecord }) {
  return (
    <div className="flex h-full min-h-0 flex-col border-l border-neutral-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-3 py-2.5">
        <span className="text-[11px] font-medium tracking-wide text-neutral-900 uppercase">
          Audit
        </span>
        <span className="text-[11px] text-neutral-400 tabular-nums">
          {record.audit.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ol className="divide-y divide-neutral-100">
          {record.audit.length === 0 && (
            <li className="px-3 py-4 text-xs text-neutral-500">
              No changes recorded on this version yet.
            </li>
          )}
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
      </div>
    </div>
  );
}
