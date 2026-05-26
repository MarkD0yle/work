import { useState } from "react";
import {
  ME,
  monitorActionsRepo,
  type EffectiveState,
  type QlikMonitor,
  type ResolutionReason,
} from "../../lib/qlik";
import ResolveForm from "./ResolveForm";
import HandoffPicker from "./HandoffPicker";

/* Spec §2.3 — action surface per row. Available actions depend on
 * effective state:
 *   - unacked          → Acknowledge, Resolve
 *   - acked            → Resolve, Hand off, Add note
 *   - resolved         → Reopen
 *   - green/info       → no actions
 *
 * Spec §4.4: ack is optimistic, resolve must await persistence. */

export default function MonitorActionMenu({
  monitor,
  effective,
}: {
  monitor: QlikMonitor;
  effective: EffectiveState;
}) {
  const [open, setOpen] = useState<
    null | "resolve" | "handoff" | "note" | "reopen"
  >(null);
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");

  const showActions =
    monitor.status === "red" || monitor.status === "amber" ||
    effective.kind === "resolved";

  if (!showActions) return null;

  async function record(
    input: Parameters<typeof monitorActionsRepo.record>[0],
    optimistic: boolean,
  ) {
    setBusy(true);
    try {
      await monitorActionsRepo.record(input, { optimistic });
    } finally {
      setBusy(false);
      setOpen(null);
      setNoteText("");
    }
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {effective.kind === "unacked" && (
          <>
            <ActionButton
              tone="primary"
              onClick={() =>
                record(
                  {
                    monitorId: monitor.id,
                    qlikRefreshTimestamp: monitor.lastRefresh,
                    action: "ack",
                    actor: ME,
                  },
                  true, // optimistic per §4.4
                )
              }
              disabled={busy}
            >
              Acknowledge
            </ActionButton>
            <ActionButton onClick={() => setOpen("resolve")} disabled={busy}>
              Resolve
            </ActionButton>
          </>
        )}

        {effective.kind === "acked" && (
          <>
            <ActionButton onClick={() => setOpen("resolve")} disabled={busy}>
              Resolve
            </ActionButton>
            <ActionButton onClick={() => setOpen("handoff")} disabled={busy}>
              Hand off
            </ActionButton>
            <ActionButton onClick={() => setOpen("note")} disabled={busy}>
              Add note
            </ActionButton>
          </>
        )}

        {effective.kind === "resolved" && (
          <ActionButton
            tone="muted"
            onClick={() => setOpen("reopen")}
            disabled={busy}
          >
            Reopen
          </ActionButton>
        )}
      </div>

      {open === "resolve" && (
        <ResolveForm
          busy={busy}
          onCancel={() => setOpen(null)}
          onConfirm={(reason: ResolutionReason, note) =>
            record(
              {
                monitorId: monitor.id,
                qlikRefreshTimestamp: monitor.lastRefresh,
                action: "resolve",
                actor: ME,
                resolutionReason: reason,
                note,
              },
              false, // §4.4 — resolve must await persistence
            )
          }
        />
      )}

      {open === "handoff" && effective.kind === "acked" && (
        <HandoffPicker
          currentActor={effective.actor}
          onCancel={() => setOpen(null)}
          onConfirm={(toUser) =>
            record(
              {
                monitorId: monitor.id,
                qlikRefreshTimestamp: monitor.lastRefresh,
                action: "handoff",
                actor: ME,
                handoffTo: toUser,
              },
              true,
            )
          }
        />
      )}

      {open === "note" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
            onClick={() => setOpen(null)}
            className="text-[10px] text-neutral-400 hover:text-neutral-700"
          >
            Cancel
          </button>
        </form>
      )}

      {open === "reopen" && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <span className="text-xs text-neutral-700">
            This will mark the monitor as needing action again.
          </span>
          <button
            type="button"
            onClick={() =>
              record(
                {
                  monitorId: monitor.id,
                  qlikRefreshTimestamp: monitor.lastRefresh,
                  action: "reopen",
                  actor: ME,
                },
                false,
              )
            }
            disabled={busy}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:bg-neutral-300"
          >
            Confirm reopen
          </button>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="text-[10px] text-neutral-400 hover:text-neutral-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "default" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-300"
      : tone === "muted"
        ? "border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100"
        : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
