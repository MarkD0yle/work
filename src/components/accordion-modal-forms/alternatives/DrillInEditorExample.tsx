import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, btnSecondary } from "../styles";
import { DrillForm } from "./DrillForm";
import { DialogFrame, FundAccordion, ParentFooter, SectionIntro } from "./FundSetupFrame";
import { AddMenu, ShareClassTable } from "./ShareClassTable";
import { SECTIONS, SEED_ROW, canSave, newShareClass, type ShareClass } from "./share-class";

/* Alternative F — Drill-in view ("push, don't stack").
 *
 * Picking a label pushes a new view into the SAME dialog: the accordion
 * slides out, a full-width editor slides in, and the dialog's header turns
 * into a breadcrumb that leads back. The editor is a three-step wizard with
 * a rail on the left (jump between sections, see which are complete) and a
 * running summary of what the table row will say. Saving pops back to the
 * accordion and flashes the new row. The accordion stays mounted while
 * hidden so nothing typed in the other sections is lost. */

type View = { kind: "list" } | { kind: "form"; draft: ShareClass; isNew: boolean; step: number };

export default function DrillInEditorExample() {
  const [rows, setRows] = useState<ShareClass[]>([SEED_ROW]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [justSaved, setJustSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(null), 1800);
    return () => clearTimeout(t);
  }, [justSaved]);

  const added = new Set(rows.map((r) => r.label));
  const inForm = view.kind === "form";

  function back() {
    setView({ kind: "list" });
  }

  function setValue(key: string, value: string) {
    setView((v) => (v.kind === "form" ? { ...v, draft: { ...v.draft, values: { ...v.draft.values, [key]: value } } } : v));
  }

  function goto(step: number) {
    setView((v) => (v.kind === "form" ? { ...v, step: Math.max(0, Math.min(SECTIONS.length - 1, step)) } : v));
  }

  function save() {
    if (view.kind !== "form" || !canSave(view.draft)) return;
    const d = view.draft;
    setRows((prev) => (view.isNew ? [...prev, d] : prev.map((r) => (r.id === d.id ? d : r))));
    setJustSaved(d.id);
    setView({ kind: "list" });
  }

  const section = inForm ? SECTIONS[view.step] : undefined;
  const lastStep = inForm && view.step === SECTIONS.length - 1;

  return (
    <DialogFrame
      title={inForm ? view.draft.label : "Fund set-up"}
      description={
        inForm && section
          ? `${view.isNew ? "New share class" : "Editing share class"} · step ${view.step + 1} of ${SECTIONS.length} · ${section.label}`
          : "New sub-fund · Halden Global Credit Fund"
      }
      crumbs={
        inForm
          ? [{ label: "Fund set-up", onClick: back }, { label: "Share classes", onClick: back }, { label: view.draft.label }]
          : undefined
      }
      footer={
        inForm ? (
          <>
            <button type="button" onClick={back} className={`${btnGhost} mr-auto`}>
              ← Back to share classes
            </button>
            {!canSave(view.draft) && (
              <span className="text-xs text-neutral-500">Basic info is required to save</span>
            )}
            <button type="button" onClick={() => goto(view.step - 1)} disabled={view.step === 0} className={btnSecondary}>
              Back
            </button>
            {lastStep ? (
              <button type="button" onClick={save} disabled={!canSave(view.draft)} className={btnPrimary}>
                {view.isNew ? "Add to table" : "Save share class"}
              </button>
            ) : (
              <button type="button" onClick={() => goto(view.step + 1)} className={btnPrimary}>
                Next · {SECTIONS[view.step + 1]?.label}
              </button>
            )}
          </>
        ) : (
          <ParentFooter shareClasses={rows} />
        )
      }
    >
      <FundAccordion shareClasses={rows} hidden={inForm}>
        <SectionIntro>
          Each class opens as its own view inside this dialog — the list slides away, the breadcrumb brings you back,
          and the saved row is highlighted on return.
        </SectionIntro>
        <ShareClassTable
          rows={rows}
          highlightId={justSaved}
          onEdit={(r) => setView({ kind: "form", draft: structuredClone(r), isNew: false, step: 0 })}
          onRemove={(r) => setRows((prev) => prev.filter((x) => x.id !== r.id))}
        />
        <div className="mt-3">
          <AddMenu added={added} onPick={(label) => setView({ kind: "form", draft: newShareClass(label), isNew: true, step: 0 })} />
        </div>
      </FundAccordion>

      {inForm && (
        <DrillForm key={view.draft.id} draft={view.draft} step={view.step} onStep={goto} onChange={setValue} />
      )}
    </DialogFrame>
  );
}
