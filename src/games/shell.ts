import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChallengeType } from "../course/schema";
import { dispatch } from "../engine/store";

// Game timing is JS-driven: the reduced-motion rule in global.css shortens every animation and transition to 0.01ms.

export const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** setTimeout that is cleared on unmount. */
export function useLater() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => { ids.current.push(window.setTimeout(fn, ms)); };
}

/** Moves focus to the first enabled button in `box` when the focused one went away, so keys keep working. */
export function useRefocus(box: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const a = document.activeElement as HTMLButtonElement | null;
    if (!a || a === document.body || a.disabled || !a.isConnected) box.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, deps);
}

/** Count-up clock with penalties; `el` shows the time, updated every frame. */
export function useStopwatch() {
  const [t0] = useState(() => performance.now());
  const extra = useRef(0);
  const end = useRef<number | null>(null);
  const el = useRef<HTMLElement>(null);
  const elapsed = () => (end.current ?? performance.now()) - t0 + extra.current;
  useEffect(() => {
    let id = requestAnimationFrame(function tick() {
      if (el.current) el.current.textContent = secs(elapsed());
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return { el, add: (ms: number) => { extra.current += ms; }, stop: () => { end.current ??= performance.now(); return Math.round(elapsed()); } };
}

/** Reports each source challenge once: "partial" when in `missed`, else "ok". */
export function report(items: { id: string; ctype: ChallengeType }[], missed: Set<string>) {
  const now = Date.now();
  new Map(items.map((x) => [x.id, x.ctype])).forEach((ctype, id) =>
    dispatch({ type: "answer", id, ctype, result: missed.has(id) ? "partial" : "ok", now }));
}
