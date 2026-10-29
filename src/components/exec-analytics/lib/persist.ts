import { useLocalStorage } from "../../../hooks/useLocalStorage";

/** Per-user persisted state, namespaced so it never collides with other gallery pages. */
export function usePersisted<T>(key: string, initial: T) {
  return useLocalStorage<T>(`ea.${key}`, initial);
}

export function clearPersisted(prefixes: string[]) {
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith("ea.") && prefixes.some((p) => k.startsWith(`ea.${p}`))) window.localStorage.removeItem(k);
    }
  } catch { /* storage unavailable */ }
}
