import { opportunityReadiness } from "../../lib/pitchPerfect/opportunity";
import type { Opportunity, TabId } from "../../lib/pitchPerfect/types";
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

export function Dashboard({ opportunity, onSelectTab }: { opportunity: Opportunity; onSelectTab: (tab: TabId) => void }) {
  const readiness = opportunityReadiness(opportunity);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">{group.label}</div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tiles.map((tile) => (
              <button
                key={tile.tab}
                type="button"
                onClick={() => onSelectTab(tile.tab)}
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
