import { CAPABILITY_CATALOG } from "../../lib/pitchPerfect/capabilityData";
import { suggestCapabilitiesForPainPoint } from "../../lib/pitchPerfect/solutionMapping";
import type { PainPoint, SolutionItem } from "../../lib/pitchPerfect/types";
import { controlClass } from "../forms";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function SolutionMappingEditor({
  solution,
  painPoints,
  onChange,
}: {
  solution: SolutionItem[];
  painPoints: PainPoint[];
  onChange: (next: SolutionItem[]) => void;
}) {
  function update(i: number, patch: Partial<SolutionItem>) {
    onChange(solution.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function add() {
    onChange([
      ...solution,
      { id: genId("sol"), capabilityId: CAPABILITY_CATALOG[0].id, painPointId: painPoints[0]?.id ?? "", rationale: "", differentiation: "" },
    ]);
  }
  function remove(i: number) {
    onChange(solution.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {solution.map((item, i) => {
        const painPoint = painPoints.find((p) => p.id === item.painPointId);
        const suggestions = painPoint ? suggestCapabilitiesForPainPoint(painPoint) : CAPABILITY_CATALOG;
        return (
          <div key={item.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={item.painPointId} onChange={(e) => update(i, { painPointId: e.target.value })} className={controlClass(false)}>
                <option value="">Select pain point…</option>
                {painPoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select value={item.capabilityId} onChange={(e) => update(i, { capabilityId: e.target.value })} className={controlClass(false)}>
                {suggestions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={item.rationale}
              onChange={(e) => update(i, { rationale: e.target.value })}
              placeholder="Rationale — why this capability, for this pain point?"
              className={`${controlClass(false, "mt-2 min-h-[52px] resize-y")}`}
            />
            <textarea
              value={item.differentiation}
              onChange={(e) => update(i, { differentiation: e.target.value })}
              placeholder="Differentiation vs. competitors"
              className={`${controlClass(false, "mt-2 min-h-[52px] resize-y")}`}
            />
            <button type="button" onClick={() => remove(i)} className="mt-1.5 text-xs text-neutral-400 hover:text-rose-600">
              Remove
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        disabled={painPoints.length === 0}
        className="text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Map a pain point
      </button>
      {painPoints.length === 0 && <p className="text-xs text-neutral-400">Add pain points on the Intelligence tab first.</p>}
    </div>
  );
}
