import { EmptyState, StatusBadge, tokens } from "../patterns";
import { KIND_LABEL, outcome, shortWhen, type Thread } from "./model";

const { cx, focus, text, border, surface } = tokens;

/* ThreadList — the inbox column.
 *
 * Works like a mail client's conversation view. One row per report
 * definition shows its newest run: name, time, outcome and a one-line
 * preview. The chevron opens the thread to show every earlier run as
 * indented rows; clicking any of them shows that run in the reading pane.
 * Unread (a run you haven't opened) is a blue dot plus bold name, so it
 * never relies on colour alone. */

export type Selection = { threadId: string; runId: string | null };

export function ThreadList({
  threads,
  selected,
  expanded,
  showKind,
  onSelect,
  onToggle,
  onClearFilters,
}: {
  threads: Thread[];
  selected: Selection | null;
  expanded: Set<string>;
  /** Show the report type on each row (the "All" tab mixes types). */
  showKind: boolean;
  onSelect: (s: Selection) => void;
  onToggle: (threadId: string) => void;
  onClearFilters: () => void;
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
    <ul aria-label="Reports" className={cx("divide-y", border.divide)}>
      {threads.map((t) => {
        const latest = t.runs[0];
        const open = expanded.has(t.id);
        const isSel = selected?.threadId === t.id;
        const threadSel = isSel && (selected?.runId === null || selected?.runId === latest.id);
        const o = outcome(t, latest);
        const earlier = t.runs.slice(1);
        return (
          <li key={t.id}>
            <div className={cx("flex items-stretch", threadSel ? surface.selected : "bg-white hover:bg-neutral-50")}>
              {earlier.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onToggle(t.id)}
                  aria-expanded={open}
                  aria-label={`${open ? "Hide" : "Show"} ${earlier.length} earlier run${earlier.length === 1 ? "" : "s"} of ${t.name}`}
                  className={cx("flex w-8 shrink-0 items-start justify-center pt-3.5 text-neutral-500 hover:text-neutral-900", focus)}
                >
                  <svg viewBox="0 0 16 16" className={cx("h-4 w-4 transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </button>
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => onSelect({ threadId: t.id, runId: null })}
                aria-current={threadSel ? "true" : undefined}
                className={cx("flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4 text-left", focus)}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span aria-hidden className={cx("h-2 w-2 shrink-0 self-center rounded-full", t.unread ? "bg-blue-600" : "bg-transparent")} />
                  <span className={cx("min-w-0 flex-1 truncate text-[13px] text-neutral-900", t.unread ? "font-bold" : "font-medium")}>
                    {t.unread && <span className="sr-only">Unread: </span>}
                    {t.name}
                  </span>
                  <span className={cx("shrink-0 text-[11px] text-neutral-500", text.numeric)}>{shortWhen(latest.at)}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2 pl-4">
                  <StatusBadge tone={o.tone} label={o.label} />
                  <span className="min-w-0 truncate text-xs text-neutral-600">{latest.summary}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-1.5 pl-4 text-[11px] text-neutral-500">
                  {showKind && <span>{KIND_LABEL[t.kind]}</span>}
                  {showKind && <span aria-hidden>·</span>}
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

            {open && earlier.length > 0 && (
              <ul aria-label={`Earlier runs of ${t.name}`} className="border-t border-neutral-100 bg-neutral-50 py-1">
                {earlier.map((r) => {
                  const ro = outcome(t, r);
                  const on = isSel && selected?.runId === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onSelect({ threadId: t.id, runId: r.id })}
                        aria-current={on ? "true" : undefined}
                        className={cx(
                          "grid w-full grid-cols-[5.5rem_auto_minmax(0,1fr)] items-center gap-2 py-1.5 pr-4 pl-12 text-left",
                          on ? "bg-neutral-200" : "hover:bg-neutral-100",
                          focus,
                        )}
                      >
                        <span className={cx("text-[11px] text-neutral-700", text.numeric)}>{shortWhen(r.at)}</span>
                        <StatusBadge dot tone={ro.tone} label={ro.label} />
                        <span className="truncate text-[11px] text-neutral-500">{r.summary}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
