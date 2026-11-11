import { expect, test } from "vitest";
import type { SavedAnswer } from "../../shared/api-types";
import { groupAnswers } from "./group";

const a = (id: string, challengeId: string, levelId: string, answer: string, score?: number): SavedAnswer => ({
  id, challengeId, levelId, prompt: `Pregunta ${challengeId}`, answer, source: "typed", createdAt: "2026-11-10T10:00:00Z",
  ...(score !== undefined && { grade: { score, covered: [], missing: [], mistakes: [], improved: "" } }),
});

const levels = [{ id: "l1", title: "Uno" }, { id: "l2", title: "Dos" }];
const data = [a("1", "c3", "gone", "x"), a("2", "c2", "l2", "redis", 4), a("3", "c1", "l1", "hola", 8), a("4", "c1", "l1", "adiós", 5), a("5", "c1", "l1", "sin nota")];

test("groups by level order with best score", () => {
  const g = groupAnswers(data, levels);
  expect(g.map((l) => l.title)).toEqual(["Uno", "Dos", "gone"]);
  expect(g[0].challenges[0].attempts.map((x) => x.id)).toEqual(["3", "4", "5"]);
  expect(g[0].challenges[0].best).toBe(8);
  expect(g[2].challenges[0].best).toBeUndefined();
});

test("self-rated attempts count toward the best score", () => {
  const self: SavedAnswer = { ...a("6", "c2", "l2", "auto"), selfScore: 9 };
  const g = groupAnswers([...data, self], levels);
  expect(g[1].challenges[0].best).toBe(9);
  expect(groupAnswers([{ ...a("7", "c9", "l1", "y"), selfScore: 2 }], levels)[0].challenges[0].best).toBe(2);
});

test("filters by prompt or answer text", () => {
  expect(groupAnswers(data, levels, "REDIS").map((l) => l.levelId)).toEqual(["l2"]);
  expect(groupAnswers(data, levels, "pregunta c1")[0].challenges[0].challengeId).toBe("c1");
  expect(groupAnswers(data, levels, "nada")).toEqual([]);
});
