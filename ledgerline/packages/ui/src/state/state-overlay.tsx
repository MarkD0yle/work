import type { ActionRef, UiState } from '@ledgerline/contracts';
import type { ReactNode } from 'react';
import { Button } from '../components/button';
import { cn } from '../lib/cn';
import { describeState } from './describe';
import { MessageList } from './message-list';
import { SectionBanner } from './section-banner';
import { TONE_TEXT, ToneIcon } from './tone';

export interface StateOverlayProps {
  state: UiState;
  onAction?: (action: ActionRef) => void;
  /** The content the state applies to (a grid, a form section). */
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a region and shows its UiState. No blank screens:
 * states that leave nothing useful to show (loading, empty, no matches, blocking error, limited access,
 * failed integration) cover the content; all other states sit above it as a banner so work can continue.
 */
export function StateOverlay({ state, onAction, children, className }: StateOverlayProps) {
  const d = describeState(state);
  const covering = state.kind !== 'normal' && d.replacesContent;
  const assertive = d.tone === 'critical';
  return (
    <div
      data-slot="state-overlay"
      data-state-kind={state.kind}
      className={cn('relative flex min-h-0 flex-col', className)}
    >
      {state.kind !== 'normal' && !d.replacesContent ? (
        <SectionBanner state={state} className="mb-2 shrink-0" {...(onAction ? { onAction } : {})} />
      ) : null}
      {/* Content stays mounted under a cover so focus, selection and scroll survive a reload. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        aria-busy={state.kind === 'loading' || undefined}
        inert={covering}
      >
        {children}
      </div>
      {covering ? (
        <div
          role={assertive ? 'alert' : 'status'}
          aria-live={assertive ? 'assertive' : 'polite'}
          className="absolute inset-0 z-10 flex items-center justify-center bg-card/90 p-6"
        >
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <ToneIcon tone={d.tone} busy={d.busy} className="size-6" />
            <p className={cn('text-2xs font-semibold tracking-wide uppercase', TONE_TEXT[d.tone])}>
              {d.label}
            </p>
            <p className="text-lg font-semibold">{d.title}</p>
            {d.body ? <p className="text-muted-foreground">{d.body}</p> : null}
            {d.messages && d.messages.length > 1 ? (
              <MessageList messages={d.messages} className="text-left" />
            ) : null}
            {d.messages?.length === 1 ? (
              <p className="font-mono text-2xs text-muted-foreground">{d.messages[0]?.code}</p>
            ) : null}
            {d.actions?.length ? (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {d.actions.map((a, i) => (
                  <Button
                    key={a.actionId}
                    variant={i === 0 ? 'default' : 'secondary'}
                    onClick={() => onAction?.(a)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
