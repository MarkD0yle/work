import { checkIntelligenceGaps } from "./intelligenceGaps";
import { unmappedPainPoints } from "./solutionMapping";
import { canGenerateAssets } from "./assets";
import { NARRATIVE_SECTION_ORDER } from "./opportunity";
import type { Opportunity, TabId } from "./types";

/* The single "what should I do next" engine — feeds the live Pitch Preview
 * tab's suggestions strip. Each suggestion points at the tab that resolves
 * it, so acting on a suggestion is one click, not a scavenger hunt. Ordered
 * roughly in build sequence (define → intelligence → knowledge → solution →
 * narrative → assets → rehearse), same deterministic-rules spirit as the
 * narrative reviewer and rehearsal scorer — nothing here calls a real model. */

export type PitchSuggestion = {
  id: string;
  label: string;
  detail: string;
  targetTab: TabId;
  priority: "high" | "medium" | "low";
};

export function suggestNextSteps(opp: Opportunity): PitchSuggestion[] {
  const out: PitchSuggestion[] = [];
  const { intelligence: intel } = opp;

  if (!opp.objective.trim()) {
    out.push({
      id: "define-objective",
      label: "State the objective",
      detail: "What is this specific pitch trying to achieve? Everything downstream reads better once this is set.",
      targetTab: "define",
      priority: "high",
    });
  }

  const gaps = checkIntelligenceGaps(intel);
  const missingPainPoints = gaps.find((g) => g.key === "pain-points" && !g.pass);
  if (missingPainPoints) {
    out.push({
      id: "intel-pain-points",
      label: "Capture a pain point",
      detail: "Add at least one specific client challenge — the narrative and solution both need something concrete to address.",
      targetTab: "intelligence",
      priority: "high",
    });
  }
  const missingDecisionMaker = gaps.find((g) => g.key === "decision-maker" && !g.pass);
  if (missingDecisionMaker && intel.stakeholders.length > 0) {
    out.push({
      id: "intel-decision-maker",
      label: "Identify the decision maker",
      detail: "You've mapped stakeholders, but none is flagged as the actual decision maker yet.",
      targetTab: "intelligence",
      priority: "medium",
    });
  }
  const unknownThreat = gaps.find((g) => g.key === "competitive-threat" && !g.pass);
  if (unknownThreat) {
    out.push({
      id: "intel-competitive",
      label: "Assess the competitive threat",
      detail: "Threat level is still Unknown — set it so Solution and Rehearse can react to it.",
      targetTab: "intelligence",
      priority: "medium",
    });
  }

  if (opp.knowledgeAttachments.length === 0 && intel.painPoints.length > 0) {
    out.push({
      id: "knowledge-attach",
      label: "Attach supporting proof",
      detail: "Nothing governed is attached yet — a proof point or case study makes the story credible, not just asserted.",
      targetTab: "knowledge",
      priority: "medium",
    });
  }

  const unmapped = unmappedPainPoints(intel, opp.solution);
  if (unmapped.length > 0) {
    out.push({
      id: "solution-unmapped",
      label: `Map ${unmapped.length === 1 ? "the remaining pain point" : `${unmapped.length} remaining pain points`}`,
      detail: `"${unmapped[0].label}" isn't tied to a capability yet.`,
      targetTab: "solution",
      priority: "high",
    });
  }
  const weakDifferentiation = opp.solution.find((s) => !s.differentiation.trim());
  if (weakDifferentiation) {
    out.push({
      id: "solution-differentiation",
      label: "Add a differentiator",
      detail: "At least one recommendation doesn't say how it beats the alternative — without that it reads as generic.",
      targetTab: "solution",
      priority: "medium",
    });
  }

  const narrativeSections = NARRATIVE_SECTION_ORDER.map((id) => opp.narrative[id]);
  const allEmpty = narrativeSections.every((s) => s.status === "empty");
  const anyNeedsReview = narrativeSections.some((s) => s.status === "drafted");
  const anyNeedsRework = narrativeSections.some((s) => s.review && s.review.suggestions.length > 0 && s.status !== "approved");
  if (allEmpty && opp.solution.length > 0) {
    out.push({
      id: "narrative-start",
      label: "Start the narrative",
      detail: "Solution's in place — turn it into a story: point of view, core message, and a call to action.",
      targetTab: "narrative",
      priority: "high",
    });
  } else if (anyNeedsReview) {
    out.push({
      id: "narrative-review",
      label: "Run AI review on drafted sections",
      detail: "Some sections are drafted but haven't been checked yet.",
      targetTab: "narrative",
      priority: "medium",
    });
  } else if (anyNeedsRework) {
    out.push({
      id: "narrative-rework",
      label: "Resolve outstanding review feedback",
      detail: "A reviewed section still has open suggestions — close the gap or approve once it reads right.",
      targetTab: "narrative",
      priority: "medium",
    });
  }

  if (canGenerateAssets(opp.narrative) && !opp.assets) {
    out.push({
      id: "assets-generate",
      label: "Generate your pitch assets",
      detail: "The narrative is fully approved — the deck outline, summary, and talking points are ready to assemble.",
      targetTab: "assets",
      priority: "high",
    });
  }

  if (opp.rehearsal.length === 0 && canGenerateAssets(opp.narrative)) {
    out.push({
      id: "rehearse-start",
      label: "Rehearse before the meeting",
      detail: "Practice responses to the objections most likely to come up.",
      targetTab: "rehearse",
      priority: "medium",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}
