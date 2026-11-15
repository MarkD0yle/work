import type { FinancialValue } from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import { formatDecimal } from './format';

export type ToleranceLevel = 'within' | 'near' | 'breach';

export interface FormattedDelta {
  /** `none` when there is nothing to compare: one side has no value, or the reference is zero. */
  display: 'value' | 'none';
  /** The signed percentage difference, e.g. "+1.25%". "—" when there is no comparison. */
  text: string;
  level?: ToleranceLevel;
  /** The tolerance result in words, so it never relies on colour: "Within", "Near limit" or "Breach". */
  label?: string;
  /** What a screen reader hears. */
  ariaLabel: string;
  /** Full-precision percentage, for "Copy raw values". Empty when there is no comparison. */
  raw: string;
}

const LEVEL_LABEL: Record<ToleranceLevel, string> = {
  within: 'Within',
  near: 'Near limit',
  breach: 'Breach',
};
/** A difference counts as "near" from this share of the tolerance upwards. */
const NEAR_SHARE = '0.8';

/**
 * Compares a value with a reference (a vendor price, the prior day) as a percentage of the reference,
 * and marks it against a tolerance. Used by inline delta columns (SPEC 7.1).
 */
export function formatDelta(
  value: FinancialValue,
  reference: FinancialValue | undefined,
  tolerancePct: string,
  referenceLabel: string,
): FormattedDelta {
  if (
    value.value === null ||
    !reference ||
    reference.value === null ||
    new Decimal(reference.value).isZero()
  ) {
    const why = value.value === null ? 'no value' : `no ${referenceLabel} value`;
    return { display: 'none', text: '—', ariaLabel: `No comparison: ${why}`, raw: '' };
  }
  const ref = new Decimal(reference.value);
  const pct = new Decimal(value.value).minus(ref).div(ref.abs()).mul(100);
  const tolerance = new Decimal(tolerancePct);
  const size = pct.abs();
  const level: ToleranceLevel = size.gt(tolerance)
    ? 'breach'
    : size.gte(tolerance.mul(NEAR_SHARE))
      ? 'near'
      : 'within';
  const digits = formatDecimal(pct, 2);
  const zero = new Decimal(digits.replaceAll(',', '')).isZero();
  const sign = zero ? '' : pct.isNegative() ? '-' : '+';
  const direction = zero ? 'the same as' : `${digits}% ${pct.isNegative() ? 'below' : 'above'}`;
  return {
    display: 'value',
    text: `${sign}${digits}%`,
    level,
    label: LEVEL_LABEL[level],
    ariaLabel: `${direction} ${referenceLabel}, ${LEVEL_LABEL[level].toLowerCase()} against a ${tolerance.toString()}% tolerance`,
    raw: pct.toString(),
  };
}
