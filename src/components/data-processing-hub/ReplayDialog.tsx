import type { ReactNode } from "react";
import { Banner, KeyValueGrid, Modal, tokens } from "../patterns";
import { REASONS, SOURCES, dateLabel, loadById, loadImpact, loadView, num, plural, replayVersions } from "./model";
import { useReplay } from "./replay-context";
import { LoadStatusBadge, ReplayTracker } from "./ui";

const { button, cx, text } = tokens;

/* ReplayDialog — confirm a replay, then watch it.
 *
 * Replay always covers a whole FMR file or a whole MDM/MRD load. Before
 * confirming, the dialog shows the load, why it failed, the impact, the MDM
 * and MRD versions involved, and whether the load is ready (and if not,
 * why). Once a replay is in flight the same dialog shows its progress and
 * offers no way to start a second one. */

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={text.eyebrow}>{title}</h3>
      <div className="mt-1.5 text-xs leading-relaxed text-neutral-800">{children}</div>
    </section>
  );
}

export function ReplayDialog({ loadId, onClose }: { loadId: string | null; onClose: () => void }) {
  const { runs, start } = useReplay();
  if (!loadId) return null;

  const load = loadById(loadId);
  const v = loadView(load, runs);
  const unit = SOURCES[load.source].unit;
  const next = replayVersions(load, runs);
  const run = v.activeRun ?? v.lastRun;
  const stays = v.failed - v.fixable;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={v.activeRun ? "Replay in progress" : `Replay ${load.source} ${unit}`}
      description={`Replay reprocesses the whole ${unit}. Individual records cannot be replayed.`}
      footer={
        v.activeRun ? (
          <>
            <span className={cx("mr-auto", text.muted)}>You can close this. The replay keeps running and its progress stays on the Overview.</span>
            <button type="button" onClick={onClose} className={button.secondary}>
              Close
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className={button.secondary}>
              {v.ready ? "Cancel" : "Close"}
            </button>
            <button type="button" disabled={!v.ready} onClick={() => start(load)} className={button.primary}>
              Replay {unit}
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Block title={`Selected ${unit}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900">{load.name}</div>
              <div className={text.muted}>
                <span className="font-mono">{load.id}</span> · {dateLabel(load.businessDate)} · {plural(load.total, "record")}
              </div>
            </div>
            <LoadStatusBadge status={v.status} />
          </div>
        </Block>

        {run && (
          <Block title={v.activeRun ? "Progress" : "Last replay"}>
            <ReplayTracker run={run} />
            {run.status === "Failed" && !v.activeRun && <p className="mt-2">The last replay failed before it changed anything. The {unit} is as it was, and you can replay it again.</p>}
          </Block>
        )}

        <Block title="Failure reason">
          {v.failed === 0 ? (
            <p>No failed records remain{v.recovered ? ". The last replay cleared them." : "."}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {v.reasons.map((f) => (
                <li key={f.code} className="flex items-baseline justify-between gap-4">
                  <span>{REASONS[f.code].label}</span>
                  <span className="shrink-0 text-neutral-500 tabular-nums">{plural(f.count, "record")}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Impact">
          <p>{loadImpact(v)}</p>
        </Block>

        <Block title="MDM and MRD versions">
          <KeyValueGrid
            columns={2}
            items={[
              { label: "MDM version, first processed with", value: load.mdmVersion ?? "Not used by MRD loads", mono: true },
              { label: "MRD version, first processed with", value: load.mrdVersion, mono: true },
              { label: "MDM version, replay will use", value: next.mdm ?? "Not used by MRD loads", mono: true },
              { label: "MRD version, replay will use", value: next.mrd, mono: true },
            ]}
          />
        </Block>

        {!v.activeRun &&
          (v.ready ? (
            <Banner tone="positive" title="Ready to replay">
              All {num(load.total)} records will be reprocessed. {plural(v.fixable, "failed record")} should clear
              {stays > 0 ? `; ${stays === 1 ? "1 will stay failed because it needs" : `${num(stays)} will stay failed because they need`} corrected data from the sender.` : "."}
            </Banner>
          ) : v.failed === 0 ? (
            <Banner tone="positive" title="Nothing left to replay">
              Every record in this {unit} has been processed.
            </Banner>
          ) : (
            <Banner tone="warning" title="Not ready to replay">
              {v.notReadyReason}
            </Banner>
          ))}
      </div>
    </Modal>
  );
}
