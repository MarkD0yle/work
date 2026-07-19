import { useSyncExternalStore } from "react";
import { pitchLibraryRepo } from "../lib/pitch/repo";
import type { Pitch } from "../lib/pitch/types";

export function usePitchLibrary(): Pitch[] {
  return useSyncExternalStore(
    (cb) => pitchLibraryRepo.subscribe(cb),
    () => pitchLibraryRepo.snapshot(),
    () => pitchLibraryRepo.snapshot(),
  );
}
