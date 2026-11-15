import type { AccountingPeriod, BusinessDate, Message } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { BusinessDateInput } from './business-date-input';
import { PeriodPicker } from './period-picker';

const meta: Meta = { title: 'Dates/Date and period fields' };
export default meta;
type Story = StoryObj;

const TODAY = '2026-11-13';
const HOLIDAYS = ['2026-11-26', '2026-12-25'];

function DateDemo({
  label,
  initial,
  validate,
  disabled,
}: {
  label: string;
  initial: BusinessDate;
  validate?: (iso: string) => Message | null;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-1">
      <BusinessDateInput
        label={label}
        value={value}
        onCommit={setValue}
        today={TODAY}
        holidays={HOLIDAYS}
        {...(validate ? { validate } : {})}
        {...(disabled ? { disabled } : {})}
      />
      <p className="font-mono text-2xs text-muted-foreground">stored: {value.value ?? 'null'}</p>
    </div>
  );
}

const closedPeriod = (iso: string): Message | null =>
  iso < '2026-11-01'
    ? {
        code: 'LL-PER-0001',
        severity: 'error',
        level: 'field',
        text: 'Oct 2026 is closed for transactions in this portfolio.',
        fix: 'Use a date in an open period, or ask a controller in Investment Accounting to reopen it.',
      }
    : null;

/** Today is Fri 13 Nov 2026. Try `t+2`, `-1m`, `eom`, `14/11/2026` (a Saturday), `26 Nov 2026` (a holiday). */
export const DateInputs: Story = {
  render: () => (
    <div className="grid w-[40rem] grid-cols-2 gap-6">
      <DateDemo
        label="Trade date"
        initial={{ value: TODAY, basis: 'trade', calendar: 'US' }}
        validate={closedPeriod}
      />
      <DateDemo
        label="Settle date"
        initial={{ value: null, basis: 'settle', calendar: 'US', businessDayRule: 'following' }}
      />
      <DateDemo
        label="Effective date"
        initial={{
          value: '2026-10-31',
          basis: 'effective',
          calendar: 'US',
          businessDayRule: 'modifiedFollowing',
        }}
      />
      <DateDemo label="Valuation date" initial={{ value: TODAY, basis: 'valuation' }} disabled />
    </div>
  ),
};

const closes = (transaction: AccountingPeriod['state'], rest: AccountingPeriod['state'] = 'closed') => ({
  transaction,
  valuation: rest,
  bankAccount: rest,
  generalLedger: rest,
});
const periods: AccountingPeriod[] = [
  {
    id: 'nov',
    portfolioId: 'P-0003',
    periodEnd: '2026-11-30',
    cutoff: '2026-12-07T18:00:00Z',
    state: 'open',
    closes: closes('open', 'open'),
  },
  {
    id: 'oct',
    portfolioId: 'P-0003',
    periodEnd: '2026-10-31',
    cutoff: '2026-11-06T18:00:00Z',
    state: 'reopened',
    closes: closes('reopened'),
  },
  {
    id: 'sep',
    portfolioId: 'P-0003',
    periodEnd: '2026-09-30',
    cutoff: '2026-10-07T18:00:00Z',
    state: 'closing',
    closes: closes('closing'),
  },
  {
    id: 'aug',
    portfolioId: 'P-0003',
    periodEnd: '2026-08-31',
    cutoff: '2026-09-07T18:00:00Z',
    state: 'closed',
    closes: closes('closed'),
  },
];

function PeriodDemo({
  closeType,
  block,
  open,
}: {
  closeType: 'transaction' | 'valuation';
  block?: boolean;
  open?: boolean;
}) {
  const [value, setValue] = useState<string | null>(open ? null : 'oct');
  return (
    <PeriodPicker
      label="Accounting period"
      className="w-72"
      periods={periods}
      value={value}
      onChange={(p) => setValue(p.id)}
      closeType={closeType}
      {...(block ? { blockClosed: { reopenBy: 'A controller in Investment Accounting' } } : {})}
    />
  );
}

/** The same periods read differently by close type. With entry blocked, closed periods say who can reopen them. */
export const PeriodPickers: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <PeriodDemo closeType="transaction" block />
      <PeriodDemo closeType="valuation" />
      <PeriodDemo closeType="transaction" open />
    </div>
  ),
};
