import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

let registered = false;
let enterprise = false;

/** Registers the Community modules once. */
export function ensureGridModules(): void {
  if (registered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  registered = true;
}

/**
 * Switches on AG Grid Enterprise. Call before the first grid renders.
 *
 * Without a licence key the grid still works and shows AG Grid's watermark: acceptable for a design
 * concept, not for production. Modules are listed one by one, never `AllEnterpriseModule`, because some
 * Enterprise defaults would bypass Ledgerline rules. The full adopted / routed / excluded map is in
 * `docs/AG-GRID-ENTERPRISE.md`. In short, these are deliberately NOT registered:
 * - ContextMenuModule and ClipboardModule: the action registry owns the context menu, and AG Grid's
 *   clipboard would copy restricted columns.
 * - Set, multi and advanced filters, and the filters tool panel: filters belong to the screen and show as
 *   removable tags. A grid-owned filter would be hidden from the tags and from saved views.
 * - Integrated charts, sparklines, aggregation, pivot, formulas and calculated columns: they do the maths
 *   in JS numbers, and money is never a number.
 */
export async function enableGridEnterprise(licenseKey?: string): Promise<void> {
  if (enterprise) return;
  ensureGridModules();
  const m = await import('ag-grid-enterprise');
  if (licenseKey) m.LicenseManager.setLicenseKey(licenseKey);
  ModuleRegistry.registerModules([
    // Data: 250,000-row grids load from the server, grouped by the server.
    m.ServerSideRowModelModule,
    m.ServerSideRowModelApiModule,
    m.RowGroupingModule,
    m.RowGroupingPanelModule,
    // Range selection: the status bar sums the selected range in decimals, and Copy takes the range.
    m.CellSelectionModule,
    // Column menu (sort, pin, autosize, group, choose columns) and the Columns tool panel.
    m.ColumnMenuModule,
    m.SideBarModule,
    m.ColumnsToolPanelModule,
    // Excel export at display precision, restricted columns left out.
    m.ExcelExportModule,
    // Row numbers, find-in-rows (client grids) and master/detail.
    m.RowNumbersModule,
    m.FindModule,
    m.MasterDetailModule,
  ]);
  enterprise = true;
}

export const isGridEnterprise = (): boolean => enterprise;
