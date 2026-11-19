/**
 * Builds the demo's database image: migrate and seed exactly as `pnpm db:reset` does,
 * then save one self-contained SQLite file that the browser loads at start-up.
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { migrateDb, openDb } from '../../api/src/db/client';
import { seed } from '../../api/src/db/seed';

const out = fileURLToPath(new URL('../.cache/ledgerline.sqlite', import.meta.url));
const image = fileURLToPath(new URL('../public/ledgerline.sqlite.gz', import.meta.url));
mkdirSync(fileURLToPath(new URL('../public', import.meta.url)), { recursive: true });
mkdirSync(fileURLToPath(new URL('../.cache', import.meta.url)), { recursive: true });
for (const suffix of ['', '-wal', '-shm']) rmSync(out + suffix, { force: true });

const db = openDb(out);
migrateDb(db);
const result = seed(db, 'small');
// One file, no write-ahead log, compacted: the browser loads it as a single image.
db.$client.pragma('journal_mode = DELETE');
db.$client.exec('VACUUM');
db.$client.close();

// Shipped gzipped (about a fifth of the size); the page inflates it at start-up.
writeFileSync(image, gzipSync(readFileSync(out), { level: 9 }));
console.log(
  `==> Ledgerline demo: database image ${(statSync(out).size / 1e6).toFixed(1)} MB, ${(statSync(image).size / 1e6).toFixed(1)} MB gzipped, checksum ${result.checksum}`,
);
