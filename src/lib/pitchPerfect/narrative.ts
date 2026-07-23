import { CLIENTS } from "../pitch/data";
import type {
  Capability,
  KnowledgeItem,
  NarrativeSectionId,
  NarrativeSourceData,
  Opportunity,
  PainPoint,
} from "./types";

/* Narrative auto-draft + source-highlights, adapted from lib/pitch/sections.ts
 * for Pitch Perfect's five narrative beats (point of view → core message →
 * problem/impact → solution story → call to action — a Decker/Miller-Heiman
 * -style structure). Sources from intelligence + solution + attached
 * knowledge instead of the old InternalData CRM shape. */

export type NarrativeSectionDef = { id: NarrativeSectionId; label: string; help: string; minWords: number };

export const NARRATIVE_SECTION_DEFS: NarrativeSectionDef[] = [
  { id: "pointOfView", label: "Point of view", help: "Why change, why now — the lens the whole pitch is told through.", minWords: 20 },
  { id: "coreMessage", label: "Core message", help: "The one-sentence synthesis the audience should remember.", minWords: 12 },
  { id: "problemImpact", label: "Problem & impact", help: "The client's pain, made concrete and costed.", minWords: 25 },
  { id: "solutionStory", label: "Solution story", help: "The specific capability and why it wins vs. alternatives.", minWords: 25 },
  { id: "callToAction", label: "Call to action", help: "A specific, concrete next step.", minWords: 12 },
];

function severityRank(s: PainPoint["severity"]): number {
  return s === "High" ? 2 : s === "Medium" ? 1 : 0;
}

function topPainPoint(source: NarrativeSourceData): PainPoint | undefined {
  return [...source.painPoints].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
}

export function buildNarrativeSource(
  opp: Opportunity,
  capabilitiesById: Record<string, Capability>,
  knowledgeById: Record<string, KnowledgeItem>,
): NarrativeSourceData {
  const attachedKnowledge = opp.knowledgeAttachments
    .map((a) => knowledgeById[a.itemId])
    .filter((k): k is KnowledgeItem => Boolean(k));
  return {
    client: CLIENTS.find((c) => c.id === opp.clientId) ?? CLIENTS[0],
    objective: opp.objective,
    painPoints: opp.intelligence.painPoints,
    solution: opp.solution,
    capabilitiesById,
    attachedKnowledge,
    competitive: opp.intelligence.competitive,
  };
}

// The auto-draft deliberately doesn't cite differentiation in solutionStory:
// leaving it out lets the narrative review's "cites differentiation" check
// genuinely fail on a fresh draft, same as lib/pitch/sections.ts does for the
// pitch objective — see narrativeReview.ts.
export function autoDraftNarrative(id: NarrativeSectionId, source: NarrativeSourceData): string {
  const { client, painPoints, solution, capabilitiesById } = source;
  const name = client.name;
  const top = topPainPoint(source);

  switch (id) {
    case "pointOfView":
      return top
        ? `${name} is dealing with ${top.label.toLowerCase()} right now, and the current environment makes this the moment to address it rather than wait.`
        : `${name}'s priorities have shifted, and the current environment makes this the moment to revisit the plan rather than wait.`;
    case "coreMessage":
      return top
        ? `${name} can close the gap on ${top.label.toLowerCase()} without adding risk to the rest of the relationship.`
        : `${name} can move closer to the stated goal without adding risk to the rest of the relationship.`;
    case "problemImpact":
      return top
        ? `Today, ${top.detail} That gap has a real cost if left alone, and it's the reason this conversation is happening now.`
        : `${name}'s situation has a gap worth naming before we get into the recommendation.`;
    case "solutionStory": {
      const first = solution[0];
      const cap = first ? capabilitiesById[first.capabilityId] : undefined;
      const painPoint = first ? painPoints.find((p) => p.id === first.painPointId) : undefined;
      if (!cap) return `We have a recommendation in mind for ${name}, tied directly to what we've heard.`;
      return `We're recommending ${cap.name} to address ${painPoint ? painPoint.label.toLowerCase() : "the gap"}. ${first?.rationale ?? ""}`.trim();
    }
    case "callToAction":
      return `Let's schedule time with ${name} to walk through this and confirm next steps.`;
    default:
      return "";
  }
}

export function narrativeSourceHighlights(id: NarrativeSectionId, source: NarrativeSourceData): { label: string; value: string }[] {
  switch (id) {
    case "pointOfView":
    case "problemImpact":
      return source.painPoints.map((p) => ({ label: p.label, value: `${p.severity} severity — ${p.detail}` }));
    case "coreMessage":
      return [{ label: "Objective", value: source.objective || "Not stated for this opportunity." }];
    case "solutionStory":
      return source.solution.map((s) => {
        const cap = source.capabilitiesById[s.capabilityId];
        return { label: cap?.name ?? s.capabilityId, value: s.differentiation || s.rationale || "—" };
      });
    case "callToAction":
      return [
        { label: "Client", value: source.client.name },
        { label: "Advisor", value: source.client.advisor },
      ];
    default:
      return [];
  }
}
