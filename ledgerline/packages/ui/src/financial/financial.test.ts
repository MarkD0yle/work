import type { FinancialKind, FinancialValue } from '@ledgerline/contracts';
import { describe, expect, it } from 'vitest';
import { formatFinancial, rawFinancial } from './format';
import { parseFinancialInput, toEditText } from './parse';
import { displayPrecision, registryPrecision, storagePrecision } from './registry';

const fv = (over: Partial<FinancialValue> & Pick<FinancialValue, 'kind' | 'value'>): FinancialValue => ({
  precision: registryPrecision(over.kind, over.currency),
  signConvention: 'natural',
  provenance: { origin: 'entered' },
  ...over,
});

const KINDS: FinancialKind[] = [
  'amount',
  'currencyAmount',
  'units',
  'quantity',
  'originalFace',
  'price',
  'marketValue',
  'rate',
  'percentage',
  'basisPoints',
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];
const decimalsShown = (text: string) => (text.replace(/[()%\-bp]/g, '').split('.')[1] ?? '').length;

describe('precision registry', () => {
  it('follows SPEC 7.5', () => {
    expect(registryPrecision('amount', 'USD')).toBe(2);
    expect(registryPrecision('currencyAmount', 'JPY')).toBe(0);
    expect(registryPrecision('marketValue', 'EUR')).toBe(2);
    expect(['units', 'quantity', 'originalFace'].map((k) => registryPrecision(k as FinancialKind))).toEqual([
      4, 4, 4,
    ]);
    expect(registryPrecision('price')).toBe(6);
    expect(registryPrecision('rate')).toBe(6);
    expect(registryPrecision('percentage')).toBe(2);
    expect(registryPrecision('basisPoints')).toBe(2);
  });

  it('lets a journey tighten precision but never loosen it', () => {
    expect(displayPrecision('price', undefined, 4)).toBe(4);
    expect(displayPrecision('price', undefined, 9)).toBe(6);
    expect(displayPrecision('amount', 'JPY', 2)).toBe(0);
  });

  it('stores fractions with enough digits to round-trip the display', () => {
    expect(storagePrecision('percentage')).toBe(4);
    expect(storagePrecision('basisPoints')).toBe(6);
    expect(storagePrecision('amount', 'USD')).toBe(2);
  });
});

describe('formatFinancial', () => {
  it.each(KINDS.flatMap((kind) => CURRENCIES.map((currency) => [kind, currency] as const)))(
    '%s in %s never shows more or fewer decimals than the registry',
    (kind, currency) => {
      for (const value of ['0', '1', '-1234567.891234567', '0.000000049', '999999.9999999']) {
        const out = formatFinancial(fv({ kind, currency, value }));
        expect(decimalsShown(out.text), `${value} -> ${out.text}`).toBe(registryPrecision(kind, currency));
      }
    },
  );

  it('groups thousands and shows the currency code for currency kinds only', () => {
    expect(formatFinancial(fv({ kind: 'currencyAmount', currency: 'USD', value: '1250000' }))).toMatchObject({
      text: '1,250,000.00',
      currency: 'USD',
    });
    expect(formatFinancial(fv({ kind: 'price', currency: 'USD', value: '101.25' })).currency).toBeUndefined();
  });

  it('JPY amounts never show decimals', () => {
    expect(formatFinancial(fv({ kind: 'currencyAmount', currency: 'JPY', value: '1250000.49' })).text).toBe(
      '1,250,000',
    );
    expect(formatFinancial(fv({ kind: 'marketValue', currency: 'JPY', value: '0' })).text).toBe('0');
  });

  it('applies the sign convention of the value', () => {
    const base = { kind: 'currencyAmount', currency: 'USD', value: '-4512.75' } as const;
    expect(formatFinancial(fv({ ...base, signConvention: 'natural' })).text).toBe('-4,512.75');
    expect(formatFinancial(fv({ ...base, signConvention: 'accounting' })).text).toBe('(4,512.75)');
    expect(formatFinancial(fv(base)).ariaLabel).toBe('minus 4,512.75 USD');
  });

  it('never shows negative zero', () => {
    const out = formatFinancial(
      fv({ kind: 'currencyAmount', currency: 'USD', value: '-0.001', signConvention: 'accounting' }),
    );
    expect(out).toMatchObject({ text: '0.00', negative: false });
  });

  it('shows fractions as percentages and basis points', () => {
    expect(formatFinancial(fv({ kind: 'percentage', value: '0.05' })).text).toBe('5.00%');
    expect(formatFinancial(fv({ kind: 'basisPoints', value: '0.0025' })).text).toBe('25.00bp');
    expect(formatFinancial(fv({ kind: 'percentage', value: '-0.1234' })).text).toBe('-12.34%');
  });

  it('rounds half away from zero', () => {
    expect(formatFinancial(fv({ kind: 'currencyAmount', currency: 'USD', value: '2.675' })).text).toBe(
      '2.68',
    );
    expect(formatFinancial(fv({ kind: 'currencyAmount', currency: 'USD', value: '-2.675' })).text).toBe(
      '-2.68',
    );
  });

  it('missing, unavailable, not applicable and zero all render differently', () => {
    const zero = formatFinancial(fv({ kind: 'currencyAmount', currency: 'USD', value: '0' }));
    const missing = formatFinancial(
      fv({ kind: 'currencyAmount', currency: 'USD', value: null, nullReason: 'missing' }),
    );
    const unavailable = formatFinancial(
      fv({ kind: 'currencyAmount', currency: 'USD', value: null, nullReason: 'unavailable' }),
    );
    const notApplicable = formatFinancial(
      fv({ kind: 'currencyAmount', currency: 'USD', value: null, nullReason: 'notApplicable' }),
    );
    expect([zero.text, missing.text, unavailable.text, notApplicable.text]).toEqual(['0.00', '—', 'n/a', '']);
    expect(new Set([zero, missing, unavailable, notApplicable].map((f) => f.ariaLabel)).size).toBe(4);
    expect(unavailable.tooltip).toBeTruthy();
    expect(notApplicable.ariaLabel).toBe('Not applicable');
    // Null with no reason is treated as missing, never as zero.
    expect(formatFinancial(fv({ kind: 'price', value: null })).display).toBe('missing');
  });

  it('keeps full precision for raw copy', () => {
    expect(rawFinancial(fv({ kind: 'currencyAmount', currency: 'USD', value: '1250000.4567' }))).toBe(
      '1250000.4567',
    );
    expect(rawFinancial(fv({ kind: 'price', value: null }))).toBe('');
  });

  it('handles values far beyond float range without losing digits', () => {
    expect(
      formatFinancial(fv({ kind: 'currencyAmount', currency: 'USD', value: '9007199254740993.07' })).text,
    ).toBe('9,007,199,254,740,993.07');
  });
});

describe('parseFinancialInput', () => {
  const parse = (text: string, kind: FinancialKind = 'currencyAmount', currency = 'USD') =>
    parseFinancialInput(text, kind, currency);

  it('1.5m in a USD amount saves as "1500000.00"', () => {
    expect(parse('1.5m')).toEqual({ ok: true, value: '1500000.00', expanded: true, rounded: false });
  });

  it.each([
    ['250k', '250000.00'],
    ['3bn', '3000000000.00'],
    ['2mm', '2000000.00'],
    ['1,250,000.5', '1250000.50'],
    ['(4,512.75)', '-4512.75'],
    ['-12', '-12.00'],
    ['.5', '0.50'],
    [' 1 000 ', '1000.00'],
  ])('%s -> %s', (text, value) => {
    expect(parse(text)).toMatchObject({ ok: true, value });
  });

  it('rounds extra decimals and says so, so the UI can warn', () => {
    expect(parse('10.005')).toEqual({ ok: true, value: '10.01', expanded: false, rounded: true });
    expect(parse('1250000.4', 'currencyAmount', 'JPY')).toMatchObject({ value: '1250000', rounded: true });
    expect(parse('10.50')).toMatchObject({ rounded: false });
  });

  it('percentage accepts 5 or 5% and stores a fraction', () => {
    expect(parse('5', 'percentage')).toMatchObject({ value: '0.0500' });
    expect(parse('5%', 'percentage')).toMatchObject({ value: '0.0500' });
    expect(parse('12.345%', 'percentage')).toMatchObject({ value: '0.1235', rounded: true });
  });

  it('basis points accept 25 or 25bp and store a fraction', () => {
    expect(parse('25', 'basisPoints')).toMatchObject({ value: '0.002500' });
    expect(parse('25bp', 'basisPoints')).toMatchObject({ value: '0.002500' });
    expect(parse('25bps', 'basisPoints')).toMatchObject({ value: '0.002500' });
  });

  it('keeps registry precision for units, price and rate', () => {
    expect(parse('1000', 'quantity')).toMatchObject({ value: '1000.0000' });
    expect(parse('101.25', 'price')).toMatchObject({ value: '101.250000' });
    expect(parse('0.0425', 'rate')).toMatchObject({ value: '0.042500' });
  });

  it('empty input is null, not zero', () => {
    expect(parse('   ')).toEqual({ ok: true, value: null, expanded: false, rounded: false });
    expect(parse('0')).toMatchObject({ value: '0.00' });
  });

  it.each(['abc', '1.2.3', '5x', '--5', '1e6', '5m%'])('rejects %s with a reason', (text) => {
    const result = parse(text, text.includes('%') ? 'percentage' : 'currencyAmount');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  });

  it('round-trips through the edit text', () => {
    expect(toEditText('0.0500', 'percentage')).toBe('5.00');
    expect(toEditText('1500000.00', 'currencyAmount', 'USD')).toBe('1500000.00');
    expect(toEditText(null, 'price')).toBe('');
    for (const [kind, stored] of [
      ['percentage', '0.0525'],
      ['basisPoints', '0.002550'],
      ['price', '101.250000'],
    ] as const) {
      expect(parseFinancialInput(toEditText(stored, kind), kind)).toMatchObject({ value: stored });
    }
  });
});
