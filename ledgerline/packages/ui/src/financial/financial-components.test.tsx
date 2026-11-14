import type { FinancialValue } from '@ledgerline/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FinancialCell } from './financial-cell';
import { FinancialInput } from './financial-input';

const actor = { type: 'user', id: 'u-ada', name: 'Ada' } as const;
const usd = (over: Partial<FinancialValue> = {}): FinancialValue => ({
  kind: 'currencyAmount',
  value: '1250000.00',
  currency: 'USD',
  precision: 2,
  signConvention: 'natural',
  provenance: { origin: 'entered' },
  ...over,
});

describe('FinancialCell', () => {
  it('shows registry precision and the currency code', () => {
    render(<FinancialCell value={usd()} />);
    const cell = screen.getByRole('button');
    expect(cell).toHaveTextContent('1,250,000.00');
    expect(cell).toHaveTextContent('USD');
  });

  it('missing, unavailable, not applicable and zero render differently, each with a spoken label', () => {
    const { container } = render(
      <>
        <FinancialCell value={usd({ value: '0' })} />
        <FinancialCell value={usd({ value: null, nullReason: 'missing' })} />
        <FinancialCell value={usd({ value: null, nullReason: 'unavailable' })} />
        <FinancialCell value={usd({ value: null, nullReason: 'notApplicable' })} />
      </>,
    );
    const cells = [...container.querySelectorAll('[data-slot="financial-cell"]')];
    expect(cells.map((c) => c.querySelector('.truncate')?.textContent)).toEqual(['0.00', '—', 'n/a', '']);
    expect(cells.map((c) => c.getAttribute('data-display'))).toEqual([
      'value',
      'missing',
      'unavailable',
      'notApplicable',
    ]);
    expect(screen.getByRole('button', { name: /^Not applicable/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Unavailable/ })).toHaveAttribute(
      'title',
      expect.stringContaining('could not supply'),
    );
  });

  it('marks calculated, overridden and locked values in text, not only by icon', () => {
    render(
      <>
        <FinancialCell value={usd({ provenance: { origin: 'calculated' } })} />
        <FinancialCell value={usd({ provenance: { origin: 'overridden', originalValue: '1200000.00' } })} />
        <FinancialCell value={usd({ locked: { reason: 'Period closed' } })} />
      </>,
    );
    expect(screen.getByRole('button', { name: /calculated/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overridden/ })).toHaveAttribute(
      'title',
      expect.stringContaining('original 1200000.00'),
    );
    expect(screen.getByRole('button', { name: /locked/ })).toHaveAttribute(
      'title',
      expect.stringContaining('Period closed'),
    );
  });

  it('opens provenance with one keystroke', async () => {
    render(
      <FinancialCell
        value={usd({
          provenance: {
            origin: 'overridden',
            source: 'Primary vendor',
            asOf: '2026-11-13T22:00:00Z',
            overriddenBy: actor,
            overrideReason: 'Vendor price was stale',
            originalValue: '1200000.00',
          },
        })}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Provenance' });
    for (const text of [
      'Primary vendor',
      '2026-11-13 22:00 UTC',
      'Ada',
      'Vendor price was stale',
      '1,200,000.00 USD',
    ]) {
      expect(dialog).toHaveTextContent(text);
    }
  });

  it('shows original face beside current face', () => {
    const face = {
      kind: 'quantity',
      precision: 4,
      signConvention: 'natural',
      provenance: { origin: 'entered' },
    } as const;
    render(
      <FinancialCell
        value={{ ...face, value: '650000' }}
        originalFace={{ ...face, kind: 'originalFace', value: '1000000' }}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('650,000.0000');
    expect(screen.getByRole('button')).toHaveTextContent('of 1,000,000.0000 orig.');
  });

  it('is not a tab stop inside a grid', () => {
    render(<FinancialCell value={usd()} inGrid />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });
});

describe('FinancialInput', () => {
  it('1.5m in a USD amount commits "1500000.00" and shows the expanded value first', async () => {
    const onCommit = vi.fn();
    render(<FinancialInput label="Amount" value={usd({ value: null })} onCommit={onCommit} actor={actor} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '1.5m');
    await userEvent.tab();
    expect(input).toHaveValue('1500000.00');
    expect(screen.getByText('1,500,000.00 USD')).toBeInTheDocument();
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ value: '1500000.00', provenance: { origin: 'entered' } }),
    );
  });

  it('warns when it rounds, and still commits the rounded value', async () => {
    const onCommit = vi.fn();
    render(<FinancialInput label="Amount" value={usd({ value: null })} onCommit={onCommit} actor={actor} />);
    await userEvent.type(screen.getByLabelText('Amount'), '10.005');
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('Rounded to 2 decimals.');
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: '10.01' }));
  });

  it('rejects text that is not a number, assertively, and commits nothing', async () => {
    const onCommit = vi.fn();
    render(<FinancialInput label="Amount" value={usd()} onCommit={onCommit} actor={actor} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('This is not a number.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('an override cannot be applied without a reason', async () => {
    const onCommit = vi.fn();
    const calculated = usd({ provenance: { origin: 'calculated', source: 'accrual engine' } });
    render(<FinancialInput label="Accrued" value={calculated} onCommit={onCommit} actor={actor} />);
    const input = screen.getByLabelText('Accrued');
    await userEvent.clear(input);
    await userEvent.type(input, '1.3m');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Apply override' }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a reason. An override cannot be saved without one.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Reason for override (required)'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Apply override' }));
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Reason for override (required)'), 'Custodian confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Apply override' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
      value: '1300000.00',
      provenance: {
        origin: 'overridden',
        overriddenBy: actor,
        overrideReason: 'Custodian confirmed',
        originalValue: '1250000.00',
        source: 'accrual engine',
      },
    });
  });

  it('cancelling an override restores the calculated value', async () => {
    const onCommit = vi.fn();
    render(
      <FinancialInput
        label="Accrued"
        value={usd({ provenance: { origin: 'calculated' } })}
        onCommit={onCommit}
        actor={actor}
      />,
    );
    const input = screen.getByLabelText('Accrued');
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: 'Keep calculated value' }));
    expect(input).toHaveValue('1250000.00');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a second override keeps the first original value', async () => {
    const onCommit = vi.fn();
    const overridden = usd({
      value: '1300000.00',
      provenance: { origin: 'overridden', originalValue: '1250000.00' },
    });
    render(<FinancialInput label="Accrued" value={overridden} onCommit={onCommit} actor={actor} />);
    const input = screen.getByLabelText('Accrued');
    await userEvent.clear(input);
    await userEvent.type(input, '1.4m');
    await userEvent.tab();
    await userEvent.type(screen.getByLabelText('Reason for override (required)'), 'Second correction');
    await userEvent.click(screen.getByRole('button', { name: 'Apply override' }));
    expect(onCommit.mock.calls[0]?.[0].provenance.originalValue).toBe('1250000.00');
  });

  it('a locked value cannot be edited and gives its reason', async () => {
    const onCommit = vi.fn();
    render(
      <FinancialInput
        label="Amount"
        value={usd({ locked: { reason: 'Period 2026-10 is closed' } })}
        onCommit={onCommit}
        actor={actor}
      />,
    );
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('readonly');
    await userEvent.type(input, '9');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/Period 2026-10 is closed/)).toBeInTheDocument();
  });

  it('percentage accepts 5% and shows the unit', async () => {
    const onCommit = vi.fn();
    const pct = {
      kind: 'percentage',
      value: null,
      precision: 2,
      signConvention: 'natural',
      provenance: { origin: 'entered' },
    } as const;
    render(<FinancialInput label="Coupon" value={pct} onCommit={onCommit} actor={actor} />);
    await userEvent.type(screen.getByLabelText('Coupon'), '5%');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: '0.0500' }));
    expect(screen.getByLabelText('Coupon')).toHaveValue('5.00');
  });
});
