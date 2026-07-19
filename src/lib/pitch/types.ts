/* Shared types for the Pitch Builder / Pitch Library feature.
 *
 * The flow: pick a client → gather internal data (CRM/portfolio/market,
 * mocked) → draft the pitch section by section → each section is reviewed by
 * a rule-based "AI reviewer" and can be improved in place → compile into a
 * report → grade the whole pitch → save to the library. Everything is
 * client-side and persisted to localStorage. */

export type ClientSegment = "Retail" | "Affluent" | "HNW" | "Institutional";
export type RiskProfile = "Conservative" | "Balanced" | "Growth" | "Aggressive";
export type LiquidityNeed = "Low" | "Medium" | "High";

export type Client = {
  id: string;
  name: string;
  segment: ClientSegment;
  advisor: string;
  aum: number;
  riskProfile: RiskProfile;
  primaryGoal: string;
  liquidityNeed: LiquidityNeed;
  tenureYears: number;
  lastContact: string;
  relationshipNote: string;
  competitorPressure?: string;
};

export type AllocationLine = {
  assetClass: string;
  currentPct: number;
  targetPct: number;
};

export type PortfolioSnapshot = {
  asOf: string;
  totalValue: number;
  ytdReturnPct: number;
  benchmarkReturnPct: number;
  cashDragPct: number;
  allocation: AllocationLine[];
  concentrationFlags: string[];
};

export type ProductCategory =
  | "Discretionary mandate"
  | "Fund"
  | "Structured product"
  | "Direct fixed income"
  | "Cash & liquidity";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  riskBand: RiskProfile;
  minInvestment: number;
  feeBps: number;
  liquidity: LiquidityNeed;
  blurb: string;
  suitableFor: RiskProfile[];
};

export type MarketNote = {
  headline: string;
  detail: string;
  asOf: string;
};

export type InternalData = {
  client: Client;
  portfolio: PortfolioSnapshot;
  recommendedProducts: Product[];
  marketNotes: MarketNote[];
  complianceFlags: string[];
};

export type SectionId =
  | "situation"
  | "market"
  | "recommendation"
  | "impact"
  | "risks"
  | "close";

export type SectionStatus = "empty" | "drafted" | "reviewed" | "approved";

export type ReviewCheck = {
  label: string;
  pass: boolean;
  note: string;
};

export type ReviewBand = "Needs work" | "Solid" | "Strong";

export type SectionReview = {
  checks: ReviewCheck[];
  band: ReviewBand;
  score: 1 | 3 | 5;
  suggestions: string[];
  reviewedAt: string;
};

export type PitchSection = {
  id: SectionId;
  content: string;
  status: SectionStatus;
  review: SectionReview | null;
  aiPasses: number;
};

export type PitchStatus = "draft" | "final";

export type GradeDimensionTag = "STRUCTURE" | "GOAL";
export type GradeBand = "Low" | "Mid" | "High" | "N/A";

export type GradeDimension = {
  key: string;
  label: string;
  tag: GradeDimensionTag;
  checks: { label: string; pass: boolean }[];
  band: GradeBand;
  score: number | null;
};

export type PitchGrade = {
  gatesPassed: boolean;
  gateFailures: string[];
  dimensions: GradeDimension[];
  overallScore: number | null;
  log: string[];
  gradedAt: string;
};

export type Pitch = {
  id: string;
  clientId: string;
  objective: string;
  data: InternalData;
  sections: Record<SectionId, PitchSection>;
  status: PitchStatus;
  grade: PitchGrade | null;
  createdAt: string;
  updatedAt: string;
};
