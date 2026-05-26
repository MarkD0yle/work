import { useSyncExternalStore } from "react";
import { savedViewsRepo, type SavedView } from "../lib/saved-views";

export function useSavedViews(): SavedView[] {
  return useSyncExternalStore(
    (cb) => savedViewsRepo.subscribe(cb),
    () => savedViewsRepo.snapshot(),
    () => savedViewsRepo.snapshot(),
  );
}
