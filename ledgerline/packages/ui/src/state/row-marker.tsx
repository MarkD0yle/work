import type { Message } from '@ledgerline/contracts';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/tooltip';
import { cn } from '../lib/cn';
import { MessageList } from './message-list';
import { SEVERITY_LABEL, SEVERITY_TONE, TONE_ICON, TONE_TEXT } from './tone';

const RANK = { info: 0, warning: 1, error: 2 } as const;

export interface RowMarkerProps {
  messages: Message[];
  className?: string;
}

/** Marks a grid row that has messages. The worst severity sets the icon; the tooltip lists them all. */
export function RowMarker({ messages, className }: RowMarkerProps) {
  const worst = messages.reduce<Message | undefined>(
    (a, m) => (!a || RANK[m.severity] > RANK[a.severity] ? m : a),
    undefined,
  );
  if (!worst) return null;
  const tone = SEVERITY_TONE[worst.severity];
  const Icon = TONE_ICON[tone];
  const label = `${SEVERITY_LABEL[worst.severity]}: ${messages.length === 1 ? worst.text : `${messages.length} messages`}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="row-marker"
          data-severity={worst.severity}
          aria-label={label}
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-sm',
            TONE_TEXT[tone],
            className,
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm">
        <MessageList messages={messages} />
      </TooltipContent>
    </Tooltip>
  );
}
