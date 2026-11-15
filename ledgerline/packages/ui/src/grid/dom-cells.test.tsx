import type { FinancialValue } from '@ledgerline/contracts';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../components/badge';
import { FinancialCell } from '../financial/financial-cell';
import { cellElement, financialCellElement } from './dom-cells';
import type { LLColumnDef } from './types';

const ada = { type: 'user', id: 'u-ada', name: 'Ada' } as const;
const base: FinancialValue = {
  kind: 'currencyAmount',
  value: '1250000.5',
  currency: 'USD',
  precision: 2,
  signConvention: 'natural',
  provenance: { origin: 'entered', source: 'Transaction entry', asOf: '2026-11-13T14:05:00Z' },
};

const CASES: [string, FinancialValue, string?][] = [
  ['entered', base],
  ['JPY', { ...base, currency: 'JPY', precision: 0 }],
  ['negative accounting', { ...base, value: '-4512.75', signConvention: 'accounting' }],
  ['calculated', { ...base, provenance: { origin: 'calculated', source: 'Quantity × price' } }],
  [
    'overridden',
    {
      ...base,
      provenance: {
        origin: 'overridden',
        overriddenBy: ada,
        overrideReason: 'Agreed.',
        originalValue: '1.00',
      },
    },
  ],
  ['locked', { ...base, locked: { reason: 'Period closed' } }],
  ['missing', { ...base, value: null, nullReason: 'missing' }],
  ['unavailable', { ...base, value: null, nullReason: 'unavailable' }],
  ['not applicable', { ...base, value: null, nullReason: 'notApplicable' }],
  ['zero', { ...base, value: '0' }],
  ['price with qualifier', { ...base, kind: 'price', precision: 6, value: '101.25' }, 'clean'],
  [
    'percentage',
    {
      kind: 'percentage',
      value: '0.05',
      precision: 2,
      signConvention: 'natural',
      provenance: { origin: 'entered' },
    },
  ],
];

/** What matters to users and assistive technology: tag, text, classes and attributes, child by child. */
function shape(node: Element): unknown {
  return {
    tag: node.tagName.toLowerCase(),
    classes: [...node.classList].sort(),
    attrs: Object.fromEntries(
      [...node.attributes]
        .filter((a) => !['class', 'style'].includes(a.name) && !a.name.startsWith('on'))
        .map((a) => [a.name, a.value])
        .sort(([a], [b]) => (a as string).localeCompare(b as string)),
    ),
    text: node.textContent,
    children: [...node.children]
      .filter(
        (c) =>
          c.tagName.toLowerCase() !== 'path' &&
          c.tagName.toLowerCase() !== 'rect' &&
          c.tagName.toLowerCase() !== 'line',
      )
      .map(shape),
  };
}

describe('grid DOM cells mirror the React components', () => {
  it.each(CASES)('financial cell: %s', (_name, value, qualifier) => {
    const { container } = render(
      <FinancialCell value={value} inGrid {...(qualifier ? { qualifier } : {})} />,
    );
    const react = container.querySelector('[data-slot="financial-cell"]') as Element;
    expect(shape(financialCellElement(value, qualifier))).toEqual(shape(react));
  });

  it('status badge', () => {
    const column: LLColumnDef<{ s: string }> = {
      field: 's',
      header: 'Status',
      type: 'status',
      value: (r) => r.s,
      statuses: { posted: { label: 'Posted', tone: 'good' } },
    };
    for (const [s, tone, label] of [
      ['posted', 'good', 'Posted'],
      ['other', 'neutral', 'other'],
    ] as const) {
      const { container, unmount } = render(<Badge status={tone}>{label}</Badge>);
      expect(shape(cellElement(column, { s }))).toEqual(shape(container.firstElementChild as Element));
      unmount();
    }
  });

  it('dates, entities and booleans', () => {
    const date: LLColumnDef<{ d: string | null }> = {
      field: 'd',
      header: 'Trade date',
      type: 'date',
      dateBasis: 'trade',
      value: (r) => ({ value: r.d, basis: 'trade' }),
    };
    expect(cellElement(date, { d: '2026-11-13' }).textContent).toBe('13 Nov 2026');
    const none = cellElement(date, { d: null });
    expect(none.textContent).toBe('—');
    expect(none.getAttribute('aria-label')).toBe('No date');

    const entity: LLColumnDef<{ id: string | null }> = {
      field: 'e',
      header: 'Security',
      type: 'entity',
      value: (r) => (r.id ? { kind: 'security', id: r.id, label: 'US TREASURY N/B' } : null),
    };
    expect(cellElement(entity, { id: 'S-1' }).textContent).toBe('US TREASURY N/BS-1');
    expect(cellElement(entity, { id: null }).getAttribute('aria-label')).toBe('None');

    const bool: LLColumnDef<{ b: boolean | null }> = {
      field: 'b',
      header: 'Held',
      type: 'boolean',
      value: (r) => r.b,
    };
    expect([true, false, null].map((b) => cellElement(bool, { b }).textContent)).toEqual(['Yes', 'No', '']);
  });
});
