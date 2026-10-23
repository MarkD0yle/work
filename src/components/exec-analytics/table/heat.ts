import type { CSSProperties } from "react";

export type HeatStyle = { style: CSSProperties; worse: boolean; clipped: boolean };

/** Percentile (0..1) of absolute values; used to clip the diverging scale symmetrically around 0. */
export function percentileAbs(values: (number | null | undefined)[], p = 0.95): number {
  const abs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).map(Math.abs).sort((a, b) => a - b);
  if (!abs.length) return 1;
  return abs[Math.min(abs.length - 1, Math.floor(p * (abs.length - 1)))] || 1;
}

/**
 * Diverging cell fill: worse <-> surface <-> better, symmetric around 0.
 * `better: "lower" | "higher"` says which sign is good. Fill is capped so dark text keeps AA contrast.
 */
export function heatStyle(value: number | null | undefined, limit: number, better: "lower" | "higher" = "lower"): HeatStyle | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const clipped = Math.abs(value) > limit;
  const t = Math.min(1, Math.abs(value) / limit);
  const isBetter = better === "lower" ? value < 0 : value > 0;
  if (value === 0) return { style: {}, worse: false, clipped: false };
  const pct = Math.round(8 + t * 37);
  const tok = isBetter ? "--data-better" : "--data-worse";
  return {
    style: { background: `color-mix(in srgb, var(${tok}) ${pct}%, var(--color-surface))`, color: "var(--color-text)" },
    worse: !isBetter,
    clipped,
  };
}
