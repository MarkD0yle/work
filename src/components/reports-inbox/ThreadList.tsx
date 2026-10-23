import { EmptyState, StatusBadge, tokens } from "../patterns";
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, outcome, shortWhen, type Run, type Thread } from "./model";

const { button, cx, focus, text, border, surface } = tokens;

/* ThreadList — the inbox, full width.
 *
 * Works like a mail client's conversation view. One row per report
 * definition shows its newest run: name, time, outcome and a one-line
 * preview. Click a row to select it (the action bar above fills in) and
 * open it. Open shows how the report is set up and its full run history;
 * each run can be selected, downloaded or re-run for its own date.
 * Unread (a run you haven't opened) is a blue dot plus a bold name, so it
 * never relies on colour alone.
 *
 * With `inline={false}` rows don't open in place: the page shows the
 * selected report's set-up and history in a side panel instead, built
 * from the same Setup and RunHistory parts exported below. */

export type Selection = { threadId: string; runId: string | null };

export function ThreadList({
  threads,
  allThreads,
  selected,
  expanded,
  showKind,
  onSelect,
  onToggle,
  onRerun,
  onOpenThread,
  onClearFilters,
  inline = true,
}: {
  threads: Thread[];
  /** Every thread, to resolve "built on" and "used by" links. */
  allThreads: Thread[];
  selected: Selection | null;
  expanded: Set<string>;
  /** Show the report type on each row (the "All" tab mixes types). */
  showKind: boolean;
  onSelect: (s: Selection) => void;
  onToggle: (threadId: string) => void;
  onRerun: (thread: Thread, run: Run) => void;
  onOpenThread: (threadId: string) => void;
  onClearFilters: () => void;
  /** Open reports in the list (true) or leave that to a side panel. */
  inline?: boolean;
}) {
  if (threads.length === 0) {
    return (
      <EmptyState
        kind="filtered"
        title="No reports match"
        description="Try another search, or clear the filters."
        action={{ label: "Clear filters", onClick: onClearFilters }}
      />
    );
  }

  return (
    <ul aria-label="Reports" className={cx("divide-y bg-white", border.divide)}>
      {threads.map((t) => {
        const latest = t.runs[0];
        const open = inline && expanded.has(t.id);
        const isSel = selected?.threadId === t.id;
        const o = outcome(t, latest);
        return (
          <li key={t.id}>
            <div className={cx("flex items-stretch", isSel ? surface.selected : "hover:bg-neutral-50")}>
              {!inline && <span aria-hidden className="w-4 shrink-0" />}
              {inline && (
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                aria-expanded={open}
                aria-label={`${open ? "Hide" : "Show"} run history for ${t.name}`}
                className={cx("flex w-10 shrink-0 items-start justify-center pt-4 text-neutral-500 hover:text-neutral-900", focus)}
              >
                <svg viewBox="0 0 16 16" className={cx("h-4 w-4 transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
              )}
              <button
                type="button"
                onClick={() => onSelect({ threadId: t.id, runId: null })}
                aria-current={isSel ? "true" : undefined}
                className={cx("flex min-w-0 flex-1 flex-col gap-1 py-3 pr-6 text-left", focus)}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span aria-hidden className={cx("h-2 w-2 shrink-0 self-center rounded-full", t.unread ? "bg-blue-600" : "bg-transparent")} />
                  <span className={cx("min-w-0 flex-1 truncate text-sm text-neutral-900", t.unread ? "font-bold" : "font-medium")}>
                    {t.unread && <span className="sr-only">Unread: </span>}
                    {t.name}
                  </span>
                  <span className={cx("shrink-0 text-xs text-neutral-500", text.numeric)}>{shortWhen(latest.at)}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2 pl-4">
                  <StatusBadge tone={o.tone} label={o.label} />
                  <span className="min-w-0 truncate text-xs text-neutral-600">{latest.summary}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-1.5 pl-4 text-[11px] text-neutral-500">
                  {showKind && (
                    <>
                      <span>{KIND_LABEL[t.kind]}</span>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <span>{t.file ?? t.frequency}</span>
                  {t.kind === "posttrade" && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t.owner}</span>
                      {latest.trades !== undefined && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={text.numeric}>{latest.trades.toLocaleString("en-GB")} trades</span>
                        </>
                      )}
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span>
                    {t.runs.length} run{t.runs.length === 1 ? "" : "s"}
                  </span>
                  {t.paused && <StatusBadge tone="neutral" label="Paused" />}
                </span>
              </button>
            </div>

            {open && (
              <div className={cx("border-t bg-neutral-50 pt-3 pr-6 pb-4 pl-10", border.subtle)}>
                <Setup thread={t} allThreads={allThreads} onOpenThread={onOpenThread} />
                <RunHistory thread={t} selected={selected} onSelect={onSelect} onRerun={onRerun} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** How the report is set up, in one or two lines. No charts. */
export function Setup({ thread: t, allThreads, onOpenThread }: { thread: Thread; allThreads: Thread[]; onOpenThread: (id: string) => void }) {
  const facts: string[] = [];
  if (t.kind === "posttrade") {
    const first = t.runs[t.runs.length - 1];
    facts.push(`Uploaded by ${first.by}`, shortWhen(first.at));
  } else {
    facts.push(t.frequency);
    if (t.nextRun) facts.push(t.paused ? "Schedule paused" : `Next run ${t.nextRun}`);
    facts.push(`Owner ${t.owner}`);
  }
  if (t.source) facts.push(`Source: ${t.source}`);
  if (t.purpose) facts.push(t.purpose);
  if (t.recipients.length) facts.push(`${t.recipients.length} recipient${t.recipients.length === 1 ? "" : "s"}: ${t.recipients.join(", ")}`);

  const inputs = (t.inputs ?? []).map((id) => allThreads.find((x) => x.id === id)).filter((x): x is Thread => !!x);
  const usedBy = t.kind === "processing" ? allThreads.filter((x) => x.inputs?.includes(t.id)) : [];
  const links = t.kind === "processing" ? usedBy : inputs;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <p className="text-xs text-neutral-600">{facts.join(" · ")}</p>
      {t.conditions && t.conditions.length > 0 && (
        <ul aria-label="Conditions" className="flex flex-wrap gap-1.5">
          {t.conditions.map((c) => (
            <li key={c.field} className="border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-800">
              {c.field} <span className="font-semibold">{c.op}</span> {c.value}
            </li>
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={text.label}>{t.kind === "processing" ? "Used by" : "Built on"}</span>
          {links.map((x) => {
            const r = x.runs[0];
            const tone = x.kind === "processing" ? STATUS_TONE[r.status] : outcome(x, r).tone;
            const label = x.kind === "processing" ? STATUS_LABEL[r.status] : outcome(x, r).label;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => onOpenThread(x.id)}
                aria-label={`${x.name}: ${label}`}
                className={cx("inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-800 hover:bg-neutral-100", focus)}
              >
                <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", tokens.tone[tone].solid)} />
                {x.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every run, newest first. Each can be picked, downloaded or re-run. */
export function RunHistory({
  thread: t,
  selected,
  onSelect,
  onRerun,
  compact = false,
}: {
  thread: Thread;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
  onRerun: (thread: Thread, run: Run) => void;
  /** Narrow layout for a side panel: summary under the date and outcome. */
  compact?: boolean;
}) {
  const busy = t.runs[0].status === "running" || t.runs[0].status === "queued";
  const selRunId = selected?.threadId === t.id ? (selected.runId ?? t.runs[0].id) : null;
  return (
    <div>
      <h3 className={cx("mb-1", text.eyebrow)}>Run history · {t.runs.length}</h3>
      <ul aria-label={`Run history for ${t.name}`} className={cx("divide-y bg-white", border.default, border.divide)}>
        {t.runs.map((r, i) => {
          const ro = outcome(t, r);
          const on = selRunId === r.id;
          return (
            <li key={r.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 pr-2", on ? surface.selected : "hover:bg-neutral-50")}>
              <button
                type="button"
                onClick={() => onSelect({ threadId: t.id, runId: i === 0 ? null : r.id })}
                aria-current={on ? "true" : undefined}
                className={cx(
                  "grid min-w-0 flex-1 items-center gap-x-3 gap-y-0.5 py-2 pl-3 text-left",
                  compact ? "basis-56 grid-cols-[5.5rem_minmax(0,1fr)]" : "basis-80 grid-cols-[6.5rem_8.5rem_minmax(0,1fr)] max-sm:grid-cols-[5.5rem_minmax(0,1fr)]",
                  focus,
                )}
              >
                <span className={cx("text-xs text-neutral-800", text.numeric)}>
                  {shortWhen(r.at)}
                  {i === 0 && <span className="ml-1.5 text-[10px] font-semibold text-neutral-500">Latest</span>}
                </span>
                <span>
                  <StatusBadge dot tone={ro.tone} label={ro.label} />
                </span>
                <span className={cx("min-w-0 truncate text-xs text-neutral-600", compact ? "col-span-2" : "max-sm:col-span-2")}>
                  {r.period && <span className="mr-1.5 font-medium text-neutral-800">For {r.period}.</span>}
                  {r.summary}
                </span>
              </button>
              <span className={cx("hidden w-28 truncate text-[11px] text-neutral-500", !compact && "md:block", text.numeric)}>
                {r.trigger === "Schedule" ? "Schedule" : `${r.trigger} · ${r.by}`}
              </span>
              <span className="flex gap-1">
                <button type="button" className={button.ghost} disabled={r.status !== "succeeded"} aria-label={`Download run from ${shortWhen(r.at)}`}>
                  Download
                </button>
                <button type="button" className={button.ghost} disabled={busy} onClick={() => onRerun(t, r)} aria-label={`Re-run for ${r.period ?? shortWhen(r.at)}`}>
                  Re-run
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
