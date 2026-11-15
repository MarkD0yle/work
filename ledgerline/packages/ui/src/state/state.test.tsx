import type { Message, UiState } from '@ledgerline/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { describeState } from './describe';
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
import { TooltipProvider } from '../components/tooltip';

const error: Message = {
  code: 'LL-VAL-0118',
  severity: 'error',
  level: 'field',
  text: 'Settlement date is before trade date.',
  fix: 'Choose a later settlement date.',
  target: 'settleDate',
};
const warning: Message = {
  code: 'LL-VAL-0207',
  severity: 'warning',
  level: 'row',
  text: 'Price is outside tolerance.',
  fix: 'Check the ticket.',
  target: 'T-1',
};
const ada = { type: 'user', id: 'u-ada', name: 'Ada' } as const;

const ALL: UiState[] = [
  { kind: 'normal' },
  { kind: 'loading' },
  { kind: 'processing', progress: 0.5, jobId: 'J-1' },
  { kind: 'empty', reason: 'noData' },
  { kind: 'noMatches', activeFilters: 2 },
  { kind: 'warning', messages: [warning] },
  { kind: 'blockingError', messages: [error], recovery: [{ actionId: 'retry', label: 'Retry' }] },
  { kind: 'partialSuccess', succeeded: 490, failed: 8, skipped: 2, jobId: 'J-2' },
  { kind: 'permissionLimited', reason: 'Your role can view transactions but not change them.' },
  { kind: 'pendingApproval', approver: ada, since: '2026-11-14T09:12:00Z' },
  {
    kind: 'overridden',
    provenance: {
      origin: 'overridden',
      overriddenBy: ada,
      overrideReason: 'Agreed.',
      originalValue: '10.00',
    },
  },
  { kind: 'failedIntegration', system: 'Custody feed', retry: { actionId: 'retry', label: 'Retry' } },
  { kind: 'stale', asOf: '2026-11-14T15:40:00Z', refresh: { actionId: 'refresh', label: 'Refresh' } },
  {
    kind: 'conflict',
    theirs: ada,
    at: '2026-11-14T16:02:00Z',
    resolve: [{ actionId: 'keep', label: 'Keep my edits' }],
  },
  { kind: 'recovery', from: 'failedIntegration', message: 'The feed is back.' },
];

describe('describeState', () => {
  it('covers all 15 UiState kinds with a status word and a title', () => {
    expect(new Set(ALL.map((s) => s.kind)).size).toBe(15);
    for (const state of ALL) {
      const d = describeState(state);
      expect(d.label, state.kind).toBeTruthy();
      expect(d.title, state.kind).toBeTruthy();
    }
  });

  it('partial success shows three separate counts', () => {
    expect(describeState(ALL[7] as UiState).title).toBe('490 succeeded, 8 failed, 2 skipped');
  });

  it('stale data offers refresh and promises not to overwrite edits', () => {
    const d = describeState(ALL[12] as UiState);
    expect(d.title).toBe('Showing data as of 2026-11-14 15:40 UTC');
    expect(d.actions).toEqual([{ actionId: 'refresh', label: 'Refresh' }]);
    expect(d.body).toMatch(/never overwrites unsaved edits/);
  });
});

describe('SectionBanner', () => {
  it('renders nothing for normal', () => {
    const { container } = render(<SectionBanner state={{ kind: 'normal' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(ALL.filter((s) => s.kind !== 'normal'))('$kind is announced, with status in words', (state) => {
    render(<SectionBanner state={state} />);
    const d = describeState(state);
    const banner = screen.getByRole(d.tone === 'critical' ? 'alert' : 'status');
    expect(banner).toHaveAttribute('aria-live', d.tone === 'critical' ? 'assertive' : 'polite');
    expect(banner).toHaveTextContent(d.label);
    expect(banner).toHaveTextContent(d.title);
  });

  it('new blocking errors are assertive; warnings are polite', () => {
    const { rerender } = render(<SectionBanner state={{ kind: 'warning', messages: [warning] }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    rerender(<SectionBanner state={{ kind: 'blockingError', messages: [error] }} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('runs actions from the keyboard and never offers to dismiss a blocker', async () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <SectionBanner state={ALL[12] as UiState} onAction={onAction} onDismiss={onDismiss} />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledWith({ actionId: 'refresh', label: 'Refresh' });
    await userEvent.click(screen.getByRole('button', { name: /^Dismiss/ }));
    expect(onDismiss).toHaveBeenCalled();
    rerender(<SectionBanner state={ALL[6] as UiState} onAction={onAction} onDismiss={onDismiss} />);
    expect(screen.queryByRole('button', { name: /^Dismiss/ })).not.toBeInTheDocument();
  });

  it('messages lead with plain language and show the code', () => {
    render(<SectionBanner state={{ kind: 'warning', messages: [warning] }} />);
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Price is outside tolerance. Check the ticket. LL-VAL-0207');
  });
});

describe('StateOverlay', () => {
  const content = <button type="button">Post</button>;

  it('covers content for states with nothing useful to show, and makes it inert', () => {
    for (const kind of [
      'loading',
      'empty',
      'noMatches',
      'blockingError',
      'permissionLimited',
      'failedIntegration',
    ] as const) {
      const state = ALL.find((s) => s.kind === kind) as UiState;
      const { unmount, container } = render(<StateOverlay state={state}>{content}</StateOverlay>);
      expect(container.querySelector('[inert]'), kind).not.toBeNull();
      expect(screen.getByText(describeState(state).title)).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps content usable under a banner for every other state', () => {
    for (const kind of [
      'processing',
      'warning',
      'partialSuccess',
      'pendingApproval',
      'overridden',
      'stale',
      'conflict',
      'recovery',
    ] as const) {
      const state = ALL.find((s) => s.kind === kind) as UiState;
      const { unmount, container } = render(<StateOverlay state={state}>{content}</StateOverlay>);
      expect(container.querySelector('[inert]'), kind).toBeNull();
      expect(container.querySelector('[data-slot="section-banner"]'), kind).not.toBeNull();
      unmount();
    }
  });

  it('a blocking error is assertive and its recovery action works', async () => {
    const onAction = vi.fn();
    render(
      <StateOverlay state={ALL[6] as UiState} onAction={onAction}>
        {content}
      </StateOverlay>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledWith({ actionId: 'retry', label: 'Retry' });
  });

  it('shows only the content when normal', () => {
    const { container } = render(<StateOverlay state={{ kind: 'normal' }}>{content}</StateOverlay>);
    expect(container.querySelector('[role="alert"], [role="status"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();
  });
});

describe('FieldMessage and RowMarker', () => {
  it('field errors are assertive, warnings polite, and both can describe an input', () => {
    render(
      <>
        <input aria-label="Settle date" aria-describedby="m1" />
        <FieldMessage id="m1" message={error} />
        <FieldMessage id="m2" message={warning} />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByLabelText('Settle date')).toHaveAccessibleDescription(
      /Settlement date is before trade date/,
    );
  });

  it('a row marker names the worst severity and lists every message on focus', async () => {
    render(
      <TooltipProvider>
        <RowMarker messages={[warning, error]} />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Error: 2 messages' })).toHaveAttribute(
      'data-severity',
      'error',
    );
    await userEvent.tab();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('LL-VAL-0118');
    expect(tip).toHaveTextContent('LL-VAL-0207');
  });

  it('renders nothing for a row with no messages', () => {
    const { container } = render(
      <TooltipProvider>
        <RowMarker messages={[]} />
      </TooltipProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('notifications', () => {
  function Harness({ resolver }: { resolver?: (target: string) => boolean }) {
    const { notify, registerTargetResolver } = useNotifications();
    return (
      <>
        <button type="button" onClick={() => notify(error, 'Entry')}>
          raise error
        </button>
        <button type="button" onClick={() => notify(warning, 'Transactions')}>
          raise warning
        </button>
        <button type="button" onClick={() => resolver && registerTargetResolver(resolver)}>
          register
        </button>
        <input aria-label="Settle date" data-ll-target="settleDate" />
        <NotificationToggle open onToggle={() => undefined} />
        <NotificationPanel open onClose={() => undefined} />
      </>
    );
  }
  const setup = (resolver?: (target: string) => boolean) =>
    render(
      <NotificationProvider>
        <Harness {...(resolver ? { resolver } : {})} />
      </NotificationProvider>,
    );

  it('announces errors assertively and warnings politely', async () => {
    const { container } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'raise warning' }));
    expect(container.querySelector('[data-slot="live-polite"]')).toHaveTextContent(
      'Price is outside tolerance. Check the ticket.',
    );
    expect(container.querySelector('[data-slot="live-assertive"]')).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole('button', { name: 'raise error' }));
    expect(container.querySelector('[data-slot="live-assertive"]')).toHaveTextContent(
      'Settlement date is before trade date.',
    );
    expect(container.querySelector('[data-slot="live-assertive"]')).toHaveAttribute('aria-live', 'assertive');
  });

  it('keeps a session history, newest first, with a count', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'raise warning' }));
    await userEvent.click(screen.getByRole('button', { name: 'raise error' }));
    const panel = screen.getByRole('complementary', { name: 'Notifications' });
    const items = within(panel).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('LL-VAL-0118');
    expect(items[1]).toHaveTextContent('LL-VAL-0207');
    expect(screen.getByLabelText('2 this session, 1 errors')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Clear' }));
    expect(within(panel).queryAllByRole('listitem')).toHaveLength(0);
    expect(panel).toHaveTextContent('No messages this session');
  });

  it('clicking a message focuses its field', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'raise error' }));
    await userEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: /Settlement date is before trade date/,
      }),
    );
    expect(screen.getByLabelText('Settle date')).toHaveFocus();
  });

  it('asks registered resolvers first, so a grid can focus its own row', async () => {
    const resolver = vi.fn().mockReturnValue(true);
    setup(resolver);
    await userEvent.click(screen.getByRole('button', { name: 'register' }));
    await userEvent.click(screen.getByRole('button', { name: 'raise warning' }));
    await userEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: /Price is outside tolerance/ }),
    );
    expect(resolver).toHaveBeenCalledWith('T-1');
  });

  it('says so when the target is no longer on screen', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'raise warning' }));
    await userEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: /Price is outside tolerance/ }),
    );
    expect(screen.getByText('That record is not on screen any more.')).toBeInTheDocument();
  });
});
