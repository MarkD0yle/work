import { useState } from "react";
import { formatStamp, userName } from "../../lib/fundConnect2/engine";
import type { FundRecord2, RecordComment } from "../../lib/fundConnect2/types";

/* Record-level comment thread — the reject-with-comments conversation.
 *
 * Rejections and approvals are entries in the same thread as plain notes,
 * grouped by review cycle, so the whole back-and-forth reads top to bottom
 * like the conversation it is. Every entry carries who and when. */

const KIND_PILL: Record<RecordComment["kind"], { label: string; cls: string }> = {
  reject: { label: "Rejected", cls: "border-amber-400 bg-amber-50 text-amber-900" },
  approve: { label: "Approved", cls: "border-neutral-900 bg-neutral-900 text-white" },
  note: { label: "Comment", cls: "border-neutral-200 bg-white text-neutral-500" },
};

export default function CommentThread({
  record,
  canComment,
  onComment,
}: {
  record: FundRecord2;
  canComment: boolean;
  onComment: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const byCycle = new Map<number, RecordComment[]>();
  for (const c of record.comments) {
    byCycle.set(c.cycle, [...(byCycle.get(c.cycle) ?? []), c]);
  }
  const cycles = [...byCycle.keys()].sort((a, b) => a - b);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {record.comments.length === 0 && (
          <p className="px-3 py-4 text-xs text-neutral-500">
            No comments yet. A rejection always arrives here with its reason.
          </p>
        )}
        {cycles.map((cycle) => (
          <div key={cycle}>
            <p className="sticky top-0 border-b border-neutral-100 bg-neutral-50 px-3 py-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              Review cycle {cycle}
            </p>
            <ol className="divide-y divide-neutral-100">
              {byCycle.get(cycle)!.map((c) => {
                const pill = KIND_PILL[c.kind];
                return (
                  <li key={c.id} className="px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-neutral-800">{userName(c.by)}</span>
                      <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                        {formatStamp(c.at)}
                      </span>
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-1.5 py-[1px] text-[9px] font-medium tracking-wide uppercase ${pill.cls}`}
                    >
                      {pill.label}
                    </span>
                    <p className="mt-1 text-[11px] leading-snug text-neutral-600">{c.text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      {canComment && (
        <div className="shrink-0 border-t border-neutral-200 p-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Add a comment — the other side of the review is notified."
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
          />
          <button
            type="button"
            disabled={draft.trim() === ""}
            onClick={() => {
              onComment(draft.trim());
              setDraft("");
            }}
            className="mt-1.5 rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:bg-neutral-300"
          >
            Comment
          </button>
        </div>
      )}
    </div>
  );
}
