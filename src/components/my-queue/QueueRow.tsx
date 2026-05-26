import {
  effectiveState,
  type MonitorAction,
  type QlikMonitor,
} from "../../lib/qlik";
import MonitorActionMenu from "../ops-overview/MonitorActionMenu";

const DOT: Record<QlikMonitor["status"], string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  info: "bg-blue-400",
  green: "bg-neutral-300",
};

function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* My Queue row — compact variant of MonitorRow. Action surface still
 * embedded so this surface is actionable, not just a list. */

export default function QueueRow({
  monitor,
  actions,
  now,
  ownerLabel,
}: {
  monitor: QlikMonitor;
  actions: MonitorAction[];
  now: number;
  ownerLabel: string;
}) {
  const effective = effectiveState(monitor, actions);
  const refreshAge = Math.floor(
    (now - new Date(monitor.lastRefresh).getTime()) / 60_000,
  );

  return (
    <li className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[monitor.status]}`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-neutral-900">
          {monitor.name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-[11px] text-neutral-500">
          <span>{monitor.detail}</span>
          <span className="font-mono">· {refreshAge}m</span>
          <span className="font-medium text-blue-700">· {ownerLabel}</span>
          <span className="font-mono text-neutral-400">
            · refresh {formatClock(monitor.lastRefresh)}
          </span>
        </div>
      </div>
      <MonitorActionMenu monitor={monitor} effective={effective} />
    </li>
  );
}
