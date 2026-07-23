import { useMemo, useState } from "react";
import { ClientPicker } from "../components/pitch/ClientPicker";
import { SectionRail } from "../components/pitch/SectionRail";
import { SectionEditor } from "../components/pitch/SectionEditor";
import { ReviewPanel } from "../components/pitch/ReviewPanel";
import { ReportView } from "../components/pitch/ReportView";
import { GradeReport } from "../components/pitch/GradeReport";
import { gatherInternalData } from "../lib/pitch/data";
import { SECTION_DEFS, autoDraft, sourceHighlights } from "../lib/pitch/sections";
import { reviewSection, improveSection as computeImprovedContent } from "../lib/pitch/review";
import { gradePitch } from "../lib/pitch/grading";
import { pitchLibraryRepo } from "../lib/pitch/repo";
import { navigateToPage } from "../lib/navigation";
import type { Pitch, PitchSection, SectionId } from "../lib/pitch/types";

export const title = "Pitch Builder";
export const fullWidth = true;

/* Pitch Builder — the full sales-pitch workflow in one page:
 *   1. Pick a client + state the ask → internal data is "gathered" (mocked
 *      CRM/PMS/research) and auto-drafts every section.
 *   2. Work section by section. Each section runs through a rule-based "AI
 *      reviewer" (see lib/pitch/review.ts) that scores it against a 3-check
 *      rubric and can auto-improve the draft to close the gaps.
 *   3. Compile into a report and grade the whole pitch (lib/pitch/grading.ts)
 *      — gates first, then dimensions, mirroring rubric/gates.md.
 *   4. Save to the library (localStorage), as a draft or final. */

type Stage = "pick" | "build" | "report";

function newPitchId(): string {
  return `pitch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildSections(data: Pitch["data"]): Pitch["sections"] {
  const out = {} as Pitch["sections"];
  for (const def of SECTION_DEFS) {
    const content = autoDraft(def.id, data);
    out[def.id] = { id: def.id, content, status: "drafted", review: null, aiPasses: 0 };
  }
  return out;
}

export default function PitchBuilderPage() {
  const [stage, setStage] = useState<Stage>("pick");
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [pendingObjective, setPendingObjective] = useState("");
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [activeId, setActiveId] = useState<SectionId>(SECTION_DEFS[0].id);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const activeIndex = SECTION_DEFS.findIndex((d) => d.id === activeId);

  function startPitch() {
    if (!pendingClientId) return;
    const data = gatherInternalData(pendingClientId);
    const sections = buildSections(data);
    const now = new Date().toISOString();
    const next: Pitch = {
      id: newPitchId(),
      clientId: pendingClientId,
      objective: pendingObjective.trim(),
      data,
      sections,
      status: "draft",
      grade: null,
      createdAt: now,
      updatedAt: now,
    };
    setPitch(next);
    setActiveId(SECTION_DEFS[0].id);
    setStage("build");
  }

  function updateSection(id: SectionId, patch: Partial<PitchSection>) {
    setPitch((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        sections: { ...prev.sections, [id]: { ...prev.sections[id], ...patch } },
      };
    });
  }

  function onEditContent(id: SectionId, content: string) {
    updateSection(id, {
      content,
      status: content.trim() ? "drafted" : "empty",
      review: null,
    });
  }

  function onRunReview(id: SectionId) {
    if (!pitch) return;
    const section = pitch.sections[id];
    const review = reviewSection(id, section.content, pitch.data, pitch.objective);
    updateSection(id, { review, status: "reviewed" });
  }

  function onImprove(id: SectionId) {
    if (!pitch) return;
    const section = pitch.sections[id];
    if (!section.review) return;
    const improved = computeImprovedContent(id, section.content, pitch.data, pitch.objective, section.review);
    const review = reviewSection(id, improved, pitch.data, pitch.objective);
    updateSection(id, { content: improved, review, status: "reviewed", aiPasses: section.aiPasses + 1 });
  }

  function onApprove(id: SectionId) {
    updateSection(id, { status: "approved" });
  }

  function compileReport() {
    if (!pitch) return;
    const grade = gradePitch(pitch);
    setPitch((prev) => (prev ? { ...prev, grade } : prev));
    setStage("report");
  }

  function saveToLibrary(asFinal: boolean) {
    if (!pitch) return;
    const grade = pitch.grade ?? gradePitch(pitch);
    const toSave: Pitch = { ...pitch, grade, status: asFinal ? "final" : "draft", updatedAt: new Date().toISOString() };
    pitchLibraryRepo.save(toSave);
    setPitch(toSave);
    setSavedMsg(asFinal ? "Saved to library as final." : "Draft saved to library.");
    setTimeout(() => setSavedMsg(null), 3000);
  }

  function resetAll() {
    setPitch(null);
    setPendingClientId(null);
    setPendingObjective("");
    setStage("pick");
    setActiveId(SECTION_DEFS[0].id);
  }

  const sectionsDone = useMemo(() => {
    if (!pitch) return 0;
    return SECTION_DEFS.filter((d) => pitch.sections[d.id].status !== "empty").length;
  }, [pitch]);

  if (stage === "pick") {
    return (
      <div className="flex h-full flex-col bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white px-6 py-4">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Sales & Pitch
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">Pitch Builder</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Pick a client to pull their CRM, portfolio and market data, then build the pitch section by section.
          </p>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-neutral-900">1. Client</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Selecting a client gathers their profile, portfolio snapshot, matched products and
                open compliance flags — no manual lookup needed.
              </p>
              <div className="mt-3">
                <ClientPicker selectedId={pendingClientId} onSelect={setPendingClientId} />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-neutral-900">2. Primary ask (optional)</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                State the objective for this specific pitch — e.g. "Upsell into the Discretionary
                Growth Mandate." When set, the final grade also checks goal alignment.
              </p>
              <textarea
                value={pendingObjective}
                onChange={(e) => setPendingObjective(e.target.value)}
                placeholder="What is this pitch trying to achieve?"
                className="mt-3 block w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
                rows={3}
              />
            </section>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startPitch}
                disabled={!pendingClientId}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Gather data &amp; start pitch
              </button>
              <button
                type="button"
                onClick={() => navigateToPage("pitch-library")}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                View pitch library
              </button>
              <button
                type="button"
                onClick={() => navigateToPage("pitch-perfect")}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Try Pitch Perfect (full opportunity workflow)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pitch) return null;

  if (stage === "report") {
    const grade = pitch.grade ?? gradePitch(pitch);
    return (
      <div className="flex h-full flex-col bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Sales & Pitch · Report
              </div>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
                {pitch.data.client.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStage("build")}
                className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={() => saveToLibrary(false)}
                className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => saveToLibrary(true)}
                className="rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save as final
              </button>
            </div>
          </div>
          {savedMsg && <p className="mt-2 text-xs font-medium text-emerald-600">{savedMsg}</p>}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <ReportView pitch={pitch} />
            <div className="space-y-4">
              <GradeReport grade={grade} />
              <button
                type="button"
                onClick={resetAll}
                className="w-full rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Start another pitch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // stage === "build"
  const activeDef = SECTION_DEFS[activeIndex];
  const activeSection = pitch.sections[activeId];
  const isLast = activeIndex === SECTION_DEFS.length - 1;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Sales & Pitch · Building
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              {pitch.data.client.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              {sectionsDone}/{SECTION_DEFS.length} sections drafted
            </span>
            <button
              type="button"
              onClick={() => saveToLibrary(false)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Save draft
            </button>
          </div>
        </div>
        {savedMsg && <p className="mt-2 text-xs font-medium text-emerald-600">{savedMsg}</p>}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <SectionRail defs={SECTION_DEFS} sections={pitch.sections} activeId={activeId} onSelect={setActiveId} />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <SectionEditor
                def={activeDef}
                content={activeSection.content}
                onChange={(v) => onEditContent(activeId, v)}
                facts={sourceHighlights(activeId, pitch.data)}
              />
            </section>

            <ReviewPanel
              review={activeSection.review}
              status={activeSection.status}
              aiPasses={activeSection.aiPasses}
              hasContent={activeSection.content.trim().length > 0}
              onRunReview={() => onRunReview(activeId)}
              onImprove={() => onImprove(activeId)}
              onApprove={() => onApprove(activeId)}
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="text-xs text-neutral-500">
            Section {activeIndex + 1} of {SECTION_DEFS.length}
          </div>
          <div className="flex items-center gap-2">
            {activeIndex > 0 && (
              <button
                type="button"
                onClick={() => setActiveId(SECTION_DEFS[activeIndex - 1].id)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setActiveId(SECTION_DEFS[activeIndex + 1].id)}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Next section
              </button>
            ) : (
              <button
                type="button"
                onClick={compileReport}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Compile pitch report
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
