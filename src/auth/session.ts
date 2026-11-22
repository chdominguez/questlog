import { useSyncExternalStore } from "react";
import type { Me } from "../../shared/api-types";
import { ApiError, call } from "../api";
import { startSync } from "../engine/sync";
import { isNative } from "../platform";
import { setToken } from "./token";


/** The Better Auth client, loaded on first use so it stays out of the main bundle. */
export const getAuthClient = () => import("./client").then((m) => m.authClient);
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

/** GET /me: 200 signs in and starts sync, 401 signs out, a network or server error keeps the cached account offline. */
export async function loadMe(): Promise<Session> {
  try {
    const me = await call<Me>("/me");
    cache(me);
    set({ status: "signedIn", me });
    startSync(me);
    if (isNative) void import("../native/purchases").then((p) => p.configure(me.user)).catch(() => {});
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { cache(undefined); set({ status: "signedOut" }); }
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

/** Better Auth sign-out, then forget the token and cached account. Local progress stays; the next sign-in's user switch decides. */
export async function signOut() {
  await getAuthClient().then((c) => c.signOut()).catch(() => {});
  await setToken(null);
  if (isNative) await import("../native/purchases").then((p) => p.logOut()).catch(() => {});
  markSignedOut();
}
