/* Fund Connect — core types.
 *
 * The modernization spec splits the work in two: pure presentation
 * components driven by props (status rail, condensing sections, badges,
 * field-level rejection UI) and the logic behind them (state machine,
 * permissions, audit log, import parsing, source-of-truth validation).
 * Everything in `src/lib/fundConnect` is that second half — no React, no
 * Tailwind, so the components stay dumb and the rules stay testable.
 */

/** Record lifecycle. Spec §1 — every transition is permission-checked. */
export type RecordState =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "amendment";

/** Where a field's current value came from. Spec §2 + §4. */
export type FieldSource = "manual" | "imported" | "modified";

/** Section roll-up shown in the left rail. Spec §3. */
export type SectionStatus = "not_started" | "in_progress" | "complete" | "error";

/** A single field write. Spec §4 — old, new, actor, timestamp, source. */
export type AuditEntry = {
  id: string;
  /** Field the write landed on, or null for a state transition. */
  fieldId: string | null;
  from: string;
  to: string;
  actor: string;
  at: string;
  via: "manual" | "import" | "system";
  note?: string;
};

/** A reviewer's rejection of one specific field. Spec §5. */
export type FieldFlag = {
  fieldId: string;
  note: string;
  by: string;
  at: string;
  /** Cleared when the submitter changes the value the flag was raised on. */
  resolved: boolean;
};

export type FundRecord = {
  /** Stable across amendments — the business record. */
  id: string;
  /** Unique per version — what the audit trail and queue key on. */
  versionId: string;
  version: number;
  /** versionId of the approved record this one amends, if any. Spec §6. */
  supersedes: string | null;
  label: string;
  state: RecordState;
  values: Record<string, string>;
  sources: Record<string, FieldSource>;
  flags: FieldFlag[];
  audit: AuditEntry[];
  createdBy: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewerId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type UserRole = "submitter" | "approver";

export type User = {
  id: string;
  name: string;
  initials: string;
  desk: string;
  roles: UserRole[];
};

/** Result of a permission check — a refusal always carries its reason. */
export type Permission = { allowed: boolean; reason?: string };
