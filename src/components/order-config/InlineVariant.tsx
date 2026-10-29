import { useState } from "react";
import AccordionCard from "./AccordionCard";
import AddMenu from "./AddMenu";
import RecordsTable from "./RecordsTable";
import { SECTION_BODIES } from "./sectionBodies";
import {
  GROUPS,
  SECTION_META,
  sectionsWithErrors,
  type Errors,
  type OrderConfig,
  type SectionId,
} from "./model";
import { primaryBtn, secondaryBtn, useRecordEditor } from "./useRecordEditor";
import { useGroupRecords } from "./useGroupRecords";

/* B — inline editor row. Choosing a label inserts a draft row at the top of
 * the table that expands in place. The three sections are collapsible
 * sub-sections (Basic info open first); a failed save opens any section
 * holding an error. Save collapses the row and flashes it green. */
function InlineEditor({
  record,
  errors,
  onChange,
  onSave,
  onCancel,
}: {
  record: OrderConfig;
  errors: Errors;
  onChange: (p: Partial<OrderConfig>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState<Set<SectionId>>(new Set(["basic"]));
  const bad = sectionsWithErrors(errors);

  function toggle(id: SectionId) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2 p-4">
      {SECTION_META.map((s) => {
        const Body = SECTION_BODIES[s.id];
        const isOpen = open.has(s.id) || bad.has(s.id);
        return (
          <section key={s.id} className="rounded-md border border-neutral-200 bg-white">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(s.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-inset"
            >
              <span className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
                {s.title}
              </span>
              {bad.has(s.id) && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  Needs attention
                </span>
              )}
              <span aria-hidden className="ml-auto text-xs text-neutral-400">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-neutral-100 px-3 py-3">
                <Body value={record} errors={errors} onChange={onChange} />
              </div>
            )}
          </section>
        );
      })}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={secondaryBtn}>
          Cancel
        </button>
        <button type="button" onClick={onSave} className={primaryBtn}>
          Save
        </button>
      </div>
    </div>
  );
}

export default function InlineVariant() {
  const { records, upsert } = useGroupRecords();
  const ed = useRecordEditor(upsert);
  const editing = ed.editing;

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      {GROUPS.map((g, i) => {
        const here = editing?.groupId === g.id ? editing : null;
        // New records show as a draft row on top; edits expand in place.
        const rows = here?.isNew ? [here.record, ...records[g.id]] : records[g.id];
        return (
          <AccordionCard
            key={g.id}
            title={g.title}
            count={records[g.id].length}
            defaultOpen={i === 0}
          >
            <RecordsTable
              caption={`${g.title} order configs`}
              records={rows}
              draftId={here?.isNew ? here.record.id : null}
              flashId={ed.flashId}
              onEdit={(r) => {
                if (r.id !== here?.record.id) ed.startEdit(g.id, r);
              }}
              renderExpanded={(r) =>
                here && r.id === here.record.id ? (
                  <InlineEditor
                    record={here.record}
                    errors={ed.errors}
                    onChange={ed.patch}
                    onSave={ed.save}
                    onCancel={ed.cancel}
                  />
                ) : null
              }
            />
            <div className="mt-3">
              <AddMenu onPick={(label) => ed.startNew(g.id, label)} />
            </div>
          </AccordionCard>
        );
      })}
    </div>
  );
}
