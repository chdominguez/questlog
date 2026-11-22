import { expect, test, vi } from "vitest";
import type { Challenge, Level } from "../course/schema";
import { pickMockQuestions, resumable, storeMock } from "./mock";

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

test("a stored mock resumes with the same questions until it ends", () => {
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  const levels = [lvl("a", [w("a1"), q("a2"), w("a3")])];
  expect(resumable("c", levels)).toBeNull();
  storeMock("c", { mockId: "m", endAt: 2000, i: 1, ids: ["a3", "a1"], scores: [7, null] });
  expect(resumable("c", levels, 1000)).toMatchObject({ mockId: "m", i: 1, scores: [7, null], questions: [{ challenge: { id: "a3" } }, { challenge: { id: "a1" } }] });
  expect(resumable("c", levels, 2000)).toBeNull();
  expect(resumable("c", [lvl("a", [w("a1")])], 1000)).toBeNull(); // a question is gone
  storeMock("c", { endAt: 2000, i: 0, ids: ["a2"], scores: [] });
  expect(resumable("c", levels, 1000)).toBeNull(); // not a written challenge
  storeMock("c", null);
  expect(data.size).toBe(0);
  vi.unstubAllGlobals();
});
