import type { Me } from "../../shared/api-types";
import { apiFetch } from "../api";
import { adopt, OLD_STORAGE_KEY, snapshot, STORAGE_KEY, subscribe } from "./store";

const USER_KEY = "ql.user";

/** Removes local progress and kata drafts (another account, or this one deleted). */
export function wipeLocal() {
  try { for (const k of Object.keys(localStorage)) if (k === STORAGE_KEY || k === OLD_STORAGE_KEY || k.startsWith("ql.kata.")) localStorage.removeItem(k); }
  catch { /* storage off */ }
}

/** Records the signed-in user; when it differs from the previous one, wipes their local progress and kata drafts. True if wiped. */
export function switchUser(me: Pick<Me, "user" | "email" | "aliases">): boolean {
  try {
    const prev = localStorage.getItem(USER_KEY);
    localStorage.setItem(USER_KEY, me.user);
    // first run keeps pre-multi-user local progress; an old key this account claimed (email, "local") is the same user
    if (prev === null || prev === me.user || prev === me.email.toLowerCase() || me.aliases.includes(prev)) return false;
    wipeLocal();
    return true;
  } catch { return false; }
}

const DEBOUNCE_MS = 2000;

const push = (keepalive = false) => {
  const value = snapshot();
  if (!value.updatedAt) return; // nothing played yet
  apiFetch("/progress", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value, updatedAt: value.updatedAt }), keepalive,
  }).catch(() => {});
};

let started: string | null = null;

/** Mirrors progress to /api/progress (newest wins on both sides). Called by the session store once signed in; fails silently offline. */
export function startSync(me: Pick<Me, "user" | "email" | "aliases">) {
  if (started === me.user) return;
  // Another account signed in on this page: drop the previous one's local state and start clean.
  if (started !== null) { switchUser(me); location.reload(); return; }
  started = me.user;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (keepalive = false) => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    push(keepalive);
  };
  // Local state belongs to whoever last used this browser; another account must not adopt or push it.
  if (switchUser(me)) { location.reload(); return; }
  apiFetch("/progress")
    .then((r) => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(r.status)))
    // The server only stores newer copies, so pushing ours when it wasn't adopted is always safe.
    .then((remote) => { if (!(remote && adopt(remote.value))) push(); })
    .catch(() => {});
  subscribe(() => { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS); });
  // Keepalive bodies cap at 64 KB; a flush that fails here is re-sent by the push on next load.
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
}
