import type { Objection } from "./types";

/* Objection bank for the Rehearse capability. `goodResponseHints` are
 * keywords the scoring engine (rehearsal.ts) checks for — never shown to the
 * user before they attempt a response. */

export const OBJECTION_BANK: Objection[] = [
  {
    id: "obj-price-fees-vs-market",
    category: "Price",
    prompt: "Your fees are higher than what I could get elsewhere.",
    goodResponseHints: ["net of fee", "net return", "track record", "value", "dedicated advisor"],
  },
  {
    id: "obj-price-what-am-i-paying-for",
    category: "Price",
    prompt: "I don't understand what I'm actually paying for across all these accounts.",
    goodResponseHints: ["consolidated", "fee ledger", "transparent", "all-in", "reporting"],
  },
  {
    id: "obj-competitor-direct-coinvest",
    category: "Competitor",
    prompt: "We're already talking to another family office about a direct private-equity co-invest deal.",
    goodResponseHints: ["diversified", "underwriting", "concentration", "single-name", "in-house"],
    relatedIncumbentTags: ["direct pe co-invest", "rival family office"],
  },
  {
    id: "obj-competitor-discount-platform",
    category: "Competitor",
    prompt: "A discount platform quoted us a much lower headline fee than you.",
    goodResponseHints: ["net of fee", "advisor", "tax-aware", "concentration", "reporting"],
  },
  {
    id: "obj-risk-downturn",
    category: "Risk/compliance",
    prompt: "What happens to my portfolio if there's another downturn like 2022?",
    goodResponseHints: ["risk", "downside", "diversification", "buffer", "liquidity"],
  },
  {
    id: "obj-risk-illiquidity",
    category: "Risk/compliance",
    prompt: "I'm not comfortable with the illiquidity on that private credit fund.",
    goodResponseHints: ["liquidity gate", "quarterly", "disclosed", "underwriting", "track record"],
  },
  {
    id: "obj-timing-not-right-now",
    category: "Timing",
    prompt: "This isn't the right time for us to make a change.",
    goodResponseHints: ["phased", "no forced sale", "gradual", "timeline", "when you're ready"],
  },
  {
    id: "obj-timing-year-end",
    category: "Timing",
    prompt: "We just need to get through year-end before considering anything new.",
    goodResponseHints: ["schedule", "follow up", "next quarter", "timeline", "no obligation"],
  },
  {
    id: "obj-trust-current-advisor-tenure",
    category: "Trust/relationship",
    prompt: "Our current advisor has been with us for years — why would we change part of this?",
    goodResponseHints: ["continuity", "dedicated", "complement", "alongside", "relationship"],
  },
  {
    id: "obj-trust-sales-pitch-skepticism",
    category: "Trust/relationship",
    prompt: "How do I know this recommendation is right for us and not just a sales pitch?",
    goodResponseHints: ["your goal", "specific", "data", "transparent", "diligence"],
  },
];
