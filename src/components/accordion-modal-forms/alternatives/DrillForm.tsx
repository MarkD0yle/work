import type { ReactNode } from "react";
import { Chip } from "../kit";
import { SectionFields, SectionHeading } from "./ShareClassFields";
import { SECTIONS, sectionComplete, sectionSummary, type ShareClass } from "./share-class";

/* DrillForm — the full-width, three-step editor used when a view is pushed
 * into the parent dialog (alternative F, and the import review's "Open").
 * Left: a rail of the three sections (jumpable, with completion) and a live
 * preview of the table row. Right: the current section's fields, two-up. */
export function DrillForm({
  draft,
  step,
  onStep,
  onChange,
  notes,
}: {
  draft: ShareClass;
  step: number;
  onStep: (i: number) => void;
  onChange: (key: string, value: string) => void;
  /** Per-field footnotes (e.g. unrecognised spreadsheet values). */
  notes?: Record<string, ReactNode>;
}) {
  const section = SECTIONS[step];
  return (
    <div className="grid gap-6 animate-[drill-in_220ms_ease-out] md:grid-cols-4">
      {/* Rail: the three sections as jumpable steps + a running summary. */}
      <aside className="md:col-span-1">
        <ol className="border border-neutral-200 bg-white">
          {SECTIONS.map((s, i) => {
            const complete = sectionComplete(draft, s.id);
            const active = i === step;
            return (
              <li key={s.id} className={i > 0 ? "border-t border-neutral-100" : ""}>
                <button
                  type="button"
                  onClick={() => onStep(i)}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full items-start gap-3 px-3 py-3 text-left transition ${
                    active ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center font-mono text-[11px] font-semibold ${
                      complete
                        ? "bg-emerald-600 text-white"
                        : active
                          ? "border border-white/40 text-white"
                          : "border border-neutral-300 text-neutral-600"
                    }`}
                  >
                    {complete ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{s.label}</span>
                    <span className={`block text-[11px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                      {complete ? "Complete" : "Incomplete"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-3 border border-neutral-200 bg-white px-3 py-3">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Row preview</div>
          <dl className="mt-2 space-y-2.5 text-xs">
            {SECTIONS.map((s) => {
              const sum = sectionSummary(draft, s.id);
              return (
                <div key={s.id}>
                  <dt className="flex items-baseline justify-between gap-2 text-neutral-500">
                    <span>{s.label}</span>
                    <span className={`tabular-nums ${sum.complete ? "text-neutral-400" : "text-amber-700"}`}>
                      {sum.answered}/{sum.total}
                      {sum.missing ? ` · ${sum.missing} blank` : ""}
                    </span>
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {sum.yes.length ? (
                      sum.yes.map((q) => (
                        <Chip key={q.key} tone="info">
                          {q.short}
                        </Chip>
                      ))
                    ) : (
                      <span className="text-neutral-400">{sum.answered ? "All no" : "—"}</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </aside>

      {/* Content: one section at a time, full width. */}
      <section key={section.id} aria-label={section.label} className="border border-neutral-200 bg-white px-5 py-5 animate-[drill-in_200ms_ease-out] md:col-span-3">
        <SectionHeading section={section.id} value={draft} size="lg" />
        <div className="mt-5">
          <SectionFields section={section.id} value={draft} onChange={onChange} idPrefix={`dr-${section.id}`} columns={2} notes={notes} />
        </div>
      </section>
    </div>
  );
}
