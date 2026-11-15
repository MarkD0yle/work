import type { BulkResult, Message } from '@ledgerline/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BulkResultPanel, bulkResultCsv } from './bulk-results';

const missing = (id: string): Message => ({
  code: 'LL-VAL-0119',
  severity: 'error',
  level: 'row',
  text: 'Settlement date is missing.',
  fix: 'Add the settlement date, then post again.',
  target: id,
});
const result: BulkResult = {
  jobId: 'J-000010',
  status: 'partial',
  succeeded: Array.from({ length: 490 }, (_, i) => `T-${i}`),
  failed: Array.from({ length: 10 }, (_, i) => ({ id: `T-F${i}`, message: missing(`T-F${i}`) })),
  skipped: [{ id: 'T-S1', reason: 'Already posted.' }],
};
const noun = { one: 'transaction', many: 'transactions' };

describe('BulkResultPanel', () => {
  it('shows three counts and the reasons grouped, in words', () => {
    render(<BulkResultPanel label="Post" noun={noun} result={result} />);
    const panel = screen.getByRole('status', { name: 'Post results' });
    expect(panel.querySelector('[data-slot="bulk-succeeded"]')).toHaveTextContent('Succeeded490');
    expect(panel.querySelector('[data-slot="bulk-failed"]')).toHaveTextContent('Failed10');
    expect(panel.querySelector('[data-slot="bulk-skipped"]')).toHaveTextContent('Skipped1');
    expect(panel).toHaveTextContent(
      '10 failed: Settlement date is missing. Add the settlement date, then post again. LL-VAL-0119',
    );
    expect(panel).toHaveTextContent('1 skipped: Already posted.');
  });

  it('filter to failures and retry are two clicks', async () => {
    const onShowFailures = vi.fn();
    const onRetry = vi.fn();
    render(
      <BulkResultPanel
        label="Post"
        noun={noun}
        result={result}
        onShowFailures={onShowFailures}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show the 10 failed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry the 10 failed' }));
    expect(onShowFailures).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers no retry when nothing failed', () => {
    render(
      <BulkResultPanel
        label="Post"
        noun={noun}
        result={{ ...result, failed: [] }}
        onRetry={vi.fn()}
        onShowFailures={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show the/ })).not.toBeInTheDocument();
  });

  it('exports one line per record with its outcome and reason', () => {
    const lines = bulkResultCsv({ ...result, succeeded: ['T-1'], failed: result.failed.slice(0, 1) })
      .trim()
      .split('\n');
    expect(lines).toEqual([
      'Record,Outcome,Code,What happened,What to do',
      'T-1,succeeded,,,',
      'T-F0,failed,LL-VAL-0119,Settlement date is missing.,"Add the settlement date, then post again."',
      'T-S1,skipped,,Already posted.,',
    ]);
  });
});
