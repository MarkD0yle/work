import { EmptyState, KeyValueGrid, Sparkline, StatusBadge, tokens, type KeyValue } from "../patterns";
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, longWhen, outcome, shortWhen, type Output, type Run, type Thread } from "./model";

const { button, cx, text, border } = tokens;

/* ReadingPane — one run of one report, like an opened email.
 *
 * Top to bottom, in the order people ask the questions:
 *   1. What is this and what can I do?  Title + the kind's main action.
 *   2. What happened on this run?       Outcome, summary, run facts.
 *   3. How is it set up?                Frequency, recipients, conditions.
 *   4. Where does it go / come from?    BestX outputs it feeds, and the
 *                                       processing jobs it is built on.
 *
 * The main action changes with the kind, because "done" means something
 * different for each: an exception run is done when it is reviewed, a
 * regulatory pack when it is distributed, a post-trade upload when its
 * TCA results are opened. */

export function ReadingPane({
  thread,
  run,
  jobs,
  dependents,
  onRerun,
  onTogglePause,
  onOpenThread,
  onUploadAgain,
}: {
  thread: Thread | null;
  run: Run | null;
  /** Processing jobs by id, to show what a report is built on. */
  jobs: Record<string, Thread>;
  /** For a processing job: the reports built on it. */
  dependents: Thread[];
  onRerun: (thread: Thread, of?: Run) => void;
  onTogglePause: (thread: Thread) => void;
  onOpenThread: (threadId: string) => void;
  onUploadAgain: () => void;
}) {
  if (!thread || !run) {
    return <EmptyState kind="first" title="Select a report" description="Pick a report on the left to see its latest run." />;
  }

  const latest = thread.runs[0];
  const isLatest = run.id === latest.id;
  const busy = latest.status === "running" || latest.status === "queued";
  const o = outcome(thread, run);

  return (
    <article aria-label={thread.name} className="flex flex-col gap-5 p-6">
      {/* 1 · Header + actions */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={text.eyebrow}>{KIND_LABEL[thread.kind]}</div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">{thread.name}</h2>
          <p className={cx("mt-0.5", text.muted)}>{thread.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryAction thread={thread} run={run} onUploadAgain={onUploadAgain} onRerun={() => onRerun(thread)} busy={busy} />
          {!(thread.kind === "processing" && latest.status === "failed") && (
            <button type="button" className={button.secondary} disabled={busy} onClick={() => onRerun(thread)}>
              {busy ? "Running…" : thread.kind === "posttrade" ? "Re-run" : "Run now"}
            </button>
          )}
          {thread.kind !== "processing" && thread.kind !== "posttrade" && (
            <>
              <button type="button" className={button.secondary}>
                {thread.kind === "exception" ? "Edit conditions" : thread.kind === "regulatory" ? "Edit distribution" : "Edit"}
              </button>
              <button type="button" className={button.ghost} aria-pressed={!!thread.paused} onClick={() => onTogglePause(thread)}>
                {thread.paused ? "Resume" : "Pause"}
              </button>
            </>
          )}
        </div>
      </header>

      {/* 2 · This run */}
      <section aria-label="Run" className={cx(border.default, "bg-white p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={o.tone} label={o.label} />
          <h3 className={text.title}>Run · {longWhen(run.at)}</h3>
          {isLatest ? (
            <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">Latest</span>
          ) : (
            <button type="button" className={cx(button.ghost, "ml-auto")} onClick={() => onOpenThread(thread.id)}>
              Back to latest run
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-800">{run.summary}</p>
        <div className="mt-4">
          <KeyValueGrid columns={4} items={runFacts(thread, run)} />
        </div>
        <Trend thread={thread} />
        <div className={cx("mt-4 flex flex-wrap gap-2 border-t pt-3", border.subtle)}>
          <button type="button" className={button.secondary} disabled={run.status !== "succeeded"}>
            {thread.kind === "processing" ? "View loaded trades" : "View output"}
          </button>
          {thread.kind !== "processing" && (
            <button type="button" className={button.secondary} disabled={run.status !== "succeeded"}>
              Download {thread.kind === "regulatory" ? "PDF" : "CSV"}
            </button>
          )}
          <button type="button" className={button.secondary}>View log</button>
          {!isLatest && (
            <button type="button" className={button.secondary} disabled={busy} onClick={() => onRerun(thread, run)}>
              Re-run for {shortWhen(run.at)}
            </button>
          )}
        </div>
      </section>

      {/* 3 · Set-up */}
      <section aria-label={thread.kind === "processing" ? "Job" : "Report definition"}>
        <h3 className={cx("mb-2", text.title)}>{thread.kind === "processing" ? "Job" : thread.kind === "posttrade" ? "Upload" : "Definition"}</h3>
        <KeyValueGrid columns={3} items={definitionFacts(thread)} />
        {thread.conditions && thread.conditions.length > 0 && (
          <div className="mt-3">
            <div className={text.label}>Conditions</div>
            <ul aria-label="Conditions" className="mt-1 flex flex-wrap gap-1.5">
              {thread.conditions.map((c) => (
                <li key={c.field} className="border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-800">
                  {c.field} <span className="font-semibold">{c.op}</span> {c.value}
                </li>
              ))}
            </ul>
          </div>
        )}
        {thread.recipients.length > 0 && (
          <div className="mt-3">
            <div className={text.label}>Recipients</div>
            <p className="mt-0.5 text-xs text-neutral-800">{thread.recipients.join(", ")}</p>
          </div>
        )}
      </section>

      {/* 4 · Outputs and inputs */}
      {thread.outputs && thread.outputs.length > 0 && (
        <section aria-label="BestX outputs">
          <h3 className={cx("mb-1", text.title)}>Feeds BestX analytics</h3>
          <p className={cx("mb-2", text.muted)}>Open this run&apos;s results in the analytics views.</p>
          <div className="flex flex-wrap gap-2">
            {thread.outputs.map((out) => (
              <button key={out} type="button" className={button.secondary} disabled={run.status !== "succeeded"}>
                {OUTPUT_LABEL[out]}
              </button>
            ))}
          </div>
        </section>
      )}

      {thread.inputs && thread.inputs.length > 0 && (
        <section aria-label="Built on">
          <h3 className={cx("mb-2", text.title)}>Built on</h3>
          <ul className={cx("divide-y", border.default, border.divide)}>
            {thread.inputs.map((id) => {
              const job = jobs[id];
              if (!job) return null;
              const jr = job.runs[0];
              return (
                <li key={id}>
                  <button type="button" onClick={() => onOpenThread(id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50">
                    <StatusBadge dot tone={STATUS_TONE[jr.status]} label={STATUS_LABEL[jr.status]} />
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-800">{job.name}</span>
                    <span className={cx("text-[11px] text-neutral-500", text.numeric)}>{shortWhen(jr.at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {thread.kind === "processing" && dependents.length > 0 && (
        <section aria-label="Used by">
          <h3 className={cx("mb-2", text.title)}>Reports built on this job</h3>
          <ul className={cx("divide-y", border.default, border.divide)}>
            {dependents.map((d) => {
              const dO = outcome(d, d.runs[0]);
              return (
                <li key={d.id}>
                  <button type="button" onClick={() => onOpenThread(d.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50">
                    <StatusBadge dot tone={dO.tone} label={dO.label} />
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-800">{d.name}</span>
                    <span className="text-[11px] text-neutral-500">{KIND_LABEL[d.kind]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}

const OUTPUT_LABEL: Record<Output, string> = {
  Trend: "Open trend",
  Cost: "Open cost",
  Benchmark: "Open benchmarks",
  RFQ: "Open RFQ analysis",
};

/** The one action that finishes the job for this kind of report. */
function PrimaryAction({
  thread,
  run,
  busy,
  onRerun,
  onUploadAgain,
}: {
  thread: Thread;
  run: Run;
  busy: boolean;
  onRerun: () => void;
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
        <button type="button" className={button.primary} disabled={busy} onClick={onRerun}>
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

function runFacts(t: Thread, r: Run): KeyValue[] {
  const facts: KeyValue[] = [
    { label: "Started", value: longWhen(r.at) },
    { label: "Duration", value: r.duration ?? (r.status === "running" ? "In progress" : undefined), mono: true },
    { label: "Triggered by", value: r.trigger === "Schedule" ? "Schedule" : `${r.trigger} · ${r.by}` },
  ];
  if (t.kind === "exception") {
    facts.push({ label: "Exceptions", value: r.exceptions, mono: true }, { label: "Not reviewed", value: r.unreviewed, mono: true });
  }
  if (t.kind === "posttrade" || t.kind === "processing") {
    facts.push({ label: "Trades", value: r.trades?.toLocaleString("en-GB"), mono: true });
    if (r.rejected) facts.push({ label: "Rejected rows", value: r.rejected.toLocaleString("en-GB"), mono: true });
  }
  if (t.kind === "regulatory") {
    facts.push({ label: "Distribution", value: r.status !== "succeeded" ? undefined : r.distributed ? "Sent" : "Awaiting sign-off" });
  }
  return facts;
}

function definitionFacts(t: Thread): KeyValue[] {
  const facts: KeyValue[] = [];
  if (t.file) facts.push({ label: "File name", value: t.file, mono: true });
  if (t.kind === "posttrade") {
    const first = t.runs[t.runs.length - 1];
    facts.push({ label: "Created by", value: first.by }, { label: "Created", value: longWhen(first.at) });
    return facts;
  }
  facts.push({ label: "Frequency", value: t.frequency });
  if (t.nextRun) facts.push({ label: "Next run", value: t.paused ? "Paused" : t.nextRun });
  facts.push({ label: "Owner", value: t.owner });
  if (t.purpose) facts.push({ label: "Purpose", value: t.purpose });
  if (t.source) facts.push({ label: "Source", value: t.source });
  return facts;
}

/** A small trend across runs, for the kinds where the count is the story. */
function Trend({ thread }: { thread: Thread }) {
  const done = thread.runs.filter((r) => r.status === "succeeded");
  if (done.length < 3) return null;
  const isExc = thread.kind === "exception";
  const values = done
    .map((r) => (isExc ? r.exceptions : r.trades))
    .filter((v): v is number => typeof v === "number")
    .reverse();
  if (values.length < 3) return null;
  const label = isExc ? "Exceptions per run" : "Trades per run";
  return (
    <div className="mt-4 max-w-xs">
      <div className={text.label}>
        {label}, last {values.length} runs
      </div>
      <Sparkline className="mt-1 h-8 w-full" values={values} label={`${label}, oldest to newest: ${values.join(", ")}`} tone={isExc ? "warning" : "neutral"} />
    </div>
  );
}
