/** Feature flags, read from env at build time (SPEC §4). */
const on = (value: string | undefined) => value === 'true' || value === '1';

export const flags = {
  /** Enterprise grid features switch on only when a licence key is present. */
  agGridEnterprise: Boolean(import.meta.env.VITE_AG_GRID_LICENSE),
  /** No assistant in this phase; the action registry is assistant-ready. */
  assistant: on(import.meta.env.VITE_FLAG_ASSISTANT),
  approvals:
    import.meta.env.VITE_FLAG_APPROVALS === undefined ? true : on(import.meta.env.VITE_FLAG_APPROVALS),
} as const;
