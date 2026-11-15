import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandProvider, useCommandSource, type CommandItem } from './command-context';
import { CommandPalette, matchCommands } from './command-palette';
import { ShortcutSheet } from './shortcut-sheet';

const item = (over: Partial<CommandItem> & Pick<CommandItem, 'id' | 'group' | 'label'>): CommandItem => ({
  run: vi.fn(),
  ...over,
});

function Screen({ items }: { items: CommandItem[] }) {
  useCommandSource('screen', () => items);
  return <input aria-label="Notes" />;
}

function setup(items: CommandItem[], props: Parameters<typeof CommandPalette>[0] = {}) {
  render(
    <CommandProvider>
      <Screen items={items} />
      <CommandPalette {...props} />
      <ShortcutSheet
        sections={[{ title: 'Everywhere', entries: [{ keys: 'Ctrl+K', what: 'Open the command palette' }] }]}
      />
    </CommandProvider>,
  );
}

const post = item({
  id: 'transaction.post',
  group: 'Actions',
  label: 'Post',
  hint: 'Posts the selected transactions.',
  shortcut: 'Ctrl+Enter',
});
const reverse = item({
  id: 'transaction.reverse',
  group: 'Actions',
  label: 'Reverse',
  disabledReason: 'Reversing needs full access on transactions.',
});
const nav = item({
  id: 'nav.transactions',
  group: 'Navigation',
  label: 'Go to Transactions',
  shortcut: 'g t',
});
const view = item({ id: 'view.yesterday', group: 'Views', label: "Yesterday's unposted trades" });
const all = [nav, post, view, reverse];

describe('matchCommands', () => {
  it('every word must match, in any order, across label, hint and group', () => {
    expect(matchCommands(all, 'post').map((i) => i.id)).toEqual(['transaction.post', 'view.yesterday']);
    expect(matchCommands(all, 'trades unposted').map((i) => i.id)).toEqual(['view.yesterday']);
    expect(matchCommands(all, 'navigation').map((i) => i.id)).toEqual(['nav.transactions']);
    expect(matchCommands(all, '  ')).toHaveLength(4);
    expect(matchCommands(all, 'zzz')).toEqual([]);
  });
});

describe('CommandPalette', () => {
  it('opens with Ctrl+K and lists commands by group: actions first', async () => {
    setup(all);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.keyboard('{Control>}k{/Control}');
    const options = within(screen.getByRole('listbox', { name: 'Commands' })).getAllByRole('option');
    expect(options.map((o) => o.getAttribute('data-command-id'))).toEqual([
      'transaction.post',
      'transaction.reverse',
      'view.yesterday',
      'nav.transactions',
    ]);
    expect(screen.getByRole('combobox', { name: 'Search commands' })).toHaveFocus();
  });

  it('shows the same label and shortcut as the screen, plus the description', async () => {
    setup(all);
    await userEvent.keyboard('{Control>}k{/Control}');
    const option = screen.getByRole('option', { name: /^Post/ });
    expect(option).toHaveTextContent('Posts the selected transactions.');
    expect(option).toHaveTextContent('Ctrl+Enter');
  });

  it('filters as you type and runs with the keyboard only', async () => {
    setup(all);
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('go to');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(nav.run).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arrow keys move through the list and wrap', async () => {
    setup(all);
    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox');
    const ids = () => screen.getAllByRole('option').map((o) => o.id);
    expect(input).toHaveAttribute('aria-activedescendant', ids()[0]);
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', ids()[3]);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', ids()[1]);
  });

  it('an unavailable action is listed with its reason and does not run', async () => {
    setup(all);
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('reverse');
    const option = screen.getByRole('option', { name: /Reverse/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveTextContent('Not available: Reversing needs full access on transactions.');
    await userEvent.keyboard('{Enter}');
    expect(reverse.run).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('finds records after two characters and says when nothing matches', async () => {
    const open = vi.fn();
    const searchEntities = vi.fn(async (q: string) =>
      q === 'p-0005'
        ? [item({ id: 'P-0005', group: 'Entities', label: 'P-0005 Lakeside Fund USD', run: open })]
        : [],
    );
    setup(all, { searchEntities });
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('p');
    expect(searchEntities).not.toHaveBeenCalled();
    await userEvent.keyboard('-0005');
    const found = await screen.findByRole('option', { name: /P-0005 Lakeside Fund USD/ });
    await userEvent.click(found);
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('qqqq');
    expect(await screen.findByText('Nothing matches “qqqq”.')).toBeInTheDocument();
  });

  it('a client sees navigation and views only', async () => {
    setup(all, { groups: ['Navigation', 'Views'], searchEntities: vi.fn() });
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('data-command-id'))).toEqual([
      'view.yesterday',
      'nav.transactions',
    ]);
    expect(screen.queryByText(/find records/)).not.toBeInTheDocument();
  });

  it('reads what the screen offers at the moment it opens', async () => {
    const items = [nav];
    setup(items);
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    items.push(post);
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('ShortcutSheet', () => {
  it('opens on "?" and lists global keys, grid keys and this screen\'s action shortcuts', async () => {
    setup(all);
    await userEvent.keyboard('?');
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(sheet).getByRole('heading', { name: 'Everywhere' })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'In a grid' })).toBeInTheDocument();
    const actions = within(sheet).getByRole('region', { name: 'Actions on this screen' });
    expect(actions).toHaveTextContent('Ctrl+Enter');
    expect(actions).toHaveTextContent('Post');
  });

  it('"?" typed into a field is just a question mark', async () => {
    setup(all);
    await userEvent.type(screen.getByLabelText('Notes'), 'why?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('why?');
  });
});
