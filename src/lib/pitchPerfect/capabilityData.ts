import type { Capability } from "./types";

/* Mocked capability/product/service catalog — stands in for a firm's
 * offering catalog. Spans all six CapabilityCategory values so Solution
 * mapping and Narrative drafting always have something relevant to draw on. */

export const CAPABILITY_CATALOG: Capability[] = [
  {
    id: "discretionary-advisory",
    name: "Discretionary Advisory Mandate",
    category: "Advisory",
    description: "Actively managed, fully discretionary mandate with a dedicated advisor and quarterly reviews.",
    typicalDifferentiators: [
      "One named advisor accountable for the whole relationship, not a rotating call-center model.",
      "Quarterly reviews benchmarked against the client's own stated goal, not just a market index.",
    ],
  },
  {
    id: "goals-based-planning",
    name: "Goals-Based Financial Planning",
    category: "Advisory",
    description: "Structured planning that ties every recommendation back to a named client goal (retirement, transfer, distribution).",
    typicalDifferentiators: [
      "Every recommendation is traceable to a specific stated goal, not a generic model portfolio.",
      "Plan is revisited at every review, not just at onboarding.",
    ],
  },
  {
    id: "multi-custodian-platform",
    name: "Multi-Custodian Investment Platform",
    category: "Investment platform",
    description: "Single platform aggregating positions and trading across every custodian the client uses.",
    typicalDifferentiators: [
      "One login and one statement across every custodian, instead of logging into each separately.",
      "Trades and rebalances across custodians from a single workflow.",
    ],
  },
  {
    id: "structured-solutions-desk",
    name: "Structured Solutions Desk",
    category: "Investment platform",
    description: "In-house desk building bespoke structured notes (buffers, participation notes) sized to a client's risk band.",
    typicalDifferentiators: [
      "Built in-house and priced transparently, not sourced from a third-party issuer with an embedded markup.",
      "Sized specifically to the client's existing risk band rather than an off-the-shelf note.",
    ],
  },
  {
    id: "securities-based-lending",
    name: "Securities-Based Lending",
    category: "Lending & liquidity",
    description: "Line of credit collateralized by the existing portfolio, for liquidity needs without triggering a taxable sale.",
    typicalDifferentiators: [
      "Avoids a forced or taxable sale to raise short-term liquidity.",
      "Rate priced off the pledged collateral mix, typically below an unsecured facility.",
    ],
  },
  {
    id: "consolidated-reporting",
    name: "Consolidated Reporting & Technology",
    category: "Reporting & technology",
    description: "Real-time consolidated reporting and an all-in fee ledger across every manager and custodian.",
    typicalDifferentiators: [
      "Real-time consolidated reporting across 12+ custodians, not a quarterly PDF.",
      "One all-in fee ledger across every manager — no hunting through separate statements to find the true cost.",
    ],
  },
  {
    id: "trust-estate-planning",
    name: "Trust & Estate Planning",
    category: "Trust & estate",
    description: "Multi-generational trust and estate structuring, coordinated with the family's external counsel.",
    typicalDifferentiators: [
      "A dedicated trust officer assigned to the family across generations, not a rotating relationship manager.",
      "Coordinates directly with the family's external counsel rather than working around them.",
    ],
  },
  {
    id: "private-credit-access",
    name: "Private Credit Access Program",
    category: "Alternative investments",
    description: "Direct-lending fund access with in-house underwriting, sized to close income or concentration gaps.",
    typicalDifferentiators: [
      "In-house underwriting team vets every loan, rather than a wrapped fund-of-funds passing through a third party's diligence.",
      "Quarterly liquidity gates are disclosed up front, not buried in a subscription document.",
    ],
  },
];
