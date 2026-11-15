import { defineConfig } from '@playwright/test';

const WEB = 'http://localhost:5310';
const WEB_COMMUNITY = 'http://localhost:5311';
const STORYBOOK = 'http://localhost:6310';
/** Tests run against their own freshly seeded database, never the dev one. */
// Jobs pause a little between chunks, so a journey can leave and come back while one is still running.
const env = {
  LL_DB_PATH: 'apps/api/data/e2e.sqlite',
  LL_API_PORT: '4311',
  SEED_SCALE: 'small',
  LL_JOB_TICK_MS: '350',
};

export default defineConfig({
  timeout: 30_000,
  fullyParallel: true,
  maxFailures: 10,
  reporter: [['list']],
  use: { viewport: { width: 1440, height: 900 }, trace: 'off' },
  projects: [
    { name: 'e2e', testDir: './e2e', testMatch: /.*\.e2e\.ts/, use: { baseURL: WEB } },
    // The same grid journeys on AG Grid Community, so the fallback stays working.
    {
      name: 'e2e-community',
      testDir: './e2e',
      testMatch: /transactions\.e2e\.ts/,
      use: { baseURL: WEB_COMMUNITY },
    },
    { name: 'a11y', testDir: './e2e', testMatch: /.*\.a11y\.ts/, use: { baseURL: WEB } },
    // One baseline image per story. A smaller viewport keeps the images small.
    {
      name: 'visual',
      testDir: './e2e',
      testMatch: /.*\.visual\.ts/,
      snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
      use: { baseURL: WEB, viewport: { width: 1000, height: 700 } },
    },
  ],
  webServer: [
    {
      command: 'rm -f apps/api/data/e2e.sqlite* && pnpm --filter @ledgerline/api start',
      url: 'http://127.0.0.1:4311/api/v1/health',
      env: { ...env, LL_DB_PATH: `${import.meta.dirname}/${env.LL_DB_PATH}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @ledgerline/web dev',
      url: WEB,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @ledgerline/web exec vite --port 5311 --strictPort',
      url: WEB_COMMUNITY,
      env: { ...env, VITE_AG_GRID_ENTERPRISE: 'false' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Serves the static Storybook built by `pnpm build-storybook` (test:a11y builds it first).
      command: 'pnpm exec vite preview --outDir storybook-static --port 6310 --strictPort',
      url: `${STORYBOOK}/index.json`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  metadata: { storybookUrl: STORYBOOK },
});
