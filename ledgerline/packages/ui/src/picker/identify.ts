/** What kind of identifier a piece of text looks like, if any (SPEC 7.3: identifier detection). */
export type IdentifierKind = 'isin' | 'cusip' | 'sedol' | 'internalId';

const PATTERNS: [IdentifierKind, RegExp][] = [
  ['isin', /^[A-Z]{2}[A-Z0-9]{9}\d$/],
  // Internal ids look like S-0000123 or P-0007.
  ['internalId', /^[A-Z]{1,3}-\d{2,}$/],
  ['cusip', /^(?=.*\d)[A-Z0-9]{8}\d$/],
  ['sedol', /^(?=.*\d)[0-9BCDFGHJKLMNPQRSTVWXYZ]{6}\d$/],
];

export function detectIdentifier(text: string): IdentifierKind | null {
  const value = text.trim().toUpperCase();
  return PATTERNS.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}

/** Search starts after 2 characters, or straight away for anything that looks like an identifier. */
export const shouldSearch = (text: string): boolean =>
  text.trim().length >= 2 || detectIdentifier(text) !== null;
