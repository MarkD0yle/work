import {
  DETAIL_FIELDS,
  SETTLEMENT_DAYS,
  cnsApplies,
  periodLabel,
  type DetailKey,
  type FundConfig,
  type OrderType,
  type SettlementDay,
  type SettlementPeriod,
  type Target,
} from "./model";

/* ETE Fund Configuration — pure rules, no React.
 *
 * Three things live here: building blank records, validating a
 * configuration, and comparing a pending configuration with the active one.
 * Workflow transitions are in EteProvider, which owns the state. */

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export function blankPeriod(day: SettlementDay): SettlementPeriod {
  return {
    day,
    active: false,
    creationAllowed: false,
    redemptionAllowed: false,
    approvalRequired: false,
    cns: false,
    tOpen: "",
    tClose: "",
    t1Open: "",
    t1Close: "",
  };
}

export function blankOrderType(id: string, name: string): OrderType {
  return {
    id,
    name,
    code: "",
    basket: "In-kind",
    enabled: true,
    creation: true,
    redemption: true,
    assistedTrading: false,
    cashInLieu: false,
    directedTrading: false,
    periods: SETTLEMENT_DAYS.map(blankPeriod),
  };
}

export function cloneConfig(config: FundConfig): FundConfig {
  return {
    details: { ...config.details },
    orderTypes: config.orderTypes.map((o) => ({ ...o, periods: o.periods.map((p) => ({ ...p })) })),
    defaultCreationId: config.defaultCreationId,
    defaultRedemptionId: config.defaultRedemptionId,
    distribution: {
      ...config.distribution,
      countries: [...config.distribution.countries],
      institutions: [...config.distribution.institutions],
    },
  };
}

export function activePeriods(orderType: OrderType): SettlementPeriod[] {
  return orderType.periods.filter((p) => p.active);
}

export function directionLabel(o: { creation: boolean; redemption: boolean }): string {
  if (o.creation && o.redemption) return "Creation and Redemption";
  if (o.creation) return "Creation only";
  if (o.redemption) return "Redemption only";
  return "Neither";
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type Severity = "error" | "warning";

export type Issue = {
  id: string;
  severity: Severity;
  /** The field the message sits next to. */
  path: string;
  /** Where the field is, in words: "Order Types › In-Kind › T+1". */
  where: string;
  message: string;
  target: Target;
};

/* Field paths. Components ask for issues by the same strings. */
export const path = {
  detail: (key: DetailKey) => `details.${key}`,
  orderTypes: "orderTypes",
  defaultCreation: "defaults.creation",
  defaultRedemption: "defaults.redemption",
  otName: (id: string) => `ot.${id}.name`,
  otDirections: (id: string) => `ot.${id}.directions`,
  otPeriods: (id: string) => `ot.${id}.periods`,
  periodDirections: (id: string, day: number) => `ot.${id}.p${day}.directions`,
  periodCns: (id: string, day: number) => `ot.${id}.p${day}.cns`,
  periodApproval: (id: string, day: number) => `ot.${id}.p${day}.approval`,
  periodT: (id: string, day: number) => `ot.${id}.p${day}.t`,
  periodT1: (id: string, day: number) => `ot.${id}.p${day}.t1`,
  countries: "dist.countries",
  institutions: "dist.institutions",
  cobrandName: "dist.cobrandName",
};

const DETAIL_LABEL = Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, f.label])) as Record<DetailKey, string>;
const DETAIL_SECTION = Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, f.section])) as Record<
  DetailKey,
  (typeof DETAIL_FIELDS)[number]["section"]
>;

const REQUIRED_DETAILS: DetailKey[] = [
  "fundName",
  "fundCode",
  "issuer",
  "isin",
  "listingExchange",
  "region",
  "currency",
  "creationUnitSize",
  "settlementVenue",
  "cutoffTimezone",
  "orderChannel",
];

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(config: FundConfig): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Severity, p: string, where: string, message: string, target: Target) =>
    issues.push({ id: `${p}:${issues.length}`, severity, path: p, where, message, target });

  /* Fund Details */
  const d = config.details;
  const detailIssue = (severity: Severity, key: DetailKey, message: string) =>
    add(severity, path.detail(key), `Fund Details › ${DETAIL_LABEL[key]}`, message, { tab: "details", section: DETAIL_SECTION[key] });

  for (const key of REQUIRED_DETAILS) {
    if (!d[key].trim()) detailIssue("error", key, `${DETAIL_LABEL[key]} is required.`);
  }
  if (d.isin.trim() && !ISIN.test(d.isin.trim())) {
    detailIssue("error", "isin", "ISIN must be 12 characters: 2 letters, 9 letters or digits, then 1 digit.");
  }
  if (d.creationUnitSize.trim() && !(Number(d.creationUnitSize) > 0 && Number.isInteger(Number(d.creationUnitSize)))) {
    detailIssue("error", "creationUnitSize", "Shares per creation unit must be a whole number above zero.");
  }
  if (d.operationsContact.trim() && !EMAIL.test(d.operationsContact.trim())) {
    detailIssue("error", "operationsContact", "Enter a valid email address.");
  }
  if (!d.custodian.trim()) detailIssue("warning", "custodian", "No custodian is set. Orders cannot settle until one is chosen.");
  if (!d.operationsContact.trim()) detailIssue("warning", "operationsContact", "No operations contact. Exceptions will go to the shared mailbox.");

  /* Order Types */
  const enabled = config.orderTypes.filter((o) => o.enabled);
  if (enabled.length === 0) {
    add("error", path.orderTypes, "Order Types", "At least one Order Type must be enabled before the fund can take orders.", { tab: "order-types" });
  }

  const cns = cnsApplies(config);
  for (const o of config.orderTypes) {
    const name = o.name.trim() || "Unnamed Order Type";
    const where = `Order Types › ${name}`;
    const target: Target = { tab: "order-types", orderTypeId: o.id };

    if (!o.name.trim()) add("error", path.otName(o.id), where, "Give this Order Type a name.", target);
    else if (config.orderTypes.some((x) => x.id !== o.id && x.name.trim().toLowerCase() === o.name.trim().toLowerCase())) {
      add("error", path.otName(o.id), where, `Another Order Type is already called "${o.name.trim()}".`, target);
    }

    // A disabled Order Type keeps its configuration but is not checked
    // further: it is out of use, so it cannot block submission.
    if (!o.enabled) continue;

    if (!o.creation && !o.redemption) {
      add("error", path.otDirections(o.id), where, "Enable Creation, Redemption, or both.", target);
    }

    const act = activePeriods(o);
    if (act.length === 0) {
      add("error", path.otPeriods(o.id), `${where} › Settlement Periods`, "Turn on at least one Settlement Period.", target);
    } else {
      if (o.creation && !act.some((p) => p.creationAllowed)) {
        add("error", path.otPeriods(o.id), `${where} › Settlement Periods`, "Creation is enabled, but no active Settlement Period allows Creation.", target);
      }
      if (o.redemption && !act.some((p) => p.redemptionAllowed)) {
        add("error", path.otPeriods(o.id), `${where} › Settlement Periods`, "Redemption is enabled, but no active Settlement Period allows Redemption.", target);
      }
    }

    for (const p of act) {
      const pw = `${where} › ${periodLabel(p.day)}`;
      if (!p.creationAllowed && !p.redemptionAllowed) {
        add("error", path.periodDirections(o.id, p.day), pw, "Allow Creation, Redemption, or both, or turn this period off.", target);
      }
      if (p.creationAllowed && !o.creation) {
        add("error", path.periodDirections(o.id, p.day), pw, "Creation is allowed here, but the Order Type is not enabled for Creation.", target);
      }
      if (p.redemptionAllowed && !o.redemption) {
        add("error", path.periodDirections(o.id, p.day), pw, "Redemption is allowed here, but the Order Type is not enabled for Redemption.", target);
      }
      if (!p.tOpen || !p.tClose) {
        add("error", path.periodT(o.id, p.day), pw, "Set both the open and close time for trade date.", target);
      } else if (p.tOpen >= p.tClose) {
        add("error", path.periodT(o.id, p.day), pw, "The trade date window must open before it closes.", target);
      }
      if (Boolean(p.t1Open) !== Boolean(p.t1Close)) {
        add("error", path.periodT1(o.id, p.day), pw, "Set both times for the day before trade date, or leave both empty.", target);
      } else if (p.t1Open && p.t1Open >= p.t1Close) {
        add("error", path.periodT1(o.id, p.day), pw, "The window on the day before trade date must open before it closes.", target);
      }
      if (p.cns && !cns) {
        add("warning", path.periodCns(o.id, p.day), pw, `CNS is selected, but ${d.settlementVenue || "the settlement venue"} does not offer CNS. It will be ignored.`, target);
      }
      if (p.day === 0 && !p.approvalRequired) {
        add("warning", path.periodApproval(o.id, p.day), pw, "Same-day settlement without approval. Most funds require approval on T+0.", target);
      }
    }
  }

  /* Defaults */
  const checkDefault = (id: string | null, kind: "Creation" | "Redemption", p: string) => {
    const ok = (o: OrderType) => (kind === "Creation" ? o.creation : o.redemption);
    if (id) {
      const o = config.orderTypes.find((x) => x.id === id);
      if (!o) add("error", p, `Order Types › Default ${kind} Order Type`, "The chosen default no longer exists. Pick another or choose no default.", { tab: "order-types" });
      else if (!o.enabled) add("error", p, `Order Types › Default ${kind} Order Type`, `"${o.name}" is disabled, so it cannot be the default for ${kind}.`, { tab: "order-types" });
      else if (!ok(o)) add("error", p, `Order Types › Default ${kind} Order Type`, `"${o.name}" is not enabled for ${kind}.`, { tab: "order-types" });
    } else if (enabled.filter(ok).length > 1) {
      add("warning", p, `Order Types › Default ${kind} Order Type`, `More than one Order Type allows ${kind} and no default is chosen. Users will have to pick each time.`, { tab: "order-types" });
    }
  };
  checkDefault(config.defaultCreationId, "Creation", path.defaultCreation);
  checkDefault(config.defaultRedemptionId, "Redemption", path.defaultRedemption);

  /* Fund Distribution */
  const dist = config.distribution;
  if (dist.countries.length === 0) {
    add("error", path.countries, "Fund Distribution › Countries", "Choose at least one country where the fund is distributed.", { tab: "distribution" });
  }
  if (dist.institutionMode === "selected" && dist.institutions.length === 0) {
    add("error", path.institutions, "Fund Distribution › Institutions", "Choose at least one institution, or switch to all institutions.", { tab: "distribution" });
  }
  if (dist.cobrand && !dist.cobrandName.trim()) {
    add("error", path.cobrandName, "Fund Distribution › Co-brand", "Enter the co-brand name, or turn co-branding off.", { tab: "distribution" });
  }

  return issues;
}

export function issuesAt(issues: Issue[], p: string): Issue[] {
  return issues.filter((i) => i.path === p);
}

export function issuesForOrderType(issues: Issue[], id: string): Issue[] {
  return issues.filter((i) => i.path.startsWith(`ot.${id}.`));
}

export function countBySeverity(issues: Issue[]): { errors: number; warnings: number } {
  const errors = issues.filter((i) => i.severity === "error").length;
  return { errors, warnings: issues.length - errors };
}

/* ------------------------------------------------------------------ */
/* Comparing a pending configuration with the active one               */
/* ------------------------------------------------------------------ */

export type FieldChange = { label: string; area: string; before: string; after: string; target: Target };

export type OrderTypeChangeKind = "added" | "removed" | "edited" | "enabled" | "disabled";

export type OrderTypeChange = {
  id: string;
  name: string;
  kind: OrderTypeChangeKind;
  /** What changed inside it, one line each. Empty for a plain enable/disable. */
  lines: { label: string; before: string; after: string }[];
};

export type Diff = { fields: FieldChange[]; orderTypes: OrderTypeChange[] };

const yn = (v: boolean) => (v ? "Yes" : "No");
const blank = (v: string) => (v.trim() ? v : "Not set");
const win = (open: string, close: string) => (open || close ? `${open || "?"} to ${close || "?"}` : "Not accepted");

function orderTypeLines(a: OrderType, b: OrderType): OrderTypeChange["lines"] {
  const lines: OrderTypeChange["lines"] = [];
  const cmp = (label: string, before: string, after: string) => {
    if (before !== after) lines.push({ label, before, after });
  };
  cmp("Name", blank(a.name), blank(b.name));
  cmp("Code", blank(a.code), blank(b.code));
  cmp("Basket", a.basket, b.basket);
  cmp("Order direction", directionLabel(a), directionLabel(b));
  cmp("Assisted Trading", yn(a.assistedTrading), yn(b.assistedTrading));
  cmp("Cash-in-Lieu", yn(a.cashInLieu), yn(b.cashInLieu));
  cmp("Directed Trading", yn(a.directedTrading), yn(b.directedTrading));
  for (const day of SETTLEMENT_DAYS) {
    const pa = a.periods[day];
    const pb = b.periods[day];
    const t = periodLabel(day);
    cmp(`${t} · Status`, pa.active ? "Active" : "Inactive", pb.active ? "Active" : "Inactive");
    // Detail of a period that is off on both sides is noise.
    if (!pa.active && !pb.active) continue;
    cmp(`${t} · Creation allowed`, yn(pa.creationAllowed), yn(pb.creationAllowed));
    cmp(`${t} · Redemption allowed`, yn(pa.redemptionAllowed), yn(pb.redemptionAllowed));
    cmp(`${t} · Approval required`, yn(pa.approvalRequired), yn(pb.approvalRequired));
    cmp(`${t} · CNS`, yn(pa.cns), yn(pb.cns));
    cmp(`${t} · Trade date window`, win(pa.tOpen, pa.tClose), win(pb.tOpen, pb.tClose));
    cmp(`${t} · Day-before window`, win(pa.t1Open, pa.t1Close), win(pb.t1Open, pb.t1Close));
  }
  return lines;
}

/** The headline facts of an Order Type that has no earlier version. */
export function newOrderTypeLines(o: OrderType): OrderTypeChange["lines"] {
  const act = activePeriods(o);
  return [
    { label: "Order direction", before: "", after: directionLabel(o) },
    { label: "Basket", before: "", after: o.basket },
    { label: "Settlement Periods", before: "", after: act.length ? act.map((p) => periodLabel(p.day)).join(", ") : "None active" },
  ];
}

const list = (items: string[]) => (items.length ? [...items].sort().join(", ") : "None");

export function diffConfigs(active: FundConfig, pending: FundConfig, institutionName: (id: string) => string): Diff {
  const fields: FieldChange[] = [];

  for (const f of DETAIL_FIELDS) {
    const before = active.details[f.key];
    const after = pending.details[f.key];
    if (before !== after) {
      fields.push({ label: f.label, area: "Fund Details", before: blank(before), after: blank(after), target: { tab: "details", section: f.section } });
    }
  }

  const otName = (config: FundConfig, id: string | null) => (id ? (config.orderTypes.find((o) => o.id === id)?.name ?? "Removed Order Type") : "No default");
  const pushIf = (label: string, area: string, before: string, after: string, target: Target) => {
    if (before !== after) fields.push({ label, area, before, after, target });
  };
  pushIf("Default Creation Order Type", "Order Types", otName(active, active.defaultCreationId), otName(pending, pending.defaultCreationId), { tab: "order-types" });
  pushIf("Default Redemption Order Type", "Order Types", otName(active, active.defaultRedemptionId), otName(pending, pending.defaultRedemptionId), { tab: "order-types" });

  const da = active.distribution;
  const dp = pending.distribution;
  const dt: Target = { tab: "distribution" };
  pushIf("Countries", "Fund Distribution", list(da.countries), list(dp.countries), dt);
  pushIf("Available to", "Fund Distribution", da.institutionMode === "all" ? "All institutions" : "Selected institutions", dp.institutionMode === "all" ? "All institutions" : "Selected institutions", dt);
  pushIf(
    "Selected institutions",
    "Fund Distribution",
    da.institutionMode === "all" ? "Not used" : list(da.institutions.map(institutionName)),
    dp.institutionMode === "all" ? "Not used" : list(dp.institutions.map(institutionName)),
    dt,
  );
  pushIf("Co-brand", "Fund Distribution", da.cobrand ? blank(da.cobrandName) : "Off", dp.cobrand ? blank(dp.cobrandName) : "Off", dt);

  const orderTypes: OrderTypeChange[] = [];
  for (const b of pending.orderTypes) {
    const a = active.orderTypes.find((o) => o.id === b.id);
    const name = b.name.trim() || "Unnamed Order Type";
    if (!a) {
      orderTypes.push({ id: b.id, name, kind: "added", lines: newOrderTypeLines(b) });
      continue;
    }
    if (a.enabled !== b.enabled) orderTypes.push({ id: b.id, name, kind: b.enabled ? "enabled" : "disabled", lines: [] });
    const lines = orderTypeLines(a, b);
    if (lines.length) orderTypes.push({ id: b.id, name, kind: "edited", lines });
  }
  for (const a of active.orderTypes) {
    if (!pending.orderTypes.some((o) => o.id === a.id)) orderTypes.push({ id: a.id, name: a.name, kind: "removed", lines: [] });
  }

  return { fields, orderTypes };
}

export function diffCount(diff: Diff): number {
  return diff.fields.length + diff.orderTypes.length;
}
