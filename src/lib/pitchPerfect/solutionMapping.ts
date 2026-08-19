import { CAPABILITY_CATALOG } from "./capabilityData";
import type { Capability, Intelligence, PainPoint, SolutionItem } from "./types";

export function unmappedPainPoints(intel: Intelligence, solution: SolutionItem[]): PainPoint[] {
  const mapped = new Set(solution.map((s) => s.painPointId));
  return intel.painPoints.filter((p) => !mapped.has(p.id));
}

/** Ranks the capability catalog against a pain point's own words — a light
 * keyword match, not a real recommendation model. Falls back to the full
 * catalog if nothing scores. */
export function suggestCapabilitiesForPainPoint(painPoint: PainPoint): Capability[] {
  const words = `${painPoint.label} ${painPoint.detail}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = CAPABILITY_CATALOG.map((cap) => {
    const haystack = `${cap.name} ${cap.description} ${cap.category}`.toLowerCase();
    const score = words.filter((w) => haystack.includes(w)).length;
    return { cap, score };
  });
  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.cap);
  return ranked.length > 0 ? ranked : CAPABILITY_CATALOG;
}

export function solutionCompleteness(
  intel: Intelligence,
  solution: SolutionItem[],
): { mappedCount: number; totalPainPoints: number; unmapped: PainPoint[] } {
  const unmapped = unmappedPainPoints(intel, solution);
  return { mappedCount: intel.painPoints.length - unmapped.length, totalPainPoints: intel.painPoints.length, unmapped };
}
