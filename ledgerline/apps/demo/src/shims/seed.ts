/**
 * Stands in for apps/api/src/db/seed.ts in the browser. The seed itself runs at build time
 * (scripts/seed-image.ts). The business date is read from the real seed module by vite.config.ts,
 * so the two always agree.
 */
declare const __LL_SEED_TODAY__: string;

export const SEED_TODAY: string = __LL_SEED_TODAY__;
export type SeedScale = 'small' | 'full';

export function seed(): never {
  throw new Error('The Ledgerline demo is seeded at build time.');
}
