import type { BulkResult, Message } from '@ledgerline/contracts';
import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog, type Noun } from './confirm-dialog';
import type { ResolvedAction } from './registry';

export interface ActionOutcome<Row> {
  action: ResolvedAction<Row>;
  /** Present when the action ran. */
  result?: BulkResult;
  /** Present when it could not run at all (permission, network). */
  error?: Message[];
  /** What the action was run with, so a retry needs nothing typed again. */
  inputs?: Record<string, unknown>;
}

export interface ActionRunnerOptions<Row> {
  rowId: (row: Row) => string;
  noun: Noun;
  /** Called once the action has finished, or failed outright. */
  onDone: (outcome: ActionOutcome<Row>) => void;
  /** Called when the confirm step closes, confirmed or cancelled, so the caller can put focus back where the user was. */
  onConfirmClosed?: () => void;
  /** True when the preview should open by itself: new users, or rows that carry warnings (SPEC 7.4). */
  autoPreview?: (action: ResolvedAction<Row>) => boolean;
}

const FAILED: Message = {
  code: 'LL-ACT-0500',
  severity: 'error',
  level: 'operation',
  text: 'The action could not be completed.',
  fix: 'Nothing was changed. Try again; if it keeps failing, check your connection.',
};

/**
 * Runs actions from any surface the same way: actions with a consequence always go through the confirm
 * step first (Post, Reverse, Delete, Override, Reopen); the rest run at once.
 * Returns `run` and the confirm dialog to render.
 */
export function useActionRunner<Row>({
  rowId,
  noun,
  onDone,
  onConfirmClosed,
  autoPreview,
}: ActionRunnerOptions<Row>): {
  run: (action: ResolvedAction<Row>) => void;
  dialog: ReactNode;
  busy: boolean;
} {
  const [pending, setPending] = useState<ResolvedAction<Row> | null>(null);
  const [busy, setBusy] = useState(false);

  const execute = useCallback(
    async (action: ResolvedAction<Row>, reason?: string) => {
      setBusy(true);
      try {
        const inputs = reason ? { reason } : undefined;
        const result = await action.def.execute(action.eligible.map(rowId), inputs);
        onDone({ action, result, ...(inputs ? { inputs } : {}) });
      } catch (error) {
        const messages = (error as { messages?: Message[] } | null)?.messages;
        onDone({ action, error: Array.isArray(messages) && messages.length ? messages : [FAILED] });
      } finally {
        setBusy(false);
        setPending(null);
        if (action.def.consequence !== 'none') onConfirmClosed?.();
      }
    },
    [rowId, onDone, onConfirmClosed],
  );

  const run = useCallback(
    (action: ResolvedAction<Row>) => {
      if (!action.enabled || busy) return;
      if (action.def.consequence === 'none') void execute(action);
      else setPending(action);
    },
    [busy, execute],
  );

  const dialog = pending ? (
    <ConfirmDialog
      action={pending}
      noun={noun}
      ids={pending.eligible.map(rowId)}
      autoPreview={autoPreview?.(pending) ?? false}
      busy={busy}
      onConfirm={(reason) => void execute(pending, reason)}
      onCancel={() => {
        setPending(null);
        onConfirmClosed?.();
      }}
    />
  ) : null;

  return { run, dialog, busy };
}
