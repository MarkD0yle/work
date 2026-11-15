import type { BulkResult } from '@ledgerline/contracts';
import { Button } from '../components/button';
import { cn } from '../lib/cn';
import { TONE_SURFACE, ToneIcon } from '../state/tone';
import type { Noun } from './confirm-dialog';

export interface BulkResultPanelProps {
  /** The action that ran, e.g. "Post". */
  label: string;
  noun: Noun;
  result: BulkResult;
  /** Filters the list to the rows that failed. */
  onShowFailures?: () => void;
  /** Runs the action again on the failed rows only. */
  onRetry?: () => void;
  retrying?: boolean;
  onExport?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const n = (value: number) => value.toLocaleString('en-US');
function grouped(texts: string[]): { text: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
  return [...counts].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count);
}

/** One CSV row per record: what happened to it and why. Used by "Export results". */
export function bulkResultCsv(result: BulkResult): string {
  const cell = (text: string) => (/[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);
  const rows = [
    ['Record', 'Outcome', 'Code', 'What happened', 'What to do'],
    ...result.succeeded.map((id) => [id, 'succeeded', '', '', '']),
    ...result.failed.map((f) => [f.id, 'failed', f.message.code, f.message.text, f.message.fix ?? '']),
    ...result.skipped.map((s) => [s.id, 'skipped', '', s.reason, '']),
  ];
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

/**
 * The outcome of a bulk action that did not fully succeed (SPEC 7.4). Partial success is a first-class
 * result: three counts, the reasons grouped, and the next steps beside them. It stays until dismissed.
 */
export function BulkResultPanel({
  label,
  noun,
  result,
  onShowFailures,
  onRetry,
  retrying,
  onExport,
  onDismiss,
  className,
}: BulkResultPanelProps) {
  const failed = result.failed.length;
  const skipped = result.skipped.length;
  const tone = result.succeeded.length === 0 && failed > 0 ? 'critical' : 'warning';
  const failures = grouped(
    result.failed.map(
      (f) => `${f.message.text}${f.message.fix ? ` ${f.message.fix}` : ''} ${f.message.code}`,
    ),
  );
  const skips = grouped(result.skipped.map((s) => s.reason));
  return (
    <section
      data-slot="bulk-results"
      role="status"
      aria-label={`${label} results`}
      className={cn('flex flex-col gap-2 rounded-md border px-3 py-2', TONE_SURFACE[tone], className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <ToneIcon tone={tone} />
        <p className="font-medium">
          {label}:{' '}
          {result.status === 'cancelled'
            ? 'cancelled part way'
            : failed + skipped === 0
              ? 'done'
              : 'finished with rows left over'}
        </p>
        <dl className="tabular flex gap-4">
          {(
            [
              ['Succeeded', result.succeeded.length],
              ['Failed', failed],
              ['Skipped', skipped],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className="flex gap-1" data-slot={`bulk-${name.toLowerCase()}`}>
              <dt>{name}</dt>
              <dd className="font-semibold">{n(value)}</dd>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex flex-wrap gap-2">
          {failed && onShowFailures ? (
            <Button variant="secondary" onClick={onShowFailures}>
              Show the {n(failed)} failed
            </Button>
          ) : null}
          {failed && onRetry ? (
            <Button variant="secondary" disabled={retrying} onClick={onRetry}>
              {retrying ? 'Retrying…' : `Retry the ${n(failed)} failed`}
            </Button>
          ) : null}
          {onExport ? (
            <Button variant="ghost" onClick={onExport}>
              Export results
            </Button>
          ) : null}
          {onDismiss ? (
            <Button variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
      {failures.length || skips.length ? (
        <ul className="list-disc pl-9 text-xs">
          {failures.slice(0, 4).map((f) => (
            <li key={f.text}>
              <span className="font-medium">{n(f.count)} failed:</span> {f.text}
            </li>
          ))}
          {skips.slice(0, 3).map((s) => (
            <li key={s.text}>
              <span className="font-medium">{n(s.count)} skipped:</span> {s.text}
            </li>
          ))}
          {failures.length > 4 || skips.length > 3 ? (
            <li>More reasons are in the exported results.</li>
          ) : null}
        </ul>
      ) : null}
      <p className="sr-only">
        {n(result.succeeded.length)} {result.succeeded.length === 1 ? noun.one : noun.many} succeeded,{' '}
        {n(failed)} failed, {n(skipped)} skipped.
      </p>
    </section>
  );
}
