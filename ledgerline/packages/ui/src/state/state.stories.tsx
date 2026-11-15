import type { Message, UiState } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../components/button';
import { Input, Label } from '../components/input';
import { FieldMessage } from './field-message';
import {
  NotificationPanel,
  NotificationProvider,
  NotificationToggle,
  useNotifications,
} from './notifications';
import { RowMarker } from './row-marker';
import { SectionBanner } from './section-banner';
import { StateOverlay } from './state-overlay';

const meta: Meta = { title: 'State/UiState' };
export default meta;
type Story = StoryObj;

const ada = { type: 'user', id: 'u-ada', name: 'Ada' } as const;
const cleo = { type: 'user', id: 'u-cleo', name: 'Cleo' } as const;
const error: Message = {
  code: 'LL-VAL-0118',
  severity: 'error',
  level: 'record',
  text: 'Settlement date is before trade date.',
  fix: 'Choose a settlement date on or after 13 Nov 2026.',
  target: 'settleDate',
};
const warning: Message = {
  code: 'LL-VAL-0207',
  severity: 'warning',
  level: 'row',
  text: 'Price differs from the latest vendor price by more than tolerance.',
  fix: 'Check the price against the trade ticket.',
  target: 'T-0000015',
};

/** All 15 UiState kinds (SPEC 7.7 acceptance). Switch theme in the toolbar for dark. */
const STATES: Record<UiState['kind'], UiState> = {
  normal: { kind: 'normal' },
  loading: { kind: 'loading' },
  processing: { kind: 'processing', progress: 0.42, jobId: 'J-000118' },
  empty: { kind: 'empty', reason: 'noData' },
  noMatches: { kind: 'noMatches', activeFilters: 3 },
  warning: { kind: 'warning', messages: [warning] },
  blockingError: {
    kind: 'blockingError',
    messages: [
      error,
      {
        ...error,
        code: 'LL-VAL-0031',
        text: 'Portfolio is required.',
        fix: 'Choose a portfolio.',
        target: 'portfolio',
      },
    ],
    recovery: [{ actionId: 'retry', label: 'Retry' }],
  },
  partialSuccess: { kind: 'partialSuccess', succeeded: 490, failed: 8, skipped: 2, jobId: 'J-000119' },
  permissionLimited: {
    kind: 'permissionLimited',
    reason: 'Your role can view transactions but not change them.',
    requestAccess: { actionId: 'access.request', label: 'Request access' },
  },
  pendingApproval: { kind: 'pendingApproval', approver: cleo, since: '2026-11-14T09:12:00Z' },
  overridden: {
    kind: 'overridden',
    provenance: {
      origin: 'overridden',
      overriddenBy: ada,
      overrideReason: 'Agreed net amount with counterparty.',
      originalValue: '1250000.00',
    },
  },
  failedIntegration: {
    kind: 'failedIntegration',
    system: 'Custody feed',
    retry: { actionId: 'retry', label: 'Retry' },
  },
  stale: { kind: 'stale', asOf: '2026-11-14T15:40:00Z', refresh: { actionId: 'refresh', label: 'Refresh' } },
  conflict: {
    kind: 'conflict',
    theirs: cleo,
    at: '2026-11-14T16:02:00Z',
    resolve: [
      { actionId: 'conflict.review', label: 'Review their change' },
      { actionId: 'conflict.keepMine', label: 'Keep my edits' },
    ],
  },
  recovery: {
    kind: 'recovery',
    from: 'failedIntegration',
    message: 'The custody feed is back. Your data is up to date.',
  },
};

const Content = () => (
  <div className="rounded-md border bg-card p-4">
    <p className="font-medium">Transaction T-0000015</p>
    <p className="text-muted-foreground">Buy · 13 Nov 2026 · 1,250,000.00 USD</p>
  </div>
);

const overlay = (kind: UiState['kind']): Story => ({
  render: () => (
    <StateOverlay state={STATES[kind]} className="h-64 w-[36rem]">
      <Content />
    </StateOverlay>
  ),
});

export const Normal: Story = overlay('normal');
export const Loading: Story = overlay('loading');
export const Processing: Story = overlay('processing');
export const Empty: Story = overlay('empty');
export const NoMatches: Story = overlay('noMatches');
export const Warning: Story = overlay('warning');
export const BlockingError: Story = overlay('blockingError');
export const PartialSuccess: Story = overlay('partialSuccess');
export const PermissionLimited: Story = overlay('permissionLimited');
export const PendingApproval: Story = overlay('pendingApproval');
export const Overridden: Story = overlay('overridden');
export const FailedIntegration: Story = overlay('failedIntegration');
export const Stale: Story = overlay('stale');
export const Conflict: Story = overlay('conflict');
export const Recovery: Story = overlay('recovery');

export const AllBanners: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-2">
      {Object.values(STATES).map((state) => (
        <SectionBanner key={state.kind} state={state} onDismiss={() => undefined} />
      ))}
    </div>
  ),
};

export const FieldMessages: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <div>
        <Label htmlFor="settle">Settle date</Label>
        <Input id="settle" defaultValue="2026-11-12" aria-invalid aria-describedby="settle-msg" />
        <FieldMessage id="settle-msg" message={error} />
      </div>
      <div>
        <Label htmlFor="price">Price</Label>
        <Input id="price" defaultValue="104.250000" aria-describedby="price-msg" />
        <FieldMessage id="price-msg" message={warning} />
      </div>
    </div>
  ),
};

export const RowMarkers: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <RowMarker messages={[warning]} />
      <RowMarker messages={[error, warning]} />
      <RowMarker messages={[{ ...warning, severity: 'info', text: 'Imported from the custody feed.' }]} />
    </div>
  ),
};

function NotificationDemo() {
  const { notify } = useNotifications();
  const [open, setOpen] = useState(true);
  return (
    <div className="flex h-96 w-[48rem] border">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => notify(error, 'Transaction entry')}>
            Raise an error
          </Button>
          <Button variant="secondary" onClick={() => notify(warning, 'Transactions')}>
            Raise a warning
          </Button>
          <NotificationToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
        <div>
          <Label htmlFor="demo-settle">Settle date</Label>
          <Input id="demo-settle" data-ll-target="settleDate" defaultValue="2026-11-12" />
        </div>
        <p className="text-muted-foreground">
          Choose the error in the panel to jump to the field it is about.
        </p>
      </div>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export const Notifications: Story = {
  render: () => (
    <NotificationProvider>
      <NotificationDemo />
    </NotificationProvider>
  ),
};
