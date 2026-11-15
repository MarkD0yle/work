import type { Comparison, FinancialValue } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ComparisonTable } from './comparison';

const meta: Meta = { title: 'Comparison/ComparisonTable' };
export default meta;

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
const books: Comparison = {
  leftLabel: 'Investment book',
  rightLabel: 'Accounting book',
  tolerancePct: '0.5',
  rows: [
    {
      key: 'a',
      label: 'US TREASURY 2.500% 2031-05-15 (S-0000101)',
      left: mv('1000000.00', 'Investment book'),
      right: mv('1000000.00', 'Accounting book'),
      leftUnits: units('1000'),
      rightUnits: units('1000'),
    },
    {
      key: 'b',
      label: 'BUNDESREPUB. DEUTSCHLAND 5.250% 2033 (S-0000036)',
      left: mv('1000000.00', 'Investment book'),
      right: mv('1004500.00', 'Accounting book'),
      leftUnits: units('1000'),
      rightUnits: units('1000'),
    },
    {
      key: 'c',
      label: 'ACME CORP 4.000% 2029 (S-0000412)',
      left: mv('1000000.00', 'Investment book'),
      right: mv('1020000.00', 'Accounting book'),
      leftUnits: units('1000'),
      rightUnits: units('1010'),
    },
    {
      key: 'd',
      label: 'NEW ISSUE, not yet booked (S-0000999)',
      left: mv('0.00', 'Investment book'),
      right: mv(null, 'Accounting book', 'missing'),
    },
    {
      key: 'e',
      label: 'DELISTED ORD (S-0000777)',
      left: mv('500.00', 'Investment book'),
      right: mv(null, 'Accounting book', 'unavailable'),
    },
  ],
};

export const InvestmentVsAccountingBook: StoryObj = { render: () => <ComparisonTable comparison={books} /> };
export const LeadWithPercent: StoryObj = {
  render: () => <ComparisonTable comparison={books} defaultMode="percent" />,
};
export const OnlyDifferences: StoryObj = {
  render: () => <ComparisonTable comparison={books} onlyDifferences />,
};
export const AllAgree: StoryObj = {
  render: () => <ComparisonTable comparison={{ ...books, rows: books.rows.slice(0, 1) }} onlyDifferences />,
};
export const Empty: StoryObj = { render: () => <ComparisonTable comparison={{ ...books, rows: [] }} /> };
