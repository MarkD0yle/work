import type { EntityRef, EntitySearchResult } from '@ledgerline/contracts';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityPicker } from './entity-picker';
import { EntityPickerSheet } from './entity-picker-sheet';
import { detectIdentifier, shouldSearch } from './identify';

const sec = (
  id: string,
  description: string,
  over: Partial<EntitySearchResult> = {},
): EntitySearchResult => ({
  ref: { kind: 'security', id, label: description, altIds: { isin: 'US0378331005' } },
  description,
  type: 'equity',
  currency: 'USD',
  status: 'active',
  parent: 'APPLE INC',
  ...over,
});
const apple = sec('S-0000001', 'APPLE INC ORD', { matchedOn: 'isin' });
const treasury = sec('S-0000002', 'US TREASURY N/B 3.875% 2031-05-15', {
  type: 'govt',
  parent: 'US TREASURY',
});
const restricted: EntitySearchResult = {
  ref: { kind: 'portfolio', id: 'P-0001', label: 'Lake General Account USD' },
  description: 'Lake General Account USD',
  type: 'generalAccount',
  currency: 'USD',
  status: 'active',
  restricted: { reason: 'Outside your account scope.' },
};
const inactive = sec('S-0000009', 'OLD CORP 5% 2020', { status: 'inactive' });

describe('identifier detection', () => {
  it.each([
    ['US0378331005', 'isin'],
    ['us0378331005', 'isin'],
    ['037833100', 'cusip'],
    ['B0YBKJ7', 'sedol'],
    ['S-0000123', 'internalId'],
    ['P-0007', 'internalId'],
  ])('%s is a %s', (text, kind) => expect(detectIdentifier(text)).toBe(kind));

  it.each(['apple', 'AAPL', 'treasury 2031', '12', 'ABCDEFGHI'])('%s is not an identifier', (text) =>
    expect(detectIdentifier(text)).toBeNull(),
  );

  it('search starts at 2 characters, or at once for an identifier', () => {
    expect(shouldSearch('a')).toBe(false);
    expect(shouldSearch(' a ')).toBe(false);
    expect(shouldSearch('ap')).toBe(true);
    expect(shouldSearch('P-0007')).toBe(true);
  });
});

function Harness({
  search,
  recent,
  initial = null,
}: {
  search: (q: string, o: { includeInactive: boolean }) => Promise<EntitySearchResult[]>;
  recent?: () => Promise<EntitySearchResult[]>;
  initial?: EntityRef | null;
}) {
  const [value, setValue] = useState<EntityRef | null>(initial);
  return (
    <>
      <EntityPicker
        label="Security"
        value={value}
        onChange={setValue}
        search={search}
        {...(recent ? { recent } : {})}
      />
      <span data-testid="value">{value?.id ?? 'none'}</span>
    </>
  );
}

describe('EntityPicker', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());
  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const settle = () => act(() => vi.advanceTimersByTimeAsync(250));

  it('pasting a known ISIN selects the security in one step', async () => {
    const search = vi.fn().mockResolvedValue([apple]);
    render(<Harness search={search} />);
    const input = screen.getByRole('combobox', { name: 'Security' });
    input.focus();
    fireEvent.paste(input, { clipboardData: { getData: () => ' US0378331005 ' } });
    // No debounce for a pasted identifier: the search has already been sent.
    expect(search).toHaveBeenCalledWith('US0378331005', { includeInactive: false });
    await act(() => Promise.resolve());
    expect(screen.getByTestId('value')).toHaveTextContent('S-0000001');
    expect(input).toHaveAttribute('placeholder', 'APPLE INC ORD (S-0000001)');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('a pasted identifier with several matches, or a restricted match, is offered, not auto-selected', async () => {
    const search = vi.fn().mockResolvedValue([apple, { ...apple, ref: { ...apple.ref, id: 'S-0000777' } }]);
    render(<Harness search={search} />);
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.paste(input, { clipboardData: { getData: () => 'US0378331005' } });
    await act(() => Promise.resolve());
    expect(screen.getByTestId('value')).toHaveTextContent('none');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('waits for 2 characters and 200ms before searching', async () => {
    const search = vi.fn().mockResolvedValue([treasury]);
    render(<Harness search={search} />);
    const u = user();
    await u.type(screen.getByRole('combobox'), 't');
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('search starts at 2 characters');
    await u.type(screen.getByRole('combobox'), 'r');
    expect(search).not.toHaveBeenCalled();
    await u.type(screen.getByRole('combobox'), 'e');
    await settle();
    // One search for the final text, not one per keystroke.
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('tre', { includeInactive: false });
  });

  it('results show id, description, type, currency and parent; Enter picks with the keyboard', async () => {
    const search = vi.fn().mockResolvedValue([treasury, apple]);
    render(<Harness search={search} />);
    const u = user();
    await u.type(screen.getByRole('combobox'), 'us');
    await settle();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('S-0000002');
    expect(options[0]).toHaveTextContent('US TREASURY N/B 3.875% 2031-05-15');
    expect(options[0]).toHaveTextContent('govt');
    expect(options[0]).toHaveTextContent('USD');
    expect(options[0]).toHaveTextContent('US TREASURY');
    expect(options[1]).toHaveTextContent('ISIN US0378331005');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', options[0]?.id);
    await u.keyboard('{ArrowDown}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', options[1]?.id);
    await u.keyboard('{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('S-0000001');
  });

  it('restricted records appear, disabled, and expose their reason on focus and to screen readers', async () => {
    const search = vi.fn().mockResolvedValue([restricted, treasury]);
    render(<Harness search={search} />);
    const u = user();
    await u.type(screen.getByRole('combobox'), 'lake');
    await settle();
    const option = screen.getByRole('option', { name: /Lake General Account USD/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    // The reason is part of the option's accessible name, so it is read when the option becomes active.
    expect(option).toHaveAccessibleName(/Restricted: Outside your account scope\./);
    // The first usable record is active by default; the restricted one can still be moved to.
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[1]?.id,
    );
    await u.keyboard('{ArrowUp}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', option.id);
    await u.keyboard('{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('none');
    await u.click(option);
    expect(screen.getByTestId('value')).toHaveTextContent('none');
  });

  it('inactive records are hidden by default behind a "Show inactive" toggle', async () => {
    const search = vi.fn(async (_q: string, o: { includeInactive: boolean }) =>
      o.includeInactive ? [inactive] : [],
    );
    render(<Harness search={search} />);
    const u = user();
    await u.type(screen.getByRole('combobox'), 'old corp');
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No matches for “old corp”. Check the identifier, or show inactive records.',
    );
    await u.click(screen.getByLabelText('Show inactive'));
    await settle();
    expect(search).toHaveBeenLastCalledWith('old corp', { includeInactive: true });
    expect(screen.getByRole('option')).toHaveTextContent('Inactive');
  });

  it('shows the last recent items before typing', async () => {
    const recent = vi.fn().mockResolvedValue([apple, treasury]);
    render(<Harness search={vi.fn()} recent={recent} />);
    const u = user();
    await u.click(screen.getByRole('combobox'));
    await settle();
    expect(screen.getByRole('listbox', { name: 'Recent security' })).toBeInTheDocument();
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('a slow earlier search never overwrites a newer one', async () => {
    let releaseFirst: (rows: EntitySearchResult[]) => void = () => undefined;
    const search = vi
      .fn()
      .mockImplementationOnce(() => new Promise<EntitySearchResult[]>((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce([treasury]);
    render(<Harness search={search} />);
    const u = user();
    await u.type(screen.getByRole('combobox'), 'ap');
    await settle();
    await u.type(screen.getByRole('combobox'), 'x');
    await settle();
    await act(async () => releaseFirst([apple]));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('S-0000002');
  });

  it('says when a search fails; Escape closes; the chosen value can be cleared', async () => {
    const search = vi.fn().mockRejectedValue(new Error('down'));
    render(<Harness search={search} initial={apple.ref} />);
    const u = user();
    await u.type(screen.getByRole('combobox'), 'zz');
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('Search failed.');
    await u.keyboard('{Escape}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    await u.click(screen.getByRole('button', { name: 'Clear Security: APPLE INC ORD' }));
    expect(screen.getByTestId('value')).toHaveTextContent('none');
  });
});

describe('EntityPickerSheet', () => {
  it('searches with criteria, multi-selects, skips restricted records and confirms', async () => {
    const search = vi
      .fn()
      .mockResolvedValue([
        treasury,
        apple,
        { ...restricted, ref: { ...restricted.ref, kind: 'security' as const } },
      ]);
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <EntityPickerSheet
        open
        onOpenChange={onOpenChange}
        title="Choose securities"
        search={search}
        types={['govt', 'equity']}
        currencies={['USD', 'EUR']}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'govt');
    await vi.waitFor(() => expect(search).toHaveBeenCalledWith('', { includeInactive: false, type: 'govt' }));
    const list = await screen.findByRole('list', { name: 'Choose securities results' });
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(boxes[2]).toHaveAttribute('aria-disabled', 'true');
    expect(within(list).getByText(/Restricted: Outside your account scope\./)).toBeInTheDocument();

    await userEvent.click(boxes[2] as HTMLElement);
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Select all 2 shown' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await userEvent.click(boxes[1] as HTMLElement);
    await userEvent.click(screen.getByRole('button', { name: 'Use 1 selected' }));
    expect(onConfirm).toHaveBeenCalledWith([treasury.ref]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('starts from the current selection and asks for a search first', async () => {
    render(
      <EntityPickerSheet
        open
        onOpenChange={vi.fn()}
        title="Choose securities"
        search={vi.fn()}
        selected={[apple.ref]}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Type at least 2 characters or choose a criterion.')).toBeInTheDocument();
  });
});
