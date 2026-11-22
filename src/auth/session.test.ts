import { afterEach, expect, test, vi } from "vitest";
import type { Me } from "../../shared/api-types";

const me: Me = {
  user: "id1", email: "a@x.com", name: "A", admin: false, aliases: [],
  features: { ai: false, billing: false, narration: false }, credits: null, limits: { uploadMaxBytes: 1, uploadMaxFiles: 1 },
};

vi.mock("../engine/sync", () => ({ startSync: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

/** Fresh session module over a stubbed localStorage (optionally with a cached account) and a fetch answering `res`. */
async function load(res: () => Promise<Response>, cached?: Me) {
  const m = new Map<string, string>(cached ? [["ql.me", JSON.stringify(cached)]] : []);
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
  vi.stubGlobal("fetch", vi.fn(res));
  const s = await import("./session");
  const sync = await import("../engine/sync");
  return { s, m, startSync: vi.mocked(sync.startSync) };
}

test("200 signs in, caches the account and starts sync", async () => {
  const { s, m, startSync } = await load(async () => Response.json(me));
  expect(await s.loadMe()).toEqual({ status: "signedIn", me });
  expect(JSON.parse(m.get("ql.me")!)).toEqual(me);
  expect(startSync).toHaveBeenCalledWith(me);
});

test("401 signs out and clears the cache", async () => {
  const { s, m, startSync } = await load(async () => Response.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }), me);
  expect(s.getMe()).toEqual(me); // cached account renders the app while loading
  expect(await s.loadMe()).toEqual({ status: "signedOut" });
  expect(m.has("ql.me")).toBe(false);
  expect(startSync).not.toHaveBeenCalled();
});

test("network error: offline with the cached account, signed out without one", async () => {
  const offline = async () => { throw new TypeError("Failed to fetch"); };
  expect(await (await load(offline, me)).s.loadMe()).toEqual({ status: "offline", me });
  vi.resetModules();
  expect(await (await load(offline)).s.loadMe()).toEqual({ status: "signedOut" });
});

test("server error keeps the cached account", async () => {
  const { s, m } = await load(async () => Response.json({ error: "x", code: "ai_failed" }, { status: 502 }), me);
  expect(await s.loadMe()).toEqual({ status: "offline", me });
  expect(m.has("ql.me")).toBe(true);
});
