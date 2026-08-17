import { createContext, useContext } from "react";
import type { Chart } from "highcharts";

/* Lets a ChartCard reach the chart rendered inside it without every chart
 * component threading a ref back up. The card needs the instance for its own
 * chrome — the PNG export button and the reflow that follows a card resize —
 * and nothing else, so the contract is deliberately one function wide.
 *
 * `register(null)` is sent on unmount so the card can drop a stale instance. */

export type ChartSlot = { register: (chart: Chart | null) => void };

export const ChartSlotContext = createContext<ChartSlot | null>(null);

export function useChartSlot() {
  return useContext(ChartSlotContext);
}
