/* The five FI terminal functions — code, page slug, name, command aliases. */

export type ScreenId = "HMAP" | "RFQ" | "TKT" | "BWIC" | "RV";

export const SCREENS: { id: ScreenId; slug: string; name: string; aliases: string[] }[] = [
  { id: "HMAP", slug: "fi-credit-heatmap", name: "Credit Heat Map", aliases: ["HEAT", "CRVM", "MAP"] },
  { id: "RFQ", slug: "fi-rfq-ticket", name: "Multi-Dealer RFQ", aliases: ["QUOTE", "ALLQ"] },
  { id: "TKT", slug: "fi-bond-ticket", name: "Order Ticket", aliases: ["TICKET", "BUY", "SELL", "ORD"] },
  { id: "BWIC", slug: "fi-bwic", name: "BWIC List Sale", aliases: ["LIST", "OWIC"] },
  { id: "RV", slug: "fi-rates-rv", name: "Rates Relative Value", aliases: ["CURVE", "RATES", "SWITCH"] },
];
