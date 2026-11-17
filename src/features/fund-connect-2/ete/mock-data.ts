import { blankPeriod, cloneConfig } from "./engine";
import {
  SETTLEMENT_DAYS,
  type AuditEvent,
  type BasketType,
  type Distribution,
  type Fund,
  type FundConfig,
  type FundDetails,
  type OrderType,
  type SettlementDay,
  type SettlementPeriod,
  type UserId,
} from "./model";

/* ETE Fund Configuration — mock data. No backend: this is the whole world
 * the prototype knows. Seven funds across four issuers, three regions and
 * six currencies, one in each workflow state worth demonstrating:
 *
 *   NGSP   Active, nothing pending
 *   NGAB   Active, with a draft modification against it
 *   MF100  Active, with a modification awaiting approval (submitted by Sofia)
 *
 * People are the Fund Connect 2 users (lib/engine USERS): Priya submits,
 * Daniel approves, Sofia can do both.
 *   MECB   New fund, draft with validation errors
 *   MCDV   New fund, clean draft ready to submit
 *   HAPX   New fund, rejected
 *   KJEQ   Active, nothing pending
 */

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

type PeriodSpec = Partial<Omit<SettlementPeriod, "day">>;

/** Listed days are active with a standard window; the rest stay off. */
function periods(spec: Partial<Record<SettlementDay, PeriodSpec>>): SettlementPeriod[] {
  return SETTLEMENT_DAYS.map((day) => {
    const s = spec[day];
    if (!s) return blankPeriod(day);
    return { ...blankPeriod(day), active: true, creationAllowed: true, redemptionAllowed: true, tOpen: "09:00", tClose: "16:00", ...s };
  });
}

function orderType(
  id: string,
  name: string,
  code: string,
  basket: BasketType,
  spec: Partial<Record<SettlementDay, PeriodSpec>>,
  over: Partial<OrderType> = {},
): OrderType {
  return {
    id,
    name,
    code,
    basket,
    enabled: true,
    creation: true,
    redemption: true,
    assistedTrading: false,
    cashInLieu: false,
    directedTrading: false,
    periods: periods(spec),
    ...over,
  };
}

function distribution(countries: string[], over: Partial<Distribution> = {}): Distribution {
  return { countries, institutionMode: "all", institutions: [], cobrand: false, cobrandName: "", ...over };
}

let eventSeq = 0;
function event(at: string, actor: UserId, title: string, over: Partial<AuditEvent> = {}): AuditEvent {
  eventSeq += 1;
  return { id: `seed-${eventSeq}`, at, actor, title, ...over };
}

/* ------------------------------------------------------------------ */
/* Northgate S&P 500 Core ETF — Active, nothing pending                */
/* ------------------------------------------------------------------ */

const ngspDetails: FundDetails = {
  fundName: "Northgate S&P 500 Core ETF",
  fundCode: "NGSP",
  issuer: "Northgate Asset Management",
  ticker: "NGSP",
  isin: "US6660011007",
  listingExchange: "NYSE Arca",
  assetClass: "Equity",
  benchmark: "S&P 500 Index",
  region: "Americas",
  currency: "USD",
  creationUnitSize: "50000",
  incomeTreatment: "Distributing",
  custodian: "State Street Bank and Trust",
  transferAgent: "State Street Transfer Agency",
  settlementVenue: "NSCC",
  cutoffTimezone: "New York (ET)",
  orderChannel: "FundConnect portal and FIX",
  confirmationRouting: "Portal and email",
  operationsContact: "etf.ops@northgate.example",
};

const ngsp: FundConfig = {
  details: ngspDetails,
  orderTypes: [
    orderType("ot-ngsp-1", "In-Kind", "IK", "In-kind", {
      1: { cns: true, tClose: "16:00", t1Open: "16:30", t1Close: "20:00" },
      2: { cns: true, tClose: "16:00" },
    }),
    orderType("ot-ngsp-2", "Cash", "CA", "Cash", { 1: { approvalRequired: true, tClose: "14:00" } }, { cashInLieu: true }),
    orderType("ot-ngsp-3", "Custom In-Kind", "CIK", "Hybrid", { 2: { approvalRequired: true, tClose: "13:00" }, 3: { approvalRequired: true, tClose: "13:00" } }, { assistedTrading: true, cashInLieu: true }),
  ],
  defaultCreationId: "ot-ngsp-1",
  defaultRedemptionId: "ot-ngsp-1",
  distribution: distribution(["United States", "Canada"]),
};

/* ------------------------------------------------------------------ */
/* Northgate US Aggregate Bond ETF — Active, draft modification        */
/* ------------------------------------------------------------------ */

const ngabActive: FundConfig = {
  details: {
    ...ngspDetails,
    fundName: "Northgate US Aggregate Bond ETF",
    fundCode: "NGAB",
    ticker: "NGAB",
    isin: "US6660022004",
    assetClass: "Fixed income",
    benchmark: "Bloomberg US Aggregate Bond Index",
    creationUnitSize: "100000",
    confirmationRouting: "Portal only",
  },
  orderTypes: [
    orderType("ot-ngab-1", "In-Kind", "IK", "In-kind", { 1: { cns: true, tClose: "15:00" }, 2: { cns: true, tClose: "16:00" } }),
    orderType("ot-ngab-2", "Cash", "CA", "Cash", { 1: { approvalRequired: true, tClose: "13:30" } }, { cashInLieu: true }),
  ],
  defaultCreationId: "ot-ngab-1",
  defaultRedemptionId: "ot-ngab-1",
  distribution: distribution(["United States"], { institutionMode: "selected", institutions: ["inst-02", "inst-03", "inst-16"] }),
};

const ngabDraft = cloneConfig(ngabActive);
ngabDraft.details.confirmationRouting = "Portal and email";
ngabDraft.orderTypes[0].periods[2].tClose = "15:30";
ngabDraft.orderTypes[1].periods[0] = { ...blankPeriod(0), active: true, creationAllowed: true, approvalRequired: true, tOpen: "09:00", tClose: "11:00" };
ngabDraft.orderTypes.push(
  orderType("ot-ngab-3", "Directed Cash", "DC", "Cash", { 1: { approvalRequired: true, tClose: "12:00" }, 2: { tClose: "14:00" } }, { directedTrading: true, assistedTrading: true }),
);
ngabDraft.distribution.countries.push("Canada");
ngabDraft.distribution.institutions.push("inst-09");

/* ------------------------------------------------------------------ */
/* Meridian FTSE 100 UCITS ETF — Active, awaiting approval             */
/* ------------------------------------------------------------------ */

const mf100Active: FundConfig = {
  details: {
    fundName: "Meridian FTSE 100 UCITS ETF",
    fundCode: "MF100",
    issuer: "Meridian Investments",
    ticker: "MFTS",
    isin: "IE00BM9X4T21",
    listingExchange: "London Stock Exchange",
    assetClass: "Equity",
    benchmark: "FTSE 100 Index",
    region: "EMEA",
    currency: "GBP",
    creationUnitSize: "25000",
    incomeTreatment: "Accumulating",
    custodian: "State Street Bank International",
    transferAgent: "Link Fund Solutions",
    settlementVenue: "CREST",
    cutoffTimezone: "London (GMT/BST)",
    orderChannel: "FundConnect portal",
    confirmationRouting: "SWIFT MT515",
    operationsContact: "primary.markets@meridian.example",
  },
  orderTypes: [
    orderType("ot-mf100-1", "In-Kind", "IK", "In-kind", { 2: { tOpen: "08:00", tClose: "15:30" } }),
    orderType("ot-mf100-2", "Cash", "CA", "Cash", { 1: { tOpen: "08:00", tClose: "14:00" }, 2: { tOpen: "08:00", tClose: "15:00" } }, { cashInLieu: true }),
    orderType("ot-mf100-3", "Custom Basket", "CB", "Hybrid", { 3: { approvalRequired: true, tOpen: "08:00", tClose: "12:00" } }, { assistedTrading: true }),
  ],
  defaultCreationId: "ot-mf100-1",
  defaultRedemptionId: "ot-mf100-1",
  distribution: distribution(["United Kingdom", "Ireland", "Netherlands"], { cobrand: true, cobrandName: "Meridian x Aldgate" }),
};

const mf100Pending = cloneConfig(mf100Active);
mf100Pending.orderTypes[2].enabled = false;
mf100Pending.orderTypes[1].periods[1].approvalRequired = true;
mf100Pending.defaultRedemptionId = "ot-mf100-2";
mf100Pending.distribution.countries.push("Germany");

/* ------------------------------------------------------------------ */
/* Meridian Euro Corporate Bond UCITS ETF — new, draft with errors     */
/* ------------------------------------------------------------------ */

const mecb: FundConfig = {
  details: {
    ...mf100Active.details,
    fundName: "Meridian Euro Corporate Bond UCITS ETF",
    fundCode: "MECB",
    ticker: "MECB",
    isin: "IE00B4L5Y98",
    listingExchange: "Xetra",
    assetClass: "Fixed income",
    benchmark: "Bloomberg Euro Corporate Bond Index",
    currency: "EUR",
    creationUnitSize: "10000",
    incomeTreatment: "Distributing",
    custodian: "",
    transferAgent: "SS&C GIDS",
    settlementVenue: "Clearstream",
    cutoffTimezone: "Frankfurt (CET)",
  },
  orderTypes: [
    orderType("ot-mecb-1", "In-Kind", "IK", "In-kind", { 2: { tOpen: "16:30", tClose: "15:00" }, 3: { tOpen: "09:00", tClose: "15:00" } }),
    orderType("ot-mecb-2", "Cash", "CA", "Cash", {}, { cashInLieu: true }),
  ],
  defaultCreationId: null,
  defaultRedemptionId: null,
  distribution: distribution(["Germany", "France", "Luxembourg"], { cobrand: true }),
};

/* ------------------------------------------------------------------ */
/* Maple Canadian Dividend ETF — new, clean draft                      */
/* ------------------------------------------------------------------ */

const mcdv: FundConfig = {
  details: {
    fundName: "Maple Canadian Dividend ETF",
    fundCode: "MCDV",
    issuer: "Maple Leaf Funds",
    ticker: "MCDV",
    isin: "CA5651231009",
    listingExchange: "Toronto Stock Exchange",
    assetClass: "Equity",
    benchmark: "S&P/TSX Canadian Dividend Aristocrats Index",
    region: "Americas",
    currency: "CAD",
    creationUnitSize: "25000",
    incomeTreatment: "Distributing",
    custodian: "State Street Trust Canada",
    transferAgent: "Computershare",
    settlementVenue: "CDS",
    cutoffTimezone: "Toronto (ET)",
    orderChannel: "FundConnect portal",
    confirmationRouting: "Portal and email",
    operationsContact: "etf.desk@mapleleaf.example",
  },
  orderTypes: [orderType("ot-mcdv-1", "In-Kind", "IK", "In-kind", { 1: { cns: true, tClose: "16:00" }, 2: { cns: true, tClose: "16:00" } })],
  defaultCreationId: "ot-mcdv-1",
  defaultRedemptionId: "ot-mcdv-1",
  distribution: distribution(["Canada"]),
};

/* ------------------------------------------------------------------ */
/* Harbour Asia Pacific ex-Japan ETF — new, rejected                   */
/* ------------------------------------------------------------------ */

const hapx: FundConfig = {
  details: {
    fundName: "Harbour Asia Pacific ex-Japan ETF",
    fundCode: "HAPX",
    issuer: "Harbour Capital",
    ticker: "3188",
    isin: "HK0000512348",
    listingExchange: "Hong Kong Stock Exchange",
    assetClass: "Equity",
    benchmark: "MSCI AC Asia Pacific ex Japan Index",
    region: "APAC",
    currency: "HKD",
    creationUnitSize: "100000",
    incomeTreatment: "Accumulating",
    custodian: "State Street Trust (HK)",
    transferAgent: "Computershare",
    settlementVenue: "CCASS",
    cutoffTimezone: "Hong Kong (HKT)",
    orderChannel: "FundConnect portal",
    confirmationRouting: "Portal and email",
    operationsContact: "pd.ops@harbourcapital.example",
  },
  orderTypes: [
    orderType("ot-hapx-1", "In-Kind", "IK", "In-kind", { 2: { tOpen: "09:30", tClose: "15:00" } }),
    orderType("ot-hapx-2", "Cash", "CA", "Cash", { 0: { redemptionAllowed: false, tOpen: "09:30", tClose: "10:30" }, 1: { tOpen: "09:30", tClose: "14:00" } }, { cashInLieu: true }),
  ],
  defaultCreationId: "ot-hapx-1",
  defaultRedemptionId: "ot-hapx-1",
  distribution: distribution(["Hong Kong", "Singapore"], { institutionMode: "selected", institutions: ["inst-05", "inst-11", "inst-15"] }),
};

/* ------------------------------------------------------------------ */
/* Kestrel Japan Equity ETF — Active, nothing pending                  */
/* ------------------------------------------------------------------ */

const kjeq: FundConfig = {
  details: {
    fundName: "Kestrel Japan Equity ETF",
    fundCode: "KJEQ",
    issuer: "Kestrel Asset Management",
    ticker: "2899",
    isin: "JP3048910004",
    listingExchange: "Tokyo Stock Exchange",
    assetClass: "Equity",
    benchmark: "TOPIX",
    region: "APAC",
    currency: "JPY",
    creationUnitSize: "20000",
    incomeTreatment: "Distributing",
    custodian: "State Street Trust and Banking (Japan)",
    transferAgent: "State Street Transfer Agency",
    settlementVenue: "JASDEC",
    cutoffTimezone: "Tokyo (JST)",
    orderChannel: "FundConnect portal",
    confirmationRouting: "Portal only",
    operationsContact: "etf-ops@kestrel.example",
  },
  orderTypes: [
    orderType("ot-kjeq-1", "In-Kind", "IK", "In-kind", { 2: { tOpen: "09:00", tClose: "15:00" } }),
    orderType("ot-kjeq-2", "Cash", "CA", "Cash", { 2: { approvalRequired: true, tOpen: "09:00", tClose: "13:00" }, 3: { tOpen: "09:00", tClose: "14:00" } }, { cashInLieu: true, redemption: false }),
  ],
  defaultCreationId: "ot-kjeq-1",
  defaultRedemptionId: "ot-kjeq-1",
  distribution: distribution(["Japan"]),
};
// Cash is Creation only, so its periods must not allow Redemption.
for (const p of kjeq.orderTypes[1].periods) p.redemptionAllowed = false;

/* ------------------------------------------------------------------ */
/* The register                                                        */
/* ------------------------------------------------------------------ */

function buildFunds(): Fund[] {
  return [
    {
      id: "fund-ngab",
      active: cloneConfig(ngabActive),
      activeVersion: 2,
      pending: { config: cloneConfig(ngabDraft), state: "draft", createdBy: "p.raman" },
      lastModifiedBy: "p.raman",
      lastModifiedAt: "16 Nov 2026, 15:12",
      history: [
        event("16 Nov 2026, 14:40", "p.raman", "Started a modification", { detail: "Draft created from active version 2." }),
        event("02 Sep 2026, 10:05", "d.osei", "Approved and activated", { detail: "Version 2 is in use.", tone: "positive" }),
        event("01 Sep 2026, 16:20", "s.mercer", "Submitted for approval"),
      ],
    },
    {
      id: "fund-mf100",
      active: cloneConfig(mf100Active),
      activeVersion: 3,
      pending: { config: cloneConfig(mf100Pending), state: "awaiting", createdBy: "s.mercer", submittedBy: "s.mercer", submittedAt: "17 Nov 2026, 09:05" },
      lastModifiedBy: "s.mercer",
      lastModifiedAt: "17 Nov 2026, 09:05",
      history: [
        event("17 Nov 2026, 09:05", "s.mercer", "Submitted for approval", { detail: "Validation passed with no errors.", tone: "info" }),
        event("14 Nov 2026, 11:30", "s.mercer", "Started a modification", { detail: "Draft created from active version 3." }),
        event("20 Jul 2026, 09:45", "d.osei", "Approved and activated", { detail: "Version 3 is in use.", tone: "positive" }),
      ],
    },
    {
      id: "fund-mecb",
      active: null,
      activeVersion: 0,
      pending: { config: cloneConfig(mecb), state: "draft", createdBy: "s.mercer" },
      lastModifiedBy: "s.mercer",
      lastModifiedAt: "13 Nov 2026, 17:48",
      history: [event("12 Nov 2026, 10:15", "s.mercer", "Created the fund", { detail: "New fund setup started." })],
    },
    {
      id: "fund-mcdv",
      active: null,
      activeVersion: 0,
      pending: { config: cloneConfig(mcdv), state: "draft", createdBy: "p.raman" },
      lastModifiedBy: "p.raman",
      lastModifiedAt: "17 Nov 2026, 08:31",
      history: [event("10 Nov 2026, 13:02", "p.raman", "Created the fund", { detail: "New fund setup started." })],
    },
    {
      id: "fund-hapx",
      active: null,
      activeVersion: 0,
      pending: {
        config: cloneConfig(hapx),
        state: "rejected",
        createdBy: "p.raman",
        submittedBy: "p.raman",
        submittedAt: "11 Nov 2026, 12:20",
        rejectedBy: "d.osei",
        rejectedAt: "12 Nov 2026, 09:14",
        rejectionReason: "The Cash Order Type allows Creation on T+0 with no approval step. Add approval on T+0 or turn that period off, then resubmit.",
      },
      lastModifiedBy: "d.osei",
      lastModifiedAt: "12 Nov 2026, 09:14",
      history: [
        event("12 Nov 2026, 09:14", "d.osei", "Rejected", { detail: "The Cash Order Type allows Creation on T+0 with no approval step.", tone: "negative" }),
        event("11 Nov 2026, 12:20", "p.raman", "Submitted for approval", { tone: "info" }),
        event("05 Nov 2026, 15:40", "p.raman", "Created the fund", { detail: "New fund setup started." }),
      ],
    },
    {
      id: "fund-ngsp",
      active: cloneConfig(ngsp),
      activeVersion: 4,
      pending: null,
      lastModifiedBy: "s.mercer",
      lastModifiedAt: "28 Oct 2026, 14:22",
      history: [
        event("28 Oct 2026, 14:22", "s.mercer", "Approved and activated", { detail: "Version 4 is in use.", tone: "positive" }),
        event("27 Oct 2026, 16:58", "p.raman", "Submitted for approval", { tone: "info" }),
      ],
    },
    {
      id: "fund-kjeq",
      active: cloneConfig(kjeq),
      activeVersion: 1,
      pending: null,
      lastModifiedBy: "d.osei",
      lastModifiedAt: "03 Aug 2026, 10:10",
      history: [event("03 Aug 2026, 10:10", "d.osei", "Approved and activated", { detail: "Version 1 is in use.", tone: "positive" })],
    },
  ];
}

/** The starting state. Deep-copied on every call so Reset demo is clean. */
export function seedFunds(): Fund[] {
  return buildFunds();
}

export const DEFAULT_FUND_ID = "fund-ngab";
