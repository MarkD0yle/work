import { useState, type ReactNode } from "react";
import type { KnowledgeItem } from "../../lib/pitchPerfect/types";

const CATEGORY_TONE: Record<string, string> = {
  Positioning: "bg-sky-50 text-sky-700",
  Differentiator: "bg-violet-50 text-violet-700",
  "Proof point": "bg-amber-50 text-amber-700",
  "Case study": "bg-emerald-50 text-emerald-700",
  "Reference story": "bg-indigo-50 text-indigo-700",
  "Competitive guidance": "bg-rose-50 text-rose-700",
};

export function KnowledgeItemCard({ item, action }: { item: KnowledgeItem; action?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_TONE[item.category] ?? "bg-neutral-100 text-neutral-600"}`}>
              {item.category}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">✓ Governed</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-neutral-900">{item.title}</div>
          <p className="mt-0.5 text-xs text-neutral-500">{item.summary}</p>
          {expanded && <p className="mt-2 text-xs leading-relaxed text-neutral-700">{item.body}</p>}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
