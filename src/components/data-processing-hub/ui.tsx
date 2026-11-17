import { StatusBadge, tokens } from "../patterns";
import { LOAD_STATUS, RECORD_STATUS, REPLAY_STEPS, isInFlight, replaySummary, type LoadStatus, type RecordStatus, type ReplayRun, type ReplayStatus } from "./model";

const { cx, text, tone } = tokens;

/* Small pieces shared by the Data Processing Hub views.
 *
 * Status is never colour alone: every status carries a glyph and its name. */

export function LoadStatusBadge({ status }: { status: LoadStatus }) {
  const s = LOAD_STATUS[status];
  return <StatusBadge tone={s.tone} label={`${s.glyph} ${status}`} />;
}

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  const s = RECORD_STATUS[status];
  return <StatusBadge tone={s.tone} label={`${s.glyph} ${status}`} />;
}

/** Glyph plus name, without the pill: for dense grid rows. */
export function RecordStatusMark({ status }: { status: RecordStatus }) {
  const s = RECORD_STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800">
      <span aria-hidden className={cx("w-3 text-center font-bold", tone[s.tone].text)}>
        {s.glyph}
      </span>
      {status}
    </span>
  );
}

/* ReplayTracker — where a replay is on its fixed path.
 *
 * Submitted → Accepted → Queued → In Progress → Completed or Failed. Done
 * steps show a tick and the time they were reached, the current step is
 * marked and named in text, and steps not reached yet stay hollow. */
export function ReplayTracker({ run }: { run: ReplayRun }) {
  const done = !isInFlight(run);
  const last: ReplayStatus = run.status === "Failed" ? "Failed" : "Completed";
  const steps: ReplayStatus[] = [...REPLAY_STEPS, last];
  const reached = new Map(run.history.map((h) => [h.status, h.at]));
  const currentIndex = steps.indexOf(run.status);

  return (
    <div>
      <ol aria-label={`Progress of replay ${run.id}`} className="grid grid-cols-5">
        {steps.map((step, i) => {
          const at = reached.get(step);
          const isCurrent = i === currentIndex;
          const isReached = at !== undefined;
          const failed = step === "Failed" && isReached;
          const stepTone = failed ? "negative" : isReached && (!isCurrent || done) ? "positive" : isCurrent ? "info" : "neutral";
          const glyph = failed ? "✕" : isReached && (!isCurrent || done) ? "✓" : isCurrent ? "●" : "";
          const state = failed ? "failed" : isReached && (!isCurrent || done) ? "done" : isCurrent ? "in progress" : "not started";
          return (
            <li key={step} aria-current={isCurrent && !done ? "step" : undefined} className="relative flex flex-col items-center px-1 text-center">
              {i > 0 && <span aria-hidden className={cx("absolute top-2.5 right-1/2 h-px w-full", isReached ? "bg-neutral-900" : "bg-neutral-200")} />}
              <span
                aria-hidden
                className={cx(
                  "relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold",
                  isReached ? tone[stepTone].soft : "border-neutral-300 bg-white text-neutral-400",
                  isCurrent && !done && "animate-pulse",
                )}
              >
                {glyph}
              </span>
              <span className={cx("mt-1 text-[11px]", isCurrent ? "font-semibold text-neutral-900" : isReached ? "text-neutral-700" : "text-neutral-400")}>{step}</span>
              <span className="sr-only">, {state}</span>
              <span className="text-[10px] text-neutral-500 tabular-nums">{at ?? " "}</span>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className={cx("mt-2", text.muted)}>
        <span className="font-mono text-neutral-700">{run.id}</span> · {replaySummary(run)}
      </p>
    </div>
  );
}
