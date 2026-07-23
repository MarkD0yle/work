import { CAPABILITY_CATALOG } from "../../../lib/pitchPerfect/capabilityData";
import { KNOWLEDGE_LIBRARY } from "../../../lib/pitchPerfect/knowledgeData";
import { canGenerateAssets, generateAssets } from "../../../lib/pitchPerfect/assets";
import { NARRATIVE_SECTION_DEFS } from "../../../lib/pitchPerfect/narrative";
import type { Opportunity, PitchAssets } from "../../../lib/pitchPerfect/types";
import { DeckOutlineView } from "../DeckOutlineView";

const CAPABILITIES_BY_ID = Object.fromEntries(CAPABILITY_CATALOG.map((c) => [c.id, c]));
const KNOWLEDGE_BY_ID = Object.fromEntries(KNOWLEDGE_LIBRARY.map((k) => [k.id, k]));

/* Assets — generate-only, no manual editing: allowing free edits would break
 * the "grounded in approved content" guarantee (capability 6). Locked until
 * every narrative section is approved. */
export function AssetsTab({ opportunity, onSaveAssets }: { opportunity: Opportunity; onSaveAssets: (assets: PitchAssets) => void }) {
  const ready = canGenerateAssets(opportunity.narrative);
  const unapproved = NARRATIVE_SECTION_DEFS.filter((d) => opportunity.narrative[d.id].status !== "approved");

  function generate() {
    onSaveAssets(generateAssets(opportunity, CAPABILITIES_BY_ID, KNOWLEDGE_BY_ID));
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Assets locked</div>
          <p className="mt-2 text-sm text-neutral-600">
            Every narrative section needs to be approved before assets can be generated — assets are assembled strictly
            from approved narrative content, so nothing here is invented.
          </p>
          <p className="mt-3 text-xs text-neutral-500">Still needs approval: {unapproved.map((d) => d.label).join(", ")}</p>
        </div>
      </div>
    );
  }

  const assets = opportunity.assets;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Pitch assets</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Generated from the approved narrative, attached knowledge, and solution differentiators.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {assets ? "Regenerate" : "Generate assets"}
        </button>
      </div>

      {!assets ? (
        <p className="text-sm text-neutral-400 italic">Not generated yet.</p>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Executive summary</div>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">{assets.executiveSummary}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Proposal summary</div>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">{assets.proposalSummary}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Talking points</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-neutral-800">
              {assets.talkingPoints.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Deck outline</div>
            <DeckOutlineView slides={assets.deckOutline} />
          </div>
          <p className="text-[11px] text-neutral-400">Generated {new Date(assets.generatedAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}
