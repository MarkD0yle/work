import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/{contracts,tokens}/src/**/*.test.ts',
            'apps/api/src/**/*.test.ts',
            'tooling/**/*.test.ts',
          ],
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: [
            'packages/{ui,compositions,test-utils}/src/**/*.test.{ts,tsx}',
            'apps/web/src/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['./tooling/vitest.setup.ts'],
        },
      },
    ],
  },
});
