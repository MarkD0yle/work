import { useMemo, useState } from "react";
import { searchKnowledge } from "../../lib/pitchPerfect/knowledgeSearch";
import type { KnowledgeCategory, KnowledgeItem } from "../../lib/pitchPerfect/types";
import { KnowledgeItemCard } from "./KnowledgeItemCard";

const CATEGORIES: KnowledgeCategory[] = [
  "Positioning",
  "Differentiator",
  "Proof point",
  "Case study",
  "Reference story",
  "Competitive guidance",
];

export function KnowledgeBrowser({
  attachedIds,
  onAttach,
  onDetach,
}: {
  attachedIds: Set<string>;
  onAttach: (item: KnowledgeItem) => void;
  onDetach: (itemId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<KnowledgeCategory | "all">("all");

  const results = useMemo(() => searchKnowledge(query, category), [query, category]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search governed knowledge…"
          className="w-64 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                category === c ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {results.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">No knowledge items match.</p>
        ) : (
          results.map((item) => {
            const attached = attachedIds.has(item.id);
            return (
              <KnowledgeItemCard
                key={item.id}
                item={item}
                action={
                  <button
                    type="button"
                    onClick={() => (attached ? onDetach(item.id) : onAttach(item))}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                      attached
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-neutral-900 text-white hover:bg-neutral-800"
                    }`}
                  >
                    {attached ? "Attached ✓" : "Attach"}
                  </button>
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}
