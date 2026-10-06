import type { Tone } from "./styles";

/* Reference data for the three accordion + modal examples. Each modal works
 * through 50+ rows of radio choices, so the lists live here rather than in
 * the components. */

/* ───────────── Example A — market access permissions (54 markets) ───────────── */

export type Region = "Americas" | "EMEA" | "APAC";

export type Market = { code: string; name: string; region: Region };

export const MARKETS: Market[] = [
  ["US", "United States", "Americas"],
  ["CA", "Canada", "Americas"],
  ["MX", "Mexico", "Americas"],
  ["BR", "Brazil", "Americas"],
  ["CL", "Chile", "Americas"],
  ["CO", "Colombia", "Americas"],
  ["PE", "Peru", "Americas"],
  ["AR", "Argentina", "Americas"],
  ["GB", "United Kingdom", "EMEA"],
  ["IE", "Ireland", "EMEA"],
  ["FR", "France", "EMEA"],
  ["DE", "Germany", "EMEA"],
  ["NL", "Netherlands", "EMEA"],
  ["BE", "Belgium", "EMEA"],
  ["LU", "Luxembourg", "EMEA"],
  ["CH", "Switzerland", "EMEA"],
  ["AT", "Austria", "EMEA"],
  ["IT", "Italy", "EMEA"],
  ["ES", "Spain", "EMEA"],
  ["PT", "Portugal", "EMEA"],
  ["SE", "Sweden", "EMEA"],
  ["NO", "Norway", "EMEA"],
  ["DK", "Denmark", "EMEA"],
  ["FI", "Finland", "EMEA"],
  ["PL", "Poland", "EMEA"],
  ["CZ", "Czechia", "EMEA"],
  ["HU", "Hungary", "EMEA"],
  ["RO", "Romania", "EMEA"],
  ["SK", "Slovakia", "EMEA"],
  ["GR", "Greece", "EMEA"],
  ["TR", "Türkiye", "EMEA"],
  ["IL", "Israel", "EMEA"],
  ["ZA", "South Africa", "EMEA"],
  ["AE", "United Arab Emirates", "EMEA"],
  ["SA", "Saudi Arabia", "EMEA"],
  ["QA", "Qatar", "EMEA"],
  ["KW", "Kuwait", "EMEA"],
  ["EG", "Egypt", "EMEA"],
  ["NG", "Nigeria", "EMEA"],
  ["KE", "Kenya", "EMEA"],
  ["JP", "Japan", "APAC"],
  ["HK", "Hong Kong", "APAC"],
  ["CN", "China (Connect)", "APAC"],
  ["SG", "Singapore", "APAC"],
  ["AU", "Australia", "APAC"],
  ["NZ", "New Zealand", "APAC"],
  ["KR", "South Korea", "APAC"],
  ["TW", "Taiwan", "APAC"],
  ["IN", "India", "APAC"],
  ["ID", "Indonesia", "APAC"],
  ["MY", "Malaysia", "APAC"],
  ["TH", "Thailand", "APAC"],
  ["PH", "Philippines", "APAC"],
  ["VN", "Vietnam", "APAC"],
].map(([code, name, region]) => ({ code, name, region: region as Region }));

export const REGIONS: Region[] = ["Americas", "EMEA", "APAC"];

export type Access = "full" | "restricted" | "blocked";

export const ACCESS_OPTIONS: { value: Access; label: string; tone: Tone }[] = [
  { value: "full", label: "Full", tone: "good" },
  { value: "restricted", label: "Restricted", tone: "warn" },
  { value: "blocked", label: "Blocked", tone: "bad" },
];

export const DESKS = [
  "Cash Equities",
  "Equity Derivatives",
  "Rates",
  "Credit",
  "FX & Emerging Markets",
];

/* ───────────── Example B — suitability questionnaire (52 questions) ───────────── */

export type QuestionCategory =
  | "Knowledge & experience"
  | "Financial situation"
  | "Investment objectives"
  | "Risk tolerance"
  | "Sustainability preferences"
  | "Declarations";

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  "Knowledge & experience",
  "Financial situation",
  "Investment objectives",
  "Risk tolerance",
  "Sustainability preferences",
  "Declarations",
];

export type Question = {
  id: string;
  category: QuestionCategory;
  text: string;
  options: string[];
  /** Points per option (same order); feeds the risk score. */
  scores: number[];
  /** Option index that raises a compliance flag when chosen. */
  flagOn?: number;
};

const YN = ["Yes", "No"];
const FREQ = ["Never", "Occasionally", "Regularly"];
const SCALE = ["Low", "Medium", "High"];
const AGREE = ["Disagree", "Neutral", "Agree"];

function q(
  category: QuestionCategory,
  text: string,
  options: string[],
  scores: number[],
  flagOn?: number,
): Omit<Question, "id"> {
  return { category, text, options, scores, flagOn };
}

const K: QuestionCategory = "Knowledge & experience";
const F: QuestionCategory = "Financial situation";
const O: QuestionCategory = "Investment objectives";
const R: QuestionCategory = "Risk tolerance";
const S: QuestionCategory = "Sustainability preferences";
const D: QuestionCategory = "Declarations";

export const QUESTIONS: Question[] = [
  q(K, "Has the client traded listed equities in the last three years?", FREQ, [0, 1, 2]),
  q(K, "Has the client traded government or corporate bonds?", FREQ, [0, 1, 2]),
  q(K, "Has the client traded exchange-traded funds?", FREQ, [0, 1, 2]),
  q(K, "Has the client traded listed options or futures?", FREQ, [0, 2, 3]),
  q(K, "Has the client traded OTC derivatives (swaps, forwards)?", FREQ, [0, 2, 3]),
  q(K, "Has the client invested in structured products?", FREQ, [0, 2, 3]),
  q(K, "Has the client used leverage or margin lending?", FREQ, [0, 2, 3]),
  q(K, "Has the client invested in private markets or hedge funds?", FREQ, [0, 2, 3]),
  q(K, "Does the client work, or has worked, in financial services?", YN, [2, 0]),
  q(K, "Does the client hold a relevant professional qualification?", YN, [2, 0]),
  q(K, "Does the client understand that derivatives can lose more than the initial margin?", YN, [1, 0], 1),
  q(K, "Does the client understand currency risk on non-base holdings?", YN, [1, 0], 1),
  q(F, "Annual income band", ["< 100k", "100k – 500k", "> 500k"], [0, 1, 2]),
  q(F, "Liquid net worth band", ["< 1m", "1m – 10m", "> 10m"], [0, 1, 2]),
  q(F, "Share of liquid assets placed with us", ["< 25%", "25 – 50%", "> 50%"], [2, 1, 0]),
  q(F, "Does the client have outstanding loans secured on investments?", YN, [0, 1]),
  q(F, "Stability of income over the next five years", SCALE, [0, 1, 2]),
  q(F, "Could the client meet a 12-month emergency without selling investments?", YN, [1, 0], 1),
  q(F, "Expected large withdrawals in the next 24 months?", YN, [0, 1]),
  q(F, "Does the client have dependants relying on this portfolio?", YN, [0, 1]),
  q(F, "Are any assets subject to legal or tax restrictions?", YN, [0, 0], 0),
  q(O, "Primary objective", ["Preserve capital", "Income", "Growth"], [0, 1, 2]),
  q(O, "Investment horizon", ["< 3 years", "3 – 7 years", "> 7 years"], [0, 1, 2]),
  q(O, "Is regular income required from the portfolio?", YN, [0, 1]),
  q(O, "Target annual return above inflation", ["0 – 2%", "2 – 5%", "> 5%"], [0, 1, 2]),
  q(O, "Is the portfolio intended for retirement funding?", YN, [0, 1]),
  q(O, "Is the portfolio intended for succession or gifting?", YN, [1, 0]),
  q(O, "Does the client want exposure to illiquid strategies?", YN, [2, 0]),
  q(O, "Does the client want to hedge an existing concentrated position?", YN, [1, 0]),
  q(R, "Reaction to a 10% portfolio fall in a month", ["Sell", "Hold", "Buy more"], [0, 1, 2]),
  q(R, "Reaction to a 25% portfolio fall in a year", ["Sell", "Hold", "Buy more"], [0, 1, 2]),
  q(R, "Maximum acceptable annual loss", ["< 5%", "5 – 15%", "> 15%"], [0, 1, 2]),
  q(R, "Comfort with daily price swings", SCALE, [0, 1, 2]),
  q(R, "Preference: certain 3% vs. 50/50 chance of 10% or −2%", ["Certain 3%", "Indifferent", "The gamble"], [0, 1, 2]),
  q(R, "Has the client ever sold in a panic during a market fall?", YN, [0, 1]),
  q(R, "Comfort holding single-name concentrations above 10%", SCALE, [0, 1, 2]),
  q(R, "Comfort with leverage to amplify returns", SCALE, [0, 1, 2]),
  q(R, "Self-assessed risk appetite", SCALE, [0, 1, 2]),
  q(S, "Does the client have sustainability preferences (MiFID II Art. 2(7))?", YN, [0, 0]),
  q(S, "Minimum share in taxonomy-aligned investments", ["None", "Up to 20%", "Over 20%"], [0, 0, 0]),
  q(S, "Minimum share in SFDR sustainable investments", ["None", "Up to 20%", "Over 20%"], [0, 0, 0]),
  q(S, "Consider principal adverse impacts (PAIs)?", YN, [0, 0]),
  q(S, "Exclude thermal coal producers", AGREE, [0, 0, 0]),
  q(S, "Exclude controversial weapons", AGREE, [0, 0, 0]),
  q(S, "Exclude tobacco producers", AGREE, [0, 0, 0]),
  q(S, "Prefer active engagement over exclusion", AGREE, [0, 0, 0]),
  q(D, "Client confirms information provided is accurate and complete", YN, [0, 0], 1),
  q(D, "Client is a politically exposed person (PEP) or close associate", YN, [0, 0], 0),
  q(D, "Client acts on behalf of another person", YN, [0, 0], 0),
  q(D, "Client has received the costs & charges disclosure", YN, [0, 0], 1),
  q(D, "Client consents to telephone recording", YN, [0, 0], 1),
  q(D, "Client agrees to review this profile at least annually", YN, [0, 0], 1),
].map((x, i) => ({ ...x, id: `Q${String(i + 1).padStart(2, "0")}` }));

export const MAX_SCORE = QUESTIONS.reduce((s, x) => s + Math.max(...x.scores), 0);

export function riskBand(score: number): { label: string; tone: Tone } {
  const pct = score / MAX_SCORE;
  if (pct < 0.3) return { label: "Conservative", tone: "info" };
  if (pct < 0.5) return { label: "Balanced", tone: "good" };
  if (pct < 0.7) return { label: "Growth", tone: "warn" };
  return { label: "Aggressive", tone: "bad" };
}

/* ───────────── Example C — collateral eligibility schedule (56 asset types) ───────────── */

export type AssetType = { id: string; group: string; name: string };

const TENORS = ["0 – 1y", "1 – 5y", "5 – 10y", "10y +"];

const BOND_GROUPS = [
  "G7 sovereign",
  "Other OECD sovereign",
  "EM sovereign",
  "Inflation-linked sovereign",
  "Supranational",
  "Agency",
  "Municipal",
  "Covered bond (AAA)",
  "Corporate IG",
  "Corporate HY",
];

export const ASSET_TYPES: AssetType[] = [
  ...["USD", "EUR", "GBP", "JPY", "CHF", "CAD"].map((c) => ({
    id: `CASH-${c}`,
    group: "Cash",
    name: `Cash ${c}`,
  })),
  ...BOND_GROUPS.flatMap((g, gi) =>
    TENORS.map((t, i) => ({
      id: `B${gi}-${i}`,
      group: g,
      name: `${g} ${t}`,
    })),
  ),
  ...["S&P 500", "Euro Stoxx 50", "FTSE 100", "Nikkei 225", "Other main index"].map((n, i) => ({
    id: `EQ-${i}`,
    group: "Equity",
    name: `${n} constituents`,
  })),
  ...["Money-market fund units", "Gold (allocated)", "ABS (AAA)", "RMBS (AAA)", "CLO (AAA)"].map(
    (n, i) => ({ id: `OTH-${i}`, group: "Other", name: n }),
  ),
];

export type Haircut = "inel" | "0" | "2" | "5" | "10" | "15";

export const HAIRCUT_OPTIONS: { value: Haircut; label: string; tone: Tone }[] = [
  { value: "inel", label: "Ineligible", tone: "muted" },
  { value: "0", label: "0%", tone: "good" },
  { value: "2", label: "2%", tone: "good" },
  { value: "5", label: "5%", tone: "info" },
  { value: "10", label: "10%", tone: "warn" },
  { value: "15", label: "15%", tone: "bad" },
];

/* A reasonable starting schedule (ISDA-style) to seed the modal from. */
export function standardSchedule(): Record<string, Haircut> {
  const out: Record<string, Haircut> = {};
  for (const a of ASSET_TYPES) {
    const tenor = Number(a.id.split("-")[1] ?? 0);
    let h: Haircut = "inel";
    if (a.group === "Cash") h = "0";
    else if (a.group === "G7 sovereign") h = (["0", "2", "2", "5"] as Haircut[])[tenor];
    else if (a.group === "Other OECD sovereign" || a.group === "Supranational" || a.group === "Agency")
      h = (["2", "2", "5", "5"] as Haircut[])[tenor];
    else if (a.group === "Covered bond (AAA)" || a.group === "Inflation-linked sovereign")
      h = (["2", "5", "5", "10"] as Haircut[])[tenor];
    else if (a.group === "Corporate IG") h = (["5", "5", "10", "10"] as Haircut[])[tenor];
    else if (a.group === "Equity" && a.name !== "Other main index constituents") h = "15";
    out[a.id] = h;
  }
  return out;
}

export const ASSET_GROUPS = [...new Set(ASSET_TYPES.map((a) => a.group))];
