/**
 * The hosted Ledgerline demo: the web app plus the API running in the page.
 * The API source is used unchanged; these aliases swap its server-only dependencies
 * for browser stand-ins in src/shims.
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const shim = (name: string) => fileURLToPath(new URL(`./src/shims/${name}`, import.meta.url));
const apiSeed = fileURLToPath(new URL('../api/src/db/seed.ts', import.meta.url));
const seedToday = /export const SEED_TODAY = '([^']+)'/.exec(readFileSync(apiSeed, 'utf8'))?.[1];
if (!seedToday) throw new Error(`SEED_TODAY not found in ${apiSeed}`);

/** The API's seed module needs faker and node:crypto. The browser only needs its business date. */
const seedStub = (): Plugin => ({
  name: 'ledgerline-demo-seed',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !/(^|\/)seed$/.test(source)) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved?.id === apiSeed ? shim('seed.ts') : null;
  },
});

/**
 * The API's db client names its on-disk database and migrations relative to import.meta.url.
 * Vite would bundle those files as assets; the in-memory demo uses neither, so point them nowhere.
 */
const apiClient = fileURLToPath(new URL('../api/src/db/client.ts', import.meta.url));
const noDiskPaths = (): Plugin => ({
  name: 'ledgerline-demo-no-disk-paths',
  enforce: 'pre',
  transform(code, id) {
    return id === apiClient ? code.replaceAll('import.meta.url', "'file:///'") : null;
  },
});

export default defineConfig({
  base: process.env.LL_DEMO_BASE ?? '/ledgerline/',
  define: { __LL_SEED_TODAY__: JSON.stringify(seedToday) },
  plugins: [seedStub(), noDiskPaths(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^better-sqlite3$/, replacement: shim('better-sqlite3.ts') },
      { find: /^drizzle-orm\/better-sqlite3\/migrator$/, replacement: shim('migrator.ts') },
      { find: /^fastify$/, replacement: shim('fastify.ts') },
      { find: /^@fastify\/cors$/, replacement: shim('cors.ts') },
      { find: /^node:(fs|path|url)$/, replacement: shim('node.ts') },
    ],
  },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2048 },
  server: { port: 5320, strictPort: true },
  preview: { port: 5320, strictPort: true },
});
