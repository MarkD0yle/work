/* The five FI Studio screens. Codes and aliases match the FI Terminal, so
 * anyone who knows "RFQ <GO>" can jump the same way here. */

import { SCREENS as TERMINAL } from "../fi-terminal/screens";
import type { ScreenId } from "../fi-terminal/screens";

export type { ScreenId };

const FRIENDLY: Record<ScreenId, { slug: string; name: string; blurb: string }> = {
  HMAP: { slug: "fi-studio-credit-map", name: "Credit map", blurb: "See where spreads moved today" },
  RFQ: { slug: "fi-studio-rfq", name: "Get quotes", blurb: "Ask dealers to compete for your trade" },
  TKT: { slug: "fi-studio-ticket", name: "Place an order", blurb: "Set a price, check it, send it" },
  BWIC: { slug: "fi-studio-bwic", name: "Sell a list", blurb: "Run a bid list and award the winners" },
  RV: { slug: "fi-studio-rv", name: "Curve ideas", blurb: "Find rich and cheap Treasuries, build a switch" },
};

export const STUDIO_SCREENS = TERMINAL.map((t) => ({ ...t, ...FRIENDLY[t.id] }));

export const studioSlug = (id: ScreenId) => FRIENDLY[id].slug;
