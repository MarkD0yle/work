import ContextPanel, { PanelSection } from "../patterns/ContextPanel";
import AccordionCard from "./AccordionCard";
import AddMenu from "./AddMenu";
import RecordsTable from "./RecordsTable";
import { SECTION_BODIES } from "./sectionBodies";
import { GROUPS, SECTION_META } from "./model";
import { primaryBtn, secondaryBtn, useRecordEditor } from "./useRecordEditor";
import { useGroupRecords } from "./useGroupRecords";

/* A — docked side panel. The accordion list stays on screen; the form opens
 * in the existing ContextPanel to its right. No overlay, no focus trap, and
 * the table row you're editing stays highlighted. Save/Cancel use the
 * panel's sticky action bar. */
export default function PanelVariant() {
  const { records, upsert } = useGroupRecords();
  const ed = useRecordEditor(upsert);
  const editing = ed.editing;

  return (
    <div className="flex h-[640px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="min-w-0 flex-1 space-y-2 overflow-y-auto p-4">
        {GROUPS.map((g, i) => (
          <AccordionCard
            key={g.id}
            title={g.title}
            count={records[g.id].length}
            defaultOpen={i === 0}
          >
            <RecordsTable
              caption={`${g.title} order configs`}
              records={records[g.id]}
              activeId={editing?.groupId === g.id ? editing.record.id : null}
              flashId={ed.flashId}
              onEdit={(r) => ed.startEdit(g.id, r)}
            />
            <div className="mt-3">
              <AddMenu onPick={(label) => ed.startNew(g.id, label)} />
            </div>
          </AccordionCard>
        ))}
      </div>

      {editing && (
        <div className="w-[420px] max-w-[60%] shrink-0">
          <ContextPanel
            eyebrow={GROUPS.find((g) => g.id === editing.groupId)?.title}
            title={`${editing.isNew ? "New" : "Edit"} · ${editing.record.label}`}
            onClose={ed.cancel}
            actions={
              <div className="flex gap-2">
                <button type="button" onClick={ed.save} className={primaryBtn}>
                  Save
                </button>
                <button type="button" onClick={ed.cancel} className={secondaryBtn}>
                  Cancel
                </button>
              </div>
            }
          >
            {SECTION_META.map((s, i) => {
              const Body = SECTION_BODIES[s.id];
              return (
                <PanelSection
                  key={s.id}
                  title={s.title}
                  last={i === SECTION_META.length - 1}
                >
                  <Body value={editing.record} errors={ed.errors} onChange={ed.patch} />
                </PanelSection>
              );
            })}
          </ContextPanel>
        </div>
      )}
    </div>
  );
}
