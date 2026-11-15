// Bundle budget (PLAN 7.3): what the browser must download before the first screen is under 400 KB gzipped,
// and the grid engine is not part of it. Run after `pnpm build`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 400;
const dist = join(import.meta.dirname, '..', 'apps', 'web', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
if (scripts.length === 0) {
  console.error('No scripts found in index.html. Run `pnpm build` first.');
  process.exit(1);
}
let total = 0;
for (const path of scripts) {
  const bytes = gzipSync(readFileSync(join(dist, path))).length;
  total += bytes;
  console.log(`${(bytes / 1024).toFixed(1).padStart(8)} KB gz  ${path}`);
}
const kb = total / 1024;
console.log(`${kb.toFixed(1).padStart(8)} KB gz  initial JavaScript (budget ${BUDGET_KB} KB)`);
const grid = scripts.filter((path) => /\/(grid|main\.esm)-/.test(path));
if (grid.length) {
  console.error(
    `The grid engine is in the initial load: ${grid.join(', ')}. Grid screens must be loaded on demand.`,
  );
  process.exit(1);
}
if (kb > BUDGET_KB) {
  console.error(`Over budget by ${(kb - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}
