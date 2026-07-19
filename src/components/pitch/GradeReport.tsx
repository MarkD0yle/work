import type { GradeBand, PitchGrade } from "../../lib/pitch/types";

const BAND_STYLE: Record<GradeBand, string> = {
  High: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Mid: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Low: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  "N/A": "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
};

/* Renders a PitchGrade the same way rubric/gates.md + composition-rubric.md
 * are meant to be read: gates first (a fail stops the run, no grade), then
 * dimensions with STRUCTURE always graded and GOAL only graded when an
 * objective was actually stated. Score is secondary — the log is the point. */
export function GradeReport({ grade }: { grade: PitchGrade }) {
  if (!grade.gatesPassed) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <div className="text-[10px] font-semibold tracking-widest text-rose-500 uppercase">
          Gates — FAIL
        </div>
        <p className="mt-1.5 text-sm text-rose-800">
          A gate failure stops the run. No grade happens on a pitch that isn't fit to send —
          fix these first, then re-grade.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-rose-900">
          {grade.gateFailures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Gates — PASS · Grade
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">Graded {new Date(grade.gradedAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-neutral-900">
            {grade.overallScore ?? "—"}
            <span className="text-sm font-normal text-neutral-400"> / 5</span>
          </div>
          <div className="text-[11px] text-neutral-400">overall</div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              <th className="px-5 py-2 font-semibold">Dimension</th>
              <th className="px-3 py-2 font-semibold">Tag</th>
              <th className="px-3 py-2 font-semibold">Checks</th>
              <th className="px-3 py-2 font-semibold">Band</th>
              <th className="px-5 py-2 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {grade.dimensions.map((d) => (
              <tr key={d.key}>
                <td className="px-5 py-2.5 font-medium text-neutral-800">{d.label}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                    {d.tag}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-neutral-500 tabular-nums">
                  {d.band === "N/A" ? "skipped" : `${d.checks.filter((c) => c.pass).length} / ${d.checks.length}`}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BAND_STYLE[d.band]}`}>
                    {d.band}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums text-neutral-800">
                  {d.score ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grade.log.length > 0 && (
        <div className="border-t border-neutral-100 px-5 py-4">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            What dropped the score
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-600">
            {grade.log.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
