import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { Db, Stmt } from "./api";

/** Opens the SQLite file (":memory:" for tests) and applies each migrations/*.sql once, in name order. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
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
  return { prepare: (sql) => stmt(sql) };
}

export const memoryDb = () => openDb(":memory:");
