import { useState } from "react";
import {
  FORENSIC_ACTION_LABEL,
  forensicActionsRepo,
  type FileEvidence,
  type ForensicActionType,
} from "../../lib/file-forensic-data";
import { ME } from "../../lib/qlik";
import type { ForensicScope } from "../../lib/forensic-scope";

/* Spec v0.1.2 L4 §4.2 — three row actions, severity-ranked.
 *
 * Hard rule (spec §7, rule 30): every action requires a reason. No silent
 * file-state mutations. The form here enforces reason capture before
 * `record()` runs. */

const ACTION_VARIANT: Record<ForensicActionType, string> = {
  mark_received:
    "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  override: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  escalate: "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
};

export default function ForensicActions({
  evidence,
  scope,
}: {
  evidence: FileEvidence;
  scope: ForensicScope;
}) {
  const [activeAction, setActiveAction] = useState<ForensicActionType | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function commit() {
    if (!activeAction || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await forensicActionsRepo.record({
        fileEvidenceId: evidence.id,
        mandateId: scope.mandateId,
        stageName: scope.stageName,
        action: activeAction,
        actor: ME,
        reason: reason.trim(),
      });
      setConfirmation(`${FORENSIC_ACTION_LABEL[activeAction]} · recorded`);
      setActiveAction(null);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
        <span aria-hidden>✓</span>
        <span>{confirmation}</span>
        <button
          type="button"
          onClick={() => setConfirmation(null)}
          className="ml-auto text-emerald-700 hover:underline"
        >
          dismiss
        </button>
      </div>
    );
  }

  if (activeAction) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void commit();
        }}
        className="mt-3 flex flex-col gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2.5"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            {FORENSIC_ACTION_LABEL[activeAction]} · reason required
          </span>
          <span className="text-[10px] text-neutral-400">
            Logged to audit history
          </span>
        </div>
        <input
          autoFocus
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholderFor(activeAction)}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!reason.trim() || submitting}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-neutral-300"
          >
            {submitting ? "Recording…" : "Confirm"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setActiveAction(null);
              setReason("");
            }}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        Actions
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["mark_received", "override", "escalate"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActiveAction(a)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${ACTION_VARIANT[a]}`}
          >
            {FORENSIC_ACTION_LABEL[a]}
          </button>
        ))}
      </div>
    </div>
  );
}

function placeholderFor(a: ForensicActionType): string {
  switch (a) {
    case "mark_received":
      return "e.g. File arrived in alt folder at 15:42, confirmed valid";
    case "override":
      return "e.g. Downstream proceeding without — NAV approver signed off";
    case "escalate":
      return "e.g. MTEX vendor incident, paging data ops";
  }
}
