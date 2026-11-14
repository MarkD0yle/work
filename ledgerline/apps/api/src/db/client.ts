import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const defaultDbPath = (): string =>
  process.env.LL_DB_PATH ?? fileURLToPath(new URL('../../data/ledgerline.sqlite', import.meta.url));

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export function openDb(path: string = defaultDbPath()): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  return drizzle(sqlite, { schema });
}

export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder });
}

export { schema };
