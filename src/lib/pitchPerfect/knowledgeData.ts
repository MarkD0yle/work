import type { KnowledgeItem } from "./types";

/* Governed knowledge library — the seeded "approved content" pool. At least
 * three items per category, cross-referencing the existing pitch feature's
 * client lore (lib/pitch/data.ts) so the two features feel like one world.
 * Nothing here is user-editable in this MVP; only browsing/attaching. */

export const KNOWLEDGE_LIBRARY: KnowledgeItem[] = [
  // ---- Positioning ----
  {
    id: "pos-advice-led",
    category: "Positioning",
    title: "Advice-led, not product-led",
    summary: "We position every conversation around the client's goal first — the product is the last thing decided, not the first.",
    body:
      "Lead with the client's stated objective and the gap between where they are and that objective. Only introduce a specific capability once the gap is named and agreed. This keeps the conversation from reading as a product pitch, and it's the reason the Recommendation section of any pitch should never appear before the client situation and market context sections.",
    tags: ["positioning", "advice-led", "discovery-first"],
    approved: true,
    relatedCapabilityIds: ["discretionary-advisory", "goals-based-planning"],
    lastReviewed: "2026-05-12",
  },
  {
    id: "pos-one-relationship",
    category: "Positioning",
    title: "One consolidated relationship across every account",
    summary: "Position the platform as the antidote to fragmented, multi-custodian relationships that no single advisor actually sees in full.",
    body:
      "Most prospects arrive with assets spread across several custodians and no one person who can see the whole picture. Our positioning is that we become the one relationship that actually aggregates and acts on the full picture, not another siloed account alongside the others.",
    tags: ["positioning", "consolidation", "multi-custodian"],
    approved: true,
    relatedCapabilityIds: ["multi-custodian-platform", "consolidated-reporting"],
    lastReviewed: "2026-04-30",
  },
  {
    id: "pos-institutional-alts",
    category: "Positioning",
    title: "Alternatives with institutional-grade due diligence",
    summary: "Position private-market access as underwritten in-house, not resold from a third-party fund-of-funds wrapper.",
    body:
      "When a client asks about private credit or private equity access, position it as our own underwriting team doing the diligence, not a marked-up pass-through of someone else's fund. This is the single most defensible answer to 'why not just go direct.'",
    tags: ["positioning", "alternatives", "private credit", "due diligence"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access"],
    lastReviewed: "2026-06-02",
  },

  // ---- Differentiator ----
  {
    id: "diff-dedicated-trust-officer",
    category: "Differentiator",
    title: "One dedicated trust officer per family, across generations",
    summary: "Unlike firms that rotate relationship managers, a family keeps the same trust officer across a multi-generational transfer.",
    body:
      "Continuity of the relationship across a wealth transfer is consistently cited by long-tenured families as the reason they stayed. Use this specifically when a competitor is positioning around a bigger platform or lower headline fee — continuity is the thing they can't easily match.",
    tags: ["differentiator", "trust", "continuity", "multi-generational"],
    approved: true,
    relatedCapabilityIds: ["trust-estate-planning"],
    lastReviewed: "2026-05-20",
  },
  {
    id: "diff-in-house-underwriting",
    category: "Differentiator",
    title: "In-house private credit underwriting team",
    summary: "Every loan in the Private Credit Income Fund is underwritten by our own team, not passed through from an external manager.",
    body:
      "Competing private-credit offers are frequently a wrapped fund-of-funds — an extra layer of fees and a diligence process the client can't see into. Our underwriting is in-house and the diligence memo for any position is available on request.",
    tags: ["differentiator", "private credit", "underwriting", "fees"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access"],
    lastReviewed: "2026-06-10",
  },
  {
    id: "diff-real-time-reporting",
    category: "Differentiator",
    title: "Real-time consolidated reporting across 12+ custodians",
    summary: "Live position and performance data across every custodian a client uses, not a quarterly PDF reconciliation.",
    body:
      "Most competitors still produce a quarterly statement. Ours is live — a CFO or family office controller can log in the same day a trade settles and see the consolidated position, with one all-in fee ledger across every manager.",
    tags: ["differentiator", "reporting", "technology", "fee transparency"],
    approved: true,
    relatedCapabilityIds: ["consolidated-reporting", "multi-custodian-platform"],
    lastReviewed: "2026-06-15",
  },

  // ---- Proof point ----
  {
    id: "pp-retention-rate",
    category: "Proof point",
    title: "94% of discretionary mandate clients retained 5+ years",
    summary: "Retention data for the Discretionary Growth/Balanced mandates, useful whenever tenure or trust is being questioned.",
    body:
      "94% of clients on a discretionary mandate for at least five years are still active clients today. Use this to counter 'how do I know this relationship will last' objections — it's a measured number, not a claim.",
    tags: ["proof point", "retention", "trust"],
    approved: true,
    relatedCapabilityIds: ["discretionary-advisory"],
    lastReviewed: "2026-05-01",
  },
  {
    id: "pp-private-credit-track-record",
    category: "Proof point",
    title: "Private Credit Income Fund: 9.2% net annualized, zero missed distributions",
    summary: "The fund's live track record since inception — use this whenever a client questions private credit's risk/return.",
    body:
      "Since inception, the Private Credit Income Fund has delivered a 9.2% net annualized return with zero missed quarterly distributions. Quarterly liquidity gates are disclosed up front in the subscription documents.",
    tags: ["proof point", "private credit", "track record", "yield"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access"],
    lastReviewed: "2026-06-18",
  },
  {
    id: "pp-onboarding-speed",
    category: "Proof point",
    title: "Average onboarding-to-first-trade: 11 business days",
    summary: "Speed benchmark for moving a client onto the multi-custodian platform.",
    body:
      "Across the last twelve months, the average time from signed onboarding paperwork to first trade executed on the multi-custodian platform was 11 business days — useful when timing objections come up ('this will take forever to set up').",
    tags: ["proof point", "onboarding", "speed", "timing"],
    approved: true,
    relatedCapabilityIds: ["multi-custodian-platform"],
    lastReviewed: "2026-04-22",
  },

  // ---- Case study ----
  {
    id: "cs-real-estate-concentration",
    category: "Case study",
    title: "Reducing a $180m family office's real-estate concentration from 40% to 24%",
    summary: "An 18-month case study of de-risking a concentrated real-estate position without a forced sale — directly applicable to Harrington-style situations.",
    body:
      "A family office arrived with real estate at 40% of assets, largely four directly-held properties. Over 18 months, a phased reallocation into the Private Credit Income Fund and a Buffered Equity Note brought the concentration down to 24% without a forced sale of any property, while maintaining the family's income distribution.",
    tags: ["case study", "concentration", "real estate", "de-risking", "harrington"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access", "structured-solutions-desk"],
    lastReviewed: "2026-05-28",
  },
  {
    id: "cs-consolidated-reporting-rollout",
    category: "Case study",
    title: "Consolidating 9 external managers onto one reporting feed",
    summary: "Cut a family office's quarterly review prep from three weeks to two days.",
    body:
      "A family office running 9 external managers across 5 custodians had no single view of total exposure or blended fees. Onboarding them onto the consolidated reporting platform cut quarterly review preparation from roughly three weeks of manual reconciliation to two days.",
    tags: ["case study", "consolidated reporting", "multi-manager", "efficiency"],
    approved: true,
    relatedCapabilityIds: ["consolidated-reporting"],
    lastReviewed: "2026-06-05",
  },
  {
    id: "cs-cfo-fee-renegotiation",
    category: "Case study",
    title: "Helping a newly-appointed family CFO cut blended fees 18bps while adding a private credit sleeve",
    summary: "A new CFO re-underwriting every manager relationship ended up adding exposure, not cutting it, once fees were made transparent.",
    body:
      "A newly-appointed CFO at a family office was re-underwriting every manager relationship and pushing hard on fee transparency. Once the consolidated fee ledger made the blended cost visible, the engagement shifted from a fee-cutting exercise to adding a private credit sleeve, netting an 18bps reduction in blended cost while improving income.",
    tags: ["case study", "fee transparency", "new cfo", "private credit", "chen"],
    approved: true,
    relatedCapabilityIds: ["consolidated-reporting", "private-credit-access"],
    lastReviewed: "2026-06-20",
  },

  // ---- Reference story ----
  {
    id: "rs-liquidity-after-business-sale",
    category: "Reference story",
    title: "A liquidity crunch after a business sale, solved with a phased drawdown plan",
    summary: "A comparable HNW client sitting on a large cash position after selling a business, nervous about market timing.",
    body:
      "A client who had recently sold a business stake was sitting on a large cash position and was cautious about market timing after a rough prior year. A phased entry plan — deploying capital over several tranches rather than all at once — let them build confidence in the process while still meeting their retirement-funding timeline.",
    tags: ["reference story", "liquidity", "business sale", "cash drag", "okafor"],
    approved: true,
    relatedCapabilityIds: ["goals-based-planning"],
    lastReviewed: "2026-05-15",
  },
  {
    id: "rs-first-time-managed-portfolio",
    category: "Reference story",
    title: "First-time managed-portfolio clients who were nervous about fees and volatility",
    summary: "A retail-segment couple, wary after moving off a DIY platform, became a long-tenured relationship after a phased, low-pressure start.",
    body:
      "A couple new to managed portfolios, nervous about fees and volatility after moving off a do-it-yourself platform, responded well to full fee transparency up front and a conservative, low-pressure first allocation. They remain long-tenured clients today.",
    tags: ["reference story", "first-time client", "fee transparency", "retail", "pryce"],
    approved: true,
    relatedCapabilityIds: ["goals-based-planning"],
    lastReviewed: "2026-04-10",
  },
  {
    id: "rs-institutional-diversification",
    category: "Reference story",
    title: "An institutional client diversifying away from single-manager concentration risk",
    summary: "How the alternatives access program was used to reduce reliance on a single external manager relationship.",
    body:
      "An institutional client had grown uncomfortable with how much of its alternatives exposure sat with a single external manager. The Private Credit Access Program let them diversify that exposure across underlying loans with in-house diligence, without giving up the yield profile they needed.",
    tags: ["reference story", "institutional", "concentration", "diversification", "private credit"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access"],
    lastReviewed: "2026-06-01",
  },

  // ---- Competitive guidance ----
  {
    id: "cg-direct-pe-coinvest",
    category: "Competitive guidance",
    title: "Countering a direct private-equity co-invest pitch from a rival family office",
    summary: "Approved talking points for when a rival family office has pitched a direct PE co-invest program.",
    body:
      "Direct co-invest deals concentrate risk into single-name exposure with no ongoing underwriting after close, and typically require the client to do their own diligence on each deal. Position the Private Credit Access Program as a diversified alternative with continuous in-house underwriting, rather than arguing against alternatives exposure altogether — the client's appetite for alternatives is a fact to work with, not a fact to fight.",
    tags: ["competitive guidance", "direct pe co-invest", "rival family office", "harrington"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access"],
    lastReviewed: "2026-06-22",
  },
  {
    id: "cg-discount-platform-fee",
    category: "Competitive guidance",
    title: "When a prospect cites a lower headline fee from a discount platform",
    summary: "Approved response for headline-fee comparisons against a robo-advisor or discount brokerage.",
    body:
      "Never dispute the headline number directly. Reframe to net-of-fee, net-of-advice outcomes: a discount platform's fee doesn't include a dedicated advisor, tax-aware rebalancing, or the consolidated reporting that catches concentration risk before it compounds. Cite the discretionary mandate retention proof point rather than a fee-vs-fee argument.",
    tags: ["competitive guidance", "discount platform", "fee objection", "robo-advisor"],
    approved: true,
    relatedCapabilityIds: ["discretionary-advisory"],
    lastReviewed: "2026-05-30",
  },
  {
    id: "cg-go-direct-to-fund",
    category: "Competitive guidance",
    title: "Responding to 'why not just go direct to the fund manager' for private credit",
    summary: "Approved response when a client asks why they shouldn't bypass us and invest directly with the underlying fund.",
    body:
      "Going direct means the client takes on the manager-selection and ongoing-monitoring work themselves, with no consolidated view against the rest of the portfolio. Position our role as the underwriting, sizing, and monitoring layer — the in-house underwriting team differentiator is the concrete answer here, not a generic 'we add value' claim.",
    tags: ["competitive guidance", "go direct", "private credit", "disintermediation"],
    approved: true,
    relatedCapabilityIds: ["private-credit-access"],
    lastReviewed: "2026-06-25",
  },
];
