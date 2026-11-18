import { expect, test } from "vitest";
import { points } from "./score";

test("faster answers score more, wrong and late score nothing", () => {
  expect(points(true, 100, 20_000, 0)).toBe(1000);
  expect(points(true, 10_000, 20_000, 0)).toBe(750);
  expect(points(true, 19_999, 20_000, 0)).toBe(500);
  expect(points(true, 20_000, 20_000, 0)).toBe(0);
  expect(points(false, 100, 20_000, 9)).toBe(0);
});

test("streak multiplies the points", () => {
  expect(points(true, 10_000, 20_000, 3)).toBe(1125);
  expect(points(true, 100, 20_000, 5)).toBe(2000);
});
