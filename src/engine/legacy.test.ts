import { expect, test } from "vitest";
import { migrateLegacy } from "./legacy";
import { hydrate } from "./store";
import { dueKeys } from "./srs";

test("old entrevista-quest progress becomes qualified progress with review cards", () => {
  const now = Date.UTC(2026, 10, 11);
  const p = hydrate(migrateLegacy({
    xp: 420, streak: 2, unlockAll: true, review: ["age-q2"], cleared: ["age-q1", "age-q2"],
    levels: { "01-agentes": { stars: 2, done: true } }, sound: { muted: true, volume: 0.3 },
  }, now));
  expect(p.xp).toBe(420);
  expect(p.levels).toEqual({ "entrevista:01-agentes": { stars: 2, done: true } });
  expect(p.cleared).toEqual(["entrevista:age-q1", "entrevista:age-q2"]);
  expect(dueKeys(p.cards, now)).toEqual(["entrevista:age-q2"]);
  expect(p.cards["entrevista:age-q1"].due).toBeGreaterThan(now);
  expect(p.unlockAll).toBe(true);
  expect(p.sound).toEqual({ muted: true, volume: 0.3 });
  expect(p.updatedAt).toBe(now);
});
