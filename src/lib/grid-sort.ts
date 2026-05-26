/* Mandate grid sort — spec v0.1.2 §2.
 *
 * Default = "Smart": severity tier → breach count → oldest breach → name.
 * On a broken day this puts the worst-affected mandates at the top.
 *
 * Hard rule (spec §6, rule 22): same data must produce the same order
 * every render. The tiebreaker (mandate name) prevents row flapping when
 * counts are equal.
 */

import type { OperationalState, PipelineState } from "./qlik";
import {
  breachCountInPipeline,
  tierWeight,
  worstTierInPipeline,
} from "./severity-tiers";

export type GridSortMode =
  | "smart"
  | "severity"
  | "count"
  | "age"
  | "name"
  | "region";

export const GRID_SORT_MODES: { value: GridSortMode; label: string }[] = [
  { value: "smart", label: "Smart (severity + count)" },
  { value: "severity", label: "Severity only" },
  { value: "count", label: "Count only" },
  { value: "age", label: "Oldest breach" },
  { value: "name", label: "Mandate name" },
  { value: "region", label: "Region" },
];

const URL_PARAM = "sort";

export function readUrlSort(): GridSortMode | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (!raw) return null;
  return GRID_SORT_MODES.some((m) => m.value === raw) ? (raw as GridSortMode) : null;
}

export function writeUrlSort(mode: GridSortMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (mode === "smart") url.searchParams.delete(URL_PARAM);
  else url.searchParams.set(URL_PARAM, mode);
  window.history.replaceState({}, "", url.toString());
}

/* Tiered behaviour by L0 state (spec §2.3):
 *   clean   → name only (no breach data to sort by)
 *   watch   → tier, then age
 *   at-risk → tier, then count, then age
 *   broken  → tier, then count, then age
 *
 * For non-smart modes, the user's explicit choice takes precedence over
 * the L0 state.
 */
export function sortPipelines(
  pipelines: PipelineState[],
  mode: GridSortMode,
  l0State: OperationalState,
): PipelineState[] {
  const cmp = comparator(mode, l0State);
  return [...pipelines].sort(cmp);
}

function comparator(mode: GridSortMode, l0State: OperationalState) {
  const nameAsc = (a: PipelineState, b: PipelineState) =>
    a.clientName.localeCompare(b.clientName);
  const tierDesc = (a: PipelineState, b: PipelineState) =>
    tierWeight(worstTierInPipeline(b)) - tierWeight(worstTierInPipeline(a));
  const countDesc = (a: PipelineState, b: PipelineState) =>
    breachCountInPipeline(b) - breachCountInPipeline(a);
  const ageDesc = (a: PipelineState, b: PipelineState) =>
    b.worstAgeMin - a.worstAgeMin;
  const regionAsc = (a: PipelineState, b: PipelineState) =>
    a.region.localeCompare(b.region);
  const holidayLast = (a: PipelineState, b: PipelineState) =>
    Number(a.isHolidayToday) - Number(b.isHolidayToday);

  const chain = (...fns: Array<(a: PipelineState, b: PipelineState) => number>) =>
    (a: PipelineState, b: PipelineState) => {
      for (const fn of fns) {
        const r = fn(a, b);
        if (r !== 0) return r;
      }
      return 0;
    };

  switch (mode) {
    case "smart":
      // Spec §2.3 — tiered by L0 state.
      if (l0State === "clean") return chain(holidayLast, nameAsc);
      if (l0State === "watch") return chain(holidayLast, tierDesc, ageDesc, nameAsc);
      return chain(holidayLast, tierDesc, countDesc, ageDesc, nameAsc);
    case "severity":
      return chain(holidayLast, tierDesc, nameAsc);
    case "count":
      return chain(holidayLast, countDesc, nameAsc);
    case "age":
      return chain(holidayLast, ageDesc, nameAsc);
    case "name":
      return chain(holidayLast, nameAsc);
    case "region":
      return chain(holidayLast, regionAsc, nameAsc);
  }
}
