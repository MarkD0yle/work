/**
 * Precision registry (SPEC 7.5). The single place that decides how many decimals a financial value shows.
 * Cells and inputs never choose their own precision.
 */
import type { FinancialKind } from '@ledgerline/contracts';

/** ISO 4217 minor units for currencies that are not 2. Anything not listed is 2. */
const MINOR_UNITS: Record<string, number> = {
  BHD: 3,
  CLP: 0,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  OMR: 3,
  TND: 3,
  VND: 0,
};

export const minorUnits = (currency: string | undefined): number =>
  currency ? (MINOR_UNITS[currency] ?? 2) : 2;

/** Kinds whose decimals follow the currency and which always show the currency code. */
export const CURRENCY_KINDS: ReadonlySet<FinancialKind> = new Set([
  'amount',
  'currencyAmount',
  'marketValue',
]);

const FIXED: Record<Exclude<FinancialKind, 'amount' | 'currencyAmount' | 'marketValue'>, number> = {
  units: 4,
  quantity: 4,
  originalFace: 4,
  price: 6,
  rate: 6,
  percentage: 2,
  basisPoints: 2,
};

/** Default display decimals for a kind. */
export function registryPrecision(kind: FinancialKind, currency?: string): number {
  return kind === 'amount' || kind === 'currencyAmount' || kind === 'marketValue'
    ? minorUnits(currency)
    : FIXED[kind];
}

/**
 * Decimals to display. A journey may tighten precision (fewer decimals) but never loosen it,
 * so a requested precision above the registry default is ignored.
 */
export function displayPrecision(kind: FinancialKind, currency?: string, requested?: number): number {
  const base = registryPrecision(kind, currency);
  return requested === undefined ? base : Math.max(0, Math.min(base, Math.trunc(requested)));
}

/**
 * How stored fractions are scaled for display and entry.
 * Percentages and basis points are stored as fractions: 5% is "0.05", 25bp is "0.0025".
 */
export const DISPLAY_SCALE: Partial<Record<FinancialKind, { factor: number; suffix: string }>> = {
  percentage: { factor: 100, suffix: '%' },
  basisPoints: { factor: 10_000, suffix: 'bp' },
};

/** Decimals kept in the stored string: display decimals plus the digits consumed by the display scale. */
export function storagePrecision(kind: FinancialKind, currency?: string): number {
  const scale = DISPLAY_SCALE[kind];
  return registryPrecision(kind, currency) + (scale ? Math.log10(scale.factor) : 0);
}
