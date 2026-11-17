import type { ReactNode } from "react";
import { Banner, KeyValueGrid, SectionCard, Timeline, tokens, type TimelineEvent } from "../patterns";
import { REASONS, SOURCES, STAGES, STAGE_ABOUT, loadView, num, type HubRecord, type Load } from "./model";
import { useReplay } from "./replay-context";
import { RecordStatusBadge, ReplayTracker } from "./ui";

const { button, cx, text } = tokens;

/* Record Details — one record, explained for a Support user.
 *
 * Fixed reading order: what happened, why it failed, what the impact is,
 * what to do next. The processing trace and the technical details sit in a
 * collapsed section at the end, for the cases that need escalating. Replay
 * is offered here too, but always for the whole file or load. */

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className={text.title}>{title}</h2>
        <div className="mt-1 max-w-prose text-sm leading-relaxed text-neutral-700">{children}</div>
      </div>
    </section>
  );
}

function traceOf(record: HubRecord, technical: string): TimelineEvent[] {
  const stoppedAt = record.status === "Failed" ? STAGES.indexOf(record.stage) : STAGES.length;
  return STAGES.map((stage, i) => {
    if (i < stoppedAt) return { id: stage, at: record.updatedAt, title: `✓ ${stage}: passed`, detail: STAGE_ABOUT[stage], tone: "positive" as const };
    if (i === stoppedAt) return { id: stage, at: record.updatedAt, title: `✕ ${stage}: stopped here`, detail: <span className="font-mono text-[11px] break-all">{technical}</span>, tone: "negative" as const };
    return { id: stage, at: "", title: `${stage}: not reached`, tone: "neutral" as const };
  });
}

export function RecordDetails({ record, load, onBack, onReplay }: { record: HubRecord; load: Load; onBack: () => void; onReplay: (loadId: string) => void }) {
  const { runs } = useReplay();
  const view = loadView(load, runs);
  const unit = SOURCES[load.source].unit;
  const failed = record.status === "Failed";
  const reason = record.reasonCode ? REASONS[record.reasonCode] : null;
  const technical = reason ? `${reason.errorCode} ${reason.technical(record, load)}` : "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div>
        <button type="button" onClick={onBack} className={button.secondary}>
          <span aria-hidden>←</span> Back to records
        </button>
      </div>

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={text.eyebrow}>
              {load.source} record · {record.recordType}
            </div>
            <h1 className="mt-0.5 font-mono text-base font-semibold text-neutral-900">{record.id}</h1>
            <p className="mt-0.5 text-sm text-neutral-700">{record.subject}</p>
          </div>
          <RecordStatusBadge status={record.status} />
        </div>
        <div className={cx("mt-4 border-t pt-4", tokens.border.subtle)}>
          <KeyValueGrid
            columns={4}
            items={[
              { label: "Load ID", value: load.id, mono: true },
              { label: load.source === "FMR" ? "File" : "Load", value: load.name },
              { label: "Processing stage", value: failed ? `Stopped at ${record.stage}` : record.stage },
              { label: "Failure reason", value: record.failureReason },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-5">
          {failed && reason ? (
            <>
              <Step n={1} title="What happened">
                {reason.what(record, load)}
              </Step>
              <Step n={2} title="Why it failed">
                {reason.why(record, load)}
              </Step>
              <Step n={3} title="What the impact is">
                {reason.impact(record, load)}
              </Step>
              <Step n={4} title="What to do next">
                <p>{reason.next(record, load)}</p>
                {reason.fixedByReplay && (
                  <div className="mt-3 flex flex-col gap-3">
                    {view.activeRun ? (
                      <ReplayTracker run={view.activeRun} />
                    ) : view.ready ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => onReplay(load.id)} className={button.primary}>
                          Replay {unit} {load.id}
                        </button>
                        <span className={text.muted}>
                          Replays the whole {unit} ({num(load.total)} records). A single record cannot be replayed on its own.
                        </span>
                      </div>
                    ) : (
                      <Banner tone="warning" title={`This ${unit} is not ready to be replayed`} action={{ label: "Review replay", onClick: () => onReplay(load.id) }}>
                        {view.notReadyReason}
                      </Banner>
                    )}
                  </div>
                )}
              </Step>
            </>
          ) : record.recoveredByReplay && reason ? (
            <>
              <Step n={1} title="What happened">
                This record failed when the {unit} was first processed ({reason.label.toLowerCase()}). A replay of the {unit} then processed it successfully, and it has been delivered.
              </Step>
              <Step n={2} title="What to do next">
                Nothing. No action is needed.
              </Step>
            </>
          ) : (
            <>
              <Step n={1} title="What happened">
                This record arrived, passed every check and was delivered to downstream systems. Nothing went wrong.
              </Step>
              <Step n={2} title="What to do next">
                Nothing. No action is needed.
              </Step>
            </>
          )}
        </div>
      </SectionCard>

      <details className={cx(tokens.surface.card, tokens.border.default)}>
        <summary className={cx("cursor-pointer px-4 py-3", text.title, tokens.focus)}>
          Processing trace and technical details
          <span className={cx("ml-2 font-normal", text.muted)}>For escalation to the technical team</span>
        </summary>
        <div className={cx("grid gap-6 border-t p-4 lg:grid-cols-2", tokens.border.subtle)}>
          <div>
            <h3 className={cx("mb-3", text.eyebrow)}>Processing trace</h3>
            <Timeline label="Processing trace" events={traceOf(record, technical)} />
          </div>
          <div>
            <h3 className={cx("mb-3", text.eyebrow)}>Technical details</h3>
            <KeyValueGrid
              layout="rows"
              items={[
                { label: "Record ID", value: record.id, mono: true },
                { label: "Reference in source", value: record.reference, mono: true },
                { label: "Account", value: record.account, mono: true },
                { label: "Security ID", value: record.instrument, mono: true },
                { label: "Line in file", value: num(record.lineNo), mono: true },
                { label: "Error code", value: record.errorCode, mono: true },
                { label: "MDM version used", value: load.mdmVersion ?? "Not used", mono: true },
                { label: "MRD version used", value: load.mrdVersion, mono: true },
                { label: "Last updated", value: record.updatedAt, mono: true },
              ]}
            />
            {technical && (
              <>
                <h3 className={cx("mt-4 mb-2", text.eyebrow)}>Error message</h3>
                <pre className="overflow-x-auto border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px] whitespace-pre-wrap text-neutral-800">{technical}</pre>
              </>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
