import { CLIENTS } from "../../lib/pitch/data";
import { opportunityStatus, overallReadinessFraction } from "../../lib/pitchPerfect/opportunity";
import type { Opportunity } from "../../lib/pitchPerfect/types";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-neutral-100 text-neutral-600",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-rose-50 text-rose-700",
};

export function OpportunityHeader({ opportunity }: { opportunity: Opportunity }) {
  const client = CLIENTS.find((c) => c.id === opportunity.clientId);
  const status = opportunityStatus(opportunity);
  const { done, total } = overallReadinessFraction(opportunity);

  return (
    <header className="border-b border-neutral-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{client?.name ?? "Unknown client"}</h1>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[status]}`}>{status}</span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {opportunity.pitchType} · {opportunity.name || "Untitled opportunity"}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">{done}/{total} sections complete</div>
      </div>
    </header>
  );
}
