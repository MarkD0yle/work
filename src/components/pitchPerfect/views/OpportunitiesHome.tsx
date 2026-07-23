import { OpportunityListView } from "./OpportunityListView";
import { NewOpportunityTab } from "./NewOpportunityTab";
import type { Opportunity } from "../../../lib/pitchPerfect/types";

export type BrowseTab = "opportunities" | "new";

const TABS: { id: BrowseTab; label: string }[] = [
  { id: "opportunities", label: "Opportunities" },
  { id: "new", label: "New Opportunity" },
];

/* The top-level "browse" screen — Opportunities and New Opportunity as tabs
 * on the page itself, rather than a modal popped over the list. */
export function OpportunitiesHome({
  tab,
  onTabChange,
  onOpen,
  onCreate,
}: {
  tab: BrowseTab;
  onTabChange: (t: BrowseTab) => void;
  onOpen: (id: string) => void;
  onCreate: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 bg-white px-6">
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition ${
                  active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "opportunities" ? (
          <OpportunityListView onOpen={onOpen} onNewOpportunity={() => onTabChange("new")} />
        ) : (
          <NewOpportunityTab onCreate={onCreate} onCancel={() => onTabChange("opportunities")} />
        )}
      </div>
    </div>
  );
}
