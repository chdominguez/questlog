import { adopt, snapshot, subscribe } from "./store";

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
  fetch("/api/progress")
    .then((r) => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(r.status)))
    // The server only stores newer copies, so pushing ours when it wasn't adopted is always safe.
    .then((remote) => { if (!(remote && adopt(remote.value))) push(); })
    .catch(() => {});
  subscribe(() => { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS); });
  // Keepalive bodies cap at 64 KB; a flush that fails here is re-sent by the push on next load.
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
}
