import { expect, test, vi } from "vitest";
import { isChunkError, reloadOnce } from "./ErrorBoundary";

test("isChunkError: the browsers' chunk-load messages, nothing else", () => {
  for (const m of ["Failed to fetch dynamically imported module: /assets/a.js", "error loading dynamically imported module", "Importing a module script failed.", "Unable to preload CSS for /assets/a.css"]) {
    expect(isChunkError(new TypeError(m)), m).toBe(true);
  }
  expect(isChunkError(new Error("x is undefined"))).toBe(false);
});

test("reloadOnce: once a minute; false without storage", () => {
  expect(reloadOnce()).toBe(false); // node has no sessionStorage
  const m = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v) });
  expect(reloadOnce(1_000_000)).toBe(true);
  expect(reloadOnce(1_030_000)).toBe(false);
  expect(reloadOnce(1_061_000)).toBe(true);
  vi.unstubAllGlobals();
});
