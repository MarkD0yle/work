/* Fund Connect 2 — seeded book of work.
 *
 * One record per state, plus the two scenarios the demo is really about:
 *   - FC2-0402  rejected with comments, back in Draft with an open flag
 *   - FC2-0404  resubmitted and in review, so the delta view has two
 *               submissions to diff (three fields changed on cycle 2)
 *
 * Seed notices mirror what the transitions would have emitted, so each
 * demo user opens the page with a believable inbox.
 */

import { DEMO_NOW } from "./engine";
import { FIELDS, isEmpty } from "../fundConnect/schema";
import type {
  AuditEntry,
  FieldSource,
  FundRecord2,
  Notice,
  RecordComment,
  RecordState2,
  Submission,
} from "./types";

export const REVIEW_SLA = { target: 4 * 60, breach: 24 * 60 };
export const ABANDONED_AFTER_MINUTES = 7 * 24 * 60;

const at = (minutesAgo: number) =>
  new Date(Date.parse(DEMO_NOW) - minutesAgo * 60_000).toISOString();

let seq = 0;
const sid = () => `S${String((seq += 1)).padStart(4, "0")}`;

/* Base value sets — valid against the shared schema and masters. */

const equitySubscription: Record<string, string> = {
  fundCode: "GB00FCAP01",
  shareClass: "Acc GBP",
  baseCcy: "GBP",
  domicile: "Ireland",
  mandateType: "Pooled",
  cptyId: "CPT-4471",
  dealingAccount: "48120073",
  custodian: "Northern Trust (London)",
  ssiBic: "CNORGB2L",
  instrumentId: "IE00B4L5Y983",
  side: "Subscribe",
  quantity: "61250",
  price: "78.40",
  tradeDate: "2026-08-24",
  settlementDate: "2026-08-26",
  mgmtFeeBps: "65",
  perfFeeBps: "",
  dealingCharge: "",
  settleCcy: "GBP",
  settlementMethod: "DVP",
  cutoff: "12:00 London",
  paymentRef: "SUB-AUG-0148",
  firstTimeSetup: "No",
  riskCategory: "Standard",
  attestation: "Confirmed",
  comments: "",
};

const bondRedemption: Record<string, string> = {
  ...equitySubscription,
  fundCode: "GB00FCAP02",
  shareClass: "Inc GBP",
  cptyId: "CPT-3389",
  dealingAccount: "48120145",
  custodian: "State Street (Edinburgh)",
  ssiBic: "SBOSGB2X",
  instrumentId: "GB00B03MLX29",
  side: "Redeem",
  quantity: "12000",
  price: "24.05",
  cutoff: "15:00 London",
  paymentRef: "RED-AUG-0231",
};

const sicavSubscription: Record<string, string> = {
  ...equitySubscription,
  fundCode: "LU00FCAP07",
  shareClass: "Hedged Acc EUR",
  baseCcy: "EUR",
  domicile: "Luxembourg",
  dealingAccount: "48120211",
  custodian: "BNY Mellon (Brussels)",
  ssiBic: "IRVTBEBB",
  instrumentId: "LU0378818131",
  quantity: "8400",
  price: "112.60",
  settleCcy: "EUR",
  paymentRef: "SUB-AUG-0384",
};

type Seed = {
  id: string;
  title: string;
  state: RecordState2;
  values: Record<string, string>;
  imported?: string[];
  modified?: string[];
  cycle?: number;
  submissions?: Submission[];
  comments?: RecordComment[];
  flags?: { fieldId: string; note: string; by: string; minsAgo: number; resolved?: boolean }[];
  events?: { from: string; to: string; actor: string; minsAgo: number; note: string }[];
  createdBy: string;
  createdMinsAgo: number;
  submittedBy?: string;
  submittedMinsAgo?: number;
  reviewerId?: string;
  approvedBy?: string;
  approvedMinsAgo?: number;
  effectiveDate?: string;
  activatedMinsAgo?: number;
  updatedMinsAgo: number;
};

function build(seed: Seed): FundRecord2 {
  const sources: Record<string, FieldSource> = {};
  for (const field of FIELDS) {
    if (isEmpty(seed.values[field.id])) continue;
    sources[field.id] = seed.modified?.includes(field.id)
      ? "modified"
      : seed.imported?.includes(field.id)
        ? "imported"
        : "manual";
  }

  const audit: AuditEntry[] = (seed.events ?? [])
    .map((e) => ({
      id: sid(),
      fieldId: null,
      from: e.from,
      to: e.to,
      actor: e.actor,
      at: at(e.minsAgo),
      via: "system" as const,
      note: e.note,
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    id: seed.id,
    title: seed.title,
    state: seed.state,
    values: seed.values,
    sources,
    flags: (seed.flags ?? []).map((f) => ({
      fieldId: f.fieldId,
      note: f.note,
      by: f.by,
      at: at(f.minsAgo),
      resolved: f.resolved ?? false,
    })),
    audit,
    comments: seed.comments ?? [],
    submissions: seed.submissions ?? [],
    cycle: seed.cycle ?? 0,
    createdBy: seed.createdBy,
    createdAt: at(seed.createdMinsAgo),
    submittedBy: seed.submittedBy ?? null,
    submittedAt: seed.submittedMinsAgo === undefined ? null : at(seed.submittedMinsAgo),
    reviewerId: seed.reviewerId ?? null,
    approvedBy: seed.approvedBy ?? null,
    approvedAt: seed.approvedMinsAgo === undefined ? null : at(seed.approvedMinsAgo),
    effectiveDate: seed.effectiveDate ?? null,
    activatedAt: seed.activatedMinsAgo === undefined ? null : at(seed.activatedMinsAgo),
    updatedAt: at(seed.updatedMinsAgo),
  };
}

let cseq = 0;
const cid = () => `SC${String((cseq += 1)).padStart(3, "0")}`;

export const SEED_RECORDS: FundRecord2[] = [
  // A working draft, half imported, one section untouched.
  build({
    id: "FC2-0401",
    title: "Global Equity — August subscription",
    state: "draft",
    values: {
      ...equitySubscription,
      mgmtFeeBps: "",
      settleCcy: "",
      settlementMethod: "",
      cutoff: "",
      firstTimeSetup: "",
      riskCategory: "",
      attestation: "Not confirmed",
      paymentRef: "",
    },
    imported: [
      "fundCode",
      "shareClass",
      "baseCcy",
      "cptyId",
      "dealingAccount",
      "custodian",
      "ssiBic",
      "instrumentId",
      "side",
      "quantity",
      "price",
      "tradeDate",
      "settlementDate",
    ],
    createdBy: "p.raman",
    createdMinsAgo: 200,
    updatedMinsAgo: 55,
    events: [
      { from: "", to: "", actor: "p.raman", minsAgo: 200, note: "Draft raised from upload — 13 fields written by the import" },
    ],
  }),

  // Rejected with comments — the round trip, mid-loop, waiting on Priya.
  build({
    id: "FC2-0402",
    title: "Sterling Corporate Bond — redemption",
    state: "draft",
    values: { ...bondRedemption, quantity: "120000" },
    imported: ["fundCode", "shareClass", "cptyId", "instrumentId", "side", "tradeDate", "settlementDate"],
    modified: ["quantity"],
    cycle: 1,
    submissions: [
      { cycle: 1, by: "p.raman", at: at(26 * 60), values: { ...bondRedemption, quantity: "120000" } },
    ],
    comments: [
      {
        id: cid(),
        kind: "reject",
        text: "Quantity looks an order of magnitude high against the fund's normal ticket, and it was hand-edited after the import. Please check it against the dealing sheet before resubmitting.",
        by: "d.osei",
        at: at(22 * 60),
        cycle: 1,
      },
    ],
    flags: [
      {
        fieldId: "quantity",
        note: "Dealing sheet shows 12,000 — confirm whether the extra zero is real.",
        by: "d.osei",
        minsAgo: 22 * 60,
      },
    ],
    createdBy: "p.raman",
    createdMinsAgo: 30 * 60,
    submittedBy: "p.raman",
    submittedMinsAgo: 26 * 60,
    reviewerId: "d.osei",
    updatedMinsAgo: 22 * 60,
    events: [
      { from: "Draft", to: "Submitted", actor: "p.raman", minsAgo: 26 * 60, note: "Submitted for review" },
      { from: "Submitted", to: "In review", actor: "d.osei", minsAgo: 24 * 60, note: "Picked up for review" },
      { from: "In review", to: "Draft", actor: "d.osei", minsAgo: 22 * 60, note: "Returned with comments and 1 flagged field" },
    ],
  }),

  // Waiting on any approver — first cycle, clean.
  build({
    id: "FC2-0403",
    title: "European Multi-Asset — subscription",
    state: "submitted",
    values: sicavSubscription,
    imported: ["fundCode", "shareClass", "baseCcy", "cptyId", "instrumentId", "side", "quantity", "price"],
    cycle: 1,
    submissions: [{ cycle: 1, by: "p.raman", at: at(5 * 60), values: { ...sicavSubscription } }],
    createdBy: "p.raman",
    createdMinsAgo: 8 * 60,
    submittedBy: "p.raman",
    submittedMinsAgo: 5 * 60,
    updatedMinsAgo: 5 * 60,
    events: [
      { from: "Draft", to: "Submitted", actor: "p.raman", minsAgo: 5 * 60, note: "Submitted for review" },
    ],
  }),

  // Resubmitted after a rejection — in review on cycle 2, delta available.
  build({
    id: "FC2-0404",
    title: "Global Equity — top-up dealing account",
    state: "in_review",
    values: { ...equitySubscription, dealingAccount: "48120099", quantity: "3100", price: "101.85", paymentRef: "SUB-AUG-0197" },
    imported: ["fundCode", "shareClass", "cptyId", "instrumentId", "side", "tradeDate", "settlementDate"],
    cycle: 2,
    submissions: [
      {
        cycle: 1,
        by: "s.mercer",
        at: at(50 * 60),
        // Cycle 1 went out with a 7-digit account and a stale price.
        values: { ...equitySubscription, dealingAccount: "4812009", quantity: "3100", price: "98.20", paymentRef: "SUB-AUG-0197" },
      },
      {
        cycle: 2,
        by: "s.mercer",
        at: at(90),
        values: { ...equitySubscription, dealingAccount: "48120099", quantity: "3100", price: "101.85", paymentRef: "SUB-AUG-0197" },
      },
    ],
    comments: [
      {
        id: cid(),
        kind: "reject",
        text: "Dealing account is only 7 digits, and the price predates Friday's NAV. Fix both and resubmit.",
        by: "d.osei",
        at: at(47 * 60),
        cycle: 1,
      },
    ],
    flags: [
      { fieldId: "dealingAccount", note: "7 digits — the account range is 8–10.", by: "d.osei", minsAgo: 47 * 60, resolved: true },
      { fieldId: "price", note: "Stale — Friday's NAV was 101.85.", by: "d.osei", minsAgo: 47 * 60, resolved: true },
    ],
    createdBy: "s.mercer",
    createdMinsAgo: 52 * 60,
    submittedBy: "s.mercer",
    submittedMinsAgo: 90,
    reviewerId: "d.osei",
    updatedMinsAgo: 40,
    events: [
      { from: "Draft", to: "Submitted", actor: "s.mercer", minsAgo: 50 * 60, note: "Submitted for review" },
      { from: "Submitted", to: "In review", actor: "d.osei", minsAgo: 48 * 60, note: "Picked up for review" },
      { from: "In review", to: "Draft", actor: "d.osei", minsAgo: 47 * 60, note: "Returned with comments and 2 flagged fields" },
      { from: "Draft", to: "Submitted", actor: "s.mercer", minsAgo: 90, note: "Resubmitted — review cycle 2" },
      { from: "Submitted", to: "In review", actor: "d.osei", minsAgo: 40, note: "Picked up for review" },
    ],
  }),

  // Approved with a future effective date — scheduled, not yet in force.
  build({
    id: "FC2-0405",
    title: "Sterling Corporate Bond — September switch",
    state: "approved",
    values: { ...bondRedemption, side: "Switch out", quantity: "5400", paymentRef: "SWO-SEP-0012", tradeDate: "2026-09-01", settlementDate: "2026-09-03" },
    cycle: 1,
    submissions: [
      { cycle: 1, by: "p.raman", at: at(3 * 24 * 60), values: { ...bondRedemption, side: "Switch out", quantity: "5400", paymentRef: "SWO-SEP-0012", tradeDate: "2026-09-01", settlementDate: "2026-09-03" } },
    ],
    comments: [
      { id: cid(), kind: "approve", text: "Checked against the switch instruction — hold until the September dealing window.", by: "d.osei", at: at(2 * 24 * 60), cycle: 1 },
    ],
    createdBy: "p.raman",
    createdMinsAgo: 4 * 24 * 60,
    submittedBy: "p.raman",
    submittedMinsAgo: 3 * 24 * 60,
    reviewerId: "d.osei",
    approvedBy: "d.osei",
    approvedMinsAgo: 2 * 24 * 60,
    effectiveDate: "2026-09-01",
    updatedMinsAgo: 2 * 24 * 60,
    events: [
      { from: "Draft", to: "Submitted", actor: "p.raman", minsAgo: 3 * 24 * 60, note: "Submitted for review" },
      { from: "Submitted", to: "In review", actor: "d.osei", minsAgo: 2 * 24 * 60 + 120, note: "Picked up for review" },
      { from: "In review", to: "Approved", actor: "d.osei", minsAgo: 2 * 24 * 60, note: "Approved — effective 01 Sept 2026" },
    ],
  }),

  // Fully through the pipeline — approved and in force.
  build({
    id: "FC2-0406",
    title: "European Multi-Asset — standing subscription",
    state: "active",
    values: { ...sicavSubscription, quantity: "2600", paymentRef: "SUB-STD-0044", tradeDate: "2026-08-18", settlementDate: "2026-08-20" },
    cycle: 1,
    submissions: [
      { cycle: 1, by: "s.mercer", at: at(6 * 24 * 60), values: { ...sicavSubscription, quantity: "2600", paymentRef: "SUB-STD-0044", tradeDate: "2026-08-18", settlementDate: "2026-08-20" } },
    ],
    createdBy: "s.mercer",
    createdMinsAgo: 7 * 24 * 60,
    submittedBy: "s.mercer",
    submittedMinsAgo: 6 * 24 * 60,
    reviewerId: "d.osei",
    approvedBy: "d.osei",
    approvedMinsAgo: 5 * 24 * 60,
    effectiveDate: "2026-08-20",
    activatedMinsAgo: 5 * 24 * 60,
    updatedMinsAgo: 5 * 24 * 60,
    events: [
      { from: "Draft", to: "Submitted", actor: "s.mercer", minsAgo: 6 * 24 * 60, note: "Submitted for review" },
      { from: "Submitted", to: "In review", actor: "d.osei", minsAgo: 5 * 24 * 60 + 60, note: "Picked up for review" },
      { from: "In review", to: "Approved", actor: "d.osei", minsAgo: 5 * 24 * 60, note: "Approved — effective 20 Aug 2026" },
      { from: "Approved", to: "Active", actor: "d.osei", minsAgo: 5 * 24 * 60, note: "Activated" },
    ],
  }),
];

let nseq = 0;
const nid = () => `SN${String((nseq += 1)).padStart(3, "0")}`;

/** What the transitions above would have put in each inbox. */
export const SEED_NOTICES: Notice[] = [
  {
    id: nid(),
    userId: "p.raman",
    recordId: "FC2-0402",
    kind: "returned",
    text: "Daniel Osei rejected “Sterling Corporate Bond — redemption” — 1 field flagged: “Quantity looks an order of magnitude high…”",
    at: at(22 * 60),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "d.osei",
    recordId: "FC2-0403",
    kind: "submitted",
    text: "Priya Raman submitted “European Multi-Asset — subscription” for review.",
    at: at(5 * 60),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "s.mercer",
    recordId: "FC2-0403",
    kind: "submitted",
    text: "Priya Raman submitted “European Multi-Asset — subscription” for review.",
    at: at(5 * 60),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "d.osei",
    recordId: "FC2-0404",
    kind: "resubmitted",
    text: "Sofia Mercer resubmitted “Global Equity — top-up dealing account” — 2 fields changed since your last review.",
    at: at(90),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "p.raman",
    recordId: "FC2-0405",
    kind: "approved",
    text: "Daniel Osei approved “Sterling Corporate Bond — September switch” — scheduled to take effect 01 Sept 2026.",
    at: at(2 * 24 * 60),
    read: true,
    actionNeeded: false,
  },
  {
    id: nid(),
    userId: "s.mercer",
    recordId: "FC2-0406",
    kind: "activated",
    text: "Daniel Osei approved “European Multi-Asset — standing subscription” — active as of 20 Aug 2026.",
    at: at(5 * 24 * 60),
    read: true,
    actionNeeded: false,
  },
];
