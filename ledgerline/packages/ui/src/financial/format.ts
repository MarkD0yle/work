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

/** A fraction as a percentage figure with no sign or symbol: "0.02" is "2". Full precision, for calculations and inputs. */
export function fractionToPercent(fraction: string): string {
  return new Decimal(fraction).mul(100).toString();
}

/** A percentage figure back to a fraction: "2" is "0.02". */
export function percentToFraction(percent: string): string {
  return new Decimal(percent).div(100).toString();
}

/** A fraction shown as a percentage: "0.02" reads "2.00%". */
export function formatPercent(fraction: string, decimals = 2): string {
  const value = new Decimal(fraction).mul(100);
  return `${value.isNegative() ? '-' : ''}${formatDecimal(value, decimals)}%`;
}

/**
 * Sum of financial values with decimal maths. Nulls are skipped. Amounts in different currencies are never
 * added together: the result is `mixed`. Null when there is nothing to add.
 */
export function sumFinancial(
  values: FinancialValue[],
): { kind: 'sum'; value: FinancialValue; count: number } | { kind: 'mixed' } | null {
  const present = values.filter((v) => v.value !== null);
  const first = present[0];
  if (!first) return null;
  if (new Set(present.map((v) => v.currency)).size > 1) return { kind: 'mixed' };
  const total = present.reduce((sum, v) => sum.plus(v.value as string), new Decimal(0));
  return { kind: 'sum', value: { ...first, value: total.toString() }, count: present.length };
}

/** A financial value as a spreadsheet cell: a plain decimal string and the number format that shows it as the grid does. */
export interface SpreadsheetFinancial {
  /** Plain decimal string, no grouping, "-" for negatives. Null for a blank cell. */
  value: string | null;
  /** Stable id for the format, e.g. "ll-xl-2-n-a". One of `SPREADSHEET_FORMATS`. */
  styleId: string;
}

const UNITS = { n: '', p: '%', bp: '"bp"' } as const;
const MAX_DECIMALS = 6;

/**
 * Every number format a financial cell can need: decimals 0 to 6, plain, percent or basis points,
 * natural or accounting sign. A fixed list, because a spreadsheet's formats are set before any row is known.
 * The currency is not in the format: the export names it in the header, or writes text when a column mixes currencies.
 */
export const SPREADSHEET_FORMATS: { id: string; format: string }[] = Array.from(
  { length: MAX_DECIMALS + 1 },
  (_, decimals) =>
    (Object.keys(UNITS) as (keyof typeof UNITS)[]).flatMap((unit) =>
      (['n', 'a'] as const).map((sign) => {
        const positive = `#,##0${decimals ? `.${'0'.repeat(decimals)}` : ''}${UNITS[unit]}`;
        return {
          id: `ll-xl-${decimals}-${unit}-${sign}`,
          format: sign === 'a' ? `${positive};(${positive})` : positive,
        };
      }),
    ),
).flat();

/**
 * Rounds to display precision with decimal maths, so the spreadsheet holds what the grid shows.
 * Percentages stay fractions under a percent format; basis points are scaled, because a spreadsheet cannot scale by 10,000.
 */
export function toSpreadsheetFinancial(fv: FinancialValue): SpreadsheetFinancial {
  const decimals = Math.min(MAX_DECIMALS, displayPrecision(fv.kind, fv.currency, fv.precision));
  const unit = fv.kind === 'percentage' ? 'p' : fv.kind === 'basisPoints' ? 'bp' : 'n';
  const styleId = `ll-xl-${decimals}-${unit}-${fv.signConvention === 'accounting' ? 'a' : 'n'}`;
  if (fv.value === null) return { value: null, styleId };
  const value = new Decimal(fv.value)
    .mul(unit === 'bp' ? 10_000 : 1)
    .toFixed(unit === 'p' ? decimals + 2 : decimals, Decimal.ROUND_HALF_UP);
  return { value, styleId };
}
