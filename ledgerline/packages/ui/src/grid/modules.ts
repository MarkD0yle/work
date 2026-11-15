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
 * concept, not for production. Only the modules a milestone actually uses are registered, so Enterprise
 * defaults (its own clipboard and context menu) cannot bypass Ledgerline rules such as restricted columns.
 * Registered so far: server-side row model and row grouping. Add modules here as milestones need them (Excel export in Milestone 5).
 */
export async function enableGridEnterprise(licenseKey?: string): Promise<void> {
  if (enterprise) return;
  ensureGridModules();
  const { LicenseManager, RowGroupingModule, ServerSideRowModelApiModule, ServerSideRowModelModule } =
    await import('ag-grid-enterprise');
  if (licenseKey) LicenseManager.setLicenseKey(licenseKey);
  ModuleRegistry.registerModules([ServerSideRowModelModule, ServerSideRowModelApiModule, RowGroupingModule]);
  enterprise = true;
}

export const isGridEnterprise = (): boolean => enterprise;
