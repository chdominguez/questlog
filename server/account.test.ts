import { expect, test } from "vitest";
import { purgeUser } from "./account";
import { memoryDb } from "./db";

const now = "2026-11-22T00:00:00.000Z";
// One row per per-user table (docs/design/questie.md 3.6), for user `u`.
const seed = (u: string, n: string) => [
  ["INSERT INTO answers (id, course_id, challenge_id, level_id, prompt, answer, source, created_at, user_id) VALUES (?, 'c', 'c:w', 'l', 'p', 'a', 'typed', ?, ?)", `a${n}`, now, u],
  ["INSERT INTO notes (id, title, body, tags, created_at, updated_at, user_id) VALUES (?, 't', 'b', '[]', ?, ?, ?)", `n${n}`, now, now, u],
  ["INSERT INTO kv (user_id, key, value, updated_at) VALUES (?, 'progress', '{}', 1)", u],
  ["INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, 'k', 'a')", `https://p/${n}`, u],
  ["INSERT INTO reminders (user_id, course_id, title, time, tz) VALUES (?, 'c', 'T', '09:00', 'UTC')", u],
  ["INSERT INTO credit_ledger (id, user_id, kind, source, source_id, created_at) VALUES (?, ?, 'adjust', 'admin', ?, ?)", `l${n}`, u, n, now],
  ["INSERT INTO credit_balances (user_id, updated_at) VALUES (?, ?)", u, now],
  ["INSERT INTO billing_customers (user_id, stripe_customer_id, created_at) VALUES (?, ?, ?)", u, `cus_${n}`, now],
  ["INSERT INTO subscriptions (provider, external_id, user_id, status, updated_at) VALUES ('stripe', ?, ?, 'active', ?)", `sub_${n}`, u, now],
  ["INSERT INTO user_courses (id, owner_id, title, lang, json, mode, levels, created_at, updated_at) VALUES (?, ?, 'T', 'en', '{}', 'topic', 1, ?, ?)", `uc${n}`, u, now, now],
  ["INSERT INTO course_opens (user_id, course_id, opened_at) VALUES (?, 'x', ?)", u, now],
  ["INSERT INTO jobs (id, user_id, kind, status, input, created_at) VALUES (?, ?, 'build', 'done', '{}', ?)", `j${n}`, u, now],
  ["INSERT INTO job_events (job_id, seq, at, type, data) VALUES (?, 1, ?, 'done', '{}')", `j${n}`, now],
  ["INSERT INTO uploads (id, user_id, file_id, name, bytes, created_at) VALUES (?, ?, 'f', 'n', 1, ?)", `up${n}`, u, now],
  ["INSERT INTO mock_sessions (id, user_id, course_id, grades_left, expires_at, created_at) VALUES (?, ?, 'c', 1, ?, ?)", `m${n}`, u, now, now],
  ["INSERT INTO narration_unlocks (user_id, course_id, level_id, voice, created_at) VALUES (?, 'c', 'l', 'v', ?)", u, now],
  ["INSERT INTO flags (id, user_id, course_id, reason, created_at) VALUES (?, ?, 'c', 'wrong', ?)", `f${n}`, u, now],
  ["INSERT INTO device_tokens (token, user_id, platform, created_at) VALUES (?, ?, 'ios', ?)", `t${n}`, u, now],
  ["INSERT INTO legacy_claims (old_id, user_id, claimed_at) VALUES (?, ?, ?)", `old${n}`, u, now],
] as const;

const TABLES = ["answers", "notes", "kv", "push_subscriptions", "reminders", "credit_ledger", "credit_balances", "billing_customers", "subscriptions",
  "course_opens", "jobs", "uploads", "mock_sessions", "narration_unlocks", "flags", "device_tokens", "legacy_claims"];

test("purgeUser empties every per-user table for that user, rows under claimed ids too, and nobody else's", () => {
  const db = memoryDb();
  db.tx((q) => {
    for (const [sql, ...a] of [...seed("u", "1"), ...seed("other", "2"), ...seed("old1", "3").slice(0, 5)]) q.run(sql, ...a);
    q.run("INSERT INTO course_opens (user_id, course_id, opened_at) VALUES ('other', 'uc1', ?)", now); // someone opened u's course
    q.run("INSERT INTO kv (user_id, key, value, updated_at) VALUES ('', 'claimed_local', '\"u\"', 0)");
  });
  purgeUser(db, "u");
  db.tx((q) => {
    for (const t of TABLES) {
      expect(q.all(`SELECT * FROM ${t} WHERE user_id IN ('u', 'old1')`), t).toEqual([]);
      expect(q.all(`SELECT * FROM ${t} WHERE user_id = 'other'`).length, t).toBe(1);
    }
    expect(q.all("SELECT id FROM user_courses")).toEqual([{ id: "uc2" }]);
    expect(q.all("SELECT job_id FROM job_events")).toEqual([{ job_id: "j2" }]);
    expect(q.all("SELECT course_id FROM course_opens WHERE user_id = 'other'")).toEqual([{ course_id: "x" }]);
    expect(q.get("SELECT 1 AS x FROM kv WHERE key = 'claimed_local'")).toEqual({ x: 1 });
  });
});
