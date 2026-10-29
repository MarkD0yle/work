/* Loan Book Health: facet definitions and slice membership. */

import {
  BANDS,
  CHANNELS,
  PRODUCTS,
  REGIONS,
  SEGMENTS,
  aggregate,
  type Segment,
} from "./model";

export type DimKey = "p" | "r" | "b" | "c";
export type Filters = Record<DimKey, number[]>;
export const NO_FILTERS: Filters = { p: [], r: [], b: [], c: [] };
export const DIM_KEYS: DimKey[] = ["p", "r", "b", "c"];

export const FACETS: {
  key: DimKey;
  label: string;
  options: { label: string; hint?: string }[];
}[] = [
  { key: "p", label: "Product", options: PRODUCTS.map((o) => ({ label: o.label })) },
  { key: "r", label: "Region", options: REGIONS.map((o) => ({ label: o.label })) },
  {
    key: "b",
    label: "Score band",
    options: BANDS.map((o) => ({ label: o.label, hint: o.range })),
  },
  { key: "c", label: "Channel", options: CHANNELS.map((o) => ({ label: o.label })) },
];

export function inSlice(s: Segment, f: Filters, skip?: DimKey) {
  for (const k of DIM_KEYS) {
    if (k === skip) continue;
    const sel = f[k];
    if (sel.length > 0 && !sel.includes(s[k])) return false;
  }
  return true;
}

export const BOOK = aggregate(SEGMENTS);
