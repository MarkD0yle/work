/**
 * A browser stand-in for `better-sqlite3`, built on the official SQLite WASM build.
 *
 * It covers what Drizzle's better-sqlite3 driver and the API's raw queries use:
 * prepare → run / get / all / iterate / raw / pluck, exec, pragma and transaction.
 * Calls are synchronous, as in better-sqlite3, so the API code runs unchanged.
 */
import type {
  BindableValue,
  Database as WasmDatabase,
  PreparedStatement,
  Sqlite3Static,
} from '@sqlite.org/sqlite-wasm';

let sqlite3: Sqlite3Static | undefined;
let image: Uint8Array | undefined;

/** Called once at boot, before the API opens its database. */
export function configureSqlite(module: Sqlite3Static, seededImage: Uint8Array): void {
  sqlite3 = module;
  image = seededImage;
}

type Row = Record<string, unknown>;
type Params = unknown[];

/** better-sqlite3 accepts each parameter on its own or an array of them. */
function flatten(params: Params): BindableValue[] {
  const out: BindableValue[] = [];
  for (const p of params) {
    if (Array.isArray(p)) out.push(...(p as BindableValue[]));
    else if (typeof p === 'boolean') out.push(p ? 1 : 0);
    else out.push(p as BindableValue);
  }
  return out;
}

/** Numbers come back as JS numbers. Rowids and counts never exceed 2^53 in the demo. */
function plain(value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}

class Statement {
  private mode: 'object' | 'raw' | 'pluck' = 'object';

  constructor(
    private readonly owner: Database,
    readonly source: string,
  ) {}

  raw(on = true): this {
    this.mode = on ? 'raw' : 'object';
    return this;
  }

  pluck(on = true): this {
    this.mode = on ? 'pluck' : 'object';
    return this;
  }

  run(...params: Params): { changes: number; lastInsertRowid: number } {
    this.owner.withStatement(this.source, params, (stmt) => {
      while (stmt.step()) {
        /* drain */
      }
    });
    return this.owner.lastRun();
  }

  get(...params: Params): unknown {
    return this.owner.withStatement(this.source, params, (stmt) =>
      stmt.step() ? this.read(stmt) : undefined,
    );
  }

  all(...params: Params): unknown[] {
    return this.owner.withStatement(this.source, params, (stmt) => {
      const rows: unknown[] = [];
      while (stmt.step()) rows.push(this.read(stmt));
      return rows;
    });
  }

  *iterate(...params: Params): Generator<unknown> {
    yield* this.all(...params);
  }

  private read(stmt: PreparedStatement): unknown {
    if (this.mode === 'pluck') return plain(stmt.get(0));
    if (this.mode === 'raw') return (stmt.get([]) as unknown[]).map(plain);
    const row = stmt.get({}) as Row;
    for (const key of Object.keys(row)) row[key] = plain(row[key]);
    return row;
  }
}

/** How many compiled statements to keep. Older ones are finalized to free WASM memory. */
const CACHE_SIZE = 256;

export default class Database {
  private readonly db: WasmDatabase;
  private readonly cache = new Map<string, PreparedStatement>();
  private depth = 0;

  constructor(_path?: string) {
    if (!sqlite3) throw new Error('SQLite WASM is not ready: call configureSqlite first.');
    this.db = new sqlite3.oo1.DB(':memory:', 'c');
    if (image) {
      const pointer = sqlite3.wasm.allocFromTypedArray(image);
      const flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE;
      const rc = sqlite3.capi.sqlite3_deserialize(
        this.db,
        'main',
        pointer,
        image.byteLength,
        image.byteLength,
        flags,
      );
      this.db.checkRc(rc);
    }
  }

  prepare(source: string): Statement {
    return new Statement(this, source);
  }

  exec(source: string): this {
    this.db.exec(source);
    return this;
  }

  /** WAL and sync settings mean nothing for an in-memory database. Other pragmas run as written. */
  pragma(source: string): unknown[] {
    if (/^\s*(journal_mode|synchronous)\b/i.test(source)) return [];
    return this.db.selectObjects(`PRAGMA ${source}`);
  }

  /** As better-sqlite3: BEGIN/COMMIT at the outer level, savepoints when nested, roll back on throw. */
  transaction<A extends unknown[], R>(fn: (...args: A) => R) {
    const run = (...args: A): R => {
      const outer = this.depth === 0;
      const savepoint = `ll_sp_${this.depth}`;
      this.db.exec(outer ? 'BEGIN' : `SAVEPOINT ${savepoint}`);
      this.depth += 1;
      try {
        const result = fn(...args);
        this.depth -= 1;
        this.db.exec(outer ? 'COMMIT' : `RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        this.depth -= 1;
        this.db.exec(outer ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw error;
      }
    };
    return Object.assign(run, { deferred: run, immediate: run, exclusive: run });
  }

  close(): void {
    for (const stmt of this.cache.values()) stmt.finalize();
    this.cache.clear();
    this.db.close();
  }

  /** @internal Runs one statement with fresh bindings, from a small cache of compiled statements. */
  withStatement<T>(source: string, params: Params, read: (stmt: PreparedStatement) => T): T {
    let stmt = this.cache.get(source);
    if (stmt) {
      this.cache.delete(source);
    } else {
      stmt = this.db.prepare(source);
      if (this.cache.size >= CACHE_SIZE) {
        const [oldest, old] = this.cache.entries().next().value as [string, PreparedStatement];
        this.cache.delete(oldest);
        old.finalize();
      }
    }
    this.cache.set(source, stmt);
    try {
      const values = flatten(params);
      if (values.length) stmt.bind(values);
      return read(stmt);
    } finally {
      stmt.reset(true);
    }
  }

  /** @internal The changes and rowid of the last statement, as better-sqlite3's run() reports them. */
  lastRun(): { changes: number; lastInsertRowid: number } {
    const capi = sqlite3!.capi;
    return {
      changes: Number(capi.sqlite3_changes(this.db)),
      lastInsertRowid: Number(capi.sqlite3_last_insert_rowid(this.db)),
    };
  }
}
