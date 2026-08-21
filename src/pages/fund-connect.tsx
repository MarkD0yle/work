import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";
import ActivityPanel from "../components/fund-connect/ActivityPanel";
import FieldRow from "../components/fund-connect/FieldRow";
import ImportWizard from "../components/fund-connect/ImportWizard";
import ProgressHeader from "../components/fund-connect/ProgressHeader";
import ReviewerQueue from "../components/fund-connect/ReviewerQueue";
import SectionCard from "../components/fund-connect/SectionCard";
import StatusRail, { type RailItem } from "../components/fund-connect/StatusRail";
import {
  USERS,
  ageLabel,
  applyImport,
  approveRecord,
  beginAmendment,
  canAmend,
  canDecide,
  canEdit,
  canStartReview,
  canSubmit,
  clearFlag,
  fieldState,
  flagField,
  formatStamp,
  nowIso,
  returnToSubmitter,
  sectionStatus,
  setField,
  stageFor,
  startReview,
  stateLabel,
  submitRecord,
  summarise,
  userById,
  userName,
} from "../lib/fundConnect/engine";
import {
  FIELDS,
  SECTIONS,
  derivedFor,
  fieldsInSection,
  isMissing,
  summariseSection,
} from "../lib/fundConnect/schema";
import { SEED_RECORDS } from "../lib/fundConnect/seed";
import { STATE_PILL } from "../lib/fundConnect/tone";
import type { FundRecord, RecordState } from "../lib/fundConnect/types";

export const title = "Audit Trail Client Onboarding";
export const section = "forms";
export const fullWidth = true;

/* Audit Trail Client Onboarding — modernized instruction form.
 *
 * The workflow this replaces was one long page of sectioned forms filled in
 * by retyping values out of Excel, with no draft, no review and no record
 * of who changed what. A hand-typed entry error was the confirmed root
 * cause of a real loss, so the build order here follows the spec's
 * leverage-first sequence rather than UI polish:
 *
 *   1  structured import, with an editable mapping and a preview
 *   2  draft / review state machine, segregation of duties enforced
 *   3  field-level audit trail
 *   4  section status rail and condensing sections
 *   5  field-level rejection
 *   6  re-flagging hand edits made on top of imported values
 *   7  amendment flow, so an approved record is never edited in place
 *   8  validation against the reference masters, not just format checks
 *   9  reviewer queue, SLA and abandoned-draft visibility
 *
 * Logic lives in src/lib/fundConnect; everything in components/fund-connect
 * is props-driven presentation.
 */

const STATE_FLOW: RecordState[] = ["draft", "submitted", "in_review", "approved"];

function blankValues(): Record<string, string> {
  return Object.fromEntries(
    FIELDS.map((f) => [f.id, f.id === "attestation" ? "Not confirmed" : ""]),
  );
}

function blankRecord(id: string, createdBy: string): FundRecord {
  const at = nowIso();
  return {
    id,
    versionId: `${id}-v1`,
    version: 1,
    supersedes: null,
    label: "Imported draft",
    state: "draft",
    values: blankValues(),
    sources: {},
    flags: [],
    audit: [],
    createdBy,
    createdAt: at,
    submittedBy: null,
    submittedAt: null,
    reviewerId: null,
    approvedBy: null,
    approvedAt: null,
    updatedAt: at,
  };
}

export default function FundConnectPage() {
  const [records, setRecords] = useState<FundRecord[]>(SEED_RECORDS);
  const [activeId, setActiveId] = useState("FC-2026-0148-v1");
  const [userId, setUserId] = useState("p.raman");
  const [view, setView] = useState<"record" | "queue">("record");
  const [openSection, setOpenSection] = useState("fund");
  const [showAll, setShowAll] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const user = userById(userId) ?? USERS[0];
  const record = records.find((r) => r.versionId === activeId) ?? records[0];

  // The header and the rail always run the full submit checklist, so a
  // draft shows what is still outstanding instead of saving it all up for a
  // wall of errors at the end. Draft-valid is the separate, lighter gate.
  const summary = useMemo(() => summarise(record, "submit"), [record]);
  const draftStage = stageFor(record);
  const draftBlockers = useMemo(
    () => FIELDS.filter((f) => isMissing(f, record.values, "draft")),
    [record],
  );

  const rail: RailItem[] = useMemo(
    () =>
      SECTIONS.map((s) => {
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
      }),
    [record],
  );

  const versions = useMemo(
    () =>
      records
        .filter((r) => r.id === record.id)
        .sort((a, b) => b.version - a.version),
    [records, record.id],
  );

  const edit = canEdit(record, user);
  const submit = canSubmit(record, user);
  const pickUp = canStartReview(record, user);
  const decide = canDecide(record, user);
  const amend = canAmend(record, user);
  const openFlags = record.flags.filter((f) => !f.resolved).length;
  const reviewing = record.state === "in_review" && decide.allowed;

  function update(next: FundRecord) {
    setRecords((prev) =>
      prev.map((r) => (r.versionId === next.versionId ? next : r)),
    );
  }

  function act(next: FundRecord, message: string) {
    update(next);
    setNotice(message);
  }

  function commitImport(
    entries: { fieldId: string; value: string }[],
    extras: { fieldId: string; value: string }[][],
  ) {
    const next = applyImport(record, entries, user);
    const highest = Math.max(...records.map((r) => Number(r.id.slice(-4))));
    const drafts = extras.map((rowEntries, i) =>
      applyImport(
        blankRecord(`FC-2026-${String(highest + i + 1).padStart(4, "0")}`, user.id),
        rowEntries,
        user,
      ),
    );
    setRecords((prev) => [
      ...prev.map((r) => (r.versionId === next.versionId ? next : r)),
      ...drafts,
    ]);
    setImportOpen(false);
    setNotice(
      `${entries.length} fields written from the import${
        drafts.length ? ` · ${drafts.length} further draft${drafts.length === 1 ? "" : "s"} raised` : ""
      }. Imported values are validated the same way typed ones are.`,
    );
  }

  const sectionsToShow = showAll ? SECTIONS.map((s) => s.id) : [openSection];
  // The queue is a view of the whole book of work, not of this record, so it
  // takes the full surface rather than sitting inside the record's chrome.
  const inQueue = view === "queue";

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-50 text-neutral-900">
      <header className="shrink-0 border-b border-neutral-200 bg-white">
        {/* Left padding clears the app shell's floating Home pill. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-4 pl-36">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-neutral-400 uppercase">
                Audit Trail Client Onboarding
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-[1px] text-[10px] font-medium tracking-wide uppercase ${STATE_PILL[record.state]}`}
              >
                {stateLabel(record.state)}
              </span>
            </div>
            <h1 className="mt-1 flex items-baseline gap-2 text-lg font-semibold tracking-tight">
              <span className="font-mono">{record.id}</span>
              <span className="text-neutral-400">v{record.version}</span>
              <span className="truncate text-neutral-700">{record.label}</span>
            </h1>
            {record.supersedes && (
              <p className="text-[11px] text-neutral-500">
                Amends {record.supersedes} — the approved version stays on record,
                untouched.
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex border border-neutral-300">
              {(["record", "queue"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    view === v ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"
                  }`}
                >
                  {v === "record" ? "Record" : "Reviewer queue"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Acting as
              <select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setNotice(null);
                }}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
              >
                {USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.roles.join(" + ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {inQueue ? (
          <div className="px-6 py-3 text-xs text-neutral-500">
            Everything in flight across the desk. Open a record to work on it.
          </div>
        ) : (
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-3">
          <ProgressHeader summary={summary} />
          <div className="flex flex-wrap items-center gap-2">
            {(record.state === "draft" || record.state === "amendment") && (
              <>
                <button
                  type="button"
                  disabled={!edit.allowed}
                  title={edit.reason}
                  onClick={() => setImportOpen(true)}
                  className="rounded-md border border-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-white"
                >
                  Import from Excel
                </button>
                <button
                  type="button"
                  disabled={!edit.allowed || draftBlockers.length > 0}
                  title={
                    draftBlockers.length
                      ? `Draft needs ${draftBlockers.map((f) => f.label).join(" and ")}`
                      : edit.reason
                  }
                  onClick={() =>
                    setNotice(
                      `Draft saved at ${formatStamp(record.updatedAt)} — nothing else is required to come back to it.`,
                    )
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
                      "Submitted. The record is locked until a reviewer picks it up.",
                    )
                  }
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                >
                  Submit for review
                </button>
              </>
            )}

            {record.state === "submitted" && (
              <button
                type="button"
                disabled={!pickUp.allowed}
                title={pickUp.reason}
                onClick={() =>
                  act(startReview(record, user), `${user.name} is now reviewing this version.`)
                }
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
              >
                Start review
              </button>
            )}

            {record.state === "in_review" && (
              <>
                <button
                  type="button"
                  disabled={!decide.allowed || openFlags === 0}
                  title={
                    openFlags === 0
                      ? "Reject at least one field first — a rejection points at the field it is about."
                      : decide.reason
                  }
                  onClick={() =>
                    act(
                      returnToSubmitter(record, user),
                      `Returned to ${userName(record.submittedBy)} with ${openFlags} flagged field${openFlags === 1 ? "" : "s"}.`,
                    )
                  }
                  className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:border-neutral-200 disabled:text-neutral-400"
                >
                  Return with {openFlags} flag{openFlags === 1 ? "" : "s"}
                </button>
                <button
                  type="button"
                  disabled={!decide.allowed || openFlags > 0}
                  title={
                    openFlags > 0
                      ? "Withdraw the open flags or return the record — an approval cannot sit on top of them."
                      : decide.reason
                  }
                  onClick={() => act(approveRecord(record, user), "Approved and locked.")}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                >
                  Approve
                </button>
              </>
            )}

            {record.state === "approved" && (
              <button
                type="button"
                disabled={!amend.allowed}
                title={amend.reason}
                onClick={() => setAmendOpen(true)}
                className="rounded-md border border-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:border-neutral-200 disabled:text-neutral-400"
              >
                Request amendment
              </button>
            )}
          </div>
        </div>
        )}

        {(notice || (!edit.allowed && !inQueue)) && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-2 text-xs text-neutral-600">
            {notice ?? edit.reason}
            {notice && (
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="ml-3 text-[11px] text-neutral-400 underline underline-offset-2"
              >
                dismiss
              </button>
            )}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {!inQueue && (
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-neutral-100/70 lg:flex">
          <div className="px-3 py-3">
            <p className="px-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              Sections
            </p>
          </div>
          <StatusRail
            items={rail}
            activeId={openSection}
            onSelect={(id) => {
              setOpenSection(id);
              setShowAll(false);
              setView("record");
            }}
          />

          <div className="mt-4 border-t border-neutral-200 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              Workflow
            </p>
            <ol className="mt-2 flex flex-col gap-1.5">
              {STATE_FLOW.map((s) => {
                const current = record.state === s;
                const passed = STATE_FLOW.indexOf(record.state) > STATE_FLOW.indexOf(s);
                return (
                  <li key={s} className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        current ? "bg-neutral-900" : passed ? "bg-neutral-400" : "bg-neutral-300"
                      }`}
                    />
                    <span className={current ? "font-semibold text-neutral-900" : "text-neutral-500"}>
                      {stateLabel(s)}
                    </span>
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
              <dd className="text-neutral-700">
                {record.reviewerId ? userName(record.reviewerId) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-0.5">
              <dt className="text-neutral-400">Last change</dt>
              <dd className="text-neutral-700">{ageLabel(record.updatedAt)} ago</dd>
            </div>
          </dl>

          <div className="border-t border-neutral-200 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              Two-tier validation
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
              <span className="font-medium text-neutral-800">Draft-valid</span> —{" "}
              {draftBlockers.length === 0
                ? "met, so this can be saved and picked up later."
                : `needs ${draftBlockers.map((f) => f.label).join(" and ")}.`}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-neutral-600">
              <span className="font-medium text-neutral-800">Submit-valid</span> —{" "}
              {summary.missing + summary.errors === 0
                ? "met."
                : `${summary.missing} outstanding, ${summary.errors} in error.`}
            </p>
            <p className="mt-1.5 text-[10px] text-neutral-400">
              Currently validating at the {draftStage} tier.
            </p>
          </div>
        </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {inQueue ? (
            <ReviewerQueue
              records={records}
              currentUser={user}
              activeId={record.versionId}
              onOpen={(versionId) => {
                setActiveId(versionId);
                setView("record");
                setNotice(null);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  {showAll
                    ? "All sections open — use this to cross-reference values while filling in."
                    : "One section at a time. Completed sections stay on the page as a summary row."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  title="Open question in the spec: do users need several sections open at once to cross-reference? This toggle is here to test that with real users."
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  {showAll ? "One section at a time" : "Open all sections"}
                </button>
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
                      return (
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
                          canFlag={reviewing}
                          onChange={(value) =>
                            update(setField(record, field.id, value, user))
                          }
                          onFlag={(note) =>
                            act(
                              flagField(record, field.id, note, user),
                              `${field.label} rejected — the note travels with the field, not the record.`,
                            )
                          }
                          onClearFlag={() =>
                            act(clearFlag(record, field.id, user), `Flag withdrawn from ${field.label}.`)
                          }
                        />
                      );
                    })}
                  </SectionCard>
                );
              })}
            </div>
          )}
        </main>

        {!inQueue && (
        <aside className="hidden w-80 shrink-0 xl:block">
          <ActivityPanel
            record={record}
            versions={versions}
            onOpenVersion={(versionId) => {
              setActiveId(versionId);
              setView("record");
            }}
          />
        </aside>
        )}
      </div>

      <ImportWizard
        open={importOpen}
        baseValues={record.values}
        onClose={() => setImportOpen(false)}
        onCommit={commitImport}
      />

      <Modal
        open={amendOpen}
        onClose={() => setAmendOpen(false)}
        title="Request an amendment"
        description="An approved record is never edited. This raises a new version, linked to the approved one, and sends it back through the same review."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAmendOpen(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={amendReason.trim() === ""}
              onClick={() => {
                const amended = beginAmendment(record, user, amendReason.trim());
                setRecords((prev) => [...prev, amended]);
                setActiveId(amended.versionId);
                setAmendOpen(false);
                setAmendReason("");
                setNotice(
                  `v${amended.version} raised as an amendment of ${amended.supersedes}. The approved version is unchanged.`,
                );
              }}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
            >
              Raise amendment
            </button>
          </div>
        }
      >
        <label className="flex flex-col gap-1.5 text-xs text-neutral-600">
          Why does this record need to change?
          <textarea
            value={amendReason}
            onChange={(e) => setAmendReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-neutral-300 px-2.5 py-2 text-sm text-neutral-800"
            placeholder="e.g. Custodian moved to the Dublin entity from 20 August."
          />
        </label>
      </Modal>
    </div>
  );
}
