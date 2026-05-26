import { useEffect, useMemo, useState } from "react";
import {
  effectiveState,
  fetchMonitors,
  ME,
  type OperationalState,
  type QlikMonitor,
  useMonitorActions,
} from "../lib/qlik";
import QueueRow from "../components/my-queue/QueueRow";

export const title = "My Queue";
export const fullWidth = true;

/* Spec §2.5 — My Queue
 *
 * Filter: red/amber AND
 *         (no ack yet) OR (acked by me) OR (handed off to me)
 *
 * This is the personal "what needs me" view. NOT the same shape as the
 * overview — the overview is for situational awareness; the queue is for
 * action. Compact, owner-centric, action-first.
 *
 * Reads fixture from URL ?state= so the same mock day drives both pages. */

function readUrlState(): OperationalState {
  if (typeof window === "undefined") return "at-risk";
  const raw = new URLSearchParams(window.location.search).get("state");
  if (raw === "clean" || raw === "at-risk" || raw === "broken") return raw;
  return "at-risk";
}

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyQueue() {
  const [fixtureKey] = useState<OperationalState>(() => readUrlState());
  const [now, setNow] = useState(() => Date.now());
  const [monitors, setMonitors] = useState<QlikMonitor[]>([]);
  const actions = useMonitorActions();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMonitors(fixtureKey).then((m) => {
      if (!cancelled) setMonitors(m);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureKey]);

  const queued = useMemo(() => {
    const out: { monitor: QlikMonitor; ownerLabel: string }[] = [];
    for (const m of monitors) {
      if (m.status !== "red" && m.status !== "amber") continue;
      const e = effectiveState(m, actions);
      if (e.kind === "unacked") {
        out.push({ monitor: m, ownerLabel: "Unowned — yours to take" });
      } else if (e.kind === "acked" && e.actor === ME) {
        out.push({ monitor: m, ownerLabel: `Acked by you at ${formatClock(new Date(e.at).getTime())}` });
      }
    }
    // Unowned first, then by status severity, then by oldest refresh.
    out.sort((a, b) => {
      const aOwned = !a.ownerLabel.startsWith("Unowned");
      const bOwned = !b.ownerLabel.startsWith("Unowned");
      if (aOwned !== bOwned) return aOwned ? 1 : -1;
      if (a.monitor.status !== b.monitor.status) {
        return a.monitor.status === "red" ? -1 : 1;
      }
      return a.monitor.lastRefresh.localeCompare(b.monitor.lastRefresh);
    });
    return out;
  }, [monitors, actions]);

  const totalActive = monitors.filter(
    (m) => m.status === "red" || m.status === "amber",
  ).length;
  const minePct =
    totalActive === 0 ? 0 : Math.round((queued.length / totalActive) * 100);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">My Queue</span>
          <span className="text-sm text-neutral-400">·</span>
          <span className="text-sm text-neutral-500">{ME}</span>
          <span className="font-mono text-sm text-neutral-500">
            · {formatClock(now)} EST
          </span>
        </div>
        <span className="ml-auto text-xs text-neutral-500">
          {queued.length} of {totalActive} active monitors ({minePct}%)
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-8 py-6">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900">
            What needs me
          </h1>
          <p className="mb-5 text-sm text-neutral-600">
            Red and amber monitors that are unowned or acknowledged by you.
            Hand off, resolve, or add a note from here without leaving the page.
          </p>

          {queued.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-5 py-6 text-center text-sm text-neutral-500">
              <div className="text-xl text-neutral-400">✓</div>
              <p className="mt-1">Nothing in your queue.</p>
              <p className="mt-0.5 text-xs text-neutral-400">
                {totalActive === 0
                  ? "All monitors clean."
                  : `${totalActive} active monitor${
                      totalActive === 1 ? "" : "s"
                    } owned elsewhere.`}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {queued.map(({ monitor, ownerLabel }) => (
                <QueueRow
                  key={monitor.id}
                  monitor={monitor}
                  actions={actions}
                  now={now}
                  ownerLabel={ownerLabel}
                />
              ))}
            </ul>
          )}

          <div className="mt-10 border-t border-neutral-200 pt-4 text-[11px] text-neutral-400">
            <p>
              Spec §2.5 · filter: red/amber AND (unacked OR acked-by-me OR
              handoff-to-me). Pages share action state via the module-level
              actions store — acks made on the Ops Overview show up here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
