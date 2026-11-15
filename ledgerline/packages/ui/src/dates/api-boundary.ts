const LEGACY_PLACEHOLDERS = new Set(['1900-01-01', '9999-12-31', '0001-01-01']);

/**
 * Legacy "no date" placeholders become null where API data enters the UI.
 * The API already converts them; this guards any source that does not, so a placeholder is never shown as a date.
 */
export function normaliseApiDate(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const date = value.slice(0, 10);
  return LEGACY_PLACEHOLDERS.has(date) ? null : date;
}
