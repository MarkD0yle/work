export type FormatSpec = "bps" | "bps-signed" | "count" | "ratio" | "percent" | "notional" | "empty";

export const FORMATS: Record<Exclude<FormatSpec, "empty">, { decimals: number; signed?: boolean; compact?: boolean; suffix?: string; grouping?: boolean }> = {
  bps: { decimals: 2 },
  "bps-signed": { decimals: 2, signed: true },
  count: { decimals: 0, grouping: true },
  ratio: { decimals: 2 },
  percent: { decimals: 1, suffix: "%" },
  notional: { decimals: 1, compact: true },
};

export const EMPTY = "—";
export const MINUS = "−";
