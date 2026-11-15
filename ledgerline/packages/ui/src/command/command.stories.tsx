import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { Button } from '../components/button';
import { CommandProvider, useCommands, useCommandSource, type CommandItem } from './command-context';
import { CommandPalette } from './command-palette';
import { ShortcutSheet } from './shortcut-sheet';

const meta: Meta = { title: 'Command/Palette and shortcuts' };
export default meta;
type Story = StoryObj;

const noop = () => undefined;
const items: CommandItem[] = [
  {
    id: 'transaction.post',
    group: 'Actions',
    label: 'Post',
    hint: 'Posts unposted transactions to the ledger.',
    shortcut: 'Ctrl+Enter',
    run: noop,
  },
  {
    id: 'transaction.reverse',
    group: 'Actions',
    label: 'Reverse',
    disabledReason: 'Reversing a posted transaction needs full access on transactions.',
    run: noop,
  },
  {
    id: 'grid.copy',
    group: 'Actions',
    label: 'Copy',
    hint: 'Copies the selected rows.',
    shortcut: 'Ctrl+C',
    run: noop,
  },
  {
    id: 'view.yesterday',
    group: 'Views',
    label: "View: Yesterday's unposted trades",
    hint: 'Shared by Ada',
    run: noop,
  },
  { id: 'nav.transactions', group: 'Navigation', label: 'Go to Transactions', shortcut: 'g t', run: noop },
  { id: 'nav.cash', group: 'Navigation', label: 'Go to Cash', shortcut: 'g c', run: noop },
  {
    id: 'workspace.ops',
    group: 'Workspaces',
    label: 'Open workspace: Transaction Operations',
    hint: 'Team default',
    run: noop,
  },
];

function Screen({ show }: { show: 'palette' | 'sheet' }) {
  const { setOpen, setSheetOpen } = useCommands();
  useCommandSource('story', () => items);
  useEffect(() => {
    if (show === 'palette') setOpen(true);
    else setSheetOpen(true);
  }, [show, setOpen, setSheetOpen]);
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Commands (Ctrl+K)
      </Button>
      <Button variant="secondary" onClick={() => setSheetOpen(true)}>
        Shortcuts (?)
      </Button>
    </div>
  );
}

const frame = (show: 'palette' | 'sheet') => (
  <CommandProvider>
    <Screen show={show} />
    <CommandPalette
      searchEntities={async (q) => [
        { id: 'P-0005', group: 'Entities', label: `P-0005 Lakeside Fund USD (matches “${q}”)`, run: noop },
      ]}
    />
    <ShortcutSheet
      sections={[
        {
          title: 'Everywhere',
          entries: [
            { keys: 'Ctrl+K', what: 'Open the command palette' },
            { keys: '?', what: 'Show this list' },
            { keys: 'g then t', what: 'Go to Transactions' },
          ],
        },
      ]}
    />
  </CommandProvider>
);

export const Palette: Story = { render: () => frame('palette') };
export const Shortcuts: Story = { render: () => frame('sheet') };
