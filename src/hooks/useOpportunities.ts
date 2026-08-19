import { useSyncExternalStore } from "react";
import { opportunityRepo } from "../lib/pitchPerfect/repo";
import type { Opportunity } from "../lib/pitchPerfect/types";

export function useOpportunities(): Opportunity[] {
  return useSyncExternalStore(
    (cb) => opportunityRepo.subscribe(cb),
    () => opportunityRepo.snapshot(),
    () => opportunityRepo.snapshot(),
  );
}
