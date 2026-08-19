import { overallReadinessFraction } from "../../lib/pitchPerfect/opportunity";
import { suggestNextSteps, type PitchSuggestion } from "../../lib/pitchPerfect/pitchSuggestions";
import type { Opportunity, TabId } from "../../lib/pitchPerfect/types";
import { ReadinessGauge } from "./ReadinessGauge";
import { AIPulseDot } from "./AIPulseDot";

const TAB_LABELS: Record<TabId, string> = {
  define: "Define",
  intelligence: "Intelligence",
  knowledge: "Knowledge",
  solution: "Solution",
  narrative: "Narrative",
  assets: "Assets",
  rehearse: "Rehearse",
  outcome: "Outcome",
};

const PRIORITY_DOT: Record<PitchSuggestion["priority"], string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-neutral-300",
};

function SuggestionRow({
  suggestion,
  onNavigate,
  highlighted,
}: {
  suggestion: PitchSuggestion;
  onNavigate: (tab: TabId) => void;
  highlighted?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(suggestion.targetTab)}
        className={`flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition ${
          highlighted ? "border-sky-200 bg-sky-50 hover:bg-sky-100" : "border-neutral-200 bg-white hover:bg-neutral-50"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[suggestion.priority]}`} aria-hidden />
          <span className="text-xs font-medium text-neutral-900">{suggestion.label}</span>
        </span>
        <span className="text-[11px] text-neutral-500">{suggestion.detail}</span>
        {!highlighted && (
          <span className="text-[10px] font-medium text-neutral-400">{TAB_LABELS[suggestion.targetTab]} →</span>
        )}
      </button>
    </li>
  );
}

/* Persistent contextual panel — visible across every capability tab, not
 * re-rendered per tab. Shows overall pitch readiness plus AI suggestions,
 * with whatever's relevant to the tab you're currently on pinned to the top
 * and everything else grouped below, so it's contextual without hiding the
 * rest of the pitch's open items. */
export function ContextPanel({
  opportunity,
  activeTab,
  onNavigate,
}: {
  opportunity: Opportunity;
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
}) {
  const { done, total } = overallReadinessFraction(opportunity);
  const score = total > 0 ? (done / total) * 100 : 0;
  const suggestions = suggestNextSteps(opportunity);
  const here = suggestions.filter((s) => s.targetTab === activeTab);
  const elsewhere = suggestions.filter((s) => s.targetTab !== activeTab);

  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white p-4 lg:block">
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <ReadinessGauge value={score} />
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Pitch readiness</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-900">
            {done}/{total} sections ready
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <AIPulseDot active={suggestions.length > 0} />
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">AI suggestions</div>
        </div>

        {suggestions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nothing outstanding — this pitch is ready to deliver.</p>
        ) : (
          <>
            {here.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-semibold text-sky-700 uppercase">For {TAB_LABELS[activeTab]}</div>
                <ul className="mt-1.5 space-y-2">
                  {here.map((s) => (
                    <SuggestionRow key={s.id} suggestion={s} onNavigate={onNavigate} highlighted />
                  ))}
                </ul>
              </div>
            )}
            {elsewhere.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold text-neutral-400 uppercase">Elsewhere in this pitch</div>
                <ul className="mt-1.5 space-y-2">
                  {elsewhere.map((s) => (
                    <SuggestionRow key={s.id} suggestion={s} onNavigate={onNavigate} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
