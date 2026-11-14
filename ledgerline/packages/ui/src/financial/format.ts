import type { FinancialValue } from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import { CURRENCY_KINDS, DISPLAY_SCALE, displayPrecision } from './registry';

export interface FormattedFinancial {
  /** What the cell shows, e.g. "1,250,000.00", "(4,512.75)", "5.00%", "—", "n/a" or "". */
  text: string;
  /** Currency code to show beside the number, for currency kinds. */
  currency?: string;
  /** What a screen reader hears. Always present, including for blank cells. */
  ariaLabel: string;
  /** Explanation to show on hover or focus when the text alone is not enough. */
  tooltip?: string;
  negative: boolean;
  /** Which of the four displays this is. Zero and the three null reasons never look the same. */
  display: 'value' | 'missing' | 'unavailable' | 'notApplicable';
}

const NULL_DISPLAY = {
  missing: { text: '—', ariaLabel: 'Missing', tooltip: 'No value has been provided.' },
  unavailable: { text: 'n/a', ariaLabel: 'Unavailable', tooltip: 'The source could not supply this value.' },
  notApplicable: { text: '', ariaLabel: 'Not applicable' },
} as const;

function group(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Fixed-decimal string with thousands separators. Rounds half away from zero, as accountants expect. */
export function formatDecimal(value: Decimal, decimals: number): string {
  const fixed = value.abs().toFixed(decimals, Decimal.ROUND_HALF_UP);
  const [integer = '0', fraction] = fixed.split('.');
  return fraction ? `${group(integer)}.${fraction}` : group(integer);
}

export function formatFinancial(fv: FinancialValue): FormattedFinancial {
  if (fv.value === null) {
    const reason = fv.nullReason ?? 'missing';
    return { ...NULL_DISPLAY[reason], negative: false, display: reason };
  }
  const decimals = displayPrecision(fv.kind, fv.currency, fv.precision);
  const scale = DISPLAY_SCALE[fv.kind];
  const scaled = new Decimal(fv.value).mul(scale?.factor ?? 1);
  const digits = formatDecimal(scaled, decimals);
  // A value that rounds to zero is shown as plain zero, never "-0.00" or "(0.00)".
  const negative = scaled.isNegative() && !new Decimal(digits.replaceAll(',', '')).isZero();
  const suffix = scale?.suffix ?? '';
  const body = `${digits}${suffix}`;
  const text = negative ? (fv.signConvention === 'accounting' ? `(${body})` : `-${body}`) : body;
  const currency = CURRENCY_KINDS.has(fv.kind) ? fv.currency : undefined;
  const spoken = `${negative ? 'minus ' : ''}${body}${currency ? ` ${currency}` : ''}`;
  return { text, ariaLabel: spoken, negative, display: 'value', ...(currency ? { currency } : {}) };
}

/** The stored decimal string, untouched. Used by "Copy raw values". */
export function rawFinancial(fv: FinancialValue): string {
  return fv.value ?? '';
}
