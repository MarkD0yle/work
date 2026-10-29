/* Cross-screen hand-off.
 *
 * Pages render standalone, so "RFQ this bond" from the heat map needs a tiny
 * shared store: the bond, the side, and the size. Module state survives
 * in-app navigation (every page is in one bundle); localStorage carries it
 * across reloads when available. */

import type { Side } from "./tokens";
import { navigateToPage } from "../../lib/navigation";

export type Handoff = { bondId: string; side: Side; face: number };

const KEY = "fi-terminal.handoff";
const DEFAULT: Handoff = { bondId: "ORCL-34", side: "Buy", face: 5_000_000 };

let current: Handoff | null = null;

export function readHandoff(): Handoff {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    /* storage blocked — fall back to default */
  }
  return current ?? DEFAULT;
}

export function writeHandoff(h: Partial<Handoff>) {
  current = { ...readHandoff(), ...h };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

/** Store the hand-off and jump to another terminal screen. */
export function openWith(slug: string, h: Partial<Handoff>) {
  writeHandoff(h);
  navigateToPage(slug);
}
