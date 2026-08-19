/* Fund Connect — state machine, permissions and audit. Spec §1, §4, §5, §6.
 *
 * Everything here is pure: each function takes a record and returns a new
 * one. The React layer holds a single record in state and swaps it, so the
 * audit trail is the only history that matters and it cannot drift from
 * the values it describes.
 *
 * Segregation of duties is a permission, not a convention (spec §1): the
 * same account can never both submit and approve the same version. The
 * check lives here, and the UI renders the refusal reason rather than
 * hiding the button.
 */

import type {
  AuditEntry,
  FieldFlag,
  FieldSource,
  FundRecord,
  Permission,
  RecordState,
  SectionStatus,
  User,
} from "./types";
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
    id: "m.laurent",
    name: "Marie Laurent",
    initials: "ML",
    desk: "Fund Services · Team lead",
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

/* ------------------------------------------------------------------ *
 * Demo clock
 *
 * Seeded history is dated against a fixed "now" so the prototype reads the
 * same on any day it is opened. Each new event advances the clock a minute,
 * which keeps the audit trail in a believable order.
 * ------------------------------------------------------------------ */

export const DEMO_NOW = "2026-08-18T14:32:00.000Z";
let tick = 0;

export function nowIso(): string {
  tick += 1;
  return new Date(Date.parse(DEMO_NOW) + tick * 60_000).toISOString();
}

let auditSeq = 0;
function auditId(): string {
  auditSeq += 1;
  return `A${String(auditSeq).padStart(4, "0")}`;
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

/** "3 days" / "4 hours" / "12 min" between an ISO stamp and the demo now. */
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
 * Field writes — spec §4
 * ------------------------------------------------------------------ */

function nextSource(previous: FieldSource | undefined, via: AuditEntry["via"]): FieldSource {
  if (via === "import") return "imported";
  // A hand-edit on top of an imported value is the original risk returning
  // through the back door, so it gets its own badge rather than reverting
  // to plain "manual". Spec build step 6.
  if (previous === "imported" || previous === "modified") return "modified";
  return "manual";
}

function withAudit(rec: FundRecord, entry: AuditEntry): FundRecord {
  return { ...rec, audit: [entry, ...rec.audit], updatedAt: entry.at };
}

export function setField(
  rec: FundRecord,
  fieldId: string,
  value: string,
  actor: User,
  via: AuditEntry["via"] = "manual",
): FundRecord {
  const previous = rec.values[fieldId] ?? "";
  if (previous === value) return rec;
  const at = nowIso();

  const next: FundRecord = {
    ...rec,
    values: { ...rec.values, [fieldId]: value },
    sources: { ...rec.sources, [fieldId]: nextSource(rec.sources[fieldId], via) },
    // Editing a flagged field is how a rejection gets cleared — the reviewer
    // still sees the flag and its note in the history, marked resolved.
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

/** Commit a mapped import row. One audit entry per changed field. */
export function applyImport(
  rec: FundRecord,
  entries: { fieldId: string; value: string }[],
  actor: User,
): FundRecord {
  return entries.reduce(
    (acc, e) => setField(acc, e.fieldId, e.value, actor, "import"),
    rec,
  );
}

/* ------------------------------------------------------------------ *
 * Roll-ups for the rail and the progress header — spec §3
 * ------------------------------------------------------------------ */

export type FieldState = {
  fieldId: string;
  missing: boolean;
  issue: ReturnType<typeof validateValue>;
  flag: FieldFlag | null;
  source: FieldSource | null;
};

export function fieldState(
  rec: FundRecord,
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
  rec: FundRecord,
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

export function summarise(rec: FundRecord, stage: ValidationStage): RecordSummary {
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

/** The stage a record is validated at right now. Draft is deliberately
 *  permissive — that is what removes the placeholder-data workaround. */
export function stageFor(rec: FundRecord): ValidationStage {
  return rec.state === "draft" || rec.state === "amendment" ? "draft" : "submit";
}

/* ------------------------------------------------------------------ *
 * Permissions — spec §1 and §5
 * ------------------------------------------------------------------ */

const EDITABLE: RecordState[] = ["draft", "amendment"];

export function canEdit(rec: FundRecord, user: User): Permission {
  if (!EDITABLE.includes(rec.state)) {
    return { allowed: false, reason: `A ${stateLabel(rec.state).toLowerCase()} record is locked for editing.` };
  }
  if (!user.roles.includes("submitter")) {
    return { allowed: false, reason: `${user.name} holds approver rights only.` };
  }
  return { allowed: true };
}

export function canSubmit(rec: FundRecord, user: User): Permission {
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

export function canStartReview(rec: FundRecord, user: User): Permission {
  if (rec.state !== "submitted") {
    return { allowed: false, reason: "Only a submitted record can be picked up for review." };
  }
  if (!user.roles.includes("approver")) {
    return { allowed: false, reason: `${user.name} does not hold approver rights.` };
  }
  if (rec.submittedBy === user.id) {
    return {
      allowed: false,
      reason: `${user.name} submitted this version — segregation of duties blocks the same account from reviewing it.`,
    };
  }
  return { allowed: true };
}

/** Approve / reject. The SoD check is the whole point of this function. */
export function canDecide(rec: FundRecord, user: User): Permission {
  if (rec.state !== "in_review") {
    return { allowed: false, reason: "The record is not in review." };
  }
  if (!user.roles.includes("approver")) {
    return { allowed: false, reason: `${user.name} does not hold approver rights.` };
  }
  if (rec.submittedBy === user.id) {
    return {
      allowed: false,
      reason: `${user.name} submitted this version — segregation of duties blocks the same account from approving it.`,
    };
  }
  return { allowed: true };
}

export function canAmend(rec: FundRecord, user: User): Permission {
  if (rec.state !== "approved") {
    return { allowed: false, reason: "Only an approved record can be amended." };
  }
  if (!user.roles.includes("submitter")) {
    return { allowed: false, reason: `${user.name} holds approver rights only.` };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ *
 * Transitions
 * ------------------------------------------------------------------ */

export function stateLabel(state: RecordState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "in_review":
      return "In review";
    case "approved":
      return "Approved";
    case "amendment":
      return "Amendment";
  }
}

function transition(
  rec: FundRecord,
  to: RecordState,
  actor: User,
  note: string,
  patch: Partial<FundRecord> = {},
): FundRecord {
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

export function submitRecord(rec: FundRecord, user: User): FundRecord {
  return transition(rec, "submitted", user, "Submitted for review", {
    submittedBy: user.id,
    submittedAt: nowIso(),
  });
}

export function startReview(rec: FundRecord, user: User): FundRecord {
  return transition(rec, "in_review", user, "Picked up for review", {
    reviewerId: user.id,
  });
}

export function approveRecord(rec: FundRecord, user: User): FundRecord {
  return transition(rec, "approved", user, "Approved", {
    approvedBy: user.id,
    approvedAt: nowIso(),
  });
}

/** Send back to the submitter. The flags raised on specific fields are what
 *  the submitter lands on — not a paragraph they have to map onto 40 inputs. */
export function returnToSubmitter(rec: FundRecord, user: User): FundRecord {
  const open = rec.flags.filter((f) => !f.resolved).length;
  return transition(
    rec,
    "draft",
    user,
    `Returned with ${open} flagged field${open === 1 ? "" : "s"}`,
    { reviewerId: null },
  );
}

export function flagField(
  rec: FundRecord,
  fieldId: string,
  note: string,
  user: User,
): FundRecord {
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

export function clearFlag(rec: FundRecord, fieldId: string, user: User): FundRecord {
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

/** Spec §6 — an approved record is never edited. Amending forks a new
 *  version that carries the history and points back at what it supersedes;
 *  the approved version stays exactly as it was signed off. */
export function beginAmendment(
  rec: FundRecord,
  user: User,
  reason: string,
): FundRecord {
  const at = nowIso();
  const next: FundRecord = {
    ...rec,
    versionId: `${rec.id}-v${rec.version + 1}`,
    version: rec.version + 1,
    supersedes: rec.versionId,
    state: "amendment",
    flags: [],
    submittedBy: null,
    submittedAt: null,
    reviewerId: null,
    approvedBy: null,
    approvedAt: null,
    updatedAt: at,
  };
  return withAudit(next, {
    id: auditId(),
    fieldId: null,
    from: `v${rec.version} approved`,
    to: `v${next.version} amendment`,
    actor: user.id,
    at,
    via: "system",
    note: reason,
  });
}
