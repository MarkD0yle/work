import { useState } from "react";
import { formatStamp, userName } from "../../lib/fundConnect2/engine";
import { FIELD_BY_ID } from "../../lib/fundConnect2/schema";
import type { FundRecord2, RecordComment } from "../../lib/fundConnect2/types";

/* The record's conversation, as one timeline.
 *
 * Record-level comments, field-level rejections and submission markers are
 * merged chronologically, so the thread reads like what actually happened:
 * submitted → this field rejected (with the note, on the field it names) →
 * resubmitted → approved. Every entry carries who and when; entries about a
 * specific field link straight to it. */

const KIND_PILL: Record<RecordComment["kind"], { label: string; cls: string }> = {
  reject: { label: "Rejected", cls: "border-amber-400 bg-amber-50 text-amber-900" },
  approve: { label: "Approved", cls: "border-neutral-900 bg-neutral-900 text-white" },
  note: { label: "Comment", cls: "border-neutral-200 bg-white text-neutral-500" },
};

type Item =
  | { at: string; kind: "comment"; comment: RecordComment }
  | { at: string; kind: "flag"; flag: FundRecord2["flags"][number] }
  | { at: string; kind: "submit"; cycle: number; by: string };

export default function CommentThread({
  record,
  canComment,
  onComment,
  onJumpField,
}: {
  record: FundRecord2;
  canComment: boolean;
  onComment: (text: string) => void;
  /** Open the form on the exact field an entry is about. */
  onJumpField: (fieldId: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const items: Item[] = [
    ...record.comments.map((comment): Item => ({ at: comment.at, kind: "comment", comment })),
    ...record.flags.map((flag): Item => ({ at: flag.at, kind: "flag", flag })),
    ...record.submissions.map(
      (s): Item => ({ at: s.at, kind: "submit", cycle: s.cycle, by: s.by }),
    ),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && (
          <p className="px-3 py-4 text-xs text-neutral-500">
            No activity yet. A rejection always arrives here with its reason and
            the field it is about.
          </p>
        )}
        <ol>
          {items.map((item, i) => {
            if (item.kind === "submit") {
              return (
                <li
                  key={`s-${i}`}
                  className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
                  <span className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                    Cycle {item.cycle} submitted
                  </span>
                  <span className="ml-auto text-[10px] text-neutral-400">
                    {userName(item.by)} · {formatStamp(item.at)}
                  </span>
                </li>
              );
            }

            if (item.kind === "flag") {
              const f = item.flag;
              const field = FIELD_BY_ID[f.fieldId];
              return (
                <li key={`f-${i}`} className="border-b border-neutral-100 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-neutral-800">{userName(f.by)}</span>
                    <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                      {formatStamp(f.at)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded-full border border-amber-400 bg-amber-50 px-1.5 py-[1px] text-[9px] font-medium tracking-wide text-amber-900 uppercase">
                      Rejected field
                    </span>
                    <button
                      type="button"
                      onClick={() => onJumpField(f.fieldId)}
                      title={`Open ${field?.label ?? f.fieldId} in the form`}
                      className="rounded-full border border-neutral-300 bg-white px-2 py-[1px] text-[10px] font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                    >
                      {field?.label ?? f.fieldId} →
                    </button>
                    {f.resolved && (
                      <span className="rounded-full bg-neutral-100 px-1.5 text-[9px] font-medium tracking-wide text-neutral-500 uppercase">
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-neutral-600">{f.note}</p>
                </li>
              );
            }

            const c = item.comment;
            const pill = KIND_PILL[c.kind];
            return (
              <li key={c.id} className="border-b border-neutral-100 px-3 py-2.5">
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
                  {c.kind !== "note" && ` · cycle ${c.cycle}`}
                </span>
                <p className="mt-1 text-[11px] leading-snug text-neutral-600">{c.text}</p>
              </li>
            );
          })}
        </ol>
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
