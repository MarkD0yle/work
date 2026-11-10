import { useId, type KeyboardEvent, type ReactNode } from "react";
import { cx, focus } from "../patterns/tokens";
import { useRotation } from "../../hooks/useRotation";

/* FeatureShowcase — one landing-page section that rotates through examples.
 *
 * A list of examples on one side, a live preview of the active one on the
 * other. It is a vertical tab set that advances by itself: see useRotation
 * for when it pauses and stops. The progress bar on the active tab is both
 * the "time left" cue and the timer. */

export type ShowcaseExample = {
  id: string;
  label: string;
  detail: string;
  preview: ReactNode;
  cta: { label: string; onClick: () => void };
};

export function FeatureShowcase({
  tourId,
  eyebrow,
  title,
  blurb,
  examples,
  flip = false,
}: {
  /** `data-tour` name, so a tour step can point at this section. */
  tourId: string;
  eyebrow: string;
  title: string;
  blurb: string;
  examples: ShowcaseExample[];
  /** Put the preview on the left at desktop widths. */
  flip?: boolean;
}) {
  const uid = useId();
  const { ref, index, playing, paused, canPlay, select, advance, toggle, bind } =
    useRotation<HTMLElement>(examples.length);
  const active = examples[index];

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + examples.length) % examples.length;
    select(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  }

  return (
    <section
      ref={ref}
      data-tour={tourId}
      aria-labelledby={`${uid}-title`}
      className="border-t border-neutral-200 py-16 sm:py-24"
      {...bind}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-8 lg:grid-cols-12 lg:gap-12">
        <div className={cx("lg:col-span-5", flip && "lg:order-2")}>
          <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">{eyebrow}</p>
          <h2 id={`${uid}-title`} className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">{blurb}</p>

          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={title}
            onKeyDown={onKeyDown}
            className="mt-8 border-l border-neutral-200"
          >
            {examples.map((example, i) => {
              const on = i === index;
              return (
                <button
                  key={example.id}
                  id={`${uid}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`${uid}-panel`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(i)}
                  className={cx(
                    "relative -ml-px block w-full border-l-2 py-3 pr-2 pl-4 text-left",
                    on ? "border-neutral-950" : "border-transparent hover:border-neutral-400",
                    focus,
                  )}
                >
                  <span className={cx("block text-sm font-semibold", on ? "text-neutral-950" : "text-neutral-500")}>
                    {example.label}
                  </span>
                  {on && <span className="mt-1 block text-sm leading-relaxed text-neutral-600">{example.detail}</span>}
                  {on && playing && (
                    <span aria-hidden className="absolute inset-x-4 bottom-0 block h-0.5 bg-neutral-200">
                      <span
                        key={index}
                        data-paused={paused}
                        onAnimationEnd={advance}
                        className="rotation-progress block h-full bg-indigo-600"
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {canPlay && (
            <button
              type="button"
              onClick={toggle}
              aria-pressed={!playing}
              className={cx("mt-4 ml-4 text-xs font-medium text-neutral-500 hover:text-neutral-950", focus)}
            >
              {playing ? "Pause rotation" : "Resume rotation"}
            </button>
          )}
        </div>

        <div
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${index}`}
          className={cx("lg:col-span-7", flip && "lg:order-1")}
        >
          <div className="border border-neutral-200 bg-white shadow-sm">
            <div key={active.id} className="animate-landing-fade-in grid h-72 place-items-stretch sm:h-80 overflow-hidden p-4 sm:p-6">
              {active.preview}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 sm:px-6">
              <span className="min-w-0 truncate text-xs text-neutral-500">{active.label}</span>
              <button
                type="button"
                onClick={active.cta.onClick}
                className={cx(
                  "shrink-0 bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700",
                  focus,
                )}
              >
                {active.cta.label}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
