import { useSyncExternalStore } from "react";

/** Top-up sheet state; `cost` and `balance` are set when a 402 opened it. */
export interface TopUp { open: boolean; cost?: number; balance?: number }

let state: TopUp = { open: false };
const listeners = new Set<() => void>();
const set = (s: TopUp) => { state = s; listeners.forEach((f) => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };

export function openTopUp(a: { cost?: number; balance?: number } = {}) { if (!state.open) set({ open: true, ...a }); }
export function closeTopUp() { if (state.open) set({ open: false }); }
export const useTopUp = () => useSyncExternalStore(subscribe, () => state);
