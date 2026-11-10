import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/* useRotation — the state behind an auto-rotating set of examples.
 *
 * There is no timer here. The active example shows a progress bar whose CSS
 * animation is the clock (`.rotation-progress` in index.css): when it ends
 * the caller invokes `advance`, and while `paused` is true the caller sets
 * the animation's play state to paused. One source of time, nothing to sync.
 *
 * Rotation pauses while the pointer or keyboard focus is inside, while the
 * section is off screen, and while the browser tab is hidden. Picking an
 * example stops it. It never starts under prefers-reduced-motion. Pressing
 * play after a stop is an explicit request, so from then on only "off
 * screen" and "tab hidden" pause it. */

type Mode = "auto" | "stopped" | "forced";

export function useRotation<E extends HTMLElement>(count: number) {
  const ref = useRef<E>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("auto");
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const playing = mode !== "stopped" && !reduced;
  const paused =
    !inView || tabHidden || (mode === "auto" && (hover || focused));

  /** Choose an example by hand. Stops the rotation. */
  const select = useCallback((i: number) => {
    setIndex(i);
    setMode("stopped");
  }, []);

  /** Move to the next example. Call when the progress animation ends. */
  const advance = useCallback(
    () => setIndex((i) => (i + 1) % count),
    [count],
  );

  const toggle = useCallback(
    () => setMode((m) => (m === "stopped" ? "forced" : "stopped")),
    [],
  );

  const bind = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setFocused(true),
    onBlur: (e: FocusEvent<E>) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
    },
  };

  return {
    ref,
    index: index % count,
    playing,
    paused,
    /** False when the user prefers reduced motion: hide the play control. */
    canPlay: !reduced,
    select,
    advance,
    toggle,
    bind,
  };
}
