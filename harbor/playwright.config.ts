import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  // A broken build fails every test the same way; stop early instead of waiting out each timeout.
  maxFailures: 3,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5180', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:5180', reuseExistingServer: true, timeout: 60_000 },
})
