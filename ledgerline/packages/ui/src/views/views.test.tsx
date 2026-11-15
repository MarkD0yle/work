import type { FilterCondition, SavedView } from '@ledgerline/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TaskChips, type TaskChip } from './task-chips';
import { ViewSelector, type ViewSelectorProps } from './view-selector';

const ada = { type: 'user', id: 'u-ada', name: 'Ada' } as const;
const ben = { type: 'user', id: 'u-ben', name: 'Ben' } as const;
const view = (id: string, name: string, over: Partial<SavedView> = {}): SavedView => ({
  id,
  gridId: 'transactions',
  name,
  ownership: 'personal',
  owner: ada,
  state: { columns: [], sort: [], filters: [] },
  schemaVersion: 1,
  updatedAt: '',
  ...over,
});
const views = [
  view('default', 'All transactions', { ownership: 'default' }),
  view('shared-ada', "Yesterday's unposted trades", { ownership: 'shared' }),
  view('shared-ben', "Ben's checks", { ownership: 'shared', owner: ben }),
  view('mine', 'Big buys'),
];

function setup(over: Partial<ViewSelectorProps> = {}) {
  const props = {
    views,
    currentId: 'mine',
    dirty: true,
    userId: 'u-ada',
    onSelect: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onDelete: vi.fn(),
    onRestoreDefault: vi.fn(),
    ...over,
  };
  render(<ViewSelector {...props} />);
  return props;
}
const open = () => userEvent.click(screen.getByRole('button', { name: /^View:/ }));

describe('ViewSelector', () => {
  it('names the current view and marks unsaved changes in words', () => {
    setup();
    expect(screen.getByRole('button', { name: /View: Big buys edited/ })).toBeInTheDocument();
  });

  it('lists views by ownership and says who owns shared ones', async () => {
    setup();
    await open();
    expect(
      within(screen.getByRole('group', { name: 'Default' })).getByRole('menuitemradio', {
        name: 'All transactions',
      }),
    ).toBeInTheDocument();
    const shared = within(screen.getByRole('group', { name: 'Shared' }));
    expect(
      shared.getByRole('menuitemradio', { name: /Yesterday's unposted trades yours/ }),
    ).toBeInTheDocument();
    expect(shared.getByRole('menuitemradio', { name: /Ben's checks Ben/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'My views' })).getByRole('menuitemradio', {
        name: 'Big buys',
      }),
    ).toBeChecked();
  });

  it('selects a view and restores the default from the keyboard', async () => {
    const props = setup();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'All transactions' }));
    expect(props.onSelect).toHaveBeenCalledWith(views[0]);
    await open();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore default' }));
    expect(props.onRestoreDefault).toHaveBeenCalled();
  });

  it('the owner can save over and delete their own view', async () => {
    const props = setup();
    await open();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save changes' }));
    expect(props.onSave).toHaveBeenCalled();
    await open();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete this view' }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('a shared view the user does not own cannot be overwritten: saving makes a personal copy', async () => {
    const props = setup({ currentId: 'shared-ben' });
    await open();
    expect(screen.queryByRole('menuitem', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete this view' })).not.toBeInTheDocument();
    const copy = screen.getByRole('menuitem', { name: /Save as my copy/ });
    expect(copy).toHaveTextContent('Only Ben can change this view.');
    await userEvent.click(copy);
    expect(screen.getByLabelText('Name')).toHaveValue("Ben's checks (my copy)");
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }));
    expect(props.onSaveAs).toHaveBeenCalledWith({ name: "Ben's checks (my copy)", ownership: 'personal' });
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('the default view is never overwritten or deleted from here', async () => {
    setup({ currentId: 'default', userId: 'u-ben' });
    await open();
    expect(screen.getByRole('menuitem', { name: /Save as my copy/ })).toHaveTextContent('shared by everyone');
    expect(screen.queryByRole('menuitem', { name: 'Delete this view' })).not.toBeInTheDocument();
  });

  it('save as new asks for a name and who can use it', async () => {
    const props = setup();
    await open();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save as new view…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for the view.');
    expect(props.onSaveAs).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Name'), 'Month-end check');
    await userEvent.click(screen.getByLabelText('Everyone. Only I can change it.'));
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }));
    expect(props.onSaveAs).toHaveBeenCalledWith({ name: 'Month-end check', ownership: 'shared' });
  });

  it('says there is nothing to save when the view is unchanged', async () => {
    setup({ dirty: false });
    expect(screen.getByRole('button', { name: 'View: Big buys' })).toBeInTheDocument();
    await open();
    expect(screen.getByRole('menuitem', { name: 'Save changes (nothing to save)' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('TaskChips', () => {
  const chips: TaskChip[] = [
    { id: 'warnings', label: 'Warnings only', filter: { field: 'warning', op: 'isNotNull' } },
    { id: 'mine', label: 'My records', filter: { field: 'createdBy', op: 'eq', value: 'u-ada' } },
    { id: 'today', label: 'Today', filter: { field: 'tradeDate', op: 'relative', period: 'today' } },
  ];
  function Harness() {
    const [filters, setFilters] = useState<FilterCondition[]>([
      { field: 'status', op: 'eq', value: 'unposted' },
    ]);
    return (
      <>
        <TaskChips chips={chips} filters={filters} onChange={setFilters} />
        <output>{JSON.stringify(filters)}</output>
      </>
    );
  }

  it('a chip adds its condition to the filters and removes only its own', async () => {
    render(<Harness />);
    const today = screen.getByRole('button', { name: 'Today' });
    expect(today).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(today);
    await userEvent.click(screen.getByRole('button', { name: 'My records' }));
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(screen.getByRole('status').textContent ?? '[]')).toEqual([
      { field: 'status', op: 'eq', value: 'unposted' },
      { field: 'tradeDate', op: 'relative', period: 'today' },
      { field: 'createdBy', op: 'eq', value: 'u-ada' },
    ]);
    await userEvent.click(today);
    expect(JSON.parse(screen.getByRole('status').textContent ?? '[]')).toHaveLength(2);
    expect(today).toHaveAttribute('aria-pressed', 'false');
  });

  it('works from the keyboard', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Warnings only' })).toHaveAttribute('aria-pressed', 'true');
  });
});
