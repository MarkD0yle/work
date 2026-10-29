import { createContext, useContext } from "react";
import type { Theme } from "../tokens";

export type { Theme };
export type PrefTheme = "system" | Theme;
export type EaContextValue = {
  /** Element overlays portal into, so they inherit the scoped tokens. */
  portal: HTMLElement | null;
  theme: Theme;
  colorBlindSafe: boolean;
};

export const EaContext = createContext<EaContextValue>({ portal: null, theme: "light", colorBlindSafe: false });
export const useEa = () => useContext(EaContext);
