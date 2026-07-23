import { OBJECTION_BANK } from "./objectionData";
import { KNOWLEDGE_LIBRARY } from "./knowledgeData";
import { checkIntelligenceGaps } from "./intelligenceGaps";
import { opportunityStatus } from "./opportunity";
import type { Opportunity } from "./types";

/* Cross-opportunity organizational learning (capability 9) — purely derived
 * from the set of saved opportunities, no separate authoring UI. */

export type InsightsSummary = {
  totalOpportunities: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  topObjections: { objectionId: string; prompt: string; timesEncountered: number }[];
  knowledgeItemWinCorrelation: { itemId: string; title: string; attachedCount: number; winRateWhenAttached: number | null }[];
  commonGapPatterns: { checkLabel: string; failCount: number }[];
};

export function computeInsights(opportunities: Opportunity[]): InsightsSummary {
  const decided = opportunities.filter((o) => {
    const s = opportunityStatus(o);
    return s === "won" || s === "lost";
  });
  const wonCount = decided.filter((o) => opportunityStatus(o) === "won").length;
  const lostCount = decided.filter((o) => opportunityStatus(o) === "lost").length;
  const winRate = decided.length > 0 ? wonCount / decided.length : null;

  const objectionCounts = new Map<string, number>();
  for (const opp of opportunities) {
    for (const session of opp.rehearsal) {
      for (const attempt of session.attempts) {
        objectionCounts.set(attempt.objectionId, (objectionCounts.get(attempt.objectionId) ?? 0) + 1);
      }
    }
  }
  const topObjections = [...objectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([objectionId, timesEncountered]) => ({
      objectionId,
      prompt: OBJECTION_BANK.find((o) => o.id === objectionId)?.prompt ?? objectionId,
      timesEncountered,
    }));

  const itemStats = new Map<string, { attachedCount: number; wonCount: number; decidedCount: number }>();
  for (const opp of opportunities) {
    const status = opportunityStatus(opp);
    const isDecided = status === "won" || status === "lost";
    for (const attachment of opp.knowledgeAttachments) {
      const stats = itemStats.get(attachment.itemId) ?? { attachedCount: 0, wonCount: 0, decidedCount: 0 };
      stats.attachedCount += 1;
      if (isDecided) {
        stats.decidedCount += 1;
        if (status === "won") stats.wonCount += 1;
      }
      itemStats.set(attachment.itemId, stats);
    }
  }
  const knowledgeItemWinCorrelation = [...itemStats.entries()]
    .map(([itemId, stats]) => ({
      itemId,
      title: KNOWLEDGE_LIBRARY.find((k) => k.id === itemId)?.title ?? itemId,
      attachedCount: stats.attachedCount,
      winRateWhenAttached: stats.decidedCount > 0 ? stats.wonCount / stats.decidedCount : null,
    }))
    .sort((a, b) => b.attachedCount - a.attachedCount)
    .slice(0, 5);

  const gapCounts = new Map<string, number>();
  for (const opp of opportunities) {
    for (const gap of checkIntelligenceGaps(opp.intelligence).filter((g) => !g.pass)) {
      gapCounts.set(gap.label, (gapCounts.get(gap.label) ?? 0) + 1);
    }
  }
  const commonGapPatterns = [...gapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([checkLabel, failCount]) => ({ checkLabel, failCount }));

  return {
    totalOpportunities: opportunities.length,
    wonCount,
    lostCount,
    winRate,
    topObjections,
    knowledgeItemWinCorrelation,
    commonGapPatterns,
  };
}
