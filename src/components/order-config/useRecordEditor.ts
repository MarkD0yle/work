import { useCallback, useEffect, useMemo, useState } from "react";
import { makeDraft, validate, type Errors, type OrderConfig } from "./model";

export type Editing = { groupId: string; record: OrderConfig; isNew: boolean };

/* Editing state shared by the three new variants: one record being edited at
 * a time, live validation errors after the first failed save, and a short
 * "just saved" flash id so the table can confirm where the row landed. */
export function useRecordEditor(upsert: (groupId: string, r: OrderConfig) => void) {
  const [editing, setEditing] = useState<Editing | null>(null);
  // Errors stay hidden until the first failed save, then track edits live.
  const [showErrors, setShowErrors] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1800);
    return () => clearTimeout(t);
  }, [flashId]);

  const errors = useMemo<Errors>(
    () => (showErrors && editing ? validate(editing.record) : {}),
    [showErrors, editing],
  );

  const startNew = useCallback((groupId: string, label: string) => {
    setShowErrors(false);
    setEditing({ groupId, record: makeDraft(label), isNew: true });
  }, []);

  const startEdit = useCallback((groupId: string, record: OrderConfig) => {
    setShowErrors(false);
    setEditing({ groupId, record, isNew: false });
  }, []);

  const patch = useCallback((p: Partial<OrderConfig>) => {
    setEditing((cur) => (cur ? { ...cur, record: { ...cur.record, ...p } } : cur));
  }, []);

  const cancel = useCallback(() => {
    setEditing(null);
    setShowErrors(false);
  }, []);

  /** Returns true when saved; false leaves the editor open with errors. */
  const save = useCallback(() => {
    if (!editing) return false;
    if (Object.keys(validate(editing.record)).length > 0) {
      setShowErrors(true);
      return false;
    }
    upsert(editing.groupId, editing.record);
    setFlashId(editing.record.id);
    setEditing(null);
    setShowErrors(false);
    return true;
  }, [editing, upsert]);

  return { editing, errors, flashId, startNew, startEdit, patch, cancel, save };
}

export const primaryBtn =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30";
export const secondaryBtn =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15";
