import { existsSync } from 'node:fs';
import { buildApp } from './app';
import { defaultDbPath, migrateDb, openDb } from './db/client';
import { seed, type SeedScale } from './db/seed';

const path = defaultDbPath();
const fresh = !existsSync(path);
const db = openDb(path);
// Migrations are applied on every start, so a database from an earlier version picks up new tables.
migrateDb(db);
if (fresh) {
  // First run: behave as if `pnpm db:reset` had been run, so `pnpm dev` works on a clean checkout.
  seed(db, (process.env.SEED_SCALE as SeedScale | undefined) ?? 'small');
}

const port = Number(process.env.LL_API_PORT ?? 4310);
buildApp(db)
  .listen({ port, host: '127.0.0.1' })
  .then((address) => console.log(`Ledgerline mock API on ${address}/api/v1`))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
