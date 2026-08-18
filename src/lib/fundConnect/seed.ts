/* Fund Connect — seeded records.
 *
 * Enough of a book of work to exercise every state in the machine at once:
 * a draft to import into, a submission waiting on a reviewer, one already
 * in review with an open flag, an approved record to amend, an amendment
 * back in the queue, and a draft nobody has touched in eleven days.
 *
 * Values are chosen so the review demo has something to find: a
 * counterparty ID one transposition away from the intended entity, a
 * hand-edit sitting on top of an imported field, and a notional several
 * times the fund's average ticket.
 */

import { DEMO_NOW } from "./engine";
import { FIELDS, isEmpty } from "./schema";
import type { AuditEntry, FieldSource, FundRecord, RecordState } from "./types";

const at = (minutesAgo: number) =>
  new Date(Date.parse(DEMO_NOW) - minutesAgo * 60_000).toISOString();

let seq = 0;
const seedId = () => `S${String((seq += 1)).padStart(4, "0")}`;

type Seed = {
  id: string;
  version?: number;
  supersedes?: string | null;
  label: string;
  state: RecordState;
  values: Record<string, string>;
  /** Fields whose value arrived through import rather than the keyboard. */
  imported?: string[];
  /** Imported fields since hand-edited — "manually modified, verify". */
  modified?: string[];
  /** What those fields held before the hand edit, for the audit trail. */
  modifiedFrom?: Record<string, string>;
  createdBy: string;
  createdMinsAgo: number;
  submittedBy?: string;
  submittedMinsAgo?: number;
  reviewerId?: string;
  approvedBy?: string;
  approvedMinsAgo?: number;
  updatedMinsAgo: number;
  flags?: { fieldId: string; note: string; by: string; minsAgo: number }[];
};

function build(seed: Seed): FundRecord {
  const version = seed.version ?? 1;
  const sources: Record<string, FieldSource> = {};
  for (const field of FIELDS) {
    if (isEmpty(seed.values[field.id])) continue;
    sources[field.id] = seed.modified?.includes(field.id)
      ? "modified"
      : seed.imported?.includes(field.id)
        ? "imported"
        : "manual";
  }

  const audit: AuditEntry[] = [];
  const push = (e: AuditEntry) => audit.push(e);

  const entered = Object.keys(seed.values).filter((k) => !isEmpty(seed.values[k]));
  entered.forEach((fieldId, i) => {
    const source = sources[fieldId];
    push({
      id: seedId(),
      fieldId,
      from: "",
      to: seed.modifiedFrom?.[fieldId] ?? seed.values[fieldId],
      actor: seed.createdBy,
      at: at(seed.createdMinsAgo - i),
      via: source === "manual" ? "manual" : "import",
    });
  });
  for (const fieldId of seed.modified ?? []) {
    push({
      id: seedId(),
      fieldId,
      from: seed.modifiedFrom?.[fieldId] ?? seed.values[fieldId],
      to: seed.values[fieldId],
      actor: seed.createdBy,
      at: at(seed.updatedMinsAgo + 4),
      via: "manual",
      note: "Hand-edited after import",
    });
  }
  if (seed.submittedMinsAgo !== undefined) {
    push({
      id: seedId(),
      fieldId: null,
      from: "Draft",
      to: "Submitted",
      actor: seed.submittedBy ?? seed.createdBy,
      at: at(seed.submittedMinsAgo),
      via: "system",
      note: "Submitted for review",
    });
  }
  if (seed.reviewerId) {
    push({
      id: seedId(),
      fieldId: null,
      from: "Submitted",
      to: "In review",
      actor: seed.reviewerId,
      at: at((seed.submittedMinsAgo ?? 60) - 25),
      via: "system",
      note: "Picked up for review",
    });
  }
  for (const flag of seed.flags ?? []) {
    push({
      id: seedId(),
      fieldId: flag.fieldId,
      from: "",
      to: "",
      actor: flag.by,
      at: at(flag.minsAgo),
      via: "system",
      note: `Flagged: ${flag.note}`,
    });
  }
  if (seed.approvedMinsAgo !== undefined) {
    push({
      id: seedId(),
      fieldId: null,
      from: "In review",
      to: "Approved",
      actor: seed.approvedBy ?? "d.osei",
      at: at(seed.approvedMinsAgo),
      via: "system",
      note: "Approved",
    });
  }

  return {
    id: seed.id,
    versionId: `${seed.id}-v${version}`,
    version,
    supersedes: seed.supersedes ?? null,
    label: seed.label,
    state: seed.state,
    values: seed.values,
    sources,
    flags: (seed.flags ?? []).map((f) => ({
      fieldId: f.fieldId,
      note: f.note,
      by: f.by,
      at: at(f.minsAgo),
      resolved: false,
    })),
    audit: audit.sort((a, b) => b.at.localeCompare(a.at)),
    createdBy: seed.createdBy,
    createdAt: at(seed.createdMinsAgo),
    submittedBy: seed.submittedBy ?? null,
    submittedAt:
      seed.submittedMinsAgo === undefined ? null : at(seed.submittedMinsAgo),
    reviewerId: seed.reviewerId ?? null,
    approvedBy: seed.approvedBy ?? null,
    approvedAt:
      seed.approvedMinsAgo === undefined ? null : at(seed.approvedMinsAgo),
    updatedAt: at(seed.updatedMinsAgo),
  };
}

const COMPLETE_BASE = {
  shareClass: "Acc GBP",
  baseCcy: "GBP",
  domicile: "Ireland",
  mandateType: "Pooled",
  dealingAccount: "48120073",
  custodian: "Northern Trust (London)",
  ssiBic: "CNORGB2L",
  side: "Subscribe",
  tradeDate: "2026-08-17",
  settlementDate: "2026-08-19",
  mgmtFeeBps: "65",
  perfFeeBps: "",
  dealingCharge: "",
  settleCcy: "GBP",
  settlementMethod: "DVP",
  cutoff: "12:00 London",
  paymentRef: "",
  firstTimeSetup: "No",
  riskCategory: "Standard",
  attestation: "Confirmed",
  comments: "",
};

export const SEED_RECORDS: FundRecord[] = [
  build({
    id: "FC-2026-0148",
    label: "Meridian Global Equity — August subscription",
    state: "draft",
    createdBy: "p.raman",
    createdMinsAgo: 95,
    updatedMinsAgo: 88,
    values: {
      fundCode: "GB00FCAP01",
      shareClass: "",
      baseCcy: "",
      domicile: "",
      mandateType: "",
      cptyId: "",
      dealingAccount: "",
      custodian: "",
      ssiBic: "",
      instrumentId: "",
      side: "",
      quantity: "",
      price: "",
      tradeDate: "",
      settlementDate: "",
      mgmtFeeBps: "",
      perfFeeBps: "",
      dealingCharge: "",
      settleCcy: "",
      settlementMethod: "",
      cutoff: "",
      paymentRef: "",
      firstTimeSetup: "",
      riskCategory: "",
      attestation: "Not confirmed",
      comments: "",
    },
  }),
  build({
    id: "FC-2026-0147",
    label: "Meridian Sterling Corporate Bond — redemption",
    state: "submitted",
    createdBy: "p.raman",
    createdMinsAgo: 420,
    submittedBy: "p.raman",
    submittedMinsAgo: 195,
    updatedMinsAgo: 200,
    imported: [
      "fundCode",
      "shareClass",
      "baseCcy",
      "cptyId",
      "dealingAccount",
      "custodian",
      "instrumentId",
      "side",
      "quantity",
      "price",
      "tradeDate",
      "settlementDate",
      "mgmtFeeBps",
      "settleCcy",
      "settlementMethod",
      "cutoff",
    ],
    modified: ["ssiBic"],
    // Imported as the London BIC, then corrected by hand — the edit is the
    // risk import was meant to remove, so it keeps its own badge.
    modifiedFrom: { ssiBic: "SBOSGB2L" },
    values: {
      ...COMPLETE_BASE,
      fundCode: "GB00FCAP02",
      shareClass: "Inc GBP",
      // One transposition away from CPT-4471. Both exist; only one is right.
      cptyId: "CPT-4417",
      dealingAccount: "48120145",
      custodian: "State Street (Edinburgh)",
      ssiBic: "SBOSGB2X",
      instrumentId: "GB00B03MLX29",
      side: "Redeem",
      // 8.4m against a 2.1m average ticket — the derived notional is the tell.
      quantity: "350000",
      price: "24.05",
      mgmtFeeBps: "45",
      cutoff: "15:00 London",
    },
  }),
  build({
    id: "FC-2026-0146",
    label: "Meridian European Multi-Asset — switch in",
    state: "in_review",
    createdBy: "m.laurent",
    createdMinsAgo: 900,
    submittedBy: "m.laurent",
    submittedMinsAgo: 640,
    reviewerId: "d.osei",
    updatedMinsAgo: 640,
    imported: ["fundCode", "cptyId", "instrumentId", "quantity", "price"],
    values: {
      ...COMPLETE_BASE,
      fundCode: "LU00FCAP07",
      shareClass: "Hedged Acc EUR",
      baseCcy: "EUR",
      domicile: "Luxembourg",
      cptyId: "CPT-3389",
      dealingAccount: "48120211",
      custodian: "BNY Mellon (Brussels)",
      ssiBic: "IRVTBEBB",
      instrumentId: "LU0378818131",
      side: "Switch in",
      quantity: "8400",
      price: "112.60",
      settleCcy: "EUR",
      mgmtFeeBps: "72",
      riskCategory: "Elevated",
    },
    flags: [
      {
        fieldId: "ssiBic",
        note: "This BIC is the Brussels branch — the account sits with the Dublin entity. Confirm against the SSI record before resubmitting.",
        by: "d.osei",
        minsAgo: 300,
      },
    ],
  }),
  build({
    id: "FC-2026-0145",
    label: "Meridian Global Equity — July rebalance",
    state: "approved",
    createdBy: "p.raman",
    createdMinsAgo: 5200,
    submittedBy: "p.raman",
    submittedMinsAgo: 4900,
    reviewerId: "d.osei",
    approvedBy: "d.osei",
    approvedMinsAgo: 4600,
    updatedMinsAgo: 4600,
    imported: ["fundCode", "cptyId", "quantity", "price", "instrumentId"],
    values: {
      ...COMPLETE_BASE,
      fundCode: "GB00FCAP01",
      cptyId: "CPT-4471",
      instrumentId: "IE00B4L5Y983",
      quantity: "18500",
      price: "78.40",
      tradeDate: "2026-07-14",
      settlementDate: "2026-07-16",
    },
  }),
  build({
    id: "FC-2026-0144",
    version: 2,
    supersedes: "FC-2026-0144-v1",
    label: "Meridian EM Debt — coupon reinvestment (amended)",
    state: "submitted",
    createdBy: "m.laurent",
    createdMinsAgo: 2600,
    submittedBy: "m.laurent",
    submittedMinsAgo: 90,
    updatedMinsAgo: 95,
    imported: ["fundCode", "cptyId", "quantity", "price"],
    values: {
      ...COMPLETE_BASE,
      fundCode: "GB00FCAP02",
      shareClass: "Inc GBP",
      cptyId: "CPT-3389",
      dealingAccount: "48120145",
      custodian: "Citibank (Dublin)",
      ssiBic: "CITIIE2X",
      instrumentId: "IE00BK5BQT80",
      side: "Subscribe",
      quantity: "4200",
      price: "101.85",
      tradeDate: "2026-08-18",
      settlementDate: "2026-08-20",
      riskCategory: "Elevated",
    },
  }),
  build({
    id: "FC-2026-0144",
    version: 1,
    label: "Meridian EM Debt — coupon reinvestment",
    state: "approved",
    createdBy: "m.laurent",
    createdMinsAgo: 2600,
    submittedBy: "m.laurent",
    submittedMinsAgo: 2400,
    reviewerId: "d.osei",
    approvedBy: "d.osei",
    approvedMinsAgo: 2100,
    updatedMinsAgo: 2100,
    imported: ["fundCode", "cptyId", "quantity", "price"],
    values: {
      ...COMPLETE_BASE,
      fundCode: "GB00FCAP02",
      shareClass: "Inc GBP",
      cptyId: "CPT-3389",
      dealingAccount: "48120145",
      custodian: "Citibank (Dublin)",
      ssiBic: "CITIIE2X",
      instrumentId: "IE00BK5BQT80",
      side: "Subscribe",
      quantity: "4200",
      price: "98.20",
      tradeDate: "2026-08-14",
      settlementDate: "2026-08-18",
      riskCategory: "Elevated",
    },
  }),
  build({
    id: "FC-2026-0139",
    label: "Meridian Global Equity — draft, untouched",
    state: "draft",
    createdBy: "p.raman",
    createdMinsAgo: 16_800,
    updatedMinsAgo: 15_840,
    values: {
      fundCode: "GB00FCAP01",
      shareClass: "Acc GBP",
      baseCcy: "GBP",
      cptyId: "CPT-4471",
      side: "Subscribe",
      tradeDate: "2026-08-05",
      attestation: "Not confirmed",
    },
  }),
];

/** A draft nobody has touched for this long shows up in the queue's
 *  abandoned list. Spec build step 9. */
export const ABANDONED_AFTER_MINUTES = 60 * 24 * 5;

/** Waiting-time thresholds for the reviewer queue SLA. Spec build step 9. */
export const REVIEW_SLA = { target: 240, breach: 480 };
