import AccordionCard from "./AccordionCard";
import AddMenu from "./AddMenu";
import RecordsTable from "./RecordsTable";
import { SECTION_BODIES } from "./sectionBodies";
import { GROUPS, SECTION_META } from "./model";
import { primaryBtn, secondaryBtn, useRecordEditor } from "./useRecordEditor";
import { useGroupRecords } from "./useGroupRecords";
import { FormCard } from "../forms";

/* C — drill-in view. Choosing a label swaps that accordion's body from the
 * table to a full-width form: breadcrumb back to the table, anchor nav on
 * the left, sticky Save/Cancel at the bottom. One focus, no stacking, most
 * room for conditional fields — at the cost of hiding the table meanwhile. */
export default function DrillInVariant() {
  const { records, upsert } = useGroupRecords();
  const ed = useRecordEditor(upsert);
  const editing = ed.editing;

  function jump(id: string) {
    document.getElementById(`drill-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      {GROUPS.map((g, i) => {
        const here = editing?.groupId === g.id ? editing : null;
        return (
          <AccordionCard
            key={g.id}
            title={g.title}
            count={records[g.id].length}
            defaultOpen={i === 0}
          >
            {here ? (
              <div>
                <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={ed.cancel}
                    className="font-medium text-neutral-600 underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
                  >
                    ← {g.title}
                  </button>
                  <span aria-hidden className="text-neutral-300">
                    ›
                  </span>
                  <span className="text-neutral-600">{here.record.label}</span>
                  <span aria-hidden className="text-neutral-300">
                    ›
                  </span>
                  <span className="font-semibold text-neutral-900">
                    {here.isNew ? "New" : "Edit"}
                  </span>
                </nav>

                <div className="flex flex-col gap-4 md:flex-row">
                  <ul className="flex shrink-0 gap-1 md:sticky md:top-2 md:w-44 md:flex-col md:self-start">
                    {SECTION_META.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => jump(s.id)}
                          className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15"
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="min-w-0 flex-1 space-y-4">
                    {SECTION_META.map((s) => {
                      const Body = SECTION_BODIES[s.id];
                      return (
                        <div key={s.id} id={`drill-${s.id}`} className="scroll-mt-2">
                          <FormCard title={s.title} description={s.description}>
                            <Body
                              value={here.record}
                              errors={ed.errors}
                              onChange={ed.patch}
                            />
                          </FormCard>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 mt-4 flex justify-end gap-2 border-t border-neutral-200 bg-white py-3">
                  <button type="button" onClick={ed.cancel} className={secondaryBtn}>
                    Cancel
                  </button>
                  <button type="button" onClick={ed.save} className={primaryBtn}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <RecordsTable
                  caption={`${g.title} order configs`}
                  records={records[g.id]}
                  flashId={ed.flashId}
                  onEdit={(r) => ed.startEdit(g.id, r)}
                />
                <div className="mt-3">
                  <AddMenu
                    disabled={editing !== null}
                    onPick={(label) => ed.startNew(g.id, label)}
                  />
                </div>
              </>
            )}
          </AccordionCard>
        );
      })}
    </div>
  );
}
