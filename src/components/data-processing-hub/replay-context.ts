import { createContext, useContext } from "react";
import type { Load, ReplayRun } from "./model";

/* Replay state for the Data Processing Hub, shared by its four views.
 * Held in memory by ReplayProvider for the session; nothing is persisted. */

export type ReplayApi = {
  /** Every replay started this session, oldest first. */
  runs: ReplayRun[];
  /** Starts a replay of a whole file or load. Returns false, and does nothing,
   * when that load already has a replay in flight. */
  start: (load: Load) => boolean;
  /** Stops every running replay and clears the session. */
  reset: () => void;
};

export const ReplayContext = createContext<ReplayApi | null>(null);

export function useReplay(): ReplayApi {
  const api = useContext(ReplayContext);
  if (!api) throw new Error("useReplay must be used inside <ReplayProvider>");
  return api;
}
