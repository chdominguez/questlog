import { afterEach, expect, test, vi } from "vitest";
import { lastStop } from "./Questie";

vi.mock("../ui/Md", () => ({ Md: () => null })); // DOMPurify needs a DOM

afterEach(() => vi.unstubAllGlobals());

test("last stop reads the new key, falls back to the old one, writes the new one", () => {
  const m = new Map<string, string>([["questlog:questie:c", "2"]]);
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
  expect(lastStop("c", 4)).toBe(2);
  expect(m.get("questie:map:c")).toBe("4");
  expect(lastStop("c", 5)).toBe(4);
  expect(lastStop("d", 1)).toBe(1);
});
