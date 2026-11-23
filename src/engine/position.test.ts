import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { clearPos, loadPos, nextOpen, savePos, type Pos } from "./position";

const m = new Map<string, string>();
beforeEach(() => {
  m.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

const pos: Pos = { phase: "play", card: 1, i: 2, lives: 2, res: ["ok", "wrong", null] };

test("round-trips and clears", () => {
  savePos("c:l", pos);
  expect(loadPos("c:l", 3, 2)).toEqual(pos);
  savePos("c:l", { ...pos, phase: "choose" });
  expect(loadPos("c:l", 3, 2)?.phase).toBe("choose");
  clearPos("c:l");
  expect(loadPos("c:l", 3, 2)).toBeNull();
});

test("drops stale or garbage positions", () => {
  savePos("c:l", pos);
  expect(loadPos("c:l", 4, 2)).toBeNull(); // challenge added
  expect(loadPos("c:l", 3, 1)).toBeNull(); // card gone
  savePos("c:l", { ...pos, lives: 0 });
  expect(loadPos("c:l", 3, 2)).toBeNull();
  m.set("ql.pos.c:l", "{nope");
  expect(loadPos("c:l", 3, 2)).toBeNull();
  m.set("ql.pos.c:l", JSON.stringify({ ...pos, res: ["ok", "bogus", null] }));
  expect(loadPos("c:l", 3, 2)).toBeNull();
});

test("next open wraps and ends", () => {
  expect(nextOpen([null, "ok", null], 2)).toBe(0);
  expect(nextOpen([null, "ok", null], 0)).toBe(2);
  expect(nextOpen(["ok", "ok", null], 2)).toBe(-1);
  expect(nextOpen(["ok", "miss"], 0)).toBe(-1);
  expect(nextOpen(["ok", null], 1)).toBe(-1); // current one not yet recorded
  expect(nextOpen([null], 0)).toBe(-1);
});
