import { useEffect, useRef, useState } from "react";

/* Deterministic-ish price simulation for the panels that stream.
 *
 * A seeded LCG rather than Math.random so a rerender doesn't produce a wildly
 * different tape, and a single interval per hook so two panels mounting at
 * once don't drift into a stutter. Price, direction and the sparkline trail
 * advance together in one state update — deriving the trail from the price in
 * a second effect would render twice per tick and let the two fall out of step.
 *
 * Motion is suppressed under prefers-reduced-motion — a ticking ladder is
 * exactly the kind of thing that setting exists for, and the numbers are still
 * correct when frozen.
 */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export type Tape = {
  price: number;
  direction: "up" | "down" | "flat";
  /** Rolling window of recent prices, oldest first — for sparklines. */
  trail: number[];
};

/** Random-walks `initial` by ±`volatility` on each interval. */
export function useTickingPrice(
  initial: number,
  { volatility = 0.0002, intervalMs = 1400, seed = 7, trailSize = 28 } = {},
): Tape {
  // Pre-roll the trail so the sparkline has a shape on first paint. A flat
  // line for the first half-minute reads as "broken", not as "no data yet".
  const [tape, setTape] = useState<Tape>(() => {
    const warmup = lcg(seed);
    const bound = initial * 0.01;
    const trail: number[] = [];
    let p = initial;
    for (let i = 0; i < trailSize; i++) {
      const drift = (warmup() - 0.5) * 2 * volatility * initial;
      // Same tether the live walk uses, so the pre-roll can't start the panel
      // outside the range the interval will keep it in.
      p = Math.min(initial + bound, Math.max(initial - bound, p + drift));
      trail.push(p);
    }
    return { price: trail[trail.length - 1], direction: "flat", trail };
  });
  const rand = useRef(lcg(seed));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      setTape((prev) => {
        const drift = (rand.current() - 0.5) * 2 * volatility * initial;
        // Tether the walk so a long-lived panel doesn't wander off the scale.
        const bound = initial * 0.01;
        const price = Math.min(
          initial + bound,
          Math.max(initial - bound, prev.price + drift),
        );
        return {
          price,
          direction: price > prev.price ? "up" : price < prev.price ? "down" : "flat",
          trail: [...prev.trail.slice(1), price],
        };
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [initial, volatility, intervalMs]);

  return tape;
}
