import type { Comparison, FinancialValue } from '@ledgerline/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '../components/tooltip';
import { ComparisonTable } from './comparison';

const mv = (
  value: string | null,
  source: string,
  nullReason?: FinancialValue['nullReason'],
): FinancialValue => ({
  kind: 'marketValue',
  value,
  currency: 'USD',
  precision: 2,
  signConvention: 'natural',
  provenance: { origin: 'calculated', source, asOf: '2026-11-13T22:00:00Z' },
  ...(nullReason ? { nullReason } : {}),
});
const units = (value: string): FinancialValue => ({
  kind: 'quantity',
  value,
  precision: 4,
  signConvention: 'natural',
  provenance: { origin: 'calculated' },
});
const comparison: Comparison = {
  leftLabel: 'Investment book',
  rightLabel: 'Accounting book',
  tolerancePct: '0.5',
  rows: [
    {
      key: 'a',
      label: 'Bond A',
      left: mv('1000000.00', 'Investment book'),
      right: mv('1000000.00', 'Accounting book'),
      leftUnits: units('1000'),
      rightUnits: units('1000'),
    },
    {
      key: 'b',
      label: 'Bond B',
      left: mv('1000000.00', 'Investment book'),
      right: mv('1020000.00', 'Accounting book'),
      leftUnits: units('1000'),
      rightUnits: units('1010'),
    },
    {
      key: 'c',
      label: 'Bond C',
      left: mv('0.00', 'Investment book'),
      right: mv(null, 'Accounting book', 'missing'),
    },
    {
      key: 'd',
      label: 'Bond D',
      left: mv('500.00', 'Investment book'),
      right: mv(null, 'Accounting book', 'unavailable'),
    },
  ],
};
const show = (props: Partial<Parameters<typeof ComparisonTable>[0]> = {}) =>
  render(
    <TooltipProvider>
      <ComparisonTable comparison={comparison} {...props} />
    </TooltipProvider>,
  );
const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('ComparisonTable', () => {
  it('a tolerance breach is identifiable without colour', () => {
    show();
    expect(within(row('Bond B')).getByText('Breach')).toBeInTheDocument();
    expect(within(row('Bond A')).getByText('Within')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('4 compared. 1 outside the 0.5% tolerance.');
  });

  it('zero and missing never render the same, and a missing side is never compared as zero', () => {
    show();
    const c = row('Bond C');
    const cells = within(c).getAllByRole('button');
    expect(cells[0]).toHaveTextContent('0.00');
    expect(cells[1]).toHaveTextContent('—');
    expect(cells[1]).toHaveAccessibleName(/Missing/);
    expect(c.querySelector('[data-slot="comparison-delta"]')).toHaveTextContent('No comparison: no value');
    // Unavailable is a third display, different again.
    expect(within(row('Bond D')).getAllByRole('button')[1]).toHaveTextContent('n/a');
    expect(row('Bond C')).toHaveAttribute('data-level', 'none');
  });

  it('shows the difference as amount, percent and units, and the user picks which leads', async () => {
    show();
    const delta = () => row('Bond B').querySelector('[data-slot="comparison-delta"]') as HTMLElement;
    expect(delta().firstElementChild).toHaveTextContent('+20,000.00 USD');
    expect(delta()).toHaveTextContent('+2.00% · +10.0000');
    await userEvent.selectOptions(screen.getByLabelText('Lead with'), 'percent');
    expect(delta().firstElementChild).toHaveTextContent('+2.00%');
    await userEvent.selectOptions(screen.getByLabelText('Lead with'), 'units');
    expect(delta().firstElementChild).toHaveTextContent('+10.0000');
  });

  it('each side shows its source and update time', () => {
    show();
    expect(screen.getByRole('columnheader', { name: /Investment book/ })).toHaveTextContent(
      'Source: Investment book, updated 2026-11-13 22:00 UTC',
    );
  });

  it('says so when it shows only the differences', () => {
    show({ onlyDifferences: true });
    expect(screen.queryByRole('row', { name: /Bond A/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing only the 3 that differ.');
  });
});
