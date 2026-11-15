import type { FinancialValue } from '@ledgerline/contracts';
import { describe, expect, it } from 'vitest';
import { formatDelta } from './delta';

const price = (value: string | null): FinancialValue => ({
  kind: 'price',
  value,
  currency: 'USD',
  precision: 6,
  signConvention: 'natural',
  provenance: { origin: 'vendor' },
  ...(value === null ? { nullReason: 'unavailable' as const } : {}),
});

describe('formatDelta', () => {
  it('shows a signed percentage of the reference and marks it against the tolerance', () => {
    expect(formatDelta(price('101'), price('100'), '5', 'vendor')).toMatchObject({
      text: '+1.00%',
      level: 'within',
      label: 'Within',
    });
    expect(formatDelta(price('95.5'), price('100'), '5', 'vendor')).toMatchObject({
      text: '-4.50%',
      level: 'near',
      label: 'Near limit',
    });
    expect(formatDelta(price('106'), price('100'), '5', 'vendor')).toMatchObject({
      text: '+6.00%',
      level: 'breach',
      label: 'Breach',
    });
  });
  it('treats exactly the tolerance as near, not a breach', () => {
    expect(formatDelta(price('105'), price('100'), '5', 'vendor').level).toBe('near');
  });
  it('never shows a signed zero', () => {
    const same = formatDelta(price('100.0001'), price('100'), '5', 'vendor');
    expect(same.text).toBe('0.00%');
    expect(same.ariaLabel).toContain('the same as vendor');
  });
  it('says so when there is nothing to compare', () => {
    expect(formatDelta(price('100'), price(null), '5', 'vendor')).toMatchObject({
      display: 'none',
      text: '—',
      ariaLabel: 'No comparison: no vendor value',
    });
    expect(formatDelta(price('100'), undefined, '5', 'vendor').display).toBe('none');
    expect(formatDelta(price('100'), price('0'), '5', 'vendor').display).toBe('none');
  });
  it('keeps full precision for raw copy and reads well aloud', () => {
    const d = formatDelta(price('100.123456'), price('100'), '5', 'vendor');
    expect(d.raw).toBe('0.123456');
    expect(d.ariaLabel).toBe('0.12% above vendor, within against a 5% tolerance');
  });
});
