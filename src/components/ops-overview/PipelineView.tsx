import { useMemo, useState } from "react";
import { useMonitorActions, type PipelineState, fetchMonitors } from "../../lib/qlik";
import PipelineRow from "./PipelineRow";
import type { ForensicScope } from "../../lib/forensic-scope";
import PipelineFilters from "../pipeline/PipelineFilters";
import PipelineFilterStatus from "../pipeline/PipelineFilterStatus";
import PipelineEmptyState from "../pipeline/PipelineEmptyState";
import { usePipelineFilters } from "../../hooks/usePipelineFilters";
import {
  applyPipelineFilters,
  EMPTY_FILTERS,
  suggestRemoval,
  type PipelineFilters as PipelineFiltersState,
} from "../../lib/pipeline-filters";
import type { QlikMonitor } from "../../lib/qlik";
import { useEffect } from "react";

/* Pipeline list — visualisation above the monitor sidebar.
 *
 * Filters: the seven-dimensional pipeline filter row (spec
 * "Pipeline Filter Row"). Composes serially with the page-level lens
 * (spec §4 — lens narrows what reaches this view; these filters narrow
 * further). */

export default function PipelineView({
  pipelines,
  onMonitorClick,
  onPipelineClick,
  onOpenForensic,
}: {
  pipelines: PipelineState[];
  onMonitorClick?: (monitorId: string) => void;
  onPipelineClick?: (pipelineId: string) => void;
  onOpenForensic?: (scope: ForensicScope) => void;
}) {
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const { filters, setFilters, clear } = usePipelineFilters(pipelines);
  const actions = useMonitorActions();

  // Monitors are needed to compute Status (New/Pending) — pulled from the
  // same fixture the page uses. In production this comes through a hook.
  const [monitors, setMonitors] = useState<QlikMonitor[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchMonitors("at-risk").then((m) => {
      if (!cancelled) setMonitors(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => applyPipelineFilters(pipelines, filters, monitors, actions),
    [pipelines, filters, monitors, actions],
  );

  const removalSuggestion = useMemo(
    () => suggestRemoval(pipelines, filters, monitors, actions),
    [pipelines, filters, monitors, actions],
  );

  function removeFilter(key: keyof PipelineFiltersState) {
    const v = filters[key];
    const next: PipelineFiltersState = { ...filters };
    if (Array.isArray(v)) (next as Record<string, unknown>)[key] = [];
    else if (typeof v === "boolean") (next as Record<string, unknown>)[key] = false;
    else (next as Record<string, unknown>)[key] = null;
    setFilters(next);
  }

  return (
    <section aria-label="Pipeline" className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Pipeline
        </h2>
        <div className="flex items-center gap-1 rounded-full border border-neutral-300 p-0.5 text-xs">
          {(["compact", "comfortable"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              className={`rounded-full px-2.5 py-0.5 capitalize transition ${
                density === d
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <PipelineFilters
        visiblePipelines={pipelines}
        filters={filters}
        onChange={setFilters}
      />
      <PipelineFilterStatus
        scopedCount={filtered.length}
        totalCount={pipelines.length}
        filters={filters}
        onClear={clear}
      />

      <div className="mt-3">
        {filtered.length === 0 && pipelines.length > 0 ? (
          <PipelineEmptyState
            filters={filters}
            suggestedRemoval={removalSuggestion}
            onRemoveFilter={removeFilter}
            onClearAll={clear}
          />
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
            No pipelines in scope.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p) => (
              <PipelineRow
                key={p.id}
                pipeline={p}
                density={density}
                onMonitorClick={onMonitorClick}
                onPipelineClick={onPipelineClick}
                onOpenForensic={onOpenForensic}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export { EMPTY_FILTERS };
