import { NARRATIVE_SECTION_DEFS } from "./narrative";
import { NARRATIVE_SECTION_ORDER } from "./opportunity";
import type { Capability, DeckSlide, KnowledgeItem, NarrativeSection, NarrativeSectionId, Opportunity, PitchAssets } from "./types";

/* Asset assembly — never invents content. Every deck slide, summary, and
 * talking point is assembled strictly from approved narrative content,
 * attached governed knowledge, and solution differentiators. */

export function canGenerateAssets(narrative: Record<NarrativeSectionId, NarrativeSection>): boolean {
  return NARRATIVE_SECTION_ORDER.every((id) => narrative[id].status === "approved");
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function generateAssets(
  opp: Opportunity,
  capabilitiesById: Record<string, Capability>,
  knowledgeById: Record<string, KnowledgeItem>,
): PitchAssets {
  const attachedKnowledge = opp.knowledgeAttachments.map((a) => knowledgeById[a.itemId]).filter((k): k is KnowledgeItem => Boolean(k));
  const proofItems = attachedKnowledge.filter((k) => k.category === "Proof point" || k.category === "Case study");
  const competitiveItems = attachedKnowledge.filter((k) => k.category === "Competitive guidance");

  const capabilityBullets = opp.solution
    .map((s) => capabilitiesById[s.capabilityId]?.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => `Recommended: ${name}`);

  const deckOutline: DeckSlide[] = NARRATIVE_SECTION_DEFS.map((def) => {
    const section = opp.narrative[def.id];
    const contentBullets = splitSentences(section.content);
    const extraBullets =
      def.id === "solutionStory" ? [...capabilityBullets, ...proofItems.slice(0, 2).map((k) => `${k.title}: ${k.summary}`)] : [];
    return { title: def.label, bullets: [...contentBullets, ...extraBullets], sourceNarrativeSectionId: def.id };
  });

  const proposalSummary = [opp.narrative.pointOfView.content, opp.narrative.coreMessage.content, opp.narrative.solutionStory.content]
    .filter(Boolean)
    .join(" ");
  const executiveSummary = [opp.narrative.coreMessage.content, opp.narrative.callToAction.content].filter(Boolean).join(" ");

  const talkingPoints = [
    ...opp.solution.map((s) => s.differentiation).filter((d) => d.trim().length > 0),
    ...competitiveItems.map((k) => k.summary),
  ];

  return {
    deckOutline,
    proposalSummary,
    executiveSummary,
    talkingPoints,
    generatedAt: new Date().toISOString(),
  };
}
