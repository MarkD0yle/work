import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";
import FieldRow from "../components/fund-connect/FieldRow";
import SectionCard from "../components/fund-connect/SectionCard";
import StatusRail, { type RailItem } from "../components/fund-connect/StatusRail";
import NotificationBell from "../components/fund-connect2/NotificationBell";
import RightPanel from "../components/fund-connect2/RightPanel";
import StatusStrip from "../components/fund-connect2/StatusStrip";
import UploadWizard, { type WizardDraft } from "../components/fund-connect2/UploadWizard";
import {
  USERS,
  activateNow,
  ageLabel,
  ageMinutes,
  applyImport,
  approveRecord,
  blankRecord,
  canActivate,
  canDecide,
  canEdit,
  canStartReview,
  canSubmit,
  changedSinceLastReview,
  clearFlag,
  commentOnRecord,
  DEMO_TODAY,
  fieldState,
  flagField,
  formatDay,
  formatStamp,
  returnWithComments,
  roleLabel,
  sectionStatus,
  setField,
  setTitle,
  startReview,
  stateLabel,
  submitRecord,
  summarise,
  userById,
  userName,
  type ActionResult,
} from "../lib/fundConnect2/engine";
import {
  FIELD_BY_ID,
  SECTIONS,
  derivedFor,
  fieldsInSection,
  summariseSection,
} from "../lib/fundConnect/schema";
import type { Permission } from "../lib/fundConnect/types";
import { slaTone, toneFor } from "../lib/fundConnect/tone";
import {
  ABANDONED_AFTER_MINUTES,
  REVIEW_SLA,
  SEED_NOTICES,
  SEED_RECORDS,
} from "../lib/fundConnect2/seed";
import { STATE_DOT, STATE_PILL } from "../lib/fundConnect2/tone";
import type { FundRecord2, Notice, RecordState2 } from "../lib/fundConnect2/types";

export const title = "Fund Connect 2";
export const section = "forms";
export const fullWidth = true;

/* Fund Connect 2 — upload → validate → review → approve → activate.
 *
 * Same schema, validation and layout language as Fund Connect; what changes
 * is the flow around the form:
 *
 *   - the upload wizard is the entry point (structured import first)
 *   - Draft / Queue / Complete tabs manage the whole book of work
 *   - reject-with-comments loop: who, when, why, and what to fix — then the
 *     original reviewer is notified on resubmit and sees only the delta
 *   - approve asks for an effective date; activate is its own final state
 *   - a per-user notification inbox, and a scoped dark mode (.fc2-dark)
 */

const STATE_FLOW: RecordState2[] = ["draft", "submitted", "in_review", "approved", "active"];

type Tab = "draft" | "queue" | "complete";

const TAB_STATES: Record<Tab, RecordState2[]> = {
  draft: ["draft"],
  queue: ["submitted", "in_review"],
  complete: ["approved", "active"],
};

function tabFor(state: RecordState2): Tab {
  return state === "draft" ? "draft" : state === "submitted" || state === "in_review" ? "queue" : "complete";
}

function Pill({ state }: { state: RecordState2 }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[1px] text-[10px] font-medium tracking-wide uppercase ${STATE_PILL[state]}`}
    >
      <span className={`h-1 w-1 rounded-full ${state === "approved" ? "bg-white" : STATE_DOT[state]}`} aria-hidden />
      {stateLabel(state)}
    </span>
  );
}

export default function FundConnect2Page() {
  const [records, setRecords] = useState<FundRecord2[]>(SEED_RECORDS);
  const [notices, setNotices] = useState<Notice[]>(SEED_NOTICES);
  const [userId, setUserId] = useState("p.raman");
  const [tab, setTab] = useState<Tab>("draft");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [openSection, setOpenSection] = useState("fund");
  const [showAll, setShowAll] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(DEMO_TODAY);
  const [approveText, setApproveText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const user = userById(userId) ?? USERS[0];
  const record = openId ? (records.find((r) => r.id === openId) ?? null) : null;
  const myNotices = notices
    .filter((n) => n.userId === user.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  function update(next: FundRecord2) {
    setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }

  /** Apply a transition that also produced notices, with a toast. */
  function act(result: ActionResult, message: string) {
    update(result.record);
    if (result.notices.length) setNotices((prev) => [...prev, ...result.notices]);
    setToast(message);
  }

  function openRecord(id: string) {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    setOpenId(id);
    setTab(tabFor(rec.state));
    setOpenSection("fund");
    setShowAll(false);
    setToast(null);
  }

  function commitUpload(drafts: WizardDraft[]) {
    const highest = records.reduce(
      (max, r) => Math.max(max, Number(r.id.slice(-4)) || 0),
      0,
    );
    const created = drafts.map((d, i) =>
      applyImport(
        blankRecord(`FC2-${String(highest + i + 1).padStart(4, "0")}`, d.title, user.id),
        d.entries,
        user,
      ),
    );
    setRecords((prev) => [...prev, ...created]);
    setWizardOpen(false);
    setTab("draft");
    setOpenId(created.length === 1 ? created[0].id : null);
    const withErrors = drafts.filter((d) => d.errors > 0).length;
    setToast(
      `${created.length} draft${created.length === 1 ? "" : "s"} created from the upload${
        withErrors ? ` — ${withErrors} still ${withErrors === 1 ? "has" : "have"} fields to fix before submitting` : ""
      }. Nothing was retyped.`,
    );
  }

  /* ----- derived state for the open record ----- */

  const summary = useMemo(
    () => (record ? summarise(record, "submit") : null),
    [record],
  );
  const rail: RailItem[] = useMemo(() => {
    if (!record) return [];
    return SECTIONS.map((s) => {
      const fields = fieldsInSection(s.id);
      const states = fields.map((f) => fieldState(record, f.id, "submit"));
      return {
        id: s.id,
        label: s.label,
        status: sectionStatus(record, s.id, "submit"),
        missing: states.filter((st) => st.missing).length,
        errors: states.filter((st) => st.issue?.level === "error").length,
        flags: states.filter((st) => st.flag).length,
      };
    });
  }, [record]);

  const none: Permission = { allowed: false };
  const edit = record ? canEdit(record, user) : none;
  const submit = record ? canSubmit(record, user) : none;
  const pickUp = record ? canStartReview(record, user) : none;
  const decide = record ? canDecide(record, user) : none;
  const activate = record ? canActivate(record, user) : none;
  const reviewing = record?.state === "in_review" && decide.allowed;
  const openFlags = record ? record.flags.filter((f) => !f.resolved).length : 0;

  const delta = record ? changedSinceLastReview(record) : null;
  const deltaMap = new Map((delta ?? []).map((d) => [d.fieldId, d]));
  const showDelta = Boolean(record && record.state === "in_review" && delta && delta.length > 0);

  const lastReject = record
    ? [...record.comments].reverse().find((c) => c.kind === "reject" && c.cycle === record.cycle)
    : null;

  /* ----- per-tab lists and badges ----- */

  const byTab = (t: Tab) => records.filter((r) => TAB_STATES[t].includes(r.state));
  const draftActionCount = user.roles.includes("submitter")
    ? byTab("draft").filter((r) => r.flags.some((f) => !f.resolved)).length
    : 0;
  const queueActionCount = user.roles.includes("approver")
    ? byTab("queue").filter(
        (r) => canStartReview(r, user).allowed || canDecide(r, user).allowed,
      ).length
    : 0;

  const sectionsToShow = showAll ? SECTIONS.map((s) => s.id) : [openSection];

  return (
    <div
      className={`${dark ? "fc2-dark " : ""}flex h-full min-h-0 flex-col bg-neutral-50 text-neutral-900`}
    >
      <header className="shrink-0 border-b border-neutral-200 bg-white">
        {/* Top row — identity, role, theme, inbox. Left padding clears the
            app shell's floating Home pill. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-4 pb-3 pl-36">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-neutral-400 uppercase">
                Fund Connect 2
              </span>
              <span className="hidden text-[10px] text-neutral-400 sm:inline">
                upload → validate → review → approve → activate
              </span>
            </div>
            {record ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  ← Back to {tab === "draft" ? "Draft" : tab === "queue" ? "Queue" : "Complete"}
                </button>
                <span className="font-mono text-sm text-neutral-500">{record.id}</span>
                {edit.allowed ? (
                  <input
                    value={record.title}
                    onChange={(e) => update(setTitle(record, e.target.value, user))}
                    aria-label="Draft title"
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-lg font-semibold tracking-tight text-neutral-900 hover:border-neutral-300 focus:border-neutral-400 focus:bg-white focus:outline-none"
                  />
                ) : (
                  <h1 className="truncate text-lg font-semibold tracking-tight">{record.title}</h1>
                )}
                <Pill state={record.state} />
                {record.cycle > 1 && (
                  <span className="rounded-full border border-neutral-300 px-2 py-[1px] text-[10px] font-medium text-neutral-600">
                    Cycle {record.cycle}
                  </span>
                )}
              </div>
            ) : (
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Book of work</h1>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Acting as
              <select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setToast(null);
                }}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
              >
                {USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {roleLabel(u)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-pressed={dark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
              className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-600 hover:text-neutral-900"
            >
              {dark ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.061 1.06l1.06 1.06Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            <NotificationBell
              notices={myNotices}
              onOpen={(n) => {
                setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                openRecord(n.recordId);
              }}
              onMarkAllRead={() =>
                setNotices((prev) =>
                  prev.map((x) => (x.userId === user.id ? { ...x, read: true } : x)),
                )
              }
            />
          </div>
        </div>

        {/* Second row — tabs on the lists, status + actions on a record. */}
        {!record ? (
          <div className="flex flex-wrap items-center gap-2 px-6 pb-3 pl-36">
            <div className="flex border border-neutral-300">
              {(
                [
                  ["draft", "Draft", byTab("draft").length, draftActionCount],
                  ["queue", "Queue", byTab("queue").length, queueActionCount],
                  ["complete", "Complete", byTab("complete").length, 0],
                ] as [Tab, string, number, number][]
              ).map(([id, label, count, action]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium ${
                    tab === id ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"
                  }`}
                >
                  {label}
                  <span className={`tabular-nums ${tab === id ? "text-neutral-400" : "text-neutral-400"}`}>
                    {count}
                  </span>
                  {action > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white tabular-nums">
                      {action}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!user.roles.includes("submitter")}
              title={
                user.roles.includes("submitter")
                  ? undefined
                  : `${user.name} holds approver rights only.`
              }
              onClick={() => setWizardOpen(true)}
              className="ml-auto rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
            >
              ↑ Upload instructions
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-3 pl-36">
            {summary && <StatusStrip summary={summary} />}
            <div className="flex flex-wrap items-center gap-2">
              {record.state === "draft" && (
                <>
                  <button
                    type="button"
                    disabled={!edit.allowed}
                    title={edit.reason}
                    onClick={() =>
                      setToast(`Draft saved at ${formatStamp(record.updatedAt)} — pick it up any time from the Draft tab.`)
                    }
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:text-neutral-400"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={!submit.allowed}
                    title={submit.reason}
                    onClick={() =>
                      act(
                        submitRecord(record, user),
                        record.cycle === 0
                          ? "Submitted. Approvers have been notified; the record is locked until one picks it up."
                          : "Resubmitted. The reviewer who returned it has been notified and will see what changed.",
                      )
                    }
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                  >
                    {record.cycle === 0 ? "Submit for review" : "Resubmit"}
                  </button>
                </>
              )}

              {record.state === "submitted" && (
                <button
                  type="button"
                  disabled={!pickUp.allowed}
                  title={pickUp.reason}
                  onClick={() => {
                    update(startReview(record, user));
                    setToast(`${user.name} is now reviewing cycle ${record.cycle}.`);
                  }}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                >
                  Start review
                </button>
              )}

              {record.state === "in_review" && (
                <>
                  <button
                    type="button"
                    disabled={!decide.allowed}
                    title={decide.reason}
                    onClick={() => {
                      setRejectText("");
                      setRejectOpen(true);
                    }}
                    className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:border-neutral-200 disabled:text-neutral-400"
                  >
                    Reject with comments{openFlags > 0 ? ` (${openFlags} flagged)` : ""}
                  </button>
                  <button
                    type="button"
                    disabled={!decide.allowed || openFlags > 0}
                    title={
                      openFlags > 0
                        ? "Withdraw the open flags or reject the record — an approval cannot sit on top of them."
                        : decide.reason
                    }
                    onClick={() => {
                      setEffectiveDate(DEMO_TODAY);
                      setApproveText("");
                      setApproveOpen(true);
                    }}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                  >
                    Approve…
                  </button>
                </>
              )}

              {record.state === "approved" && (
                <button
                  type="button"
                  disabled={!activate.allowed}
                  title={activate.reason}
                  onClick={() => act(activateNow(record, user), "Activated — the instruction is now in force.")}
                  className="rounded-md border border-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:border-neutral-200 disabled:text-neutral-400"
                >
                  Activate now
                </button>
              )}
            </div>
          </div>
        )}

        {(toast || (record && !edit.allowed && record.state === "draft")) && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-2 text-xs text-neutral-600">
            {toast ?? edit.reason}
            {toast && (
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-3 text-[11px] text-neutral-400 underline underline-offset-2"
              >
                dismiss
              </button>
            )}
          </div>
        )}
      </header>

      {/* ================= Lists ================= */}
      {!record && (
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "draft" && (
            <ListShell
              empty={byTab("draft").length === 0}
              emptyText="No drafts. Upload a dealing sheet to raise some."
              head={["Draft", "Owner", "Progress", "Last updated", ""]}
            >
              {byTab("draft")
                .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
                .map((r) => {
                  const s = summarise(r, "submit");
                  const returned = r.flags.some((f) => !f.resolved) || r.comments.some((c) => c.kind === "reject" && c.cycle === r.cycle);
                  const abandoned = ageMinutes(r.updatedAt) >= ABANDONED_AFTER_MINUTES;
                  const lastActor = r.audit[0]?.actor ?? r.createdBy;
                  return (
                    <tr key={r.id} className="hover:bg-white">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-neutral-400">{r.id}</span>
                          <span className="text-xs font-medium text-neutral-900">{r.title}</span>
                          {returned && (
                            <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
                              Returned — needs changes
                            </span>
                          )}
                          {abandoned && (
                            <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                              Untouched {ageLabel(r.updatedAt)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600">{userName(r.createdBy)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-[2px]">
                            {Array.from({ length: s.sectionsTotal }, (_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-3 ${i < s.sectionsComplete ? "bg-neutral-900" : "bg-neutral-200"}`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-neutral-500 tabular-nums">
                            {s.sectionsComplete}/{s.sectionsTotal}
                          </span>
                          {s.errors > 0 && (
                            <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                              {s.errors}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-500">
                        {ageLabel(r.updatedAt)} ago · {userName(lastActor)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <OpenBtn onClick={() => openRecord(r.id)} label={returned ? "Fix & resubmit" : "Open"} />
                      </td>
                    </tr>
                  );
                })}
            </ListShell>
          )}

          {tab === "queue" && (
            <ListShell
              empty={byTab("queue").length === 0}
              emptyText="Nothing is waiting on a reviewer."
              head={["Record", "Submitted by", "Waiting", "Cycle", "Reviewer", "State", ""]}
              caption={`Review target ${REVIEW_SLA.target / 60}h · breach ${REVIEW_SLA.breach / 60}h`}
            >
              {byTab("queue")
                .sort((a, b) => Date.parse(a.submittedAt ?? a.updatedAt) - Date.parse(b.submittedAt ?? b.updatedAt))
                .map((r) => {
                  const mins = ageMinutes(r.submittedAt ?? r.updatedAt);
                  const tone = toneFor(slaTone(mins, REVIEW_SLA), "muted");
                  const mine = canStartReview(r, user).allowed || canDecide(r, user).allowed;
                  return (
                    <tr key={r.id} className="hover:bg-white">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-neutral-400">{r.id}</span>
                          <span className="text-xs font-medium text-neutral-900">{r.title}</span>
                          {mine && (
                            <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                              Your action
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600">{userName(r.submittedBy)}</td>
                      <td className={`px-4 py-2.5 text-xs tabular-nums ${tone.text}`}>
                        {ageLabel(r.submittedAt ?? r.updatedAt)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600 tabular-nums">{r.cycle}</td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600">
                        {r.reviewerId ? userName(r.reviewerId) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill state={r.state} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <OpenBtn
                          onClick={() => openRecord(r.id)}
                          label={
                            canStartReview(r, user).allowed
                              ? "Pick up"
                              : canDecide(r, user).allowed
                                ? "Review"
                                : "Open"
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
            </ListShell>
          )}

          {tab === "complete" && (
            <ListShell
              empty={byTab("complete").length === 0}
              emptyText="Nothing has been approved yet."
              head={["Record", "Approved by", "Effective", "Status", ""]}
            >
              {byTab("complete")
                .sort((a, b) => Date.parse(b.approvedAt ?? b.updatedAt) - Date.parse(a.approvedAt ?? a.updatedAt))
                .map((r) => (
                  <tr key={r.id} className="hover:bg-white">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-neutral-400">{r.id}</span>
                        <span className="text-xs font-medium text-neutral-900">{r.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-600">
                      {userName(r.approvedBy)} · {r.approvedAt ? formatStamp(r.approvedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-600">
                      {r.effectiveDate ? formatDay(r.effectiveDate) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Pill state={r.state} />
                        {r.state === "approved" && (
                          <span className="text-[11px] text-neutral-500">scheduled</span>
                        )}
                        {r.state === "active" && r.activatedAt && (
                          <span className="text-[11px] text-neutral-500">
                            since {formatStamp(r.activatedAt)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <OpenBtn onClick={() => openRecord(r.id)} label="Open" />
                    </td>
                  </tr>
                ))}
            </ListShell>
          )}
        </main>
      )}

      {/* ================= Record editor ================= */}
      {record && (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-neutral-100/70 lg:flex">
            <div className="px-3 py-3">
              <p className="px-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                Sections
              </p>
            </div>
            <StatusRail
              items={rail}
              activeId={showAll ? "" : openSection}
              onSelect={(id) => {
                setOpenSection(id);
                setShowAll(false);
              }}
            />

            <div className="mt-4 border-t border-neutral-200 px-4 py-3">
              <p className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                Pipeline
              </p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {STATE_FLOW.map((s) => {
                  const current = record.state === s;
                  const passed = STATE_FLOW.indexOf(record.state) > STATE_FLOW.indexOf(s);
                  return (
                    <li key={s} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          current ? STATE_DOT[s] : passed ? "bg-neutral-400" : "bg-neutral-300"
                        }`}
                      />
                      <span className={current ? "font-semibold text-neutral-900" : "text-neutral-500"}>
                        {stateLabel(s)}
                      </span>
                      {s === "approved" && record.effectiveDate && (
                        <span className="text-[10px] text-neutral-400">
                          eff. {formatDay(record.effectiveDate)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <dl className="border-t border-neutral-200 px-4 py-3 text-[11px]">
              <div className="flex justify-between gap-2 py-0.5">
                <dt className="text-neutral-400">Owner</dt>
                <dd className="text-neutral-700">{userName(record.createdBy)}</dd>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <dt className="text-neutral-400">Submitted by</dt>
                <dd className="text-neutral-700">{userName(record.submittedBy)}</dd>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <dt className="text-neutral-400">Reviewer</dt>
                <dd className="text-neutral-700">{record.reviewerId ? userName(record.reviewerId) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <dt className="text-neutral-400">Review cycle</dt>
                <dd className="text-neutral-700 tabular-nums">{record.cycle || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <dt className="text-neutral-400">Last change</dt>
                <dd className="text-neutral-700">{ageLabel(record.updatedAt)} ago</dd>
              </div>
            </dl>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-3">
              {/* Rejection banner — who, when, why, and where to go. */}
              {record.state === "draft" && lastReject && (
                <div className="border border-amber-400 bg-amber-50/60 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900">
                    Rejected by {userName(lastReject.by)} · {formatStamp(lastReject.at)}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-amber-900">{lastReject.text}</p>
                  {record.flags.filter((f) => !f.resolved).length > 0 && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-amber-800">
                      Fields to fix:
                      {record.flags
                        .filter((f) => !f.resolved)
                        .map((f) => (
                          <button
                            key={f.fieldId}
                            type="button"
                            onClick={() => {
                              setOpenSection(FIELD_BY_ID[f.fieldId]?.sectionId ?? "fund");
                              setShowAll(false);
                            }}
                            className="rounded-full border border-amber-400 bg-white px-2 py-[1px] font-medium hover:bg-amber-100"
                          >
                            {FIELD_BY_ID[f.fieldId]?.label ?? f.fieldId} →
                          </button>
                        ))}
                    </p>
                  )}
                </div>
              )}

              {/* Delta banner — the 4-eyes shortcut on a resubmission. */}
              {showDelta && (
                <div className="border border-blue-300 bg-blue-50/60 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800">
                    Changed since your last review — {delta!.length} field{delta!.length === 1 ? "" : "s"} (cycle {record.cycle})
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {delta!.map((d) => (
                      <li key={d.fieldId} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSection(FIELD_BY_ID[d.fieldId]?.sectionId ?? "fund");
                            setShowAll(false);
                          }}
                          className="rounded-full border border-blue-300 bg-white px-2 py-[1px] font-medium text-blue-800 hover:bg-blue-100"
                        >
                          {FIELD_BY_ID[d.fieldId]?.label ?? d.fieldId} →
                        </button>
                        <span className="font-mono text-neutral-500">
                          <span className="line-through">{d.from || "empty"}</span>
                          <span className="mx-1">→</span>
                          <span className="text-neutral-900">{d.to || "empty"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[10px] text-blue-800/80">
                    Everything else is unchanged from the version you already reviewed.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  {showAll
                    ? "All sections open — cross-reference values while filling in."
                    : "One section at a time. Completed sections condense to a summary row."}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    disabled={showAll}
                    className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    Open all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAll(false);
                      setOpenSection("");
                    }}
                    disabled={!showAll && openSection === ""}
                    className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    Close all
                  </button>
                </div>
              </div>

              {SECTIONS.map((s, i) => {
                const item = rail[i];
                const expanded = sectionsToShow.includes(s.id);
                return (
                  <SectionCard
                    key={s.id}
                    index={i + 1}
                    label={s.label}
                    blurb={s.blurb}
                    status={item.status}
                    summary={summariseSection(s.id, record.values)}
                    expanded={expanded}
                    errors={item.errors}
                    flags={item.flags}
                    missing={item.missing}
                    onToggle={() => {
                      if (showAll) {
                        setShowAll(false);
                        setOpenSection(s.id);
                        return;
                      }
                      setOpenSection(expanded ? "" : s.id);
                    }}
                  >
                    {fieldsInSection(s.id).map((field) => {
                      const state = fieldState(record, field.id, "submit");
                      const changed = deltaMap.get(field.id);
                      const row = (
                        <FieldRow
                          key={field.id}
                          field={field}
                          value={record.values[field.id] ?? ""}
                          source={state.source}
                          issue={state.issue}
                          missing={state.missing}
                          flag={state.flag}
                          flagAuthor={state.flag ? userName(state.flag.by) : undefined}
                          derived={derivedFor(field, record.values)}
                          readOnly={!edit.allowed}
                          canFlag={Boolean(reviewing)}
                          onChange={(value) => update(setField(record, field.id, value, user))}
                          onFlag={(note) => {
                            update(flagField(record, field.id, note, user));
                            setToast(`${field.label} rejected — the note travels with the field and comes back with your comments.`);
                          }}
                          onClearFlag={() => {
                            update(clearFlag(record, field.id, user));
                            setToast(`Flag withdrawn from ${field.label}.`);
                          }}
                        />
                      );
                      if (!changed || !showDelta) return row;
                      return (
                        <div key={field.id} className="border-l-2 border-blue-400 bg-blue-50/30">
                          <p className="flex flex-wrap items-center gap-2 px-4 pt-2 text-[10px]">
                            <span className="rounded-full bg-blue-100 px-1.5 font-medium tracking-wide text-blue-800 uppercase">
                              Changed this cycle
                            </span>
                            <span className="font-mono text-neutral-500">
                              was <span className="line-through">{changed.from || "empty"}</span>
                            </span>
                          </p>
                          {row}
                        </div>
                      );
                    })}
                  </SectionCard>
                );
              })}
            </div>
          </main>

          <aside className="hidden w-80 shrink-0 xl:block">
            <RightPanel
              record={record}
              canComment={record.state !== "active"}
              onComment={(text) =>
                act(commentOnRecord(record, user, text), "Comment added to the thread.")
              }
            />
          </aside>
        </div>
      )}

      <UploadWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCommit={commitUpload} />

      {/* Reject with comments */}
      {record && (
        <Modal
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          title="Reject with comments"
          description={`The comment goes back to ${userName(record.submittedBy)} with your name and the time, alongside ${openFlags > 0 ? `the ${openFlags} flagged field${openFlags === 1 ? "" : "s"}` : "any flagged fields"}. They are notified, and you are notified again when it comes back.`}
          severity="required"
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectText.trim() === ""}
                onClick={() => {
                  const result = returnWithComments(record, user, rejectText.trim());
                  act(
                    result,
                    `Returned to ${userName(record.submittedBy)} with your comments${openFlags ? ` and ${openFlags} flagged field${openFlags === 1 ? "" : "s"}` : ""}.`,
                  );
                  setRejectOpen(false);
                  setOpenId(null);
                  setTab("queue");
                }}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
              >
                Reject & return
              </button>
            </div>
          }
        >
          <label className="flex flex-col gap-1.5 text-xs text-neutral-600">
            What is wrong, and what would make it right? (required)
            <textarea
              value={rejectText}
              onChange={(e) => setRejectText(e.target.value)}
              rows={3}
              autoFocus
              className="w-full rounded-md border border-neutral-300 px-2.5 py-2 text-sm text-neutral-800"
              placeholder="e.g. Quantity disagrees with the dealing sheet — confirm and resubmit."
            />
          </label>
          {openFlags === 0 && (
            <p className="mt-2 text-[11px] text-neutral-400">
              Tip: flagging the specific fields first (Reject field, on the field) lands the
              submitter exactly where the problem is.
            </p>
          )}
        </Modal>
      )}

      {/* Approve with an effective date */}
      {record && (
        <Modal
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
          title="Approve"
          description="Approval asks one more question: when does this take effect? Today activates it immediately; a future date leaves it scheduled until then."
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveOpen(false)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={effectiveDate === ""}
                onClick={() => {
                  const immediate = effectiveDate <= DEMO_TODAY;
                  act(
                    approveRecord(record, user, effectiveDate, approveText),
                    immediate
                      ? "Approved and activated — the instruction is in force."
                      : `Approved — scheduled to take effect ${formatDay(effectiveDate)}.`,
                  );
                  setApproveOpen(false);
                }}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
              >
                {effectiveDate && effectiveDate <= DEMO_TODAY ? "Approve & activate" : "Approve & schedule"}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs text-neutral-600">
              Effective date
              <input
                type="date"
                value={effectiveDate}
                min={DEMO_TODAY}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-44 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-800"
              />
            </label>
            <p className="text-[11px] text-neutral-500">
              {effectiveDate && effectiveDate <= DEMO_TODAY
                ? "Effective today — the record goes straight to Active."
                : effectiveDate
                  ? `The record shows as Approved · scheduled until ${formatDay(effectiveDate)}, and can be activated early from the Complete tab.`
                  : "Pick a date."}
            </p>
            <label className="flex flex-col gap-1.5 text-xs text-neutral-600">
              Comment (optional — lands in the thread with your name and the time)
              <textarea
                value={approveText}
                onChange={(e) => setApproveText(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-neutral-300 px-2.5 py-2 text-sm text-neutral-800"
                placeholder="e.g. Checked against the signed instruction."
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----- small list helpers ----- */

function ListShell({
  head,
  empty,
  emptyText,
  caption,
  children,
}: {
  head: string[];
  empty: boolean;
  emptyText: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-neutral-200 bg-neutral-50">
      {caption && (
        <p className="border-b border-neutral-200 bg-white px-4 py-2 text-[11px] text-neutral-500">
          {caption}
        </p>
      )}
      <table className="w-full text-left text-xs">
        <thead className="bg-white text-[10px] tracking-wide text-neutral-500 uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-5 text-neutral-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </section>
  );
}

function OpenBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
    >
      {label}
    </button>
  );
}
