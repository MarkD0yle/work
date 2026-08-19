import { useState, type ReactNode } from "react";
import { FormCard } from "../forms";

/* The one reusable read/edit toggle pattern for Pitch Perfect. Defaults to a
 * clean read-only render — because the person filling in a section may not
 * be the salesperson themselves — with an explicit Edit affordance that
 * clones the current value into a draft, then Save/Cancel.
 *
 * `bare` drops the FormCard title/description chrome (used when a parent
 * already provides it — e.g. an AccordionRow header) and keeps just the
 * Edit/Save/Cancel affordances and body. */
export function ReadEditSection<T>({
  title,
  description,
  value,
  isEmpty,
  renderRead,
  renderEdit,
  onSave,
  emptyLabel = "Nothing captured yet.",
  bare = false,
}: {
  title: string;
  description?: string;
  value: T;
  isEmpty: (v: T) => boolean;
  renderRead: (v: T) => ReactNode;
  renderEdit: (draft: T, setDraft: (next: T) => void) => ReactNode;
  onSave: (next: T) => void;
  emptyLabel?: string;
  bare?: boolean;
}) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [draft, setDraft] = useState<T>(value);

  function startEdit() {
    setDraft(structuredClone(value));
    setMode("edit");
  }

  function cancel() {
    setMode("read");
  }

  function save() {
    onSave(draft);
    setMode("read");
  }

  const editButton = (
    <button
      type="button"
      onClick={startEdit}
      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
    >
      Edit
    </button>
  );

  const body =
    mode === "read" ? (
      isEmpty(value) ? (
        <p className="text-sm text-neutral-400 italic">{emptyLabel}</p>
      ) : (
        renderRead(value)
      )
    ) : (
      <div className="space-y-4">
        {renderEdit(draft, setDraft)}
        <div className="flex items-center gap-2 border-t border-neutral-100 pt-3.5">
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Save
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );

  if (bare) {
    return (
      <div>
        {mode === "read" && <div className="mb-3 flex justify-end">{editButton}</div>}
        {body}
      </div>
    );
  }

  return (
    <FormCard title={title} description={description} action={mode === "read" ? editButton : undefined}>
      {body}
    </FormCard>
  );
}
