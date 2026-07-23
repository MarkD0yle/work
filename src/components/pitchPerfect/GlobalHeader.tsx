import { CLIENTS } from "../../lib/pitch/data";
import type { Opportunity } from "../../lib/pitchPerfect/types";
import { controlClass } from "../forms";

/* Persistent entry point for the whole container — always visible above
 * every screen (browse / dashboard / any tab / insights), same pattern as
 * the reference: a client selector, then an opportunity ("deal / scope")
 * selector scoped to that client, so the pair is the primary way in rather
 * than requiring a card grid first. */
export function GlobalHeader({
  clientId,
  opportunityId,
  opportunities,
  onSelectClient,
  onSelectOpportunity,
  onNewOpportunity,
  onBrowseAll,
  onInsights,
}: {
  clientId: string | null;
  opportunityId: string | null;
  opportunities: Opportunity[];
  onSelectClient: (clientId: string | null) => void;
  onSelectOpportunity: (opportunityId: string) => void;
  onNewOpportunity: () => void;
  onBrowseAll: () => void;
  onInsights: () => void;
}) {
  const clientOpportunities = clientId ? opportunities.filter((o) => o.clientId === clientId) : [];

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3">
      <button
        type="button"
        onClick={onBrowseAll}
        className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900 hover:text-neutral-700"
      >
        Pitch Perfect
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <select
          value={clientId ?? ""}
          onChange={(e) => onSelectClient(e.target.value || null)}
          className={controlClass(false, "w-56 shrink-0")}
        >
          <option value="">Select client…</option>
          {CLIENTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={opportunityId ?? ""}
          onChange={(e) => onSelectOpportunity(e.target.value)}
          disabled={!clientId}
          className={controlClass(false, "w-64 shrink-0")}
        >
          <option value="">{clientId ? "Select opportunity…" : "Select a client first"}</option>
          {clientOpportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name || o.pitchType}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onNewOpportunity}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          + New opportunity
        </button>
      </div>

      <button
        type="button"
        onClick={onInsights}
        className="shrink-0 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Insights
      </button>
    </header>
  );
}
