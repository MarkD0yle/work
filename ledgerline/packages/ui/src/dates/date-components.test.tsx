import type { AccountingPeriod, BusinessDate, Message } from '@ledgerline/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { normaliseApiDate } from './api-boundary';
import { BusinessDateInput } from './business-date-input';
import { PeriodPicker } from './period-picker';

const FRIDAY = '2026-11-13';
const trade: BusinessDate = { value: FRIDAY, basis: 'trade', calendar: 'US' };
const settle: BusinessDate = { value: null, basis: 'settle', calendar: 'US', businessDayRule: 'following' };

function setup(value: BusinessDate, extra: Partial<Parameters<typeof BusinessDateInput>[0]> = {}) {
  const onCommit = vi.fn();
  render(
    <BusinessDateInput
      label="Settle date"
      value={value}
      onCommit={onCommit}
      today={FRIDAY}
      holidays={['2026-11-26']}
      {...extra}
    />,
  );
  return { onCommit, input: screen.getByLabelText(/^Settle date/) };
}

describe('BusinessDateInput', () => {
  it('always shows the basis label', () => {
    setup(settle);
    expect(screen.getByText('Settle basis')).toBeInTheDocument();
    render(<BusinessDateInput label="Trade date" value={trade} onCommit={vi.fn()} today={FRIDAY} />);
    expect(screen.getByText('Trade basis')).toBeInTheDocument();
  });

  it('t+2 on a Friday trade resolves to Tuesday on blur', async () => {
    const { onCommit, input } = setup(settle);
    await userEvent.type(input, 't+2');
    expect(screen.getByText(/Tue 17 Nov 2026/)).toBeInTheDocument();
    await userEvent.tab();
    expect(input).toHaveValue('17 Nov 2026');
    expect(onCommit).toHaveBeenCalledWith({ ...settle, value: '2026-11-17' });
  });

  it('uses the calendar it is given: a Monday holiday pushes t+2 to Wednesday', async () => {
    const { onCommit, input } = setup(settle, { holidays: ['2026-11-16'] });
    await userEvent.type(input, 't+2');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: '2026-11-18' }));
  });

  it('accepts ISO and worded dates, and resolves eom and -1m', async () => {
    const { onCommit, input } = setup(settle);
    for (const [typed, iso] of [
      ['2026-11-20', '2026-11-20'],
      ['24 nov 2026', '2026-11-24'],
      ['eom', '2026-11-30'],
      ['-1m', '2026-10-13'],
    ]) {
      await userEvent.clear(input);
      await userEvent.type(input, typed as string);
      await userEvent.tab();
      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ value: iso }));
    }
  });

  it('a non-business date warns and shows the adjusted date', async () => {
    const { onCommit, input } = setup(settle);
    await userEvent.type(input, '2026-11-14');
    await userEvent.tab();
    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent(
      '14 Nov 2026 is a Saturday, not a business day. Moved to Mon 16 Nov 2026.',
    );
    expect(warning).toHaveTextContent('following business day');
    expect(input).toHaveValue('16 Nov 2026');
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: '2026-11-16' }));
  });

  it('a holiday is named as a holiday; with no rule the date is kept and only warned', async () => {
    const { onCommit, input } = setup({ ...settle, businessDayRule: 'none' });
    await userEvent.type(input, '26/11/2026');
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent(
      '26 Nov 2026 is a market holiday, not a business day.',
    );
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: '2026-11-26' }));
  });

  it('null renders as a dash with the label "No date"', () => {
    const { input } = setup(settle);
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', '—');
    expect(input).toHaveAccessibleDescription('No date');
  });

  it('an API value of 9999-12-31 renders as "No date" (converted at the boundary)', () => {
    for (const legacy of ['9999-12-31', '1900-01-01', '0001-01-01', '9999-12-31T00:00:00Z'])
      expect(normaliseApiDate(legacy)).toBeNull();
    expect(normaliseApiDate('2026-11-13')).toBe('2026-11-13');
    const { input } = setup({ ...settle, value: normaliseApiDate('9999-12-31') });
    expect(input).toHaveValue('');
    expect(input).toHaveAccessibleDescription('No date');
  });

  it('rejects text that is not a date, assertively, and commits nothing', async () => {
    const { onCommit, input } = setup(settle);
    await userEvent.type(input, '31/02/2026');
    await userEvent.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('This is not a date.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('entry into a closed period is blocked, with the period and who can reopen', async () => {
    const closed: Message = {
      code: 'LL-PER-0001',
      severity: 'error',
      level: 'field',
      text: 'Oct 2026 is closed for transactions.',
      fix: 'A controller in Investment Accounting can reopen it.',
    };
    const { onCommit, input } = setup(trade, { validate: (iso) => (iso < '2026-11-01' ? closed : null) });
    await userEvent.clear(input);
    await userEvent.type(input, '2026-10-15');
    await userEvent.tab();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Oct 2026 is closed for transactions.');
    expect(alert).toHaveTextContent('A controller in Investment Accounting can reopen it.');
    expect(onCommit).not.toHaveBeenCalled();
    // A date in the open period goes through.
    await userEvent.clear(input);
    await userEvent.type(input, '2026-11-12');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: '2026-11-12' }));
  });

  it('clearing the field commits no date; Escape restores the value', async () => {
    const { onCommit, input } = setup(trade);
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith({ ...trade, value: null });
    await userEvent.type(input, 'garbage{Escape}');
    expect(input).toHaveValue('13 Nov 2026');
  });
});

describe('PeriodPicker', () => {
  const closes = (transaction: AccountingPeriod['state']) =>
    ({ transaction, valuation: 'closed', bankAccount: 'closed', generalLedger: 'closed' }) as const;
  const periods: AccountingPeriod[] = [
    {
      id: 'p-nov',
      portfolioId: 'P-0003',
      periodEnd: '2026-11-30',
      cutoff: '2026-12-07T18:00:00Z',
      state: 'open',
      closes: { transaction: 'open', valuation: 'open', bankAccount: 'open', generalLedger: 'open' },
    },
    {
      id: 'p-oct',
      portfolioId: 'P-0003',
      periodEnd: '2026-10-31',
      cutoff: '2026-11-06T18:00:00Z',
      state: 'reopened',
      closes: closes('reopened'),
    },
    {
      id: 'p-sep',
      portfolioId: 'P-0003',
      periodEnd: '2026-09-30',
      cutoff: '2026-10-07T18:00:00Z',
      state: 'closed',
      closes: closes('closed'),
    },
  ];

  it('shows the state of the selected period and of every option', async () => {
    render(
      <PeriodPicker
        label="Period"
        periods={periods}
        value="p-oct"
        onChange={vi.fn()}
        closeType="transaction"
      />,
    );
    const trigger = screen.getByRole('button', { name: /Period.*Oct 2026.*Reopened/ });
    expect(screen.getByText('Transaction close')).toBeInTheDocument();
    await userEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Nov 2026Open',
      'Oct 2026ReopenedSelected',
      'Sep 2026Closed',
    ]);
  });

  it('close types are explicit: the same period reads differently per close type', () => {
    render(
      <PeriodPicker
        label="Period"
        periods={periods}
        value="p-oct"
        onChange={vi.fn()}
        closeType="valuation"
      />,
    );
    expect(screen.getByRole('button', { name: /Oct 2026.*Closed/ })).toBeInTheDocument();
    expect(screen.getByText('Valuation close')).toBeInTheDocument();
  });

  it('blocks entry into a closed period and says who can reopen it; open and reopened periods can be chosen', async () => {
    const onChange = vi.fn();
    render(
      <PeriodPicker
        label="Period"
        periods={periods}
        value="p-nov"
        onChange={onChange}
        closeType="transaction"
        blockClosed={{ reopenBy: 'A controller in Investment Accounting' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Period/ }));
    const closed = screen.getByRole('menuitem', { name: /Sep 2026/ });
    expect(closed).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(closed).getByText(
        /closed for transaction\. A controller in Investment Accounting can reopen it\./,
      ),
    ).toBeInTheDocument();
    await userEvent.click(closed);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('menuitem', { name: /Oct 2026/ }));
    expect(onChange).toHaveBeenCalledWith(periods[1]);
  });

  it('works from the keyboard', async () => {
    const onChange = vi.fn();
    render(
      <PeriodPicker
        label="Period"
        periods={periods}
        value={null}
        onChange={onChange}
        closeType="transaction"
      />,
    );
    expect(screen.getByRole('button', { name: /Choose a period/ })).toBeInTheDocument();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await screen.findAllByRole('menuitem');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
