import { themeQuartz } from 'ag-grid-community';

/**
 * The AG Grid theme, built only from Ledgerline tokens (CSS variables).
 * A token change, a theme switch or a density switch reaches every grid with no grid code involved.
 */
export const llGridTheme = themeQuartz.withParams({
  backgroundColor: 'var(--ll-surface)',
  foregroundColor: 'var(--ll-text)',
  borderColor: 'var(--ll-border)',
  accentColor: 'var(--ll-accent)',
  headerBackgroundColor: 'var(--ll-surface)',
  headerTextColor: 'var(--ll-text-muted)',
  headerFontWeight: 500,
  chromeBackgroundColor: 'var(--ll-surface-sunken)',
  oddRowBackgroundColor: 'var(--ll-surface)',
  rowHoverColor: 'var(--ll-surface-sunken)',
  selectedRowBackgroundColor: 'color-mix(in srgb, var(--ll-accent) 10%, transparent)',
  rangeSelectionBorderColor: 'var(--ll-focus)',
  focusShadow: '0 0 0 2px var(--ll-focus)',
  fontFamily: 'var(--ll-font-ui)',
  fontSize: 'var(--ll-font-size-body)',
  headerFontSize: 'var(--ll-font-size-11)',
  cellHorizontalPadding: 'var(--ll-padding-x)',
  wrapperBorderRadius: 'var(--ll-radius-4)',
  borderRadius: 'var(--ll-radius-2)',
  rowBorder: true,
  columnBorder: false,
  // Flat: no elevation inside the grid.
  cardShadow: 'none',
  popupShadow: '0 0 0 1px rgb(0 0 0 / 0.04), 0 8px 24px -4px rgb(0 0 0 / 0.14)',
});
