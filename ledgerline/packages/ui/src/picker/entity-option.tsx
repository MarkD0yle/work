import type { EntitySearchResult } from '@ledgerline/contracts';
import { Lock } from 'lucide-react';
import { Badge } from '../components/badge';
import { cn } from '../lib/cn';

/**
 * One result row: id, description, type, currency, status and parent (SPEC 7.3).
 * A restricted record shows its reason as text, so it is read on focus and by screen readers.
 */
export function EntityOptionContent({
  result,
  className,
}: {
  result: EntitySearchResult;
  className?: string;
}) {
  const altId =
    result.matchedOn && result.matchedOn !== 'id' ? result.ref.altIds?.[result.matchedOn] : undefined;
  return (
    <span className={cn('flex min-w-0 flex-1 flex-col', className)}>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs">{result.ref.id}</span>
        <span className={cn('truncate', result.restricted && 'text-muted-foreground')}>
          {result.description}
        </span>
        {result.status === 'inactive' ? <Badge status="neutral">Inactive</Badge> : null}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
        <span>{result.type}</span>
        {result.currency ? <span>{result.currency}</span> : null}
        {result.parent ? <span className="truncate">{result.parent}</span> : null}
        {altId ? (
          <span className="font-mono">
            {result.matchedOn?.toUpperCase()} {altId}
          </span>
        ) : null}
      </span>
      {result.restricted ? (
        <span className="flex items-center gap-1 text-2xs text-warning">
          <Lock aria-hidden className="size-3" />
          Restricted: {result.restricted.reason}
        </span>
      ) : null}
    </span>
  );
}
