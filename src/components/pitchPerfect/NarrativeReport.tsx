import { CLIENTS } from "../../lib/pitch/data";
import { NARRATIVE_SECTION_DEFS } from "../../lib/pitchPerfect/narrative";
import type { Opportunity } from "../../lib/pitchPerfect/types";

/* Adapted from components/pitch/ReportView.tsx — the compiled, read-only
 * narrative report. Reused both as the Narrative tab's read view and inside
 * AssetsTab as a "grounded in" reference. */
export function NarrativeReport({ opportunity }: { opportunity: Opportunity }) {
  const client = CLIENTS.find((c) => c.id === opportunity.clientId);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-100 px-6 py-5">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Narrative · prepared by {client?.advisor ?? "—"}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">{client?.name ?? "Unknown client"}</h1>
        {opportunity.objective && (
          <p className="mt-1 text-sm text-neutral-600">
            Objective: <span className="text-neutral-800">{opportunity.objective}</span>
          </p>
        )}
      </header>
      <div className="divide-y divide-neutral-100">
        {NARRATIVE_SECTION_DEFS.map((def) => {
          const section = opportunity.narrative[def.id];
          return (
            <section key={def.id} className="px-6 py-5">
              <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{def.label}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">
                {section.content || <span className="text-neutral-300 italic">Not drafted.</span>}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
