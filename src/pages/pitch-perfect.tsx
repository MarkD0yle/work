import { useState } from "react";
import { useOpportunities } from "../hooks/useOpportunities";
import { opportunityRepo } from "../lib/pitchPerfect/repo";
import type { Opportunity } from "../lib/pitchPerfect/types";
import { GlobalHeader } from "../components/pitchPerfect/GlobalHeader";
import { OpportunitiesHome, type BrowseTab } from "../components/pitchPerfect/views/OpportunitiesHome";
import { WorkspaceView } from "../components/pitchPerfect/views/WorkspaceView";
import { InsightsView } from "../components/pitchPerfect/InsightsView";

export const title = "Pitch Perfect";
export const fullWidth = true;

/* Pitch Perfect — the opportunity-centric MVP: define → gather intelligence →
 * pull governed knowledge → design a solution → craft a narrative → generate
 * assets → rehearse → capture the outcome, plus a cross-opportunity Insights
 * view. A persistent header (client → opportunity selection) sits above
 * every screen — that pair is the entry point into the whole flow, not just
 * a one-time card pick — with a per-opportunity Dashboard of module tiles as
 * the landing view once one is selected. */

type Screen = "browse" | "workspace" | "insights";

export default function PitchPerfectPage() {
  const opportunities = useOpportunities();
  const [clientId, setClientId] = useState<string | null>(null);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("browse");
  const [browseTab, setBrowseTab] = useState<BrowseTab>("opportunities");

  const selected = opportunityId ? (opportunities.find((o) => o.id === opportunityId) ?? null) : null;

  function openOpportunity(opp: Opportunity) {
    setClientId(opp.clientId);
    setOpportunityId(opp.id);
    setScreen("workspace");
  }

  function handleSelectClient(id: string | null) {
    setClientId(id);
    const first = id ? opportunities.find((o) => o.clientId === id) : undefined;
    setOpportunityId(first ? first.id : null);
    setScreen(first ? "workspace" : "browse");
  }

  function handleSelectOpportunity(id: string) {
    const opp = opportunities.find((o) => o.id === id);
    if (opp) openOpportunity(opp);
  }

  function handleOpenById(id: string) {
    const opp = opportunities.find((o) => o.id === id);
    if (opp) openOpportunity(opp);
  }

  function handleCreate(opportunity: Opportunity) {
    opportunityRepo.save(opportunity);
    setBrowseTab("opportunities");
    openOpportunity(opportunity);
  }

  function goBrowse() {
    setScreen("browse");
    setBrowseTab("opportunities");
  }

  function startNewOpportunity() {
    setScreen("browse");
    setBrowseTab("new");
  }

  return (
    <div className="flex h-full flex-col">
      <GlobalHeader
        clientId={clientId}
        opportunityId={opportunityId}
        opportunities={opportunities}
        onSelectClient={handleSelectClient}
        onSelectOpportunity={handleSelectOpportunity}
        onNewOpportunity={startNewOpportunity}
        onBrowseAll={goBrowse}
        onInsights={() => setScreen("insights")}
      />
      <div className="min-h-0 flex-1">
        {screen === "insights" && <InsightsView onBack={() => setScreen(selected ? "workspace" : "browse")} />}
        {screen === "workspace" && selected && <WorkspaceView key={selected.id} opportunity={selected} />}
        {screen === "browse" && (
          <OpportunitiesHome tab={browseTab} onTabChange={setBrowseTab} onOpen={handleOpenById} onCreate={handleCreate} />
        )}
      </div>
    </div>
  );
}
