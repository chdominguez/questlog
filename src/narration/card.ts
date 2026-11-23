import { useCallback, useEffect, useId, useSyncExternalStore } from "react";

// Current theory card per level key, shared by Theory and the narration player. Cleared on unmount, so a revisit starts at 0.
const cards = new Map<string, number>();
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** Sets a level's card before Theory mounts, to resume a saved position. */
export const seedTheoryCard = (k: string, n: number) => { if (cards.get(k) !== n) { cards.set(k, n); listeners.forEach((f) => f()); } };

/** `useState(0)` for the card index, shared by every caller with the same `level`. */
export function useTheoryCard(level?: string): [number, (n: number) => void] {
  const id = useId();
  const k = level ?? id;
  const i = useSyncExternalStore(subscribe, () => cards.get(k) ?? 0);
  useEffect(() => () => { cards.delete(k); }, [k]);
  return [i, useCallback((n: number) => seedTheoryCard(k, n), [k])];
}
