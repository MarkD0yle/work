import type { FinancialKind } from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import { DISPLAY_SCALE, registryPrecision, storagePrecision } from './registry';

export type ParseResult =
  | {
      ok: true;
      /** Canonical decimal string to store, e.g. "1500000.00". Null when the entry was empty. */
      value: string | null;
      /** True when shorthand (1.5m, 250k, 3bn) was expanded. The expanded value is shown before save. */
      expanded: boolean;
      /** True when the entry had more decimals than the registry allows and was rounded. */
      rounded: boolean;
    }
  | { ok: false; reason: string };

const MULTIPLIERS: Record<string, number> = { k: 1e3, m: 1e6, mm: 1e6, bn: 1e9, b: 1e9 };

/**
 * Parses what a user typed into a canonical decimal string.
 * Accepts thousands separators, accounting negatives "(1,234.50)", shorthand "1.5m" / "250k" / "3bn",
 * and for percentage and basis-point fields an optional "%" or "bp" suffix ("5" and "5%" both mean 5%).
 */
export function parseFinancialInput(input: string, kind: FinancialKind, currency?: string): ParseResult {
  let text = input.trim().toLowerCase().replaceAll(',', '').replaceAll(' ', '');
  if (text === '') return { ok: true, value: null, expanded: false, rounded: false };

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  const scale = DISPLAY_SCALE[kind];
  if (scale) {
    const suffix = scale.suffix.toLowerCase();
    const alternates = kind === 'basisPoints' ? ['bps', 'bp'] : [suffix];
    for (const s of alternates) {
      if (text.endsWith(s)) {
        text = text.slice(0, -s.length);
        break;
      }
    }
  }

  const match = /^(\d+\.?\d*|\.\d+)(k|mm|m|bn|b)?$/.exec(text);
  if (!match) return { ok: false, reason: 'Enter a number, for example 1,250,000.00 or 1.25m.' };
  const [, digits = '0', unit] = match;
  if (unit && scale)
    return { ok: false, reason: `Shorthand such as "${unit}" is not used for ${scale.suffix} values.` };

  let value = new Decimal(digits);
  if (unit) value = value.mul(MULTIPLIERS[unit] as number);
  if (negative) value = value.neg();
  if (scale) value = value.div(scale.factor);

  const decimals = storagePrecision(kind, currency);
  const stored = value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  return { ok: true, value: stored.toFixed(decimals), expanded: Boolean(unit), rounded: !stored.eq(value) };
}

/** Text to put back in an input for editing: display-scaled, no separators, trailing zeros kept to precision. */
export function toEditText(value: string | null, kind: FinancialKind, currency?: string): string {
  if (value === null) return '';
  const scale = DISPLAY_SCALE[kind];
  return new Decimal(value).mul(scale?.factor ?? 1).toFixed(registryPrecision(kind, currency));
}
