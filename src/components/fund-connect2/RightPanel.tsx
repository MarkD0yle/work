import { useState } from "react";
import CommentThread from "./CommentThread";
import { formatStamp, userName } from "../../lib/fundConnect2/engine";
import { FIELD_BY_ID } from "../../lib/fundConnect2/schema";
import type { FundRecord2, User } from "../../lib/fundConnect2/types";

/* Comments + audit, side by side as tabs.
 *
 * The audit tab has a cycle filter: "This cycle" cuts the trail to what has
 * happened since the current submission, which is the 4-eyes question — what
 * am I signing off that I have not already seen? */

const VIA_LABEL: Record<string, string> = {
  manual: "typed",
  import: "upload",
  system: "workflow",
};

export default function RightPanel({
  record,
  user,
  canComment,
  onComment,
  onEditComment,
  onDeleteComment,
  onJumpField,
}: {
  record: FundRecord2;
  user: User;
  canComment: boolean;
  onComment: (text: string, fieldId?: string) => void;
  onEditComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  /** Open the form on the exact field an entry is about. */
  onJumpField: (fieldId: string) => void;
}) {
  const [tab, setTab] = useState<"comments" | "audit">("comments");
  const [cycleOnly, setCycleOnly] = useState(false);

  const lastSubmission = record.submissions[record.submissions.length - 1] ?? null;
  const audit =
    cycleOnly && lastSubmission
      ? record.audit.filter((e) => Date.parse(e.at) >= Date.parse(lastSubmission.at))
      : record.audit;

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-neutral-200 bg-white">
      <div className="flex shrink-0 border-b border-neutral-200">
        {(
          [
            ["comments", `Comments (${record.comments.length})`],
            ["audit", `Audit (${record.audit.length})`],
          ] as const
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

      {tab === "comments" && (
        <CommentThread
          record={record}
          user={user}
          canComment={canComment}
          onComment={onComment}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          onJumpField={onJumpField}
        />
      )}

      {tab === "audit" && (
        <>
          {record.submissions.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 border-b border-neutral-100 px-2 py-1.5">
              {(
                [
                  [false, "All history"],
                  [true, "This cycle only"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCycleOnly(value)}
                  aria-pressed={cycleOnly === value}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    cycleOnly === value
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <ol className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
            {audit.length === 0 && (
              <li className="px-3 py-4 text-xs text-neutral-500">
                Nothing in this window.
              </li>
            )}
            {audit.map((entry) => {
              const body = (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    {entry.fieldId ? (
                      <span className="text-xs font-medium text-blue-800">
                        {FIELD_BY_ID[entry.fieldId]?.label ?? entry.fieldId}{" "}
                        <span className="text-blue-300" aria-hidden>→</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-neutral-800">Workflow</span>
                    )}
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
                  {entry.note && <p className="mt-0.5 text-[11px] text-neutral-600">{entry.note}</p>}
                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    {userName(entry.actor)} · {VIA_LABEL[entry.via] ?? entry.via}
                  </p>
                </>
              );
              // A field write is a place in the form — the whole entry is
              // the link there, not just the field name.
              return (
                <li key={entry.id}>
                  {entry.fieldId ? (
                    <button
                      type="button"
                      onClick={() => onJumpField(entry.fieldId!)}
                      title={`Show this change on ${FIELD_BY_ID[entry.fieldId]?.label ?? entry.fieldId} in the form`}
                      className="w-full px-3 py-2.5 text-left hover:bg-neutral-50"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="px-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
