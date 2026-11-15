import type { Message } from '@ledgerline/contracts';
import { cn } from '../lib/cn';
import { MessageText } from './message-list';
import { SEVERITY_TONE, ToneIcon } from './tone';

export interface FieldMessageProps {
  /** Give the same id to the input's aria-describedby. */
  id: string;
  message: Message;
  className?: string;
}

/** Inline field validation. Stays until the value is fixed. */
export function FieldMessage({ id, message, className }: FieldMessageProps) {
  return (
    <p
      id={id}
      data-slot="field-message"
      data-severity={message.severity}
      role={message.severity === 'error' ? 'alert' : 'status'}
      aria-live={message.severity === 'error' ? 'assertive' : 'polite'}
      className={cn('mt-1 flex items-start gap-1.5 text-xs', className)}
    >
      <ToneIcon tone={SEVERITY_TONE[message.severity]} className="mt-px size-3.5" />
      <MessageText message={message} />
    </p>
  );
}
