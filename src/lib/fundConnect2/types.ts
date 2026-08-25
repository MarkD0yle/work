/* Fund Connect 2 — core types.
 *
 * Same split as Fund Connect: pure logic in src/lib/fundConnect2, dumb
 * props-driven components on top. The schema, validation and reference
 * masters are shared with Fund Connect (src/lib/fundConnect) — what changes
 * here is the record model:
 *
 *   - lifecycle gains a terminal `active` state (approve ≠ activate)
 *   - records carry a comment thread (reject-with-comments loop)
 *   - every submit snapshots the values, so a reviewer on cycle 2+ can be
 *     shown only what changed since they last looked (4-eyes delta review)
 *   - transitions emit notices for the in-app notification inbox
 *
 * No amendment fork — FC2's focus is the submit → reject → resubmit loop.
 */

import type { AuditEntry, FieldFlag, FieldSource, User } from "../fundConnect/types";

export type { AuditEntry, FieldFlag, FieldSource, User };

/** Upload → validate → review → approve → activate. Draft covers the first
 *  two: a record born from the upload wizard sits in draft until it clears
 *  submit-tier validation. */
export type RecordState2 =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved" // signed off, effective date in the future
  | "active"; // in force

export type CommentKind = "note" | "reject" | "approve";

/** One entry in the record's comment thread. Rejections and approvals are
 *  comments too, so the thread reads as the full conversation. */
export type RecordComment = {
  id: string;
  kind: CommentKind;
  text: string;
  by: string;
  at: string;
  /** Review cycle the comment belongs to (1 = first submission). */
  cycle: number;
};

/** Values as they stood at one submission — the basis for delta review. */
export type Submission = {
  cycle: number;
  by: string;
  at: string;
  values: Record<string, string>;
};

export type NoticeKind =
  | "submitted"
  | "resubmitted"
  | "returned"
  | "approved"
  | "activated"
  | "comment";

/** An inbox item for one user. Lives outside the record — notices are
 *  per-person and cross-record, so the page holds them in their own store. */
export type Notice = {
  id: string;
  userId: string;
  recordId: string;
  kind: NoticeKind;
  text: string;
  at: string;
  read: boolean;
  /** True when the recipient is expected to act, not just know. */
  actionNeeded: boolean;
};

export type FundRecord2 = {
  id: string;
  /** Editable draft title — how the record reads in every list. */
  title: string;
  state: RecordState2;
  values: Record<string, string>;
  sources: Record<string, FieldSource>;
  flags: FieldFlag[];
  audit: AuditEntry[];
  comments: RecordComment[];
  submissions: Submission[];
  /** Completed submit count — 0 until first submitted. */
  cycle: number;
  createdBy: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  /** Sticks through a return, so a resubmission notifies the same reviewer. */
  reviewerId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  /** Set at approval. On or before the demo today = activate immediately. */
  effectiveDate: string | null;
  activatedAt: string | null;
  updatedAt: string;
};

/** A field changed between the two most recent submissions. */
export type FieldDelta = { fieldId: string; from: string; to: string };
