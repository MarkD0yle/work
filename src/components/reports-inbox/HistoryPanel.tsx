import ContextPanel, { PanelSection } from "../patterns/ContextPanel";
import { StatusBadge, tokens } from "../patterns";
import { RunHistory, Setup, type Selection } from "./ThreadList";
import { KIND_LABEL, longWhen, outcome, type Run, type Thread } from "./model";

const { text } = tokens;

/* HistoryPanel — version B's home for a report's detail.
 *
 * The list stays full width until a report is picked. Then this panel
 * docks on the right (a full-screen sheet on a phone) with three plain
 * blocks and no charts: the run you're on, how the report is set up, and
 * every run with Download and Re-run. Actions stay in the bar above the
 * list, so the panel only ever shows information. */

export function HistoryPanel({
  thread,
  run,
  selected,
  allThreads,
  onSelect,
  onRerun,
  onOpenThread,
  onClose,
}: {
  thread: Thread;
  run: Run;
  selected: Selection | null;
  allThreads: Thread[];
  onSelect: (s: Selection) => void;
  onRerun: (thread: Thread, run: Run) => void;
  onOpenThread: (threadId: string) => void;
  onClose: () => void;
}) {
  const o = outcome(thread, run);
  return (
    <ContextPanel title={thread.name} eyebrow={KIND_LABEL[thread.kind]} onClose={onClose}>
      <PanelSection title={run.id === thread.runs[0].id ? "Latest run" : "Selected run"}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={o.tone} label={o.label} />
          <span className={`text-xs text-neutral-700 ${text.numeric}`}>
            {longWhen(run.at)}
            {run.period && ` · for ${run.period}`}
          </span>
        </div>
        <p className="mt-2 text-sm text-neutral-800">{run.summary}</p>
      </PanelSection>
      <PanelSection title="Set-up">
        <Setup thread={thread} allThreads={allThreads} onOpenThread={onOpenThread} />
      </PanelSection>
      <PanelSection last>
        <RunHistory compact thread={thread} selected={selected} onSelect={onSelect} onRerun={onRerun} />
      </PanelSection>
    </ContextPanel>
  );
}
