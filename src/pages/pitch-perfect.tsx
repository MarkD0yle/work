import { useState } from "react";
import { useOpportunities } from "../hooks/useOpportunities";
import { opportunityRepo } from "../lib/pitchPerfect/repo";
import type { Opportunity } from "../lib/pitchPerfect/types";
import { GlobalHeader } from "../components/pitchPerfect/GlobalHeader";
import { NewOpportunityForm } from "../components/pitchPerfect/NewOpportunityForm";
import { OpportunityListView } from "../components/pitchPerfect/views/OpportunityListView";
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
  const [modalOpen, setModalOpen] = useState(false);

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
    setModalOpen(false);
    openOpportunity(opportunity);
  }

  return (
    <div className="flex h-full flex-col">
      <GlobalHeader
        clientId={clientId}
        opportunityId={opportunityId}
        opportunities={opportunities}
        onSelectClient={handleSelectClient}
        onSelectOpportunity={handleSelectOpportunity}
        onNewOpportunity={() => setModalOpen(true)}
        onBrowseAll={() => setScreen("browse")}
        onInsights={() => setScreen("insights")}
      />
      <div className="min-h-0 flex-1">
        {screen === "insights" && <InsightsView onBack={() => setScreen(selected ? "workspace" : "browse")} />}
        {screen === "workspace" && selected && <WorkspaceView key={selected.id} opportunity={selected} />}
        {screen === "browse" && <OpportunityListView onOpen={handleOpenById} onNewOpportunity={() => setModalOpen(true)} />}
      </div>
      <NewOpportunityForm open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} />
    </div>
  );
}
