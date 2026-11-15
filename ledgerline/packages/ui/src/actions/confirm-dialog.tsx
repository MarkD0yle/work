import type { Consequence, PreviewRow } from '@ledgerline/contracts';
import { useEffect, useId, useState } from 'react';
import { Button } from '../components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../components/dialog';
import { Input, Label, Textarea } from '../components/input';
import { MessageText } from '../state/message-list';
import { groupIneligible, type ResolvedAction } from './registry';

const CONSEQUENCE: Record<Exclude<Consequence, 'none'>, string> = {
  reversible: 'This can be undone.',
  reversibleWithAudit: 'This can be reversed later. Both steps stay in the audit history.',
  irreversible: 'This cannot be undone.',
};

/** Above this many rows a run needs a typed confirmation (SPEC 7.4). */
export const TYPED_CONFIRM_ROWS = 50;
/** The most preview rows listed. Rows with warnings come first, so nothing that matters is cut off. */
const PREVIEW_ROWS = 50;

export interface Noun {
  one: string;
  many: string;
}

export interface ConfirmDialogProps<Row> {
  action: ResolvedAction<Row>;
  /** What the records are called, e.g. { one: 'transaction', many: 'transactions' }. */
  noun: Noun;
  /** Ids of the eligible rows, for the preview. */
  ids?: string[];
  /** Open the preview straight away: for new users, and whenever a row has a warning. Otherwise it is one click away. */
  autoPreview?: boolean;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

const count = (n: number, noun: Noun) => `${n.toLocaleString('en-US')} ${n === 1 ? noun.one : noun.many}`;
const shown = (values: Record<string, unknown>) =>
  Object.values(values)
    .map((v) => (v === null || v === undefined ? 'none' : String(v)))
    .join(', ');

/** The phrase to type before a risky run: the action and the number of rows, so the scale is read, not skimmed. */
export const confirmPhrase = (label: string, rows: number) => `${label.toLowerCase()} ${rows}`;

type PreviewState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; rows: PreviewRow[] };

/**
 * The confirm step for any action with a consequence (CLAUDE.md rule 5, SPEC 7.4).
 * It states the action, how many records it will run on, which it will skip and why, and whether it can be undone.
 * Confirmation scales with risk: a routine action is a single Enter; an irreversible action, or a run over
 * 50 rows, asks the user to type the action and the count first.
 */
export function ConfirmDialog<Row>({
  action,
  noun,
  ids,
  autoPreview,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps<Row>) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [attempted, setAttempted] = useState(false);
  const { def, eligible, ineligible } = action;
  const total = eligible.length + ineligible.length;
  const groups = groupIneligible(ineligible);
  const needsReason = Boolean(def.requiresReason);
  const missing = needsReason && !reason.trim();
  const phrase = confirmPhrase(def.label, eligible.length);
  const needsTyping = def.consequence === 'irreversible' || eligible.length > TYPED_CONFIRM_ROWS;
  const mistyped = needsTyping && typed.trim().toLowerCase() !== phrase;

  const canPreview = Boolean(def.preview && ids?.length);
  const [preview, setPreview] = useState<PreviewState>({
    status: autoPreview && canPreview ? 'loading' : 'closed',
  });
  const loading = preview.status === 'loading';
  useEffect(() => {
    if (!loading || !def.preview || !ids) return;
    let live = true;
    def.preview(ids).then(
      (rows) => live && setPreview({ status: 'ready', rows }),
      () => live && setPreview({ status: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [loading, def, ids]);
  // Rows with warnings first: they are why the preview matters.
  const previewRows =
    preview.status === 'ready'
      ? [...preview.rows].sort((a, b) => (b.warnings?.length ? 1 : 0) - (a.warnings?.length ? 1 : 0))
      : [];
  const flagged = previewRows.filter((r) => r.warnings?.length).length;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className={preview.status === 'closed' ? undefined : 'max-w-3xl'}>
        <DialogTitle>
          {def.label} {count(eligible.length, noun)}?
        </DialogTitle>
        <DialogDescription>{def.description}</DialogDescription>
        <form
          className="flex min-h-0 flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (missing || mistyped) {
              setAttempted(true);
              return;
            }
            onConfirm(reason.trim() || undefined);
          }}
        >
          {ineligible.length ? (
            <div data-slot="confirm-eligibility" className="rounded-md border bg-muted px-3 py-2">
              <p>
                <span className="font-medium">{total.toLocaleString('en-US')} selected.</span> This will run
                on {eligible.length.toLocaleString('en-US')}. {ineligible.length.toLocaleString('en-US')} will
                be left as they are:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {groups.map((g) => (
                  <li key={g.reason}>
                    {g.count.toLocaleString('en-US')}: {g.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p
            data-slot="confirm-consequence"
            className={def.consequence === 'irreversible' ? 'font-medium text-critical' : undefined}
          >
            {def.consequence === 'none' ? '' : CONSEQUENCE[def.consequence]}
            {def.requiresApproval ? ' It needs approval from a second person before it takes effect.' : ''}
          </p>

          {canPreview && preview.status === 'closed' ? (
            <div>
              <Button
                variant="secondary"
                data-slot="confirm-preview-button"
                onClick={() => setPreview({ status: 'loading' })}
              >
                Preview the changes
              </Button>
            </div>
          ) : null}
          {preview.status === 'loading' ? (
            <p role="status" className="text-muted-foreground">
              Working out the changes…
            </p>
          ) : null}
          {preview.status === 'failed' ? (
            <p role="alert" className="text-critical">
              The preview could not be loaded. You can still go ahead, or cancel and try again.
            </p>
          ) : null}
          {preview.status === 'ready' ? (
            <div data-slot="confirm-preview" className="flex min-h-0 flex-col gap-1">
              <p className="font-medium">
                Preview: {count(preview.rows.length, noun)}
                {flagged
                  ? `, ${flagged.toLocaleString('en-US')} with something to check (listed first)`
                  : ', nothing to check'}
                .
              </p>
              {/* Focusable, so the list can be scrolled with the keyboard. */}
              <div
                className="max-h-64 overflow-auto rounded-md border"
                tabIndex={0}
                role="region"
                aria-label="Preview rows"
              >
                <table aria-label="Preview of changes" className="w-full text-body">
                  <thead className="sticky top-0 bg-muted text-left text-xs">
                    <tr>
                      <th scope="col" className="px-2 py-1 font-medium">
                        {noun.one.charAt(0).toUpperCase() + noun.one.slice(1)}
                      </th>
                      <th scope="col" className="px-2 py-1 font-medium">
                        Now
                      </th>
                      <th scope="col" className="px-2 py-1 font-medium">
                        After
                      </th>
                      <th scope="col" className="px-2 py-1 font-medium">
                        To check
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, PREVIEW_ROWS).map((row) => (
                      <tr key={row.id} className="border-t align-top">
                        <th scope="row" className="px-2 py-1 text-left font-mono font-normal">
                          {row.id}
                        </th>
                        <td className="px-2 py-1">{shown(row.before)}</td>
                        <td className="px-2 py-1">{shown(row.after)}</td>
                        <td className="px-2 py-1 text-xs">
                          {row.warnings?.map((m, i) => (
                            <p key={`${m.code}-${i}`}>
                              <MessageText message={m} />
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > PREVIEW_ROWS ? (
                <p className="text-xs text-muted-foreground">
                  Showing the first {PREVIEW_ROWS}. The other{' '}
                  {(previewRows.length - PREVIEW_ROWS).toLocaleString('en-US')}{' '}
                  {flagged > PREVIEW_ROWS ? 'include more to check' : 'have nothing to check'}.
                </p>
              ) : null}
            </div>
          ) : null}

          {needsReason ? (
            <div>
              <Label htmlFor={`${id}-reason`}>Reason (required)</Label>
              <Textarea
                id={`${id}-reason`}
                value={reason}
                autoFocus
                aria-invalid={(attempted && missing) || undefined}
                aria-describedby={attempted && missing ? `${id}-reason-error` : undefined}
                onChange={(e) => setReason(e.target.value)}
              />
              {attempted && missing ? (
                <p id={`${id}-reason-error`} role="alert" className="mt-1 text-xs text-critical">
                  Enter a reason. It is recorded in the audit history.
                </p>
              ) : null}
            </div>
          ) : null}
          {needsTyping ? (
            <div data-slot="confirm-typed">
              <Label htmlFor={`${id}-typed`}>
                Type <span className="font-mono">{phrase}</span> to confirm
              </Label>
              <Input
                id={`${id}-typed`}
                value={typed}
                autoFocus={!needsReason}
                autoComplete="off"
                aria-invalid={(attempted && mistyped) || undefined}
                aria-describedby={`${id}-typed-why`}
                onChange={(e) => setTyped(e.target.value)}
              />
              <p id={`${id}-typed-why`} className="mt-1 text-xs text-muted-foreground">
                {def.consequence === 'irreversible'
                  ? 'Asked because this cannot be undone.'
                  : `Asked because this runs on more than ${TYPED_CONFIRM_ROWS} ${noun.many}.`}
                {attempted && mistyped ? (
                  <span className="text-critical"> That does not match yet.</span>
                ) : null}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={def.tier === 'destructive' ? 'destructive' : 'default'}
              disabled={busy || mistyped}
              autoFocus={!needsReason && !needsTyping}
            >
              {busy ? 'Working…' : `${def.label} ${count(eligible.length, noun)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
