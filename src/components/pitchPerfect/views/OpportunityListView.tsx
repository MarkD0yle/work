import { useMemo, useState } from "react";
import { useOpportunities } from "../../../hooks/useOpportunities";
import { CLIENTS } from "../../../lib/pitch/data";
import { opportunityStatus } from "../../../lib/pitchPerfect/opportunity";
import type { OpportunityStatus } from "../../../lib/pitchPerfect/types";
import { OpportunityCard } from "../OpportunityCard";

type StatusFilter = "all" | OpportunityStatus;

/* Secondary "browse all" surface — the persistent GlobalHeader's client +
 * opportunity dropdowns are the primary entry point, but this card grid
 * stays useful for scanning/searching across everything at once. */
export function OpportunityListView({ onOpen, onNewOpportunity }: { onOpen: (id: string) => void; onNewOpportunity: () => void }) {
  const opportunities = useOpportunities();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (statusFilter !== "all" && opportunityStatus(o) !== statusFilter) return false;
      if (!q) return true;
      const client = CLIENTS.find((c) => c.id === o.clientId);
      return (
        (client?.name.toLowerCase().includes(q) ?? false) ||
        o.name.toLowerCase().includes(q) ||
        o.objective.toLowerCase().includes(q)
      );
    });
  }, [opportunities, query, statusFilter]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Opportunities</h1>
        <p className="mt-0.5 text-xs text-neutral-500">Prepare, deliver, and learn from every client pitch in one place.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client or objective…"
            className="w-64 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
            {(["all", "open", "won", "lost"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  statusFilter === s ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {filtered.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <p className="text-sm font-medium text-neutral-700">
              {opportunities.length === 0 ? "No opportunities yet." : "No opportunities match this filter."}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Create one to start the prepare-deliver-learn loop.</p>
            <button
              type="button"
              onClick={onNewOpportunity}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + New opportunity
            </button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} onOpen={() => onOpen(o.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
