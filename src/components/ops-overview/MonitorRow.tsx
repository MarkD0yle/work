import { useState } from "react";
import {
  ME,
  effectiveState,
  monitorActionsRepo,
  type MonitorAction,
  type QlikMonitor,
  type ResolutionReason,
} from "../../lib/qlik";
import MonitorHistory from "./MonitorHistory";
import ResolveForm from "./ResolveForm";
import HandoffPicker from "./HandoffPicker";
import {
  AGE_WEIGHT,
  SEVERITY_TONES,
  ageBand,
  monitorStatusToSeverity,
} from "../../lib/severity-tokens";

/* MonitorRow — single Qlik monitor row in the sidebar list.
 *
 * Owns its own action form state so resolve / handoff / note / reopen
 * forms can render at the FULL ROW WIDTH below the row content, rather
 * than getting squeezed into the right-side action button column. */

type FormKind = "resolve" | "handoff" | "note" | "reopen";

function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* Status dot — pure colour, used in row left margin. */
const DOT_COLOUR: Record<QlikMonitor["status"], string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  info: "bg-blue-400",
  green: "bg-neutral-300",
};

/* Row container tokens (spec §1.4 row 3): muted for acked, subtle for
 * resolved, surface for unacked. Falls back to clean tones for green/info. */
function rowTokens(
  status: QlikMonitor["status"],
  effectiveKind: "unacked" | "acked" | "resolved",
) {
  const sev = monitorStatusToSeverity(status);
  if (sev === "clean") return SEVERITY_TONES.clean.muted;
  if (effectiveKind === "resolved") return SEVERITY_TONES[sev].subtle;
  if (effectiveKind === "acked") return SEVERITY_TONES[sev].muted;
  return SEVERITY_TONES[sev].muted; // unacked default — surface is too loud per-row
}

const CATEGORY_LABEL: Record<QlikMonitor["category"], string> = {
  process: "Process",
  data: "Data",
  rule: "Rule",
  system: "System",
};

export default function MonitorRow({
  monitor,
  actions,
  now,
  pulsing,
}: {
  monitor: QlikMonitor;
  actions: MonitorAction[];
  now: number;
  pulsing?: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [formOpen, setFormOpen] = useState<FormKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");

  const effective = effectiveState(monitor, actions);
  const tone = rowTokens(monitor.status, effective.kind);
  const dotColour = DOT_COLOUR[monitor.status];

  const ackLine =
    effective.kind === "acked"
      ? `Acked by ${effective.actor} ${formatClock(effective.at)}`
      : effective.kind === "resolved"
        ? `Resolved by ${effective.actor} ${formatClock(effective.at)} — ${effective.reason}${effective.note ? ` · "${effective.note}"` : ""}`
        : null;

  const refreshAge = Math.floor(
    (now - new Date(monitor.lastRefresh).getTime()) / 60_000,
  );

  const hasStaleHistory = actions.some(
    (a) =>
      a.monitorId === monitor.id &&
      a.qlikRefreshTimestamp !== monitor.lastRefresh,
  );

  async function record(
    input: Parameters<typeof monitorActionsRepo.record>[0],
    optimistic: boolean,
  ) {
    setBusy(true);
    try {
      await monitorActionsRepo.record(input, { optimistic });
    } finally {
      setBusy(false);
      setFormOpen(null);
      setNoteText("");
    }
  }

  function acknowledge() {
    // Spec §4.4 — ack is optimistic.
    record(
      {
        monitorId: monitor.id,
        qlikRefreshTimestamp: monitor.lastRefresh,
        action: "ack",
        actor: ME,
      },
      true,
    );
  }

  function confirmResolve(reason: ResolutionReason, note: string | undefined) {
    // Spec §4.4 — resolve must await persistence (not optimistic).
    record(
      {
        monitorId: monitor.id,
        qlikRefreshTimestamp: monitor.lastRefresh,
        action: "resolve",
        actor: ME,
        resolutionReason: reason,
        note,
      },
      false,
    );
  }

  function confirmHandoff(toUser: string) {
    record(
      {
        monitorId: monitor.id,
        qlikRefreshTimestamp: monitor.lastRefresh,
        action: "handoff",
        actor: ME,
        handoffTo: toUser,
      },
      true,
    );
  }

  function confirmNote() {
    if (!noteText.trim()) return;
    record(
      {
        monitorId: monitor.id,
        qlikRefreshTimestamp: monitor.lastRefresh,
        action: "note",
        actor: ME,
        note: noteText.trim(),
      },
      true,
    );
  }

  function confirmReopen() {
    record(
      {
        monitorId: monitor.id,
        qlikRefreshTimestamp: monitor.lastRefresh,
        action: "reopen",
        actor: ME,
      },
      false,
    );
  }

  const isActive = monitor.status === "red" || monitor.status === "amber";
  const showActions = isActive || effective.kind === "resolved";

  // Spec §7.3 — age weight on red/amber only.
  const ageWeighted = isActive;
  const age = ageWeighted ? AGE_WEIGHT[ageBand(refreshAge)] : null;

  // Spec §5 — acked-by-other branch: someone else owns the ack, so this
  // user can only Hand-off-to-me or Add note (no Resolve).
  const ackedByOther =
    effective.kind === "acked" && effective.actor !== ME;
  const ackedByMe = effective.kind === "acked" && effective.actor === ME;

  return (
    <li
      data-monitor-id={monitor.id}
      className={`overflow-hidden rounded-lg border transition ${tone.bg} ${tone.border} ${
        pulsing ? "ring-2 ring-blue-400 ring-offset-1" : ""
      }`}
    >
      <div className="px-4 py-3">
        {/* Row content: dot + info on the left, action buttons stacked on the right */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotColour}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-neutral-900">
                {monitor.name}
              </span>
              <span className="text-[10px] font-medium tracking-wider text-neutral-500 uppercase">
                {CATEGORY_LABEL[monitor.category]}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-700">{monitor.detail}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
              <span
                className={`font-mono ${age?.textWeight ?? "font-normal"} ${
                  ageWeighted
                    ? monitor.status === "red"
                      ? "text-red-700"
                      : "text-amber-800"
                    : "text-neutral-500"
                }`}
              >
                Refresh {formatClock(monitor.lastRefresh)} · {refreshAge}m ago
              </span>
              {ackLine && (
                <span
                  className={`font-medium ${
                    effective.kind === "resolved"
                      ? "text-emerald-700"
                      : "text-blue-700"
                  }`}
                >
                  · {ackLine}
                </span>
              )}
              {!ackLine && isActive && (
                <span className="text-neutral-400">· No owner</span>
              )}
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-[11px] font-medium text-blue-700 hover:underline"
              >
                {historyOpen ? "Hide history" : "History"}
              </button>
              {hasStaleHistory && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-neutral-600 uppercase">
                  refresh invalidated prior ack
                </span>
              )}
            </div>
          </div>

          {/* Spec §5 — state-dependent button hierarchy.
              Primary action: filled; secondaries: text-only, lower contrast. */}
          {showActions && (
            <div className="flex shrink-0 flex-col items-stretch gap-1">
              {effective.kind === "unacked" && (
                <>
                  <ActionButton
                    tone="primary"
                    onClick={acknowledge}
                    disabled={busy}
                  >
                    Acknowledge
                  </ActionButton>
                  <ActionButton
                    tone="text"
                    onClick={() => setFormOpen("resolve")}
                    disabled={busy}
                    active={formOpen === "resolve"}
                  >
                    Resolve
                  </ActionButton>
                </>
              )}
              {ackedByMe && (
                <>
                  <ActionButton
                    tone="primary"
                    onClick={() => setFormOpen("resolve")}
                    disabled={busy}
                    active={formOpen === "resolve"}
                  >
                    Resolve
                  </ActionButton>
                  <ActionButton
                    tone="text"
                    onClick={() => setFormOpen("handoff")}
                    disabled={busy}
                    active={formOpen === "handoff"}
                  >
                    Hand off
                  </ActionButton>
                  <ActionButton
                    tone="text"
                    onClick={() => setFormOpen("note")}
                    disabled={busy}
                    active={formOpen === "note"}
                  >
                    Add note
                  </ActionButton>
                </>
              )}
              {ackedByOther && (
                <>
                  <ActionButton
                    tone="text"
                    onClick={() => setFormOpen("handoff")}
                    disabled={busy}
                    active={formOpen === "handoff"}
                  >
                    Hand off to me
                  </ActionButton>
                  <ActionButton
                    tone="text"
                    onClick={() => setFormOpen("note")}
                    disabled={busy}
                    active={formOpen === "note"}
                  >
                    Add note
                  </ActionButton>
                </>
              )}
              {effective.kind === "resolved" && (
                <ActionButton
                  tone="text"
                  onClick={() => setFormOpen("reopen")}
                  disabled={busy}
                  active={formOpen === "reopen"}
                >
                  Reopen
                </ActionButton>
              )}
            </div>
          )}
        </div>

        {/* Action form — opens at FULL ROW WIDTH below the monitor content. */}
        {formOpen === "resolve" && (
          <ResolveForm
            busy={busy}
            onCancel={() => setFormOpen(null)}
            onConfirm={confirmResolve}
          />
        )}
        {formOpen === "handoff" && effective.kind === "acked" && (
          <HandoffPicker
            currentActor={effective.actor}
            onCancel={() => setFormOpen(null)}
            onConfirm={confirmHandoff}
          />
        )}
        {formOpen === "note" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmNote();
            }}
            className="mt-2 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3"
          >
            <input
              autoFocus
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Logged to history — no state change"
              className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={!noteText.trim() || busy}
              className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:bg-neutral-300"
            >
              Save note
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(null);
                setNoteText("");
              }}
              className="text-[10px] text-neutral-400 hover:text-neutral-700"
            >
              Cancel
            </button>
          </form>
        )}
        {formOpen === "reopen" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
            <span className="text-neutral-700">
              This will mark the monitor as needing action again.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={confirmReopen}
                disabled={busy}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:bg-neutral-300"
              >
                {busy ? "Reopening…" : "Confirm reopen"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(null)}
                disabled={busy}
                className="text-[10px] text-neutral-400 hover:text-neutral-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {historyOpen && (
        <div className="border-t border-neutral-200 bg-neutral-50/40 px-4 py-2">
          <MonitorHistory monitor={monitor} actions={actions} now={now} />
        </div>
      )}
    </li>
  );
}

/* Spec §5 — three tones:
 *   primary  → filled dark, the obvious choice
 *   text     → text-only, low contrast, optional escape route
 *   default  → outlined, for ambiguous/secondary surfaces (legacy) */
function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "default" | "text";
  active?: boolean;
}) {
  const base = "rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50";
  const cls = active
    ? "border border-blue-500 bg-blue-50 text-blue-700"
    : tone === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-300"
      : tone === "text"
        ? "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
        : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}
