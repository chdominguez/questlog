import { afterEach, describe, expect, test, vi } from "vitest";
import { courseDue, dueKeys } from "./srs";
import { LEGACY_KEY } from "./legacy";
import { hydrate, initial, load, MAX_LIVES, multiplier, OLD_STORAGE_KEY, rankIndex, rankProgress, reducer, STORAGE_KEY, type Action, type Progress } from "./store";

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
  test("start resumes saved lives, clamped to 1..MAX", () => {
    expect(run([{ type: "start", levelId: "l", lives: 2 }]).run?.lives).toBe(2);
    expect(run([{ type: "start", levelId: "l", lives: 9 }]).run?.lives).toBe(MAX_LIVES);
    expect(run([{ type: "start", levelId: "l", lives: 0 }]).run?.lives).toBe(1);
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
  test("completed course has nothing due", () => {
    const s = run([wrong("a:q1"), wrong("b:q1")]);
    expect(courseDue(s, "a", NOW)).toEqual(["a:q1"]);
    const done = reducer(s, { type: "complete", course: "a", on: true });
    expect(courseDue(done, "a", NOW)).toEqual([]);
    expect(courseDue(done, "b", NOW)).toEqual(["b:q1"]);
    expect(hydrate(JSON.parse(JSON.stringify(done))).completed).toEqual(["a"]);
    expect(reducer(done, { type: "complete", course: "a", on: false }).completed).toEqual([]);
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
  test("best keeps the better value and survives hydrate", () => {
    const s = run([
      { type: "best", key: "c:quiz", value: 900 }, { type: "best", key: "c:quiz", value: 400 },
      { type: "best", key: "c:match", value: 30_000, lower: true }, { type: "best", key: "c:match", value: 20_000, lower: true },
    ]);
    expect(s.best).toEqual({ "c:quiz": 900, "c:match": 20_000 });
    expect(hydrate(JSON.parse(JSON.stringify(s))).best).toEqual(s.best);
    expect(hydrate({ best: { a: 1, b: "2", c: null, d: Infinity } }).best).toEqual({ a: 1 });
    expect(s.plays).toEqual({ "c:quiz": 2, "c:match": 2 });
    expect(hydrate(JSON.parse(JSON.stringify(s))).plays).toEqual(s.plays);
    expect(hydrate({ plays: { a: 3, b: "x" } }).plays).toEqual({ a: 3 });
  });
  test("seen marks each theory card once and survives hydrate", () => {
    const s = run([{ type: "seen", card: "c:l1#0" }, { type: "seen", card: "c:l1#2" }, { type: "seen", card: "c:l1#0" }]);
    expect(s.seen).toEqual(["c:l1#0", "c:l1#2"]);
    expect(hydrate(JSON.parse(JSON.stringify(s))).seen).toEqual(["c:l1#0", "c:l1#2"]);
    expect(hydrate({ seen: ["a", 1] }).seen).toEqual(["a"]);
  });
  test("read marks a level's theory once and survives hydrate", () => {
    const s = run([{ type: "read", levelId: "c:l1" }, { type: "read", levelId: "c:l1" }]);
    expect(s.read).toEqual(["c:l1"]);
    expect(hydrate(JSON.parse(JSON.stringify(s))).read).toEqual(["c:l1"]);
    expect(hydrate({ read: ["a", 2, null] }).read).toEqual(["a"]);
  });
});

describe("load", () => {
  const storage = (items: Record<string, string>) => {
    const m = new Map(Object.entries(items));
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
      key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; },
    });
    return m;
  };
  afterEach(() => vi.unstubAllGlobals());

  test("old key only: loaded and copied, old key kept", () => {
    const old = JSON.stringify({ xp: 42 });
    const m = storage({ [OLD_STORAGE_KEY]: old });
    expect(load().xp).toBe(42);
    expect(m.get(STORAGE_KEY)).toBe(old);
    expect(m.get(OLD_STORAGE_KEY)).toBe(old);
  });
  test("both keys: new key wins", () => {
    const m = storage({ [STORAGE_KEY]: JSON.stringify({ xp: 7 }), [OLD_STORAGE_KEY]: JSON.stringify({ xp: 42 }) });
    expect(load().xp).toBe(7);
    expect(JSON.parse(m.get(OLD_STORAGE_KEY)!).xp).toBe(42);
  });
  test("legacy key still migrates", () => {
    const m = storage({ [LEGACY_KEY]: JSON.stringify({ xp: 5, cleared: ["q1"] }) });
    const p = load();
    expect(p.xp).toBe(5);
    expect(p.cleared).toEqual(["entrevista:q1"]);
    expect(JSON.parse(m.get(STORAGE_KEY)!).xp).toBe(5);
  });
});
