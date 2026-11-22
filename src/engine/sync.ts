import { adopt, OLD_STORAGE_KEY, snapshot, STORAGE_KEY, subscribe } from "./store";

const USER_KEY = "ql.user";

/** Records the signed-in user; when it differs from the previous one, wipes their local progress and kata drafts. True if wiped. */
function switchUser(user: string): boolean {
  try {
    const prev = localStorage.getItem(USER_KEY);
    localStorage.setItem(USER_KEY, user);
    if (prev === null || prev === user) return false; // first run keeps pre-multi-user local progress
    for (const k of Object.keys(localStorage)) if (k === STORAGE_KEY || k === OLD_STORAGE_KEY || k.startsWith("ql.kata.")) localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

const DEBOUNCE_MS = 2000;

const push = (keepalive = false) => {
  const value = snapshot();
  if (!value.updatedAt) return; // nothing played yet
  fetch("/api/progress", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value, updatedAt: value.updatedAt }), keepalive,
  }).catch(() => {});
};

/** Mirrors progress to /api/progress (newest wins on both sides). Fails silently: offline or file:// use keeps localStorage only. */
export function startSync() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (keepalive = false) => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    push(keepalive);
  };
  // Local state belongs to whoever last used this browser; another account must not adopt or push it.
  fetch("/api/me")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(({ user }: { user: string }) => { if (switchUser(user)) location.reload(); })
    .then(() => fetch("/api/progress"))
    .then((r) => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(r.status)))
    // The server only stores newer copies, so pushing ours when it wasn't adopted is always safe.
    .then((remote) => { if (!(remote && adopt(remote.value))) push(); })
    .catch(() => {});
  subscribe(() => { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS); });
  // Keepalive bodies cap at 64 KB; a flush that fails here is re-sent by the push on next load.
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
}
