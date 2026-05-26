import type { QlikSummary } from "../../lib/qlik";

/* The three Qlik dashboard header tiles, per spec §0:
 *   - Monitor Summary Refresh   (feed health: is Qlik computing fresh data?)
 *   - Monitor Summary           (the count summary itself)
 *   - Other Dashboard Refresh   (related dashboards Qlik depends on)
 *
 * Qlik users see these tiles every day — replicating them at the top of
 * ccymgmt orients them: "same data, same status structure, plus the
 * action layer that Qlik can't do."
 *
 * Visually slim — sits in the firm-wide context band alongside the
 * management strip, not competing with the L0 state banner below. */

type RefreshStatus = "ok" | "degraded" | "failed";

const STATUS_TONE: Record<
  RefreshStatus,
  { dot: string; label: string; text: string }
> = {
  ok: { dot: "bg-emerald-500", label: "Healthy", text: "text-emerald-700" },
  degraded: {
    dot: "bg-amber-500",
    label: "Degraded",
    text: "text-amber-700",
  },
  failed: { dot: "bg-red-500", label: "Failed", text: "text-red-700" },
};

function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ageMin(ts: string, now: number): number {
  return Math.floor((now - new Date(ts).getTime()) / 60_000);
}

export default function QlikHeaderTrio({
  summary,
  now,
}: {
  summary: QlikSummary;
  now: number;
}) {
  // Monitor Summary tile derives its own status from the counts.
  const monitorSummaryStatus: RefreshStatus =
    summary.monitorSummary.midLevelFlags >= 3
      ? "failed"
      : summary.monitorSummary.midLevelFlags > 0
        ? "degraded"
        : "ok";

  return (
    <section
      aria-label="Qlik feed status"
      className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      <Tile
        label="Monitor Summary Refresh"
        status={summary.monitorRefreshStatus}
        primary={
          summary.monitorRefreshStatus === "ok"
            ? "On schedule"
            : summary.monitorRefreshStatus === "degraded"
              ? "Delayed"
              : "Refresh failed"
        }
        secondary={`Last ${formatClock(summary.lastRefresh)} · ${ageMin(summary.lastRefresh, now)}m ago`}
      />
      <Tile
        label="Monitor Summary"
        status={monitorSummaryStatus}
        primary={
          summary.monitorSummary.midLevelFlags === 0
            ? "All on benchmark"
            : `${summary.monitorSummary.midLevelFlags} past benchmark`
        }
        secondary={`${summary.monitorSummary.infoWarnings} info warning${
          summary.monitorSummary.infoWarnings === 1 ? "" : "s"
        }`}
      />
      <Tile
        label="Other Dashboard Refresh"
        status={summary.otherDashboardStatus}
        primary={
          summary.otherDashboardStatus === "ok"
            ? "All sources healthy"
            : summary.otherDashboardStatus === "degraded"
              ? "One source degraded"
              : "Source feed offline"
        }
        secondary={`Last ${formatClock(summary.lastRefresh)} · ${ageMin(summary.lastRefresh, now)}m ago`}
      />
    </section>
  );
}

function Tile({
  label,
  status,
  primary,
  secondary,
}: {
  label: string;
  status: RefreshStatus;
  primary: string;
  secondary: string;
}) {
  const tone = STATUS_TONE[status];
  return (
    <div className="flex flex-col rounded-md border border-neutral-200 bg-white px-4 py-2.5">
      <div className="text-[10px] font-medium tracking-widest text-neutral-500 uppercase">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span aria-hidden className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span className={`text-sm font-semibold ${tone.text}`}>{primary}</span>
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-neutral-500">
        {secondary}
      </div>
    </div>
  );
}
