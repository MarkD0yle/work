import { useOpportunities } from "../../hooks/useOpportunities";
import { computeInsights } from "../../lib/pitchPerfect/insights";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

/* Fully read-only — no edit affordance anywhere. This view is entirely
 * derived from the saved opportunities; there's nothing here to author. */
export function InsightsView({ onBack }: { onBack: () => void }) {
  const opportunities = useOpportunities();
  const insights = computeInsights(opportunities);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <button type="button" onClick={onBack} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
          ← Back
        </button>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">Insights</h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          Organizational learning across every opportunity — derived from outcomes and rehearsal data, nothing here is authored.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Opportunities" value={String(insights.totalOpportunities)} />
            <StatTile
              label="Win rate"
              value={insights.winRate !== null ? `${Math.round(insights.winRate * 100)}%` : "—"}
              sub={`${insights.wonCount} won · ${insights.lostCount} lost`}
            />
            <StatTile label="Decided" value={String(insights.wonCount + insights.lostCount)} sub="won + lost" />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Top objections encountered in rehearsal</div>
            {insights.topObjections.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400 italic">No rehearsal data yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {insights.topObjections.map((o) => (
                  <li key={o.objectionId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-800">"{o.prompt}"</span>
                    <span className="shrink-0 text-xs font-medium text-neutral-500">{o.timesEncountered}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Knowledge items used most, and win rate when attached
            </div>
            {insights.knowledgeItemWinCorrelation.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400 italic">No knowledge attached yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                      <th className="py-2 pr-3 font-semibold">Knowledge item</th>
                      <th className="py-2 pr-3 font-semibold">Attached</th>
                      <th className="py-2 text-right font-semibold">Win rate when attached</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {insights.knowledgeItemWinCorrelation.map((k) => (
                      <tr key={k.itemId}>
                        <td className="py-2.5 pr-3 text-neutral-800">{k.title}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-neutral-600">{k.attachedCount}</td>
                        <td className="py-2.5 text-right tabular-nums text-neutral-800">
                          {k.winRateWhenAttached !== null ? `${Math.round(k.winRateWhenAttached * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Common intelligence gap patterns</div>
            {insights.commonGapPatterns.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400 italic">No gaps recorded — every opportunity is fully scoped.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm text-neutral-800">
                {insights.commonGapPatterns.map((g) => (
                  <li key={g.checkLabel} className="flex items-center justify-between gap-3">
                    <span>{g.checkLabel}</span>
                    <span className="shrink-0 text-xs font-medium text-neutral-500">
                      {g.failCount} opportunit{g.failCount === 1 ? "y" : "ies"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
