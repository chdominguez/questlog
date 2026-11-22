import Anthropic from "@anthropic-ai/sdk";
import type { Db } from "./db";
import type { SessionUser } from "./api";

/** Tables keyed by user_id that existed before accounts; claimLegacy moves these only. */
const LEGACY = ["answers", "notes", "kv", "push_subscriptions", "reminders"] as const;
/** Every other per-user table with a user_id column (docs/design/questie.md 3.6). */
const OWNED = [
  "credit_ledger", "credit_balances", "billing_customers", "subscriptions", "course_opens", "uploads",
  "mock_sessions", "narration_unlocks", "flags", "device_tokens",
] as const;
/** kv rows under '' that mark one-time claims; they never move. */
const MARKERS = "('claimed', 'claimed_local')";

/** Deletes every row the user owns (docs/design/questie.md 3.6), including rows still under ids they claimed. */
export function purgeUser(db: Db, user: string): void {
  db.tx((q) => {
    const ids = [user, ...q.all<{ old_id: string }>("SELECT old_id FROM legacy_claims WHERE user_id = ?", user).map((r) => r.old_id)];
    const marks = ids.map(() => "?").join(", ");
    for (const t of LEGACY) q.run(`DELETE FROM ${t} WHERE user_id IN (${marks})${t === "kv" ? ` AND NOT (user_id = '' AND key IN ${MARKERS})` : ""}`, ...ids);
    const courses = "SELECT id FROM user_courses WHERE owner_id = ?";
    q.run(`DELETE FROM course_opens WHERE course_id IN (${courses})`, user);
    q.run("DELETE FROM user_courses WHERE owner_id = ?", user);
    q.run("DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE user_id = ?)", user);
    q.run("DELETE FROM jobs WHERE user_id = ?", user);
    for (const t of OWNED) q.run(`DELETE FROM ${t} WHERE user_id = ?`, user);
    q.run("DELETE FROM legacy_claims WHERE user_id = ?", user);
    q.run("DELETE FROM apikey WHERE referenceId = ?", user); // Better Auth does not cascade these
  });
}

/** Deletes one upload from the Files API and its row. False when the delete failed (the row stays). */
export async function dropFile(client: Anthropic, db: Db, u: { id: string; file_id: string }): Promise<boolean> {
  try { await client.files.delete(u.file_id); } catch (e) { if (!(e instanceof Anthropic.NotFoundError)) { console.error("file delete failed:", e); return false; } }
  db.tx((q) => q.run("DELETE FROM uploads WHERE id = ?", u.id));
  return true;
}

/** Account deletion: the user's uploads leave the Files API now; one that fails loses its owner and waits for the 24 h sweep. */
export async function deleteUserFiles(db: Db, client: Anthropic | null, user: string): Promise<void> {
  for (const u of db.tx((q) => q.all<{ id: string; file_id: string }>("SELECT id, file_id FROM uploads WHERE user_id = ?", user))) {
    if (!client || !(await dropFile(client, db, u))) db.tx((q) => q.run("UPDATE uploads SET user_id = '' WHERE id = ?", u.id));
  }
}

const done = new Set<string>();

/**
 * Attaches pre-account rows to this user, once per user per process (legacy_claims makes it idempotent across restarts):
 * the verified email key, plus "local" and "" for the first account ever. Rows that would collide on a key stay where they are.
 */
export function claimLegacy(db: Db, u: SessionUser): void {
  if (done.has(u.id)) return;
  db.tx((q) => {
    const candidates = u.emailVerified ? [u.email.toLowerCase()] : [];
    const first = q.run("INSERT OR IGNORE INTO kv (user_id, key, value, updated_at) VALUES ('', 'claimed_local', ?, 0)", JSON.stringify(u.id));
    if (first) candidates.push("local", "");
    const now = new Date().toISOString();
    for (const old of candidates) {
      if (!q.run("INSERT OR IGNORE INTO legacy_claims (old_id, user_id, claimed_at) VALUES (?, ?, ?)", old, u.id, now)) continue;
      for (const t of LEGACY) {
        q.run(`UPDATE OR IGNORE ${t} SET user_id = ? WHERE user_id = ?${t === "kv" ? ` AND NOT (user_id = '' AND key IN ${MARKERS})` : ""}`, u.id, old);
      }
    }
  });
  done.add(u.id);
}

/** Legacy ids this user claimed, for /me.aliases. */
export const aliasesOf = (db: Db, user: string): string[] =>
  db.tx((q) => q.all<{ old_id: string }>("SELECT old_id FROM legacy_claims WHERE user_id = ? ORDER BY old_id", user).map((r) => r.old_id));
