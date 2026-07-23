import { CLIENTS } from "../../lib/pitch/data";
import { opportunityReadiness, opportunityStatus } from "../../lib/pitchPerfect/opportunity";
import type { Opportunity, TabId } from "../../lib/pitchPerfect/types";
import { ReadinessBadge } from "./ReadinessBadge";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-neutral-100 text-neutral-600",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-rose-50 text-rose-700",
};

const TAB_ORDER: TabId[] = ["define", "intelligence", "knowledge", "solution", "narrative", "assets", "rehearse", "outcome"];

export function OpportunityCard({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: () => void }) {
  const client = CLIENTS.find((c) => c.id === opportunity.clientId);
  const status = opportunityStatus(opportunity);
  const readiness = opportunityReadiness(opportunity);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{client?.name ?? "Unknown client"}</div>
          <div className="mt-0.5 text-xs text-neutral-500">{opportunity.pitchType}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[status]}`}>
          {status}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-neutral-500">
        {opportunity.objective || opportunity.scope || "No objective set yet."}
      </p>
      <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
        <div className="flex items-center gap-1" title="Tab readiness: define, intelligence, knowledge, solution, narrative, assets, rehearse, outcome">
          {TAB_ORDER.map((t) => (
            <ReadinessBadge key={t} readiness={readiness[t]} title={t} />
          ))}
        </div>
        <span className="text-[11px] text-neutral-400">{new Date(opportunity.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  );
}
