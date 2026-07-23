import { opportunityReadiness } from "../../lib/pitchPerfect/opportunity";
import type { Opportunity, TabId } from "../../lib/pitchPerfect/types";
import { ReadinessBadge } from "./ReadinessBadge";

export type WorkspaceScreen = "dashboard" | "preview" | TabId;

const TABS: { id: WorkspaceScreen; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "preview", label: "Your Pitch" },
  { id: "define", label: "Define" },
  { id: "intelligence", label: "Intelligence" },
  { id: "knowledge", label: "Knowledge" },
  { id: "solution", label: "Solution" },
  { id: "narrative", label: "Narrative" },
  { id: "assets", label: "Assets" },
  { id: "rehearse", label: "Rehearse" },
  { id: "outcome", label: "Outcome" },
];

const NO_READINESS: WorkspaceScreen[] = ["dashboard", "preview"];

export function OpportunityTabs({
  opportunity,
  screen,
  onSelect,
}: {
  opportunity: Opportunity;
  screen: WorkspaceScreen;
  onSelect: (t: WorkspaceScreen) => void;
}) {
  const readiness = opportunityReadiness(opportunity);
  return (
    <div className="border-b border-neutral-200 bg-white px-6">
      <nav className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.id === screen;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition ${
                active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {!NO_READINESS.includes(t.id) && <ReadinessBadge readiness={readiness[t.id as TabId]} />}
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
