import { useEffect, useMemo } from "react";
import {
  formatClock,
  type HealthIndicator,
  type HealthState,
  type SystemHealth,
} from "../../hooks/useSystemHealth";

/* Spec v0.1.2 §4.4 — click-through drawer for the system-health strip.
 * Shows the last 24h of poll attempts per indicator. The history is
 * synthesised from the current cadence in the prototype; real impl reads
 * from the feed-status backend. */

const STATE_LABEL: Record<HealthState, string> = {
  healthy: "Healthy",
  stale: "Stale",
  failed: "Failed",
};

const STATE_TONE: Record<HealthState, string> = {
  healthy: "text-emerald-700",
  stale: "text-amber-700",
  failed: "text-red-700",
};

export default function SystemHealthDrawer({
  health,
  now,
  onClose,
}: {
  health: SystemHealth;
  now: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close system health detail"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-900/30 backdrop-blur-[1px]"
      />
      <aside className="relative z-10 flex h-full w-[420px] flex-col border-l border-neutral-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              System health
            </div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Feed status — last 24h
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <IndicatorBlock indicator={health.qlikFeed} now={now} />
          <div className="my-4 h-px bg-neutral-100" />
          <IndicatorBlock indicator={health.dependentSystems} now={now} />
        </div>
      </aside>
    </div>
  );
}

function IndicatorBlock({
  indicator,
  now,
}: {
  indicator: HealthIndicator;
  now: number;
}) {
  // Synthesise 24h of poll history at the indicator's cadence.
  // Real impl reads this from the backend feed-status log.
  const history = useMemo(() => generateHistory(indicator, now), [indicator, now]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-neutral-900">
          {indicator.label}
        </span>
        <span className={`text-xs font-semibold ${STATE_TONE[indicator.state]}`}>
          {STATE_LABEL[indicator.state]}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-[140px_1fr] gap-y-1 text-[11px]">
        <dt className="text-neutral-500">Last refresh</dt>
        <dd className="font-mono text-neutral-800">
          {formatClock(indicator.lastRefresh)} ET
        </dd>
        <dt className="text-neutral-500">Polling cadence</dt>
        <dd className="font-mono text-neutral-800">
          every {indicator.pollSeconds}s
        </dd>
        <dt className="text-neutral-500">Last poll attempt</dt>
        <dd className="font-mono text-neutral-800">
          {formatClock(indicator.lastPollAttempt)} (
          {indicator.lastPollOk ? "success" : "fail"})
        </dd>
      </dl>
      <div className="mt-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Poll history
        </div>
        <div className="mt-1.5 flex flex-wrap gap-0.5" aria-label="24h poll history">
          {history.map((cell) => (
            <span
              key={cell.t}
              title={`${cell.label} — ${cell.ok ? "success" : "fail"}`}
              className={`inline-block h-2 w-2 rounded-sm ${
                cell.ok ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-neutral-400">
          <span>24h ago</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

interface PollCell {
  t: number;
  label: string;
  ok: boolean;
}

function generateHistory(indicator: HealthIndicator, now: number): PollCell[] {
  // Synthesise ~96 polls (every 15m for 24h) so the strip stays readable.
  const cells: PollCell[] = [];
  const step = 15 * 60 * 1000;
  const lastRefresh = new Date(indicator.lastRefresh).getTime();
  for (let i = 96; i > 0; i--) {
    const t = now - i * step;
    // After the last successful refresh, the success rate depends on state.
    const beyondLastRefresh = t > lastRefresh;
    const failRate =
      indicator.state === "failed"
        ? beyondLastRefresh
          ? 1
          : 0
        : indicator.state === "stale"
          ? beyondLastRefresh
            ? 0.5
            : 0
          : 0;
    const ok = pseudoRandom(t) > failRate;
    cells.push({
      t,
      label: new Date(t).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ok,
    });
  }
  return cells;
}

function pseudoRandom(seed: number): number {
  // Deterministic so the strip doesn't churn on every render.
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}
