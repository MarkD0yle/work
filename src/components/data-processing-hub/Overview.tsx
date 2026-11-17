import { useMemo } from "react";
import { Banner, DataTable, SectionCard, tokens, type Column } from "../patterns";
import { REASONS, SOURCES, SOURCE_IDS, dateLabel, loadView, loadsFor, num, plural, replaySummary, type LoadView, type SourceId } from "./model";
import { useReplay } from "./replay-context";
import { LoadStatusBadge, ReplayTracker } from "./ui";

const { button, cx, focus, text, tone } = tokens;

/* Overview — how the selected business date went, source by source.
 *
 * One card per source, one row per file or load. A failed count is a link:
 * it opens the Records grid for that source already filtered to Failed (and
 * to that load, when the count belongs to a single load). Loads that need
 * action are said so in words at the top, and each one carries its own
 * Replay button. */

function FailedLink({ count, label, onClick }: { count: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cx("inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline", tone.negative.text, focus)}>
      <span aria-hidden>✕</span>
      {num(count)}
    </button>
  );
}

function WhatWentWrong({ v }: { v: LoadView }) {
  if (v.activeRun) return <span className={text.body}>{replaySummary(v.activeRun)}</span>;
  if (v.failed === 0) {
    return <span className={text.muted}>{v.recovered ? "Fixed by replay" : "Nothing"}</span>;
  }
  const [top, ...rest] = v.reasons;
  return (
    <div className="min-w-0">
      <div className="text-xs text-neutral-900">
        {REASONS[top.code].label}
        {rest.length > 0 && <span className={text.muted}> and {plural(rest.length, "other reason")}</span>}
      </div>
      {v.lastRun?.status === "Failed" && <div className={cx("mt-0.5 text-xs", tone.negative.text)}>The last replay failed. Nothing was changed.</div>}
      {!v.ready && <div className={cx("mt-0.5", text.muted)}>Replay not ready: {v.load.blockedBy && v.fixable > 0 ? `waiting for ${v.load.blockedBy}` : "a replay would not fix this"}</div>}
    </div>
  );
}

function SourceCard({
  source,
  views,
  onOpenFailed,
  onOpenRecords,
  onReplay,
}: {
  source: SourceId;
  views: LoadView[];
  onOpenFailed: (source: SourceId, loadId?: string) => void;
  onOpenRecords: (source: SourceId) => void;
  onReplay: (loadId: string) => void;
}) {
  const meta = SOURCES[source];
  const total = views.reduce((s, v) => s + v.load.total, 0);
  const failed = views.reduce((s, v) => s + v.failed, 0);

  const columns: Column<LoadView>[] = [
    {
      key: "load",
      header: source === "FMR" ? "File" : "Load",
      cell: (v) => (
        <div className="min-w-0">
          <div className="font-medium text-neutral-900">{v.load.name}</div>
          <div className="font-mono text-[11px] text-neutral-500">{v.load.id}</div>
        </div>
      ),
      sortValue: (v) => v.load.id,
    },
    { key: "received", header: "Received", cell: (v) => <span className="tabular-nums">{v.load.receivedAt}</span>, sortValue: (v) => v.load.receivedAt, width: "w-20" },
    { key: "status", header: "Processing status", cell: (v) => <LoadStatusBadge status={v.status} />, sortValue: (v) => v.status, width: "w-48" },
    { key: "total", header: "Records", align: "right", cell: (v) => num(v.load.total), sortValue: (v) => v.load.total, width: "w-24" },
    { key: "processed", header: "Processed", align: "right", cell: (v) => num(v.processed), sortValue: (v) => v.processed, width: "w-24" },
    {
      key: "failed",
      header: "Failed",
      align: "right",
      cell: (v) =>
        v.failed > 0 ? (
          <FailedLink count={v.failed} label={`${plural(v.failed, "failed record")} in ${v.load.id}. Open them in Records.`} onClick={() => onOpenFailed(source, v.load.id)} />
        ) : (
          <span className="text-neutral-500">0</span>
        ),
      sortValue: (v) => v.failed,
      width: "w-24",
    },
    { key: "why", header: "What went wrong", cell: (v) => <WhatWentWrong v={v} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      width: "w-36",
      cell: (v) => {
        if (v.activeRun) {
          return (
            <button type="button" onClick={() => onReplay(v.load.id)} className={button.secondary}>
              View replay
            </button>
          );
        }
        if (v.failed === 0) return <span className="text-neutral-400">None needed</span>;
        return (
          <button type="button" onClick={() => onReplay(v.load.id)} className={v.ready ? button.primary : button.secondary}>
            {v.ready ? `Replay ${meta.unit}` : "Review replay"}
          </button>
        );
      },
    },
  ];

  return (
    <SectionCard
      title={meta.label}
      subtitle={`${meta.about} · ${plural(views.length, meta.unit)} · ${plural(total, "record")}`}
      flush
      actions={
        <>
          {failed > 0 ? (
            <button type="button" onClick={() => onOpenFailed(source)} className={cx("inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 hover:no-underline", tone.negative.text, focus)}>
              <span aria-hidden>✕</span>
              {plural(failed, "failed record")}
            </button>
          ) : (
            <span className={cx("inline-flex items-center gap-1.5 text-xs font-medium", tone.positive.text)}>
              <span aria-hidden>✓</span>
              No failed records
            </span>
          )}
          <button type="button" onClick={() => onOpenRecords(source)} className={button.ghost}>
            All records
          </button>
        </>
      }
    >
      <DataTable caption={`${meta.label} for the selected business date`} columns={columns} rows={views} rowKey={(v) => v.load.id} density="comfortable" />
    </SectionCard>
  );
}

export function Overview({
  date,
  onOpenFailed,
  onOpenRecords,
  onReplay,
}: {
  date: string;
  onOpenFailed: (source: SourceId, loadId?: string) => void;
  onOpenRecords: (source: SourceId) => void;
  onReplay: (loadId: string) => void;
}) {
  const { runs } = useReplay();

  const bySource = useMemo(() => SOURCE_IDS.map((source) => ({ source, views: loadsFor(date, source).map((l) => loadView(l, runs)) })), [date, runs]);
  const all = bySource.flatMap((s) => s.views);

  const stopped = all.filter((v) => v.status === "Failed");
  const partial = all.filter((v) => v.status === "Completed with failures");
  const replaying = all.filter((v) => v.activeRun);
  const ready = all.filter((v) => v.failed > 0 && v.ready);
  const attention = stopped.length + partial.length;

  // Replays started this session for loads on this date, newest first.
  const dateRuns = runs.filter((r) => all.some((v) => v.load.id === r.loadId)).reverse();

  return (
    <div className="flex flex-col gap-4">
      {attention === 0 && replaying.length === 0 ? (
        <Banner tone="positive" title={`All ${all.length} loads completed for ${dateLabel(date)}`}>
          No failed records. Nothing needs action.
        </Banner>
      ) : (
        <Banner
          tone={stopped.length > 0 ? "negative" : attention > 0 ? "warning" : "info"}
          title={attention > 0 ? `${attention} of ${all.length} loads need attention for ${dateLabel(date)}` : `${plural(replaying.length, "replay")} running for ${dateLabel(date)}`}
        >
          {[
            stopped.length > 0 && `${plural(stopped.length, "load")} failed completely`,
            partial.length > 0 && `${plural(partial.length, "load")} completed with failed records`,
            replaying.length > 0 && `${plural(replaying.length, "replay")} running`,
          ]
            .filter(Boolean)
            .join(" · ")}
          {attention > 0 && (ready.length > 0 ? `. ${ready.length === 1 ? "1 can" : `${ready.length} can`} be replayed now: use the Replay button on its row.` : ". None can be fixed by a replay right now. Open a failed count to see why.")}
        </Banner>
      )}

      {bySource.map(({ source, views }) => (
        <SourceCard key={source} source={source} views={views} onOpenFailed={onOpenFailed} onOpenRecords={onOpenRecords} onReplay={onReplay} />
      ))}

      {dateRuns.length > 0 && (
        <SectionCard title="Replays this session" subtitle="Progress of each replay started for this business date. Newest first.">
          <ul className="flex flex-col gap-5">
            {dateRuns.map((run) => {
              const v = all.find((x) => x.load.id === run.loadId) as LoadView;
              return (
                <li key={run.id} className="grid gap-3 lg:grid-cols-[18rem_1fr] lg:items-center">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-neutral-900">{v.load.name}</div>
                    <div className="font-mono text-[11px] text-neutral-500">{v.load.id}</div>
                  </div>
                  <ReplayTracker run={run} />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
