import type {
  Opportunity,
  NarrativeSection,
  NarrativeSectionId,
  ObjectionAttempt,
  ReviewCheck,
} from "./types";
import { NARRATIVE_SECTION_ORDER } from "./opportunity";

/* Seeded opportunities so the list and Insights view aren't empty on first
 * load, and show realistic volume/variety (10 opportunities across the 4
 * seeded clients, spanning won/lost/still-open, and different stages of
 * completeness). Referenced against the real CLIENTS ids from
 * lib/pitch/data.ts so the two pitch features share one world. Narrative
 * review/assets/rehearsal values here are hand-authored historical records
 * (plausible output of the rule-based engines), not produced by calling
 * them — the types only care about shape, and seed data predates those
 * engines existing in the module graph. */

function checks(labels: [string, boolean, string][]): ReviewCheck[] {
  return labels.map(([label, pass, note]) => ({ label, pass, note }));
}

function blankNarrative(): Record<NarrativeSectionId, NarrativeSection> {
  const out = {} as Record<NarrativeSectionId, NarrativeSection>;
  for (const id of NARRATIVE_SECTION_ORDER) {
    out[id] = { id, content: "", status: "empty", review: null, aiPasses: 0 };
  }
  return out;
}

function approvedNarrative(
  content: Record<NarrativeSectionId, string>,
  reviewedAt = "2026-07-10T09:00:00.000Z",
): Record<NarrativeSectionId, NarrativeSection> {
  const out = {} as Record<NarrativeSectionId, NarrativeSection>;
  for (const id of NARRATIVE_SECTION_ORDER) {
    out[id] = {
      id,
      content: content[id],
      status: "approved",
      aiPasses: 1,
      review: {
        checks: checks([
          ["Personalized", true, "Names the client directly rather than reading as boilerplate."],
          ["Data-grounded", true, "Cites a concrete figure from the gathered intelligence."],
          ["Ties to the objective", true, "Connects back to the stated pitch objective."],
        ]),
        band: "Strong",
        score: 5,
        suggestions: [],
        reviewedAt,
      },
    };
  }
  return out;
}

function rehearsalAttempt(
  objectionId: string,
  response: string,
  score: 1 | 3 | 5,
  band: "Needs work" | "Solid" | "Strong",
  checkList: [string, boolean, string][],
  attemptedAt = "2026-06-20T15:00:00.000Z",
): ObjectionAttempt {
  return { objectionId, response, score, band, checks: checks(checkList), attemptedAt };
}

const STRONG_CHECKS: [string, boolean, string][] = [
  ["Addresses the concern directly", true, "Response engages with the concern rather than deflecting."],
  ["Cites a relevant point", true, "References a concrete proof point or differentiator."],
  ["Confident, non-defensive tone", true, "Response doesn't read as apologetic or defensive."],
];

const WEAK_CHECKS: [string, boolean, string][] = [
  ["Addresses the concern directly", true, "Engages with the concern, though briefly."],
  ["Cites a relevant point", false, "Doesn't cite a specific number, proof point, or differentiator."],
  ["Confident, non-defensive tone", true, "Reads as measured, not defensive."],
];

// ---- 1. Harrington Trust — Private Credit & Concentration Reduction — OPEN, in progress ----
const HARRINGTON: Opportunity = {
  id: "opp-harrington-private-credit",
  clientId: "harrington",
  name: "Harrington Trust — Private Credit & Concentration Reduction",
  pitchType: "Upsell",
  objective: "Introduce the Private Credit Income Fund to reduce real-estate concentration ahead of the multi-generational transfer.",
  scope: "Quarterly trustee review — propose a phased reallocation out of directly-held real estate.",
  attendees: [
    { name: "Eleanor Ashcombe", role: "Lead Trustee", isDecisionMaker: true },
    { name: "Priya Desai", role: "Advisor", isDecisionMaker: false },
    { name: "Robert Chu", role: "Family CFO", isDecisionMaker: false },
  ],
  audience: { seniority: "Board", size: 3, format: "In-person" },
  intelligence: {
    clientObjectives: [
      "Fund a multi-generational transfer without a disruptive liquidity event.",
      "Reduce real-estate concentration flagged at the last quarterly review.",
    ],
    painPoints: [
      {
        id: "pp-re-concentration",
        label: "Real estate concentration",
        detail: "Real estate sits at 41% of assets versus a 25% target, largely four directly-held properties.",
        severity: "High",
      },
      {
        id: "pp-competitive-pressure",
        label: "Competitive pressure from a direct PE co-invest pitch",
        detail: "A rival family office pitched a direct private-equity co-invest program last month.",
        severity: "Medium",
      },
    ],
    stakeholders: [
      { name: "Eleanor Ashcombe", role: "Lead Trustee", influence: "Decision maker", stance: "Supportive", notes: "Wants a plan that avoids a forced sale of any property." },
      { name: "Robert Chu", role: "Family CFO", influence: "Influencer", stance: "Neutral", notes: "Evaluating the rival's direct co-invest pitch in parallel." },
    ],
    relationshipHistory: "7-year relationship. Trustees meet quarterly; last review flagged the real-estate concentration as an open concern.",
    decisionCriteria: ["No forced sale of existing properties", "Maintains current income distribution", "Addresses the concentration flag on file"],
    competitive: {
      incumbents: ["Rival family office (direct PE co-invest)"],
      competitiveNote: "The rival's pitch concentrates risk into single-name deals with no ongoing underwriting after close.",
      threatLevel: "Medium",
    },
    marketContext: ["Real assets: private real-estate marks lag listed markets by 2-3 quarters, understating true concentration risk."],
  },
  knowledgeAttachments: [
    { itemId: "cs-real-estate-concentration", attachedAt: "2026-07-01T10:00:00.000Z" },
    { itemId: "cg-direct-pe-coinvest", attachedAt: "2026-07-01T10:05:00.000Z" },
    { itemId: "diff-in-house-underwriting", attachedAt: "2026-07-01T10:06:00.000Z" },
  ],
  solution: [
    {
      id: "sol-harrington-1",
      capabilityId: "private-credit-access",
      painPointId: "pp-re-concentration",
      rationale: "Phased reallocation out of directly-held real estate into the Private Credit Income Fund, sized to avoid a forced property sale.",
      differentiation: "In-house underwriting team vets every loan, unlike a wrapped fund-of-funds or the rival's single-name direct co-invest deals.",
    },
    {
      id: "sol-harrington-2",
      capabilityId: "trust-estate-planning",
      painPointId: "pp-competitive-pressure",
      rationale: "Reinforce the multi-generational trust relationship with a dedicated trust officer ahead of the transfer.",
      differentiation: "One trust officer stays with the family across generations, unlike a rotating relationship-manager model.",
    },
  ],
  narrative: blankNarrative(),
  assets: null,
  rehearsal: [],
  outcome: null,
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-15T14:30:00.000Z",
};

// ---- 2. Harrington Trust — Trust & Estate Succession Planning — WON ----
const HARRINGTON_SUCCESSION: Opportunity = {
  id: "opp-harrington-succession",
  clientId: "harrington",
  name: "Harrington Trust — Trust & Estate Succession Planning",
  pitchType: "New business",
  objective: "Formalize a dedicated trust officer relationship ahead of the multi-generational transfer.",
  scope: "Trust & estate structuring conversation, run alongside — but separate from — the investment recommendation track.",
  attendees: [
    { name: "Eleanor Ashcombe", role: "Lead Trustee", isDecisionMaker: true },
    { name: "Whitfield & Marsh", role: "External Family Counsel", isDecisionMaker: false },
  ],
  audience: { seniority: "Board", size: 4, format: "In-person" },
  intelligence: {
    clientObjectives: [
      "Ensure continuity of the advisory relationship across the generational transfer.",
      "Coordinate directly with the family's external counsel on any structuring changes.",
    ],
    painPoints: [
      {
        id: "pp-continuity-risk",
        label: "Relationship continuity risk",
        detail: "Prior advisor relationships lapsed at the last generational transfer due to a rotating relationship-manager model.",
        severity: "High",
      },
    ],
    stakeholders: [
      { name: "Eleanor Ashcombe", role: "Lead Trustee", influence: "Decision maker", stance: "Supportive", notes: "Wants one point of contact across generations." },
      { name: "Whitfield & Marsh", role: "Family Counsel", influence: "Influencer", stance: "Neutral", notes: "Needs to be looped into any trust structuring changes." },
    ],
    relationshipHistory: "7-year relationship; trustees have raised continuity concerns at each of the last two generational transfers.",
    decisionCriteria: ["Continuity of relationship manager across generations", "Direct coordination with external counsel", "No disruption to the existing investment mandate"],
    competitive: {
      incumbents: [],
      competitiveNote: "No active competitive process, but the family has informally benchmarked continuity practices against two other private banks.",
      threatLevel: "Low",
    },
    marketContext: [],
  },
  knowledgeAttachments: [{ itemId: "diff-dedicated-trust-officer", attachedAt: "2026-05-01T09:00:00.000Z" }],
  solution: [
    {
      id: "sol-harrington-succession-1",
      capabilityId: "trust-estate-planning",
      painPointId: "pp-continuity-risk",
      rationale: "Assign one dedicated trust officer to the family, carrying forward across the generational transfer.",
      differentiation: "One trust officer stays with the family across generations, unlike a rotating relationship-manager model.",
    },
  ],
  narrative: approvedNarrative({
    pointOfView: "The Harrington Trust has watched relationship continuity break down at each of the last two generational transfers — this time, that's fixable before it happens again.",
    coreMessage: "One dedicated trust officer, assigned to the family across generations, ends the continuity risk for good.",
    problemImpact: "Twice now, a rotating relationship-manager model has meant the family had to rebuild trust with a new advisor right at the moment of transfer — the worst possible time for that disruption.",
    solutionStory: "We're proposing a dedicated Trust & Estate Planning officer, assigned to the Harrington family specifically and coordinating directly with Whitfield & Marsh, rather than rotating with whoever's available.",
    callToAction: "Let's confirm the assignment with the trustees this quarter, ahead of the transfer timeline.",
  }),
  assets: {
    deckOutline: [
      { title: "Point of view", bullets: ["Relationship continuity has broken down at the last two generational transfers."], sourceNarrativeSectionId: "pointOfView" },
      { title: "Core message", bullets: ["One dedicated trust officer across generations ends the continuity risk."], sourceNarrativeSectionId: "coreMessage" },
      { title: "Problem & impact", bullets: ["A rotating relationship-manager model forced the family to rebuild trust at the worst possible moment, twice."], sourceNarrativeSectionId: "problemImpact" },
      {
        title: "Solution story",
        bullets: ["Recommended: Trust & Estate Planning", "One trust officer stays with the family across generations, unlike a rotating relationship-manager model."],
        sourceNarrativeSectionId: "solutionStory",
      },
      { title: "Next steps", bullets: ["Confirm the assignment with trustees this quarter."], sourceNarrativeSectionId: "callToAction" },
    ],
    proposalSummary:
      "The Harrington Trust has faced relationship continuity breaks at each of the last two generational transfers. We propose a dedicated Trust & Estate Planning officer, assigned specifically to the family and coordinating directly with external counsel, ending the continuity risk for good.",
    executiveSummary: "One dedicated trust officer across generations. Coordinates directly with Whitfield & Marsh. Ends the continuity risk seen at the last two transfers.",
    talkingPoints: ["One trust officer stays with the family across generations, unlike a rotating relationship-manager model."],
    generatedAt: "2026-05-10T11:00:00.000Z",
  },
  rehearsal: [
    {
      id: "rehearsal-harrington-succession-1",
      startedAt: "2026-05-05T14:00:00.000Z",
      completedAt: "2026-05-05T14:20:00.000Z",
      attempts: [
        rehearsalAttempt(
          "obj-trust-current-advisor-tenure",
          "That's exactly the continuity this proposes to fix — one dedicated trust officer assigned to your family specifically, not rotating with whoever's on the desk that quarter.",
          5,
          "Strong",
          STRONG_CHECKS,
          "2026-05-05T14:15:00.000Z",
        ),
      ],
      messageGaps: [],
    },
  ],
  outcome: {
    result: "Won",
    clientReactions: "Trustees welcomed the continuity commitment, especially after twice being disrupted at prior transfers.",
    objectionsEncountered: ["Our current advisor has been with us for years — why would we change part of this?"],
    lessonsLearned: "Naming the specific, recurring pain (continuity breaks at transfer) rather than a generic service pitch made the decision straightforward.",
    nextSteps: "Trust officer assignment confirmed; first joint session with Whitfield & Marsh scheduled for next quarter.",
    capturedAt: "2026-05-12T16:00:00.000Z",
  },
  createdAt: "2026-04-20T09:00:00.000Z",
  updatedAt: "2026-05-12T16:00:00.000Z",
};

// ---- 3. Harrington Trust — Structured Note Diversification — OPEN, just started ----
const HARRINGTON_STRUCTURED: Opportunity = {
  id: "opp-harrington-structured-note",
  clientId: "harrington",
  name: "Harrington Trust — Structured Note Diversification",
  pitchType: "Upsell",
  objective: "",
  scope: "Early-stage idea, not yet discussed with trustees.",
  attendees: [],
  audience: { seniority: "Manager", size: 1, format: "Video call" },
  intelligence: {
    clientObjectives: [],
    painPoints: [
      {
        id: "pp-no-downside-protection",
        label: "No downside protection on the public equity sleeve",
        detail: "Public equity allocation currently sits 8 points under target with no structured downside protection in place.",
        severity: "Medium",
      },
    ],
    stakeholders: [],
    relationshipHistory: "",
    decisionCriteria: [],
    competitive: { incumbents: [], competitiveNote: "", threatLevel: "Unknown" },
    marketContext: [],
  },
  knowledgeAttachments: [],
  solution: [],
  narrative: blankNarrative(),
  assets: null,
  rehearsal: [],
  outcome: null,
  createdAt: "2026-07-20T09:00:00.000Z",
  updatedAt: "2026-07-20T09:00:00.000Z",
};

// ---- 4. Chen Family Office — Cash Drag & Fee Transparency — WON ----
const CHEN_FAMILY_OFFICE: Opportunity = {
  id: "opp-chen-private-credit-reporting",
  clientId: "chen-family",
  name: "Chen Family Office — Cash Drag & Fee Transparency",
  pitchType: "Upsell",
  objective: "Redeploy idle cash drag into private credit income and give the new CFO one consolidated fee ledger.",
  scope: "Present to the new CFO ahead of the annual philanthropic distribution planning cycle.",
  attendees: [
    { name: "Wei Chen", role: "Family CFO", isDecisionMaker: true },
    { name: "Marcus Ellery", role: "Advisor", isDecisionMaker: false },
  ],
  audience: { seniority: "Executive", size: 2, format: "Video call" },
  intelligence: {
    clientObjectives: [
      "Generate stable income to fund the annual philanthropic distribution.",
      "Give the new CFO full fee transparency across every manager.",
    ],
    painPoints: [
      {
        id: "pp-cash-drag",
        label: "Cash drag reducing income generation",
        detail: "Cash sits 6 points above target — a direct drag versus the distribution target.",
        severity: "High",
      },
      {
        id: "pp-fee-transparency",
        label: "Fee transparency concerns from new CFO",
        detail: "New CFO joined in Q2 and is re-underwriting every manager relationship, wants clear fee transparency.",
        severity: "Medium",
      },
    ],
    stakeholders: [
      { name: "Wei Chen", role: "Family CFO", influence: "Decision maker", stance: "Skeptical", notes: "Re-underwriting every manager relationship; became supportive once fees were made transparent." },
      { name: "Investment Committee Chair", role: "Committee Chair", influence: "Champion", stance: "Supportive", notes: "Has pushed for consolidated reporting for two years." },
    ],
    relationshipHistory: "3-year relationship. New CFO joined in Q2 and is re-underwriting every manager relationship on the book.",
    decisionCriteria: ["All-in fee transparency", "Income yield versus the distribution need", "Manager track record"],
    competitive: {
      incumbents: [],
      competitiveNote: "No formal RFP, but the CFO is informally benchmarking blended fees against two regional wealth managers.",
      threatLevel: "Medium",
    },
    marketContext: [
      "Rates: one cut priced for Q4 — front-end yields have firmed accordingly.",
      "Credit: spreads tight but resilient — technical backdrop supportive for laddered exposure.",
    ],
  },
  knowledgeAttachments: [
    { itemId: "cs-cfo-fee-renegotiation", attachedAt: "2026-06-01T09:00:00.000Z" },
    { itemId: "diff-real-time-reporting", attachedAt: "2026-06-01T09:05:00.000Z" },
    { itemId: "pp-private-credit-track-record", attachedAt: "2026-06-01T09:06:00.000Z" },
  ],
  solution: [
    {
      id: "sol-chen-1",
      capabilityId: "private-credit-access",
      painPointId: "pp-cash-drag",
      rationale: "Redeploy the idle cash drag into a yield-generating private credit sleeve sized to the annual distribution.",
      differentiation: "In-house underwriting team, 9.2% net annualized track record with zero missed distributions.",
    },
    {
      id: "sol-chen-2",
      capabilityId: "consolidated-reporting",
      painPointId: "pp-fee-transparency",
      rationale: "Give the new CFO one all-in fee ledger across every manager instead of separate quarterly statements.",
      differentiation: "Real-time consolidated reporting across 12+ custodians, not a quarterly PDF.",
    },
  ],
  narrative: approvedNarrative({
    pointOfView:
      "Chen Family Office's cash position has drifted six points above target, quietly taxing the income the philanthropic distribution depends on — and it's fixable without adding risk.",
    coreMessage:
      "Redeploy the idle cash into a governed private credit sleeve and give the CFO one transparent fee ledger, so the distribution is funded by yield, not by draining principal.",
    problemImpact:
      "Today, 12% of the book sits in cash yielding well below the Private Credit Income Fund's 9.2% net track record — that gap alone represents foregone income the philanthropic distribution has to make up elsewhere, on top of a new CFO who can't currently see one all-in cost figure across managers.",
    solutionStory:
      "We're recommending the Private Credit Income Fund, sized to close the cash drag, backed by an in-house underwriting team rather than a wrapped fund-of-funds, alongside consolidated reporting across every manager so the CFO sees one real-time fee ledger instead of quarterly PDFs.",
    callToAction:
      "Let's schedule a call with the CFO this week to walk through the fee-ledger mockup and confirm the private credit allocation size.",
  }),
  assets: {
    deckOutline: [
      { title: "Point of view", bullets: ["Cash position has drifted six points above target, taxing the philanthropic distribution."], sourceNarrativeSectionId: "pointOfView" },
      { title: "Core message", bullets: ["Redeploy idle cash into private credit income; give the CFO one transparent fee ledger."], sourceNarrativeSectionId: "coreMessage" },
      {
        title: "Problem & impact",
        bullets: [
          "12% of the book sits in cash, yielding well below the Private Credit Income Fund's track record.",
          "The new CFO can't currently see one all-in cost figure across managers.",
        ],
        sourceNarrativeSectionId: "problemImpact",
      },
      {
        title: "Solution story",
        bullets: [
          "Recommended: Private Credit Access Program",
          "Recommended: Consolidated Reporting & Technology",
          "In-house underwriting team, 9.2% net annualized, zero missed distributions.",
          "Consolidated reporting across every manager — one real-time fee ledger.",
        ],
        sourceNarrativeSectionId: "solutionStory",
      },
      { title: "Next steps", bullets: ["Schedule a call this week with the CFO to walk through the fee-ledger mockup."], sourceNarrativeSectionId: "callToAction" },
    ],
    proposalSummary:
      "Chen Family Office's cash position has drifted six points above target, quietly taxing the philanthropic distribution. We recommend redeploying the idle cash into the Private Credit Income Fund — in-house underwritten, 9.2% net annualized, zero missed distributions — alongside consolidated reporting so the CFO sees one real-time, all-in fee ledger across every manager.",
    executiveSummary:
      "Redeploy cash drag into private credit income; give the CFO one transparent fee ledger. In-house underwriting, 9.2% net track record, real-time consolidated reporting across 12+ custodians.",
    talkingPoints: [
      "In-house underwriting team, 9.2% net annualized, zero missed distributions.",
      "Real-time consolidated reporting across 12+ custodians, not a quarterly PDF.",
      "A comparable CFO fee-transparency engagement cut blended fees 18bps while adding a private credit sleeve.",
    ],
    generatedAt: "2026-06-22T11:00:00.000Z",
  },
  rehearsal: [
    {
      id: "rehearsal-chen-1",
      startedAt: "2026-06-20T14:45:00.000Z",
      completedAt: "2026-06-20T15:10:00.000Z",
      attempts: [
        rehearsalAttempt(
          "obj-price-what-am-i-paying-for",
          "I understand — that's exactly what the consolidated reporting fixes. You'll see one all-in fee ledger across every manager, updated in real time, instead of hunting through separate quarterly statements.",
          5,
          "Strong",
          STRONG_CHECKS,
        ),
        rehearsalAttempt(
          "obj-trust-sales-pitch-skepticism",
          "Fair question. Every recommendation here traces back to the cash-drag gap we identified in your own portfolio data, not a generic model.",
          3,
          "Solid",
          WEAK_CHECKS,
        ),
      ],
      messageGaps: [],
    },
  ],
  outcome: {
    result: "Won",
    clientReactions: "CFO responded well to the fee-ledger mockup and the private credit track record; Investment Committee chair was already supportive.",
    objectionsEncountered: ["What am I actually paying for across all these accounts?", "How do I know this isn't just a sales pitch?"],
    lessonsLearned: "Leading with the consolidated fee ledger before the product recommendation defused the CFO's skepticism faster than leading with yield.",
    nextSteps: "Onboard the private credit allocation next quarter; schedule a 90-day fee-ledger review.",
    capturedAt: "2026-07-05T16:00:00.000Z",
  },
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-07-05T16:00:00.000Z",
};

// ---- 5. Chen Family Office — Trust & Estate Refresh — LOST ----
const CHEN_TRUST_REFRESH: Opportunity = {
  id: "opp-chen-trust-refresh",
  clientId: "chen-family",
  name: "Chen Family Office — Trust & Estate Refresh",
  pitchType: "New business",
  objective: "Introduce trust and estate planning services alongside the existing investment mandate.",
  scope: "Explored during the CFO's manager re-underwriting cycle.",
  attendees: [{ name: "Wei Chen", role: "Family CFO", isDecisionMaker: true }],
  audience: { seniority: "Executive", size: 1, format: "Video call" },
  intelligence: {
    clientObjectives: ["Formalize succession planning for the family's charitable vehicle."],
    painPoints: [
      {
        id: "pp-no-trust-structure",
        label: "No formal trust structure for the philanthropic vehicle",
        detail: "Charitable distributions are currently managed ad hoc without a dedicated trust structure.",
        severity: "Medium",
      },
    ],
    stakeholders: [
      { name: "Wei Chen", role: "Family CFO", influence: "Decision maker", stance: "Skeptical", notes: "Ultimately decided to keep trust services in-house with existing counsel." },
    ],
    relationshipHistory: "Raised during the same manager re-underwriting cycle as the private credit conversation.",
    decisionCriteria: ["Cost relative to the existing in-house counsel arrangement"],
    competitive: {
      incumbents: ["Existing in-house family counsel"],
      competitiveNote: "The family already has a trusted in-house counsel relationship for trust matters.",
      threatLevel: "High",
    },
    marketContext: [],
  },
  knowledgeAttachments: [{ itemId: "diff-dedicated-trust-officer", attachedAt: "2026-06-05T09:00:00.000Z" }],
  solution: [
    {
      id: "sol-chen-trust-1",
      capabilityId: "trust-estate-planning",
      painPointId: "pp-no-trust-structure",
      rationale: "Introduce a formal trust structure for the philanthropic vehicle, coordinated with existing counsel.",
      differentiation: "One trust officer stays with the family across generations, rather than an ad hoc arrangement.",
    },
  ],
  narrative: approvedNarrative(
    {
      pointOfView: "Chen Family Office's charitable distributions are still managed ad hoc, without the formal trust structure the rest of the relationship now has.",
      coreMessage: "A formal trust structure for the philanthropic vehicle closes the one gap left in an otherwise consolidated relationship.",
      problemImpact: "Without a dedicated structure, succession planning for the charitable vehicle depends on informal arrangements rather than a documented trust.",
      solutionStory: "We're recommending a formal Trust & Estate Planning engagement for the philanthropic vehicle, coordinated directly with your existing counsel rather than replacing them.",
      callToAction: "Let's set up a short call with your counsel to scope the structure together.",
    },
    "2026-06-10T09:00:00.000Z",
  ),
  assets: {
    deckOutline: [
      { title: "Point of view", bullets: ["Charitable distributions are still managed ad hoc."], sourceNarrativeSectionId: "pointOfView" },
      { title: "Core message", bullets: ["A formal trust structure closes the last gap in the relationship."], sourceNarrativeSectionId: "coreMessage" },
      { title: "Problem & impact", bullets: ["Succession planning for the charitable vehicle relies on informal arrangements."], sourceNarrativeSectionId: "problemImpact" },
      { title: "Solution story", bullets: ["Recommended: Trust & Estate Planning", "Coordinated with existing counsel, not a replacement."], sourceNarrativeSectionId: "solutionStory" },
      { title: "Next steps", bullets: ["Schedule a scoping call with counsel."], sourceNarrativeSectionId: "callToAction" },
    ],
    proposalSummary: "Chen Family Office's charitable vehicle still lacks a formal trust structure. We recommend a Trust & Estate Planning engagement coordinated with existing counsel.",
    executiveSummary: "Formal trust structure for the philanthropic vehicle, coordinated with existing counsel.",
    talkingPoints: ["One trust officer stays with the family across generations, unlike an ad hoc arrangement."],
    generatedAt: "2026-06-12T10:00:00.000Z",
  },
  rehearsal: [
    {
      id: "rehearsal-chen-trust-1",
      startedAt: "2026-06-15T13:00:00.000Z",
      completedAt: "2026-06-15T13:15:00.000Z",
      attempts: [
        rehearsalAttempt(
          "obj-trust-current-advisor-tenure",
          "We'd work alongside your existing counsel, not replace them.",
          3,
          "Solid",
          WEAK_CHECKS,
          "2026-06-15T13:10:00.000Z",
        ),
      ],
      messageGaps: [],
    },
  ],
  outcome: {
    result: "Lost",
    clientReactions: "CFO appreciated the offer but preferred to keep trust matters entirely in-house given the existing counsel relationship.",
    objectionsEncountered: ["We already have trusted counsel for trust matters."],
    lessonsLearned: "Leading with a displacement-adjacent pitch against an entrenched in-house relationship needed a stronger cost/continuity argument up front — we didn't quantify the gap clearly enough.",
    nextSteps: "Revisit if the in-house counsel relationship changes.",
    capturedAt: "2026-06-25T15:00:00.000Z",
  },
  createdAt: "2026-06-03T09:00:00.000Z",
  updatedAt: "2026-06-25T15:00:00.000Z",
};

// ---- 6. Chen Family Office — Reporting Rollout Phase 2 — OPEN, fully prepped, outcome pending ----
const CHEN_REPORTING_PHASE2: Opportunity = {
  id: "opp-chen-reporting-phase2",
  clientId: "chen-family",
  name: "Chen Family Office — Reporting Rollout Phase 2",
  pitchType: "Upsell",
  objective: "Extend consolidated reporting to the family's two satellite trusts.",
  scope: "Follow-on to the Phase 1 rollout, ahead of the next quarterly review.",
  attendees: [
    { name: "Wei Chen", role: "Family CFO", isDecisionMaker: true },
    { name: "Marcus Ellery", role: "Advisor", isDecisionMaker: false },
  ],
  audience: { seniority: "Executive", size: 2, format: "Video call" },
  intelligence: {
    clientObjectives: ["Extend the same fee-ledger transparency to the satellite trusts that the main entity already has."],
    painPoints: [
      {
        id: "pp-satellite-blind-spot",
        label: "Satellite trusts sit outside the consolidated view",
        detail: "The two satellite trusts still report on separate quarterly statements, outside the main consolidated fee ledger.",
        severity: "Medium",
      },
    ],
    stakeholders: [
      { name: "Wei Chen", role: "Family CFO", influence: "Decision maker", stance: "Supportive", notes: "Already sold on consolidated reporting from Phase 1." },
    ],
    relationshipHistory: "Direct follow-on to the successful Phase 1 rollout earlier this year.",
    decisionCriteria: ["Same real-time reporting standard as the main entity", "No added cost for the extension"],
    competitive: { incumbents: [], competitiveNote: "", threatLevel: "Low" },
    marketContext: [],
  },
  knowledgeAttachments: [
    { itemId: "cs-consolidated-reporting-rollout", attachedAt: "2026-07-10T09:00:00.000Z" },
    { itemId: "diff-real-time-reporting", attachedAt: "2026-07-10T09:05:00.000Z" },
  ],
  solution: [
    {
      id: "sol-chen-reporting2-1",
      capabilityId: "consolidated-reporting",
      painPointId: "pp-satellite-blind-spot",
      rationale: "Extend the same real-time consolidated reporting feed to both satellite trusts.",
      differentiation: "Real-time consolidated reporting across 12+ custodians, not a quarterly PDF — same standard already proven in Phase 1.",
    },
  ],
  narrative: approvedNarrative(
    {
      pointOfView: "Phase 1 gave Chen Family Office one real-time view of the main entity — the two satellite trusts are the one piece still sitting outside it.",
      coreMessage: "Extending consolidated reporting to both satellite trusts closes the last blind spot, at no added cost.",
      problemImpact: "The satellite trusts still report on separate quarterly statements, meaning the CFO's all-in view is incomplete exactly where oversight matters most for a growing structure.",
      solutionStory: "We're extending the existing Consolidated Reporting & Technology feed to both satellite trusts — same real-time standard already proven in Phase 1.",
      callToAction: "Let's confirm the extension scope this quarter so it's live before the next review.",
    },
    "2026-07-15T09:00:00.000Z",
  ),
  assets: {
    deckOutline: [
      { title: "Point of view", bullets: ["The two satellite trusts are the one piece still outside the consolidated view."], sourceNarrativeSectionId: "pointOfView" },
      { title: "Core message", bullets: ["Extend consolidated reporting to both satellite trusts, at no added cost."], sourceNarrativeSectionId: "coreMessage" },
      { title: "Problem & impact", bullets: ["Satellite trusts still report separately, leaving the CFO's view incomplete."], sourceNarrativeSectionId: "problemImpact" },
      { title: "Solution story", bullets: ["Recommended: Consolidated Reporting & Technology", "Same real-time standard already proven in Phase 1."], sourceNarrativeSectionId: "solutionStory" },
      { title: "Next steps", bullets: ["Confirm the extension scope this quarter."], sourceNarrativeSectionId: "callToAction" },
    ],
    proposalSummary: "Extending the proven Phase 1 consolidated reporting feed to the two satellite trusts, closing the last blind spot in the CFO's view, at no added cost.",
    executiveSummary: "Extend consolidated reporting to both satellite trusts at no added cost — same real-time standard as Phase 1.",
    talkingPoints: ["Real-time consolidated reporting across 12+ custodians, not a quarterly PDF.", "Already proven in Phase 1 with no disruption."],
    generatedAt: "2026-07-16T10:00:00.000Z",
  },
  rehearsal: [
    {
      id: "rehearsal-chen-reporting2-1",
      startedAt: "2026-07-18T14:00:00.000Z",
      completedAt: "2026-07-18T14:12:00.000Z",
      attempts: [
        rehearsalAttempt(
          "obj-timing-year-end",
          "This is a short extension of something already live, not a new project — we can have it ready well before year-end without adding to your plate now.",
          5,
          "Strong",
          STRONG_CHECKS,
          "2026-07-18T14:08:00.000Z",
        ),
      ],
      messageGaps: [],
    },
  ],
  outcome: null,
  createdAt: "2026-07-08T09:00:00.000Z",
  updatedAt: "2026-07-18T14:12:00.000Z",
};

// ---- 7. Adaeze Okafor — Phased Cash Deployment — WON ----
const OKAFOR_CASH_DEPLOYMENT: Opportunity = {
  id: "opp-okafor-cash-deployment",
  clientId: "okafor",
  name: "Adaeze Okafor — Phased Cash Deployment",
  pitchType: "New business",
  objective: "Deploy the 24% cash position into a diversified allocation without disrupting her retirement timeline.",
  scope: "First formal investment recommendation since onboarding.",
  attendees: [{ name: "Adaeze Okafor", role: "Client", isDecisionMaker: true }],
  audience: { seniority: "Individual contributor", size: 1, format: "Video call" },
  intelligence: {
    clientObjectives: ["Retire at 58 without reducing current lifestyle spend.", "Avoid repeating the market-timing anxiety felt in 2022."],
    painPoints: [
      {
        id: "pp-excess-cash",
        label: "Excess cash drag",
        detail: "24% cash sits well above the 8% target — the single biggest drag on hitting the retirement-funding projection.",
        severity: "High",
      },
      {
        id: "pp-timing-anxiety",
        label: "Market-timing anxiety",
        detail: "Cautious about deploying capital after a rough 2022, following the sale of a business stake in 2025.",
        severity: "Medium",
      },
    ],
    stakeholders: [
      { name: "Adaeze Okafor", role: "Client", influence: "Decision maker", stance: "Neutral", notes: "Wants reassurance the deployment plan won't repeat 2022's stress." },
    ],
    relationshipHistory: "2-year relationship; first formal recommendation since onboarding.",
    decisionCriteria: ["Doesn't require deploying all cash at once", "Clear glidepath to the retirement-funding projection"],
    competitive: { incumbents: [], competitiveNote: "No competitive process — first advisory recommendation for this client.", threatLevel: "Low" },
    marketContext: ["Equities: earnings breadth improving — supports a case for phased entry rather than waiting on the sidelines."],
  },
  knowledgeAttachments: [
    { itemId: "rs-liquidity-after-business-sale", attachedAt: "2026-07-01T09:00:00.000Z" },
    { itemId: "pos-advice-led", attachedAt: "2026-07-01T09:05:00.000Z" },
  ],
  solution: [
    {
      id: "sol-okafor-cash-1",
      capabilityId: "goals-based-planning",
      painPointId: "pp-excess-cash",
      rationale: "Phased deployment plan tied explicitly to the retirement-funding projection, deployed over several tranches rather than all at once.",
      differentiation: "Every recommendation traces back to the stated retirement goal, not a generic model portfolio.",
    },
  ],
  narrative: approvedNarrative(
    {
      pointOfView: "Adaeze Okafor is sitting on 24% cash right now, and after 2022 the instinct is understandably to wait — but waiting is itself a cost against the retirement timeline.",
      coreMessage: "A phased deployment plan closes the cash-drag gap without asking her to relive 2022 all at once.",
      problemImpact: "Today, 24% cash sits well above the 8% target — that's the single biggest drag on hitting the retirement-funding projection, and it compounds every quarter it isn't addressed.",
      solutionStory: "We're recommending a phased deployment plan tied explicitly to the retirement-funding projection, moving capital in tranches rather than all at once.",
      callToAction: "Let's schedule a call this week to confirm the first tranche and timeline.",
    },
    "2026-07-05T09:00:00.000Z",
  ),
  assets: {
    deckOutline: [
      { title: "Point of view", bullets: ["24% cash sits idle; waiting is itself a cost against the retirement timeline."], sourceNarrativeSectionId: "pointOfView" },
      { title: "Core message", bullets: ["A phased deployment plan closes the gap without reliving 2022 all at once."], sourceNarrativeSectionId: "coreMessage" },
      { title: "Problem & impact", bullets: ["24% cash vs. an 8% target is the single biggest drag on the retirement projection."], sourceNarrativeSectionId: "problemImpact" },
      { title: "Solution story", bullets: ["Recommended: Goals-Based Financial Planning", "Every recommendation traces back to the stated retirement goal."], sourceNarrativeSectionId: "solutionStory" },
      { title: "Next steps", bullets: ["Confirm the first tranche and timeline this week."], sourceNarrativeSectionId: "callToAction" },
    ],
    proposalSummary: "Adaeze Okafor's 24% cash position is the single biggest drag on her retirement projection. We recommend a phased deployment plan, moving capital in tranches to avoid repeating 2022's stress.",
    executiveSummary: "Phased deployment of the 24% cash position, tied to the retirement-funding projection, tranche by tranche.",
    talkingPoints: ["Every recommendation traces back to the stated retirement goal, not a generic model portfolio."],
    generatedAt: "2026-07-06T10:00:00.000Z",
  },
  rehearsal: [
    {
      id: "rehearsal-okafor-cash-1",
      startedAt: "2026-07-08T13:00:00.000Z",
      completedAt: "2026-07-08T13:14:00.000Z",
      attempts: [
        rehearsalAttempt(
          "obj-timing-not-right-now",
          "That's exactly why this is phased, not all at once — we're not asking you to deploy the full 24% today, just the first tranche, on your timeline.",
          5,
          "Strong",
          STRONG_CHECKS,
          "2026-07-08T13:10:00.000Z",
        ),
      ],
      messageGaps: [],
    },
  ],
  outcome: {
    result: "Won",
    clientReactions: "Relieved the plan didn't require deploying all cash immediately; comfortable with the phased approach.",
    objectionsEncountered: ["This isn't the right time for us to make a change."],
    lessonsLearned: "Leading with 'phased, not all at once' defused the 2022 anxiety immediately.",
    nextSteps: "First tranche deployed next quarter; review after 90 days.",
    capturedAt: "2026-07-10T15:00:00.000Z",
  },
  createdAt: "2026-06-28T09:00:00.000Z",
  updatedAt: "2026-07-10T15:00:00.000Z",
};

// ---- 8. Adaeze Okafor — Alternatives Access Introduction — OPEN, just started ----
const OKAFOR_ALTERNATIVES: Opportunity = {
  id: "opp-okafor-alternatives",
  clientId: "okafor",
  name: "Adaeze Okafor — Alternatives Access Introduction",
  pitchType: "Upsell",
  objective: "",
  scope: "Follow-on conversation planned for a future review, once the cash deployment plan is underway.",
  attendees: [],
  audience: { seniority: "Individual contributor", size: 1, format: "Video call" },
  intelligence: {
    clientObjectives: ["Diversify beyond the core phased deployment plan once underway."],
    painPoints: [],
    stakeholders: [],
    relationshipHistory: "",
    decisionCriteria: [],
    competitive: { incumbents: [], competitiveNote: "", threatLevel: "Unknown" },
    marketContext: [],
  },
  knowledgeAttachments: [],
  solution: [],
  narrative: blankNarrative(),
  assets: null,
  rehearsal: [],
  outcome: null,
  createdAt: "2026-07-21T09:00:00.000Z",
  updatedAt: "2026-07-21T09:00:00.000Z",
};

// ---- 9. Eleanor & James Pryce — Conservative Income Ladder — OPEN, mid-progress ----
const PRYCE_INCOME_LADDER: Opportunity = {
  id: "opp-pryce-income-ladder",
  clientId: "pryce",
  name: "Eleanor & James Pryce — Conservative Income Ladder",
  pitchType: "New business",
  objective: "Build a laddered fixed-income allocation to cover school fees over the next six years.",
  scope: "Second review since onboarding, building on the initial conservative allocation.",
  attendees: [
    { name: "Eleanor Pryce", role: "Client", isDecisionMaker: true },
    { name: "James Pryce", role: "Client", isDecisionMaker: true },
  ],
  audience: { seniority: "Individual contributor", size: 2, format: "In-person" },
  intelligence: {
    clientObjectives: ["Preserve capital and cover school fees over the next six years."],
    painPoints: [
      {
        id: "pp-fee-volatility-anxiety",
        label: "Fee and volatility anxiety",
        detail: "Nervous about fees and volatility after moving off a DIY platform as first-time managed-portfolio clients.",
        severity: "Medium",
      },
    ],
    stakeholders: [
      { name: "Eleanor Pryce", role: "Client", influence: "Decision maker", stance: "Supportive", notes: "Responded well to full fee transparency at onboarding." },
      { name: "James Pryce", role: "Client", influence: "Decision maker", stance: "Neutral", notes: "More cautious of the two." },
    ],
    relationshipHistory: "1-year relationship. First-time managed-portfolio clients, nervous about fees and volatility after moving off a DIY platform.",
    decisionCriteria: ["Full fee transparency", "Matches the six-year school-fee timeline", "Low volatility"],
    competitive: { incumbents: [], competitiveNote: "", threatLevel: "Low" },
    marketContext: ["Credit: spreads tight but resilient — technical backdrop supportive for laddered exposure."],
  },
  knowledgeAttachments: [{ itemId: "rs-first-time-managed-portfolio", attachedAt: "2026-07-12T09:00:00.000Z" }],
  solution: [
    {
      id: "sol-pryce-ladder-1",
      capabilityId: "goals-based-planning",
      painPointId: "pp-fee-volatility-anxiety",
      rationale: "A laddered fixed-income allocation timed to the six-year school-fee need, avoiding market-timing risk.",
      differentiation: "Every recommendation ties back to the stated six-year goal, with full fee transparency shown up front.",
    },
  ],
  narrative: blankNarrative(),
  assets: null,
  rehearsal: [],
  outcome: null,
  createdAt: "2026-07-12T09:00:00.000Z",
  updatedAt: "2026-07-19T11:00:00.000Z",
};

// ---- 10. Eleanor & James Pryce — Fee Transparency Follow-up — LOST ----
const PRYCE_FEE_FOLLOWUP: Opportunity = {
  id: "opp-pryce-fee-followup",
  clientId: "pryce",
  name: "Eleanor & James Pryce — Fee Transparency Follow-up",
  pitchType: "Renewal",
  objective: "Retain the relationship after a competitor discount platform quoted a lower headline fee.",
  scope: "Annual review triggered a fee comparison conversation.",
  attendees: [{ name: "James Pryce", role: "Client", isDecisionMaker: true }],
  audience: { seniority: "Individual contributor", size: 1, format: "Video call" },
  intelligence: {
    clientObjectives: ["Keep costs low without giving up personalized advice."],
    painPoints: [
      {
        id: "pp-fee-comparison",
        label: "Competitor fee comparison",
        detail: "A discount platform quoted a materially lower headline fee during the annual review.",
        severity: "High",
      },
    ],
    stakeholders: [
      { name: "James Pryce", role: "Client", influence: "Decision maker", stance: "Skeptical", notes: "Ultimately moved a portion of assets to the discount platform." },
    ],
    relationshipHistory: "1-year relationship; fee-sensitive since onboarding.",
    decisionCriteria: ["Lowest all-in cost"],
    competitive: {
      incumbents: ["Discount brokerage platform"],
      competitiveNote: "Discount platform's headline fee undercut the discretionary mandate significantly.",
      threatLevel: "High",
    },
    marketContext: [],
  },
  knowledgeAttachments: [{ itemId: "cg-discount-platform-fee", attachedAt: "2026-06-28T09:00:00.000Z" }],
  solution: [
    {
      id: "sol-pryce-fee-1",
      capabilityId: "discretionary-advisory",
      painPointId: "pp-fee-comparison",
      rationale: "Reframe from headline fee to net-of-advice outcomes.",
      differentiation: "Dedicated advisor and tax-aware rebalancing the discount platform doesn't offer.",
    },
  ],
  narrative: approvedNarrative(
    {
      pointOfView: "A discount platform's headline fee looks compelling next to ours — until you count what it doesn't include.",
      coreMessage: "The real comparison isn't fee versus fee, it's net-of-advice outcome versus a bare execution platform.",
      problemImpact: "A lower headline fee, taken at face value, ignores the dedicated advisor and tax-aware rebalancing that come with the discretionary mandate.",
      solutionStory: "We're proposing to keep the current discretionary mandate, reframed around net-of-advice value rather than a fee-for-fee comparison.",
      callToAction: "Let's walk through a side-by-side net-of-fee comparison at the next review.",
    },
    "2026-06-29T09:00:00.000Z",
  ),
  assets: {
    deckOutline: [
      { title: "Point of view", bullets: ["A discount platform's headline fee looks compelling until you count what it doesn't include."], sourceNarrativeSectionId: "pointOfView" },
      { title: "Core message", bullets: ["Net-of-advice outcome, not fee versus fee, is the real comparison."], sourceNarrativeSectionId: "coreMessage" },
      { title: "Problem & impact", bullets: ["A lower headline fee ignores the dedicated advisor and tax-aware rebalancing already included."], sourceNarrativeSectionId: "problemImpact" },
      { title: "Solution story", bullets: ["Recommended: Discretionary Advisory Mandate", "Dedicated advisor and tax-aware rebalancing the discount platform doesn't offer."], sourceNarrativeSectionId: "solutionStory" },
      { title: "Next steps", bullets: ["Walk through a side-by-side net-of-fee comparison at the next review."], sourceNarrativeSectionId: "callToAction" },
    ],
    proposalSummary: "A discount platform quoted a lower headline fee. We recommend reframing the comparison around net-of-advice outcomes, not fee versus fee.",
    executiveSummary: "Net-of-advice value, not headline fee, is the right comparison against the discount platform quote.",
    talkingPoints: ["Dedicated advisor and tax-aware rebalancing the discount platform doesn't offer."],
    generatedAt: "2026-06-30T10:00:00.000Z",
  },
  rehearsal: [
    {
      id: "rehearsal-pryce-fee-1",
      startedAt: "2026-07-01T13:00:00.000Z",
      completedAt: "2026-07-01T13:12:00.000Z",
      attempts: [
        rehearsalAttempt(
          "obj-competitor-discount-platform",
          "I understand the headline number is appealing.",
          1,
          "Needs work",
          [
            ["Addresses the concern directly", false, "Response is a one-line deflection, not substantive."],
            ["Cites a relevant point", false, "Doesn't cite tax-aware rebalancing, advisor value, or any concrete number."],
            ["Confident, non-defensive tone", true, "Tone is fine, but there's nothing behind it."],
          ],
          "2026-07-01T13:08:00.000Z",
        ),
      ],
      messageGaps: ["Cites differentiation vs. an incumbent: States how this differs from the competitive alternative, not just what it is."],
    },
  ],
  outcome: {
    result: "Lost",
    clientReactions: "Price-sensitive; moved a portion of assets to the discount platform despite the value conversation.",
    objectionsEncountered: ["A discount platform quoted a much lower headline fee than you."],
    lessonsLearned: "The net-of-fee reframe needs a concrete number comparison, not just a values argument — the rehearsed response never got past a generic acknowledgment.",
    nextSteps: "Revisit in 6 months with a concrete net-of-fee comparison prepared in advance.",
    capturedAt: "2026-07-14T15:00:00.000Z",
  },
  createdAt: "2026-06-25T09:00:00.000Z",
  updatedAt: "2026-07-14T15:00:00.000Z",
};

export const SEED_OPPORTUNITIES: Opportunity[] = [
  HARRINGTON,
  HARRINGTON_SUCCESSION,
  HARRINGTON_STRUCTURED,
  CHEN_FAMILY_OFFICE,
  CHEN_TRUST_REFRESH,
  CHEN_REPORTING_PHASE2,
  OKAFOR_CASH_DEPLOYMENT,
  OKAFOR_ALTERNATIVES,
  PRYCE_INCOME_LADDER,
  PRYCE_FEE_FOLLOWUP,
];
