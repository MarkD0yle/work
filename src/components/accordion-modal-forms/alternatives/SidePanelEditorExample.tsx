import { useState } from "react";
import ContextPanel, { PanelSection } from "../../patterns/ContextPanel";
import { btnPrimary, btnSecondary } from "../styles";
import { DialogFrame, FundAccordion, ParentFooter, SectionIntro } from "./FundSetupFrame";
import { FieldTally, SectionFields, StatusMark } from "./ShareClassFields";
import { AddMenu, ShareClassTable } from "./ShareClassTable";
import {
  CLASS_LABELS,
  SECTIONS,
  SEED_ROW,
  canSave,
  completeCount,
  newShareClass,
  sectionComplete,
  type ShareClass,
} from "./share-class";

/* Alternative E — Docked side panel (the existing ContextPanel pattern).
 *
 * Picking a label opens the editor in a panel docked to the right of the
 * accordion, inside the parent dialog. The table stays visible and tints the
 * row being edited (a new class appears as a live draft row), so the user
 * can line the new class up against the ones already saved. Because ten
 * classes is a run of similar records, the panel offers "Save & add next"
 * to move straight on to the next unadded label. The table drops its
 * secondary columns while the panel has the width. */

type Editing = { draft: ShareClass; isNew: boolean };

export default function SidePanelEditorExample() {
  const [rows, setRows] = useState<ShareClass[]>([SEED_ROW]);
  const [editing, setEditing] = useState<Editing | null>(null);

  const added = new Set(rows.map((r) => r.label));
  const display = !editing
    ? rows
    : editing.isNew
      ? [...rows, editing.draft]
      : rows.map((r) => (r.id === editing.draft.id ? editing.draft : r));

  const nextLabel = CLASS_LABELS.find((l) => !added.has(l.label) && l.label !== editing?.draft.label)?.label;

  function setValue(key: string, value: string) {
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, values: { ...e.draft.values, [key]: value } } } : e));
  }

  function commit(): boolean {
    if (!editing || !canSave(editing.draft)) return false;
    const d = editing.draft;
    setRows((prev) => (editing.isNew ? [...prev, d] : prev.map((r) => (r.id === d.id ? d : r))));
    return true;
  }

  function save() {
    if (commit()) setEditing(null);
  }

  function saveAndNext() {
    if (commit()) setEditing(nextLabel ? { draft: newShareClass(nextLabel), isNew: true } : null);
  }

  const panel = editing && (
    <ContextPanel
      key={editing.draft.id}
      title={editing.draft.label}
      eyebrow={editing.isNew ? "New share class" : "Editing share class"}
      onClose={() => setEditing(null)}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-neutral-500 tabular-nums">
            {completeCount(editing.draft)}/3 sections
          </span>
          <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>
            Cancel
          </button>
          {editing.isNew && nextLabel && (
            <button type="button" onClick={saveAndNext} disabled={!canSave(editing.draft)} className={btnSecondary}>
              Save &amp; add next
            </button>
          )}
          <button type="button" onClick={save} disabled={!canSave(editing.draft)} className={btnPrimary}>
            {editing.isNew ? "Add to table" : "Save"}
          </button>
        </div>
      }
    >
      {SECTIONS.map((s, i) => (
        <PanelSection
          key={s.id}
          title={s.label}
          trailing={
            <span className="inline-flex items-center gap-3">
              <FieldTally section={s.id} />
              <StatusMark complete={sectionComplete(editing.draft, s.id)} />
            </span>
          }
          last={i === SECTIONS.length - 1}
        >
          <SectionFields section={s.id} value={editing.draft} onChange={setValue} idPrefix={`sp-${s.id}`} columns={1} />
        </PanelSection>
      ))}
    </ContextPanel>
  );

  return (
    <DialogFrame
      title="Fund set-up"
      description="New sub-fund · Halden Global Credit Fund"
      footer={<ParentFooter shareClasses={rows} />}
      aside={panel}
      bodyStyle={{ height: 640 }}
    >
      <FundAccordion shareClasses={rows}>
        <SectionIntro>
          Each class is edited in the panel on the right. The table stays in view and highlights the row you are
          working on; switch rows with Edit at any time.
        </SectionIntro>
        <ShareClassTable
          rows={display}
          editingId={editing?.draft.id}
          compact={editing !== null}
          onEdit={(r) => setEditing({ draft: structuredClone(r), isNew: false })}
          onRemove={(r) => {
            setRows((prev) => prev.filter((x) => x.id !== r.id));
            if (editing?.draft.id === r.id) setEditing(null);
          }}
        />
        <div className="mt-3">
          <AddMenu added={added} onPick={(label) => setEditing({ draft: newShareClass(label), isNew: true })} />
        </div>
      </FundAccordion>
    </DialogFrame>
  );
}
