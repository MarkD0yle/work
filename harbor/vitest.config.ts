import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['packages/agent/src/**', 'packages/schemas/src/**', 'packages/mock-data/src/**'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/testkit.ts'],
      thresholds: { lines: 90 },
    },
  },
})
