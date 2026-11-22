import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

// The slice of the database the API uses (async-shaped, as the routes were written against it).
export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
/** Synchronous statements inside a transaction. `run` returns the number of changed rows. */
export interface Tx { get<T>(sql: string, ...a: unknown[]): T | undefined; all<T>(sql: string, ...a: unknown[]): T[]; run(sql: string, ...a: unknown[]): number }
/** `tx` runs fn inside BEGIN IMMEDIATE and rolls back on throw. fn must be sync: awaiting would let other requests' statements join it. */
export interface Db { prepare(sql: string): Stmt; tx<T>(fn: (q: Tx) => T): T }

/** Opens the SQLite file (":memory:" for tests) and applies each migrations/*.sql once, in name order. */
export function openDb(path: string): Db & { sqlite: DatabaseSync } {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)");
  for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    if (db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(f)) continue;
    db.exec("BEGIN");
    try { db.exec(readFileSync(`migrations/${f}`, "utf8")); db.prepare("INSERT INTO _migrations VALUES (?)").run(f); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  const stmt = (sql: string, args: SQLInputValue[] = []): Stmt => ({
    bind: (...v) => stmt(sql, v as SQLInputValue[]),
    first: async <T>() => (db.prepare(sql).get(...args) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...args) as T[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  const q: Tx = {
    get: <T>(sql: string, ...a: unknown[]) => db.prepare(sql).get(...(a as SQLInputValue[])) as T | undefined,
    all: <T>(sql: string, ...a: unknown[]) => db.prepare(sql).all(...(a as SQLInputValue[])) as T[],
    run: (sql, ...a) => Number(db.prepare(sql).run(...(a as SQLInputValue[])).changes),
  };
  const tx = <T>(fn: (q: Tx) => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try { const r = fn(q); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  return { prepare: (sql) => stmt(sql), tx, sqlite: db };
}

export const memoryDb = () => openDb(":memory:");
