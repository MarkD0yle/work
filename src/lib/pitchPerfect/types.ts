import type { Client, ReviewBand, ReviewCheck, SectionReview } from "../pitch/types";

export type { Client, ReviewBand, ReviewCheck, SectionReview };

/* Shared types for Pitch Perfect — the opportunity-centric MVP that wraps
 * define → intelligence → knowledge → solution → narrative → assets →
 * rehearse → outcome into one loop, plus a cross-opportunity insights view.
 * Reuses `Client`/`ReviewCheck`/`ReviewBand`/`SectionReview` from the
 * existing pitch feature rather than redefining an equivalent shape. */

// ---- Define (capability 1) ----
export type PitchType = "New business" | "Upsell" | "Renewal" | "Win-back" | "RFP response";

export type Attendee = { name: string; role: string; isDecisionMaker: boolean };

export type AudienceProfile = {
  seniority: "Individual contributor" | "Manager" | "Director" | "Executive" | "Board";
  size: number;
  format: "In-person" | "Video call" | "Written proposal only";
};

export type OpportunityStatus = "open" | "won" | "lost";

// ---- Intelligence (capability 2) ----
export type PainPoint = { id: string; label: string; detail: string; severity: "Low" | "Medium" | "High" };

export type Stakeholder = {
  name: string;
  role: string;
  influence: "Champion" | "Decision maker" | "Influencer" | "Blocker" | "Unknown";
  stance: "Supportive" | "Neutral" | "Skeptical" | "Unknown";
  notes: string;
};

export type CompetitiveSituation = {
  incumbents: string[];
  competitiveNote: string;
  threatLevel: "Low" | "Medium" | "High" | "Unknown";
};

export type Intelligence = {
  clientObjectives: string[];
  painPoints: PainPoint[];
  stakeholders: Stakeholder[];
  relationshipHistory: string;
  decisionCriteria: string[];
  competitive: CompetitiveSituation;
  marketContext: string[];
};

// ---- Governed knowledge library (capability 3) ----
export type KnowledgeCategory =
  | "Positioning"
  | "Differentiator"
  | "Proof point"
  | "Case study"
  | "Reference story"
  | "Competitive guidance";

export type KnowledgeItem = {
  id: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  /** Every seeded item is pre-governed/compliance-approved; there is no
   * authoring UI in this MVP, so the flag is always true. */
  approved: true;
  relatedCapabilityIds?: string[];
  lastReviewed: string;
};

export type KnowledgeAttachmentRef = { itemId: string; attachedAt: string; note?: string };

// ---- Solution design (capability 4) ----
export type CapabilityCategory =
  | "Advisory"
  | "Investment platform"
  | "Lending & liquidity"
  | "Reporting & technology"
  | "Trust & estate"
  | "Alternative investments";

export type Capability = {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  typicalDifferentiators: string[];
};

export type SolutionItem = {
  id: string;
  capabilityId: string;
  painPointId: string;
  rationale: string;
  differentiation: string;
};

// ---- Narrative (capability 5) ----
export type NarrativeSectionId =
  | "pointOfView"
  | "coreMessage"
  | "problemImpact"
  | "solutionStory"
  | "callToAction";

export type NarrativeSectionStatus = "empty" | "drafted" | "reviewed" | "approved";

export type NarrativeSection = {
  id: NarrativeSectionId;
  content: string;
  status: NarrativeSectionStatus;
  review: SectionReview | null;
  aiPasses: number;
};

/** Assembled once per opportunity from intelligence + solution + attached
 * knowledge; feeds the narrative auto-draft/review engine. */
export type NarrativeSourceData = {
  client: Client;
  objective: string;
  painPoints: PainPoint[];
  solution: SolutionItem[];
  capabilitiesById: Record<string, Capability>;
  attachedKnowledge: KnowledgeItem[];
  competitive: CompetitiveSituation;
};

// ---- Assets (capability 6) ----
export type DeckSlide = {
  title: string;
  bullets: string[];
  sourceNarrativeSectionId: NarrativeSectionId | null;
};

export type PitchAssets = {
  deckOutline: DeckSlide[];
  proposalSummary: string;
  executiveSummary: string;
  talkingPoints: string[];
  generatedAt: string;
};

// ---- Rehearsal (capability 7) ----
export type ObjectionCategory = "Price" | "Competitor" | "Risk/compliance" | "Timing" | "Trust/relationship";

export type Objection = {
  id: string;
  category: ObjectionCategory;
  prompt: string;
  goodResponseHints: string[];
  relatedIncumbentTags?: string[];
};

export type ObjectionAttempt = {
  objectionId: string;
  response: string;
  score: 1 | 3 | 5;
  band: ReviewBand;
  checks: ReviewCheck[];
  attemptedAt: string;
};

export type RehearsalSession = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  attempts: ObjectionAttempt[];
  messageGaps: string[];
};

// ---- Outcome (capability 8) ----
export type OutcomeResult = "Won" | "Lost" | "Pending" | "No decision";

export type Outcome = {
  result: OutcomeResult;
  clientReactions: string;
  objectionsEncountered: string[];
  lessonsLearned: string;
  nextSteps: string;
  capturedAt: string;
};

// ---- Opportunity (root aggregate) ----
export type Opportunity = {
  id: string;
  clientId: string;
  name: string;
  pitchType: PitchType;
  objective: string;
  scope: string;
  attendees: Attendee[];
  audience: AudienceProfile;
  intelligence: Intelligence;
  knowledgeAttachments: KnowledgeAttachmentRef[];
  solution: SolutionItem[];
  narrative: Record<NarrativeSectionId, NarrativeSection>;
  assets: PitchAssets | null;
  rehearsal: RehearsalSession[];
  outcome: Outcome | null;
  createdAt: string;
  updatedAt: string;
};

export type TabId =
  | "define"
  | "intelligence"
  | "knowledge"
  | "solution"
  | "narrative"
  | "assets"
  | "rehearse"
  | "outcome";

export type Readiness = "empty" | "partial" | "complete";
