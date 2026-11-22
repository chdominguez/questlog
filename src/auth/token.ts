// Bearer token for native apps. Web uses the session cookie, so nothing is stored there.

export interface TokenStore { load(): Promise<string | null>; save(t: string): Promise<void>; clear(): Promise<void> }

let token: string | null = null;
let store: TokenStore | null = null;

/** Native init registers the secure store before loadToken runs. */
export function registerTokenStore(s: TokenStore) { store = s; }
export const getToken = () => token;
export async function setToken(t: string | null) {
  token = t;
  await (t ? store?.save(t) : store?.clear());
}
/** Reads the stored token into memory; runs once before the first API call. */
export async function loadToken() { token = (await store?.load()) ?? null; }
