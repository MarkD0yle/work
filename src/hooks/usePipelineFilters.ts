import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_FILTERS,
  readUrlFilters,
  writeUrlFilters,
  type PipelineFilters,
} from "../lib/pipeline-filters";
import type { PipelineState } from "../lib/qlik";

/* Spec §3.2 — pipeline filter state + URL param sync. Cross-session: no
 * persistence by default (saved views are the mechanism). */
export function usePipelineFilters(allPipelines: PipelineState[]) {
  // Read URL filters once on mount. We seed from URL only after we have
  // enough pipeline data to resolve slug → real values.
  const seeded = useRef(false);
  const [filters, setFilters] = useState<PipelineFilters>(EMPTY_FILTERS);

  useEffect(() => {
    if (seeded.current) return;
    if (allPipelines.length === 0) return;
    const fromUrl = readUrlFilters(allPipelines);
    setFilters(fromUrl);
    seeded.current = true;
  }, [allPipelines]);

  useEffect(() => {
    if (!seeded.current) return;
    writeUrlFilters(filters);
  }, [filters]);

  const set = useCallback((next: PipelineFilters) => setFilters(next), []);
  const clear = useCallback(() => setFilters(EMPTY_FILTERS), []);

  return { filters, setFilters: set, clear };
}
