/** Feature flags, read from env at build time (SPEC §4). */
const on = (value: string | undefined) => value === 'true' || value === '1';

export const flags = {
  /**
   * AG Grid Enterprise is on by default. With no licence key it runs with AG Grid's watermark,
   * which is accepted while Ledgerline is a design concept. Set VITE_AG_GRID_ENTERPRISE=false for Community.
   */
  agGridEnterprise: import.meta.env.VITE_AG_GRID_ENTERPRISE !== 'false',
  /** No assistant in this phase; the action registry is assistant-ready. */
  assistant: on(import.meta.env.VITE_FLAG_ASSISTANT),
  approvals:
    import.meta.env.VITE_FLAG_APPROVALS === undefined ? true : on(import.meta.env.VITE_FLAG_APPROVALS),
} as const;
