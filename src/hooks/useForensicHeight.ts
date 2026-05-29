import { useCallback, useEffect, useState } from "react";

/* Sheet height persistence — spec v0.1.2 L4 §3.3.
 *
 * Default 60% viewport. Clamp 30%-85%. Persist last user-chosen height
 * to localStorage per user (not per session). */

const STORAGE_KEY = "ccymgmt.forensicSheetHeightPct.v1";
const DEFAULT_PCT = 60;
const MIN_PCT = 30;
const MAX_PCT = 85;

function clamp(pct: number) {
  return Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
}

function load(): number {
  if (typeof window === "undefined") return DEFAULT_PCT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PCT;
    const num = Number(raw);
    if (!Number.isFinite(num)) return DEFAULT_PCT;
    return clamp(num);
  } catch {
    return DEFAULT_PCT;
  }
}

function save(pct: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(pct));
  } catch {
    // Persistence failure is non-fatal.
  }
}

export function useForensicHeight() {
  const [pct, setPctState] = useState<number>(() => load());

  useEffect(() => {
    save(pct);
  }, [pct]);

  const setPct = useCallback((next: number) => {
    setPctState(clamp(next));
  }, []);

  return { pct, setPct, minPct: MIN_PCT, maxPct: MAX_PCT };
}
