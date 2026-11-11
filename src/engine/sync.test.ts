import { afterEach, expect, test, vi } from "vitest";
import { dispatch, getProgress, snapshot } from "./store";
import { startSync } from "./sync";

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

  startSync();
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
