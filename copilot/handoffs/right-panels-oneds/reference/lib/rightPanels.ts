/* Right-panel pattern catalogue.
 *
 * Ten contextual right panels drawn from across a global markets division —
 * front office execution, the risk seat, middle-office settlements, research
 * and sales. They exist to contrast *patterns*, so each one answers a
 * different question about the same piece of chrome:
 *
 *   - What is the panel FOR?      inspect · transact · triage · compose
 *   - How much does it hold?      one view · tabs · a scrolling feed
 *   - Who owns the next action?   read-only · one primary · batch · none
 *   - Does it change on its own?  static · streaming · generated
 *
 * Each entry pairs a panel with a plausible host surface, because a right
 * panel is only ever as good as its relationship to what sits left of it.
 */

export type PanelId =
  | "order-ticket"
  | "instrument-reference"
  | "counterparty-360"
  | "limit-breach"
  | "market-depth"
  | "research-copilot"
  | "trade-lifecycle"
  | "bulk-allocation"
  | "screen-filters"
  | "desk-commentary";

/** The design pattern the example is demonstrating. */
export type PanelPattern =
  | "Transactional"
  | "Informational"
  | "Tabbed"
  | "Triage"
  | "Live data"
  | "AI assist"
  | "Timeline"
  | "Bulk action"
  | "Filter"
  | "Collaboration";

/** The shape of the work surface the panel docks beside. */
export type HostKind = "blotter" | "board" | "ladder" | "doc" | "chart";

export type PanelExample = {
  id: PanelId;
  /** Ordinal shown in the rail — these are examples, so they're numbered. */
  n: number;
  name: string;
  pattern: PanelPattern;
  desk: string;
  /** One line on what the panel is for. */
  summary: string;
  /** The design argument — why this shape, and what it trades away. */
  rationale: string;
  host: HostKind;
  hostTitle: string;
  hostSubtitle: string;
  /** Panels are sized to their content; the variance is part of the lesson. */
  width: number;
};

export const PANEL_EXAMPLES: PanelExample[] = [
  {
    id: "order-ticket",
    n: 1,
    name: "FX Order Ticket",
    pattern: "Transactional",
    desk: "FX Spot & Forwards",
    summary:
      "Stage and submit an order against the row selected in the blotter, without leaving the blotter.",
    rationale:
      "The panel owns one irreversible action, so the ticket pins Buy/Sell to the footer and keeps the live rate in view while you type. A modal would be defensible here — it isn't used because the trader needs to keep watching the book behind them.",
    host: "blotter",
    hostTitle: "FX Order Blotter",
    hostSubtitle: "Working orders · G10 spot",
    width: 380,
  },
  {
    id: "instrument-reference",
    n: 2,
    name: "Instrument Reference",
    pattern: "Informational",
    desk: "Credit Trading",
    summary:
      "Read-only security master for the bond under the cursor — terms, ratings, identifiers.",
    rationale:
      "Pure reference. No primary action at all, which is the point: dense key/value rows, copyable identifiers, and utility actions demoted to the footer so nothing here can be mistaken for a decision.",
    host: "blotter",
    hostTitle: "Credit Universe",
    hostSubtitle: "EUR IG · 2,481 instruments",
    width: 360,
  },
  {
    id: "counterparty-360",
    n: 3,
    name: "Counterparty 360",
    pattern: "Tabbed",
    desk: "Credit Risk",
    summary:
      "Everything the desk knows about one counterparty, split across four tabs in a fixed-width column.",
    rationale:
      "Four unrelated bodies of content, one subject. Tabs keep the panel to a single scroll and let the reader choose depth; the header carries the identity so it survives every tab switch.",
    host: "blotter",
    hostTitle: "Counterparty Exposure",
    hostSubtitle: "Group-wide · EOD 16 Aug",
    width: 400,
  },
  {
    id: "limit-breach",
    n: 4,
    name: "Limit Breach Triage",
    pattern: "Triage",
    desk: "Market Risk",
    summary:
      "A hard-limit breach with its contributing positions, escalation path and the three ways out.",
    rationale:
      "Severity is loud — accent edge, dot, tone — because this panel interrupts. Actions are ranked (acknowledge, escalate, request increase) rather than presented as equals, and the audit note is mandatory before anything commits.",
    host: "board",
    hostTitle: "Risk Limit Monitor",
    hostSubtitle: "Rates & FX · intraday",
    width: 380,
  },
  {
    id: "market-depth",
    n: 5,
    name: "Market Depth",
    pattern: "Live data",
    desk: "Cash Equities",
    summary:
      "Streaming Level 2 ladder, spread and microstructure stats for the selected line.",
    rationale:
      "The only panel that changes without input. Values update in place rather than re-ordering, the row count is fixed so nothing jumps under the cursor, and there is no action — it is an instrument, not a form.",
    host: "ladder",
    hostTitle: "Equity Watchlist",
    hostSubtitle: "LSE · live",
    width: 340,
  },
  {
    id: "research-copilot",
    n: 6,
    name: "Research Copilot",
    pattern: "AI assist",
    desk: "Rates Strategy",
    summary:
      "Ask a question of the note you're reading; answers cite the paragraph they came from.",
    rationale:
      "Generated content earns less trust than fetched content, so every claim is anchored to a citation, the model's state is explicit, and each answer carries a feedback control. Suggested prompts do the cold-start work.",
    host: "doc",
    hostTitle: "EUR Rates Weekly",
    hostSubtitle: "Published 15 Aug · Strategy",
    width: 400,
  },
  {
    id: "trade-lifecycle",
    n: 7,
    name: "Trade Lifecycle",
    pattern: "Timeline",
    desk: "Middle Office",
    summary:
      "Where a trade is in its post-execution path, and exactly which step failed.",
    rationale:
      "A vertical stepper reads as chronology in a way a table cannot. The failed step is expanded in place with its remedy attached, so diagnosis and repair happen without a second navigation.",
    host: "blotter",
    hostTitle: "Settlement Exceptions",
    hostSubtitle: "T+1 · 41 open",
    width: 380,
  },
  {
    id: "bulk-allocation",
    n: 8,
    name: "Bulk Allocation",
    pattern: "Bulk action",
    desk: "Program Trading",
    summary:
      "Acts on a selection rather than a record — aggregates first, then batch actions.",
    rationale:
      "The subject is a set, so the panel leads with what the set adds up to and flags the members that will behave differently. Destructive batch actions confirm inline, and every row stays individually removable.",
    host: "blotter",
    hostTitle: "Block Allocation",
    hostSubtitle: "Program 4417 · 62 fills",
    width: 380,
  },
  {
    id: "screen-filters",
    n: 9,
    name: "Screen Filters",
    pattern: "Filter",
    desk: "Cross-Asset Sales",
    summary:
      "Faceted query builder that narrows the screen behind it, with saved views on top.",
    rationale:
      "The panel modifies the surface instead of describing it, so the result count updates as you go and the footer's Apply/Reset is the only committing step. Active facets stay visible as removable chips.",
    host: "blotter",
    hostTitle: "Cross-Asset Screener",
    hostSubtitle: "716 of 8,730 instruments · applied view",
    width: 340,
  },
  {
    id: "desk-commentary",
    n: 10,
    name: "Desk Commentary",
    pattern: "Collaboration",
    desk: "Equity Derivatives",
    summary:
      "Threaded desk discussion attached to a position, with the compliance notice it needs.",
    rationale:
      "People, not data. The composer is pinned to the footer, the thread scrolls oldest-to-newest above it, and the surveillance banner sits where it cannot be scrolled past — regulated chat has to say it is recorded.",
    host: "chart",
    hostTitle: "Vol Surface — SX5E",
    hostSubtitle: "Position review · Dec 26",
    width: 380,
  },
];

export function exampleById(id: PanelId): PanelExample {
  const found = PANEL_EXAMPLES.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown panel example: ${id}`);
  return found;
}

/* ------------------------------------------------------- host fixtures */

export type HostColumn = {
  key: string;
  label: string;
  align?: "right";
  /** Renders muted so the eye lands on the identifying columns. */
  muted?: boolean;
};

export type HostRow = {
  id: string;
  cells: Record<string, string>;
  /** Drives the row's left stripe on exception-style hosts. */
  tone?: "positive" | "negative" | "warn" | "neutral";
};

export type HostTable = { columns: HostColumn[]; rows: HostRow[] };

/* One table per host so the surface behind each panel is plausibly the
 * surface that would have produced it. Deliberately short — the host is
 * context, not the exhibit. */
export const HOST_TABLES: Record<PanelId, HostTable> = {
  "order-ticket": {
    columns: [
      { key: "pair", label: "Pair" },
      { key: "side", label: "Side" },
      { key: "notional", label: "Notional", align: "right" },
      { key: "rate", label: "Rate", align: "right" },
      { key: "status", label: "Status", muted: true },
    ],
    rows: [
      {
        id: "EURUSD",
        cells: {
          pair: "EUR/USD",
          side: "Buy",
          notional: "25,000,000",
          rate: "1.0842",
          status: "Working",
        },
      },
      {
        id: "GBPUSD",
        cells: {
          pair: "GBP/USD",
          side: "Sell",
          notional: "12,500,000",
          rate: "1.2731",
          status: "Working",
        },
      },
      {
        id: "USDJPY",
        cells: {
          pair: "USD/JPY",
          side: "Buy",
          notional: "40,000,000",
          rate: "147.82",
          status: "Partial",
        },
        tone: "warn",
      },
      {
        id: "AUDUSD",
        cells: {
          pair: "AUD/USD",
          side: "Sell",
          notional: "8,000,000",
          rate: "0.6614",
          status: "Filled",
        },
        tone: "positive",
      },
      {
        id: "USDCHF",
        cells: {
          pair: "USD/CHF",
          side: "Buy",
          notional: "15,000,000",
          rate: "0.8802",
          status: "Working",
        },
      },
    ],
  },
  "instrument-reference": {
    columns: [
      { key: "issuer", label: "Issuer" },
      { key: "coupon", label: "Cpn", align: "right" },
      { key: "maturity", label: "Maturity", muted: true },
      { key: "spread", label: "Z-spd", align: "right" },
      { key: "yield", label: "Yield", align: "right" },
    ],
    rows: [
      {
        id: "SIEM",
        cells: {
          issuer: "Siemens AG",
          coupon: "3.250",
          maturity: "15 Feb 31",
          spread: "+62",
          yield: "3.41",
        },
      },
      {
        id: "ENEL",
        cells: {
          issuer: "Enel SpA",
          coupon: "4.125",
          maturity: "20 Sep 33",
          spread: "+118",
          yield: "4.02",
        },
      },
      {
        id: "BMW",
        cells: {
          issuer: "BMW Finance NV",
          coupon: "3.625",
          maturity: "11 Jul 29",
          spread: "+74",
          yield: "3.52",
        },
      },
      {
        id: "SANFP",
        cells: {
          issuer: "Sanofi SA",
          coupon: "2.875",
          maturity: "04 Apr 30",
          spread: "+51",
          yield: "3.28",
        },
      },
      {
        id: "VOD",
        cells: {
          issuer: "Vodafone Group",
          coupon: "4.375",
          maturity: "30 May 32",
          spread: "+134",
          yield: "4.19",
        },
      },
    ],
  },
  "counterparty-360": {
    columns: [
      { key: "name", label: "Counterparty" },
      { key: "rating", label: "Rating", muted: true },
      { key: "current", label: "Current", align: "right" },
      { key: "limit", label: "Limit", align: "right" },
      { key: "util", label: "Util", align: "right" },
    ],
    rows: [
      {
        id: "NORDEA",
        cells: {
          name: "Nordea Bank Abp",
          rating: "AA-",
          current: "412.6m",
          limit: "600.0m",
          util: "69%",
        },
      },
      {
        id: "MIZUHO",
        cells: {
          name: "Mizuho Securities",
          rating: "A",
          current: "284.1m",
          limit: "450.0m",
          util: "63%",
        },
      },
      {
        id: "MACQ",
        cells: {
          name: "Macquarie Bank",
          rating: "A+",
          current: "531.9m",
          limit: "575.0m",
          util: "93%",
        },
        tone: "warn",
      },
      {
        id: "ITAU",
        cells: {
          name: "Itaú Unibanco",
          rating: "BBB-",
          current: "96.4m",
          limit: "150.0m",
          util: "64%",
        },
      },
      {
        id: "DNB",
        cells: {
          name: "DNB Bank ASA",
          rating: "AA-",
          current: "203.7m",
          limit: "400.0m",
          util: "51%",
        },
      },
    ],
  },
  "limit-breach": { columns: [], rows: [] },
  "market-depth": {
    columns: [
      { key: "ticker", label: "Ticker" },
      { key: "last", label: "Last", align: "right" },
      { key: "chg", label: "Chg", align: "right" },
      { key: "vol", label: "Volume", align: "right", muted: true },
    ],
    rows: [
      {
        id: "AZN",
        cells: { ticker: "AZN LN", last: "11,842", chg: "+0.94%", vol: "1.42m" },
        tone: "positive",
      },
      {
        id: "SHEL",
        cells: { ticker: "SHEL LN", last: "2,731", chg: "-0.41%", vol: "6.08m" },
        tone: "negative",
      },
      {
        id: "HSBA",
        cells: { ticker: "HSBA LN", last: "684.2", chg: "+0.12%", vol: "9.71m" },
        tone: "positive",
      },
      {
        id: "ULVR",
        cells: { ticker: "ULVR LN", last: "4,612", chg: "-0.28%", vol: "2.33m" },
        tone: "negative",
      },
      {
        id: "RIO",
        cells: { ticker: "RIO LN", last: "5,024", chg: "+1.36%", vol: "3.19m" },
        tone: "positive",
      },
    ],
  },
  "research-copilot": { columns: [], rows: [] },
  "trade-lifecycle": {
    columns: [
      { key: "trade", label: "Trade" },
      { key: "cpty", label: "Counterparty", muted: true },
      { key: "value", label: "Value", align: "right" },
      { key: "stage", label: "Failed at" },
    ],
    rows: [
      {
        id: "TRD-88412",
        cells: {
          trade: "TRD-88412",
          cpty: "Nordea Bank",
          value: "12.4m EUR",
          stage: "Matching",
        },
        tone: "negative",
      },
      {
        id: "TRD-88407",
        cells: {
          trade: "TRD-88407",
          cpty: "Mizuho Sec",
          value: "3.1m USD",
          stage: "Confirmation",
        },
        tone: "warn",
      },
      {
        id: "TRD-88399",
        cells: {
          trade: "TRD-88399",
          cpty: "Macquarie",
          value: "18.9m GBP",
          stage: "Matching",
        },
        tone: "negative",
      },
      {
        id: "TRD-88381",
        cells: {
          trade: "TRD-88381",
          cpty: "DNB Bank",
          value: "6.7m EUR",
          stage: "Allocation",
        },
        tone: "warn",
      },
    ],
  },
  "bulk-allocation": {
    columns: [
      { key: "fill", label: "Fill" },
      { key: "account", label: "Account" },
      { key: "qty", label: "Qty", align: "right" },
      { key: "px", label: "Price", align: "right" },
    ],
    rows: [
      {
        id: "F-1041",
        cells: { fill: "F-1041", account: "GRWTH-EU", qty: "42,000", px: "84.12" },
      },
      {
        id: "F-1042",
        cells: { fill: "F-1042", account: "PENS-UK-A", qty: "18,500", px: "84.14" },
      },
      {
        id: "F-1043",
        cells: { fill: "F-1043", account: "INS-NL-2", qty: "9,250", px: "84.11" },
      },
      {
        id: "F-1044",
        cells: { fill: "F-1044", account: "SOV-ME-1", qty: "60,000", px: "84.19" },
      },
      {
        id: "F-1045",
        cells: { fill: "F-1045", account: "GRWTH-EU", qty: "31,800", px: "84.16" },
      },
      {
        id: "F-1046",
        cells: { fill: "F-1046", account: "PENS-UK-B", qty: "24,400", px: "84.13" },
      },
    ],
  },
  "screen-filters": {
    columns: [
      { key: "name", label: "Instrument" },
      { key: "asset", label: "Asset", muted: true },
      { key: "ccy", label: "Ccy", muted: true },
      { key: "ret", label: "1M", align: "right" },
    ],
    rows: [
      {
        id: "1",
        cells: { name: "Bund 2.60% 34", asset: "Govt", ccy: "EUR", ret: "+1.24%" },
      },
      {
        id: "2",
        cells: { name: "Gilt 4.25% 32", asset: "Govt", ccy: "GBP", ret: "+0.86%" },
      },
      {
        id: "3",
        cells: { name: "EDF 5.00% 30", asset: "Credit", ccy: "EUR", ret: "-0.32%" },
      },
      {
        id: "4",
        cells: { name: "Nestlé 3.10% 29", asset: "Credit", ccy: "CHF", ret: "+0.44%" },
      },
      {
        id: "5",
        cells: { name: "KfW 3.00% 28", asset: "Agency", ccy: "EUR", ret: "+0.61%" },
      },
    ],
  },
  "desk-commentary": { columns: [], rows: [] },
};
