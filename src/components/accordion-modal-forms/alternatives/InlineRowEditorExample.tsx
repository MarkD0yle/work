import { useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary } from "../styles";
import { DialogFrame, FundAccordion, ParentFooter, SectionIntro } from "./FundSetupFrame";
import { SectionFields, SectionHeading } from "./ShareClassFields";
import { AddMenu, ShareClassTable } from "./ShareClassTable";
import { SECTIONS, SEED_ROW, canSave, completeCount, newShareClass, type ShareClass } from "./share-class";

/* Alternative D — Inline row editor.
 *
 * Picking a label appends a draft row to the table and expands an editor
 * directly beneath it, inside the same accordion section — three columns of
 * mostly radio groups, one per section. The row above the
 * editor is live: as you type, its cells update, so the user sees exactly
 * what will be left behind when they save. One row edits at a time; Add and
 * the other rows' actions lock until it is saved or cancelled. No overlay,
 * no change to the parent dialog. */

type Editing = { draft: ShareClass; isNew: boolean };

export default function InlineRowEditorExample() {
  const [rows, setRows] = useState<ShareClass[]>([SEED_ROW]);
  const [editing, setEditing] = useState<Editing | null>(null);

  const added = new Set(rows.map((r) => r.label));
  const display = !editing
    ? rows
    : editing.isNew
      ? [...rows, editing.draft]
      : rows.map((r) => (r.id === editing.draft.id ? editing.draft : r));

  function setValue(key: string, value: string) {
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, values: { ...e.draft.values, [key]: value } } } : e));
  }

  function save() {
    if (!editing || !canSave(editing.draft)) return;
    const d = editing.draft;
    setRows((prev) => (editing.isNew ? [...prev, d] : prev.map((r) => (r.id === d.id ? d : r))));
    setEditing(null);
  }

  return (
    <DialogFrame title="Fund set-up" description="New sub-fund · Halden Global Credit Fund" footer={<ParentFooter shareClasses={rows} />}>
      <FundAccordion shareClasses={rows}>
        <SectionIntro>
          Each class is edited in place: the editor opens as a row of this table and the row above it fills in as
          you go.
        </SectionIntro>
        <ShareClassTable
          rows={display}
          editingId={editing?.draft.id}
          lockWhileEditing
          onEdit={(r) => setEditing({ draft: structuredClone(r), isNew: false })}
          onRemove={(r) => setRows((prev) => prev.filter((x) => x.id !== r.id))}
          renderEditor={(row) => (
            <InlineEditor
              draft={row}
              isNew={editing?.isNew ?? false}
              onChange={setValue}
              onCancel={() => setEditing(null)}
              onSave={save}
            />
          )}
        />
        <div className="mt-3">
          <AddMenu
            added={added}
            onPick={(label) => setEditing({ draft: newShareClass(label), isNew: true })}
            disabled={editing !== null}
            disabledHint="Save or cancel the open row first"
          />
        </div>
      </FundAccordion>
    </DialogFrame>
  );
}

function InlineEditor({
  draft,
  isNew,
  onChange,
  onCancel,
  onSave,
}: {
  draft: ShareClass;
  isNew: boolean;
  onChange: (key: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const done = completeCount(draft);
  const saveable = canSave(draft);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${isNew ? "New" : "Edit"} ${draft.label}`}
      className="border-t-2 border-sky-500 bg-white px-4 pt-4 pb-3 animate-[drill-in_200ms_ease-out]"
    >
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <section key={s.id} aria-label={s.label}>
            <SectionHeading section={s.id} value={draft} />
            <div className="mt-3">
              <SectionFields section={s.id} value={draft} onChange={onChange} idPrefix={`inl-${s.id}`} columns={1} />
            </div>
          </section>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
        <span className="mr-auto text-xs text-neutral-500 tabular-nums">
          {done}/3 sections complete
          {!saveable && " · Basic info is required to save"}
        </span>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          {isNew ? "Discard" : "Cancel"}
        </button>
        <button type="button" onClick={onSave} disabled={!saveable} className={btnPrimary}>
          {isNew ? "Add to table" : "Save row"}
        </button>
      </div>
    </div>
  );
}
