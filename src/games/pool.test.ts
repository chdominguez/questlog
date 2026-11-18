import { expect, test } from "vitest";
import type { Level } from "../course/schema";
import { buildPool, MIN } from "./pool";

const level = (id: string, challenges: object[]) => ({ id, order: 1, title: "L", theory: [], challenges }) as unknown as Level;
const card = (id: string, back = `back ${id}`) => ({ id, type: "flashcard", prompt: `front ${id}`, back });
const open = { levels: {}, unlockAll: true };

test("challenges map to game items, keeping source id and type", () => {
  const p = buildPool([level("l1", [
    { id: "q", type: "quiz", prompt: "Q", options: ["a", "b", "c"], answer: 1 },
    { id: "m1", type: "multi", prompt: "M", options: ["a", "b", "c"], answers: [2] },
    { id: "m2", type: "multi", prompt: "M", options: ["a", "b", "c"], answers: [0, 2] },
    { id: "tf", type: "multi", prompt: "T", options: ["True", "False"], answers: [1], style: "truefalse" },
    { id: "c1", type: "cloze", prompt: "C", text: "a {{1}} b", blanks: [{ answers: ["x"] }], bank: ["y", "x"] },
    { id: "c2", type: "cloze", prompt: "C", text: "{{1}} {{2}}", blanks: [{ answers: ["x"] }, { answers: ["y"] }], bank: ["x", "y"] },
    { id: "c3", type: "cloze", prompt: "C", text: "a {{1}}", blanks: [{ answers: ["GET"], exact: true }] },
    { id: "o", type: "order", prompt: "O", steps: ["1", "2", "3"] },
    { id: "pm", type: "match", prompt: "P", pairs: [{ left: "l1", right: "r1" }, { left: "l2", right: "r2" }, { left: "l3", right: "r3" }] },
    { id: "s", type: "sort", prompt: "S", buckets: ["a", "b"], items: [] },
    card("f", "`short`"),
    card("long", "x".repeat(31)),
  ])], open);
  expect(p.quiz.map((x) => [x.id, x.ctype, x.answer, x.tf ?? false])).toEqual([
    ["q", "quiz", 1, false], ["m1", "multi", 2, false], ["tf", "multi", 1, true], ["c1", "cloze", 1, false],
  ]);
  expect(p.quiz[3].prompt).toBe("C\n\na ____ b");
  expect(p.orders).toEqual([{ id: "o", ctype: "order", prompt: "O", steps: ["1", "2", "3"] }]);
  expect(p.pairs.map((x) => [x.id, x.left, x.right])).toEqual([
    ["pm", "l1", "r1"], ["pm", "l2", "r2"], ["pm", "l3", "r3"], ["f", "front f", "`short`"], ["long", "front long", "x".repeat(31)],
  ]);
  expect(p.typing.map((x) => [x.id, x.answers, x.exact ?? false])).toEqual([["c1", ["x"], false], ["c3", ["GET"], true], ["f", ["short"], false]]);
});

test("flashcards become quiz items only with 4 or more, with 3 distinct distractor backs", () => {
  expect(buildPool([level("l", [card("a"), card("b"), card("c")])], open).quiz).toEqual([]);
  const p = buildPool([level("l", [card("a"), card("b"), card("c"), card("d"), card("e", "back a")])], open);
  expect(p.quiz).toHaveLength(5);
  for (const q of p.quiz) {
    expect(q.answer).toBe(0);
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
  }
});

test("only unlocked levels count", () => {
  const levels = [level("l1", [card("a")]), level("l2", [card("b")])];
  expect(buildPool(levels, { levels: {}, unlockAll: false }).typing.map((x) => x.id)).toEqual(["a"]);
  expect(buildPool(levels, { levels: { l1: { stars: 1, done: true } }, unlockAll: false }).typing).toHaveLength(2);
});

test("minimum pool sizes", () => {
  expect(MIN).toEqual({ quiz: 4, match: 3, order: 1, falling: 3 });
});
