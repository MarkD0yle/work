import { KNOWLEDGE_LIBRARY } from "./knowledgeData";
import type { KnowledgeCategory, KnowledgeItem, Opportunity } from "./types";

function matchesQuery(item: KnowledgeItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.summary.toLowerCase().includes(q) ||
    item.body.toLowerCase().includes(q) ||
    item.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function searchKnowledge(query: string, category: KnowledgeCategory | "all", tags: string[] = []): KnowledgeItem[] {
  return KNOWLEDGE_LIBRARY.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!matchesQuery(item, query)) return false;
    if (tags.length > 0 && !tags.some((t) => item.tags.includes(t))) return false;
    return true;
  });
}

/** Signal words pulled from the opportunity's own intelligence/solution data,
 * matched against each knowledge item's free-text tags — a lightweight
 * "suggested for you" surface, not a full-text search. */
export function suggestKnowledgeForOpportunity(opp: Opportunity): KnowledgeItem[] {
  const signals = new Set<string>();
  for (const p of opp.intelligence.painPoints) {
    p.label.toLowerCase().split(/\s+/).forEach((w) => signals.add(w));
  }
  for (const incumbent of opp.intelligence.competitive.incumbents) {
    incumbent.toLowerCase().split(/\s+/).forEach((w) => signals.add(w));
  }
  const capabilityIds = new Set(opp.solution.map((s) => s.capabilityId));

  const alreadyAttached = new Set(opp.knowledgeAttachments.map((a) => a.itemId));

  return KNOWLEDGE_LIBRARY.filter((item) => {
    if (alreadyAttached.has(item.id)) return false;
    const capabilityMatch = item.relatedCapabilityIds?.some((id) => capabilityIds.has(id)) ?? false;
    const tagMatch = item.tags.some((tag) => [...signals].some((signal) => signal.length > 2 && tag.toLowerCase().includes(signal)));
    return capabilityMatch || tagMatch;
  }).slice(0, 5);
}
