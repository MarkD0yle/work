import type { Message } from '@ledgerline/contracts';
import { GlossaryText } from '../glossary/glossary';
import { cn } from '../lib/cn';
import { SEVERITY_LABEL, SEVERITY_TONE, ToneIcon } from './tone';

/**
 * A message always leads with plain language: what happened, then what to do next.
 * The stable code is shown small, for support and search (SPEC 7.7).
 */
export function MessageText({ message, className }: { message: Message; className?: string }) {
  return (
    <span className={cn('min-w-0', className)}>
      <span className="sr-only">{SEVERITY_LABEL[message.severity]}: </span>
      <span>
        <GlossaryText text={message.text} />
      </span>
      {message.fix ? (
        <span className="text-muted-foreground">
          {' '}
          <GlossaryText text={message.fix} />
        </span>
      ) : null}{' '}
      <span className="font-mono text-2xs whitespace-nowrap text-muted-foreground">{message.code}</span>
    </span>
  );
}

export function MessageList({ messages, className }: { messages: Message[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {messages.map((m, i) => (
        <li key={`${m.code}-${m.target ?? ''}-${i}`} className="flex items-start gap-2">
          <ToneIcon tone={SEVERITY_TONE[m.severity]} className="mt-0.5" />
          <MessageText message={m} />
        </li>
      ))}
    </ul>
  );
}
