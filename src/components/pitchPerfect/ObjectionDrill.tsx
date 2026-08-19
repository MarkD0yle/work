import { useState } from "react";
import {
  completeSession,
  messageGapsFromNarrative,
  objectionsForOpportunity,
  recordAttempt,
  scoreObjectionResponse,
  startRehearsalSession,
} from "../../lib/pitchPerfect/rehearsal";
import type { Opportunity, RehearsalSession, ReviewBand, ReviewCheck } from "../../lib/pitchPerfect/types";
import { GapChecklist } from "./GapChecklist";

const BAND_STYLE: Record<ReviewBand, string> = {
  Strong: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Solid: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "Needs work": "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const SESSION_LENGTH = 5;

export function ObjectionDrill({
  opportunity,
  onFinish,
  onCancel,
}: {
  opportunity: Opportunity;
  onFinish: (session: RehearsalSession) => void;
  onCancel: () => void;
}) {
  const [objections] = useState(() => objectionsForOpportunity(opportunity).slice(0, SESSION_LENGTH));
  const [session, setSession] = useState<RehearsalSession>(() => startRehearsalSession());
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [result, setResult] = useState<{ score: 1 | 3 | 5; band: ReviewBand; checks: ReviewCheck[] } | null>(null);

  const current = objections[index];
  const isLast = index === objections.length - 1;

  function submit() {
    setResult(scoreObjectionResponse(current, response));
  }

  function next() {
    if (!result) return;
    const updated = recordAttempt(session, { objectionId: current.id, response, ...result });
    setSession(updated);
    setResponse("");
    setResult(null);
    if (isLast) {
      onFinish(completeSession(updated, messageGapsFromNarrative(opportunity.narrative)));
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Objection {index + 1} of {objections.length} · {current.category}
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-700">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-sm font-medium text-neutral-900">"{current.prompt}"</p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Your response…"
        disabled={Boolean(result)}
        className="mt-3 block min-h-[120px] w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none disabled:bg-neutral-50"
      />

      {result && (
        <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${BAND_STYLE[result.band]}`}>
            {result.band} · {result.score}/5
          </span>
          <div className="mt-2.5">
            <GapChecklist items={result.checks} />
          </div>
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        {!result ? (
          <button
            type="button"
            onClick={submit}
            disabled={!response.trim()}
            className="rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Score my response
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {isLast ? "Finish session" : "Next objection"}
          </button>
        )}
      </div>
    </div>
  );
}
