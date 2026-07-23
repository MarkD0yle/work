import type { NarrativeSection, NarrativeSectionId } from "../../lib/pitchPerfect/types";
import type { NarrativeSectionDef } from "../../lib/pitchPerfect/narrative";

/* Adapted from components/pitch/SectionRail.tsx, retyped for narrative
 * sections — id domain differs (NarrativeSectionId vs. SectionId) so this
 * can't be the same component, but the interaction/visual pattern is identical. */

const STATUS_DOT: Record<NarrativeSection["status"], string> = {
  empty: "bg-neutral-300",
  drafted: "bg-amber-400",
  reviewed: "bg-sky-500",
  approved: "bg-emerald-500",
};

const BAND_TONE: Record<string, string> = {
  Strong: "text-emerald-700",
  Solid: "text-amber-700",
  "Needs work": "text-rose-700",
};

export function NarrativeRail({
  defs,
  sections,
  activeId,
  onSelect,
}: {
  defs: NarrativeSectionDef[];
  sections: Record<NarrativeSectionId, NarrativeSection>;
  activeId: NarrativeSectionId;
  onSelect: (id: NarrativeSectionId) => void;
}) {
  return (
    <ol className="flex flex-col gap-0.5">
      {defs.map((def) => {
        const section = sections[def.id];
        const active = def.id === activeId;
        return (
          <li key={def.id}>
            <button
              type="button"
              onClick={() => onSelect(def.id)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
              }`}
            >
              <span
                className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : STATUS_DOT[section.status]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-medium ${active ? "text-white" : "text-neutral-800"}`}>{def.label}</span>
                <span className={`mt-0.5 block truncate text-[11px] ${active ? "text-white/60" : "text-neutral-400"}`}>
                  {section.review
                    ? `${section.review.band} · ${section.review.checks.filter((c) => c.pass).length}/${section.review.checks.length}`
                    : section.status === "empty"
                      ? "Not started"
                      : "Not reviewed"}
                </span>
              </span>
              {section.review && !active && (
                <span className={`mt-0.5 shrink-0 text-[11px] font-semibold ${BAND_TONE[section.review.band] ?? "text-neutral-400"}`}>
                  {section.review.score}
                </span>
              )}
              {section.status === "approved" && (
                <span className={`mt-0.5 shrink-0 text-xs ${active ? "text-emerald-300" : "text-emerald-600"}`} aria-hidden>
                  ✓
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
