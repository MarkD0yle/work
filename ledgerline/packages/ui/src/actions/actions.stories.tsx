import type { ActionContext, ActionDef, BulkResult, Permission } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../components/context-menu';
import { Toaster, toast } from '../components/toaster';
import { ActionBar, ActionMenuItems } from './action-bar';
import { ConfirmDialog } from './confirm-dialog';
import { resolveActions } from './registry';
import { useActionRunner } from './use-action-runner';

const meta: Meta = { title: 'Actions/Action registry' };
export default meta;
type Story = StoryObj;

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
const run = async (ids: string[]): Promise<BulkResult> => ({
  jobId: 'B-000001',
  status: 'completed',
  succeeded: ids,
  failed: [],
  skipped: [],
});

const registry = (canReverse: boolean): ActionDef<Row>[] => [
  {
    id: 'row.open',
    label: 'Open',
    description: 'Opens the transaction.',
    tier: 'primary',
    appliesTo: 'single',
    consequence: 'none',
    shortcut: 'Enter',
    available: () => ok,
    agentRequiresConfirmation: false,
    execute: run,
  },
  {
    id: 'transaction.post',
    label: 'Post',
    description: 'Posts unposted transactions to the ledger.',
    tier: 'destructive',
    appliesTo: 'multi',
    consequence: 'reversibleWithAudit',
    shortcut: 'Mod+Enter',
    available: () => ok,
    eligibility: (row) => (row.status === 'unposted' ? ok : no('Already posted.')),
    agentRequiresConfirmation: true,
    execute: run,
  },
  {
    id: 'transaction.reverse',
    label: 'Reverse',
    description: 'Reverses posted transactions.',
    tier: 'destructive',
    appliesTo: 'multi',
    consequence: 'reversibleWithAudit',
    available: () =>
      canReverse ? ok : no('Reversing a posted transaction needs full access on transactions.'),
    eligibility: (row) => (row.status === 'posted' ? ok : no('Not posted, so there is nothing to reverse.')),
    agentRequiresConfirmation: true,
    execute: run,
  },
  {
    id: 'transaction.delete',
    label: 'Delete',
    description: 'Deletes unposted transactions.',
    tier: 'destructive',
    appliesTo: 'multi',
    consequence: 'irreversible',
    shortcut: 'Delete',
    available: () => ok,
    agentRequiresConfirmation: true,
    execute: run,
  },
  {
    id: 'grid.copy',
    label: 'Copy',
    description: 'Copies the selected rows.',
    tier: 'secondary',
    appliesTo: 'multi',
    consequence: 'none',
    shortcut: 'Mod+C',
    available: () => ok,
    agentRequiresConfirmation: false,
    execute: run,
  },
];

const rows = (...statuses: Row['status'][]): Row[] =>
  statuses.map((status, i) => ({ id: `T-${i + 1}`, status }));
const ctx = (selection: Row[]): ActionContext<Row> => ({
  selection,
  state: { kind: 'normal' },
  permissions: [],
});
const noun = { one: 'transaction', many: 'transactions' };

function Demo({ selection, canReverse = true }: { selection: Row[]; canReverse?: boolean }) {
  const actions = resolveActions(registry(canReverse), ctx(selection));
  const { run: runAction, dialog } = useActionRunner<Row>({
    rowId: (r) => r.id,
    noun,
    onDone: ({ action }) => toast(`${action.def.label}: done`),
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        {selection.length} selected: {selection.map((r) => r.status).join(', ') || 'nothing'}
      </p>
      <ActionBar actions={actions} onRun={runAction} label="Actions for selected transactions" />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="rounded-md border border-dashed p-6 text-muted-foreground">
            Right-click here for the same actions as a context menu.
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>{selection.length} transactions</ContextMenuLabel>
          <ActionMenuItems
            actions={actions.filter((a) => a.def.appliesTo !== 'none')}
            onRun={runAction}
            parts={{ Item: ContextMenuItem as never, Separator: ContextMenuSeparator }}
          />
        </ContextMenuContent>
      </ContextMenu>
      {dialog}
      <Toaster />
    </div>
  );
}

export const OneUnposted: Story = { render: () => <Demo selection={rows('unposted')} /> };
/** Mixed selection: Post and Reverse each apply to some rows; the confirm step counts the rest by reason. */
export const MixedSelection: Story = {
  render: () => <Demo selection={rows('unposted', 'posted', 'unposted', 'posted', 'posted')} />,
};
/** A new user: Reverse stays visible, disabled, and says why on hover and focus. */
export const ReverseNotAllowed: Story = {
  render: () => <Demo selection={rows('posted')} canReverse={false} />,
};
export const NothingSelected: Story = { render: () => <Demo selection={[]} /> };

function ConfirmDemo({ id, selection }: { id: string; selection: Row[] }) {
  const [open, setOpen] = useState(true);
  const action = resolveActions(registry(true), ctx(selection)).find((a) => a.def.id === id);
  if (!action || !open) return <p className="text-muted-foreground">Closed.</p>;
  return (
    <ConfirmDialog
      action={action}
      noun={noun}
      onConfirm={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  );
}

export const ConfirmReversible: Story = {
  render: () => (
    <ConfirmDemo id="transaction.post" selection={rows('unposted', 'posted', 'unposted', 'posted')} />
  ),
};
export const ConfirmIrreversible: Story = {
  render: () => <ConfirmDemo id="transaction.delete" selection={rows('unposted')} />,
};
