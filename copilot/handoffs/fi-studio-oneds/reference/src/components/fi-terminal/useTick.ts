import { useEffect, useState } from "react";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** A counter that advances every `ms`. Frozen under prefers-reduced-motion. */
export function useTick(ms = 1000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

/** Wall clock, updated every second (always runs — a clock that stops is wrong, not calm). */
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Smooth deterministic wobble in [-1, 1] for tick `n` and channel `k`. */
export function wobble(n: number, k: number) {
  return Math.sin(n * 0.37 + k * 1.91) * 0.6 + Math.sin(n * 0.11 + k * 0.53) * 0.4;
}
