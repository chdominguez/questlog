import { afterEach, describe, expect, test, vi } from "vitest";
import { dispatch, getProgress, snapshot } from "./store";
import { startSync, switchUser } from "./sync";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("adopts a newer remote copy, then debounces PUTs and flushes when hidden", async () => {
  vi.useFakeTimers();
  const calls: { method: string; body?: { value: { xp: number }; updatedAt: number }; keepalive?: boolean }[] = [];
  const remote = { ...snapshot(), xp: 99, updatedAt: Date.now() + 1000 };
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined, keepalive: init?.keepalive });
    return new Response(JSON.stringify({ value: remote, updatedAt: remote.updatedAt }));
  });
  let onVisibility = () => {};
  vi.stubGlobal("addEventListener", (_: string, cb: () => void) => { onVisibility = cb; });
  vi.stubGlobal("document", { visibilityState: "visible" });

  startSync({ user: "u1", email: "u@x.com", aliases: [] });
  await vi.waitFor(() => expect(getProgress().xp).toBe(99));
  vi.advanceTimersByTime(2000); // the adopt itself only re-sends an equal copy
  dispatch({ type: "unlockAll", on: true });
  dispatch({ type: "unlockAll", on: false });
  vi.advanceTimersByTime(1999);
  expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1);
  vi.advanceTimersByTime(1);
  const puts = calls.filter((c) => c.method === "PUT");
  expect(puts).toHaveLength(2);
  expect(puts[1].body).toEqual({ value: snapshot(), updatedAt: snapshot().updatedAt });

  dispatch({ type: "unlockAll", on: true });
  vi.stubGlobal("document", { visibilityState: "hidden" });
  onVisibility();
  expect(calls.at(-1)).toMatchObject({ method: "PUT", keepalive: true });
  vi.advanceTimersByTime(5000);
  expect(calls.filter((c) => c.method === "PUT")).toHaveLength(3);
});

/** localStorage stub whose stored keys are its own enumerable properties, as in browsers (switchUser reads Object.keys). */
const storage = (items: Record<string, string>) => {
  const s: Record<string, string> = { ...items };
  const methods = {
    getItem: (k: string) => (typeof s[k] === "string" ? s[k] : null),
    setItem: (k: string, v: string) => { s[k] = String(v); },
    removeItem: (k: string) => { delete s[k]; },
  };
  for (const [k, f] of Object.entries(methods)) Object.defineProperty(s, k, { value: f, enumerable: false });
  vi.stubGlobal("localStorage", s);
  return s;
};
const local = { "questie-v1": "{}", "questlog-v1": "{}", "ql.kata.k1": "x", "ql.me": "{}" };

describe("switchUser", () => {
  test("old email key -> user id keeps data", () => {
    const s = storage({ ...local, "ql.user": "ada@x.com" });
    expect(switchUser({ user: "id1", email: "Ada@x.com", aliases: [] })).toBe(false);
    expect(s).toEqual({ ...local, "ql.user": "id1" });
  });
  test("claimed alias -> user id keeps data", () => {
    const s = storage({ ...local, "ql.user": "local" });
    expect(switchUser({ user: "id1", email: "a@x.com", aliases: ["", "local"] })).toBe(false);
    expect(s["questie-v1"]).toBe("{}");
  });
  test("first run keeps data", () => {
    const s = storage({ ...local });
    expect(switchUser({ user: "id1", email: "a@x.com", aliases: [] })).toBe(false);
    expect(s["ql.user"]).toBe("id1");
  });
  test("id A -> id B wipes progress and kata drafts only", () => {
    const s = storage({ ...local, "ql.user": "idA" });
    expect(switchUser({ user: "idB", email: "b@x.com", aliases: ["local"] })).toBe(true);
    expect(s).toEqual({ "ql.me": "{}", "ql.user": "idB" });
  });
  test("another account signing in on the same page wipes and reloads", async () => {
    vi.resetModules();
    const s = storage({ ...local });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    vi.stubGlobal("addEventListener", () => {});
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    const fresh = await import("./sync");
    fresh.startSync({ user: "idA", email: "a@x.com", aliases: [] });
    fresh.startSync({ user: "idA", email: "a@x.com", aliases: [] });
    expect(reload).not.toHaveBeenCalled();
    fresh.startSync({ user: "idB", email: "b@x.com", aliases: [] });
    expect(reload).toHaveBeenCalledOnce();
    expect(s["questie-v1"]).toBeUndefined();
    expect(s["ql.user"]).toBe("idB");
  });
});
