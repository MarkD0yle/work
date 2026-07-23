import { useState } from "react";
import { objectionsForOpportunity } from "../../../lib/pitchPerfect/rehearsal";
import type { Opportunity, RehearsalSession, ReviewBand } from "../../../lib/pitchPerfect/types";
import { ObjectionDrill } from "../ObjectionDrill";

const BAND_STYLE: Record<ReviewBand, string> = {
  Strong: "bg-emerald-50 text-emerald-700",
  Solid: "bg-amber-50 text-amber-700",
  "Needs work": "bg-rose-50 text-rose-700",
};

function averageScore(session: RehearsalSession): number {
  if (session.attempts.length === 0) return 0;
  return session.attempts.reduce((sum, a) => sum + a.score, 0) / session.attempts.length;
}

export function RehearseTab({
  opportunity,
  onSaveRehearsal,
}: {
  opportunity: Opportunity;
  onSaveRehearsal: (sessions: RehearsalSession[]) => void;
}) {
  const [drilling, setDrilling] = useState(false);
  const objections = objectionsForOpportunity(opportunity);

  function finishSession(session: RehearsalSession) {
    onSaveRehearsal([session, ...opportunity.rehearsal]);
    setDrilling(false);
  }

  if (drilling) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ObjectionDrill opportunity={opportunity} onFinish={finishSession} onCancel={() => setDrilling(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Rehearse</div>
          <p className="mt-0.5 text-xs text-neutral-500">
            Practice responses to {objections.length} likely objections and competitive questions, with scored coaching feedback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrilling(true)}
          className="shrink-0 rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Start rehearsal
        </button>
      </div>

      <div>
        <div className="text-[11px] font-medium text-neutral-500">Session history</div>
        {opportunity.rehearsal.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-400 italic">No rehearsal sessions yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {opportunity.rehearsal.map((session) => (
              <div key={session.id} className="rounded-lg border border-neutral-200 bg-white p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-neutral-500">{new Date(session.startedAt).toLocaleString()}</span>
                  <span className="text-xs font-medium text-neutral-700">
                    {session.attempts.length} objection{session.attempts.length === 1 ? "" : "s"} · avg {averageScore(session).toFixed(1)}/5
                  </span>
                </div>
                {session.attempts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {session.attempts.map((a, i) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BAND_STYLE[a.band]}`}>
                        {a.band}
                      </span>
                    ))}
                  </div>
                )}
                {session.messageGaps.length > 0 && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                    Message gaps: {session.messageGaps.join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
