/* Mock model for the AI Assistant page.
 *
 * There is no LLM behind this screen. A prompt is matched to one of a handful
 * of scripted intents by keyword, and the matching answer is "streamed" back
 * by the page. Every answer is a list of typed blocks (text, KPIs, chart,
 * table, callout) so the thread can render rich, structured output the way
 * Claude artifacts and Copilot adaptive cards do — and so any chart or table
 * can be opened in the right-hand panel at full size.
 *
 * Numbers are internally consistent: the holdings table, sector chart and
 * KPI tiles all read from the same PORTFOLIO constants below.
 */

export type Kpi = { label: string; value: string; delta?: string; tone?: "pos" | "neg" | "neutral" };

export type ChartSpec = {
  kind: "line" | "bar" | "column";
  title: string;
  unit: string;
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
};

export type TableSpec = {
  title: string;
  columns: { key: string; label: string; align?: "left" | "right"; format?: "pct" | "spct" | "money" | "bps" }[];
  rows: Record<string, string | number>[];
};

export type Source = { id: string; label: string; system: string; asOf: string };

export type Block =
  | { type: "text"; md: string }
  | { type: "kpis"; items: Kpi[] }
  | { type: "chart"; id: string; spec: ChartSpec }
  | { type: "table"; id: string; spec: TableSpec }
  | { type: "callout"; tone: "info" | "warn"; text: string };

export type Answer = {
  intent: string;
  /** Short "what I did" steps, shown as a collapsible reasoning trace. */
  steps: string[];
  blocks: Block[];
  sources: Source[];
  followUps: string[];
};

export type Message =
  | { id: string; role: "user"; text: string; at: string }
  | { id: string; role: "assistant"; answer: Answer; at: string; streaming?: boolean; shown: number };

/* --- Portfolio context ---------------------------------------------------------- */

export const CLIENT = {
  name: "Harbour Point Pension Trust",
  mandate: "Global Balanced · GBP",
  aum: "£2.41bn",
  benchmark: "60/40 MSCI ACWI / Bbg Global Agg (GBP hedged)",
  rm: "J. Okafor",
  riskProfile: "Moderate",
  asOf: "28 Oct 2026, 17:30 GMT",
};

export const SOURCES: Record<string, Source> = {
  pms: { id: "pms", label: "Holdings & positions", system: "PMS · Aladdin", asOf: "28 Oct 17:30" },
  perf: { id: "perf", label: "Performance & attribution", system: "Perf engine", asOf: "28 Oct EOD" },
  risk: { id: "risk", label: "Risk model (VaR, stress)", system: "Risk · Axioma", asOf: "28 Oct EOD" },
  crm: { id: "crm", label: "Client notes & IPS", system: "CRM · Salesforce", asOf: "21 Oct" },
  mkt: { id: "mkt", label: "Market data", system: "Bloomberg", asOf: "Live, 15m delay" },
};

export type ContextSource = Source & { enabled: boolean };

export const DEFAULT_CONTEXT: ContextSource[] = Object.values(SOURCES).map((s) => ({
  ...s,
  enabled: s.id !== "mkt",
}));

/* --- Guiding prompts ------------------------------------------------------------ */

export type PromptCard = { id: string; group: string; title: string; prompt: string };

export const PROMPT_CARDS: PromptCard[] = [
  { id: "p1", group: "Performance", title: "YTD vs benchmark", prompt: "How has the portfolio performed YTD against its benchmark?" },
  { id: "p2", group: "Exposure", title: "Sector tilts", prompt: "Show sector exposure versus benchmark and flag the biggest tilts." },
  { id: "p3", group: "Risk", title: "Stress test", prompt: "Run the standard stress scenarios and show the impact on the portfolio." },
  { id: "p4", group: "Holdings", title: "Concentration", prompt: "List the top 10 holdings and check for concentration breaches." },
  { id: "p5", group: "Client", title: "Meeting prep", prompt: "Draft talking points for next week's client review meeting." },
  { id: "p6", group: "Liquidity", title: "Liquidity profile", prompt: "How much of the portfolio can be liquidated within 1, 5 and 30 days?" },
];

/* --- Scripted answers ----------------------------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const POS = "#047857";
const NEG = "#b91c1c";

const perfAnswer: Answer = {
  intent: "performance",
  steps: ["Loaded daily NAV, Jan 1 – Oct 28", "Pulled benchmark returns (GBP hedged)", "Ran Brinson attribution by asset class"],
  blocks: [
    {
      type: "text",
      md: "The portfolio is **up 7.8% YTD**, ahead of its benchmark by **+1.2%**. Most of the excess came from the equity overweight in Q2 and security selection in IG credit. October gave back some ground as duration hurt.",
    },
    {
      type: "kpis",
      items: [
        { label: "Return YTD", value: "+7.8%", delta: "+1.2% vs bmk", tone: "pos" },
        { label: "Benchmark YTD", value: "+6.6%", tone: "neutral" },
        { label: "Volatility (ann.)", value: "8.4%", delta: "−0.3 vs bmk", tone: "pos" },
        { label: "Sharpe", value: "0.92", delta: "+0.14", tone: "pos" },
      ],
    },
    {
      type: "chart",
      id: "perf-cum",
      spec: {
        kind: "line",
        title: "Cumulative return, YTD",
        unit: "%",
        categories: MONTHS,
        series: [
          { name: "Portfolio", data: [1.1, 0.4, 1.9, 3.2, 4.6, 5.9, 6.8, 7.1, 8.3, 7.8], color: "#111827" },
          { name: "Benchmark", data: [0.9, 0.1, 1.4, 2.5, 3.6, 4.7, 5.6, 6.0, 6.9, 6.6], color: "#9ca3af" },
        ],
      },
    },
    {
      type: "table",
      id: "perf-attr",
      spec: {
        title: "Attribution by asset class, YTD",
        columns: [
          { key: "ac", label: "Asset class" },
          { key: "alloc", label: "Allocation", align: "right", format: "bps" },
          { key: "sel", label: "Selection", align: "right", format: "bps" },
          { key: "total", label: "Total", align: "right", format: "bps" },
        ],
        rows: [
          { ac: "Global equity", alloc: 48, sel: 22, total: 70 },
          { ac: "IG credit", alloc: 6, sel: 31, total: 37 },
          { ac: "Government bonds", alloc: -14, sel: 4, total: -10 },
          { ac: "Alternatives", alloc: 9, sel: 6, total: 15 },
          { ac: "Cash", alloc: 8, sel: 0, total: 8 },
        ],
      },
    },
  ],
  sources: [SOURCES.perf, SOURCES.pms],
  followUps: ["Why did October underperform?", "Break equity selection down by region", "Compare with peer group"],
};

const sectorAnswer: Answer = {
  intent: "exposure",
  steps: ["Looked through funds to underlying holdings", "Mapped to GICS level 1", "Compared with MSCI ACWI weights"],
  blocks: [
    {
      type: "text",
      md: "Equity sleeve is tilted towards **Technology (+4.1%)** and **Healthcare (+2.3%)**, funded by underweights in **Energy (−2.8%)** and **Financials (−2.2%)**. No tilt breaches the ±5% IPS band.",
    },
    {
      type: "chart",
      id: "sector-active",
      spec: {
        kind: "bar",
        title: "Active weight vs benchmark, equity sleeve",
        unit: "%",
        categories: ["Technology", "Healthcare", "Industrials", "Cons. Disc.", "Utilities", "Materials", "Financials", "Energy"],
        series: [{ name: "Active weight", data: [4.1, 2.3, 0.9, 0.4, -0.6, -1.1, -2.2, -2.8] }],
      },
    },
    {
      type: "table",
      id: "sector-table",
      spec: {
        title: "Sector weights",
        columns: [
          { key: "s", label: "Sector" },
          { key: "p", label: "Portfolio", align: "right", format: "pct" },
          { key: "b", label: "Benchmark", align: "right", format: "pct" },
          { key: "a", label: "Active", align: "right", format: "spct" },
        ],
        rows: [
          { s: "Technology", p: 28.6, b: 24.5, a: 4.1 },
          { s: "Healthcare", p: 13.1, b: 10.8, a: 2.3 },
          { s: "Industrials", p: 11.6, b: 10.7, a: 0.9 },
          { s: "Financials", p: 14.0, b: 16.2, a: -2.2 },
          { s: "Energy", p: 1.6, b: 4.4, a: -2.8 },
        ],
      },
    },
    { type: "callout", tone: "info", text: "All active weights are inside the ±5% IPS band agreed on 14 Mar 2026." },
  ],
  sources: [SOURCES.pms, SOURCES.crm],
  followUps: ["What drives the Technology overweight?", "Show regional exposure", "Suggest trades to cut the Energy underweight"],
};

const stressAnswer: Answer = {
  intent: "risk",
  steps: ["Loaded 6 standard firm scenarios", "Revalued 1,284 positions", "Aggregated P&L by asset class"],
  blocks: [
    {
      type: "text",
      md: "Worst case is the **2008 GFC replay at −14.2% (−£342m)**. A **+200bp rate shock** costs −6.1%. 1-day 99% VaR is **£18.7m (0.78%)**, within the 1.0% limit.",
    },
    {
      type: "kpis",
      items: [
        { label: "1d VaR 99%", value: "£18.7m", delta: "78% of limit", tone: "neutral" },
        { label: "Worst scenario", value: "−14.2%", delta: "GFC replay", tone: "neg" },
        { label: "Tracking error", value: "2.1%", tone: "neutral" },
      ],
    },
    {
      type: "chart",
      id: "stress-chart",
      spec: {
        kind: "column",
        title: "Scenario P&L impact",
        unit: "%",
        categories: ["GFC 2008", "Covid 2020", "Rates +200bp", "Gilt 2022", "USD +10%", "Oil +50%"],
        series: [{ name: "Portfolio impact", data: [-14.2, -9.8, -6.1, -4.9, 1.8, -1.2] }],
      },
    },
    {
      type: "table",
      id: "stress-table",
      spec: {
        title: "Scenario detail",
        columns: [
          { key: "sc", label: "Scenario" },
          { key: "pct", label: "Impact", align: "right", format: "spct" },
          { key: "gbp", label: "P&L (£m)", align: "right", format: "money" },
          { key: "driver", label: "Main driver" },
        ],
        rows: [
          { sc: "GFC 2008", pct: -14.2, gbp: -342, driver: "Global equity" },
          { sc: "Covid 2020", pct: -9.8, gbp: -236, driver: "Global equity" },
          { sc: "Rates +200bp", pct: -6.1, gbp: -147, driver: "Government bonds" },
          { sc: "Gilt 2022", pct: -4.9, gbp: -118, driver: "UK duration" },
          { sc: "USD +10%", pct: 1.8, gbp: 43, driver: "Unhedged USD equity" },
          { sc: "Oil +50%", pct: -1.2, gbp: -29, driver: "Energy underweight" },
        ],
      },
    },
    { type: "callout", tone: "warn", text: "Scenario results are model estimates. They are not a forecast and exclude liquidity effects." },
  ],
  sources: [SOURCES.risk, SOURCES.pms],
  followUps: ["Which positions drive the GFC loss?", "Show VaR trend over 90 days", "Hedge ideas for a rate shock"],
};

const holdingsAnswer: Answer = {
  intent: "holdings",
  steps: ["Ranked positions by market value", "Checked against 5% single-issuer limit", "Checked 40% aggregate >5% rule"],
  blocks: [
    {
      type: "text",
      md: "Top 10 holdings are **31.4%** of the portfolio. **One soft warning:** Microsoft is at **4.7%**, close to the 5% single-issuer limit.",
    },
    {
      type: "table",
      id: "top10",
      spec: {
        title: "Top 10 holdings",
        columns: [
          { key: "n", label: "Holding" },
          { key: "ac", label: "Asset class" },
          { key: "w", label: "Weight", align: "right", format: "pct" },
          { key: "mv", label: "MV (£m)", align: "right", format: "money" },
          { key: "ytd", label: "YTD", align: "right", format: "spct" },
        ],
        rows: [
          { n: "Microsoft Corp", ac: "Equity", w: 4.7, mv: 113, ytd: 18.2 },
          { n: "UK Gilt 4.25% 2034", ac: "Govt bond", w: 4.2, mv: 101, ytd: 1.9 },
          { n: "Apple Inc", ac: "Equity", w: 3.9, mv: 94, ytd: 12.6 },
          { n: "US Treasury 4% 2033", ac: "Govt bond", w: 3.6, mv: 87, ytd: 2.4 },
          { n: "NVIDIA Corp", ac: "Equity", w: 3.1, mv: 75, ytd: 41.8 },
          { n: "Amazon.com Inc", ac: "Equity", w: 2.6, mv: 63, ytd: 14.1 },
          { n: "iShares Global Infra", ac: "Alternatives", w: 2.5, mv: 60, ytd: 6.3 },
          { n: "Novo Nordisk", ac: "Equity", w: 2.4, mv: 58, ytd: -8.4 },
          { n: "Bund 2.6% 2033", ac: "Govt bond", w: 2.3, mv: 55, ytd: 0.8 },
          { n: "AstraZeneca plc", ac: "Equity", w: 2.1, mv: 51, ytd: 9.7 },
        ],
      },
    },
    { type: "callout", tone: "warn", text: "Microsoft at 4.7% — within 0.3% of the 5% single-issuer limit. Consider a trim if it rallies further." },
  ],
  sources: [SOURCES.pms],
  followUps: ["How much Microsoft would we need to sell to get to 4%?", "Show top 10 by risk contribution", "What changed since last month?"],
};

const meetingAnswer: Answer = {
  intent: "client",
  steps: ["Read last 3 meeting notes in CRM", "Pulled YTD performance and risk", "Checked open actions"],
  blocks: [
    {
      type: "text",
      md: [
        "**Talking points — Harbour Point review, 5 Nov**",
        "",
        "1. **Performance:** +7.8% YTD, +1.2% ahead of benchmark. Equity overweight and credit selection did the work.",
        "2. **Risk:** VaR at 78% of limit. Worst stress case is −14.2% (GFC replay). No limit breaches this year.",
        "3. **Positioning:** Overweight Technology and Healthcare, underweight Energy. All inside IPS bands.",
        "4. **Open action from Sep:** Trustees asked about adding private credit. Bring the 3% sleeve proposal.",
        "5. **Watch item:** Microsoft is near the 5% issuer limit.",
      ].join("\n"),
    },
    { type: "callout", tone: "info", text: "Trustee chair (M. Reyes) prefers one-page summaries. Last meeting ran long on fees." },
  ],
  sources: [SOURCES.crm, SOURCES.perf, SOURCES.risk],
  followUps: ["Turn this into a one-page PDF", "Draft the private credit proposal summary", "Add a fees slide"],
};

const liquidityAnswer: Answer = {
  intent: "liquidity",
  steps: ["Applied 20% of ADV participation rule", "Bucketed positions by days to liquidate"],
  blocks: [
    {
      type: "text",
      md: "**71% can be sold within 1 day** and **93% within 5 days**. The illiquid tail is the alternatives sleeve (infrastructure and property funds with quarterly dealing).",
    },
    {
      type: "chart",
      id: "liq-chart",
      spec: {
        kind: "column",
        title: "Cumulative % liquidated",
        unit: "%",
        categories: ["1 day", "5 days", "30 days", "90 days", "> 90 days"],
        series: [{ name: "Cumulative", data: [71, 93, 96, 99, 100], color: "#111827" }],
      },
    },
  ],
  sources: [SOURCES.pms, SOURCES.mkt],
  followUps: ["Which funds have quarterly dealing?", "Stress liquidity under a redemption of 10%"],
};

const fallback: Answer = {
  intent: "fallback",
  steps: ["Searched connected sources"],
  blocks: [
    {
      type: "text",
      md: "I can't answer that from the data connected to this workspace. Try one of the suggestions below, or connect another source in the **Context** panel.",
    },
  ],
  sources: [],
  followUps: ["How has the portfolio performed YTD?", "Show sector exposure versus benchmark", "Run the standard stress scenarios"],
};

// First match wins, so the narrower intents go before performance, whose
// keywords ("benchmark", "return") turn up in most other prompts too.
const RULES: [RegExp, Answer][] = [
  [/sector|exposure|tilt|overweight|underweight|region/i, sectorAnswer],
  [/perform|return|ytd|benchmark|attribution|october/i, perfAnswer],
  [/stress|scenario|var\b|risk|shock|hedge/i, stressAnswer],
  [/holding|top 10|concentration|microsoft|issuer/i, holdingsAnswer],
  [/meeting|talking|client|review|draft|summary/i, meetingAnswer],
  [/liquid|redemption|days/i, liquidityAnswer],
];

export function answerFor(prompt: string): Answer {
  return RULES.find(([re]) => re.test(prompt))?.[1] ?? fallback;
}

/* --- Conversation history (left rail) ------------------------------------------ */

export const HISTORY: { id: string; title: string; when: "Today" | "Yesterday" | "Last 7 days" }[] = [
  { id: "h1", title: "Q3 attribution for trustees", when: "Today" },
  { id: "h2", title: "Gilt duration hedge options", when: "Today" },
  { id: "h3", title: "ESG exclusions check", when: "Yesterday" },
  { id: "h4", title: "Private credit sleeve sizing", when: "Last 7 days" },
  { id: "h5", title: "FX hedge ratio review", when: "Last 7 days" },
];

const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

export function fmt(v: string | number, format?: TableSpec["columns"][number]["format"]): string {
  if (typeof v === "string") return v;
  switch (format) {
    case "pct":
      return `${v.toFixed(1)}%`;
    case "spct":
      return `${sign(v)}${Math.abs(v).toFixed(1)}%`;
    case "bps":
      return `${sign(v)}${Math.abs(v)}`;
    case "money":
      return `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-GB")}`;
    default:
      return String(v);
  }
}

export { POS, NEG };
