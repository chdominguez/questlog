import { beforeEach, expect, test, vi } from "vitest";
import type { Grade, Improvement, MockStart, SavedAnswer } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { resolve } from "../src/course/registry";
import { createApi, type Deps, type Env } from "./api";
import { memoryDb } from "./db";
import { testEnv } from "./env";
import { parseGrade } from "./grader";

// Fake credits ledger (WP4 owns the real one): one balance, charge = spend, run, refund on throw.
const bank = vi.hoisted(() => ({ balance: 0, spent: [] as { action: string; cost: number; refunded: boolean }[] }));
vi.mock("./credits", async (orig) => {
  const real = await orig<typeof import("./credits")>();
  const { COSTS } = await import("../shared/pricing");
  const { err } = await import("./errors");
  const charge: typeof real.charge = async (c, action, _ref, run) => {
    const cost = COSTS[action];
    if (bank.balance < cost) return err(c, 402, "insufficient_credits", { action, cost, balance: bank.balance });
    bank.balance -= cost;
    const s = { action, cost, refunded: false };
    bank.spent.push(s);
    try { return await run(`s${bank.spent.length - 1}`); } catch {
      s.refunded = true;
      bank.balance += cost;
      return err(c, 502, "ai_failed", { refunded: true });
    }
  };
  const refund: typeof real.refund = (_db, id) => {
    const s = bank.spent[Number(id.slice(1))];
    if (!s || s.refunded) return false;
    s.refunded = true;
    bank.balance += s.cost;
    return true;
  };
  const balance = (() => ({ plan: 0, topup: bank.balance, total: bank.balance, planExpiresAt: null, freeCourses: 0 })) as typeof real.balance;
  return { ...real, metered: () => true, charge, refund, balance };
});

const course = resolve(CourseSchema.parse({
  id: "t", title: "T", lang: "en", mock: { title: "Exam", seconds: 600 },
  levels: [
    { id: "l1", order: 1, title: "L1", theory: [], challenges: [
      { id: "w1", type: "written", prompt: "P1", model: "M1", keyPoints: ["a", "b"] },
      { id: "q", type: "quiz", prompt: "Q", options: ["a", "b"], answer: 0 },
    ] },
    { id: "l2", order: 2, title: "Boss", boss: true, theory: [], challenges: [
      { id: "w2", type: "written", prompt: "P2", model: "M2", keyPoints: ["a", "b"] },
    ] },
  ],
}));
const plain = resolve(CourseSchema.parse({
  id: "p", title: "P", lang: "en",
  levels: [{ id: "l", order: 1, title: "L", theory: [], challenges: [{ id: "w", type: "written", prompt: "P", model: "M", keyPoints: ["a", "b"] }] }],
}));

const grade: Grade = { score: 6, covered: ["a"], missing: ["b"], mistakes: ["c"] };
const improvement: Improvement = { improved: "Better.", corrections: [{ quote: "c", fix: "d" }] };
const post = (body: unknown, user = "u") => ({ method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), "x-test-user": user }, body: JSON.stringify(body) });

let env: Env;
let now: Date;
let calls: { grade: number; improve: number };
let fail: { grade: boolean; improve: boolean };
beforeEach(() => {
  env = testEnv(memoryDb(), { ANTHROPIC_API_KEY: "k" });
  now = new Date("2026-11-22T10:00:00Z");
  calls = { grade: 0, improve: 0 };
  fail = { grade: false, improve: false };
  bank.balance = 100;
  bank.spent = [];
});

const api = (over: Partial<Deps> = {}) => {
  const app = createApi({
    courses: [course, plain],
    session: async (c) => ({ id: c.req.header("x-test-user") ?? "u", email: "u@x.com", name: "U", emailVerified: true }),
    grader: () => async () => { calls.grade++; if (fail.grade) throw new Error("boom"); return grade; },
    improver: () => async () => { calls.improve++; if (fail.improve) throw new Error("boom"); return improvement; },
    now: () => now,
    ...over,
  });
  return (path: string, init?: RequestInit) => app.request(path, init, env);
};

test("grade charges 2; 402 before the model call; refund on grader failure", async () => {
  const req = api();
  const ok = await req("/grade", post({ challengeId: "t:w1", answer: "x" }));
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual(grade);
  expect(bank.balance).toBe(98);

  fail.grade = true;
  const bad = await req("/grade", post({ challengeId: "t:w1", answer: "x" }));
  expect(bad.status).toBe(502);
  expect(await bad.json()).toMatchObject({ code: "ai_failed", refunded: true });
  expect(bank.balance).toBe(98);

  bank.balance = 1;
  const poor = await req("/grade", post({ challengeId: "t:w1", answer: "x" }));
  expect(poor.status).toBe(402);
  expect(await poor.json()).toMatchObject({ code: "insufficient_credits", cost: 2, balance: 1 });
  expect(calls.grade).toBe(2);
});

test("grade validates before charging", async () => {
  const req = api();
  expect((await req("/grade", post({ challengeId: "t:q", answer: "x" }))).status).toBe(400);
  expect((await req("/grade", post({ challengeId: "t:nope", answer: "x" }))).status).toBe(404);
  expect((await req("/grade", post({ challengeId: "t:w1", answer: "x", mockId: 5 }))).status).toBe(400);
  expect((await req("/grade", post({ challengeId: "t:w1", answer: "x" }))).status).toBe(200);
  expect(bank.spent.map((s) => s.action)).toEqual(["grade"]);
  expect((await api({ grader: () => null })("/grade", post({ challengeId: "t:w1", answer: "x" }))).status).toBe(503);
});

test("mock debits 20 once; grades inside are free until the cap or expiry", async () => {
  const req = api();
  const res = await req("/mock", post({ courseId: "t" }));
  expect(res.status).toBe(200);
  const { mockId, expiresAt } = (await res.json()) as MockStart;
  expect(expiresAt).toBe("2026-11-22T10:20:00.000Z"); // 600 s + 10 min
  expect(bank.balance).toBe(80);

  const g = (body: object, user = "u") => req("/grade", post({ answer: "x", mockId, ...body }, user));
  expect((await g({ challengeId: "t:w2" })).status).toBe(200);
  expect((await g({ challengeId: "t:w1" })).status).toBe(200); // any written challenge of the course
  expect(bank.balance).toBe(80);
  expect(await (await g({ challengeId: "t:w2" })).json()).toMatchObject({ code: "mock_exhausted" }); // 2 x 1 boss question
  expect((await g({ challengeId: "t:w2" }, "other")).status).toBe(404);
  expect((await g({ challengeId: "p:w" })).status).toBe(404);

  const second = (await (await req("/mock", post({ courseId: "t" }))).json()) as MockStart;
  now = new Date("2026-11-22T10:21:00Z");
  const late = await req("/grade", post({ challengeId: "t:w2", answer: "x", mockId: second.mockId }));
  expect(late.status).toBe(410);
  expect(await late.json()).toMatchObject({ code: "mock_expired" });
  expect(bank.spent.map((s) => s.action)).toEqual(["mock", "mock"]);
});

test("mock: a failed first grade refunds the exam and closes it; later failures do not", async () => {
  const req = api();
  const start = async () => ((await (await req("/mock", post({ courseId: "t" }))).json()) as MockStart).mockId;
  const g = (mockId: string) => req("/grade", post({ challengeId: "t:w2", answer: "x", mockId }));

  fail.grade = true;
  const a = await start();
  const bad = await g(a);
  expect(bad.status).toBe(502);
  expect(await bad.json()).toMatchObject({ code: "ai_failed", refunded: true });
  expect(bad.headers.get("x-credits-balance")).toBe("100");
  expect((await g(a)).status).toBe(409); // closed

  fail.grade = false;
  const b = await start();
  expect((await g(b)).status).toBe(200);
  fail.grade = true;
  expect(await (await g(b)).json()).toMatchObject({ code: "ai_failed", refunded: false });
  expect(bank.balance).toBe(80);
});

test("mock needs a course with a mock exam and a grader", async () => {
  const req = api();
  expect((await req("/mock", post({ courseId: "p" }))).status).toBe(400);
  expect((await req("/mock", post({ courseId: "nope" }))).status).toBe(404);
  expect((await api({ grader: () => null })("/mock", post({ courseId: "t" }))).status).toBe(503);
  expect(bank.spent).toEqual([]);
});

test("improve charges 3, saves into the answer; a second improve is 409", async () => {
  const req = api();
  const save = async (extra: object) => (await (await req("/answers", post({ challengeId: "t:w1", levelId: "t:l1", prompt: "P1", answer: "mine", source: "typed", ...extra }))).json()) as SavedAnswer;
  const a = await save({ grade });
  const res = await req(`/answers/${a.id}/improve`, post({}));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(improvement);
  expect(bank.balance).toBe(97);
  const [stored] = (await (await req("/answers?challengeId=t:w1", { headers: { "x-test-user": "u" } })).json()) as SavedAnswer[];
  expect(stored.grade).toEqual({ ...grade, ...improvement });

  expect((await req(`/answers/${a.id}/improve`, post({}))).status).toBe(409);
  expect((await req(`/answers/${(await save({ selfScore: 5 })).id}/improve`, post({}))).status).toBe(409);
  expect((await req(`/answers/${a.id}/improve`, post({}, "other"))).status).toBe(404);

  fail.improve = true;
  const b = await save({ grade });
  const bad = await req(`/answers/${b.id}/improve`, post({}));
  expect(bad.status).toBe(502);
  expect(await bad.json()).toMatchObject({ refunded: true });
  expect(bank.balance).toBe(97);
  expect(calls.improve).toBe(2);
});

test("parseGrade reads old saved grades (improved inline) and new ones", () => {
  expect(parseGrade({ ...grade, improved: "Old." })).toEqual({ ...grade, improved: "Old." });
  expect(parseGrade(grade)).toEqual(grade);
  expect(parseGrade({ ...grade, ...improvement })).toEqual({ ...grade, ...improvement });
  expect(parseGrade({ ...grade, corrections: [{ quote: 1 }] })).toBeNull();
  expect(parseGrade({ ...grade, improved: 3 })).toBeNull();
});
