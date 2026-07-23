import type {
  Intelligence,
  NarrativeSection,
  NarrativeSectionId,
  Opportunity,
  OpportunityStatus,
  Readiness,
  TabId,
} from "./types";

/* Opportunity factory + small derived helpers. Kept dependency-free (only
 * imports types) so it can sit at the bottom of the module graph — the repo,
 * seed data, and every tab/engine build on top of this file. */

export const NARRATIVE_SECTION_ORDER: NarrativeSectionId[] = [
  "pointOfView",
  "coreMessage",
  "problemImpact",
  "solutionStory",
  "callToAction",
];

export function newOpportunityId(): string {
  return `opp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyIntelligence(): Intelligence {
  return {
    clientObjectives: [],
    painPoints: [],
    stakeholders: [],
    relationshipHistory: "",
    decisionCriteria: [],
    competitive: { incumbents: [], competitiveNote: "", threatLevel: "Unknown" },
    marketContext: [],
  };
}

export function emptyNarrativeSections(): Record<NarrativeSectionId, NarrativeSection> {
  const out = {} as Record<NarrativeSectionId, NarrativeSection>;
  for (const id of NARRATIVE_SECTION_ORDER) {
    out[id] = { id, content: "", status: "empty", review: null, aiPasses: 0 };
  }
  return out;
}

export function newOpportunity(clientId: string, overrides?: Partial<Opportunity>): Opportunity {
  const now = new Date().toISOString();
  return {
    id: newOpportunityId(),
    clientId,
    name: "",
    pitchType: "New business",
    objective: "",
    scope: "",
    attendees: [],
    audience: { seniority: "Manager", size: 1, format: "Video call" },
    intelligence: emptyIntelligence(),
    knowledgeAttachments: [],
    solution: [],
    narrative: emptyNarrativeSections(),
    assets: null,
    rehearsal: [],
    outcome: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function opportunityStatus(opp: Opportunity): OpportunityStatus {
  if (!opp.outcome) return "open";
  if (opp.outcome.result === "Won") return "won";
  if (opp.outcome.result === "Lost") return "lost";
  return "open";
}

function defineReadiness(opp: Opportunity): Readiness {
  const filled = [opp.name, opp.pitchType, opp.objective, opp.scope].filter((v) => v.trim().length > 0).length;
  if (filled === 0 && opp.attendees.length === 0) return "empty";
  if (filled === 4 && opp.attendees.length > 0) return "complete";
  return "partial";
}

function intelligenceReadiness(opp: Opportunity): Readiness {
  const { intelligence: intel } = opp;
  const signals = [
    intel.clientObjectives.length > 0,
    intel.painPoints.length > 0,
    intel.stakeholders.length > 0,
    intel.decisionCriteria.length > 0,
    intel.competitive.threatLevel !== "Unknown",
    intel.relationshipHistory.trim().length > 0,
    intel.marketContext.length > 0,
  ];
  const passCount = signals.filter(Boolean).length;
  if (passCount === 0) return "empty";
  if (passCount === signals.length) return "complete";
  return "partial";
}

function knowledgeReadiness(opp: Opportunity): Readiness {
  return opp.knowledgeAttachments.length > 0 ? "complete" : "empty";
}

function solutionReadiness(opp: Opportunity): Readiness {
  if (opp.solution.length === 0) return "empty";
  const mappedPainPointIds = new Set(opp.solution.map((s) => s.painPointId));
  const allMapped = opp.intelligence.painPoints.every((p) => mappedPainPointIds.has(p.id));
  return allMapped ? "complete" : "partial";
}

function narrativeReadiness(opp: Opportunity): Readiness {
  const sections = NARRATIVE_SECTION_ORDER.map((id) => opp.narrative[id]);
  if (sections.every((s) => s.status === "empty")) return "empty";
  if (sections.every((s) => s.status === "approved")) return "complete";
  return "partial";
}

function assetsReadiness(opp: Opportunity): Readiness {
  return opp.assets ? "complete" : "empty";
}

function rehearseReadiness(opp: Opportunity): Readiness {
  if (opp.rehearsal.length === 0) return "empty";
  return opp.rehearsal.some((s) => s.completedAt) ? "complete" : "partial";
}

function outcomeReadiness(opp: Opportunity): Readiness {
  return opp.outcome ? "complete" : "empty";
}

export function opportunityReadiness(opp: Opportunity): Record<TabId, Readiness> {
  return {
    define: defineReadiness(opp),
    intelligence: intelligenceReadiness(opp),
    knowledge: knowledgeReadiness(opp),
    solution: solutionReadiness(opp),
    narrative: narrativeReadiness(opp),
    assets: assetsReadiness(opp),
    rehearse: rehearseReadiness(opp),
    outcome: outcomeReadiness(opp),
  };
}

export function overallReadinessFraction(opp: Opportunity): { done: number; total: number } {
  const values = Object.values(opportunityReadiness(opp));
  return { done: values.filter((v) => v === "complete").length, total: values.length };
}
