import type {
  Opportunity,
  NarrativeSection,
  NarrativeSectionId,
  ObjectionAttempt,
  ReviewCheck,
} from "./types";
import { NARRATIVE_SECTION_ORDER } from "./opportunity";

/* Seeded opportunities so the list and Insights view aren't empty on first
 * load. Referenced against the real CLIENTS ids from lib/pitch/data.ts so
 * the two pitch features share one world. Narrative review/assets/rehearsal
 * values here are hand-authored historical records (plausible output of the
 * rule-based engines), not produced by calling them — the types only care
 * about shape, and seed data predates those engines existing in the module
 * graph. */

function checks(labels: [string, boolean, string][]): ReviewCheck[] {
  return labels.map(([label, pass, note]) => ({ label, pass, note }));
}

function approvedNarrative(
  content: Record<NarrativeSectionId, string>,
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
        reviewedAt: "2026-07-10T09:00:00.000Z",
      },
    };
  }
  return out;
}

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
  narrative: (() => {
    const empty = {} as Record<NarrativeSectionId, NarrativeSection>;
    for (const id of NARRATIVE_SECTION_ORDER) {
      empty[id] = { id, content: "", status: "empty", review: null, aiPasses: 0 };
    }
    return empty;
  })(),
  assets: null,
  rehearsal: [],
  outcome: null,
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-15T14:30:00.000Z",
};

function chenAttempt(
  objectionId: string,
  response: string,
  score: 1 | 3 | 5,
  band: "Needs work" | "Solid" | "Strong",
  checkList: [string, boolean, string][],
): ObjectionAttempt {
  return {
    objectionId,
    response,
    score,
    band,
    checks: checks(checkList),
    attemptedAt: "2026-06-20T15:00:00.000Z",
  };
}

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
          "Private Credit Income Fund sized to close the cash drag.",
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
        chenAttempt(
          "obj-price-what-am-i-paying-for",
          "I understand — that's exactly what the consolidated reporting fixes. You'll see one all-in fee ledger across every manager, updated in real time, instead of hunting through separate quarterly statements.",
          5,
          "Strong",
          [
            ["Addresses the concern directly", true, "Response engages with the fee-transparency concern rather than deflecting."],
            ["Cites a concrete proof point", true, "References the consolidated fee ledger and real-time reporting."],
            ["Confident, non-defensive tone", true, "Response doesn't read as apologetic or defensive."],
          ],
        ),
        chenAttempt(
          "obj-trust-sales-pitch-skepticism",
          "Fair question. Every recommendation here traces back to the cash-drag gap we identified in your own portfolio data, not a generic model.",
          3,
          "Solid",
          [
            ["Addresses the concern directly", true, "Engages with the skepticism rather than dismissing it."],
            ["Cites a concrete proof point", false, "Doesn't cite a specific number or case study."],
            ["Confident, non-defensive tone", true, "Reads as measured, not defensive."],
          ],
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

export const SEED_OPPORTUNITIES: Opportunity[] = [HARRINGTON, CHEN_FAMILY_OFFICE];
