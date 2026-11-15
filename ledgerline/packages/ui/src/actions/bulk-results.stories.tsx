import type { BulkResult, Message } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BulkResultPanel } from './bulk-results';

const meta: Meta = { title: 'Actions/BulkResultPanel' };
export default meta;

const closed = (id: string): Message => ({
  code: 'LL-PER-0001',
  severity: 'error',
  level: 'row',
  text: 'The period ending 2026-10-31 is closed for transactions.',
  fix: 'Ask a controller to reopen the period.',
  target: id,
});
const partial: BulkResult = {
  jobId: 'J-000010',
  status: 'partial',
  succeeded: Array.from({ length: 490 }, (_, i) => `T-${i}`),
  failed: Array.from({ length: 10 }, (_, i) => ({ id: `T-F${i}`, message: closed(`T-F${i}`) })),
  skipped: [{ id: 'T-S1', reason: 'Already posted.' }],
};
const noun = { one: 'transaction', many: 'transactions' };
const noop = () => undefined;

export const PartialSuccess: StoryObj = {
  render: () => (
    <BulkResultPanel
      label="Post"
      noun={noun}
      result={partial}
      onShowFailures={noop}
      onRetry={noop}
      onExport={noop}
      onDismiss={noop}
    />
  ),
};
export const EverythingFailed: StoryObj = {
  render: () => (
    <BulkResultPanel
      label="Post"
      noun={noun}
      result={{ ...partial, status: 'failed', succeeded: [], skipped: [] }}
      onRetry={noop}
      onExport={noop}
      onDismiss={noop}
    />
  ),
};
export const SkippedOnly: StoryObj = {
  render: () => (
    <BulkResultPanel
      label="Reverse"
      noun={noun}
      result={{ ...partial, failed: [] }}
      onExport={noop}
      onDismiss={noop}
    />
  ),
};
export const Retrying: StoryObj = {
  render: () => (
    <BulkResultPanel label="Post" noun={noun} result={partial} onRetry={noop} retrying onDismiss={noop} />
  ),
};
