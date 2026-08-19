import { OBJECTION_BANK } from "./objectionData";
import { NARRATIVE_SECTION_ORDER } from "./opportunity";
import type {
  NarrativeSection,
  NarrativeSectionId,
  Objection,
  ObjectionAttempt,
  Opportunity,
  RehearsalSession,
  ReviewBand,
  ReviewCheck,
} from "./types";

/* Rehearsal engine — objection selection + rule-based response scoring, same
 * deterministic rubric shape as lib/pitch/review.ts (checks → band → score). */

export function objectionsForOpportunity(opp: Opportunity): Objection[] {
  const incumbentText = opp.intelligence.competitive.incumbents.join(" ").toLowerCase();
  const relevant = OBJECTION_BANK.filter((o) => o.relatedIncumbentTags?.some((tag) => incumbentText.includes(tag.toLowerCase())));
  const rest = OBJECTION_BANK.filter((o) => !relevant.includes(o));
  return [...relevant, ...rest];
}

const WEAK_PHRASES = ["sorry", "i don't know", "not sure", "unfortunately", "i guess"];

export function scoreObjectionResponse(
  objection: Objection,
  response: string,
): { score: 1 | 3 | 5; band: ReviewBand; checks: ReviewCheck[] } {
  const trimmed = response.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const lower = trimmed.toLowerCase();

  const checks: ReviewCheck[] = [
    {
      label: "Addresses the concern directly",
      pass: wordCount >= 12,
      note: "A substantive response, not a one-line deflection.",
    },
    {
      label: "Cites a relevant point",
      pass: objection.goodResponseHints.some((h) => lower.includes(h.toLowerCase())),
      note: "References a concrete proof point, differentiator, or fact — not a generic reassurance.",
    },
    {
      label: "Confident, non-defensive tone",
      pass: !WEAK_PHRASES.some((w) => lower.includes(w)),
      note: "Reads as measured and confident, not apologetic or unsure.",
    },
  ];

  const passes = checks.filter((c) => c.pass).length;
  const band: ReviewBand = passes >= 3 ? "Strong" : passes === 2 ? "Solid" : "Needs work";
  const score: 1 | 3 | 5 = passes >= 3 ? 5 : passes === 2 ? 3 : 1;
  return { score, band, checks };
}

function newRehearsalId(): string {
  return `rehearsal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function startRehearsalSession(): RehearsalSession {
  return { id: newRehearsalId(), startedAt: new Date().toISOString(), completedAt: null, attempts: [], messageGaps: [] };
}

export function recordAttempt(session: RehearsalSession, attempt: Omit<ObjectionAttempt, "attemptedAt">): RehearsalSession {
  return { ...session, attempts: [...session.attempts, { ...attempt, attemptedAt: new Date().toISOString() }] };
}

export function completeSession(session: RehearsalSession, messageGaps: string[]): RehearsalSession {
  return { ...session, completedAt: new Date().toISOString(), messageGaps };
}

/** Unresolved narrative review suggestions, surfaced as "message gaps" once a
 * rehearsal session wraps up. */
export function messageGapsFromNarrative(narrative: Record<NarrativeSectionId, NarrativeSection>): string[] {
  return NARRATIVE_SECTION_ORDER.flatMap((id) => narrative[id].review?.suggestions ?? []);
}
