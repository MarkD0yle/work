import { useState } from "react";
import { StatusBadge, tokens } from "../patterns";
import { RunDatePicker } from "./RunDatePicker";
import { KIND_LABEL, longWhen, outcome, type Run, type Thread } from "./model";

const { button, cx, text } = tokens;

/* ActionBar — every action for the selected report, in one place.
 *
 * Sits above the inbox and sticks there while the list scrolls, like a
 * mail client's toolbar. Empty until a report is picked; then it names the
 * report and the run you're on, and offers what you can do to it:
 *   - the kind's main action (Review exceptions, Distribute, Open results)
 *   - Run now, or Run for… a date or range
 *   - download, log, edit, pause
 * Pick an older run in the history and the run-level actions follow it.
 *
 * On a phone it becomes a toolbar pinned to the bottom of the screen
 * (where thumbs reach, as on iOS), with the less-used actions behind
 * More so it stays two rows tall. */

export type RunRequest = { start: string; end: string } | null;

export function ActionBar({
  thread,
  run,
  onRun,
  onTogglePause,
  onClear,
  onBackToLatest,
  onUploadAgain,
}: {
  thread: Thread | null;
  run: Run | null;
  /** null = run now for the default period. */
  onRun: (thread: Thread, req: RunRequest) => void;
  onTogglePause: (thread: Thread) => void;
  onClear: () => void;
  onBackToLatest: () => void;
  onUploadAgain: () => void;
}) {
  if (!thread || !run) {
    return (
      <div className={cx("flex min-h-14 items-center bg-white px-6 py-3 max-sm:hidden", text.muted)}>
        Select a report to run it, download it or see its run history.
      </div>
    );
  }

  return <Bar key={thread.id} thread={thread} run={run} onRun={onRun} onTogglePause={onTogglePause} onClear={onClear} onBackToLatest={onBackToLatest} onUploadAgain={onUploadAgain} />;
}

function Bar({
  thread,
  run,
  onRun,
  onTogglePause,
  onClear,
  onBackToLatest,
  onUploadAgain,
}: {
  thread: Thread;
  run: Run;
  onRun: (thread: Thread, req: RunRequest) => void;
  onTogglePause: (thread: Thread) => void;
  onClear: () => void;
  onBackToLatest: () => void;
  onUploadAgain: () => void;
}) {
  const [more, setMore] = useState(false);
  const latest = thread.runs[0];
  const isLatest = run.id === latest.id;
  const busy = latest.status === "running" || latest.status === "queued";
  const ok = run.status === "succeeded";
  const o = outcome(thread, run);
  const editLabel = thread.kind === "exception" ? "Edit conditions" : thread.kind === "regulatory" ? "Edit distribution" : "Edit";

  return (
    <div
      role="toolbar"
      aria-label={`Actions for ${thread.name}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white px-6 py-3 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-neutral-200 max-sm:px-4 max-sm:shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
    >
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
        <div className={cx("max-sm:hidden", text.eyebrow)}>{KIND_LABEL[thread.kind]}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-neutral-900">{thread.name}</h2>
          <StatusBadge tone={o.tone} label={o.label} />
          <span className={cx("text-xs text-neutral-600", text.numeric)}>
            {isLatest ? "Latest run" : "Run"} · {longWhen(run.at)}
            {run.period && ` · for ${run.period}`}
          </span>
          {!isLatest && (
            <button type="button" className={button.ghost} onClick={onBackToLatest}>
              Back to latest
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Primary thread={thread} run={run} busy={busy} onRun={() => onRun(thread, null)} onUploadAgain={onUploadAgain} />
        {!(thread.kind === "processing" && latest.status === "failed") && (
          <button type="button" className={button.secondary} disabled={busy} onClick={() => onRun(thread, null)}>
            {busy ? "Running…" : "Run now"}
          </button>
        )}
        {thread.kind !== "posttrade" && <RunDatePicker disabled={busy} onRun={(start, end) => onRun(thread, { start, end })} />}
        <button type="button" className={cx(button.ghost, "sm:hidden")} aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Less" : "More"}
        </button>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-neutral-200 sm:block" />
        <span className={cx("flex flex-wrap items-center gap-2", !more && "max-sm:hidden")}>
        {thread.kind !== "processing" && (
          <button type="button" className={button.secondary} disabled={!ok}>
            Download {thread.kind === "regulatory" ? "PDF" : "CSV"}
          </button>
        )}
        <button type="button" className={button.secondary}>
          View log
        </button>
        {thread.kind !== "processing" && thread.kind !== "posttrade" && (
          <>
            <button type="button" className={button.secondary}>
              {editLabel}
            </button>
            <button type="button" className={button.ghost} aria-pressed={!!thread.paused} onClick={() => onTogglePause(thread)}>
              {thread.paused ? "Resume schedule" : "Pause schedule"}
            </button>
          </>
        )}
        </span>
        <button type="button" className={cx(button.ghost, "px-1.5")} aria-label="Clear selection" onClick={onClear}>
          ✕
        </button>
      </div>
    </div>
  );
}

/** The one action that finishes the job for this kind of report. */
function Primary({
  thread,
  run,
  busy,
  onRun,
  onUploadAgain,
}: {
  thread: Thread;
  run: Run;
  busy: boolean;
  onRun: () => void;
  onUploadAgain: () => void;
}) {
  const ok = run.status === "succeeded";
  switch (thread.kind) {
    case "exception": {
      const n = run.unreviewed ?? 0;
      return (
        <button type="button" className={button.primary} disabled={!ok || (run.exceptions ?? 0) === 0}>
          {n > 0 ? `Review ${n} exception${n === 1 ? "" : "s"}` : "View exceptions"}
        </button>
      );
    }
    case "regulatory":
      return (
        <button type="button" className={button.primary} disabled={!ok}>
          {ok && !run.distributed ? "Review and distribute" : "View pack"}
        </button>
      );
    case "posttrade":
      return run.status === "failed" ? (
        <button type="button" className={button.primary} onClick={onUploadAgain}>
          Upload corrected file
        </button>
      ) : (
        <button type="button" className={button.primary} disabled={!ok}>
          Open TCA results
        </button>
      );
    case "processing":
      return thread.runs[0].status === "failed" ? (
        <button type="button" className={button.primary} disabled={busy} onClick={onRun}>
          Retry now
        </button>
      ) : null;
    default:
      return (
        <button type="button" className={button.primary} disabled={!ok}>
          Open in BestX
        </button>
      );
  }
}

