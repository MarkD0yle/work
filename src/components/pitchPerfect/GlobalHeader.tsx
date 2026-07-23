import { CLIENTS } from "../../lib/pitch/data";
import type { Opportunity } from "../../lib/pitchPerfect/types";

/* Persistent entry point for the whole container — always visible above
 * every screen (browse / dashboard / any tab / insights). This is the first
 * thing a user does, so it gets real visual weight: a distinct hero panel
 * with step labels and large controls, not just another thin utility bar. */
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
  const hasClient = Boolean(clientId);

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-6 py-2">
        <button
          type="button"
          onClick={onBrowseAll}
          className="text-sm font-semibold tracking-tight text-neutral-900 hover:text-neutral-700"
        >
          Pitch Perfect
        </button>
        <button
          type="button"
          onClick={onInsights}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Insights
        </button>
      </div>

      <div className="px-6 py-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">Step 1 · Client</label>
            <select
              value={clientId ?? ""}
              onChange={(e) => onSelectClient(e.target.value || null)}
              className="mt-1.5 block w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-base font-medium text-neutral-900 transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
            >
              <option value="">Select a client…</option>
              {CLIENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[260px] flex-1">
            <label className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">Step 2 · Opportunity</label>
            <select
              value={opportunityId ?? ""}
              onChange={(e) => onSelectOpportunity(e.target.value)}
              disabled={!hasClient}
              className="mt-1.5 block w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-base font-medium text-neutral-900 transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              <option value="">{hasClient ? "Select an opportunity…" : "Select a client first"}</option>
              {clientOpportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.pitchType}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onNewOpportunity}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + New opportunity
          </button>
        </div>

        {!hasClient && (
          <p className="mt-3 text-sm text-neutral-500">
            Start here — choose the client you're pitching to, then the specific opportunity, to begin preparing.
          </p>
        )}
      </div>
    </header>
  );
}
