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
 * Switches on AG Grid Enterprise (server-side row model, grouping, Excel export, range selection).
 * Call once at app start, only when a licence key exists. The Enterprise bundle is loaded on demand,
 * so Community builds never ship it.
 */
export async function enableGridEnterprise(licenseKey: string): Promise<void> {
  if (enterprise) return;
  const { AllEnterpriseModule, LicenseManager } = await import('ag-grid-enterprise');
  LicenseManager.setLicenseKey(licenseKey);
  ModuleRegistry.registerModules([AllEnterpriseModule]);
  enterprise = true;
}

export const isGridEnterprise = (): boolean => enterprise;
