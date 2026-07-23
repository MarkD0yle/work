import { AIPulseDot } from "./AIPulseDot";
import type { PitchSuggestion } from "../../lib/pitchPerfect/pitchSuggestions";

/* Per-section presence of the same suggestions engine that drives Your
 * Pitch — filtered to just this tab's suggestions, so every section visibly
 * shows AI actively looking at its own data, not just a passive form. */
export function AIInsightPanel({
  suggestions,
  emptyLabel = "Looks good — nothing outstanding here.",
}: {
  suggestions: PitchSuggestion[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <AIPulseDot active={suggestions.length > 0} />
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">AI is reviewing this section</div>
      </div>
      {suggestions.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-900">{s.label}</span>
                <span className="block text-xs text-neutral-500">{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
