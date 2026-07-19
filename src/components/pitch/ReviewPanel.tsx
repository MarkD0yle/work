import type { SectionReview, SectionStatus } from "../../lib/pitch/types";

const BAND_STYLE: Record<string, string> = {
  Strong: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Solid: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "Needs work": "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const MAX_AI_PASSES = 3;

function CheckIcon({ pass }: { pass: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        pass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      }`}
      aria-hidden
    >
      {pass ? "✓" : "!"}
    </span>
  );
}

export function ReviewPanel({
  review,
  status,
  aiPasses,
  hasContent,
  onRunReview,
  onImprove,
  onApprove,
}: {
  review: SectionReview | null;
  status: SectionStatus;
  aiPasses: number;
  hasContent: boolean;
  onRunReview: () => void;
  onImprove: () => void;
  onApprove: () => void;
}) {
  const canImprove = review !== null && review.suggestions.length > 0 && aiPasses < MAX_AI_PASSES;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          AI review
        </div>
        {review && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BAND_STYLE[review.band]}`}>
            {review.band} · {review.score}/5
          </span>
        )}
      </div>

      {!review ? (
        <p className="mt-2.5 text-xs text-neutral-500">
          Not reviewed yet. Draft the section, then run the review to check it against this
          section's rubric — personalization, data-grounding, and one section-specific check.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {review.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              <CheckIcon pass={c.pass} />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-neutral-800">{c.label}</span>
                <span className="block text-[11px] text-neutral-500">{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {review && review.suggestions.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[10px] font-semibold tracking-widest text-amber-700 uppercase">
            What to fix
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-amber-900">
            {review.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRunReview}
          disabled={!hasContent}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {review ? "Re-run review" : "Run AI review"}
        </button>
        <button
          type="button"
          onClick={onImprove}
          disabled={!canImprove}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Improve with AI
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={!review || review.suggestions.length > 0}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "approved" ? "Approved ✓" : "Mark approved"}
        </button>
        {aiPasses > 0 && (
          <span className="ml-auto text-[11px] text-neutral-400">
            AI passes: {aiPasses}/{MAX_AI_PASSES}
          </span>
        )}
      </div>
    </section>
  );
}
