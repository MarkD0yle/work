import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import { button, cx, focus, radius, text } from "./tokens";

/* CommentThread — the discussion about one record, inside its side panel.
 *
 * A trade query, an exception under review, a sign-off. Reads oldest first
 * with the composer at the bottom, like a conversation; Timeline is the
 * opposite (newest first) because it is a log, not a discussion. Keep the two
 * apart: comments are what people said, Timeline is what the system did.
 *
 * ⌘/Ctrl + Enter posts. Post is disabled for blank text. A comment can be
 * resolved, which greys it but keeps it, so the thread is still the record.
 * New comments are announced to screen readers (aria-live). */

export type Comment = {
  id: string;
  author: string;
  at: string;
  body: string;
  resolved?: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CommentThread({
  comments,
  onPost,
  onResolve,
  label,
  placeholder = "Add a comment",
}: {
  comments: Comment[];
  onPost: (text: string) => void;
  /** Omit to hide the Resolve control. */
  onResolve?: (id: string) => void;
  /** Accessible name, e.g. "Comments on ORD-1042". */
  label: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const draftId = useId();
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest comment in view when one is added.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [comments.length]);
  const blank = draft.trim() === "";

  function post() {
    if (blank) return;
    onPost(draft.trim());
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      post();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <EmptyState kind="first" title="No comments yet" description="Questions and decisions about this item go here, so they stay with it." compact />
        ) : (
          <ol aria-label={label} aria-live="polite" className="flex flex-col gap-4 px-5 py-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <span aria-hidden className={cx("inline-flex h-7 w-7 shrink-0 items-center justify-center bg-neutral-200 text-[10px] font-semibold text-neutral-700", radius.pill)}>
                  {initials(c.author)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cx("text-xs font-semibold", c.resolved ? "text-neutral-600" : "text-neutral-900")}>{c.author}</span>
                    <time className={text.muted}>{c.at}</time>
                    {c.resolved && <StatusBadge tone="positive" label="Resolved" />}
                  </div>
                  <p className={cx("mt-0.5 text-xs whitespace-pre-wrap", c.resolved ? "text-neutral-600" : "text-neutral-800")}>{c.body}</p>
                  {onResolve && !c.resolved && (
                    <button type="button" onClick={() => onResolve(c.id)} className={cx(button.ghost, "mt-1 -ml-2")}>
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-5 py-3">
        <label htmlFor={draftId} className="sr-only">
          {placeholder}
        </label>
        <textarea
          id={draftId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={3}
          placeholder={placeholder}
          className={cx("w-full resize-none border border-neutral-300 bg-white px-2.5 py-1.5 text-xs placeholder:text-neutral-400", radius.control, focus)}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className={text.muted}>⌘ Enter to post</span>
          <button type="button" onClick={post} disabled={blank} className={button.primary}>
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
