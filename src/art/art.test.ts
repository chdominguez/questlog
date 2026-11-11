import { expect, test } from "vitest";
import { ART_KEYS, getArt } from "./index";
import { artProblem } from "../course/schema";

const REQUIRED = ["mascot", ...[0, 1, 2, 3, 4, 5].map((n) => `rank-${n}`)];

test("platform art exists and follows the art rules", () => {
  for (const key of REQUIRED) expect(artProblem(getArt(key) ?? ""), key).toBeNull();
  expect([...ART_KEYS].sort()).toEqual([...REQUIRED].sort());
  expect(getArt(undefined)).toBeUndefined();
});

test("artProblem catches rule breaks", () => {
  expect(artProblem('<svg viewBox="0 0 1 1"><path fill="#fff"/></svg>')).toMatch(/hex/);
  expect(artProblem('<svg width="2" viewBox="0 0 1 1"></svg>')).toMatch(/width/);
  expect(artProblem("<div/>")).toMatch(/svg/);
});
