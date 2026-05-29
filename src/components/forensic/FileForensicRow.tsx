import type { FileEvidence } from "../../lib/file-forensic-data";
import type { ForensicScope } from "../../lib/forensic-scope";
import ForensicNarrative from "./ForensicNarrative";
import ForensicActions from "./ForensicActions";
import { SEVERITY_TONES } from "../../lib/severity-tokens";

/* Spec v0.1.2 L4 §4.1 — row + inline expansion.
 *
 * Status column uses v0.1.2 three-tier severity tokens (rule §5).
 *   received → clean dot
 *   pending  → neutral
 *   late     → typical (cream) — late but not failed
 *   failed   → benchmark (red) */

const STATUS_DOT: Record<FileEvidence["status"], string> = {
  received: "bg-emerald-500",
  pending: "bg-neutral-300",
  late: SEVERITY_TONES.typical.surface.bg,
  failed: SEVERITY_TONES.benchmark.surface.bg,
};

const STATUS_LABEL: Record<FileEvidence["status"], string> = {
  received: "Received",
  pending: "Pending",
  late: "Late",
  failed: "Failed",
};

export const CURATED_COLUMNS = [
  { key: "status", label: "Status", width: "w-[100px]" },
  { key: "expectedFilename", label: "Expected Filename", width: "flex-1 min-w-0" },
  { key: "due", label: "Due", width: "w-[120px]" },
  { key: "delivery", label: "Delivery", width: "w-[140px]" },
  { key: "lastCheck", label: "Last Check", width: "w-[140px]" },
] as const;

export const ALL_COLUMNS = [
  ...CURATED_COLUMNS,
  { key: "fileId", label: "File ID", width: "w-[110px]" },
  { key: "filepath", label: "Filepath", width: "flex-1 min-w-0" },
  { key: "emailSubject", label: "Email Subject", width: "flex-1 min-w-0" },
  { key: "filenameReceived", label: "Filename Received", width: "flex-1 min-w-0" },
  { key: "stFolder", label: "ST Folder", width: "w-[160px]" },
  { key: "statusLastUpdate", label: "Status Last Update", width: "w-[140px]" },
] as const;

export type ColumnKey =
  | (typeof CURATED_COLUMNS)[number]["key"]
  | (typeof ALL_COLUMNS)[number]["key"];

export default function FileForensicRow({
  evidence,
  scope,
  expanded,
  onToggleExpand,
  showAllFields,
}: {
  evidence: FileEvidence;
  scope: ForensicScope;
  expanded: boolean;
  onToggleExpand: () => void;
  showAllFields: boolean;
}) {
  const columns = showAllFields ? ALL_COLUMNS : CURATED_COLUMNS;
  return (
    <li className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 px-5 py-2 text-left text-[12px] transition hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none ${
          expanded ? "bg-neutral-50" : ""
        }`}
      >
        {columns.map((c) => (
          <Cell key={c.key} column={c.key} width={c.width} evidence={evidence} />
        ))}
        <span
          aria-hidden
          className="ml-1 shrink-0 text-[10px] text-neutral-400"
        >
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded && (
        <div className="bg-neutral-50/60 px-5 py-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-neutral-700">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[evidence.status]}`}
            />
            <span>{STATUS_LABEL[evidence.status]}</span>
            <span aria-hidden className="text-neutral-300">
              ·
            </span>
            <span className="font-mono">{evidence.expectedFilename}</span>
            <span aria-hidden className="text-neutral-300">
              ·
            </span>
            <span className="font-normal text-neutral-500">
              Due {evidence.due}
            </span>
          </div>
          <ForensicNarrative evidence={evidence} />
          <ForensicActions evidence={evidence} scope={scope} />
        </div>
      )}
    </li>
  );
}

function Cell({
  column,
  width,
  evidence,
}: {
  column: ColumnKey;
  width: string;
  evidence: FileEvidence;
}) {
  if (column === "status") {
    return (
      <span
        className={`flex shrink-0 items-center gap-1.5 text-neutral-700 ${width}`}
      >
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[evidence.status]}`}
        />
        {STATUS_LABEL[evidence.status]}
      </span>
    );
  }
  if (column === "expectedFilename") {
    return (
      <span className={`truncate font-mono text-neutral-800 ${width}`}>
        {evidence.expectedFilename}
      </span>
    );
  }
  if (column === "due") {
    const overdue = evidence.dueCountdownMin <= 0;
    const label =
      evidence.dueCountdownMin > 0
        ? `· in ${humanMinutes(evidence.dueCountdownMin)}`
        : evidence.dueCountdownMin < 0
          ? `· ${humanMinutes(-evidence.dueCountdownMin)} late`
          : "";
    return (
      <span className={`shrink-0 ${width}`}>
        <span className="font-mono tabular-nums text-neutral-800">
          {evidence.due}
        </span>{" "}
        <span className={overdue ? "text-red-700" : "text-neutral-500"}>
          {label}
        </span>
      </span>
    );
  }
  if (column === "lastCheck") {
    return (
      <span className={`shrink-0 ${width}`}>
        <span className="font-mono tabular-nums text-neutral-800">
          {evidence.lastCheck}
        </span>{" "}
        <span className="text-neutral-500">· {evidence.lastCheckAgeMin}m ago</span>
      </span>
    );
  }
  if (column === "delivery") {
    return <span className={`shrink-0 text-neutral-700 ${width}`}>{evidence.delivery}</span>;
  }
  if (column === "fileId") {
    return <span className={`shrink-0 font-mono text-neutral-700 ${width}`}>{evidence.fileId}</span>;
  }
  if (column === "filepath") {
    return (
      <span className={`truncate font-mono text-neutral-700 ${width}`} title={evidence.filepath}>
        {evidence.filepath}
      </span>
    );
  }
  if (column === "emailSubject") {
    return (
      <span className={`truncate text-neutral-700 ${width}`} title={evidence.emailSubject}>
        {evidence.emailSubject}
      </span>
    );
  }
  if (column === "filenameReceived") {
    return (
      <span className={`truncate font-mono text-neutral-700 ${width}`}>
        {evidence.filenameReceived ?? <span className="text-neutral-400">—</span>}
      </span>
    );
  }
  if (column === "stFolder") {
    return <span className={`shrink-0 text-neutral-700 ${width}`}>{evidence.stFolder}</span>;
  }
  if (column === "statusLastUpdate") {
    return (
      <span className={`shrink-0 font-mono tabular-nums text-neutral-700 ${width}`}>
        {evidence.statusLastUpdate}
      </span>
    );
  }
  return null;
}

function humanMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
