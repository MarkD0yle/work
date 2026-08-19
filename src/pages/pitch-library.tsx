import { useMemo, useState } from "react";
import { usePitchLibrary } from "../hooks/usePitchLibrary";
import { pitchLibraryRepo } from "../lib/pitch/repo";
import { LibraryCard } from "../components/pitch/LibraryCard";
import { ReportView } from "../components/pitch/ReportView";
import { GradeReport } from "../components/pitch/GradeReport";
import { navigateToPage } from "../lib/navigation";

export const title = "Pitch Library";
export const fullWidth = true;

/* Pitch Library — every pitch saved from the Pitch Builder, browsable as a
 * card grid. Opening a card shows the compiled report and its grade
 * read-only; nothing here is editable (go back to the Builder for that). */

type StatusFilter = "all" | "draft" | "final";

export default function PitchLibraryPage() {
  const pitches = usePitchLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pitches.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.data.client.name.toLowerCase().includes(q) ||
        p.objective.toLowerCase().includes(q)
      );
    });
  }, [pitches, statusFilter, query]);

  const selected = pitches.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return (
      <div className="flex h-full flex-col bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Pitch Library
              </div>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
                {selected.data.client.name}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Back to library
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <ReportView pitch={selected} />
            <div className="space-y-4">
              {selected.grade ? (
                <GradeReport grade={selected.grade} />
              ) : (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                  This pitch was saved without being graded.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Sales & Pitch
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">Pitch Library</h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Every pitch built and saved from the Pitch Builder, with its grade.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToPage("pitch-perfect")}
              className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Try Pitch Perfect
            </button>
            <button
              type="button"
              onClick={() => navigateToPage("pitch-builder")}
              className="rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + New pitch
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client or objective…"
            className="w-64 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
            {(["all", "draft", "final"] as const).map((s) => (
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
              {pitches.length === 0 ? "No pitches saved yet." : "No pitches match this filter."}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Build one in the Pitch Builder — it'll show up here once saved.
            </p>
            <button
              type="button"
              onClick={() => navigateToPage("pitch-builder")}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Go to Pitch Builder
            </button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <LibraryCard
                key={p.id}
                pitch={p}
                onOpen={() => setSelectedId(p.id)}
                onDelete={() => pitchLibraryRepo.remove(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
