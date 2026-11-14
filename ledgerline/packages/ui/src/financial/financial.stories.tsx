import type { FinancialKind, FinancialValue } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FinancialCell } from './financial-cell';
import { FinancialInput } from './financial-input';
import { registryPrecision } from './registry';

const meta: Meta = { title: 'Financial/Fields and cells' };
export default meta;
type Story = StoryObj;

const ada = { type: 'user', id: 'u-ada', name: 'Ada' } as const;
const fv = (
  kind: FinancialKind,
  value: string | null,
  over: Partial<FinancialValue> = {},
): FinancialValue => ({
  kind,
  value,
  precision: registryPrecision(kind, over.currency),
  signConvention: 'natural',
  provenance: { origin: 'entered', source: 'Transaction entry', asOf: '2026-11-13T14:05:00Z' },
  ...over,
});

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex h-(--ll-row-height) items-center gap-4 border-b px-(--ll-padding-x) last:border-b-0">
    <span className="w-56 shrink-0 text-muted-foreground">{label}</span>
    <div className="w-64">{children}</div>
  </div>
);

export const EveryKind: Story = {
  render: () => (
    <div className="w-fit rounded-md border bg-card">
      <Row label="currencyAmount, USD">
        <FinancialCell value={fv('currencyAmount', '1250000', { currency: 'USD' })} />
      </Row>
      <Row label="currencyAmount, JPY">
        <FinancialCell value={fv('currencyAmount', '187500000', { currency: 'JPY' })} />
      </Row>
      <Row label="marketValue, EUR, accounting">
        <FinancialCell
          value={fv('marketValue', '-4512.75', { currency: 'EUR', signConvention: 'accounting' })}
        />
      </Row>
      <Row label="quantity with original face">
        <FinancialCell value={fv('quantity', '650000')} originalFace={fv('originalFace', '1000000')} />
      </Row>
      <Row label="price, clean">
        <FinancialCell value={fv('price', '101.25')} qualifier="clean" />
      </Row>
      <Row label="rate, ACT/360">
        <FinancialCell value={fv('rate', '0.0425')} qualifier="ACT/360" />
      </Row>
      <Row label="percentage">
        <FinancialCell value={fv('percentage', '0.05')} />
      </Row>
      <Row label="basisPoints">
        <FinancialCell value={fv('basisPoints', '0.0025')} />
      </Row>
    </div>
  ),
};

/** Zero, missing, unavailable and not applicable are four different displays (SPEC 7.5 acceptance). */
export const NullReasons: Story = {
  render: () => (
    <div className="w-fit rounded-md border bg-card">
      <Row label="Zero">
        <FinancialCell value={fv('currencyAmount', '0', { currency: 'USD' })} />
      </Row>
      <Row label="Missing">
        <FinancialCell value={fv('currencyAmount', null, { currency: 'USD', nullReason: 'missing' })} />
      </Row>
      <Row label="Unavailable">
        <FinancialCell value={fv('currencyAmount', null, { currency: 'USD', nullReason: 'unavailable' })} />
      </Row>
      <Row label="Not applicable">
        <FinancialCell value={fv('currencyAmount', null, { currency: 'USD', nullReason: 'notApplicable' })} />
      </Row>
    </div>
  ),
};

export const Provenance: Story = {
  render: () => (
    <div className="w-fit rounded-md border bg-card">
      <Row label="Calculated">
        <FinancialCell
          value={fv('currencyAmount', '1250000', {
            currency: 'USD',
            provenance: { origin: 'calculated', source: 'Quantity × price' },
          })}
        />
      </Row>
      <Row label="Overridden">
        <FinancialCell
          value={fv('currencyAmount', '1249375', {
            currency: 'USD',
            provenance: {
              origin: 'overridden',
              overriddenBy: ada,
              overrideReason: 'Agreed net amount with counterparty.',
              originalValue: '1250000.00',
              asOf: '2026-11-13T17:30:00Z',
            },
          })}
        />
      </Row>
      <Row label="Locked">
        <FinancialCell
          value={fv('currencyAmount', '1250000', {
            currency: 'USD',
            locked: { reason: 'Posted. Reverse it to make a change.' },
          })}
        />
      </Row>
      <Row label="Vendor">
        <FinancialCell
          value={fv('price', '101.25', {
            provenance: { origin: 'vendor', source: 'Primary vendor', asOf: '2026-11-13T22:00:00Z' },
          })}
        />
      </Row>
    </div>
  ),
};

function InputDemo({
  label,
  initial,
  qualifier,
}: {
  label: string;
  initial: FinancialValue;
  qualifier?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-1">
      <FinancialInput
        label={label}
        value={value}
        onCommit={setValue}
        actor={ada}
        {...(qualifier ? { qualifier } : {})}
      />
      <p className="font-mono text-2xs text-muted-foreground">
        stored: {value.value ?? 'null'} · {value.provenance.origin}
      </p>
    </div>
  );
}

/** Try `1.5m`, `250k`, `10.005`, `abc`. Editing the calculated value asks for an override reason. */
export const Inputs: Story = {
  render: () => (
    <div className="grid w-[40rem] grid-cols-2 gap-6">
      <InputDemo label="Amount" initial={fv('currencyAmount', null, { currency: 'USD' })} />
      <InputDemo label="Amount" initial={fv('currencyAmount', null, { currency: 'JPY' })} />
      <InputDemo label="Price" qualifier="clean" initial={fv('price', '101.25')} />
      <InputDemo label="Coupon" initial={fv('percentage', '0.05')} />
      <InputDemo label="Spread" initial={fv('basisPoints', '0.0025')} />
      <InputDemo
        label="Accrued interest"
        initial={fv('currencyAmount', '18750.00', {
          currency: 'USD',
          provenance: { origin: 'calculated', source: 'Accrual engine' },
        })}
      />
      <InputDemo
        label="Book value"
        initial={fv('currencyAmount', '1250000.00', {
          currency: 'USD',
          locked: { reason: 'Period 2026-10 is closed.' },
        })}
      />
    </div>
  ),
};
