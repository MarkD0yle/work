import type {
  Client,
  InternalData,
  MarketNote,
  PortfolioSnapshot,
  Product,
} from "./types";

/* Mocked "internal systems" — stands in for a CRM + PMS + research feed.
 * gatherInternalData() is the single entry point the builder calls once a
 * client is picked; it simulates pulling everything a rep would otherwise
 * hunt for across three different systems and hands back one bundle. */

export const CLIENTS: Client[] = [
  {
    id: "harrington",
    name: "The Harrington Trust",
    segment: "HNW",
    advisor: "Priya Desai",
    aum: 183_600_000,
    riskProfile: "Growth",
    primaryGoal: "Fund a multi-generational transfer while reducing concentration in real estate",
    liquidityNeed: "Low",
    tenureYears: 7,
    lastContact: "2026-06-30",
    relationshipNote:
      "Trustees meet quarterly. Last review flagged real-estate concentration (41% of assets) as an open concern.",
    competitorPressure: "A rival family office pitched a direct PE co-invest program last month.",
  },
  {
    id: "chen-family",
    name: "Chen Family Office",
    segment: "Institutional",
    advisor: "Marcus Ellery",
    aum: 62_400_000,
    riskProfile: "Balanced",
    primaryGoal: "Generate stable income to fund an annual philanthropic distribution",
    liquidityNeed: "Medium",
    tenureYears: 3,
    lastContact: "2026-07-10",
    relationshipNote:
      "New CFO joined in Q2 and is re-underwriting every manager relationship. Wants clear fee transparency.",
  },
  {
    id: "okafor",
    name: "Adaeze Okafor",
    segment: "Affluent",
    advisor: "Priya Desai",
    aum: 4_850_000,
    riskProfile: "Balanced",
    primaryGoal: "Retire at 58 without reducing current lifestyle spend",
    liquidityNeed: "Medium",
    tenureYears: 2,
    lastContact: "2026-07-14",
    relationshipNote:
      "Sold a business stake in 2025; sitting on 24% cash. Cautious about market timing after a rough 2022.",
  },
  {
    id: "pryce",
    name: "Eleanor & James Pryce",
    segment: "Retail",
    advisor: "Marcus Ellery",
    aum: 940_000,
    riskProfile: "Conservative",
    primaryGoal: "Preserve capital and cover school fees over the next six years",
    liquidityNeed: "High",
    tenureYears: 1,
    lastContact: "2026-07-02",
    relationshipNote:
      "First-time managed-portfolio clients. Nervous about fees and volatility after moving off a DIY platform.",
  },
];

const PORTFOLIOS: Record<string, PortfolioSnapshot> = {
  harrington: {
    asOf: "2026-06-30",
    totalValue: 183_600_000,
    ytdReturnPct: 6.8,
    benchmarkReturnPct: 8.1,
    cashDragPct: 1.4,
    allocation: [
      { assetClass: "Real estate", currentPct: 41, targetPct: 25 },
      { assetClass: "Public equity", currentPct: 22, targetPct: 30 },
      { assetClass: "Private equity", currentPct: 14, targetPct: 18 },
      { assetClass: "Fixed income", currentPct: 15, targetPct: 20 },
      { assetClass: "Cash", currentPct: 8, targetPct: 7 },
    ],
    concentrationFlags: [
      "Real estate is 16 points over target — largely four directly-held properties.",
      "No structured downside protection on the public equity sleeve.",
    ],
  },
  "chen-family": {
    asOf: "2026-06-30",
    totalValue: 62_400_000,
    ytdReturnPct: 4.9,
    benchmarkReturnPct: 4.3,
    cashDragPct: 3.1,
    allocation: [
      { assetClass: "Fixed income", currentPct: 38, targetPct: 40 },
      { assetClass: "Public equity", currentPct: 34, targetPct: 35 },
      { assetClass: "Private credit", currentPct: 9, targetPct: 12 },
      { assetClass: "Cash", currentPct: 12, targetPct: 6 },
      { assetClass: "Real estate", currentPct: 7, targetPct: 7 },
    ],
    concentrationFlags: [
      "Cash sits 6 points above target — a direct drag versus the distribution target.",
    ],
  },
  okafor: {
    asOf: "2026-06-30",
    totalValue: 4_850_000,
    ytdReturnPct: 5.2,
    benchmarkReturnPct: 6.0,
    cashDragPct: 5.8,
    allocation: [
      { assetClass: "Cash", currentPct: 24, targetPct: 8 },
      { assetClass: "Public equity", currentPct: 38, targetPct: 45 },
      { assetClass: "Fixed income", currentPct: 30, targetPct: 38 },
      { assetClass: "Private credit", currentPct: 8, targetPct: 9 },
    ],
    concentrationFlags: [
      "24% cash is well above the 8% target — the single biggest drag on hitting the retirement-funding projection.",
    ],
  },
  pryce: {
    asOf: "2026-06-30",
    totalValue: 940_000,
    ytdReturnPct: 3.1,
    benchmarkReturnPct: 3.4,
    cashDragPct: 2.0,
    allocation: [
      { assetClass: "Fixed income", currentPct: 52, targetPct: 55 },
      { assetClass: "Public equity", currentPct: 30, targetPct: 30 },
      { assetClass: "Cash", currentPct: 18, targetPct: 15 },
    ],
    concentrationFlags: [],
  },
};

export const PRODUCTS: Product[] = [
  {
    id: "disc-growth",
    name: "Discretionary Growth Mandate",
    category: "Discretionary mandate",
    riskBand: "Growth",
    minInvestment: 5_000_000,
    feeBps: 65,
    liquidity: "Medium",
    blurb: "Actively managed global multi-asset mandate targeting benchmark-plus returns.",
    suitableFor: ["Growth", "Aggressive"],
  },
  {
    id: "disc-balanced",
    name: "Balanced Income Mandate",
    category: "Discretionary mandate",
    riskBand: "Balanced",
    minInvestment: 1_000_000,
    feeBps: 55,
    liquidity: "Medium",
    blurb: "Multi-asset mandate weighted toward income generation with moderate growth.",
    suitableFor: ["Balanced", "Growth"],
  },
  {
    id: "priv-credit",
    name: "Private Credit Income Fund",
    category: "Fund",
    riskBand: "Growth",
    minInvestment: 2_000_000,
    feeBps: 140,
    liquidity: "Low",
    blurb: "Direct-lending fund targeting 8-10% net yield, quarterly liquidity gates.",
    suitableFor: ["Growth", "Aggressive"],
  },
  {
    id: "struct-buffer",
    name: "Buffered Equity Note (3yr)",
    category: "Structured product",
    riskBand: "Balanced",
    minInvestment: 250_000,
    feeBps: 90,
    liquidity: "Low",
    blurb: "Participates in equity upside to a cap with 15% downside buffer at maturity.",
    suitableFor: ["Balanced", "Growth"],
  },
  {
    id: "bond-ladder",
    name: "Investment-Grade Bond Ladder",
    category: "Direct fixed income",
    riskBand: "Conservative",
    minInvestment: 250_000,
    feeBps: 25,
    liquidity: "Medium",
    blurb: "Laddered maturities of high-grade bonds for predictable, scheduled cashflow.",
    suitableFor: ["Conservative", "Balanced"],
  },
  {
    id: "cash-plus",
    name: "Enhanced Cash & Liquidity Fund",
    category: "Cash & liquidity",
    riskBand: "Conservative",
    minInvestment: 50_000,
    feeBps: 15,
    liquidity: "High",
    blurb: "Short-duration fund for near-term spend, ahead of cash-management money market rates.",
    suitableFor: ["Conservative", "Balanced", "Growth", "Aggressive"],
  },
];

export const MARKET_NOTES: MarketNote[] = [
  {
    headline: "Rates: one cut priced for Q4",
    detail:
      "The market has moved to pricing a single 25bp cut this quarter, down from two at the start of the year — front-end yields have firmed accordingly.",
    asOf: "2026-07-17",
  },
  {
    headline: "Equities: earnings breadth improving",
    detail:
      "Q2 earnings beats have broadened beyond mega-cap tech for the first time in five quarters, supporting a case for diversifying single-name concentration.",
    asOf: "2026-07-16",
  },
  {
    headline: "Credit: spreads tight but resilient",
    detail:
      "Investment-grade spreads sit near cycle tights; issuance has been well absorbed, keeping the technical backdrop supportive for laddered exposure.",
    asOf: "2026-07-15",
  },
  {
    headline: "Real assets: private real estate marks lag",
    detail:
      "Private real-estate valuations continue to lag listed markets by 2-3 quarters, which understates true concentration risk in books still marked at cost.",
    asOf: "2026-07-12",
  },
];

/* Products the mandate would actually put in front of this client: matches
 * risk band and respects the client's stated liquidity need (no illiquid
 * fund recs for a High liquidity-need client). Capped at 3 so the section
 * stays a recommendation, not a product dump. */
function pickProducts(client: Client): Product[] {
  const matches = PRODUCTS.filter((p) => p.suitableFor.includes(client.riskProfile));
  const liquidityOk = matches.filter((p) => {
    if (client.liquidityNeed !== "High") return true;
    return p.liquidity !== "Low";
  });
  const pool = liquidityOk.length ? liquidityOk : matches;
  return pool.slice(0, 3);
}

function complianceFlags(client: Client, portfolio: PortfolioSnapshot, products: Product[]): string[] {
  const flags: string[] = [];
  if (client.liquidityNeed === "High" && products.some((p) => p.liquidity === "Low")) {
    flags.push("A recommended product has Low liquidity against a stated High liquidity need — suitability review required.");
  }
  if (portfolio.concentrationFlags.length > 0) {
    flags.push("Existing concentration flag(s) on file must be disclosed before recommending further single-asset exposure.");
  }
  if (client.segment === "Retail" && products.some((p) => p.minInvestment > 500_000)) {
    flags.push("A recommended product's minimum investment exceeds what's typical for this client segment — confirm suitability.");
  }
  return flags;
}

export function gatherInternalData(clientId: string): InternalData {
  const client = CLIENTS.find((c) => c.id === clientId) ?? CLIENTS[0];
  const portfolio = PORTFOLIOS[client.id];
  const recommendedProducts = pickProducts(client);
  return {
    client,
    portfolio,
    recommendedProducts,
    marketNotes: MARKET_NOTES,
    complianceFlags: complianceFlags(client, portfolio, recommendedProducts),
  };
}

export function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString("en-US")}`;
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
