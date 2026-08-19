import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { opportunityRepo } from "../../../lib/pitchPerfect/repo";
import type { Opportunity } from "../../../lib/pitchPerfect/types";
import { OpportunityHeader } from "../OpportunityHeader";
import { OpportunityTabs, type WorkspaceScreen } from "../OpportunityTabs";
import { ContextPanel } from "../ContextPanel";
import { Dashboard } from "../Dashboard";
import { DefineTab } from "../tabs/DefineTab";
import { IntelligenceTab } from "../tabs/IntelligenceTab";
import { KnowledgeTab } from "../tabs/KnowledgeTab";
import { SolutionTab } from "../tabs/SolutionTab";
import { NarrativeTab } from "../tabs/NarrativeTab";
import { AssetsTab } from "../tabs/AssetsTab";
import { RehearseTab } from "../tabs/RehearseTab";
import { OutcomeTab } from "../tabs/OutcomeTab";
import { PitchPreviewTab } from "../tabs/PitchPreviewTab";

/* The opportunity workspace: a persistent header + tab strip (with a
 * leading Dashboard entry) over the 8 capability tabs. Defaults to the
 * Dashboard — a module-tile landing view — rather than dropping straight
 * into Define, matching the reference entry-point pattern. Pass a `key`
 * keyed on opportunity.id from the caller so switching opportunities resets
 * back to the Dashboard instead of preserving the previous tab.
 *
 * The 8 capability tabs also get a persistent ContextPanel on the right —
 * readiness gauge + AI suggestions, contextual to whichever tab is active —
 * rather than each tab re-rendering its own suggestions banner. Dashboard
 * and Your Pitch already show this information as their primary content, so
 * the panel is skipped there to avoid showing it twice. */
export function WorkspaceView({ opportunity }: { opportunity: Opportunity }) {
  const [screen, setScreen] = useState<WorkspaceScreen>("dashboard");

  function patch(partial: Partial<Opportunity>) {
    opportunityRepo.save({ ...opportunity, ...partial, updatedAt: new Date().toISOString() });
  }

  const showContextPanel = screen !== "dashboard" && screen !== "preview";

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <OpportunityHeader opportunity={opportunity} />
      <OpportunityTabs opportunity={opportunity} screen={screen} onSelect={setScreen} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {screen === "dashboard" && <Dashboard opportunity={opportunity} onSelectScreen={setScreen} />}
              {screen === "preview" && <PitchPreviewTab opportunity={opportunity} onNavigate={setScreen} />}
              {screen === "define" && <DefineTab opportunity={opportunity} onSave={(fields) => patch(fields)} />}
              {screen === "intelligence" && (
                <IntelligenceTab opportunity={opportunity} onSaveIntelligence={(intelligence) => patch({ intelligence })} />
              )}
              {screen === "knowledge" && (
                <KnowledgeTab opportunity={opportunity} onSaveAttachments={(knowledgeAttachments) => patch({ knowledgeAttachments })} />
              )}
              {screen === "solution" && <SolutionTab opportunity={opportunity} onSaveSolution={(solution) => patch({ solution })} />}
              {screen === "narrative" && <NarrativeTab opportunity={opportunity} onSaveNarrative={(narrative) => patch({ narrative })} />}
              {screen === "assets" && <AssetsTab opportunity={opportunity} onSaveAssets={(assets) => patch({ assets })} />}
              {screen === "rehearse" && <RehearseTab opportunity={opportunity} onSaveRehearsal={(rehearsal) => patch({ rehearsal })} />}
              {screen === "outcome" && <OutcomeTab opportunity={opportunity} onSaveOutcome={(outcome) => patch({ outcome })} />}
            </motion.div>
          </AnimatePresence>
        </div>
        {showContextPanel && <ContextPanel opportunity={opportunity} activeTab={screen} onNavigate={setScreen} />}
      </div>
    </div>
  );
}
