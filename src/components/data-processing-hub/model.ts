import type { Tone } from "../patterns";

/* Data Processing Hub — mock model.
 *
 * Three sources feed the hub every business date: FMR files, and MDM and MRD
 * loads. Each file or load carries records that move through five stages.
 * Everything here is deterministic: loads are written out by hand below and
 * their records are generated from a seed taken from the load ID, so the same
 * record always has the same ID and the same outcome.
 *
 * Replay state is not stored here. It lives in memory in ReplayProvider and
 * is passed in as `runs`, so every number on screen is derived from the mock
 * data plus the replays run in this session. */

/* ---- sources and dates -------------------------------------------- */

export type SourceId = "FMR" | "MDM" | "MRD";

export const SOURCE_IDS: SourceId[] = ["FMR", "MDM", "MRD"];

export const SOURCES: Record<SourceId, { label: string; unit: string; units: string; about: string }> = {
  FMR: { label: "FMR files", unit: "file", units: "files", about: "Position, transaction and cash files" },
  MDM: { label: "MDM loads", unit: "load", units: "loads", about: "Accounts, funds and counterparties" },
  MRD: { label: "MRD loads", unit: "load", units: "loads", about: "Securities, FX rates and calendars" },
};

export type BusinessDate = { iso: string; label: string; short: string };

/** Newest first. */
export const BUSINESS_DATES: BusinessDate[] = [
  { iso: "2026-11-17", label: "Tue 17 Nov 2026", short: "Tue 17 Nov" },
  { iso: "2026-11-16", label: "Mon 16 Nov 2026", short: "Mon 16 Nov" },
  { iso: "2026-11-13", label: "Fri 13 Nov 2026", short: "Fri 13 Nov" },
];

const PREVIOUS_DATE: Record<string, string> = {
  "2026-11-17": "2026-11-16",
  "2026-11-16": "2026-11-13",
  "2026-11-13": "2026-11-12",
};

export const dateLabel = (iso: string) => BUSINESS_DATES.find((d) => d.iso === iso)?.label ?? iso;

const versionOf = (kind: "MDM" | "MRD", iso: string) => `${kind} ${iso.replaceAll("-", ".")}-1`;

/* ---- stages -------------------------------------------------------- */

export const STAGES = ["Received", "Validation", "Enrichment", "Load", "Published"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_ABOUT: Record<Stage, string> = {
  Received: "The record arrived in the hub.",
  Validation: "Required fields and formats were checked.",
  Enrichment: "The record was matched to MDM and MRD reference data.",
  Load: "The record was saved to the hub.",
  Published: "The record was delivered to downstream systems.",
};

/* ---- failure reasons ------------------------------------------------ */

export type ReasonCode =
  | "ACCOUNT_NOT_IN_MDM"
  | "SECURITY_NOT_IN_MRD"
  | "MISSING_SETTLE_DATE"
  | "DUPLICATE"
  | "INVALID_CCY"
  | "PARENT_MISSING"
  | "MISSING_LEI"
  | "DB_TIMEOUT"
  | "BAD_CHECK_DIGIT"
  | "RATE_OUT_OF_RANGE";

export type Reason = {
  /** One line, written for a Support user. Shown in the grid. */
  label: string;
  stage: Stage;
  /** True when reprocessing the load clears the failure without new data. */
  fixedByReplay: boolean;
  /** Technical error code, shown only in the collapsed section. */
  errorCode: string;
  what: (r: HubRecord, l: Load) => string;
  why: (r: HubRecord, l: Load) => string;
  impact: (r: HubRecord, l: Load) => string;
  next: (r: HubRecord, l: Load) => string;
  technical: (r: HubRecord, l: Load) => string;
};

const unitOf = (l: Load) => SOURCES[l.source].unit;

export const REASONS: Record<ReasonCode, Reason> = {
  ACCOUNT_NOT_IN_MDM: {
    label: "Account not set up in MDM",
    stage: "Enrichment",
    fixedByReplay: true,
    errorCode: "ENR-4041",
    what: (r) => `This ${r.recordType.toLowerCase()} record for ${r.subject} arrived and passed its checks, but it could not be matched to an account, so it was not loaded.`,
    why: (r, l) => `The record refers to account ${r.account}. That account was not in the MDM version used when the file was processed (${l.mdmVersion}). It was added by a later MDM load.`,
    impact: () => "This record has not been delivered to downstream reporting. The other records in the file are not affected.",
    next: () => "Replay the file. The account is now in MDM, so the record should go through.",
    technical: (r, l) => `AccountLookupMiss: account_id=${r.account} not found in ${l.mdmVersion} (line ${r.lineNo})`,
  },
  SECURITY_NOT_IN_MRD: {
    label: "Security not recognised in MRD",
    stage: "Enrichment",
    fixedByReplay: true,
    errorCode: "ENR-4042",
    what: (r) => `This ${r.recordType.toLowerCase()} record for ${r.subject} arrived and passed its checks, but its security could not be matched, so it was not loaded.`,
    why: (r, l) => `The record uses security ${r.instrument}. That security was not in the MRD version used when the file was processed (${l.mrdVersion}).`,
    impact: () => "This record has not been delivered to downstream reporting. The other records in the file are not affected.",
    next: () => "Replay the file once the MRD securities load for this date has completed. The security will then be recognised.",
    technical: (r, l) => `SecurityLookupMiss: isin=${r.instrument} not found in ${l.mrdVersion} (line ${r.lineNo})`,
  },
  MISSING_SETTLE_DATE: {
    label: "Required field missing: settlement date",
    stage: "Validation",
    fixedByReplay: false,
    errorCode: "VAL-1007",
    what: (r) => `This ${r.recordType.toLowerCase()} record for ${r.subject} arrived but was rejected at the first check.`,
    why: () => "The settlement date is empty in the file. A record cannot be processed without it.",
    impact: () => "This record has not been delivered to downstream reporting. The other records in the file are not affected.",
    next: () => "Ask the file sender for a corrected record. Replaying the same file will not fix this one, because the data in the file is incomplete.",
    technical: (r) => `RequiredFieldMissing: field=settlement_date value=<empty> (line ${r.lineNo})`,
  },
  DUPLICATE: {
    label: "Duplicate of a record already processed",
    stage: "Validation",
    fixedByReplay: false,
    errorCode: "VAL-1020",
    what: (r) => `This ${r.recordType.toLowerCase()} record for ${r.subject} arrived but was set aside.`,
    why: () => "An identical record was already processed earlier on the same business date, in another file.",
    impact: () => "None. The first copy was delivered, and this copy was set aside so nothing is counted twice.",
    next: () => "No action needed. If the same sender keeps sending duplicates, let them know.",
    technical: (r) => `DuplicateKey: reference=${r.reference} already processed for this business date (line ${r.lineNo})`,
  },
  INVALID_CCY: {
    label: "Currency code not recognised",
    stage: "Validation",
    fixedByReplay: false,
    errorCode: "VAL-1012",
    what: (r) => `This ${r.recordType.toLowerCase()} record for ${r.subject} arrived but was rejected at the first check.`,
    why: (r) => `The record uses the currency code "${r.currency}", which is not a valid currency code. It is probably a typing error at the sender.`,
    impact: () => "This record has not been delivered to downstream reporting. The other records in the file are not affected.",
    next: () => "Ask the file sender for a corrected record. Replaying the same file will not fix this one.",
    technical: (r) => `InvalidCurrency: currency=${r.currency} not in ISO 4217 list (line ${r.lineNo})`,
  },
  PARENT_MISSING: {
    label: "Parent fund not found",
    stage: "Enrichment",
    fixedByReplay: true,
    errorCode: "ENR-4060",
    what: (r) => `The update for ${r.subject} arrived and passed its checks, but it could not be linked to its parent fund, so it was not applied.`,
    why: () => "The parent fund had not been loaded yet when this load ran. It arrived in a later load.",
    impact: () => "This account is not up to date in MDM. FMR records that refer to it may fail until it is.",
    next: () => "Replay the load. The parent fund is now in MDM, so the update should go through.",
    technical: (r) => `ParentNotFound: entity_id=${r.reference} parent_fund unresolved (line ${r.lineNo})`,
  },
  MISSING_LEI: {
    label: "Required field missing: legal entity identifier (LEI)",
    stage: "Validation",
    fixedByReplay: false,
    errorCode: "VAL-1031",
    what: (r) => `The update for ${r.subject} arrived but was rejected at the first check.`,
    why: () => "The legal entity identifier (LEI) is empty. It is required for this type of record.",
    impact: () => "This update was not applied. MDM still holds the previous details for this record.",
    next: () => "Ask the client data team to complete the LEI in the source system. The corrected record will arrive in the next load. A replay will not fix it.",
    technical: (r) => `RequiredFieldMissing: field=lei value=<empty> entity_id=${r.reference} (line ${r.lineNo})`,
  },
  DB_TIMEOUT: {
    label: "Load stopped: reference database did not respond",
    stage: "Load",
    fixedByReplay: true,
    errorCode: "LOD-5003",
    what: (r, l) => `This record for ${r.subject} arrived and passed its checks, but the whole ${unitOf(l)} stopped before any record was saved.`,
    why: () => "The reference database did not respond in time, so the load was stopped. This is a system problem. Nothing is wrong with the data.",
    impact: (_r, l) => `This security is missing from ${l.mrdVersion}. FMR records that use it fail with "Security not recognised in MRD".`,
    next: () => "Replay the load. No data correction is needed.",
    technical: (r) => `WriteTimeout: ref_db did not acknowledge batch within 300s; batch rolled back (line ${r.lineNo})`,
  },
  BAD_CHECK_DIGIT: {
    label: "Security identifier is not valid",
    stage: "Validation",
    fixedByReplay: false,
    errorCode: "VAL-1044",
    what: (r) => `The record for ${r.subject} arrived but was rejected at the first check.`,
    why: (r) => `The identifier ${r.reference} fails its built-in check, so it was probably mistyped by the data provider.`,
    impact: () => "This security was not published. Records that use it will fail until a corrected identifier arrives.",
    next: () => "Ask the market data provider for a corrected record. A replay will not fix it.",
    technical: (r) => `CheckDigitMismatch: isin=${r.reference} (line ${r.lineNo})`,
  },
  RATE_OUT_OF_RANGE: {
    label: "FX rate outside the accepted range",
    stage: "Validation",
    fixedByReplay: false,
    errorCode: "VAL-1050",
    what: (r) => `The ${r.subject} arrived but was held back at the first check.`,
    why: (r) => `The rate received for ${r.reference} differs from the previous day's rate by more than the 10% limit, so it was held and not published.`,
    impact: (r) => `The previous day's rate is still in use for ${r.reference}.`,
    next: () => "Confirm the rate with the rate provider. If it is wrong, a corrected rate will arrive in the next load. A replay will not change the result.",
    technical: (r) => `RangeCheckFailed: pair=${r.reference} rate=${r.amount} tolerance=10% (line ${r.lineNo})`,
  },
};

/* ---- loads ---------------------------------------------------------- */

export type ReplayOutcome = "Completed" | "Failed";

export type Load = {
  id: string;
  source: SourceId;
  businessDate: string;
  /** File name for FMR, load name for MDM and MRD. */
  name: string;
  recordType: string;
  /** HH:MM */
  receivedAt: string;
  total: number;
  /** As first processed, before any replay. */
  failures: { code: ReasonCode; count: number }[];
  /** True when the load stopped and every record failed. */
  wholeFailure: boolean;
  /** Another load that has to complete before this one can be replayed. */
  blockedBy: string | null;
  /** Result of the first replay, the second, and so on. The last one repeats. */
  replayOutcomes: ReplayOutcome[];
  /** Versions used when the load was first processed. Null when not used. */
  mdmVersion: string | null;
  mrdVersion: string;
};

type LoadSpec = {
  source: SourceId;
  name: string;
  recordType: string;
  at: string;
  total: number;
  fails?: [ReasonCode, number][];
  wholeFail?: ReasonCode;
  blockedBySeq?: { source: SourceId; seq: number };
  replayOutcomes?: ReplayOutcome[];
};

const fmr = (kind: string, region: string, iso: string) => `FMR_${kind}_${region}_${iso.replaceAll("-", "")}.csv`;

const SPECS: Record<string, LoadSpec[]> = {
  "2026-11-17": [
    { source: "FMR", name: fmr("POSITIONS", "EMEA", "2026-11-17"), recordType: "Position", at: "05:52", total: 1240, fails: [["ACCOUNT_NOT_IN_MDM", 6], ["MISSING_SETTLE_DATE", 2]] },
    { source: "FMR", name: fmr("POSITIONS", "AMER", "2026-11-17"), recordType: "Position", at: "06:10", total: 1480 },
    { source: "FMR", name: fmr("TRANSACTIONS", "EMEA", "2026-11-17"), recordType: "Transaction", at: "06:18", total: 860, fails: [["SECURITY_NOT_IN_MRD", 14]], blockedBySeq: { source: "MRD", seq: 1 } },
    { source: "FMR", name: fmr("TRANSACTIONS", "AMER", "2026-11-17"), recordType: "Transaction", at: "06:31", total: 920 },
    { source: "FMR", name: fmr("CASH", "APAC", "2026-11-17"), recordType: "Cash balance", at: "04:45", total: 310, fails: [["DUPLICATE", 3], ["INVALID_CCY", 1]] },
    { source: "MDM", name: "Accounts and funds, morning load", recordType: "Account", at: "05:05", total: 640, fails: [["PARENT_MISSING", 4], ["MISSING_LEI", 1]] },
    { source: "MDM", name: "Counterparties, morning load", recordType: "Counterparty", at: "05:20", total: 210 },
    { source: "MDM", name: "Accounts and funds, intraday load", recordType: "Account", at: "09:15", total: 85 },
    { source: "MRD", name: "Securities, overnight load", recordType: "Security", at: "05:30", total: 1120, wholeFail: "DB_TIMEOUT" },
    { source: "MRD", name: "FX rates, 06:00 load", recordType: "FX rate", at: "06:00", total: 180, fails: [["RATE_OUT_OF_RANGE", 2]] },
    { source: "MRD", name: "Holiday calendars, weekly load", recordType: "Holiday calendar", at: "05:35", total: 95 },
  ],
  "2026-11-16": [
    { source: "FMR", name: fmr("POSITIONS", "EMEA", "2026-11-16"), recordType: "Position", at: "05:49", total: 1215 },
    { source: "FMR", name: fmr("POSITIONS", "AMER", "2026-11-16"), recordType: "Position", at: "06:12", total: 1502, fails: [["SECURITY_NOT_IN_MRD", 2], ["MISSING_SETTLE_DATE", 1]] },
    { source: "FMR", name: fmr("TRANSACTIONS", "EMEA", "2026-11-16"), recordType: "Transaction", at: "06:20", total: 790 },
    { source: "FMR", name: fmr("TRANSACTIONS", "AMER", "2026-11-16"), recordType: "Transaction", at: "06:28", total: 1010 },
    { source: "FMR", name: fmr("CASH", "APAC", "2026-11-16"), recordType: "Cash balance", at: "04:41", total: 305 },
    { source: "MDM", name: "Accounts and funds, morning load", recordType: "Account", at: "05:04", total: 610, fails: [["PARENT_MISSING", 5]], replayOutcomes: ["Failed", "Completed"] },
    { source: "MDM", name: "Counterparties, morning load", recordType: "Counterparty", at: "05:19", total: 198 },
    { source: "MRD", name: "Securities, overnight load", recordType: "Security", at: "05:31", total: 1094, fails: [["BAD_CHECK_DIGIT", 1]] },
    { source: "MRD", name: "FX rates, 06:00 load", recordType: "FX rate", at: "06:00", total: 180 },
  ],
  "2026-11-13": [
    { source: "FMR", name: fmr("POSITIONS", "EMEA", "2026-11-13"), recordType: "Position", at: "05:55", total: 1198 },
    { source: "FMR", name: fmr("POSITIONS", "AMER", "2026-11-13"), recordType: "Position", at: "06:09", total: 1467 },
    { source: "FMR", name: fmr("TRANSACTIONS", "EMEA", "2026-11-13"), recordType: "Transaction", at: "06:17", total: 905 },
    { source: "FMR", name: fmr("TRANSACTIONS", "AMER", "2026-11-13"), recordType: "Transaction", at: "06:33", total: 1122 },
    { source: "FMR", name: fmr("CASH", "APAC", "2026-11-13"), recordType: "Cash balance", at: "04:47", total: 298, fails: [["DUPLICATE", 2]] },
    { source: "MDM", name: "Accounts and funds, morning load", recordType: "Account", at: "05:06", total: 588 },
    { source: "MDM", name: "Counterparties, morning load", recordType: "Counterparty", at: "05:21", total: 204 },
    { source: "MRD", name: "Securities, overnight load", recordType: "Security", at: "05:29", total: 1071 },
    { source: "MRD", name: "FX rates, 06:00 load", recordType: "FX rate", at: "06:00", total: 180 },
  ],
};

const loadId = (source: SourceId, iso: string, seq: number) => `${source}-${iso.replaceAll("-", "")}-${String(seq).padStart(3, "0")}`;

function buildLoads(): Load[] {
  const out: Load[] = [];
  for (const [iso, specs] of Object.entries(SPECS)) {
    // The MRD version for a date is only available once its securities load
    // has completed. Until then everything else uses the previous version.
    const mrdStopped = specs.some((s) => s.source === "MRD" && s.wholeFail);
    const seq: Record<SourceId, number> = { FMR: 0, MDM: 0, MRD: 0 };
    for (const s of specs) {
      seq[s.source] += 1;
      out.push({
        id: loadId(s.source, iso, seq[s.source]),
        source: s.source,
        businessDate: iso,
        name: s.name,
        recordType: s.recordType,
        receivedAt: s.at,
        total: s.total,
        failures: s.wholeFail ? [{ code: s.wholeFail, count: s.total }] : (s.fails ?? []).map(([code, count]) => ({ code, count })),
        wholeFailure: Boolean(s.wholeFail),
        blockedBy: s.blockedBySeq ? loadId(s.blockedBySeq.source, iso, s.blockedBySeq.seq) : null,
        replayOutcomes: s.replayOutcomes ?? ["Completed"],
        mdmVersion: s.source === "MRD" ? null : versionOf("MDM", iso),
        mrdVersion: s.source !== "MRD" && mrdStopped ? versionOf("MRD", PREVIOUS_DATE[iso]) : versionOf("MRD", iso),
      });
    }
  }
  return out;
}

export const LOADS: Load[] = buildLoads();

const LOAD_BY_ID = new Map(LOADS.map((l) => [l.id, l]));

export const loadById = (id: string) => LOAD_BY_ID.get(id) as Load;

export const loadsFor = (iso: string, source: SourceId) => LOADS.filter((l) => l.businessDate === iso && l.source === source);

/* ---- replay ---------------------------------------------------------- */

/** The steps a replay passes through before it ends. */
export const REPLAY_STEPS = ["Submitted", "Accepted", "Queued", "In Progress"] as const;
export type ReplayStatus = (typeof REPLAY_STEPS)[number] | ReplayOutcome;

export type ReplayRun = {
  id: string;
  loadId: string;
  status: ReplayStatus;
  /** Each status reached and the wall-clock time it was reached. */
  history: { status: ReplayStatus; at: string }[];
};

export const isInFlight = (run: ReplayRun) => run.status !== "Completed" && run.status !== "Failed";

/** "Replay step 3 of 5: Queued", or the final result. */
export function replaySummary(run: ReplayRun): string {
  if (run.status === "Completed") return "Replay completed";
  if (run.status === "Failed") return "Replay failed";
  const i = REPLAY_STEPS.indexOf(run.status);
  return `Replay step ${i + 1} of ${REPLAY_STEPS.length + 1}: ${run.status}`;
}

const hasCompletedReplay =(id: string, runs: ReplayRun[]) => runs.some((r) => r.loadId === id && r.status === "Completed");

/* ---- load status, derived from the mock data plus this session's replays */

export type LoadStatus = "Completed" | "Completed with failures" | "Failed" | "Replaying";

export const LOAD_STATUS: Record<LoadStatus, { tone: Tone; glyph: string }> = {
  Completed: { tone: "positive", glyph: "✓" },
  "Completed with failures": { tone: "warning", glyph: "!" },
  Failed: { tone: "negative", glyph: "✕" },
  Replaying: { tone: "info", glyph: "↻" },
};

export type LoadView = {
  load: Load;
  status: LoadStatus;
  failed: number;
  processed: number;
  /** Failure reasons still open, largest first. */
  reasons: { code: ReasonCode; count: number }[];
  /** Failed records a replay is expected to clear. */
  fixable: number;
  activeRun: ReplayRun | null;
  lastRun: ReplayRun | null;
  /** True once a replay has completed for this load. */
  recovered: boolean;
  ready: boolean;
  /** Why the load cannot be replayed now. Null when it is ready. */
  notReadyReason: string | null;
};

export function loadView(load: Load, runs: ReplayRun[]): LoadView {
  const own = runs.filter((r) => r.loadId === load.id);
  const activeRun = own.find(isInFlight) ?? null;
  const lastRun = own.length > 0 ? own[own.length - 1] : null;
  const recovered = own.some((r) => r.status === "Completed");

  const reasons = load.failures.filter((f) => !(recovered && REASONS[f.code].fixedByReplay)).sort((a, b) => b.count - a.count);
  const failed = reasons.reduce((s, f) => s + f.count, 0);
  const fixable = reasons.filter((f) => REASONS[f.code].fixedByReplay).reduce((s, f) => s + f.count, 0);

  const status: LoadStatus = activeRun ? "Replaying" : failed === 0 ? "Completed" : failed === load.total ? "Failed" : "Completed with failures";

  const unit = SOURCES[load.source].unit;
  let notReadyReason: string | null = null;
  if (activeRun) {
    notReadyReason = `A replay is already running for this ${unit}. Wait for it to finish.`;
  } else if (failed === 0) {
    notReadyReason = `This ${unit} has no failed records, so there is nothing to replay.`;
  } else if (load.blockedBy && !hasCompletedReplay(load.blockedBy, runs)) {
    const blocker = loadById(load.blockedBy);
    notReadyReason = `Waiting for ${SOURCES[blocker.source].label.replace(/s$/, "")} ${blocker.id} (${blocker.name}) to complete. Replay that load first, otherwise the same records will fail again.`;
  } else if (fixable === 0) {
    notReadyReason = `A replay would not change the result. The ${failed === 1 ? "failed record needs" : `${failed} failed records need`} corrected data from the sender, or no action at all.`;
  }

  return { load, status, failed, processed: load.total - failed, reasons, fixable, activeRun, lastRun, recovered, ready: notReadyReason === null, notReadyReason };
}

/** Versions a replay started now would use. */
export function replayVersions(load: Load, runs: ReplayRun[]): { mdm: string | null; mrd: string } {
  const iso = load.businessDate;
  const stopped = LOADS.some((l) => l.businessDate === iso && l.source === "MRD" && l.wholeFailure && l.id !== load.id && !hasCompletedReplay(l.id, runs));
  return {
    mdm: load.source === "MRD" ? null : versionOf("MDM", iso),
    mrd: stopped ? versionOf("MRD", PREVIOUS_DATE[iso]) : versionOf("MRD", iso),
  };
}

/** What the open failures on a load mean for the business, in one or two sentences. */
export function loadImpact(v: LoadView): string {
  const { load, failed, processed } = v;
  if (failed === 0) return "None. Every record was processed.";
  if (failed === load.total) {
    if (load.source === "MRD") {
      return `None of the ${num(load.total)} records in this load were saved, so ${load.mrdVersion} has not been published. FMR files for ${dateLabel(load.businessDate)} are being checked against the previous MRD version, and records that use new securities fail.`;
    }
    return `None of the ${num(load.total)} records in this ${SOURCES[load.source].unit} were processed. Nothing from it has reached downstream systems.`;
  }
  const records = failed === 1 ? "1 record has" : `${num(failed)} records have`;
  if (load.source === "FMR") return `${records} not been delivered to downstream reporting. The other ${num(processed)} were delivered as normal.`;
  if (load.source === "MDM") return `${failed === 1 ? "1 update was" : `${num(failed)} updates were`} not applied to MDM. FMR records that refer to them may fail until they are.`;
  return `${failed === 1 ? "1 reference record was" : `${num(failed)} reference records were`} not published. The previous values stay in use for them.`;
}

/* ---- records --------------------------------------------------------- */

export type RecordStatus = "Processed" | "Failed";

export const RECORD_STATUS: Record<RecordStatus, { tone: Tone; glyph: string }> = {
  Processed: { tone: "positive", glyph: "✓" },
  Failed: { tone: "negative", glyph: "✕" },
};

export type HubRecord = {
  id: string;
  loadId: string;
  loadName: string;
  source: SourceId;
  status: RecordStatus;
  /** The stage reached. For a failed record, the stage it stopped at. */
  stage: Stage;
  /** Empty for a processed record. */
  failureReason: string;
  /** The reason the record failed when first processed. Kept after a replay clears it. */
  reasonCode: ReasonCode | null;
  errorCode: string;
  /** True when the record failed first and a replay then processed it. */
  recoveredByReplay: boolean;
  recordType: string;
  /** What the record is about, in business terms. */
  subject: string;
  /** The record's own key in the source system. */
  reference: string;
  account: string | null;
  instrument: string | null;
  amount: number | null;
  currency: string | null;
  lineNo: number;
  /** HH:MM:SS */
  updatedAt: string;
};

// Fictional names. None refers to a real fund, issuer or firm.
const FUNDS = ["Northgate Pension Fund", "Harbour Global Equity", "Alder Fixed Income", "Kestrel Multi-Asset", "Brightwater Income", "Stonebridge Growth", "Meridian Balanced", "Larch Emerging Markets", "Fernhill Sustainable", "Quayside Liquidity"];
const SECURITIES = ["Acme Industrial 4.25% 2031", "Borealis Energy ORD", "Calder Bank ORD", "Dunmore Utilities 3.1% 2029", "Everline Health ORD", "Foxhall Retail ORD", "Glenrock Mining ORD", "Halden Telecom 5% 2034", "Ironbridge Rail 2.75% 2030", "Juniper Software ORD", "Kirkstall Foods ORD", "Lowmoor Property REIT"];
const COUNTERPARTIES = ["Fenwick Securities", "Ashdown Brokerage", "Marlow & Pike", "Corbel Capital Markets", "Tideway Clearing", "Hollin Prime Services", "Sable Street Partners", "Wexcombe Trust"];
const SHARE_CLASSES = ["Class A", "Class I", "Custody account", "Collateral account", "Income account"];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "SGD", "HKD"];
const BAD_CURRENCIES = ["USX", "EU", "GPB"];
const FX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/SGD", "USD/HKD", "EUR/GBP", "EUR/JPY", "USD/CAD"];
const EXCHANGES: [string, string][] = [["XLON", "London"], ["XNYS", "New York"], ["XTKS", "Tokyo"], ["XHKG", "Hong Kong"], ["XETR", "Frankfurt"], ["XASX", "Sydney"], ["XSES", "Singapore"], ["XPAR", "Paris"]];
const ISIN_PREFIX = ["US", "GB", "DE", "FR", "JP", "AU"];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function buildRecords(load: Load): HubRecord[] {
  const rnd = mulberry32(hash(load.id));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const digits = (n: number) => String(Math.floor(rnd() * 10 ** n)).padStart(n, "0");
  const isin = () => `${pick(ISIN_PREFIX)}${digits(9)}${digits(1)}`;

  // Which lines failed, and why. A stopped load fails every line.
  const failedAt = new Map<number, ReasonCode>();
  if (!load.wholeFailure) {
    for (const f of load.failures) {
      for (let k = 0; k < f.count; k++) {
        let i = Math.floor(rnd() * load.total);
        while (failedAt.has(i)) i = (i + 1) % load.total;
        failedAt.set(i, f.code);
      }
    }
  }

  const [hh, mm] = load.receivedAt.split(":").map(Number);
  const startSec = hh * 3600 + mm * 60 + 20;

  const out: HubRecord[] = [];
  for (let i = 0; i < load.total; i++) {
    const code = load.wholeFailure ? load.failures[0].code : (failedAt.get(i) ?? null);
    const reason = code ? REASONS[code] : null;

    let subject: string;
    let reference: string;
    let account: string | null = null;
    let instrument: string | null = null;
    let amount: number | null = null;
    let currency: string | null = null;

    switch (load.recordType) {
      case "Position":
      case "Transaction": {
        const fund = pick(FUNDS);
        subject = `${fund} · ${pick(SECURITIES)}`;
        reference = `${load.recordType === "Position" ? "POS" : "TRD"}-${digits(7)}`;
        account = `ACC-${digits(6)}`;
        instrument = isin();
        amount = Math.round((1000 + rnd() * 4_000_000) * 100) / 100;
        currency = pick(CURRENCIES);
        break;
      }
      case "Cash balance": {
        currency = code === "INVALID_CCY" ? pick(BAD_CURRENCIES) : pick(CURRENCIES);
        subject = `${pick(FUNDS)} · ${currency} cash`;
        reference = `CSH-${digits(7)}`;
        account = `ACC-${digits(6)}`;
        amount = Math.round((5000 + rnd() * 9_000_000) * 100) / 100;
        break;
      }
      case "Account": {
        subject = `${pick(FUNDS)}, ${pick(SHARE_CLASSES)}`;
        account = `ACC-${digits(6)}`;
        reference = account;
        break;
      }
      case "Counterparty": {
        subject = pick(COUNTERPARTIES);
        reference = `CPY-${digits(5)}`;
        break;
      }
      case "Security": {
        subject = pick(SECURITIES);
        instrument = isin();
        reference = instrument;
        currency = pick(CURRENCIES);
        break;
      }
      case "FX rate": {
        const pair = FX_PAIRS[i % FX_PAIRS.length];
        subject = `${pair} rate, tenor ${["spot", "1W", "1M", "3M", "6M", "1Y"][Math.floor(i / FX_PAIRS.length) % 6]}`;
        reference = pair;
        amount = Math.round((0.6 + rnd() * 1.2) * 10000) / 10000;
        break;
      }
      default: {
        const [mic, city] = pick(EXCHANGES);
        subject = `${city} market holiday, ${pad2(1 + Math.floor(rnd() * 28))}/${pad2(1 + Math.floor(rnd() * 12))}/2027`;
        reference = mic;
      }
    }

    const sec = startSec + Math.floor((i * 240) / load.total);
    out.push({
      id: `${load.id}-${String(i + 1).padStart(5, "0")}`,
      loadId: load.id,
      loadName: load.name,
      source: load.source,
      status: reason ? "Failed" : "Processed",
      stage: reason ? reason.stage : "Published",
      failureReason: reason ? reason.label : "",
      reasonCode: code,
      errorCode: reason ? reason.errorCode : "",
      recoveredByReplay: false,
      recordType: load.recordType,
      subject,
      reference,
      account,
      instrument,
      amount,
      currency,
      // Line 1 of a file is its header.
      lineNo: i + 2,
      updatedAt: `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor(sec / 60) % 60)}:${pad2(sec % 60)}`,
    });
  }
  return out;
}

const RECORD_CACHE = new Map<string, HubRecord[]>();

function baseRecords(load: Load): HubRecord[] {
  let rows = RECORD_CACHE.get(load.id);
  if (!rows) {
    rows = buildRecords(load);
    RECORD_CACHE.set(load.id, rows);
  }
  return rows;
}

/** A failed record that a completed replay has since processed. */
const recover = (r: HubRecord): HubRecord => ({ ...r, status: "Processed", stage: "Published", failureReason: "", errorCode: "", recoveredByReplay: true });

/** Records of one load, with completed replays applied. */
export function recordsForLoad(load: Load, runs: ReplayRun[]): HubRecord[] {
  const rows = baseRecords(load);
  if (!hasCompletedReplay(load.id, runs)) return rows;
  return rows.map((r) => (r.reasonCode && REASONS[r.reasonCode].fixedByReplay ? recover(r) : r));
}

/** Every record of a source on a business date, with completed replays applied. */
export function recordsFor(iso: string, source: SourceId, runs: ReplayRun[]): HubRecord[] {
  return loadsFor(iso, source).flatMap((l) => recordsForLoad(l, runs));
}

/* ---- formatting ------------------------------------------------------- */

export const num = (n: number) => n.toLocaleString("en-US");

export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
