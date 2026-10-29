/* Mirror of ea.css tokens for code that cannot read CSS variables (chart config). Light/dark. */
export type Theme = "light" | "dark";

export type TokenSet = Record<"bg" | "surface" | "border" | "text" | "muted" | "disabled" | "accent" | "better" | "worse" | "betterSubtle" | "worseSubtle" | "buy" | "sell", string>;
export const TOKENS: Record<Theme, TokenSet> = {
  light: {
    bg: "#F7F8FA", surface: "#FFFFFF", border: "#E2E5EA", text: "#14171C", muted: "#5B6270", disabled: "#9AA1AE",
    accent: "#1F5FD1", better: "#1E8A4C", worse: "#C23B3B", betterSubtle: "#E3F4EA", worseSubtle: "#FBE7E7",
    buy: "#1F5FD1", sell: "#B5651D",
  },
  dark: {
    bg: "#0F1115", surface: "#171A20", border: "#2A2F39", text: "#E8EAEE", muted: "#9AA1AE", disabled: "#5B6270",
    accent: "#5B8DEF", better: "#4CC27F", worse: "#F0716F", betterSubtle: "#17301F", worseSubtle: "#3A1A1A",
    buy: "#5B8DEF", sell: "#E0944A",
  },
};

export const NEUTRAL_RAMP: Record<Theme, string[]> = {
  light: ["#D6E4F8", "#A9C5F0", "#7BA3E6", "#4F82D8", "#2F63BC", "#123E85"],
  dark: ["#1E3358", "#284A80", "#3A66AC", "#5B8DEF", "#86AEF4", "#B5CDF8"],
};

/** Colour-blind-safe categorical set (Okabe-Ito derived). */
export const CAT: Record<Theme, string[]> = {
  light: ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00", "#7A5195", "#6B7280"],
  dark: ["#4DA3E0", "#F2B63D", "#2FC49B", "#E39CC4", "#86CBF2", "#F08A4B", "#A58AD0", "#9AA1AE"],
};

/** Stable categorical colour for a key (same hue everywhere). */
export function catColor(index: number, theme: Theme): string {
  const set = CAT[theme];
  return set[((index % set.length) + set.length) % set.length];
}
