import { useState } from "react";
import { RESOLUTION_REASONS, type ResolutionReason } from "../../lib/qlik";

/* Spec §2.3 — Resolve: small inline form, NOT a modal.
 * Spec §4.3: resolution reason mandatory.
 * Spec §4.4: no optimistic resolve — caller awaits backend before closing. */

export default function ResolveForm({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: ResolutionReason, note: string | undefined) => void;
}) {
  const [reason, setReason] = useState<ResolutionReason | "">("");
  const [note, setNote] = useState("");
  const noteRequired = reason === "other";
  const canSubmit =
    reason !== "" && (!noteRequired || note.trim().length > 0) && !busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Guard narrows `reason` to ResolutionReason for the onConfirm call.
        if (reason === "") return;
        if (busy || (noteRequired && note.trim().length === 0)) return;
        onConfirm(reason, note.trim() ? note.trim() : undefined);
      }}
      className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Resolve · reason required
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="resolve-reason">
          Resolution reason
        </label>
        <select
          id="resolve-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ResolutionReason)}
          required
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
        >
          <option value="" disabled>
            Select reason…
          </option>
          {RESOLUTION_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            noteRequired
              ? "Note required when reason is Other"
              : "Optional note"
          }
          className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 placeholder:text-neutral-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:bg-neutral-300"
        >
          {busy ? "Saving…" : "Confirm resolve"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        >
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-neutral-400">
          Persists to ccymgmt action log
        </span>
      </div>
    </form>
  );
}
