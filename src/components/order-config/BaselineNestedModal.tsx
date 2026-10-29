import { useState } from "react";
import Modal from "../patterns/Modal";
import { FormCard } from "../forms";
import AccordionCard from "./AccordionCard";
import AddMenu from "./AddMenu";
import RecordsTable from "./RecordsTable";
import { SECTION_BODIES } from "./sectionBodies";
import { GROUPS, SECTION_META } from "./model";
import { primaryBtn, secondaryBtn, useRecordEditor } from "./useRecordEditor";
import { useGroupRecords } from "./useGroupRecords";

/* Baseline — the pattern being replaced. Accordion list lives in a modal;
 * choosing a label opens a second modal on top. Kept faithful on purpose
 * (stacked backdrops, second focus trap) so the variants compare honestly.
 * The only concession: the outer modal ignores Esc while the inner one is
 * open, otherwise stock Modal closes both at once. */
export default function BaselineNestedModal() {
  const [outerOpen, setOuterOpen] = useState(false);
  const { records, upsert } = useGroupRecords();
  const ed = useRecordEditor(upsert);
  const innerOpen = ed.editing !== null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="mb-3 text-xs text-neutral-500">
        Open the settings modal, add a record, and watch the second modal stack on
        top. Table context is hidden behind the second backdrop.
      </p>
      <button type="button" onClick={() => setOuterOpen(true)} className={primaryBtn}>
        Open order settings
      </button>

      <Modal
        open={outerOpen}
        onClose={() => {
          if (!innerOpen) setOuterOpen(false);
        }}
        title="Order settings"
        description="Manage order configs for each group."
        size="xl"
      >
        <div className="space-y-2">
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
                flashId={ed.flashId}
                onEdit={(r) => ed.startEdit(g.id, r)}
              />
              <div className="mt-3">
                <AddMenu onPick={(label) => ed.startNew(g.id, label)} />
              </div>
            </AccordionCard>
          ))}
        </div>
      </Modal>

      <Modal
        open={innerOpen}
        onClose={ed.cancel}
        title={
          ed.editing
            ? `${ed.editing.isNew ? "New" : "Edit"} · ${ed.editing.record.label}`
            : "Order config"
        }
        size="lg"
        footer={
          <>
            <button type="button" onClick={ed.cancel} className={secondaryBtn}>
              Cancel
            </button>
            <button type="button" onClick={ed.save} className={primaryBtn}>
              Save
            </button>
          </>
        }
      >
        {ed.editing && (
          <div className="space-y-4">
            {SECTION_META.map((s) => {
              const Body = SECTION_BODIES[s.id];
              return (
                <FormCard key={s.id} title={s.title} description={s.description}>
                  <Body
                    value={ed.editing!.record}
                    errors={ed.errors}
                    onChange={ed.patch}
                  />
                </FormCard>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
