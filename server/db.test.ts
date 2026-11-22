import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { memoryDb, openDb } from "./db";

test("tx commits, and rolls back everything on throw", () => {
  const db = memoryDb();
  const n = db.tx((q) => q.run("INSERT INTO kv (user_id, key, value, updated_at) VALUES ('u', 'a', '1', 0)"));
  expect(n).toBe(1);
  expect(() => db.tx((q) => {
    q.run("INSERT INTO kv (user_id, key, value, updated_at) VALUES ('u', 'b', '2', 0)");
    throw new Error("boom");
  })).toThrow("boom");
  expect(db.tx((q) => q.all<{ key: string }>("SELECT key FROM kv WHERE user_id = ?", "u"))).toEqual([{ key: "a" }]);
  expect(db.tx((q) => q.get<{ value: string }>("SELECT value FROM kv WHERE key = ?", "a"))).toEqual({ value: "1" });
  expect(db.tx((q) => q.get("SELECT 1 FROM kv WHERE key = 'nope'"))).toBeUndefined();
});

test("a file database runs in WAL with a busy timeout and foreign keys on", () => {
  const dir = mkdtempSync(join(tmpdir(), "questie-db-"));
  try {
    const db = openDb(join(dir, "q.db"));
    expect(db.sqlite.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
    expect(db.sqlite.prepare("PRAGMA busy_timeout").get()).toEqual({ timeout: 5000 });
    expect(db.sqlite.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    db.sqlite.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("migrations create every table of the contract", () => {
  const names = (memoryDb().sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name);
  for (const t of ["credit_ledger", "credit_balances", "billing_customers", "subscriptions", "webhook_events", "user_courses", "course_opens",
    "jobs", "job_events", "uploads", "mock_sessions", "narration_audio", "narration_tracks", "narration_unlocks", "flags", "device_tokens"]) {
    expect(names).toContain(t);
  }
});
