import type { Message } from '@ledgerline/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Label,
  SectionBanner,
  Textarea,
} from '@ledgerline/ui';
import { useId, useState, type ReactNode } from 'react';
import { problemOf } from '../services';

export interface ReasonDialogProps {
  title: string;
  /** What will happen, in plain words, including who else has to act. */
  description: ReactNode;
  /** Label of the text box, e.g. "Reason" or "Sign-off note". */
  label: string;
  /** When true the text cannot be left empty. */
  required?: boolean;
  confirmLabel: string;
  /** Extra fields above the text box. */
  children?: ReactNode;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Asks for the words that go with a consequential action (a reason, a note), then runs it.
 * If the action is refused, the refusal stays in the dialog: it is never only a passing message.
 */
export function ReasonDialog({
  title,
  description,
  label,
  required = true,
  confirmLabel,
  children,
  onSubmit,
  onClose,
}: ReasonDialogProps) {
  const id = useId();
  const [text, setText] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Message[] | null>(null);
  const missing = required && !text.trim();
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent data-slot="reason-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div>{description}</div>
        </DialogDescription>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (missing) {
              setAttempted(true);
              return;
            }
            setBusy(true);
            setFailure(null);
            onSubmit(text.trim())
              .then(onClose)
              .catch((error: unknown) => {
                setFailure(
                  problemOf(error)?.messages ?? [
                    {
                      code: 'LL-ACT-0500',
                      severity: 'error',
                      level: 'operation',
                      text: 'That could not be completed.',
                      fix: 'Nothing was changed. Try again.',
                    },
                  ],
                );
                setBusy(false);
              });
          }}
        >
          {failure ? <SectionBanner state={{ kind: 'blockingError', messages: failure }} /> : null}
          {children}
          <div>
            <Label htmlFor={`${id}-text`}>
              {label}
              {required ? ' (required)' : ' (optional)'}
            </Label>
            <Textarea
              id={`${id}-text`}
              value={text}
              autoFocus
              aria-invalid={(attempted && missing) || undefined}
              aria-describedby={attempted && missing ? `${id}-error` : undefined}
              onChange={(e) => setText(e.target.value)}
            />
            {attempted && missing ? (
              <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-critical">
                Enter the {label.toLowerCase()}. It is recorded in the audit history.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
