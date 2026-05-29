import { useMemo } from "react";
import {
  EMPTY_FILTERS,
  deriveFilterOptions,
  type PipelineFilters,
} from "../../lib/pipeline-filters";
import type { BmType, PipelineState } from "../../lib/qlik";
import PipelineFilterDropdown from "./PipelineFilterDropdown";
import OptionCheckboxes from "./OptionCheckboxes";
import StatusToggle from "./StatusToggle";

/* Spec §1 — pipeline filter row.
 *
 * Seven controls left-to-right:
 *   1. Client (multi)
 *   2. Mandate (multi)
 *   3. Option A / B (independent checkboxes)
 *   4. BM Type (multi)
 *   5. Username (multi)
 *   6. Process (multi)
 *   7. Status (segmented New / Pending, deselect to clear)
 *
 * Spec §3.6 — dropdown options come from currently-visible data (the
 * `visiblePipelines` prop), not the full universe. */

export default function PipelineFilters({
  visiblePipelines,
  filters,
  onChange,
}: {
  visiblePipelines: PipelineState[];
  filters: PipelineFilters;
  onChange: (next: PipelineFilters) => void;
}) {
  const options = useMemo(
    () => deriveFilterOptions(visiblePipelines),
    [visiblePipelines],
  );

  function patch(p: Partial<PipelineFilters>) {
    onChange({ ...filters, ...p });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50/50 px-3 py-2">
      <PipelineFilterDropdown
        label="Client"
        options={options.clients}
        selected={filters.clients}
        onApply={(clients) => patch({ clients })}
      />
      <PipelineFilterDropdown
        label="Mandate"
        options={options.mandates}
        selected={filters.mandates}
        onApply={(mandates) => patch({ mandates })}
      />
      <OptionCheckboxes
        optionA={filters.optionA}
        optionB={filters.optionB}
        onChange={({ optionA, optionB }) => patch({ optionA, optionB })}
      />
      <PipelineFilterDropdown
        label="BM Type"
        options={options.bmTypes as string[]}
        selected={filters.bmTypes as string[]}
        onApply={(bmTypes) => patch({ bmTypes: bmTypes as BmType[] })}
        showSearch={false}
      />
      <PipelineFilterDropdown
        label="Username"
        options={options.usernames}
        selected={filters.usernames}
        onApply={(usernames) => patch({ usernames })}
        showSearch={false}
      />
      <PipelineFilterDropdown
        label="Process"
        options={options.processes}
        selected={filters.processes}
        onApply={(processes) => patch({ processes })}
      />
      <StatusToggle
        value={filters.status}
        onChange={(status) => patch({ status })}
      />
    </div>
  );
}

export { EMPTY_FILTERS };
