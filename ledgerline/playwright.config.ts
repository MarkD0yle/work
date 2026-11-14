import { defineConfig } from '@playwright/test';

const WEB = 'http://localhost:5310';
const STORYBOOK = 'http://localhost:6310';
/** Tests run against their own freshly seeded database, never the dev one. */
const env = { LL_DB_PATH: 'apps/api/data/e2e.sqlite', LL_API_PORT: '4311', SEED_SCALE: 'small' };

export default defineConfig({
  timeout: 30_000,
  fullyParallel: true,
  maxFailures: 10,
  reporter: [['list']],
  use: { viewport: { width: 1440, height: 900 }, trace: 'off' },
  projects: [
    { name: 'e2e', testDir: './e2e', testMatch: /.*\.e2e\.ts/, use: { baseURL: WEB } },
    { name: 'a11y', testDir: './e2e', testMatch: /.*\.a11y\.ts/, use: { baseURL: WEB } },
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
      // Serves the static Storybook built by `pnpm build-storybook` (test:a11y builds it first).
      command: 'pnpm exec vite preview --outDir storybook-static --port 6310 --strictPort',
      url: `${STORYBOOK}/index.json`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  metadata: { storybookUrl: STORYBOOK },
});
