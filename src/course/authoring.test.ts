import { expect, test } from "vitest";
import { at, hl } from "./authoring";

test("hl returns sorted unique 1-based lines", () => {
  expect(hl("a\nb x\nc x\nd", "x", "a", "c")).toEqual([1, 2, 3]);
});

test("hl throws on a missing needle", () => {
  expect(() => hl("a\nb", "zz")).toThrow(/zz/);
});

test("at returns the one matching line, else throws", () => {
  expect(at("a\nb x\nc", "x")).toBe(2);
  expect(() => at("a\nb", "zz")).toThrow(/0 lines/);
  expect(() => at("x\nx", "x")).toThrow(/2 lines/);
});
