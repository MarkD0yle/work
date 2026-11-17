import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "../patterns";
import { SOURCES, type Load, type ReplayRun, type ReplayStatus } from "./model";
import { ReplayContext, type ReplayApi } from "./replay-context";

/* ReplayProvider — simulates the replay service.
 *
 * A replay moves Submitted → Accepted → Queued → In Progress and then ends
 * Completed or Failed. There is no backend, so each step is a timer. The
 * provider also enforces the one rule that matters: a load with a replay in
 * flight cannot be replayed again. The check uses a ref, not state, so two
 * clicks in the same tick cannot both get through. */

/** Milliseconds spent in each step before moving to the next. */
const STEP_MS = [1200, 1600, 2600, 4500];

const clock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

export function ReplayProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [runs, setRuns] = useState<ReplayRun[]>([]);
  const inFlight = useRef(new Set<string>());
  const attempts = useRef(new Map<string, number>());
  const timers = useRef(new Set<number>());
  const counter = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
      pending.clear();
    };
  }, []);

  const start = useCallback(
    (load: Load) => {
      if (inFlight.current.has(load.id)) return false;
      inFlight.current.add(load.id);

      const attempt = attempts.current.get(load.id) ?? 0;
      attempts.current.set(load.id, attempt + 1);
      const outcome = load.replayOutcomes[Math.min(attempt, load.replayOutcomes.length - 1)];

      counter.current += 1;
      const id = `RPL-${String(counter.current).padStart(4, "0")}`;
      const steps: ReplayStatus[] = ["Accepted", "Queued", "In Progress", outcome];
      setRuns((list) => [...list, { id, loadId: load.id, status: "Submitted", history: [{ status: "Submitted", at: clock() }] }]);

      const advance = (i: number) => {
        const t = window.setTimeout(() => {
          timers.current.delete(t);
          const status = steps[i];
          const at = clock();
          setRuns((list) => list.map((r) => (r.id === id ? { ...r, status, history: [...r.history, { status, at }] } : r)));
          if (i < steps.length - 1) {
            advance(i + 1);
            return;
          }
          inFlight.current.delete(load.id);
          const unit = SOURCES[load.source].unit;
          if (status === "Completed") {
            toast.show({ tone: "positive", title: `Replay completed: ${load.id}`, description: `The ${unit} was reprocessed. Check its failed count for anything still open.` });
          } else {
            toast.show({ tone: "negative", title: `Replay failed: ${load.id}`, description: `Nothing was changed. You can replay the ${unit} again.` });
          }
        }, STEP_MS[i]);
        timers.current.add(t);
      };
      advance(0);
      return true;
    },
    [toast],
  );

  const reset = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current.clear();
    inFlight.current.clear();
    attempts.current.clear();
    setRuns([]);
  }, []);

  const api = useMemo<ReplayApi>(() => ({ runs, start, reset }), [runs, start, reset]);

  return <ReplayContext.Provider value={api}>{children}</ReplayContext.Provider>;
}
