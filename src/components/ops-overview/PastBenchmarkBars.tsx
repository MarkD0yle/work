import { useMemo } from "react";
import {
  PIPELINE_STAGE_ORDER,
  type PipelineState,
  type PipelineStageName,
} from "../../lib/qlik";

/* L2 bar charts — direct translation of the per-process / per-client
 * past-benchmark counts that Qlik shows. Spec §0 explicitly names these
 * as one of Qlik's L2 surfaces. Familiar pattern for any Qlik user.
 *
 * "Past benchmark" = breached or failed today vs the stage benchmark
 * time. Holiday pipelines excluded.
 *
 * Click any process or client bar to focus the corresponding monitor /
 * pipeline; same cross-reference mechanic used elsewhere on the page. */

type ProcessBucket = { name: PipelineStageName; count: number };
type ClientBucket = {
  pipelineId: string;
  clientName: string;
  groupName: string;
  count: number;
  isMine: boolean;
  firstMonitorId?: string;
};

export default function PastBenchmarkBars({
  pipelines,
  onMonitorClick,
}: {
  pipelines: PipelineState[];
  onMonitorClick?: (monitorId: string) => void;
}) {
  const byProcess: ProcessBucket[] = useMemo(() => {
    const counts: Record<PipelineStageName, number> = {
      Rebalance: 0,
      Estimates: 0,
      Actuals: 0,
      Reporting: 0,
    };
    for (const p of pipelines) {
      if (p.isHolidayToday) continue;
      for (const s of p.stages) {
        if (s.status === "past_typical" || s.status === "past_required" || s.status === "past_benchmark" || s.status === "failed") {
          counts[s.name] += 1;
        }
      }
    }
    return PIPELINE_STAGE_ORDER.map((name) => ({ name, count: counts[name] }))
      // Sort desc by count so the leader bar is on top; ties preserve stage order.
      .sort((a, b) => b.count - a.count);
  }, [pipelines]);

  const byClient: ClientBucket[] = useMemo(() => {
    const buckets: ClientBucket[] = [];
    for (const p of pipelines) {
      if (p.isHolidayToday) continue;
      const breached = p.stages.filter(
        (s) => s.status === "past_typical" || s.status === "past_required" || s.status === "past_benchmark" || s.status === "failed",
      );
      if (breached.length === 0) continue;
      buckets.push({
        pipelineId: p.id,
        clientName: p.clientName,
        groupName: p.groupName,
        count: breached.length,
        isMine: p.isMine,
        firstMonitorId: breached[0].monitorIds[0],
      });
    }
    return buckets.sort((a, b) => b.count - a.count);
  }, [pipelines]);

  const maxProcess = Math.max(1, ...byProcess.map((b) => b.count));
  const maxClient = Math.max(1, ...byClient.map((b) => b.count));
  const totalPastBenchmark = byClient.reduce((n, b) => n + b.count, 0);

  return (
    <section
      aria-label="Past-benchmark bar charts"
      className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <Panel
        title="Past benchmark · by process"
        empty={totalPastBenchmark === 0 ? "All processes on benchmark." : null}
        total={totalPastBenchmark}
      >
        <ul className="flex flex-col gap-1.5">
          {byProcess.map((b) => (
            <BarRow
              key={b.name}
              label={b.name}
              count={b.count}
              max={maxProcess}
              tone={b.count === 0 ? "neutral" : "amber"}
            />
          ))}
        </ul>
      </Panel>

      <Panel
        title="Past benchmark · by client"
        empty={byClient.length === 0 ? "All clients on benchmark." : null}
        total={totalPastBenchmark}
      >
        <ul className="flex flex-col gap-1.5">
          {byClient.map((b) => (
            <BarRow
              key={b.pipelineId}
              label={
                <span className="flex min-w-0 items-baseline gap-1">
                  <span className="truncate font-medium">{b.clientName}</span>
                  <span className="truncate text-[10px] text-neutral-400">
                    · {b.groupName}
                  </span>
                  {b.isMine && (
                    <span className="shrink-0 text-[9px] font-semibold tracking-wider text-blue-700 uppercase">
                      mine
                    </span>
                  )}
                </span>
              }
              count={b.count}
              max={maxClient}
              tone="amber"
              onClick={
                b.firstMonitorId && onMonitorClick
                  ? () => onMonitorClick(b.firstMonitorId!)
                  : undefined
              }
            />
          ))}
        </ul>
      </Panel>
    </section>
  );
}

function Panel({
  title,
  total,
  empty,
  children,
}: {
  title: string;
  total: number;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          {title}
        </h3>
        <span className="text-[11px] text-neutral-500">
          {total} total
        </span>
      </div>
      {empty ? (
        <p className="text-xs text-neutral-500">{empty}</p>
      ) : (
        children
      )}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  tone,
  onClick,
}: {
  label: React.ReactNode;
  count: number;
  max: number;
  tone: "neutral" | "amber";
  onClick?: () => void;
}) {
  const width = max > 0 ? (count / max) * 100 : 0;
  const barColor =
    tone === "amber" && count > 0 ? "bg-amber-400" : "bg-neutral-200";
  const interactive = !!onClick;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        className={`flex w-full items-center gap-3 rounded-sm py-0.5 text-left text-xs transition ${
          interactive ? "cursor-pointer hover:bg-neutral-50" : "cursor-default"
        }`}
      >
        <span className="flex w-56 shrink-0 items-baseline gap-1 overflow-hidden text-neutral-700">
          {label}
        </span>
        <span className="relative flex h-4 flex-1 items-center overflow-hidden rounded-sm bg-neutral-100">
          <span
            aria-hidden
            className={`block h-full rounded-sm ${barColor}`}
            style={{ width: `${width}%` }}
          />
        </span>
        <span className="w-6 text-right font-mono tabular-nums text-neutral-700">
          {count}
        </span>
      </button>
    </li>
  );
}
