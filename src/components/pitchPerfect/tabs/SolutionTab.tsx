import { CAPABILITY_CATALOG } from "../../../lib/pitchPerfect/capabilityData";
import { KNOWLEDGE_LIBRARY } from "../../../lib/pitchPerfect/knowledgeData";
import type { KnowledgeItem, Opportunity, PainPoint, SolutionItem } from "../../../lib/pitchPerfect/types";
import { ReadEditSection } from "../ReadEditSection";
import { SolutionMappingEditor } from "../SolutionMappingEditor";

function SolutionTable({ solution, painPoints }: { solution: SolutionItem[]; painPoints: PainPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            <th className="py-2 pr-3 font-semibold">Pain point</th>
            <th className="py-2 pr-3 font-semibold">Capability</th>
            <th className="py-2 font-semibold">Differentiation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {solution.map((item) => {
            const pp = painPoints.find((p) => p.id === item.painPointId);
            const cap = CAPABILITY_CATALOG.find((c) => c.id === item.capabilityId);
            return (
              <tr key={item.id}>
                <td className="py-2.5 pr-3 align-top text-neutral-800">{pp?.label ?? "—"}</td>
                <td className="py-2.5 pr-3 align-top text-neutral-800">{cap?.name ?? "—"}</td>
                <td className="py-2.5 align-top text-neutral-600">{item.differentiation || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SolutionTab({ opportunity, onSaveSolution }: { opportunity: Opportunity; onSaveSolution: (solution: SolutionItem[]) => void }) {
  const painPoints = opportunity.intelligence.painPoints;
  const competitiveGuidance = opportunity.knowledgeAttachments
    .map((a) => KNOWLEDGE_LIBRARY.find((k) => k.id === a.itemId))
    .filter((k): k is KnowledgeItem => k !== undefined && k.category === "Competitive guidance");

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <ReadEditSection<SolutionItem[]>
        title="Solution design"
        description="Which capabilities address which pain points, and how each differs from competitors."
        value={opportunity.solution}
        isEmpty={(v) => v.length === 0}
        emptyLabel="No solution mapped yet."
        onSave={onSaveSolution}
        renderRead={(v) => <SolutionTable solution={v} painPoints={painPoints} />}
        renderEdit={(draft, setDraft) => <SolutionMappingEditor solution={draft} painPoints={painPoints} onChange={setDraft} />}
      />

      {competitiveGuidance.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Attached competitive guidance</div>
          <ul className="mt-2 space-y-1.5 text-xs text-neutral-700">
            {competitiveGuidance.map((k) => (
              <li key={k.id}>
                <span className="font-medium">{k.title}:</span> {k.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
