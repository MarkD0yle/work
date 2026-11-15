import type { Consequence } from '@ledgerline/contracts';
import { useId, useState } from 'react';
import { Button } from '../components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../components/dialog';
import { Label, Textarea } from '../components/input';
import { groupIneligible, type ResolvedAction } from './registry';

const CONSEQUENCE: Record<Exclude<Consequence, 'none'>, string> = {
  reversible: 'This can be undone.',
  reversibleWithAudit: 'This can be reversed later. Both steps stay in the audit history.',
  irreversible: 'This cannot be undone.',
};

export interface Noun {
  one: string;
  many: string;
}

export interface ConfirmDialogProps<Row> {
  action: ResolvedAction<Row>;
  /** What the records are called, e.g. { one: 'transaction', many: 'transactions' }. */
  noun: Noun;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

const count = (n: number, noun: Noun) => `${n.toLocaleString('en-US')} ${n === 1 ? noun.one : noun.many}`;

/**
 * The confirm step for any action with a consequence (CLAUDE.md rule 5).
 * It states the action, how many records it will run on, which it will skip and why, and whether it can be undone.
 * One confirm, focused and ready: a routine action is a single Enter. Risk-scaled confirmation arrives with Bulk Actions (Milestone 5).
 */
export function ConfirmDialog<Row>({ action, noun, busy, onConfirm, onCancel }: ConfirmDialogProps<Row>) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const { def, eligible, ineligible } = action;
  const total = eligible.length + ineligible.length;
  const groups = groupIneligible(ineligible);
  const needsReason = Boolean(def.requiresReason);
  const missing = needsReason && !reason.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogTitle>
          {def.label} {count(eligible.length, noun)}?
        </DialogTitle>
        <DialogDescription>{def.description}</DialogDescription>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (missing) {
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
          <DialogFooter>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={def.tier === 'destructive' ? 'destructive' : 'default'}
              disabled={busy}
              autoFocus={!needsReason}
            >
              {busy ? 'Working…' : `${def.label} ${count(eligible.length, noun)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
