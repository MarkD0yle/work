import type { Message } from '@ledgerline/contracts';
import { Button } from '@ledgerline/ui';
import { CircleAlert, LoaderCircle } from 'lucide-react';

/** Whole-panel loading and error states for a composition that cannot show its content yet. */
export function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorPanel({ messages, onRetry }: { messages: Message[]; onRetry: () => void }) {
  return (
    <div role="alert" className="m-6 max-w-xl rounded-md border border-critical/40 bg-critical/5 p-4">
      {messages.map((m) => (
        <div key={m.code} className="flex gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
          <div>
            <p className="font-medium">{m.text}</p>
            {m.fix ? <p className="text-muted-foreground">{m.fix}</p> : null}
            <p className="mt-1 font-mono text-2xs text-muted-foreground">{m.code}</p>
          </div>
        </div>
      ))}
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
