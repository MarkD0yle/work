/* eslint-disable react-refresh/only-export-components -- hooks/contexts live beside their components; HMR granularity is not a concern here */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ShellContextValue = {
  route: string;
  navigate: (route: string) => void;
  /** Slot element in the toolbar's context zone. */
  slot: HTMLElement | null;
  busy: number;
  addBusy: (d: number) => void;
  favorites: string[];
  toggleFavorite: (route: string) => void;
};

export const ShellContext = createContext<ShellContextValue>({
  route: "home", navigate: () => {}, slot: null, busy: 0, addBusy: () => {}, favorites: [], toggleFavorite: () => {},
});
export const useShell = () => useContext(ShellContext);

/** Pages opt in to context-zone controls by rendering children here. The fixed zone is never touched. */
export function ToolbarContext({ children }: { children: ReactNode }) {
  const { slot } = useShell();
  return slot ? createPortal(children, slot) : null;
}

/** Refresh state: keeps old data visible while a subtle progress bar shows under the toolbar. */
export function useRefresh(ms = 700) {
  const { addBusy } = useShell();
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true); addBusy(1);
    window.setTimeout(() => { setLoadedAt(new Date()); setRefreshing(false); addBusy(-1); }, ms);
  }, [addBusy, ms]);
  useEffect(() => undefined, []);
  return { loadedAt, refreshing, refresh };
}
