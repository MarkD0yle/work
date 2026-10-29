import { useEffect, useState } from "react";

/* useLocalStorage — a tiny persisted-state hook.
 *
 * Mirrors useState but reads the initial value from localStorage (falling back
 * to `initial`) and writes back on every change. Guards against SSR / private
 * mode where storage may be unavailable, and serialises with JSON. The
 * initializer runs once, so `initial` is only consulted on first mount. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — degrade to in-memory state silently.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
