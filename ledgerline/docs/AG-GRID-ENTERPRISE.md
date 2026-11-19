# AG Grid Enterprise in Ledgerline

How each AG Grid Enterprise (v36) feature is handled. Every grid goes through `LLGrid` (`packages/ui/src/grid`). Apps never touch AG Grid, so a feature reaches users only if the wrapper adopts it and keeps Ledgerline's non-negotiable rules (CLAUDE.md).

There are three outcomes:

- **Adopted:** the module is registered in `modules.ts`, and `LLGrid` routes it through Ledgerline's rules.
- **Built with Ledgerline's own tools:** the need is real, but the Enterprise module would break a rule, so Ledgerline meets it another way.
- **Not adopted:** it breaks a rule, or no screen needs it yet. The table says what would change that.

Modules are listed one by one. `AllEnterpriseModule` is never registered.

## Adopted

| Feature | Module(s) | How it is routed through Ledgerline rules | Where to see it |
| --- | --- | --- | --- |
| Server-side row model | `ServerSideRowModelModule`, `ServerSideRowModelApiModule` | Same `GridQuery` contract as the Community infinite model | Every server grid |
| Row grouping (server) | `RowGroupingModule` | The server groups and returns group counts; group rows use the same words as cells | Group menu |
| Drag-to-group panel | `RowGroupingPanelModule` | Shown only while rows are grouped (`onlyWhenGrouping`), only on server grids with `groupable` columns. Grouping still goes into saved views | Transactions → Group |
| Cell range selection | `CellSelectionModule` | One range at a time. The status bar shows its cell count and a **decimal** sum per financial column, and never adds different currencies. Copy takes exactly the range, through `buildClipboard`, so restricted columns are still never copied. Escape clears it. Very large ranges are summed only up to 20,000 loaded rows, and the status bar says so | Drag across Amount |
| Column menu | `ColumnMenuModule` | An explicit item list: sort, pin, autosize, group (groupable columns only), column chooser, reset. No copy, paste, filter, chart or aggregation items | Header ⋮ |
| Columns tool panel | `SideBarModule`, `ColumnsToolPanelModule` | Hidden until opened from Columns → Column panel. Pivot mode, values and pivots are turned off. Row groups appear only where the server can group | Columns menu |
| Excel export | `ExcelExportModule` | A registry action (`grid.exportExcel`), so it appears in the toolbar and the command palette. Financial values are exported **at display precision with decimal rounding**, using a number format per value (JPY 0 decimals, USD 2; accounting parentheses; % kept as a fraction; bp scaled). A single-currency column names its currency in the header. A mixed-currency column is written as text with each value's currency. Dates go out as ISO. Restricted columns are never exported, and the user is told which. Server grids export the selected rows; a disabled button explains why and points to jobs for "every match" | Export to Excel |
| Row numbers | `RowNumbersModule` | Off by default; switched on from the Columns menu | Columns → Row numbers |
| Find | `FindModule` | Client grids only: highlights matches without filtering rows out. Enter goes to the next match, Shift+Enter to the previous. The match count is announced. Quick search stays the way to filter | Close Console; Grid/LLGrid/Enterprise story |
| Master/detail | `MasterDetailModule` | The `detail` prop takes a React render function. It has an expand column, and Alt+Down / Alt+Up from the keyboard (AG Grid is told not to move focus on those keys) | Exception Queue; Grid/LLGrid/Enterprise Master Detail story |

## Built with Ledgerline's own tools

| Enterprise feature | Why the module is not used | What Ledgerline does instead |
| --- | --- | --- |
| Context menu (`ContextMenuModule`) | It would be a second action surface beside the registry (rule 12) | A Radix context menu built from `ActionDef[]`; Shift+F10 opens it from the keyboard |
| Clipboard (`ClipboardModule`) | AG Grid's copy would include restricted columns and stored precision | `buildClipboard`: display precision, "Copy raw values" as a separate command, restricted columns blocked with a reason, ranges supported |
| Status bar (`StatusBarModule`) | Its aggregation panel adds JS numbers | Ledgerline's status bar: row count, decimal sums of selected rows and of a cell range, refreshed-at time |
| Sticky group rows, loading cell renderer | Internal modules | Brought in by the adopted modules |

## Not adopted

| Feature | Module(s) | Rule it would break | What would change this |
| --- | --- | --- | --- |
| Set filter, multi filter, advanced filter, filters tool panel | `SetFilterModule`, `MultiFilterModule`, `AdvancedFilterModule`, `FiltersToolPanelModule`, `NewFiltersToolPanelModule`, `GroupFilterModule` | Rule 4 (no hidden filters): a grid-owned filter would not show as a tag or be saved in the view. The server filters through `GridQuery` | Map the AG filter model to and from `FilterCondition`, so every condition shows as a tag. The set filter would also need a `/values` endpoint |
| Aggregation, pivot, "show values as" | `AggregationModule`, `PivotModule`, `ShowValuesAsModule` | Rule 1: AG Grid aggregates JS numbers. Server grids can only pivot on the server | Custom decimal `aggFuncs` with currency checks, for client grids first |
| Integrated charts, sparklines | `IntegratedChartsModule`, `SparklinesModule` | Rule 1 (charting converts money to floats) and rule 11 (charts would need text alternatives) | A display-only chart over rounded values, with a table alternative |
| Formulas, calculated columns | `FormulaModule`, `CalculatedColumnsModule` | Rule 1, and a calculated value would have no provenance | The engine supplies derived values with provenance |
| Batch edit, grouped edit, rich select, header edit, notes | `BatchEditModule`, `RowGroupingEditModule`, `RichSelectModule`, `ColumnHeaderEditModule`, `NotesModule` | No grid edits in place yet; Ledgerline's Batch Grid covers governed entry, with a dirty marker and validation per cell | Inline editing (SPEC 7.1, "Inline edits show a dirty marker") |
| Tree data, viewport row model | `TreeDataModule`, `ViewportRowModelModule` | No hierarchical or streaming data yet | Portfolio hierarchies; live prices |
| PDF export | `PdfExportModule` | The close package is built on the server as a job (SPEC 8.3) | A user asks for a PDF of a grid view |
| Toolbar, AI toolkit | `ToolbarModule`, `AiToolkitModule` | Ledgerline has its own toolbar. An AI toolkit must go through the action registry with confirmation (SPEC §14) | The assistant phase |

## Community fallback

With `VITE_AG_GRID_ENTERPRISE=false`, none of the above is registered and `LLGrid` hides every Enterprise control. The grid journeys run on both (`e2e`, `e2e-community`). The Enterprise-only journeys are in `e2e/enterprise.e2e.ts`.

## Licence

Ledgerline is a design concept and runs without a key, so AG Grid shows its watermark. A licence is required before any production or real-user release (`VITE_AG_GRID_LICENSE`).
