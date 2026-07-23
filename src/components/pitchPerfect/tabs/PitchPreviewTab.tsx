import { motion } from "framer-motion";
import { CLIENTS } from "../../../lib/pitch/data";
import { CAPABILITY_CATALOG } from "../../../lib/pitchPerfect/capabilityData";
import { KNOWLEDGE_LIBRARY } from "../../../lib/pitchPerfect/knowledgeData";
import { NARRATIVE_SECTION_DEFS, autoDraftNarrative, buildNarrativeSource } from "../../../lib/pitchPerfect/narrative";
import { suggestNextSteps } from "../../../lib/pitchPerfect/pitchSuggestions";
import { canGenerateAssets } from "../../../lib/pitchPerfect/assets";
import type { Opportunity, TabId } from "../../../lib/pitchPerfect/types";

const CAPABILITIES_BY_ID = Object.fromEntries(CAPABILITY_CATALOG.map((c) => [c.id, c]));
const KNOWLEDGE_BY_ID = Object.fromEntries(KNOWLEDGE_LIBRARY.map((k) => [k.id, k]));

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-neutral-300",
};

/* Pitch Preview — the pitch assembling live, one place. Every section reads
 * either the actually-authored content (once someone's written it) or a
 * muted "live preview" auto-drafted from whatever data exists so far, so the
 * document visibly grows richer as Intelligence/Solution/Narrative fill in —
 * not a separate deliverable you generate once at the end (that's Assets). */
export function PitchPreviewTab({ opportunity, onNavigate }: { opportunity: Opportunity; onNavigate: (tab: TabId) => void }) {
  const client = CLIENTS.find((c) => c.id === opportunity.clientId);
  const source = buildNarrativeSource(opportunity, CAPABILITIES_BY_ID, KNOWLEDGE_BY_ID);
  const suggestions = suggestNextSteps(opportunity).slice(0, 4);

  const readyForDelivery = canGenerateAssets(opportunity.narrative) && Boolean(opportunity.assets) && opportunity.rehearsal.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">AI suggestions</div>
          {suggestions.length === 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Nothing outstanding</span>
          )}
        </div>
        {suggestions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            {readyForDelivery ? "This pitch is ready to deliver." : "No urgent gaps right now — keep building out the story."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(s.targetTab)}
                  className="flex w-full items-start gap-2.5 py-2.5 text-left transition hover:bg-neutral-50"
                >
                  <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[s.priority]}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-neutral-900">{s.label}</span>
                    <span className="block text-xs text-neutral-500">{s.detail}</span>
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-neutral-400">Go →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <motion.div layout className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-100 px-6 py-5">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Your pitch · building for {client?.name ?? "this client"}
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
            {opportunity.name || "Untitled opportunity"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {opportunity.objective || <span className="text-neutral-300 italic">Objective not set yet — add it in Define.</span>}
          </p>
        </header>

        <div className="divide-y divide-neutral-100">
          {NARRATIVE_SECTION_DEFS.map((def) => {
            const section = opportunity.narrative[def.id];
            const authored = section.content.trim();
            const preview = !authored ? autoDraftNarrative(def.id, source).trim() : "";
            const hasPreview = !authored && preview && (source.painPoints.length > 0 || source.solution.length > 0);

            return (
              <motion.section layout key={def.id} className="px-6 py-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{def.label}</h2>
                  {authored && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {section.status === "approved" ? "Approved" : "Drafted"}
                    </span>
                  )}
                  {!authored && hasPreview && (
                    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Live preview</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">
                  {authored ? (
                    section.content
                  ) : hasPreview ? (
                    <span className="text-neutral-500 italic">{preview}</span>
                  ) : (
                    <span className="text-neutral-300 italic">Not enough information yet.</span>
                  )}
                </p>
                {!authored && (
                  <button
                    type="button"
                    onClick={() => onNavigate("narrative")}
                    className="mt-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
                  >
                    {hasPreview ? "Draft this for real →" : "Go add the source data →"}
                  </button>
                )}
              </motion.section>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-neutral-100 sm:grid-cols-4">
          <DeliveryStat label="Knowledge attached" value={opportunity.knowledgeAttachments.length} />
          <DeliveryStat label="Assets" value={opportunity.assets ? "Generated" : "Pending"} />
          <DeliveryStat label="Rehearsal sessions" value={opportunity.rehearsal.length} />
          <DeliveryStat label="Outcome" value={opportunity.outcome ? opportunity.outcome.result : "Not yet"} />
        </div>
      </motion.div>
    </div>
  );
}

function DeliveryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] font-medium text-neutral-400 uppercase">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
