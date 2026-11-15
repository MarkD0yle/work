import type { ActionContext, ActionDef, BulkResult, Permission } from '@ledgerline/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/tooltip';
import { ActionBar } from './action-bar';
import { formatShortcut, resolveActions, type ResolvedAction } from './registry';
import { useActionRunner, type ActionOutcome } from './use-action-runner';

interface Row {
  id: string;
  status: 'unposted' | 'posted';
}
const ok: Permission = { action: 'x', accessLevel: 'full', allowed: true };
const no = (explanation: string): Permission => ({
  action: 'x',
  accessLevel: 'none',
  allowed: false,
  reason: 'role',
  explanation,
});
const result = (ids: string[]): BulkResult => ({
  jobId: 'B-1',
  status: 'completed',
  succeeded: ids,
  failed: [],
  skipped: [],
});

function registry(
  execute = vi.fn(async (ids: string[]) => result(ids)),
  canReverse = true,
): ActionDef<Row>[] {
  const base = { available: () => ok, agentRequiresConfirmation: true, execute } as const;
  return [
    {
      ...base,
      id: 'row.open',
      label: 'Open',
      description: 'Opens the transaction.',
      tier: 'primary',
      appliesTo: 'single',
      consequence: 'none',
      agentRequiresConfirmation: false,
      shortcut: 'Enter',
    },
    {
      ...base,
      id: 'transaction.post',
      label: 'Post',
      description: 'Posts the selected transactions to the ledger.',
      tier: 'destructive',
      appliesTo: 'multi',
      consequence: 'reversibleWithAudit',
      shortcut: 'Mod+Enter',
      eligibility: (row) => (row.status === 'unposted' ? ok : no('Already posted.')),
    },
    {
      ...base,
      id: 'transaction.reverse',
      label: 'Reverse',
      description: 'Reverses posted transactions.',
      tier: 'destructive',
      appliesTo: 'multi',
      consequence: 'reversibleWithAudit',
      available: () =>
        canReverse ? ok : no('Reversing a posted transaction needs full access on transactions.'),
      eligibility: (row) =>
        row.status === 'posted' ? ok : no('Not posted, so there is nothing to reverse.'),
    },
    {
      ...base,
      id: 'transaction.delete',
      label: 'Delete',
      description: 'Deletes unposted transactions.',
      tier: 'destructive',
      appliesTo: 'multi',
      consequence: 'irreversible',
      requiresReason: true,
      shortcut: 'Delete',
    },
    {
      ...base,
      id: 'grid.copy',
      label: 'Copy',
      description: 'Copies the selected rows.',
      tier: 'secondary',
      appliesTo: 'multi',
      consequence: 'none',
      agentRequiresConfirmation: false,
      shortcut: 'Mod+C',
    },
  ];
}
const ctx = (selection: Row[]): ActionContext<Row> => ({
  selection,
  state: { kind: 'normal' },
  permissions: [],
});
const rows = (...statuses: Row['status'][]): Row[] =>
  statuses.map((status, i) => ({ id: `T-${i + 1}`, status }));

function Harness({
  defs,
  selection,
  onDone,
}: {
  defs: ActionDef<Row>[];
  selection: Row[];
  onDone: (o: ActionOutcome<Row>) => void;
}) {
  const actions = resolveActions(defs, ctx(selection));
  const { run, dialog } = useActionRunner<Row>({
    rowId: (r) => r.id,
    noun: { one: 'transaction', many: 'transactions' },
    onDone,
  });
  return (
    <TooltipProvider>
      <ActionBar actions={actions} onRun={run} label="Actions for selected transactions" />
      {dialog}
    </TooltipProvider>
  );
}

describe('ActionBar', () => {
  it('shows at most 3 actions as buttons and the rest under More', async () => {
    render(<Harness defs={registry()} selection={rows('unposted')} onDone={vi.fn()} />);
    const bar = screen.getByRole('group', { name: 'Actions for selected transactions' });
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-action-id')).filter(Boolean)).toEqual([
      'row.open',
      'transaction.post',
      'transaction.reverse',
    ]);
    await userEvent.click(within(bar).getByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.getAttribute('data-action-id'))).toEqual([
      'transaction.delete',
      'grid.copy',
    ]);
  });

  it('the same action has the same label and shortcut as a button and as a menu item', async () => {
    const defs = registry();
    render(<Harness defs={defs} selection={rows('unposted')} onDone={vi.fn()} />);
    const post = defs[1] as ActionDef<Row>;
    expect(
      screen.getByRole('button', { name: `Post ${formatShortcut(post.shortcut as string)}` }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const del = defs[3] as ActionDef<Row>;
    expect(
      screen.getByRole('menuitem', { name: `Delete ${formatShortcut(del.shortcut as string)}` }),
    ).toBeInTheDocument();
  });

  it('an unavailable action stays visible, takes focus, and gives its reason on hover and on focus', async () => {
    render(<Harness defs={registry(undefined, false)} selection={rows('posted')} onDone={vi.fn()} />);
    const reverse = screen.getByRole('button', { name: 'Reverse' });
    expect(reverse).toHaveAttribute('aria-disabled', 'true');
    expect(reverse).not.toBeDisabled();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(reverse).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Reverse is not available. Reversing a posted transaction needs full access on transactions.',
    );
    // Activating it does nothing.
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a disabled menu item shows its reason in the menu and does not run', async () => {
    const execute = vi.fn(async (ids: string[]) => result(ids));
    render(<Harness defs={registry(execute)} selection={[]} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const copy = screen.getByRole('menuitem', { name: /Copy/ });
    expect(copy).toHaveAttribute('aria-disabled', 'true');
    expect(copy).toHaveTextContent('Select one or more records first.');
    await userEvent.click(copy);
    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('running actions', () => {
  it('an action with no consequence runs at once', async () => {
    const execute = vi.fn(async (ids: string[]) => result(ids));
    const onDone = vi.fn();
    render(<Harness defs={registry(execute)} selection={rows('unposted')} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /^Open/ }));
    expect(execute).toHaveBeenCalledWith(['T-1'], undefined);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ result: result(['T-1']) }));
  });

  it('Post always confirms, stating the consequence, and a single Enter completes it', async () => {
    const execute = vi.fn(async (ids: string[]) => result(ids));
    render(<Harness defs={registry(execute)} selection={rows('unposted')} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Post/ }));
    expect(execute).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Post 1 transaction?' });
    expect(dialog).toHaveTextContent('Posts the selected transactions to the ledger.');
    expect(dialog).toHaveTextContent('This can be reversed later. Both steps stay in the audit history.');
    // The confirm button has focus: daily single-record work is one keystroke, no typing.
    expect(within(dialog).getByRole('button', { name: 'Post 1 transaction' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(execute).toHaveBeenCalledWith(['T-1'], undefined);
  });

  it('ineligible records are counted and grouped by reason before submit, never dropped silently', async () => {
    const execute = vi.fn(async (ids: string[]) => result(ids));
    render(
      <Harness
        defs={registry(execute)}
        selection={rows('unposted', 'posted', 'unposted', 'posted', 'posted')}
        onDone={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Post/ }));
    const dialog = screen.getByRole('dialog', { name: 'Post 2 transactions?' });
    expect(dialog).toHaveTextContent('5 selected. This will run on 2. 3 will be left as they are:');
    expect(within(dialog).getByRole('listitem')).toHaveTextContent('3: Already posted.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Post 2 transactions' }));
    expect(execute).toHaveBeenCalledWith(['T-1', 'T-3'], undefined);
  });

  it('cancel runs nothing', async () => {
    const execute = vi.fn(async (ids: string[]) => result(ids));
    render(<Harness defs={registry(execute)} selection={rows('unposted')} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Post/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(execute).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('an irreversible action says so, and one that needs a reason cannot run without it', async () => {
    const execute = vi.fn(async (ids: string[]) => result(ids));
    render(<Harness defs={registry(execute)} selection={rows('unposted')} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    const dialog = screen.getByRole('dialog', { name: 'Delete 1 transaction?' });
    expect(dialog).toHaveTextContent('This cannot be undone.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete 1 transaction' }));
    expect(execute).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason.');
    await userEvent.type(within(dialog).getByLabelText('Reason (required)'), 'Duplicate entry');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete 1 transaction' }));
    expect(execute).toHaveBeenCalledWith(['T-1'], { reason: 'Duplicate entry' });
  });

  it('a failure reports messages instead of throwing', async () => {
    const messages = [
      {
        code: 'LL-PERM-0001',
        severity: 'error',
        level: 'operation',
        text: 'Not allowed.',
        fix: 'Ask an administrator.',
      },
    ];
    const onDone = vi.fn();
    render(
      <Harness
        defs={registry(vi.fn().mockRejectedValue({ messages }))}
        selection={rows('unposted')}
        onDone={onDone}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Open/ }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ error: messages })));
    const second = vi.fn();
    render(
      <Harness
        defs={registry(vi.fn().mockRejectedValue(new Error('boom')))}
        selection={rows('unposted')}
        onDone={second}
      />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: /^Open/ })[1] as HTMLElement);
    await vi.waitFor(() =>
      expect((second.mock.calls[0]?.[0] as { error: Message[] }).error[0]?.code).toBe('LL-ACT-0500'),
    );
  });
});

type Message = { code: string };
export type { ResolvedAction };
