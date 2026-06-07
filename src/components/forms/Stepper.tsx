export type Step = {
  id: string;
  label: string;
  help?: string;
};

/* Stepper — progress indicator for multi-step flows, in two orientations.
 *
 *   vertical   → a left rail with connectors (guided full-page wizards)
 *   horizontal → a compact top bar of numbered nodes (sign-up, short flows)
 *
 * Completed steps are clickable so users can jump back; future steps are
 * locked. State is purely derived from `current` (the active index) so the
 * parent owns navigation. */
export function Stepper({
  steps,
  current,
  onJump,
  orientation = "vertical",
}: {
  steps: Step[];
  current: number;
  onJump?: (index: number) => void;
  orientation?: "vertical" | "horizontal";
}) {
  if (orientation === "horizontal") {
    return (
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => done && onJump?.(i)}
                disabled={!done}
                className="flex items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                    done
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : active
                        ? "border-neutral-900 bg-white text-neutral-900"
                        : "border-neutral-300 bg-white text-neutral-400"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    active
                      ? "text-neutral-900"
                      : done
                        ? "text-neutral-600"
                        : "text-neutral-400"
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`mx-3 h-px flex-1 ${done ? "bg-neutral-900" : "bg-neutral-200"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="relative pb-5 last:pb-0">
            <button
              type="button"
              onClick={() => i < current && onJump?.(i)}
              disabled={i > current}
              className="flex w-full items-start gap-3 text-left disabled:cursor-default"
            >
              <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-neutral-900 bg-white text-neutral-900"
                      : "border-neutral-300 bg-white text-neutral-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    active
                      ? "text-neutral-900"
                      : done
                        ? "text-neutral-700"
                        : "text-neutral-400"
                  }`}
                >
                  {s.label}
                </span>
                {s.help && (
                  <span className="mt-0.5 block text-xs text-neutral-500">{s.help}</span>
                )}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-7 left-3 h-[calc(100%-1.25rem)] w-px ${
                  done ? "bg-emerald-300" : "bg-neutral-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
