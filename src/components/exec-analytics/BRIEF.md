# Execution Analytics — screen conventions

Foundation lives in `src/components/exec-analytics/` and is DONE. Screens are composed ONLY from it. If something is
missing, tell the orchestrator in your report; do not edit shared files.

## Files you may touch
Only your own screen file(s) `screens/<Name>.tsx` (default export, no props, replacing the placeholder) and an optional
subfolder `screens/<name>/` for helpers, mock data and sub-components. Never edit `ea.css`, `ui/`, `shell/`, `table/`,
`chart/`, `config/`, `lib/`, `data/mock.ts`, `registry.tsx`, or anything outside `exec-analytics/`.
(Extra CSS: put it in an inline `<style>` is NOT allowed; use inline `style` objects with tokens.)

## Imports (from your screen file)
- `../ui` : Button, IconButton, Tip, Popover/usePopover, Menu, Modal, ConfirmDialog, Drawer, Input, SearchInput, Select, Toggle, Checkbox, TabBar, Banner, Badge, Chip, ReadOnlyBadge, EmptyState, Skeleton, Direction, PageHeader
- `../shell` : ToolbarContext, useShell, useRefresh, DateRange, useDateRange, FilterButton, ExportMenu, RefreshButton, LastLoaded, FilterBar, activeFilterCount, useInitialLoad, usePreviewState
- `../table` : DataTable (+ Column type), heatStyle, percentileAbs
- `../chart` : Chart, ChartPanel, PanelGrid, chartColors, tipHtml
- `../lib/format` : formatNumber, formatFull, formatDate, formatTime ; `../lib/dates` : AS_OF, rangeFor ; `../lib/persist` : usePersisted
- `../data/mock` : rng, gauss, COUNTERPARTIES, cpName, cpIndex, INSTRUMENTS, buildSpreadCells, TRADES, EXCEPTION_RULES, REG_REPORTS, buildReportFiles
- `../ui/context` : useEa() -> { theme, colorBlindSafe }; `../tokens` : catColor(index, theme), CAT
- Icons: `lucide-react` only. size 20 (16 inside dense controls), `strokeWidth={1.5}`.
Read `ui/*.tsx`, `table/DataTable.tsx`, `chart/Chart.tsx`, `chart/ChartPanel.tsx`, `shell/*.tsx` for exact props before using.

## Page skeleton
```tsx
export default function X() {
  const loading = useInitialLoad(); const preview = usePreviewState();   // preview: none|loading|empty|error
  return (
    <>
      <ToolbarContext>{/* context-zone controls only: DateRange, FilterButton, ExportMenu, RefreshButton */}</ToolbarContext>
      <div className="ea-page"> <PageHeader .../> ... </div>
    </>);
}
```
- Fixed toolbar zone (star/user/help/bell/gear) is owned by the shell: never add icons there.
- Layout: dashboards use `PanelGrid` (panels are `ChartPanel`s sized S/M/L/XL = 4/6/8/12 cols). Form/list pages are max 1200px (shell does it).
- Every chart sits in a `ChartPanel` (drag, settings, expand always present) and renders via `Chart`. Give each a
  `summary` string and an `asTable` so "View as table" works. Charts in a ChartPanel use the render-prop form
  `{({expanded,height}) => <Chart height={height} .../>}` so Expand works.
- Honour `loading` (initial 500ms via useInitialLoad OR preview==="loading"), `empty` (real empty condition OR
  preview==="empty"), `error` (preview==="error") on every panel/table. Errors are inline banners with Retry, never toasts.
  Refresh keeps old data visible (`useRefresh`).
- Persist per-user choices (tab, filters, date range) with `usePersisted("<screen>.<thing>", default)` / `useDateRange`.
  Key prefixes `tab.`, `filter.`, `range.` are cleared by "Reset layout" (use `tab.<screen>`, `filter.<screen>`).

## Hard rules
1. **Zero border radius.** Never write `borderRadius` or rounded classes; tokens `--radius-*` are 0. Square corners everywhere.
2. **Tokens only** — `var(--color-*)`, `var(--data-*)`, `var(--status-*)`, `var(--space-*)`. No hard-coded hex in components.
   Charts get hex via `chartColors(theme)` from `useEa().theme`.
3. **Colour meaning (spec 2.2):** magnitude/single series = blue ramp `neutral` (`data-neutral-4` area, 40% fill);
   performance vs benchmark = `better`/`worse`; direction = `buy`/`sell` (blue/orange) — NEVER red/green for direction;
   categories = `cat[]`; `status-*` only for banners/badges/validation, never in charts.
   Every red/green encoding carries a second signal: explicit sign (+/−) in the label, an arrow glyph, or hatch pattern
   (heatmap cells: `hatch: true` in `cellStyle` for worse cells; it only shows when the colour-blind pref is on).
4. **Numbers:** ALWAYS `formatNumber(v, spec)` (`bps`, `bps-signed`, `count`, `ratio`, `percent`, `notional`, `empty`).
   Never `toFixed`, never template a raw number, including chart axis labels and tooltips (use `labels.formatter` /
   `valueFormat`). Right-align numeric columns (DataTable does this when `format` is set). True minus (−) only.
   Compact/clipped values get a tooltip (`title`) with `formatFull`.
5. **No branding.** No product/vendor names, real bank names, domains. Brand strings only from `config/brand.ts`.
   Counterparties are `Counterparty A…`. Users: `Automated Import`, `analyst@example.com`.
6. **Destructive/irreversible actions** always go through `ConfirmDialog` (names the object, states the consequence).
   `destructive` buttons only inside confirmations. One `primary` button per view. Sentence-case labels.
7. **Accessibility:** icon buttons use `IconButton` (aria-label + tooltip); tables get `label`; editable/heatmap tables
   `grid`; popovers/menus close on Esc (the shared ones do); every control keyboard reachable.
8. **No new date-range/table/chart-panel components.** Use the shared ones. Disabled controls get an explanatory tooltip.
9. The host app shows a floating "Home" pill top-left; the shell already clears it.

## Verification you must do before reporting
- `npx tsc -b` must pass with zero errors.
- `npx eslint <your files by path>` must pass (repo-wide lint has unrelated pre-existing errors; lint only your paths).
- Do NOT start or stop dev servers (one is already running on :5173). To check render without a browser:
  `npx vite-node`-style smoke is not set up, so instead be careful with types; the orchestrator will browser-test.
  You MAY use the Browser MCP tools only if you are told to; otherwise don't.

## Report format (short)
What you built (files), any shared-component gaps or workarounds, spec deviations with reasons, and anything the
orchestrator must wire. Do not paste code.
