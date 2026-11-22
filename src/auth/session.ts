import { useSyncExternalStore } from "react";
import type { Me } from "../../shared/api-types";
import { ApiError, call } from "../api";
import { startSync } from "../engine/sync";

// Minimal session store until WP3 (auth).

export type SessionStatus = "loading" | "signedOut" | "signedIn" | "offline";
export interface Session { status: SessionStatus; me?: Me }

const KEY = "ql.me";
const cached = (): Me | undefined => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? undefined; } catch { return undefined; } };
const cache = (me: Me | undefined) => { try { if (me) localStorage.setItem(KEY, JSON.stringify(me)); else localStorage.removeItem(KEY); } catch { /* storage off */ } };

let state: Session = { status: "loading", me: typeof localStorage === "undefined" ? undefined : cached() };
const listeners = new Set<() => void>();
const set = (s: Session) => { state = s; listeners.forEach((f) => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };

export const useSession = () => useSyncExternalStore(subscribe, () => state);
export const getMe = () => state.me;

/** GET /me: 200 signs in and starts sync, 401 signs out, a network error keeps the cached account offline. */
export async function loadMe(): Promise<Session> {
  try {
    const me = await call<Me>("/me");
    cache(me);
    set({ status: "signedIn", me });
    startSync(me);
  } catch (e) {
    if (e instanceof ApiError) { cache(undefined); set({ status: "signedOut" }); }
    else set(state.me ? { status: "offline", me: state.me } : { status: "signedOut" });
  }
  return state;
}

/** Patches the balance from an x-credits-balance header. */
export function setBalance(n: number) {
  const c = state.me?.credits;
  if (!c || !Number.isFinite(n) || c.total === n) return;
  set({ ...state, me: { ...state.me!, credits: { ...c, total: n } } });
}

export function markSignedOut() {
  if (state.status === "signedOut") return;
  cache(undefined);
  set({ status: "signedOut" });
}
