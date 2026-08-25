/* Fund Connect 2 — seeded primary-market book.
 *
 * Two layers:
 *   - six scenario records, one per pipeline state, including the two the
 *     demo leans on: FC2-0402 (rejected with comments, back in draft) and
 *     FC2-0404 (resubmitted, in review on cycle 2 with a two-field delta)
 *   - an eighteen-ETF active register, so the grid reads like the real
 *     primary-market view: regions, providers, trusts and tickers spread
 *     across the catalogue
 *
 * Seed notices mirror what the transitions would have emitted, so each demo
 * user opens the page with a believable inbox. All issuer names fictional.
 */

import { DEMO_NOW } from "./engine";
import { FIELDS, isEmpty } from "./schema";
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

const gbpEquityBase: Record<string, string> = {
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
  cobrands: "WL1 c-30 r-30 all; AIS c0 r0 none",
};

const gbpBondBase: Record<string, string> = {
  ...gbpEquityBase,
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
  cobrands: "LMB c-15 r-15 none",
};

const eurBase: Record<string, string> = {
  ...gbpEquityBase,
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
  cobrands: "SGA c-45 r-60 all; APX c0 r0 none",
};

type Identity = {
  fundLongName: string;
  fundShortName: string;
  ticker: string;
  region: string;
  provider: string;
  trust: string;
  fundNumber: string;
};

const identity = (
  fundLongName: string,
  fundShortName: string,
  ticker: string,
  region: string,
  provider: string,
  trust: string,
  fundNumber: string,
): Identity => ({ fundLongName, fundShortName, ticker, region, provider, trust, fundNumber });

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

/* ------------------------------------------------------------------ *
 * Scenario records — one per state, plus the two demo loops.
 * ------------------------------------------------------------------ */

const id0401 = identity("Meridian Global Equity UCITS ETF", "Global Equity", "MGEQ", "EMEA", "Meridian AM", "UCITS ICAV", "4021");
const id0402 = identity("Meridian Sterling Corporate Bond UCITS ETF", "Sterling Corp Bond", "MSCB", "EMEA", "Meridian AM", "UCITS ICAV", "4022");
const id0403 = identity("Meridian European Multi-Asset UCITS ETF", "European Multi-Asset", "MEMA", "EMEA", "Meridian AM", "UCITS ICAV", "4023");
const id0404 = identity("Helix Global Dividend ETF", "Global Dividend", "HGDV", "US", "Helix Investments", "ETF Trust II", "4024");
const id0405 = identity("Aurora Sterling Credit UCITS ETF", "Sterling Credit", "ASCR", "EMEA", "Aurora Capital", "UCITS ICAV", "4025");
const id0406 = identity("Northwind European Multi-Asset UCITS ETF", "European Multi-Asset", "NEMA", "EMEA", "Northwind AM", "ETF Trust I", "4026");

const cycle1of0404 = {
  ...gbpEquityBase,
  ...id0404,
  dealingAccount: "4812009",
  quantity: "3100",
  price: "98.20",
  paymentRef: "SUB-AUG-0197",
};
const cycle2of0404 = {
  ...cycle1of0404,
  dealingAccount: "48120099",
  price: "101.85",
};

const SCENARIOS: FundRecord2[] = [
  // A working draft, half imported, identity done, one section untouched.
  build({
    id: "FC2-0401",
    title: id0401.fundLongName,
    state: "draft",
    values: {
      ...gbpEquityBase,
      ...id0401,
      mgmtFeeBps: "",
      settleCcy: "",
      settlementMethod: "",
      cutoff: "",
      firstTimeSetup: "",
      riskCategory: "",
      attestation: "Not confirmed",
      paymentRef: "",
      cobrands: "",
    },
    imported: [
      "fundLongName",
      "fundShortName",
      "ticker",
      "region",
      "provider",
      "trust",
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
      { from: "", to: "", actor: "p.raman", minsAgo: 200, note: "Draft raised from upload — 19 fields written by the import" },
    ],
  }),

  // Rejected with comments — the round trip, mid-loop, waiting on Priya.
  build({
    id: "FC2-0402",
    title: id0402.fundLongName,
    state: "draft",
    values: { ...gbpBondBase, ...id0402, quantity: "120000" },
    imported: ["fundLongName", "ticker", "fundCode", "shareClass", "cptyId", "instrumentId", "side", "tradeDate", "settlementDate"],
    modified: ["quantity"],
    cycle: 1,
    submissions: [
      { cycle: 1, by: "p.raman", at: at(26 * 60), values: { ...gbpBondBase, ...id0402, quantity: "120000" } },
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
    title: id0403.fundLongName,
    state: "submitted",
    values: { ...eurBase, ...id0403 },
    imported: ["fundLongName", "fundShortName", "ticker", "region", "provider", "fundCode", "shareClass", "baseCcy", "cptyId", "instrumentId", "side", "quantity", "price"],
    cycle: 1,
    submissions: [{ cycle: 1, by: "p.raman", at: at(5 * 60), values: { ...eurBase, ...id0403 } }],
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
    title: id0404.fundLongName,
    state: "in_review",
    values: { ...cycle2of0404 },
    imported: ["fundLongName", "ticker", "fundCode", "shareClass", "cptyId", "instrumentId", "side", "tradeDate", "settlementDate"],
    cycle: 2,
    submissions: [
      { cycle: 1, by: "s.mercer", at: at(50 * 60), values: { ...cycle1of0404 } },
      { cycle: 2, by: "s.mercer", at: at(90), values: { ...cycle2of0404 } },
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
    title: id0405.fundLongName,
    state: "approved",
    values: { ...gbpBondBase, ...id0405, side: "Switch out", quantity: "5400", paymentRef: "SWO-SEP-0012", tradeDate: "2026-09-01", settlementDate: "2026-09-03" },
    cycle: 1,
    submissions: [
      { cycle: 1, by: "p.raman", at: at(3 * 24 * 60), values: { ...gbpBondBase, ...id0405, side: "Switch out", quantity: "5400", paymentRef: "SWO-SEP-0012", tradeDate: "2026-09-01", settlementDate: "2026-09-03" } },
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

  // Recently through the whole pipeline — approved and in force.
  build({
    id: "FC2-0406",
    title: id0406.fundLongName,
    state: "active",
    values: { ...eurBase, ...id0406, quantity: "2600", paymentRef: "SUB-STD-0044", tradeDate: "2026-08-18", settlementDate: "2026-08-20" },
    cycle: 1,
    submissions: [
      { cycle: 1, by: "s.mercer", at: at(6 * 24 * 60), values: { ...eurBase, ...id0406, quantity: "2600", paymentRef: "SUB-STD-0044", tradeDate: "2026-08-18", settlementDate: "2026-08-20" } },
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

/* ------------------------------------------------------------------ *
 * Active register — the standing book the grid opens on.
 * ------------------------------------------------------------------ */

const CATALOGUE: Identity[] = [
  identity("Meridian US Large Cap Blend ETF", "US Large Cap Blend", "MULB", "US", "Meridian AM", "ETF Trust I", "4001"),
  identity("Meridian US Treasury 1-3Y ETF", "US Treasury 1-3Y", "MUST", "US", "Meridian AM", "ETF Trust I", "4002"),
  identity("Meridian Global Value Factor UCITS ETF", "Global Value Factor", "MGVF", "EMEA", "Meridian AM", "UCITS ICAV", "4003"),
  identity("Meridian Emerging Markets Core UCITS ETF", "EM Core", "MEMC", "EMEA", "Meridian AM", "UCITS ICAV", "4004"),
  identity("Northwind US Quality Growth ETF", "US Quality Growth", "NWQG", "US", "Northwind AM", "ETF Trust I", "4005"),
  identity("Northwind US Small Cap Value ETF", "US Small Cap Value", "NWSV", "US", "Northwind AM", "ETF Trust I", "4006"),
  identity("Northwind Sterling Gilt Ladder UCITS ETF", "Sterling Gilt Ladder", "NWGL", "EMEA", "Northwind AM", "UCITS ICAV", "4007"),
  identity("Northwind Japan Equity Hedged ETF", "Japan Equity Hedged", "NWJH", "APAC", "Northwind AM", "ETF Trust II", "4008"),
  identity("Aurora Global Infrastructure UCITS ETF", "Global Infrastructure", "AGIN", "EMEA", "Aurora Capital", "UCITS ICAV", "4009"),
  identity("Aurora Clean Energy Leaders ETF", "Clean Energy Leaders", "ACEL", "US", "Aurora Capital", "ETF Trust II", "4010"),
  identity("Aurora Asia Pacific Income UCITS ETF", "Asia Pacific Income", "AAPI", "APAC", "Aurora Capital", "UCITS ICAV", "4011"),
  identity("Aurora Short Duration Credit ETF", "Short Duration Credit", "ASDC", "US", "Aurora Capital", "ETF Trust I", "4012"),
  identity("Helix Global Momentum ETF", "Global Momentum", "HGMO", "US", "Helix Investments", "ETF Trust II", "4013"),
  identity("Helix European Banks UCITS ETF", "European Banks", "HEBK", "EMEA", "Helix Investments", "UCITS ICAV", "4014"),
  identity("Helix Asia Technology UCITS ETF", "Asia Technology", "HATQ", "APAC", "Helix Investments", "UCITS ICAV", "4015"),
  identity("Helix Global Real Assets ETF", "Global Real Assets", "HGRA", "US", "Helix Investments", "ETF Trust I", "4016"),
  identity("Meridian Pacific Dividend UCITS ETF", "Pacific Dividend", "MPDV", "APAC", "Meridian AM", "UCITS ICAV", "4017"),
  identity("Northwind Global Aggregate Bond ETF", "Global Aggregate Bond", "NWAB", "US", "Northwind AM", "ETF Trust II", "4018"),
];

const BASES = [gbpEquityBase, gbpBondBase, eurBase];

const ACTIVE_REGISTER: FundRecord2[] = CATALOGUE.map((ident, i) => {
  const base = BASES[i % BASES.length];
  const submitter = i % 2 === 0 ? "p.raman" : "s.mercer";
  const approvedDaysAgo = 10 + i * 2;
  const day = String(3 + i).padStart(2, "0");
  const values = {
    ...base,
    ...ident,
    quantity: String(1200 + i * 375),
    paymentRef: `STD-${ident.ticker}-${ident.fundNumber}`,
    tradeDate: "2026-07-01",
    settlementDate: "2026-07-03",
  };
  return build({
    id: `FC2-${String(407 + i).padStart(4, "0")}`,
    title: ident.fundLongName,
    state: "active",
    values,
    cycle: 1,
    submissions: [
      { cycle: 1, by: submitter, at: at((approvedDaysAgo + 2) * 24 * 60), values: { ...values } },
    ],
    createdBy: submitter,
    createdMinsAgo: (approvedDaysAgo + 4) * 24 * 60,
    submittedBy: submitter,
    submittedMinsAgo: (approvedDaysAgo + 2) * 24 * 60,
    reviewerId: "d.osei",
    approvedBy: "d.osei",
    approvedMinsAgo: approvedDaysAgo * 24 * 60,
    effectiveDate: `2026-07-${day}`,
    activatedMinsAgo: approvedDaysAgo * 24 * 60,
    updatedMinsAgo: approvedDaysAgo * 24 * 60,
    events: [
      { from: "Draft", to: "Submitted", actor: submitter, minsAgo: (approvedDaysAgo + 2) * 24 * 60, note: "Submitted for review" },
      { from: "Submitted", to: "In review", actor: "d.osei", minsAgo: approvedDaysAgo * 24 * 60 + 90, note: "Picked up for review" },
      { from: "In review", to: "Approved", actor: "d.osei", minsAgo: approvedDaysAgo * 24 * 60, note: "Approved" },
      { from: "Approved", to: "Active", actor: "d.osei", minsAgo: approvedDaysAgo * 24 * 60, note: "Activated" },
    ],
  });
});

export const SEED_RECORDS: FundRecord2[] = [...SCENARIOS, ...ACTIVE_REGISTER];

let nseq = 0;
const nid = () => `SN${String((nseq += 1)).padStart(3, "0")}`;

/** What the transitions above would have put in each inbox. */
export const SEED_NOTICES: Notice[] = [
  {
    id: nid(),
    userId: "p.raman",
    recordId: "FC2-0402",
    kind: "returned",
    text: "Daniel Osei rejected “Meridian Sterling Corporate Bond UCITS ETF” — 1 field flagged: “Quantity looks an order of magnitude high…”",
    at: at(22 * 60),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "d.osei",
    recordId: "FC2-0403",
    kind: "submitted",
    text: "Priya Raman submitted “Meridian European Multi-Asset UCITS ETF” for review.",
    at: at(5 * 60),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "s.mercer",
    recordId: "FC2-0403",
    kind: "submitted",
    text: "Priya Raman submitted “Meridian European Multi-Asset UCITS ETF” for review.",
    at: at(5 * 60),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "d.osei",
    recordId: "FC2-0404",
    kind: "resubmitted",
    text: "Sofia Mercer resubmitted “Helix Global Dividend ETF” — 2 fields changed since your last review.",
    at: at(90),
    read: false,
    actionNeeded: true,
  },
  {
    id: nid(),
    userId: "p.raman",
    recordId: "FC2-0405",
    kind: "approved",
    text: "Daniel Osei approved “Aurora Sterling Credit UCITS ETF” — scheduled to take effect 01 Sept 2026.",
    at: at(2 * 24 * 60),
    read: true,
    actionNeeded: false,
  },
  {
    id: nid(),
    userId: "s.mercer",
    recordId: "FC2-0406",
    kind: "activated",
    text: "Daniel Osei approved “Northwind European Multi-Asset UCITS ETF” — active as of 20 Aug 2026.",
    at: at(5 * 24 * 60),
    read: true,
    actionNeeded: false,
  },
];
