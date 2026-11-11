import { expect, test } from "vitest";
import type { Level } from "../course/schema";
import { isUnlocked, mapOrder } from "./levels";

const lv = (id: string, order: number, boss = false): Level => ({ id, order, title: id, theory: [], challenges: [], boss });

test("boss goes last, rest by order", () => {
  expect(mapOrder([lv("boss", 0, true), lv("b", 2), lv("a", 1)]).map((l) => l.id)).toEqual(["a", "b", "boss"]);
  expect(mapOrder([])).toEqual([]);
});

test("levels unlock in order unless unlockAll", () => {
  const ls = mapOrder([lv("a", 1), lv("b", 2), lv("c", 3)]);
  const p = { levels: { a: { stars: 2, done: true } }, unlockAll: false };
  expect(ls.map((_, i) => isUnlocked(ls, i, p))).toEqual([true, true, false]);
  expect(ls.map((_, i) => isUnlocked(ls, i, { ...p, unlockAll: true }))).toEqual([true, true, true]);
});
