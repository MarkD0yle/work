import { useState } from "react";
import Modal from "../../patterns/Modal";
import { KnowledgeBrowser } from "../KnowledgeBrowser";
import { KnowledgeItemCard } from "../KnowledgeItemCard";
import { AIInsightPanel } from "../AIInsightPanel";
import { AIPulseDot } from "../AIPulseDot";
import { KNOWLEDGE_LIBRARY } from "../../../lib/pitchPerfect/knowledgeData";
import { suggestKnowledgeForOpportunity } from "../../../lib/pitchPerfect/knowledgeSearch";
import { suggestNextSteps } from "../../../lib/pitchPerfect/pitchSuggestions";
import type { KnowledgeAttachmentRef, KnowledgeItem, Opportunity } from "../../../lib/pitchPerfect/types";

export function KnowledgeTab({
  opportunity,
  onSaveAttachments,
}: {
  opportunity: Opportunity;
  onSaveAttachments: (attachments: KnowledgeAttachmentRef[]) => void;
}) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const attachedIds = new Set(opportunity.knowledgeAttachments.map((a) => a.itemId));
  const attachedItems = opportunity.knowledgeAttachments
    .map((a) => KNOWLEDGE_LIBRARY.find((k) => k.id === a.itemId))
    .filter((k): k is KnowledgeItem => Boolean(k));
  const suggested = suggestKnowledgeForOpportunity(opportunity);
  const aiSuggestions = suggestNextSteps(opportunity).filter((s) => s.targetTab === "knowledge");

  function attach(item: KnowledgeItem) {
    onSaveAttachments([...opportunity.knowledgeAttachments, { itemId: item.id, attachedAt: new Date().toISOString() }]);
  }
  function detach(itemId: string) {
    onSaveAttachments(opportunity.knowledgeAttachments.filter((a) => a.itemId !== itemId));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <AIInsightPanel suggestions={aiSuggestions} emptyLabel="Enough is attached here for now — nothing to flag." />

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Governed knowledge</div>
            <p className="mt-0.5 text-xs text-neutral-500">
              Only approved, compliance-reviewed content. Browse and attach what's relevant — nothing here is user-authored.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBrowserOpen(true)}
            className="shrink-0 rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Browse & attach
          </button>
        </div>

        <div className="mt-4">
          {attachedItems.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">Nothing attached yet.</p>
          ) : (
            <div className="space-y-2">
              {attachedItems.map((item) => (
                <KnowledgeItemCard
                  key={item.id}
                  item={item}
                  action={
                    <button
                      type="button"
                      onClick={() => detach(item.id)}
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                    >
                      Detach
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <AIPulseDot active={suggested.length > 0} />
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">AI suggested for this opportunity</div>
          </div>
          <div className="mt-3 space-y-2">
            {suggested.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                item={item}
                action={
                  <button
                    type="button"
                    onClick={() => attach(item)}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                  >
                    Attach
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        title="Governed knowledge library"
        description="Search and attach approved content to this opportunity."
        size="xl"
      >
        <KnowledgeBrowser attachedIds={attachedIds} onAttach={attach} onDetach={detach} />
      </Modal>
    </div>
  );
}
