import { describe, expect, test } from "vitest";
import { dueKeys } from "./srs";
import { hydrate, initial, multiplier, rankIndex, rankProgress, reducer, type Action, type Progress } from "./store";

const run = (actions: Action[], s: Progress = initial) => actions.reduce(reducer, s);
const NOW = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;
const ok = (id = "q1", now = NOW): Action => ({ type: "answer", id, ctype: "quiz", result: "ok", now });
const wrong = (id = "q1", now = NOW): Action => ({ type: "answer", id, ctype: "quiz", result: "wrong", now });
const due = (s: Progress, now = NOW) => dueKeys(s.cards, now);

describe("streak and xp", () => {
  test("multiplier steps at 3 and 5", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(multiplier)).toEqual([1, 1, 1, 1.5, 1.5, 2, 2]);
  });
  test("correct answers stack xp with multiplier", () => {
    const s = run(["a", "b", "c", "d", "e"].map(ok));
    expect(s.streak).toBe(5);
    expect(s.xp).toBe(10 + 10 + 15 + 15 + 20);
  });
  test("replaying a cleared challenge gives only REPLAY_XP", () => {
    const s = run([ok("a"), ok("a"), { type: "answer", id: "a", ctype: "quiz", result: "partial", now: NOW }]);
    expect(s.cleared).toEqual(["a"]);
    expect(s.xp).toBe(10 + 2 + 1);
    expect(run([wrong("b"), ok("b")]).xp).toBe(10);
  });
  test("wrong resets streak, is due for review now, no xp", () => {
    const s = run([ok(), wrong("q2")]);
    expect(s.streak).toBe(0);
    expect(s.xp).toBe(10);
    expect(due(s)).toEqual(["q2"]);
  });
  test("partial gives half xp and resets streak, keeps lives", () => {
    const s = run([{ type: "start", levelId: "l" }, ok(), { type: "answer", id: "w", ctype: "written", result: "partial", now: NOW }]);
    expect(s.xp).toBe(10 + 13);
    expect(s.streak).toBe(0);
    expect(s.run?.lives).toBe(3);
    expect(due(s)).toEqual([]);
  });
  test("miss goes to review without costing a life", () => {
    const s = run([{ type: "start", levelId: "l" }, { type: "answer", id: "w", ctype: "written", result: "miss", now: NOW }]);
    expect(due(s)).toEqual(["w"]);
    expect(s.run?.lives).toBe(3);
  });
  test("a right answer pushes the card out by days, a later miss brings it back", () => {
    const s = run([ok("a")]);
    expect(due(s)).toEqual([]);
    expect(s.cards.a.due).toBeGreaterThan(NOW + DAY / 2);
    expect(due(run([wrong("a", NOW + DAY)], s), NOW + DAY)).toEqual(["a"]);
    expect(due(run([wrong(), ok("q1", NOW + 1)]), NOW + 1)).toEqual([]);
    expect(due(run([ok("a"), { type: "markReview", id: "a", now: NOW + 5 }]), NOW + 5)).toEqual(["a"]);
  });
});

describe("runs", () => {
  test("wrong costs a life only inside a run and never below 0", () => {
    expect(run([wrong()]).run).toBeNull();
    const s = run([{ type: "start", levelId: "l" }, wrong(), wrong(), wrong(), wrong()]);
    expect(s.run?.lives).toBe(0);
  });
  test("finish stores best stars = lives left", () => {
    const first = run([{ type: "start", levelId: "l" }, wrong(), { type: "finish" }]);
    expect(first.levels.l).toEqual({ stars: 2, done: true });
    expect(first.run).toBeNull();
    const better = run([{ type: "start", levelId: "l" }, { type: "finish" }], first);
    expect(better.levels.l.stars).toBe(3);
    const worse = run([{ type: "start", levelId: "l" }, wrong(), wrong(), { type: "finish" }], better);
    expect(worse.levels.l.stars).toBe(3);
  });
  test("finish with 0 lives does not complete the level", () => {
    const s = run([{ type: "start", levelId: "l" }, wrong(), wrong(), wrong(), { type: "finish" }]);
    expect(s.levels.l).toBeUndefined();
    expect(s.run).toBeNull();
  });
  test("start remembers xp at start", () => {
    expect(run([ok(), { type: "start", levelId: "l" }]).run).toEqual({ levelId: "l", lives: 3, startXp: 10 });
  });
});

describe("ranks", () => {
  test("thresholds", () => {
    expect([0, 149, 150, 399, 400, 800, 1300, 1899, 1900, 99999].map(rankIndex)).toEqual([0, 0, 1, 1, 2, 3, 4, 4, 5, 5]);
    expect(rankProgress(75)).toBe(0.5);
    expect(rankProgress(5000)).toBe(1);
  });
});

describe("settings and hydrate", () => {
  test("volume is clamped", () => {
    expect(reducer(initial, { type: "sound", volume: 4 }).sound).toEqual({ muted: false, volume: 1 });
    expect(reducer(initial, { type: "sound", muted: true }).sound.muted).toBe(true);
    expect(reducer(initial, { type: "unlockAll", on: true }).unlockAll).toBe(true);
  });
  test("hydrate survives garbage", () => {
    expect(hydrate(null)).toEqual(initial);
    expect(hydrate("x")).toEqual(initial);
    const h = hydrate({ xp: "9", levels: { a: { stars: 7, done: true }, b: 3 }, cards: { x: { due: 1, stability: 1, difficulty: 5, reps: 1, lapses: 0, state: 2, scheduled_days: 1, learning_steps: 0 }, y: { due: "z" } }, cleared: ["q", 2], sound: { volume: -1 }, run: { levelId: "a" } });
    expect(h.xp).toBe(0);
    expect(h.levels).toEqual({ a: { stars: 3, done: true } });
    expect(Object.keys(h.cards)).toEqual(["x"]);
    expect(h.cleared).toEqual(["q"]);
    expect(h.sound.volume).toBe(0);
    expect(h.run).toBeNull();
  });
});
