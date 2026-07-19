import { fmtMoney } from "../../lib/pitch/data";
import type { Pitch } from "../../lib/pitch/types";

const BAND_DOT: Record<string, string> = {
  High: "bg-emerald-500",
  Mid: "bg-amber-500",
  Low: "bg-rose-500",
};

export function LibraryCard({
  pitch,
  onOpen,
  onDelete,
}: {
  pitch: Pitch;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { client } = pitch.data;
  const grade = pitch.grade;

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col items-start gap-2 text-left"
      >
        <div className="flex w-full items-start justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-900">{client.name}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              pitch.status === "final" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {pitch.status === "final" ? "Final" : "Draft"}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-neutral-500">{pitch.objective || client.primaryGoal}</p>
      </button>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
        <span>
          AUM <span className="font-mono font-medium text-neutral-600">{fmtMoney(client.aum)}</span>
        </span>
        <span>{new Date(pitch.updatedAt).toLocaleDateString()}</span>
      </div>

      <div className="flex items-center justify-between">
        {grade ? (
          grade.gatesPassed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
              <span className={`h-2 w-2 rounded-full ${BAND_DOT[grade.dimensions[0]?.band] ?? "bg-neutral-300"}`} />
              Grade {grade.overallScore}/5
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Gates failed
            </span>
          )
        ) : (
          <span className="text-xs text-neutral-400">Not graded</span>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-neutral-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
