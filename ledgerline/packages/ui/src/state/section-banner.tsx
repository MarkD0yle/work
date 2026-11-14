import type { ActionRef, UiState } from '@ledgerline/contracts';
import { X } from 'lucide-react';
import { Button } from '../components/button';
import { cn } from '../lib/cn';
import { describeState } from './describe';
import { MessageList } from './message-list';
import { TONE_SURFACE, TONE_TEXT, ToneIcon } from './tone';

export interface SectionBannerProps {
  state: UiState;
  onAction?: (action: ActionRef) => void;
  /** Blockers cannot be dismissed; pass this only for states the user may hide. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Section or record level state. Blocking states are announced assertively, everything else politely.
 * Renders nothing for `normal`.
 */
export function SectionBanner({ state, onAction, onDismiss, className }: SectionBannerProps) {
  if (state.kind === 'normal') return null;
  const d = describeState(state);
  const assertive = d.tone === 'critical';
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      data-slot="section-banner"
      data-state-kind={state.kind}
      className={cn('flex items-start gap-2 rounded-md border px-3 py-2', TONE_SURFACE[d.tone], className)}
    >
      <ToneIcon tone={d.tone} busy={d.busy} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p>
          <span className={cn('font-semibold', TONE_TEXT[d.tone])}>{d.label}.</span>{' '}
          <span className="font-medium">{d.title}</span>
          {d.body ? <span className="text-muted-foreground"> {d.body}</span> : null}
        </p>
        {d.progress !== undefined ? (
          <progress className="h-1 w-full max-w-sm" value={d.progress} max={1} aria-label="Progress" />
        ) : null}
        {d.messages && d.messages.length > 1 ? <MessageList messages={d.messages} /> : null}
        {d.messages?.length === 1 && state.kind === 'warning' ? <MessageList messages={d.messages} /> : null}
        {d.messages?.length === 1 && state.kind === 'blockingError' ? (
          <p className="font-mono text-2xs text-muted-foreground">{d.messages[0]?.code}</p>
        ) : null}
        {d.actions?.length ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {d.actions.map((a) => (
              <Button key={a.actionId} variant="secondary" onClick={() => onAction?.(a)}>
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {onDismiss && d.tone !== 'critical' ? (
        <Button variant="ghost" size="icon" aria-label={`Dismiss: ${d.title}`} onClick={onDismiss}>
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
