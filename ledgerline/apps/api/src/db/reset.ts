/** `pnpm db:reset`: drop, migrate and reseed SQLite with the fixed seed. */
import { rmSync } from 'node:fs';
import { defaultDbPath, migrateDb, openDb } from './client';
import { seed, type SeedScale } from './seed';

const scale = (process.env.SEED_SCALE ?? 'small') as SeedScale;
if (scale !== 'small' && scale !== 'full') {
  console.error(`SEED_SCALE must be 'small' or 'full', got '${scale}'.`);
  process.exit(1);
}

const path = defaultDbPath();
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });

const started = performance.now();
const db = openDb(path);
migrateDb(db);
const result = seed(db, scale);
db.$client.close();

console.log(`Seeded ${path} (SEED_SCALE=${scale}) in ${((performance.now() - started) / 1000).toFixed(1)}s`);
console.table(result.counts);
console.log(`checksum ${result.checksum}`);
