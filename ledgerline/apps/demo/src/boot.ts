/**
 * Starts the Ledgerline API inside the page: load SQLite, open the seeded database image,
 * build the same app the server builds, and route the web app's API calls to it.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { buildApp } from '../../api/src/app';
import { openDb } from '../../api/src/db/client';
import { configureSqlite } from './shims/better-sqlite3';
import type { DemoApp } from './shims/fastify';
import { installEventSource, installFetch } from './transport';

const GZIP = [0x1f, 0x8b];

/** The image ships gzipped. Some servers decode it on the way, so only inflate what is still compressed. */
async function loadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The demo database could not be loaded (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== GZIP[0] || bytes[1] !== GZIP[1]) return bytes;
  const inflated = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(inflated).arrayBuffer());
}

export async function boot(): Promise<void> {
  const [sqlite3, image] = await Promise.all([
    sqlite3InitModule(),
    loadImage(`${import.meta.env.BASE_URL}ledgerline.sqlite.gz`),
  ]);
  configureSqlite(sqlite3, image);
  const app = buildApp(openDb(':memory:')) as unknown as DemoApp;
  installFetch(app);
  installEventSource(app);
}
