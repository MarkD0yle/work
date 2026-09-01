/* Fund Connect 2 — state machine, permissions, audit, notices.
 *
 * Pure functions throughout, as in the Fund Connect engine. The differences:
 *
 *   - transitions that someone should hear about return { record, notices }
 *     instead of a bare record — notices live outside the record, so the
 *     engine hands them back rather than hiding them
 *   - submit snapshots the values (delta review needs "what the reviewer
 *     saw last time", and a snapshot beats reconstructing it from audit)
 *   - approve takes an effective date; on/before the demo today it also
 *     activates in the same action
 *
 * Segregation of duties is unchanged and applies to Admin too: holding both
 * roles never lets the same account submit and approve one submission.
 */

import type {
  AuditEntry,
  FieldDelta,
  FieldFlag,
  FieldSource,
  FundRecord2,
  Notice,
  NoticeKind,
  RecordComment,
  RecordState2,
  User,
} from "./types";
import type { Permission, SectionStatus } from "../fundConnect/types";
import {
  FIELD_BY_ID,
  FIELDS,
  fieldsInSection,
  isEmpty,
  isMissing,
  validateValue,
  type ValidationStage,
} from "./schema";

export const USERS: User[] = [
  {
    id: "p.raman",
    name: "Priya Raman",
    initials: "PR",
    desk: "Fund Services · Dealing",
    roles: ["submitter"],
  },
  {
    id: "d.osei",
    name: "Daniel Osei",
    initials: "DO",
    desk: "Fund Services · Oversight",
    roles: ["approver"],
  },
  {
    id: "s.mercer",
    name: "Sofia Mercer",
    initials: "SM",
    desk: "Fund Services · Admin",
    roles: ["submitter", "approver"],
  },
];

export function userById(id: string | null): User | null {
  if (!id) return null;
  return USERS.find((u) => u.id === id) ?? null;
}

export function userName(id: string | null): string {
  return userById(id)?.name ?? "—";
}

/** "Submitter" / "Approver" / "Admin" — Admin is simply both roles. */
export function roleLabel(user: User): string {
  if (user.roles.includes("submitter") && user.roles.includes("approver")) return "Admin";
  return user.roles.includes("approver") ? "Approver" : "Submitter";
}

/* ------------------------------------------------------------------ *
 * Demo clock — same device as Fund Connect, own ticker.
 * ------------------------------------------------------------------ */

export const DEMO_NOW = "2026-08-25T09:15:00.000Z";
/** Effective dates on or before this day activate immediately. */
export const DEMO_TODAY = DEMO_NOW.slice(0, 10);
let tick = 0;

export function nowIso(): string {
  tick += 1;
  return new Date(Date.parse(DEMO_NOW) + tick * 60_000).toISOString();
}

let auditSeq = 0;
function auditId(): string {
  auditSeq += 1;
  return `B${String(auditSeq).padStart(4, "0")}`;
}

let commentSeq = 0;
function commentId(): string {
  commentSeq += 1;
  return `C${String(commentSeq).padStart(4, "0")}`;
}

let noticeSeq = 0;
function noticeId(): string {
  noticeSeq += 1;
  return `N${String(noticeSeq).padStart(4, "0")}`;
}

export function formatStamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ageLabel(iso: string, from: string = DEMO_NOW): string {
  const mins = Math.max(0, Math.round((Date.parse(from) - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

export function ageMinutes(iso: string, from: string = DEMO_NOW): number {
  return Math.max(0, Math.round((Date.parse(from) - Date.parse(iso)) / 60_000));
}

/* ------------------------------------------------------------------ *
 * Field writes — identical rules to Fund Connect.
 * ------------------------------------------------------------------ */

function nextSource(previous: FieldSource | undefined, via: AuditEntry["via"]): FieldSource {
  if (via === "import") return "imported";
  if (previous === "imported" || previous === "modified") return "modified";
  return "manual";
}

function withAudit(rec: FundRecord2, entry: AuditEntry): FundRecord2 {
  return { ...rec, audit: [entry, ...rec.audit], updatedAt: entry.at };
}

export function setField(
  rec: FundRecord2,
  fieldId: string,
  value: string,
  actor: User,
  via: AuditEntry["via"] = "manual",
): FundRecord2 {
  const previous = rec.values[fieldId] ?? "";
  if (previous === value) return rec;
  const at = nowIso();

  const next: FundRecord2 = {
    ...rec,
    values: { ...rec.values, [fieldId]: value },
    sources: { ...rec.sources, [fieldId]: nextSource(rec.sources[fieldId], via) },
    flags: rec.flags.map((f) =>
      f.fieldId === fieldId && !f.resolved ? { ...f, resolved: true } : f,
    ),
  };

  return withAudit(next, {
    id: auditId(),
    fieldId,
    from: previous,
    to: value,
    actor: actor.id,
    at,
    via,
  });
}

export function applyImport(
  rec: FundRecord2,
  entries: { fieldId: string; value: string }[],
  actor: User,
): FundRecord2 {
  return entries.reduce(
    (acc, e) => setField(acc, e.fieldId, e.value, actor, "import"),
    rec,
  );
}

export function setTitle(rec: FundRecord2, title: string, actor: User): FundRecord2 {
  if (rec.title === title) return rec;
  return withAudit(
    { ...rec, title },
    {
      id: auditId(),
      fieldId: null,
      from: rec.title,
      to: title,
      actor: actor.id,
      at: nowIso(),
      via: "system",
      note: "Draft renamed",
    },
  );
}

/* ------------------------------------------------------------------ *
 * Roll-ups — same shapes as Fund Connect, over the FC2 record.
 * ------------------------------------------------------------------ */

export type FieldState = {
  fieldId: string;
  missing: boolean;
  issue: ReturnType<typeof validateValue>;
  flag: FieldFlag | null;
  source: FieldSource | null;
};

export function fieldState(
  rec: FundRecord2,
  fieldId: string,
  stage: ValidationStage,
): FieldState {
  const field = FIELD_BY_ID[fieldId];
  return {
    fieldId,
    missing: isMissing(field, rec.values, stage),
    issue: validateValue(field, rec.values),
    flag: rec.flags.find((f) => f.fieldId === fieldId && !f.resolved) ?? null,
    source: rec.sources[fieldId] ?? null,
  };
}

export function sectionStatus(
  rec: FundRecord2,
  sectionId: string,
  stage: ValidationStage,
): SectionStatus {
  const fields = fieldsInSection(sectionId);
  const states = fields.map((f) => fieldState(rec, f.id, stage));
  if (states.some((s) => s.issue?.level === "error" || s.flag)) return "error";
  const filled = fields.filter((f) => !isEmpty(rec.values[f.id]));
  if (filled.length === 0) return "not_started";
  if (states.some((s) => s.missing)) return "in_progress";
  return "complete";
}

export type RecordSummary = {
  sectionsComplete: number;
  sectionsTotal: number;
  errors: number;
  warnings: number;
  missing: number;
  flags: number;
  imported: number;
  modified: number;
};

export function summarise(rec: FundRecord2, stage: ValidationStage): RecordSummary {
  const states = FIELDS.map((f) => fieldState(rec, f.id, stage));
  const sections = new Set(FIELDS.map((f) => f.sectionId));
  return {
    sectionsComplete: [...sections].filter(
      (s) => sectionStatus(rec, s, stage) === "complete",
    ).length,
    sectionsTotal: sections.size,
    errors: states.filter((s) => s.issue?.level === "error").length,
    warnings: states.filter((s) => s.issue?.level === "warning").length,
    missing: states.filter((s) => s.missing).length,
    flags: states.filter((s) => s.flag).length,
    imported: states.filter((s) => s.source === "imported").length,
    modified: states.filter((s) => s.source === "modified").length,
  };
}

/* ------------------------------------------------------------------ *
 * Delta review — what changed since the reviewer last looked.
 * ------------------------------------------------------------------ */

/** Field-level diff between the two most recent submissions, or null on the
 *  first cycle (everything is new — there is nothing to diff against). */
export function changedSinceLastReview(rec: FundRecord2): FieldDelta[] | null {
  if (rec.submissions.length < 2) return null;
  const [prev, last] = rec.submissions.slice(-2);
  return FIELDS.filter((f) => (prev.values[f.id] ?? "") !== (last.values[f.id] ?? "")).map(
    (f) => ({
      fieldId: f.id,
      from: prev.values[f.id] ?? "",
      to: last.values[f.id] ?? "",
    }),
  );
}

/* ------------------------------------------------------------------ *
 * Permissions — SoD applies to everyone, Admin included.
 * ------------------------------------------------------------------ */

export function canEdit(rec: FundRecord2, user: User): Permission {
  if (rec.state === "draft") {
    if (!user.roles.includes("submitter")) {
      return { allowed: false, reason: `${user.name} holds approver rights only.` };
    }
    return { allowed: true };
  }
  // The assigned reviewer may correct values directly in the version they
  // are reviewing — every write is audited under their name, and editing a
  // flagged field resolves the flag, exactly like a submitter's fix.
  if (rec.state === "in_review") {
    if (rec.reviewerId === user.id && user.roles.includes("approver")) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `In review — only the assigned reviewer (${userName(rec.reviewerId)}) can edit values here.`,
    };
  }
  return { allowed: false, reason: `A ${stateLabel(rec.state).toLowerCase()} record is locked for editing.` };
}

export function canSubmit(rec: FundRecord2, user: User): Permission {
  if (rec.state !== "draft") {
    return { allowed: false, reason: "Only a draft can be submitted." };
  }
  const edit = canEdit(rec, user);
  if (!edit.allowed) return edit;
  const open = rec.flags.filter((f) => !f.resolved).length;
  if (open > 0) {
    return {
      allowed: false,
      reason: `${open} ${open === 1 ? "field still carries" : "fields still carry"} a reviewer's rejection — change the value, or ask the reviewer to withdraw the flag.`,
    };
  }
  const s = summarise(rec, "submit");
  if (s.errors > 0) {
    return { allowed: false, reason: `${s.errors} field${s.errors === 1 ? "" : "s"} still in error.` };
  }
  if (s.missing > 0) {
    return { allowed: false, reason: `${s.missing} required field${s.missing === 1 ? "" : "s"} outstanding.` };
  }
  return { allowed: true };
}

export function canStartReview(rec: FundRecord2, user: User): Permission {
  if (rec.state !== "submitted") {
    return { allowed: false, reason: "Only a submitted record can be picked up for review." };
  }
  if (!user.roles.includes("approver")) {
    return { allowed: false, reason: `${user.name} does not hold approver rights.` };
  }
  if (rec.submittedBy === user.id) {
    return {
      allowed: false,
      reason: `${user.name} submitted this cycle — segregation of duties blocks the same account from reviewing it.`,
    };
  }
  return { allowed: true };
}

export function canDecide(rec: FundRecord2, user: User): Permission {
  if (rec.state !== "in_review") {
    return { allowed: false, reason: "The record is not in review." };
  }
  if (!user.roles.includes("approver")) {
    return { allowed: false, reason: `${user.name} does not hold approver rights.` };
  }
  if (rec.submittedBy === user.id) {
    return {
      allowed: false,
      reason: `${user.name} submitted this cycle — segregation of duties blocks the same account from approving it.`,
    };
  }
  return { allowed: true };
}

/** Discard = delete a draft outright. Once a record has been submitted it
 *  carries review history, so it can only move forward — never vanish. */
export function canDiscard(rec: FundRecord2, user: User): Permission {
  if (rec.state !== "draft") {
    return { allowed: false, reason: "Only a draft can be discarded — everything later carries review history." };
  }
  if (!user.roles.includes("submitter")) {
    return { allowed: false, reason: `${user.name} holds approver rights only.` };
  }
  const admin = user.roles.includes("approver");
  if (rec.createdBy !== user.id && !admin) {
    return { allowed: false, reason: `Only ${userName(rec.createdBy)} (the owner) or an admin can discard this draft.` };
  }
  return { allowed: true };
}

export function canActivate(rec: FundRecord2, user: User): Permission {
  if (rec.state !== "approved") {
    return { allowed: false, reason: "Only an approved record can be activated." };
  }
  if (!user.roles.includes("approver")) {
    return { allowed: false, reason: `${user.name} does not hold approver rights.` };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ *
 * Transitions — actions someone should hear about return notices too.
 * ------------------------------------------------------------------ */

export function stateLabel(state: RecordState2): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "in_review":
      return "In review";
    case "approved":
      return "Approved";
    case "active":
      return "Active";
  }
}

export type ActionResult = { record: FundRecord2; notices: Notice[] };

function notice(
  userId: string,
  rec: FundRecord2,
  kind: NoticeKind,
  text: string,
  actionNeeded: boolean,
  at: string,
): Notice {
  return { id: noticeId(), userId, recordId: rec.id, kind, text, at, read: false, actionNeeded };
}

function transition(
  rec: FundRecord2,
  to: RecordState2,
  actor: User,
  note: string,
  patch: Partial<FundRecord2> = {},
): FundRecord2 {
  const at = nowIso();
  return withAudit(
    { ...rec, state: to, ...patch },
    {
      id: auditId(),
      fieldId: null,
      from: stateLabel(rec.state),
      to: stateLabel(to),
      actor: actor.id,
      at,
      via: "system",
      note,
    },
  );
}

function addComment(
  rec: FundRecord2,
  kind: RecordComment["kind"],
  text: string,
  by: string,
  at: string,
  cycle: number,
  fieldId?: string,
): FundRecord2 {
  const comment: RecordComment = { id: commentId(), kind, text, by, at, cycle };
  if (fieldId) comment.fieldId = fieldId;
  return { ...rec, comments: [...rec.comments, comment] };
}

/** Submit. Cycle 1 notifies every approver; a resubmission notifies the
 *  reviewer who returned it (they know the history) and carries the delta. */
export function submitRecord(rec: FundRecord2, user: User): ActionResult {
  const cycle = rec.cycle + 1;
  const at = nowIso();
  let next = transition(
    rec,
    "submitted",
    user,
    cycle === 1 ? "Submitted for review" : `Resubmitted — review cycle ${cycle}`,
    { submittedBy: user.id, submittedAt: at, cycle },
  );
  next = {
    ...next,
    submissions: [...next.submissions, { cycle, by: user.id, at, values: { ...next.values } }],
  };

  const notices: Notice[] = [];
  if (cycle === 1 || !rec.reviewerId) {
    for (const u of USERS) {
      if (!u.roles.includes("approver") || u.id === user.id) continue;
      notices.push(
        notice(u.id, next, "submitted", `${user.name} submitted "${next.title}" for review.`, true, at),
      );
    }
  } else {
    const delta = changedSinceLastReview(next);
    const changed = delta ? delta.length : 0;
    notices.push(
      notice(
        rec.reviewerId,
        next,
        "resubmitted",
        `${user.name} resubmitted "${next.title}" — ${changed} field${changed === 1 ? "" : "s"} changed since your last review.`,
        true,
        at,
      ),
    );
  }
  return { record: next, notices };
}

export function startReview(rec: FundRecord2, user: User): FundRecord2 {
  return transition(rec, "in_review", user, "Picked up for review", {
    reviewerId: user.id,
  });
}

/** Reject with comments: the comment is required, travels with who + when,
 *  and the submitter is told exactly what came back and why. */
export function returnWithComments(
  rec: FundRecord2,
  user: User,
  text: string,
): ActionResult {
  const at = nowIso();
  const open = rec.flags.filter((f) => !f.resolved).length;
  let next = transition(
    rec,
    "draft",
    user,
    `Returned with comments${open ? ` and ${open} flagged field${open === 1 ? "" : "s"}` : ""}`,
  );
  next = addComment(next, "reject", text, user.id, at, rec.cycle);

  const notices: Notice[] = [];
  if (rec.submittedBy) {
    notices.push(
      notice(
        rec.submittedBy,
        next,
        "returned",
        `${user.name} rejected "${next.title}"${open ? ` — ${open} field${open === 1 ? "" : "s"} flagged` : ""}: “${text}”`,
        true,
        at,
      ),
    );
  }
  return { record: next, notices };
}

/** Approve with an effective date. On or before the demo today the record
 *  activates in the same action; a future date leaves it scheduled. */
export function approveRecord(
  rec: FundRecord2,
  user: User,
  effectiveDate: string,
  text: string,
): ActionResult {
  const at = nowIso();
  const immediate = effectiveDate <= DEMO_TODAY;
  let next = transition(rec, "approved", user, `Approved — effective ${formatDay(effectiveDate)}`, {
    approvedBy: user.id,
    approvedAt: at,
    effectiveDate,
  });
  if (text.trim()) next = addComment(next, "approve", text.trim(), user.id, at, rec.cycle);
  if (immediate) {
    next = transition(next, "active", user, "Activated", { activatedAt: nowIso() });
  }

  const notices: Notice[] = [];
  if (rec.submittedBy) {
    notices.push(
      notice(
        rec.submittedBy,
        next,
        immediate ? "activated" : "approved",
        immediate
          ? `${user.name} approved "${next.title}" — active as of today.`
          : `${user.name} approved "${next.title}" — scheduled to take effect ${formatDay(effectiveDate)}.`,
        false,
        at,
      ),
    );
  }
  return { record: next, notices };
}

/** Bring a scheduled record into force ahead of its effective date. */
export function activateNow(rec: FundRecord2, user: User): ActionResult {
  const at = nowIso();
  const next = transition(rec, "active", user, "Activated ahead of schedule", {
    activatedAt: at,
  });
  const notices: Notice[] = [];
  if (rec.submittedBy && rec.submittedBy !== user.id) {
    notices.push(
      notice(rec.submittedBy, next, "activated", `${user.name} activated "${next.title}".`, false, at),
    );
  }
  return { record: next, notices };
}

/** Whose plate is this record on right now? Drafts follow the assignee
 *  (falling back to the creator); later states follow the workflow. */
export function worksOn(rec: FundRecord2, user: User): boolean {
  return rec.assigneeId ? rec.assigneeId === user.id : rec.createdBy === user.id;
}

/** Assign a draft to someone — how a pile of drafts gets divided up.
 *  Audited, and the new assignee is told they have work. */
export function assignRecord(
  rec: FundRecord2,
  assigneeId: string | null,
  actor: User,
): ActionResult {
  if (rec.assigneeId === assigneeId) return { record: rec, notices: [] };
  const at = nowIso();
  const next = withAudit(
    { ...rec, assigneeId },
    {
      id: auditId(),
      fieldId: null,
      from: rec.assigneeId ? userName(rec.assigneeId) : "Unassigned",
      to: assigneeId ? userName(assigneeId) : "Unassigned",
      actor: actor.id,
      at,
      via: "system",
      note: assigneeId ? `Assigned to ${userName(assigneeId)}` : "Assignment cleared",
    },
  );
  const notices: Notice[] = [];
  if (assigneeId && assigneeId !== actor.id) {
    notices.push(
      notice(
        assigneeId,
        next,
        "assigned",
        `${actor.name} assigned "${next.title}" to you.`,
        true,
        at,
      ),
    );
  }
  return { record: next, notices };
}

/** A plain thread comment, optionally pinned to one form field so the thread
 *  can link straight to what it is about. The other side is told. */
export function commentOnRecord(
  rec: FundRecord2,
  user: User,
  text: string,
  fieldId?: string,
): ActionResult {
  const at = nowIso();
  const next = addComment(
    { ...rec, updatedAt: at },
    "note",
    text,
    user.id,
    at,
    Math.max(rec.cycle, 1),
    fieldId,
  );
  const other =
    user.id === rec.submittedBy ? rec.reviewerId : (rec.submittedBy ?? rec.createdBy);
  const notices: Notice[] = [];
  if (other && other !== user.id) {
    const about = fieldId ? ` (on ${FIELD_BY_ID[fieldId]?.label ?? fieldId})` : "";
    notices.push(
      notice(
        other,
        next,
        "comment",
        `${user.name} commented on "${next.title}"${about}: “${text}”`,
        false,
        at,
      ),
    );
  }
  return { record: next, notices };
}

/** Who may change a thread comment after the fact: its author, and only for
 *  plain notes — rejections and approvals are workflow records, not chat. */
export function canAlterComment(
  rec: FundRecord2,
  comment: RecordComment,
  user: User,
): Permission {
  if (comment.kind !== "note")
    return {
      allowed: false,
      reason: "Rejection and approval comments are part of the workflow record and cannot be changed.",
    };
  if (comment.by !== user.id)
    return {
      allowed: false,
      reason: `Only the author (${userName(comment.by)}) can edit or delete this comment.`,
    };
  if (rec.state === "active")
    return { allowed: false, reason: "The record is active — its thread is closed." };
  return { allowed: true };
}

/** Rewrite one of your own notes. The change is audited old → new. */
export function editComment(
  rec: FundRecord2,
  user: User,
  targetId: string,
  text: string,
): FundRecord2 {
  const existing = rec.comments.find((c) => c.id === targetId);
  if (!existing || existing.text === text || !canAlterComment(rec, existing, user).allowed)
    return rec;
  const at = nowIso();
  const next: FundRecord2 = {
    ...rec,
    comments: rec.comments.map((c) =>
      c.id === targetId ? { ...c, text, editedAt: at } : c,
    ),
  };
  return withAudit(next, {
    id: auditId(),
    fieldId: null,
    from: existing.text,
    to: text,
    actor: user.id,
    at,
    via: "system",
    note: "Comment edited",
  });
}

/** Remove one of your own notes. The deletion is audited with the old text. */
export function deleteComment(rec: FundRecord2, user: User, targetId: string): FundRecord2 {
  const existing = rec.comments.find((c) => c.id === targetId);
  if (!existing || !canAlterComment(rec, existing, user).allowed) return rec;
  const at = nowIso();
  const next: FundRecord2 = {
    ...rec,
    comments: rec.comments.filter((c) => c.id !== targetId),
  };
  return withAudit(next, {
    id: auditId(),
    fieldId: null,
    from: existing.text,
    to: "",
    actor: user.id,
    at,
    via: "system",
    note: "Comment deleted",
  });
}

export function flagField(
  rec: FundRecord2,
  fieldId: string,
  note: string,
  user: User,
): FundRecord2 {
  const at = nowIso();
  const flag: FieldFlag = { fieldId, note, by: user.id, at, resolved: false };
  const flags = [...rec.flags.filter((f) => f.fieldId !== fieldId || f.resolved), flag];
  return withAudit(
    { ...rec, flags },
    {
      id: auditId(),
      fieldId,
      from: "",
      to: "",
      actor: user.id,
      at,
      via: "system",
      note: `Flagged: ${note}`,
    },
  );
}

export function clearFlag(rec: FundRecord2, fieldId: string, user: User): FundRecord2 {
  const flag = rec.flags.find((f) => f.fieldId === fieldId && !f.resolved);
  if (!flag) return rec;
  return withAudit(
    {
      ...rec,
      flags: rec.flags.map((f) => (f === flag ? { ...f, resolved: true } : f)),
    },
    {
      id: auditId(),
      fieldId,
      from: "",
      to: "",
      actor: user.id,
      at: nowIso(),
      via: "system",
      note: "Flag withdrawn",
    },
  );
}

/* ------------------------------------------------------------------ *
 * Record construction
 * ------------------------------------------------------------------ */

export function blankValues(): Record<string, string> {
  return Object.fromEntries(
    FIELDS.map((f) => [f.id, f.id === "attestation" ? "Not confirmed" : ""]),
  );
}

export function blankRecord(id: string, title: string, createdBy: string): FundRecord2 {
  const at = nowIso();
  return {
    id,
    title,
    state: "draft",
    values: blankValues(),
    sources: {},
    flags: [],
    audit: [],
    comments: [],
    submissions: [],
    cycle: 0,
    createdBy,
    createdAt: at,
    assigneeId: createdBy,
    submittedBy: null,
    submittedAt: null,
    reviewerId: null,
    approvedBy: null,
    approvedAt: null,
    effectiveDate: null,
    activatedAt: null,
    updatedAt: at,
  };
}
