import { useMemo, useState } from "react";
import { CAPABILITY_CATALOG } from "../../../lib/pitchPerfect/capabilityData";
import { KNOWLEDGE_LIBRARY } from "../../../lib/pitchPerfect/knowledgeData";
import { NARRATIVE_SECTION_DEFS, autoDraftNarrative, buildNarrativeSource, narrativeSourceHighlights } from "../../../lib/pitchPerfect/narrative";
import { improveNarrativeSection, reviewNarrativeSection } from "../../../lib/pitchPerfect/narrativeReview";
import { NARRATIVE_SECTION_ORDER } from "../../../lib/pitchPerfect/opportunity";
import type { NarrativeSection, NarrativeSectionId, Opportunity } from "../../../lib/pitchPerfect/types";
import { NarrativeRail } from "../NarrativeRail";
import { NarrativeEditor } from "../NarrativeEditor";
import { NarrativeReport } from "../NarrativeReport";
import { AIPulseDot } from "../AIPulseDot";
import { ReviewPanel } from "../../pitch/ReviewPanel";

const CAPABILITIES_BY_ID = Object.fromEntries(CAPABILITY_CATALOG.map((c) => [c.id, c]));
const KNOWLEDGE_BY_ID = Object.fromEntries(KNOWLEDGE_LIBRARY.map((k) => [k.id, k]));

/* Narrative — bespoke read (compiled report) ⇄ edit (rail + editor + AI
 * review) toggle, not the generic ReadEditSection: this needs the full
 * per-section workflow from the existing pitch-builder pattern, reused via
 * NarrativeRail/NarrativeEditor (adapted copies) and ReviewPanel (reused
 * as-is from components/pitch — it only depends on SectionReview/SectionStatus,
 * both shared with the pitch feature). */
export function NarrativeTab({
  opportunity,
  onSaveNarrative,
}: {
  opportunity: Opportunity;
  onSaveNarrative: (narrative: Record<NarrativeSectionId, NarrativeSection>) => void;
}) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [activeId, setActiveId] = useState<NarrativeSectionId>(NARRATIVE_SECTION_ORDER[0]);

  const source = useMemo(() => buildNarrativeSource(opportunity, CAPABILITIES_BY_ID, KNOWLEDGE_BY_ID), [opportunity]);
  const hasAnyDraft = NARRATIVE_SECTION_ORDER.some((id) => opportunity.narrative[id].content.trim().length > 0);

  function updateSection(id: NarrativeSectionId, patch: Partial<NarrativeSection>) {
    onSaveNarrative({ ...opportunity.narrative, [id]: { ...opportunity.narrative[id], ...patch } });
  }

  function draftAll() {
    const next = { ...opportunity.narrative };
    for (const id of NARRATIVE_SECTION_ORDER) {
      if (!next[id].content.trim()) {
        next[id] = { ...next[id], content: autoDraftNarrative(id, source), status: "drafted" };
      }
    }
    onSaveNarrative(next);
  }

  if (mode === "read") {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Narrative</h2>
            <p className="mt-0.5 text-xs text-neutral-500">The pitch story — point of view through call to action.</p>
          </div>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Edit narrative
          </button>
        </div>
        <NarrativeReport opportunity={opportunity} />
      </div>
    );
  }

  const activeDef = NARRATIVE_SECTION_DEFS.find((d) => d.id === activeId)!;
  const activeSection = opportunity.narrative[activeId];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AIPulseDot active={activeSection.status !== "approved"} />
            <h2 className="text-sm font-semibold text-neutral-900">Editing narrative</h2>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">AI reviews each beat as you draft it — approve once it reads right.</p>
        </div>
        <div className="flex items-center gap-2">
          {!hasAnyDraft && (
            <button
              type="button"
              onClick={draftAll}
              className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Auto-draft all sections
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode("read")}
            className="rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Done editing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <NarrativeRail defs={NARRATIVE_SECTION_DEFS} sections={opportunity.narrative} activeId={activeId} onSelect={setActiveId} />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <NarrativeEditor
              def={activeDef}
              content={activeSection.content}
              onChange={(content) =>
                updateSection(activeId, { content, status: content.trim() ? "drafted" : "empty", review: null })
              }
              facts={narrativeSourceHighlights(activeId, source)}
            />
          </section>

          <ReviewPanel
            review={activeSection.review}
            status={activeSection.status}
            aiPasses={activeSection.aiPasses}
            hasContent={activeSection.content.trim().length > 0}
            onRunReview={() =>
              updateSection(activeId, { review: reviewNarrativeSection(activeId, activeSection.content, source), status: "reviewed" })
            }
            onImprove={() => {
              if (!activeSection.review) return;
              const improved = improveNarrativeSection(activeId, activeSection.content, source, activeSection.review);
              updateSection(activeId, {
                content: improved,
                review: reviewNarrativeSection(activeId, improved, source),
                status: "reviewed",
                aiPasses: activeSection.aiPasses + 1,
              });
            }}
            onApprove={() => updateSection(activeId, { status: "approved" })}
          />
        </div>
      </div>
    </div>
  );
}
