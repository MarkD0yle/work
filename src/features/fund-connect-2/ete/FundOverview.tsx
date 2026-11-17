import { useState } from "react";
import { ConfirmDialog } from "../ui/Modal";
import { userName } from "../lib/engine";
import { useEte, type ActionResult } from "./ete-context";
import { countBySeverity } from "./engine";
import { WORKFLOW_LABEL, fundStatus, workflowState } from "./model";
import { btn, control, cx, eyebrow, focusRing, label, muted } from "./styles";
import { Badge, Notice, WorkflowBadge } from "./ui";

/* Fund Overview — the summary that stays on screen above every tab, with
 * the workflow position and the actions the acting user can take.
 *
 *   Draft → Validation → Awaiting approval → Approved → Active
 */

type StepMark = "done" | "current" | "blocked" | "rejected" | "todo";

const MARK: Record<StepMark, { glyph: string; word: string; cls: string }> = {
  done: { glyph: "✓", word: "Done", cls: "border-neutral-900 bg-neutral-900 text-white" },
  current: { glyph: "●", word: "Current", cls: "border-neutral-900 bg-white text-neutral-900" },
  blocked: { glyph: "!", word: "Blocked", cls: "border-red-400 bg-white text-red-700" },
  rejected: { glyph: "✕", word: "Rejected", cls: "border-red-400 bg-white text-red-700" },
  todo: { glyph: "", word: "Not started", cls: "border-neutral-300 bg-white text-neutral-400" },
};

function Stepper() {
  const { fund, pendingIssues } = useEte();
  const state = workflowState(fund);
  const { errors, warnings } = countBySeverity(pendingIssues);

  const steps: { label: string; mark: StepMark; note?: string }[] =
    state === "active"
      ? ["Draft", "Validation", "Awaiting approval", "Approved", "Active"].map((l) => ({ label: l, mark: "done" as const }))
      : [
          { label: "Draft", mark: state === "draft" ? "current" : "done", note: state === "draft" ? "Editing" : undefined },
          {
            label: "Validation",
            mark: errors > 0 ? "blocked" : "done",
            note: errors > 0 ? `${errors} ${errors === 1 ? "error" : "errors"} to fix` : warnings > 0 ? `Passed, ${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "Passed",
          },
          {
            label: "Awaiting approval",
            mark: state === "awaiting" ? "current" : state === "rejected" ? "rejected" : "todo",
            note: state === "awaiting" ? "With an approver" : state === "rejected" ? "Sent back" : undefined,
          },
          { label: "Approved", mark: "todo" },
          { label: "Active", mark: "todo", note: fund.active ? `Version ${fund.activeVersion} in use until then` : undefined },
        ];

  return (
    <ol aria-label="Workflow" className="flex flex-wrap items-start gap-x-2 gap-y-2">
      {steps.map((s, i) => {
        const m = MARK[s.mark];
        return (
          <li key={s.label} className="flex items-start gap-2">
            {i > 0 && (
              <span aria-hidden className="mt-0.5 text-neutral-300">
                →
              </span>
            )}
            <span aria-hidden className={cx("mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold", m.cls)}>
              {m.glyph || i + 1}
            </span>
            <span className="text-xs">
              <span className={cx("font-medium", s.mark === "todo" ? "text-neutral-500" : "text-neutral-900")}>{s.label}</span>
              <span className="sr-only"> — {m.word}</span>
              {s.note && <span className={cx("block text-[11px]", s.mark === "blocked" || s.mark === "rejected" ? "text-red-700" : "text-neutral-500")}>{s.note}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Actions() {
  const { fund, user, pendingIssues, setTab, startModification, discardDraft, submit, withdraw, approve, reject, revise } = useEte();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const pending = fund.pending;
  const state = workflowState(fund);
  const isSubmitter = user.roles.includes("submitter");
  const isApprover = user.roles.includes("approver");
  const { errors } = countBySeverity(pendingIssues);

  const run = (result: ActionResult, done: string) => setFlash(result.ok ? { ok: true, text: done } : { ok: false, text: result.reason });

  // Why the acting user cannot decide, if they cannot. The submitter rule
  // comes first: it applies whatever the role.
  const ownSubmission = pending?.state === "awaiting" && pending.submittedBy === user.id;
  const decideBlock = ownSubmission
    ? "You submitted this change, so you cannot approve or reject it. Switch Acting as to another approver."
    : !isApprover
      ? "Your role cannot approve changes. Switch Acting as to an approver."
      : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "active" && (
          <>
            <button type="button" disabled={!isSubmitter} onClick={() => run(startModification(), "Draft created. The active version stays in use until the change is approved.")} className={btn.primary}>
              Modify configuration
            </button>
            {!isSubmitter && <span className={muted}>Your role cannot start a change. Switch Acting as to a submitter.</span>}
          </>
        )}

        {state === "draft" && (
          <>
            <button type="button" disabled={!isSubmitter || errors > 0} onClick={() => run(submit(), "Submitted for approval. Someone else must approve it.")} className={btn.primary}>
              Submit for approval
            </button>
            {fund.active && (
              <button type="button" disabled={!isSubmitter} onClick={() => setConfirmDiscard(true)} className={btn.secondary}>
                Discard draft
              </button>
            )}
            {errors > 0 ? (
              <span className="text-xs text-red-700">
                <span className="font-semibold">Cannot submit yet: </span>
                {errors} validation {errors === 1 ? "error" : "errors"}.{" "}
                <button type="button" onClick={() => setTab("review")} className={btn.link}>
                  Review them
                </button>
              </span>
            ) : (
              !isSubmitter && <span className={muted}>Your role cannot edit or submit. Switch Acting as to a submitter.</span>
            )}
          </>
        )}

        {state === "awaiting" && (
          <>
            <button type="button" disabled={Boolean(decideBlock)} onClick={() => run(approve(), "Approved. The new version is now active.")} className={btn.primary}>
              Approve
            </button>
            <button type="button" disabled={Boolean(decideBlock)} onClick={() => setRejecting(true)} className={btn.warn}>
              Reject…
            </button>
            {ownSubmission && (
              <button type="button" onClick={() => run(withdraw(), "Withdrawn. The change is a draft again.")} className={btn.secondary}>
                Withdraw submission
              </button>
            )}
          </>
        )}

        {state === "rejected" && (
          <>
            <button type="button" disabled={!isSubmitter} onClick={() => run(revise(), "Reopened as a draft. Fix what was raised, then submit again.")} className={btn.primary}>
              Revise
            </button>
            {fund.active && (
              <button type="button" disabled={!isSubmitter} onClick={() => setConfirmDiscard(true)} className={btn.secondary}>
                Discard change
              </button>
            )}
            {!isSubmitter && <span className={muted}>Your role cannot revise a change. Switch Acting as to a submitter.</span>}
          </>
        )}

        {flash && (
          <span role="status" className={cx("text-xs", flash.ok ? "text-neutral-700" : "text-red-700")}>
            {!flash.ok && <span className="font-semibold">Not done: </span>}
            {flash.text}
          </span>
        )}
      </div>

      {state === "awaiting" && decideBlock && (
        <Notice tone="warn" title="You cannot approve this change">
          {decideBlock}
        </Notice>
      )}

      {state === "awaiting" && rejecting && !decideBlock && (
        <div className="border border-amber-400 bg-amber-50 p-3">
          <label htmlFor="ete-reject-reason" className={label}>
            Reason for rejecting (the submitter sees this)
          </label>
          <textarea id="ete-reject-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={cx("mt-1 border-neutral-300", control)} placeholder="Say what needs to change before this can be approved." />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => {
                run(reject(reason), "Rejected. The submitter can revise and resubmit.");
                setRejecting(false);
                setReason("");
              }}
              className={btn.primary}
            >
              Confirm rejection
            </button>
            <button type="button" onClick={() => setRejecting(false)} className={btn.secondary}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          run(discardDraft(), `Discarded. Active version ${fund.activeVersion} was not changed.`);
        }}
        title="Discard this change?"
        description={`Every edit in the pending change is deleted. Active version ${fund.activeVersion} stays in use, unchanged.`}
        confirmLabel="Discard"
        destructive
      />
    </div>
  );
}

export function FundOverview() {
  const { fund, config, view, setView } = useEte();
  const d = config.details;
  const state = workflowState(fund);
  const pending = fund.pending;

  const facts: [string, React.ReactNode][] = [
    ["Issuer", d.issuer || "Not set"],
    ["Fund code", <span className="font-mono">{d.fundCode || "Not set"}</span>],
    ["Fund name", d.fundName || "Not set"],
    ["Region", d.region || "Not set"],
    ["Currency", d.currency || "Not set"],
    ["Status", <Badge tone={fund.active ? "good" : "neutral"}>{fundStatus(fund)}</Badge>],
    ["Workflow state", <WorkflowBadge state={state} />],
    ["Last modified", `${userName(fund.lastModifiedBy)}, ${fund.lastModifiedAt}`],
  ];

  return (
    <section aria-label="Fund overview" className="shrink-0 border-b border-neutral-200 bg-white px-6 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className={eyebrow}>{k}</dt>
              <dd className="mt-0.5 truncate text-xs font-medium text-neutral-900">{v}</dd>
            </div>
          ))}
        </dl>

        {fund.active && pending && (
          <div role="radiogroup" aria-label="Version on screen" className="inline-flex shrink-0 border border-neutral-300 bg-white p-0.5">
            {(
              [
                ["pending", `Pending change (${WORKFLOW_LABEL[pending.state]})`],
                ["active", `Active version ${fund.activeVersion} (in use)`],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => setView(value)}
                className={cx("px-2.5 py-1 text-xs font-medium whitespace-nowrap", view === value ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100", focusRing)}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3">
        <Stepper />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {fund.active && pending && view === "pending" && (
          <Notice tone="info" title={`Active version ${fund.activeVersion} is still in use`}>
            This pending change does not affect live orders. The active version stays unchanged until the change is approved.
          </Notice>
        )}
        {fund.active && pending && view === "active" && (
          <Notice tone="good" title={`You are looking at active version ${fund.activeVersion}, the one in use`}>
            A pending change ({WORKFLOW_LABEL[pending.state].toLowerCase()}) exists alongside it and has not altered anything here.
          </Notice>
        )}
        {pending?.state === "rejected" && (
          <Notice tone="bad" title={`Rejected by ${userName(pending.rejectedBy ?? null)}${pending.rejectedAt ? ` on ${pending.rejectedAt}` : ""}`}>
            {pending.rejectionReason}
          </Notice>
        )}
        {pending?.state === "awaiting" && (
          <p className={muted}>
            Submitted by {userName(pending.submittedBy ?? null)}
            {pending.submittedAt ? ` on ${pending.submittedAt}` : ""}. Locked until it is approved, rejected or withdrawn.
          </p>
        )}
        <Actions key={fund.id} />
      </div>
    </section>
  );
}
