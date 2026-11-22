import { Component, type ReactNode } from "react";

const KEY = "ql.chunkReload";

/** A lazy screen's chunk is gone, usually because a deploy replaced the build this tab loaded. */
export const isChunkError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|Unable to preload/i.test(e instanceof Error ? e.message : String(e));

/** True at most once a minute per tab, so a chunk that stays missing can't loop reloads. */
export function reloadOnce(now = Date.now()): boolean {
  try {
    if (now - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return false;
    sessionStorage.setItem(KEY, String(now));
    return true;
  } catch { return false; }
}

/** Reloads once for a missing chunk; otherwise shows a retry instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { if (isChunkError(e) && reloadOnce()) location.reload(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="screen-in empty">
        <h1>Failed to load</h1>
        <button type="button" className="btn" onClick={() => location.reload()}>Retry</button>
      </section>
    );
  }
}
