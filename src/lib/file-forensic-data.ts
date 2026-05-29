/* File-forensic data layer — spec v0.1.2 L4 §0 + §9 open question.
 *
 * In production this hits the file-tracking backend (a separate system
 * from Qlik). Confirm endpoint shape with that team before porting. For
 * the prototype this is a deterministic mock keyed to the existing
 * mandate/stage fixtures, so a chevron click on a real breach in the
 * Ops Overview lands on plausible-looking file evidence.
 *
 * Hard rule (spec §7, rule 26): result set is the smallest possible —
 * never more than what the scope click implied. If a scope ever returns
 * >50 rows the caller should log and surface a warning (spec §8.19).
 */

import type { ForensicScope } from "./forensic-scope";

export type FileStatus = "pending" | "received" | "late" | "failed";

export type DeliveryChannel =
  | "MTEX Email"
  | "SFTP"
  | "Bloomberg Pull"
  | "Custodian Drop"
  | "Internal Upload";

export interface FileEvidence {
  id: string;
  status: FileStatus;
  expectedFilename: string;
  due: string;
  dueCountdownMin: number;
  delivery: DeliveryChannel;
  lastCheck: string;
  /** Minutes since last check for the relative label. */
  lastCheckAgeMin: number;
  /** Full set of forensic fields — surfaced by Show all fields toggle and
   *  row expansion narrative. */
  fileId: string;
  filepath: string;
  emailSubject: string;
  emailFrom: string;
  fileSubject: string;
  filenameReceived: string | null;
  stFolder: string;
  statusLastUpdate: string;
}

const NOW_MIN_OFFSET = 60_000;

function iso(now: number, offsetMin: number): string {
  return new Date(now + offsetMin * NOW_MIN_OFFSET).toISOString();
}

/* Static evidence by mandate-id + stage. Keys reuse the pipeline IDs from
 * qlik.ts so a chevron on the right mandate finds matching files. */
type EvidenceSeed = Omit<
  FileEvidence,
  "due" | "lastCheck" | "statusLastUpdate" | "dueCountdownMin" | "lastCheckAgeMin"
> & {
  dueOffsetMin: number;
  lastCheckOffsetMin: number;
  statusLastUpdateOffsetMin: number;
  lastCheckAgeMin: number;
};

type ScopeKey = `${string}::${string}`;

const SEEDS: Partial<Record<ScopeKey, EvidenceSeed[]>> = {
  "pl-ishares-nav::Estimates": [
    {
      id: "fe-ishares-est-1",
      status: "pending",
      expectedFilename: "SSB_PRICES_AGI_4.xlsx",
      dueOffsetMin: 398, // 16:00 → +6h 38m
      delivery: "MTEX Email",
      lastCheckAgeMin: 8,
      fileId: "MX_3056",
      filepath: "O:\\Overlay Management\\Allianz (AGI)\\NAV File\\",
      emailSubject: "FW AGI Lux NAV Report 4 as of 20260521",
      emailFrom: "MTEX",
      fileSubject: "AGI Lux NAV Report 4",
      filenameReceived: null,
      stFolder: "AGI Lux NAV Report 4",
      lastCheckOffsetMin: -8,
      statusLastUpdateOffsetMin: -8,
    },
  ],
  "pl-cohen-cap::Estimates": [
    {
      id: "fe-cohen-est-1",
      status: "failed",
      expectedFilename: "SSB_NAV_VAL_COHEN_CAP.csv",
      dueOffsetMin: -91,
      delivery: "SFTP",
      lastCheckAgeMin: 2,
      fileId: "SF_1812",
      filepath: "O:\\Capstock\\Cohen & Steers\\Validation\\",
      emailSubject: "(SFTP delivery — no email)",
      emailFrom: "—",
      fileSubject: "NAV validation",
      filenameReceived: "SSB_NAV_VAL_COHEN_CAP_partial.csv",
      stFolder: "Cohen Capstock Validation",
      lastCheckOffsetMin: -2,
      statusLastUpdateOffsetMin: -91,
    },
    {
      id: "fe-cohen-est-2",
      status: "received",
      expectedFilename: "COHEN_CAP_PRICES_AM.xlsx",
      dueOffsetMin: -240,
      delivery: "MTEX Email",
      lastCheckAgeMin: 2,
      fileId: "MX_2014",
      filepath: "O:\\Capstock\\Cohen & Steers\\AM Prices\\",
      emailSubject: "Cohen Capstock AM prices 20260521",
      emailFrom: "MTEX",
      fileSubject: "AM price file",
      filenameReceived: "COHEN_CAP_PRICES_AM.xlsx",
      stFolder: "Cohen Capstock AM Prices",
      lastCheckOffsetMin: -2,
      statusLastUpdateOffsetMin: -240,
    },
  ],
  "pl-cohen-cap::Actuals": [
    {
      id: "fe-cohen-act-1",
      status: "late",
      expectedFilename: "SSB_ACTUALS_COHEN_CAP.xlsx",
      dueOffsetMin: -25,
      delivery: "MTEX Email",
      lastCheckAgeMin: 1,
      fileId: "MX_2087",
      filepath: "O:\\Capstock\\Cohen & Steers\\Actuals\\",
      emailSubject: "Cohen Capstock Actuals 20260521",
      emailFrom: "MTEX",
      fileSubject: "Actuals file",
      filenameReceived: null,
      stFolder: "Cohen Capstock Actuals",
      lastCheckOffsetMin: -1,
      statusLastUpdateOffsetMin: -25,
    },
  ],
  "pl-vanguard-pl::Rebalance": [
    {
      id: "fe-vg-reb-1",
      status: "late",
      expectedFilename: "VG_REBAL_PL.xml",
      dueOffsetMin: -12,
      delivery: "SFTP",
      lastCheckAgeMin: 1,
      fileId: "SF_3344",
      filepath: "O:\\Vanguard\\Rebalance\\",
      emailSubject: "(SFTP delivery — no email)",
      emailFrom: "—",
      fileSubject: "Rebalance feed",
      filenameReceived: null,
      stFolder: "Vanguard Rebalance",
      lastCheckOffsetMin: -1,
      statusLastUpdateOffsetMin: -12,
    },
  ],
  "pl-jpm-liq::Estimates": [
    {
      id: "fe-jpm-est-1",
      status: "failed",
      expectedFilename: "JPM_LIQ_VAL.xlsx",
      dueOffsetMin: -31,
      delivery: "MTEX Email",
      lastCheckAgeMin: 5,
      fileId: "MX_4471",
      filepath: "O:\\JP Morgan\\Liquidity\\Validation\\",
      emailSubject: "JPM Liquidity validation 20260521",
      emailFrom: "MTEX",
      fileSubject: "Liquidity validation",
      filenameReceived: null,
      stFolder: "JPM Liquidity Validation",
      lastCheckOffsetMin: -5,
      statusLastUpdateOffsetMin: -31,
    },
  ],
  "pl-pimco-inc::Estimates": [
    {
      id: "fe-pimco-est-1",
      status: "pending",
      expectedFilename: "PIMCO_INC_VAL_APPROVAL.xlsx",
      dueOffsetMin: -41,
      delivery: "Internal Upload",
      lastCheckAgeMin: 3,
      fileId: "IU_5012",
      filepath: "O:\\PIMCO Income\\Approvals\\",
      emailSubject: "(internal — awaiting approver action)",
      emailFrom: "—",
      fileSubject: "Estimates approval",
      filenameReceived: null,
      stFolder: "PIMCO Income Approval",
      lastCheckOffsetMin: -3,
      statusLastUpdateOffsetMin: -41,
    },
  ],
};

function formatClock(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function key(scope: ForensicScope): ScopeKey {
  return `${scope.mandateId}::${scope.stageName}` as ScopeKey;
}

/** Real impl returns a Promise<FileEvidence[]>; for the prototype the
 *  data is deterministic so we resolve synchronously through a Promise
 *  wrapper to keep the call-site shape correct.
 *
 *  When no seed exists for a (mandate, stage) scope, we synthesize a
 *  plausible evidence row so the L4 sheet always has content. Real impl
 *  would either return an empty array (uncommon) or a real row. */
export function fetchFileEvidence(scope: ForensicScope): Promise<FileEvidence[]> {
  const now = Date.now();
  const seeds = SEEDS[key(scope)] ?? synthesizeSeeds(scope);
  const rows: FileEvidence[] = seeds.map((s) => {
    const dueIso = iso(now, s.dueOffsetMin);
    const lastCheckIso = iso(now, s.lastCheckOffsetMin);
    return {
      ...s,
      due: formatClock(dueIso),
      dueCountdownMin: s.dueOffsetMin,
      lastCheck: formatClock(lastCheckIso),
      lastCheckAgeMin: -s.lastCheckOffsetMin,
      statusLastUpdate: formatClock(iso(now, s.statusLastUpdateOffsetMin)),
    };
  });
  // Spec §8.19 — log a warning if a click ever broadens beyond 50 rows.
  if (rows.length > 50) {
    console.warn(
      `[FileForensic] scope returned ${rows.length} rows for ${key(scope)} — L3 scoping likely too broad`,
    );
  }
  return Promise.resolve(rows);
}

/* Synthesize a plausible evidence row for any (mandate, stage) the seed
 * map doesn't cover. Filename / folder are derived from mandate id +
 * stage name so they're stable per scope. Status defaults to received
 * for healthy stages; callers see the real status of the breach via the
 * seeded entries above. */
function synthesizeSeeds(scope: ForensicScope): EvidenceSeed[] {
  const mandateSlug = scope.mandateId.replace(/^pl-/, "").toUpperCase();
  const stageSlug = scope.stageName.toUpperCase().replace(/\s+/g, "_");
  const filename = `SSB_${stageSlug}_${mandateSlug}.xlsx`;
  return [
    {
      id: `fe-${scope.mandateId}-${stageSlug.toLowerCase()}-syn`,
      status: "received",
      expectedFilename: filename,
      dueOffsetMin: -120,
      delivery: "MTEX Email",
      lastCheckAgeMin: 4,
      fileId: `MX_${Math.abs(hash(scope.mandateId + scope.stageName)) % 9000 + 1000}`,
      filepath: `O:\\${scope.clientName}\\${scope.stageName}\\`,
      emailSubject: `${scope.clientName} ${scope.stageName} ${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
      emailFrom: "MTEX",
      fileSubject: `${scope.stageName} file`,
      filenameReceived: filename,
      stFolder: `${scope.clientName} ${scope.stageName}`,
      lastCheckOffsetMin: -4,
      statusLastUpdateOffsetMin: -120,
    },
  ];
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

/* ==================================================================== *
 * Forensic action log — separate from the monitor action store.
 *
 * Spec §4.2: every action requires a reason. Three action types ranked
 * by severity of intervention.
 * ==================================================================== */

export type ForensicActionType = "mark_received" | "override" | "escalate";

export const FORENSIC_ACTION_LABEL: Record<ForensicActionType, string> = {
  mark_received: "Mark received manually",
  override: "Override and continue",
  escalate: "Escalate",
};

export interface ForensicAction {
  id: string;
  fileEvidenceId: string;
  mandateId: string;
  stageName: string;
  action: ForensicActionType;
  actor: string;
  reason: string;
  timestamp: string;
}

class ForensicActionsRepo {
  private actions: ForensicAction[] = [];
  private subscribers = new Set<() => void>();
  private seq = 0;

  snapshot(): ForensicAction[] {
    return this.actions;
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  async record(
    input: Omit<ForensicAction, "id" | "timestamp">,
  ): Promise<ForensicAction> {
    const action: ForensicAction = {
      ...input,
      id: `fa-${++this.seq}`,
      timestamp: new Date().toISOString(),
    };
    await new Promise((r) => setTimeout(r, 120));
    this.actions = [...this.actions, action];
    for (const fn of this.subscribers) fn();
    return action;
  }
}

export const forensicActionsRepo = new ForensicActionsRepo();
