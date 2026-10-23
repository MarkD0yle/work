import { createContext, useContext } from "react";
import type { PrefTheme } from "../ui/context";

export type PreviewState = "none" | "loading" | "empty" | "error";
export type Prefs = { theme: PrefTheme; colorBlindSafe: boolean; density: "compact" | "default" | "comfortable" | "auto"; previewState: PreviewState };
export type PrefsContextValue = { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; resetLayout: () => void };
export const DEFAULT_PREFS: Prefs = { theme: "system", colorBlindSafe: false, density: "auto", previewState: "none" };
export const PrefsContext = createContext<PrefsContextValue>({ prefs: DEFAULT_PREFS, setPrefs: () => {}, resetLayout: () => {} });
export const usePrefs = () => useContext(PrefsContext);

/** Stand-in for Storybook: forces every screen into loading / empty / error from My Preferences. */
export const usePreviewState = () => usePrefs().prefs.previewState;
