import { expect, test } from "vitest";
import type { Challenge, Level } from "../course/schema";
import { pickMockQuestions } from "./mock";

const w = (id: string): Challenge => ({ id, type: "written", prompt: id, model: "m", keyPoints: ["a", "b"] });
const q = (id: string): Challenge => ({ id, type: "quiz", prompt: id, options: ["a"], answer: 0 });
const lvl = (id: string, challenges: Challenge[], boss = false): Level => ({ id, order: 0, title: id, theory: [], challenges, boss });

test("uses the boss level's written challenges", () => {
  const levels = [lvl("a", [w("a1")]), lvl("boss", [w("b1"), q("b2"), w("b3")], true)];
  expect(pickMockQuestions(levels).map((x) => [x.levelId, x.challenge.id])).toEqual([["boss", "b1"], ["boss", "b3"]]);
});

test("falls back to n random written challenges from all levels", () => {
  const levels = [lvl("a", Array.from({ length: 6 }, (_, i) => w(`a${i}`))), lvl("b", [w("b0"), q("bq"), w("b1"), w("b2"), w("b3"), w("b4")]), lvl("boss", [q("x")], true)];
  const picked = pickMockQuestions(levels, 8);
  expect(picked).toHaveLength(8);
  expect(new Set(picked.map((x) => x.challenge.id)).size).toBe(8);
  expect(picked.every((x) => x.challenge.type === "written")).toBe(true);
  expect(pickMockQuestions([])).toEqual([]);
});
