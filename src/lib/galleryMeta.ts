/* Gallery metadata.
 *
 * The File Gallery (src/pages/gallery.tsx) showcases every page in the app as
 * a thumbnail card — Dribbble / Pinterest style. Each page needs a short
 * description, a few filter tags, and a visual "motif" used to draw an
 * abstract thumbnail (we have no real screenshots, so each card paints a
 * stylised preview hinting at the page's shape).
 *
 * Pages are auto-discovered, so anything missing here falls back to a sane
 * default derived from its section — new files still get a card. */

export type Motif =
  | "grid"
  | "chart"
  | "heatmap"
  | "form"
  | "calendar"
  | "flow"
  | "treemap"
  | "panel";

export type GalleryMeta = {
  description: string;
  tags: string[];
  motif: Motif;
};

/* Per-section accent — drives the thumbnail gradient and the section pill. */
export type Accent = { from: string; to: string };

export const SECTION_ACCENT: Record<string, Accent> = {
  operations: { from: "#6366f1", to: "#3b82f6" }, // indigo → blue
  risk: { from: "#f43f5e", to: "#f59e0b" }, // rose → amber
  trading: { from: "#10b981", to: "#14b8a6" }, // emerald → teal
  forms: { from: "#8b5cf6", to: "#d946ef" }, // violet → fuchsia
  wealth: { from: "#f59e0b", to: "#059669" }, // amber → emerald
  patterns: { from: "#06b6d4", to: "#6366f1" }, // cyan → indigo
  processing: { from: "#0ea5e9", to: "#22d3ee" }, // sky → cyan
  pitch: { from: "#0ea5e9", to: "#22c55e" }, // sky → green
  dashboards: { from: "#0f766e", to: "#4f46e5" }, // teal → indigo
  other: { from: "#64748b", to: "#475569" }, // slate
};

export function accentForSection(section: string): Accent {
  return SECTION_ACCENT[section] ?? SECTION_ACCENT.other;
}

/* Reasonable default motif per section, used for unmapped pages. */
const DEFAULT_MOTIF: Record<string, Motif> = {
  operations: "panel",
  risk: "chart",
  trading: "grid",
  forms: "form",
  wealth: "panel",
  patterns: "panel",
  processing: "flow",
  pitch: "flow",
  dashboards: "chart",
  other: "panel",
};

export const GALLERY_META: Record<string, GalleryMeta> = {
  // Operations
  "ops-overview": {
    description:
      "Operational control tower rolling up pipelines and monitors into one situational view.",
    tags: ["overview", "monitoring", "ops"],
    motif: "panel",
  },
  oversight: {
    description:
      "Supervisory oversight dashboard that aggregates desk health for management sign-off.",
    tags: ["oversight", "dashboard", "management"],
    motif: "panel",
  },
  "my-queue": {
    description:
      "Your personal action queue — red and amber monitors that are unowned or acked by you.",
    tags: ["queue", "ops", "actions"],
    motif: "grid",
  },
  "nav-signoff": {
    description:
      "NAV review and sign-off workflow with staged approvals and an audit trail.",
    tags: ["nav", "sign-off", "approval"],
    motif: "form",
  },
  reconciliation: {
    description:
      "Reconciliation workspace that matches and explains breaks across upstream sources.",
    tags: ["recon", "breaks", "matching"],
    motif: "grid",
  },
  "trade-investigation": {
    description:
      "Investigate a trade end to end with a forensic timeline and contextual evidence.",
    tags: ["investigation", "forensic", "trades"],
    motif: "flow",
  },
  "payments-center": {
    description:
      "Payments processing center with release queues, approvals and exception handling.",
    tags: ["payments", "queues", "approvals"],
    motif: "flow",
  },
  "corp-actions": {
    description:
      "Corporate actions tracker covering election windows, entitlements and impacts.",
    tags: ["corp actions", "events", "elections"],
    motif: "flow",
  },
  "settlement-timeline": {
    description:
      "Settlement lifecycle laid out as a timeline from trade capture through to settle.",
    tags: ["settlement", "timeline", "lifecycle"],
    motif: "flow",
  },

  // Risk & Exposure
  "credit-exposure": {
    description:
      "Credit exposure dashboard with limits, utilisation and trend lines by counterparty.",
    tags: ["credit", "exposure", "limits"],
    motif: "chart",
  },
  "counterparty-360": {
    description:
      "A single pane on a counterparty — exposure, limits and recent activity together.",
    tags: ["counterparty", "profile", "360"],
    motif: "panel",
  },
  "limit-monitor": {
    description:
      "Real-time limit monitoring with utilisation bars and breach alerting.",
    tags: ["limits", "alerts", "real-time"],
    motif: "chart",
  },
  "stress-scenarios": {
    description:
      "Run stress scenarios and read the P&L impact across portfolios side by side.",
    tags: ["stress", "scenarios", "p&l"],
    motif: "chart",
  },
  "exposure-treemap": {
    description:
      "Treemap of exposure concentration, sized by counterparty and grouped by sector.",
    tags: ["treemap", "concentration", "exposure"],
    motif: "treemap",
  },
  oprisk: {
    description:
      "Operational risk register tracking incidents, controls and residual ratings.",
    tags: ["op risk", "incidents", "controls"],
    motif: "grid",
  },
  "xva-desk": {
    description:
      "XVA desk view of CVA / DVA / FVA charges across netting sets and portfolios.",
    tags: ["xva", "derivatives", "valuation"],
    motif: "chart",
  },

  // Trading & Liquidity
  blotter: {
    description:
      "High-density trade blotter with live status, sortable columns and inline drilldown.",
    tags: ["ag-grid", "trades", "live"],
    motif: "grid",
  },
  "devextreme-blotter": {
    description:
      "Cross-asset execution blotter on DevExtreme DataGrid — banded columns, master detail and live prints.",
    tags: ["devextreme", "trades", "live"],
    motif: "grid",
  },
  "tca-execution": {
    description:
      "Transaction cost analysis benchmarking execution quality against arrival and VWAP.",
    tags: ["tca", "execution", "benchmarks"],
    motif: "chart",
  },
  "bestx-exceptions": {
    description:
      "Visual uplift of the BestX exception reports — a scannable report list plus a KPI-led results view with one sign convention.",
    tags: ["tca", "exceptions", "best-execution", "redesign"],
    motif: "chart",
  },
  "liquidity-ladder": {
    description:
      "Liquidity ladder bucketed by maturity and currency, with cumulative gap.",
    tags: ["liquidity", "ladder", "maturity"],
    motif: "chart",
  },
  "repo-financing": {
    description:
      "Repo financing book showing rates, haircuts and the collateral behind each trade.",
    tags: ["repo", "financing", "collateral"],
    motif: "chart",
  },
  "collateral-optimizer": {
    description:
      "Optimise collateral allocation across agreements under eligibility constraints.",
    tags: ["collateral", "optimisation", "eligibility"],
    motif: "chart",
  },
  ccymgmt: {
    description:
      "Currency management workspace for FX rates, positions and exposure.",
    tags: ["fx", "currency", "positions"],
    motif: "panel",
  },
  heatmap: {
    description:
      "Interactive exception heatmap across time of day and category, with drilldown.",
    tags: ["heatmap", "exceptions", "drilldown"],
    motif: "heatmap",
  },
  "tracs-heatmap": {
    description:
      "TRACS exception heatmap surfacing hotspots by stage and time window.",
    tags: ["heatmap", "tracs", "hotspots"],
    motif: "heatmap",
  },

  // Forms & Flows
  "client-onboarding": {
    description:
      "Multi-step client onboarding wizard with inline validation and a review step.",
    tags: ["onboarding", "wizard", "kyc"],
    motif: "form",
  },
  "counterparty-onboarding": {
    description:
      "Counterparty onboarding with document checks and a structured approval path.",
    tags: ["onboarding", "documents", "approval"],
    motif: "form",
  },
  "fund-connect": {
    description:
      "Client onboarding form with Excel import, a maker-checker state machine and a field-level audit trail.",
    tags: ["import", "review", "audit", "forms"],
    motif: "form",
  },
  "sign-up": {
    description: "Account sign-up flow with password rules and field validation.",
    tags: ["sign-up", "auth", "validation"],
    motif: "form",
  },
  settings: {
    description: "Application settings and preferences grouped into clear sections.",
    tags: ["settings", "preferences", "config"],
    motif: "form",
  },

  // Global Markets — trade lifecycle
  "gm-rfq-inbox": {
    description:
      "Sales & origination — an RFQ inbox with client tiering and a live quote composer for the incoming enquiry.",
    tags: ["rfq", "sales", "pre-trade", "lifecycle"],
    motif: "panel",
  },
  "gm-pretrade-checks": {
    description:
      "Pre-trade controls — a gate rail of credit, limit and compliance checks that must clear before an order releases.",
    tags: ["compliance", "limits", "pre-trade", "lifecycle"],
    motif: "form",
  },
  "gm-execution-desk": {
    description:
      "Execution — a dark desk terminal with order ticket, market depth and a live prints tape.",
    tags: ["execution", "depth", "orders", "lifecycle"],
    motif: "grid",
  },
  "gm-trade-capture": {
    description:
      "Capture & booking — trades flowing across an enrichment pipeline board, with exceptions pulled out for repair.",
    tags: ["booking", "enrichment", "exceptions", "lifecycle"],
    motif: "flow",
  },
  "gm-confirmation-matching": {
    description:
      "Confirmation — a field-by-field match of our record against the counterparty's, mismatches called out for action.",
    tags: ["confirmation", "matching", "affirmation", "lifecycle"],
    motif: "grid",
  },
  "gm-clearing-margin": {
    description:
      "Clearing — CCP submission lanes with novation status and the margin calls each clearing house is asking for.",
    tags: ["clearing", "ccp", "margin", "lifecycle"],
    motif: "flow",
  },
  "gm-settlement-fails": {
    description:
      "Settlement — a fails workbench with ageing buckets, CSDR penalty accrual and a resolution rail per fail.",
    tags: ["settlement", "fails", "csdr", "lifecycle"],
    motif: "grid",
  },
  "gm-asset-servicing": {
    description:
      "Asset servicing — a fortnight schedule of coupons, dividends and rate resets across the book, with event detail.",
    tags: ["coupons", "dividends", "resets", "lifecycle"],
    motif: "calendar",
  },
  "gm-lifecycle-events": {
    description:
      "In-life events — a trade's amendments, novations and compression runs on one audit timeline with before/after deltas.",
    tags: ["novation", "compression", "audit", "lifecycle"],
    motif: "flow",
  },
  "gm-maturity-roll": {
    description:
      "Maturity — an expiry horizon board of positions rolling off, each with a roll, exercise or expire decision.",
    tags: ["maturity", "expiry", "roll", "lifecycle"],
    motif: "chart",
  },

  // Wealth & Clients
  "client-overview": {
    description:
      "Advisor's book at a glance — households, AUM, net new money and who's due a review.",
    tags: ["clients", "overview", "advisory"],
    motif: "panel",
  },
  "portfolio-performance": {
    description:
      "Time-weighted returns against benchmark, period table, monthly grid and attribution.",
    tags: ["performance", "returns", "benchmark"],
    motif: "chart",
  },
  "wealth-summary": {
    description:
      "Household net-worth statement — assets versus liabilities with a balance-sheet breakdown.",
    tags: ["wealth", "net worth", "balance sheet"],
    motif: "panel",
  },
  "asset-allocation": {
    description:
      "Current versus target allocation with drift bands and suggested rebalancing trades.",
    tags: ["allocation", "rebalance", "drift"],
    motif: "treemap",
  },
  "financial-goals": {
    description:
      "Goal-based planning — funding progress, projections and on-track status per goal.",
    tags: ["goals", "planning", "projection"],
    motif: "chart",
  },

  "highcharts-gallery": {
    description:
      "Ten Highcharts types over one trading book — drilldown columns, stacked area, bubbles, heatmap, treemap, sankey, gauge, radar, waterfall and candlestick, each with its own controls.",
    tags: ["highcharts", "charts", "interactive", "analytics"],
    motif: "chart",
  },

  // Patterns & Tools
  "pattern-gallery": {
    description:
      "A live harness wiring the reusable UI patterns — grid, context panel and modal.",
    tags: ["patterns", "components", "ui"],
    motif: "panel",
  },
  "right-panel-patterns": {
    description:
      "Ten contextual right panels from across global markets — ticket, tabs, triage, live depth, copilot and more.",
    tags: ["patterns", "panel", "trading", "ui"],
    motif: "panel",
  },
  "github-cheatsheet": {
    description:
      "Handy reference of the Git and GitHub commands you reach for most often.",
    tags: ["git", "reference", "cheatsheet"],
    motif: "grid",
  },
  "date-picker-business-day": {
    description:
      "Business-day date picker that honours holiday calendars when stepping dates.",
    tags: ["date", "calendar", "component"],
    motif: "calendar",
  },
  "date-picker-settlement": {
    description: "Settlement-date picker with T+n logic baked into the selection.",
    tags: ["date", "settlement", "component"],
    motif: "calendar",
  },
  "date-picker-range": {
    description:
      "Range date picker with presets and a dual-month view for quick spans.",
    tags: ["date", "range", "component"],
    motif: "calendar",
  },
  "kpi-trend-patterns": {
    description:
      "Three ways to show a KPI's trend: sparklines with a usual range, target tracks, and a breakdown of what drove the change.",
    tags: ["stats", "kpi", "trend", "component"],
    motif: "chart",
  },

  // Dashboards
  "loan-book-health": {
    description:
      "Retail lending book health: vintage delinquency curves, a roll-rate matrix and DPD buckets, filtered from a facet rail.",
    tags: ["dashboard", "lending", "credit risk", "delinquency"],
    motif: "chart",
  },
  "aml-alert-operations": {
    description:
      "Transaction-monitoring operations, from alert funnel to SAR, with backlog ageing, scenario productivity and a bulk-action investigator queue.",
    tags: ["dashboard", "aml", "compliance", "queue"],
    motif: "flow",
  },
  "fraud-control-room": {
    description:
      "Dark, live card-fraud wall: ticking counters, fraud bps against baseline, an hour-by-merchant heatmap and a streaming decision feed.",
    tags: ["dashboard", "fraud", "payments", "live"],
    motif: "heatmap",
  },
  "capital-adequacy": {
    description:
      "Regulatory capital report: ratios against the requirement stack, a CET1 bridge, RWA by business and leverage and liquidity trends.",
    tags: ["dashboard", "capital", "regulatory", "basel"],
    motif: "chart",
  },
  "claims-reserving": {
    description:
      "Insurance claims and reserving by line of business, around a chain-ladder loss triangle, combined ratio and a large-loss register.",
    tags: ["dashboard", "insurance", "reserving", "claims"],
    motif: "grid",
  },
  "fund-flows": {
    description:
      "Asset-manager distribution bento: net-flow hero, channel-to-asset-class sankey, flows by fund and the biggest client moves.",
    tags: ["dashboard", "asset management", "flows", "distribution"],
    motif: "flow",
  },
  "private-markets": {
    description:
      "LP commitments monitor: fund list to detail, J-curve cash flows, TVPI split into DPI and RVPI, and vintage quartile ranking.",
    tags: ["dashboard", "private equity", "commitments", "irr"],
    motif: "panel",
  },
  "fixed-income-portfolio": {
    description:
      "Bond portfolio against benchmark: yield curve with holdings, key-rate duration tilts and a cross-filtered holdings grid.",
    tags: ["dashboard", "fixed income", "duration", "ag-grid"],
    motif: "grid",
  },
  "climate-portfolio": {
    description:
      "Net-zero scorecard: implied temperature rise, decarbonisation pathway against target, financed-emissions treemap and an engagement tracker.",
    tags: ["dashboard", "esg", "climate", "emissions"],
    motif: "treemap",
  },
  "var-backtesting": {
    description:
      "VaR backtest over 250 days: P&L against VaR with exceptions, the Basel traffic light, desk small multiples and an exception log.",
    tags: ["dashboard", "market risk", "var", "backtesting"],
    motif: "chart",
  },
  "banking-book-rate-risk": {
    description:
      "IRRBB workbench: six Basel shocks against the 15% outlier test, gap ladder, NII vs base by month, ΔEVE waterfall, live behavioural sliders, hedges and limits.",
    tags: ["dashboard", "irrbb", "alm", "treasury"],
    motif: "chart",
  },
  "mortgage-pipeline": {
    description:
      "Mortgage origination stage board: six chevron stages against SLA, cohort funnel and heatmap, completions pacing, introducer league and an ageing case list.",
    tags: ["dashboard", "mortgages", "origination", "pipeline"],
    motif: "flow",
  },
  "settlement-fails": {
    description:
      "Intraday settlement fails console: fails by root cause, CSDR penalties by market, a counterparty × age heatmap that scopes an AG Grid blotter with bulk actions.",
    tags: ["dashboard", "custody", "settlement", "ag-grid"],
    motif: "grid",
  },
  "pension-funding": {
    description:
      "DB pension scheme funding: assets vs liabilities on three bases, the journey plan with a projection fan, LDI hedge gauges and a collateral stress table.",
    tags: ["dashboard", "pensions", "ldi", "funding"],
    motif: "chart",
  },
  "clo-surveillance": {
    description:
      "Six European CLOs: deal rail, capital stack, OC/IC bullets, quality tests, industry treemap, CCC trend and the next payment-date waterfall.",
    tags: ["dashboard", "clo", "structured credit", "surveillance"],
    motif: "panel",
  },

  // Sales & Pitch
  "pitch-builder": {
    description:
      "Build a client pitch section by section, with internal data auto-gathered, an AI reviewer scoring each section, and a full-pitch grade before you save it.",
    tags: ["pitch", "sales", "ai review"],
    motif: "flow",
  },
  "pitch-library": {
    description:
      "Every pitch saved from the Pitch Builder, browsable with its grade — open one to see the full compiled report.",
    tags: ["pitch", "library", "grading"],
    motif: "panel",
  },
};

/* Metadata for a slug, falling back to a section-derived default so every
 * auto-discovered page gets a usable card. */
export function metaForSlug(slug: string, section: string): GalleryMeta {
  const found = GALLERY_META[slug];
  if (found) return found;
  return {
    description: "A page in this workspace. Open it to explore.",
    tags: [section],
    motif: DEFAULT_MOTIF[section] ?? "panel",
  };
}
