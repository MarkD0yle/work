import { opportunityReadiness, overallReadinessFraction } from "../../lib/pitchPerfect/opportunity";
import { suggestNextSteps } from "../../lib/pitchPerfect/pitchSuggestions";
import type { Opportunity, TabId } from "../../lib/pitchPerfect/types";
import type { WorkspaceScreen } from "./OpportunityTabs";
import { ReadinessBadge } from "./ReadinessBadge";

type Tile = { tab: TabId; title: string; description: string };

const GROUPS: { label: string; tiles: Tile[] }[] = [
  {
    label: "Define",
    tiles: [{ tab: "define", title: "Opportunity Brief", description: "Client, scope, objective, attendees, and audience." }],
  },
  {
    label: "Research & Strategy",
    tiles: [
      { tab: "intelligence", title: "Intelligence Gathering", description: "Client objectives, pain points, stakeholders, and gap analysis." },
      { tab: "knowledge", title: "Governed Knowledge", description: "Browse and attach approved positioning, proof points, and guidance." },
      { tab: "solution", title: "Solution Design", description: "Map capabilities to pain points and competitive differentiation." },
    ],
  },
  {
    label: "Create & Refine",
    tiles: [
      { tab: "narrative", title: "Narrative Crafting", description: "Build the pitch story with rule-based AI review and coaching." },
      { tab: "assets", title: "Pitch Assets", description: "Generate a deck outline, proposal, and talking points from the approved narrative." },
    ],
  },
  {
    label: "Prepare & Deliver",
    tiles: [{ tab: "rehearse", title: "Rehearse", description: "Practice objection responses and get scored coaching feedback." }],
  },
  {
    label: "Learn & Improve",
    tiles: [{ tab: "outcome", title: "Capture Outcome", description: "Record client reactions, objections, win/loss, and lessons learned." }],
  },
];

export function Dashboard({ opportunity, onSelectScreen }: { opportunity: Opportunity; onSelectScreen: (screen: WorkspaceScreen) => void }) {
  const readiness = opportunityReadiness(opportunity);
  const { done, total } = overallReadinessFraction(opportunity);
  const suggestionCount = suggestNextSteps(opportunity).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <button
        type="button"
        onClick={() => onSelectScreen("preview")}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-900 to-neutral-800 p-5 text-left shadow-sm transition hover:shadow-md"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-widest text-white/50 uppercase">Live · updates as you build</div>
          <div className="mt-1 text-lg font-semibold text-white">Watch your pitch come together</div>
          <p className="mt-0.5 text-xs text-white/60">
            {done}/{total} sections ready · {suggestionCount === 0 ? "nothing outstanding" : `${suggestionCount} AI suggestion${suggestionCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900">Open Your Pitch →</span>
      </button>

      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">{group.label}</div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tiles.map((tile) => (
              <button
                key={tile.tab}
                type="button"
                onClick={() => onSelectScreen(tile.tab)}
                className="flex flex-col items-start gap-1.5 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{tile.title}</span>
                  <ReadinessBadge readiness={readiness[tile.tab]} />
                </div>
                <p className="text-xs text-neutral-500">{tile.description}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
