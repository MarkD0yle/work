import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cx, focus } from "../patterns/tokens";

/* Tour — a guided walk-through, one step card at a time.
 *
 * Used for the welcome tour (steps point at sections of the landing page)
 * and the What's New tour (steps are feed entries). A step with a `target`
 * scrolls the element carrying that `data-tour` name into view and outlines
 * it. Left and right arrows move between steps, Escape closes, and Tab stays
 * inside the card while it is open. */

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Small label above the title, e.g. a date. */
  kicker?: string;
  /** `data-tour` name of the element this step is about. */
  target?: string;
  action?: { label: string; onClick: () => void };
};

export function Tour({
  label,
  steps,
  onClose,
}: {
  /** Accessible name, e.g. "Welcome tour". */
  label: string;
  steps: TourStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const stepId = step?.id;
  const target = step?.target;

  // Point at the step's target, and stop pointing when the step changes.
  useEffect(() => {
    nextRef.current?.focus();
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.setAttribute("data-tour-active", "true");
    el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    return () => el.removeAttribute("data-tour-active");
  }, [stepId, target]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  function trapTab(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const controls = cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (!controls || controls.length === 0) return;
    const first = controls[0];
    const final = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      final.focus();
    } else if (!e.shiftKey && document.activeElement === final) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!step) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={label}
      onKeyDown={trapTab}
      className="fixed inset-x-4 bottom-4 z-[80] border border-neutral-950 bg-white shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2">
        <span className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          {label} · {index + 1} of {steps.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className={cx("text-xs font-medium text-neutral-500 hover:text-neutral-950", focus)}
        >
          Skip
        </button>
      </div>
      <div className="px-4 py-4" aria-live="polite">
        {step.kicker && <p className="text-[11px] font-medium text-indigo-600">{step.kicker}</p>}
        <h2 className="text-base font-semibold text-neutral-950">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">{step.body}</p>
        {step.action && (
          <button
            type="button"
            onClick={step.action.onClick}
            className={cx("mt-3 text-sm font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-900", focus)}
          >
            {step.action.label}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-neutral-200 px-4 py-3">
        <div className="flex flex-1 items-center gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={cx("h-1.5 w-1.5 rounded-full", i === index ? "bg-neutral-950" : "bg-neutral-300")}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          className={cx("px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40", focus)}
        >
          Back
        </button>
        <button
          ref={nextRef}
          type="button"
          onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
          className={cx("bg-neutral-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700", focus)}
        >
          {last ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
