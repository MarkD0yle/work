import type { Intelligence } from "./types";

/* Intelligence completeness — same yes/no-fact rubric shape as
 * lib/pitch/review.ts, but checking data completeness instead of prose
 * quality. Surfaces what's missing to competently pursue the opportunity. */

export type GapCheck = { key: string; label: string; pass: boolean; note: string };

export function checkIntelligenceGaps(intel: Intelligence): GapCheck[] {
  return [
    {
      key: "objectives",
      label: "Client objectives captured",
      pass: intel.clientObjectives.length > 0,
      note: "What the client is actually trying to achieve, in their own priority order.",
    },
    {
      key: "pain-points",
      label: "At least one pain point identified",
      pass: intel.painPoints.length > 0,
      note: "A specific challenge or gap the client is experiencing today.",
    },
    {
      key: "stakeholders",
      label: "At least one stakeholder mapped",
      pass: intel.stakeholders.length > 0,
      note: "Who's in the room and who influences the decision.",
    },
    {
      key: "decision-maker",
      label: "A decision maker is identified",
      pass: intel.stakeholders.some((s) => s.influence === "Decision maker"),
      note: "At least one stakeholder marked as the actual decision maker, not just an influencer.",
    },
    {
      key: "decision-criteria",
      label: "Decision criteria captured",
      pass: intel.decisionCriteria.length > 0,
      note: "What the client will actually judge the recommendation against.",
    },
    {
      key: "competitive-threat",
      label: "Competitive situation assessed",
      pass: intel.competitive.threatLevel !== "Unknown",
      note: "A threat level has been set, not left as unknown.",
    },
    {
      key: "relationship-history",
      label: "Relationship history recorded",
      pass: intel.relationshipHistory.trim().length > 0,
      note: "Tenure, cadence, and any open concerns from prior reviews.",
    },
    {
      key: "market-context",
      label: "Market/industry context noted",
      pass: intel.marketContext.length > 0,
      note: "Why now — a current market or industry condition relevant to this client.",
    },
  ];
}

export function intelligenceCompleteness(intel: Intelligence): { passed: number; total: number; gaps: GapCheck[] } {
  const checks = checkIntelligenceGaps(intel);
  return { passed: checks.filter((c) => c.pass).length, total: checks.length, gaps: checks.filter((c) => !c.pass) };
}
