import { expect, test } from "vitest";
import { Rating } from "ts-fsrs";
import { FLASH_RATINGS, ratingForKey } from "./flashcard";
import { gradeOf } from "./srs";
import { initial, reducer } from "./store";

test("keys 1-4 map to Again/Hard/Good/Easy and FSRS grades", () => {
  expect(["1", "2", "3", "4", "5", "a"].map((k) => ratingForKey(k)?.label)).toEqual(["Again", "Hard", "Good", "Easy", undefined, undefined]);
  expect(FLASH_RATINGS.map((r) => gradeOf(r.result, r.easy))).toEqual([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]);
});

test("Again costs no life; Easy schedules further out than Good", () => {
  const run = { ...initial, run: { levelId: "l", lives: 3, startXp: 0 } };
  const miss = reducer(run, { type: "answer", id: "f", ctype: "flashcard", result: "miss", now: 1 });
  expect(miss.run?.lives).toBe(3);
  const good = reducer(initial, { type: "answer", id: "f", ctype: "flashcard", result: "ok", now: 1 });
  const easy = reducer(initial, { type: "answer", id: "f", ctype: "flashcard", result: "ok", easy: true, now: 1 });
  expect(good.xp).toBe(8);
  expect(easy.cards.f.due).toBeGreaterThan(good.cards.f.due);
});
