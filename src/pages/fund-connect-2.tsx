import { useMemo, useState } from "react";
import Modal, { ConfirmDialog } from "../components/patterns/Modal";
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
  canDiscard,
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
  FIELDS,
  PROVIDERS,
  REGIONS,
  SECTIONS,
  derivedFor,
  fieldsInSection,
  summariseSection,
} from "../lib/fundConnect2/schema";
import type { StripMetric } from "../components/fund-connect2/StatusStrip";
import type { Permission } from "../lib/fundConnect/types";
import { slaTone, toneFor } from "../lib/fundConnect/tone";
import { REVIEW_SLA, SEED_NOTICES, SEED_RECORDS } from "../lib/fundConnect2/seed";
import { STATE_DOT, STATE_PILL } from "../lib/fundConnect2/tone";
import type { FundRecord2, Notice, RecordState2 } from "../lib/fundConnect2/types";

export const title = "Fund Connect 2";
export const section = "forms";
export const fullWidth = true;

/* Fund Connect 2 — the primary-market ETF register, with the creation flow
 * (upload → validate → review → approve → activate) hanging off it.
 *
 * The top level is one grid: every ETF the desk runs, live and in-flight,
 * one row each. Lifecycle state is a column, not a page — the work strip
 * above the grid says what needs *your* attention and doubles as a filter.
 * "Create new" enters the upload wizard; a row opens the record editor with
 * the reject-with-comments loop, delta review and the audit trail.
 */

const STATE_FLOW: RecordState2[] = ["draft", "submitted", "in_review", "approved", "active"];

/** Grid status — pipeline state, with returned drafts called out. */
type GridStatus = RecordState2 | "returned";

const STATUS_LABEL: Record<GridStatus, string> = {
  draft: "Draft",
  returned: "Returned",
  submitted: "Submitted",
  in_review: "In review",
  approved: "Scheduled",
  active: "Active",
};

function isReturned(r: FundRecord2): boolean {
  return (
    r.state === "draft" &&
    (r.flags.some((f) => !f.resolved) ||
      r.comments.some((c) => c.kind === "reject" && c.cycle === r.cycle))
  );
}

function gridStatus(r: FundRecord2): GridStatus {
  return isReturned(r) ? "returned" : r.state;
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

function StatusPill({ status }: { status: GridStatus }) {
  if (status === "returned") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 px-2 py-[1px] text-[10px] font-medium tracking-wide text-amber-900 uppercase">
        <span className="h-1 w-1 rounded-full bg-amber-500" aria-hidden />
        Returned
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-2 py-[1px] text-[10px] font-medium tracking-wide text-white uppercase">
        <span className="h-1 w-1 rounded-full bg-white" aria-hidden />
        Scheduled
      </span>
    );
  }
  return <Pill state={status} />;
}

const PAGE_SIZE = 50;

export default function FundConnect2Page() {
  const [records, setRecords] = useState<FundRecord2[]>(SEED_RECORDS);
  const [notices, setNotices] = useState<Notice[]>(SEED_NOTICES);
  const [userId, setUserId] = useState("p.raman");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [openSection, setOpenSection] = useState("identity");
  const [showAll, setShowAll] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(DEMO_TODAY);
  const [approveText, setApproveText] = useState("");
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* Grid controls */
  const [q, setQ] = useState("");
  const [regionF, setRegionF] = useState("");
  const [providerF, setProviderF] = useState("");
  const [statusF, setStatusF] = useState<GridStatus | "">("");
  const [workFilter, setWorkFilter] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const user = userById(userId) ?? USERS[0];
  const record = openId ? (records.find((r) => r.id === openId) ?? null) : null;
  const myNotices = notices
    .filter((n) => n.userId === user.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  function update(next: FundRecord2) {
    setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }

  function act(result: ActionResult, message: string) {
    update(result.record);
    if (result.notices.length) setNotices((prev) => [...prev, ...result.notices]);
    setToast(message);
  }

  function openRecord(id: string) {
    if (!records.some((r) => r.id === id)) return;
    setOpenId(id);
    setOpenSection("identity");
    setShowAll(false);
    setHighlight(null);
    setToast(null);
  }

  function nextFundNumber(): string {
    const highest = records.reduce(
      (max, r) => Math.max(max, Number(r.values.fundNumber) || 0),
      4000,
    );
    return String(highest + 1);
  }

  function nextId(offset = 1): string {
    const highest = records.reduce((max, r) => Math.max(max, Number(r.id.slice(-4)) || 0), 0);
    return `FC2-${String(highest + offset).padStart(4, "0")}`;
  }

  function commitUpload(drafts: WizardDraft[]) {
    const startNumber = Number(nextFundNumber());
    const created = drafts.map((d, i) => {
      let rec = applyImport(blankRecord(nextId(i + 1), d.title, user.id), d.entries, user);
      // House fund number is assigned, not uploaded.
      if (!rec.values.fundNumber) {
        rec = setField(rec, "fundNumber", String(startNumber + i), user, "system");
      }
      return rec;
    });
    setRecords((prev) => [...prev, ...created]);
    setWizardOpen(false);
    setOpenId(created.length === 1 ? created[0].id : null);
    if (created.length > 1) setStatusF("draft");
    const withErrors = drafts.filter((d) => d.errors > 0).length;
    setToast(
      `${created.length} draft${created.length === 1 ? "" : "s"} created from the upload${
        withErrors ? ` — ${withErrors} still ${withErrors === 1 ? "has" : "have"} fields to fix before submitting` : ""
      }. Nothing was retyped.`,
    );
  }

  function discardRecord(id: string) {
    const target = records.find((r) => r.id === id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setNotices((prev) => prev.filter((n) => n.recordId !== id));
    setDiscardId(null);
    if (openId === id) setOpenId(null);
    setToast(`Draft ${target ? `"${target.title}"` : id} discarded.`);
  }

  function createBlank() {
    let rec = blankRecord(nextId(), "New ETF setup", user.id);
    rec = setField(rec, "fundNumber", nextFundNumber(), user, "system");
    setRecords((prev) => [...prev, rec]);
    setWizardOpen(false);
    setOpenId(rec.id);
    setToast("Blank draft raised — the fund number is already assigned.");
  }

  /* ----- work strip cards ----- */

  type WorkCard = {
    id: string;
    label: string;
    count: number;
    detail: string;
    urgent: boolean;
    match: (r: FundRecord2) => boolean;
  };

  const cards: WorkCard[] = useMemo(() => {
    const out: WorkCard[] = [];
    if (user.roles.includes("submitter")) {
      const mine = records.filter((r) => r.state === "draft" && r.createdBy === user.id);
      const ready = mine.filter((r) => canSubmit(r, user).allowed).length;
      out.push({
        id: "my-drafts",
        label: "My drafts",
        count: mine.length,
        detail: ready > 0 ? `${ready} ready to submit` : "none ready to submit yet",
        urgent: false,
        match: (r) => r.state === "draft" && r.createdBy === user.id,
      });
      const returned = records.filter(
        (r) => isReturned(r) && (r.submittedBy === user.id || r.createdBy === user.id),
      );
      out.push({
        id: "returned",
        label: "Returned to me",
        count: returned.length,
        detail: returned[0]
          ? `${returned[0].values.ticker || returned[0].id}: fix & resubmit`
          : "nothing waiting on you",
        urgent: returned.length > 0,
        match: (r) => isReturned(r) && (r.submittedBy === user.id || r.createdBy === user.id),
      });
    }
    if (user.roles.includes("approver")) {
      const waiting = records.filter((r) => canStartReview(r, user).allowed);
      const oldest = waiting.reduce<FundRecord2 | null>(
        (acc, r) =>
          !acc || Date.parse(r.submittedAt ?? r.updatedAt) < Date.parse(acc.submittedAt ?? acc.updatedAt)
            ? r
            : acc,
        null,
      );
      out.push({
        id: "awaiting",
        label: "Awaiting my review",
        count: waiting.length,
        detail: oldest
          ? `oldest waiting ${ageLabel(oldest.submittedAt ?? oldest.updatedAt)}`
          : "queue is clear",
        urgent: waiting.length > 0,
        match: (r) => canStartReview(r, user).allowed,
      });
      const reviewing = records.filter(
        (r) => r.state === "in_review" && r.reviewerId === user.id,
      );
      out.push({
        id: "reviewing",
        label: "In my review",
        count: reviewing.length,
        detail: reviewing[0]
          ? `${reviewing[0].values.ticker || reviewing[0].id} · cycle ${reviewing[0].cycle}`
          : "nothing picked up",
        urgent: false,
        match: (r) => r.state === "in_review" && r.reviewerId === user.id,
      });
      const toActivate = records.filter((r) => r.state === "approved");
      out.push({
        id: "to-activate",
        label: "Scheduled",
        count: toActivate.length,
        detail: toActivate[0]?.effectiveDate
          ? `next: ${toActivate[0].values.ticker || toActivate[0].id} eff. ${formatDay(toActivate[0].effectiveDate)}`
          : "nothing scheduled",
        urgent: false,
        match: (r) => r.state === "approved",
      });
    }
    if (!user.roles.includes("approver")) {
      const scheduled = records.filter((r) => r.state === "approved" && r.submittedBy === user.id);
      out.push({
        id: "scheduled",
        label: "Scheduled",
        count: scheduled.length,
        detail: scheduled[0]?.effectiveDate
          ? `next eff. ${formatDay(scheduled[0].effectiveDate)}`
          : "nothing scheduled",
        urgent: false,
        match: (r) => r.state === "approved" && r.submittedBy === user.id,
      });
    }
    return out;
  }, [records, user]);

  const activeCard = cards.find((c) => c.id === workFilter) ?? null;

  /* ----- grid rows ----- */

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = (r: FundRecord2) => {
      if (activeCard && !activeCard.match(r)) return false;
      if (regionF && (r.values.region ?? "") !== regionF) return false;
      if (providerF && (r.values.provider ?? "") !== providerF) return false;
      if (statusF && gridStatus(r) !== statusF) return false;
      if (needle) {
        const hay = [
          r.values.fundLongName,
          r.values.fundShortName,
          r.values.ticker,
          r.values.fundCode,
          r.values.fundNumber,
          r.title,
          r.id,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    };
    const actionRank = (r: FundRecord2) =>
      (isReturned(r) && (r.submittedBy === user.id || r.createdBy === user.id)) ||
      canStartReview(r, user).allowed ||
      canDecide(r, user).allowed ||
      canActivate(r, user).allowed
        ? 0
        : r.state === "active"
          ? 2
          : 1;
    return records
      .filter(matches)
      .sort(
        (a, b) =>
          actionRank(a) - actionRank(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      );
  }, [records, q, regionF, providerF, statusF, activeCard, user]);

  function rowAction(r: FundRecord2): { label: string; urgent: boolean } {
    if (isReturned(r) && canEdit(r, user).allowed) return { label: "Fix & resubmit", urgent: true };
    if (r.state === "draft" && canEdit(r, user).allowed) return { label: "Edit", urgent: false };
    if (canStartReview(r, user).allowed) return { label: "Review", urgent: true };
    if (r.state === "in_review" && canDecide(r, user).allowed) return { label: "Review", urgent: true };
    if (canActivate(r, user).allowed) return { label: "Activate", urgent: false };
    return { label: "View", urgent: false };
  }

  function exportCsv() {
    const head = [
      "Region",
      "Provider",
      "Fund long name",
      "Fund short name",
      "Fund code",
      "Fund number",
      "Ticker",
      "Trust",
      "Status",
    ];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      head.join(","),
      ...rows.map((r) =>
        [
          r.values.region ?? "",
          r.values.provider ?? "",
          r.values.fundLongName || r.title,
          r.values.fundShortName ?? "",
          r.values.fundCode ?? "",
          r.values.fundNumber ?? "",
          r.values.ticker ?? "",
          r.values.trust ?? "",
          STATUS_LABEL[gridStatus(r)],
        ]
          .map(esc)
          .join(","),
      ),
    ];
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
    a.download = "primary-market-etfs.csv";
    a.click();
    setToast(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} — exactly what the grid is showing.`);
  }

  /* ----- derived state for the open record ----- */

  const summary = useMemo(() => (record ? summarise(record, "submit") : null), [record]);
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

  const sectionsToShow = showAll ? SECTIONS.map((s) => s.id) : [openSection];

  /* ----- strip-chip jump: open the section(s) and land on the fields ----- */

  const [highlight, setHighlight] = useState<{ ids: string[]; cls: string } | null>(null);

  function jumpToMetric(metric: StripMetric) {
    if (!record) return;
    const matches = FIELDS.filter((f) => {
      const st = fieldState(record, f.id, "submit");
      switch (metric) {
        case "missing":
          return st.missing;
        case "errors":
          return st.issue?.level === "error";
        case "flags":
          return st.flag !== null;
        case "imported":
          return st.source === "imported";
        case "modified":
          return st.source === "modified";
      }
    });
    if (matches.length === 0) return;
    // One affected section opens alone; several open side by side so every
    // highlighted field is actually on the page.
    const sections = new Set(matches.map((f) => f.sectionId));
    if (sections.size > 1) {
      setShowAll(true);
    } else {
      setShowAll(false);
      setOpenSection(matches[0].sectionId);
    }
    setHighlight({
      ids: matches.map((f) => f.id),
      cls:
        metric === "errors"
          ? "ring-2 ring-red-400"
          : metric === "imported"
            ? "ring-2 ring-blue-400"
            : "ring-2 ring-amber-400",
    });
    window.setTimeout(() => {
      document
        .getElementById(`fc2-field-${matches[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => setHighlight(null), 3500);
  }

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
                  ← All ETFs
                </button>
                <span className="font-mono text-sm text-neutral-500">
                  {record.values.ticker || record.id}
                </span>
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
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Primary market ETFs</h1>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Acting as
              <select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setWorkFilter(null);
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

        {/* Second row — work strip on the grid, status + actions on a record. */}
        {!record ? (
          <div className="flex flex-wrap items-stretch gap-2 px-6 pb-3 pl-36">
            {/* "All ETFs" is the strip's home state — always visible, so
                getting back to the full register is one obvious click. */}
            <button
              type="button"
              onClick={() => setWorkFilter(null)}
              aria-pressed={workFilter === null}
              title="Show the full register"
              className={`flex min-w-28 flex-col justify-center gap-0.5 border px-3 py-2 text-left ${
                workFilter === null
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white shadow-sm hover:border-neutral-400"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`text-base leading-none font-semibold tabular-nums ${
                    workFilter === null ? "text-white" : "text-neutral-900"
                  }`}
                >
                  {records.length}
                </span>
                <span
                  className={`text-[10px] font-medium tracking-[0.12em] uppercase ${
                    workFilter === null ? "text-neutral-300" : "text-neutral-400"
                  }`}
                >
                  All ETFs
                </span>
              </span>
              <span className={`text-[10px] ${workFilter === null ? "text-neutral-300" : "text-neutral-500"}`}>
                the full register
              </span>
            </button>
            {cards.map((c) => {
              const selected = workFilter === c.id;
              const idle = c.count === 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setWorkFilter(selected ? null : c.id);
                    setVisible(PAGE_SIZE);
                  }}
                  aria-pressed={selected}
                  title="Click to filter the grid to these records"
                  className={`flex min-w-40 flex-col gap-0.5 border px-3 py-2 text-left ${
                    selected
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : idle
                        ? "border-neutral-200 bg-white"
                        : "border-neutral-300 bg-white shadow-sm hover:border-neutral-400"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selected
                          ? "bg-white"
                          : idle
                            ? "bg-neutral-200"
                            : c.urgent
                              ? "animate-pulse bg-red-500"
                              : "bg-blue-400"
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`text-base leading-none font-semibold tabular-nums ${
                        selected ? "text-white" : idle ? "text-neutral-300" : "text-neutral-900"
                      }`}
                    >
                      {c.count}
                    </span>
                    <span
                      className={`text-[10px] font-medium tracking-[0.12em] uppercase ${
                        selected ? "text-neutral-300" : "text-neutral-400"
                      }`}
                    >
                      {c.label}
                    </span>
                  </span>
                  <span className={`text-[10px] ${selected ? "text-neutral-300" : idle ? "text-neutral-300" : "text-neutral-500"}`}>
                    {c.detail}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-3 pl-36">
            {summary && <StatusStrip summary={summary} onJump={jumpToMetric} />}
            <div className="flex flex-wrap items-center gap-2">
              {record.state === "draft" && (
                <>
                  <button
                    type="button"
                    disabled={!canDiscard(record, user).allowed}
                    title={canDiscard(record, user).reason ?? "Delete this draft permanently"}
                    onClick={() => setDiscardId(record.id)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:border-red-400 hover:bg-red-50/40 disabled:border-neutral-200 disabled:text-neutral-400"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    disabled={!edit.allowed}
                    title={edit.reason}
                    onClick={() =>
                      setToast(`Draft saved at ${formatStamp(record.updatedAt)} — pick it up any time from the grid.`)
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
                  onClick={() => act(activateNow(record, user), "Activated — the ETF is now in force.")}
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

      {/* ================= The register grid ================= */}
      {!record && (
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search name, ticker, code, number…"
              aria-label="Search ETFs"
              className="w-64 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-800"
            />
            {(
              [
                ["Region", regionF, setRegionF, REGIONS],
                ["Provider", providerF, setProviderF, PROVIDERS],
              ] as [string, string, (v: string) => void, string[]][]
            ).map(([label, value, set, options]) => (
              <select
                key={label}
                value={value}
                onChange={(e) => {
                  set(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                aria-label={`Filter by ${label}`}
                className={`rounded-md border bg-white px-2 py-1.5 text-xs ${
                  value ? "border-neutral-900 text-neutral-900" : "border-neutral-300 text-neutral-600"
                }`}
              >
                <option value="">{label} — all</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ))}
            <select
              value={statusF}
              onChange={(e) => {
                setStatusF(e.target.value as GridStatus | "");
                setVisible(PAGE_SIZE);
              }}
              aria-label="Filter by status"
              className={`rounded-md border bg-white px-2 py-1.5 text-xs ${
                statusF ? "border-neutral-900 text-neutral-900" : "border-neutral-300 text-neutral-600"
              }`}
            >
              <option value="">Status — all</option>
              {(Object.keys(STATUS_LABEL) as GridStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {(q || regionF || providerF || statusF || workFilter) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setRegionF("");
                  setProviderF("");
                  setStatusF("");
                  setWorkFilter(null);
                  setVisible(PAGE_SIZE);
                }}
                title="Clear every filter and show the full register"
                className="rounded-md border border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
              >
                ✕ Show all ({records.length})
              </button>
            )}
            <span className="ml-auto text-[11px] text-neutral-500 tabular-nums">
              {rows.length} of {records.length}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              ⬇ Export CSV
            </button>
            <button
              type="button"
              disabled={!user.roles.includes("submitter")}
              title={
                user.roles.includes("submitter") ? undefined : `${user.name} holds approver rights only.`
              }
              onClick={() => setWizardOpen(true)}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
            >
              + Create new
            </button>
          </div>

          {/* Grid */}
          <section className="border border-neutral-200 bg-neutral-50">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-[10px] tracking-wide text-neutral-500 uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Fund long name</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">Short name</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Fund code</th>
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Ticker</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">Trust</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-neutral-500">
                      Nothing matches — clear a filter, or create a new ETF.
                    </td>
                  </tr>
                )}
                {rows.slice(0, visible).map((r) => {
                  const action = rowAction(r);
                  const status = gridStatus(r);
                  const waiting =
                    (r.state === "submitted" || r.state === "in_review") && r.submittedAt
                      ? toneFor(slaTone(ageMinutes(r.submittedAt), REVIEW_SLA), "muted")
                      : null;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openRecord(r.id)}
                      className="cursor-pointer hover:bg-white"
                    >
                      <td className="px-3 py-2 text-neutral-600">{r.values.region || "—"}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.values.provider || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-neutral-900">
                          {r.values.fundLongName || r.title}
                        </span>
                        {waiting && (
                          <span className={`ml-2 text-[10px] tabular-nums ${waiting.text}`}>
                            waiting {ageLabel(r.submittedAt!)}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-neutral-600 xl:table-cell">
                        {r.values.fundShortName || "—"}
                      </td>
                      <td className="hidden px-3 py-2 font-mono text-[11px] text-neutral-600 lg:table-cell">
                        {r.values.fundCode || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-neutral-600">
                        {r.values.fundNumber || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] font-semibold text-neutral-900">
                        {r.values.ticker || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-neutral-600 xl:table-cell">
                        {r.values.trust || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRecord(r.id);
                            }}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                              action.urgent
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                            }`}
                          >
                            {action.label}
                          </button>
                          {canDiscard(r, user).allowed && (
                            <button
                              type="button"
                              aria-label={`Discard draft ${r.values.ticker || r.id}`}
                              title="Discard this draft"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiscardId(r.id);
                              }}
                              className="rounded-md border border-neutral-300 bg-white p-1 text-neutral-400 hover:border-red-400 hover:text-red-700"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                                <path
                                  fillRule="evenodd"
                                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482 41.03 41.03 0 0 0-2.365-.298V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > visible && (
              <div className="border-t border-neutral-200 bg-white px-4 py-2.5 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="text-xs font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                >
                  Show {Math.min(PAGE_SIZE, rows.length - visible)} more of {rows.length - visible}
                </button>
              </div>
            )}
          </section>
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
                              setOpenSection(FIELD_BY_ID[f.fieldId]?.sectionId ?? "identity");
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
                            setOpenSection(FIELD_BY_ID[d.fieldId]?.sectionId ?? "identity");
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
                      const flash =
                        highlight && highlight.ids.includes(field.id) ? highlight.cls : "";
                      const row = (
                        <FieldRow
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
                      const deltaOn = Boolean(changed && showDelta);
                      return (
                        <div
                          key={field.id}
                          id={`fc2-field-${field.id}`}
                          className={`transition-shadow duration-500 ${
                            deltaOn ? "border-l-2 border-blue-400 bg-blue-50/30" : ""
                          } ${flash}`}
                        >
                          {deltaOn && (
                            <p className="flex flex-wrap items-center gap-2 px-4 pt-2 text-[10px]">
                              <span className="rounded-full bg-blue-100 px-1.5 font-medium tracking-wide text-blue-800 uppercase">
                                Changed this cycle
                              </span>
                              <span className="font-mono text-neutral-500">
                                was <span className="line-through">{changed!.from || "empty"}</span>
                              </span>
                            </p>
                          )}
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

      <UploadWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCommit={commitUpload}
        onBlank={createBlank}
      />

      {/* Discard a draft — destructive, so it always confirms. */}
      <ConfirmDialog
        open={discardId !== null}
        onClose={() => setDiscardId(null)}
        onConfirm={() => discardId && discardRecord(discardId)}
        title="Discard this draft?"
        description={`${records.find((r) => r.id === discardId)?.title ?? discardId ?? ""} — the draft and its history are deleted permanently. Submitted or approved records can never be discarded.`}
        confirmLabel="Discard draft"
        destructive
      />

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
                      ? "Approved and activated — the ETF is in force."
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
                  ? `The record shows as Scheduled until ${formatDay(effectiveDate)}, and can be activated early from the grid.`
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
