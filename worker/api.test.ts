import { Hono } from "hono";
import { beforeEach, expect, test } from "vitest";
import type { Grade, Note, SavedAnswer } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { resolve } from "../src/course/registry";
import { accessVerifier, createApi, MAX_ANSWER, type Env } from "./api";
import { sqliteD1 } from "./d1-sqlite";
import type { GradeInput } from "./grader";

const course = resolve(CourseSchema.parse({
  id: "t", title: "T", lang: "es-ES", grader: { persona: "Strict." },
  levels: [{ id: "l1", order: 1, title: "L", theory: [], challenges: [
    { id: "w", type: "written", prompt: "¿Qué es X?", model: "X es Y", keyPoints: ["a", "b"] },
    { id: "q", type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 },
  ] }],
}));

const grade: Grade = { score: 7, covered: ["a"], missing: ["b"], mistakes: [], improved: "Yo lo haría así." };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const post = (body: unknown) => json("POST", body);

let env: Env;
beforeEach(() => { env = { DB: sqliteD1(), AUTH_DISABLED: "1" }; });

const api = (opts: Parameters<typeof createApi>[0] = {}) => {
  const app = createApi({ courses: [course], grader: () => null, ...opts });
  return { req: (path: string, init?: RequestInit) => app.request(path, init, env) };
};

test("auth: 401 without or with a bad JWT, fails closed without AUD, bypass only with AUTH_DISABLED=1", async () => {
  const seen: string[] = [];
  const app = api({ verify: async (t) => { seen.push(t); return t === "good"; } });
  env = { DB: env.DB, ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud" };
  const jwt = (t: string) => ({ headers: { "Cf-Access-Jwt-Assertion": t } });
  expect((await app.req("/health")).status).toBe(401);
  expect((await app.req("/health", jwt("bad"))).status).toBe(401);
  expect((await app.req("/notes", jwt("good"))).status).toBe(200);
  expect(seen).toEqual(["bad", "good"]);
  env.ACCESS_AUD = "";
  expect((await app.req("/health", jwt("good"))).status).toBe(401);
  env.AUTH_DISABLED = "0";
  expect((await app.req("/health")).status).toBe(401);
  env.AUTH_DISABLED = "1";
  expect((await app.req("/health")).status).toBe(200);
});

test("the real verifier rejects a malformed token", async () => {
  await expect(accessVerifier("nope", { DB: env.DB, ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud" })).rejects.toThrow();
});

test("health and grade report 503 without a grader", async () => {
  const app = api();
  expect(await (await app.req("/health")).json()).toEqual({ ok: true, grader: false });
  const res = await app.req("/grade", post({ challengeId: "t:w", answer: "x" }));
  expect(res.status).toBe(503);
  expect((await res.json()).error).toBeTruthy();
});

test("grade validates, looks the challenge up and calls the grader with the course persona and language", async () => {
  const seen: GradeInput[] = [];
  const app = api({ grader: () => async (r) => { seen.push(r); return grade; } });
  expect((await (await app.req("/health")).json()).grader).toBe(true);
  for (const bad of [{}, { challengeId: "w", answer: "x" }, { challengeId: "t:w", answer: "" }, { challengeId: "t:w", answer: "x".repeat(MAX_ANSWER + 1) }]) {
    expect((await app.req("/grade", post(bad))).status).toBe(400);
  }
  expect((await app.req("/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nope" })).status).toBe(400);
  expect((await app.req("/grade", post({ challengeId: "t:q", answer: "x" }))).status).toBe(400);
  expect((await app.req("/grade", post({ challengeId: "t:nope", answer: "x" }))).status).toBe(404);
  expect((await app.req("/grade", post({ challengeId: "other:w", answer: "x" }))).status).toBe(404);
  const res = await app.req("/grade", post({ challengeId: "t:w", answer: "X es algo", prompt: "ignored" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(grade);
  expect(seen).toEqual([{ prompt: "¿Qué es X?", model: "X es Y", keyPoints: ["a", "b"], answer: "X es algo", lang: "es-ES", persona: "Strict." }]);
});

test("grader failure returns 502", async () => {
  const app = api({ grader: () => async () => { throw new Error("boom"); } });
  expect((await app.req("/grade", post({ challengeId: "t:w", answer: "x" }))).status).toBe(502);
});

test("save, list and export round-trip", async () => {
  const app = api();
  expect(await (await app.req("/answers")).json()).toEqual([]);
  const base = { challengeId: "t:c1", levelId: "t:l1", prompt: "¿Qué es X?", answer: "Primera", source: "typed" };
  expect((await app.req("/answers", post({ ...base, source: "voice" }))).status).toBe(400);
  expect((await app.req("/answers", post({ ...base, challengeId: "c1" }))).status).toBe(400);
  expect((await app.req("/answers", post({ ...base, grade: { score: "9" } }))).status).toBe(400);
  expect((await app.req("/answers", post({ ...base, seconds: -1 }))).status).toBe(400);

  const r1 = await app.req("/answers", post(base));
  expect(r1.status).toBe(201);
  const a1 = (await r1.json()) as SavedAnswer;
  expect(a1.id).toBeTruthy();
  expect(a1.grade).toBeUndefined();
  await app.req("/answers", post({ ...base, answer: "Segunda", source: "mixed", seconds: 42, grade: { ...grade, score: 14 } }));
  expect((await app.req("/answers", post({ ...base, selfScore: 11 }))).status).toBe(400);
  expect((await app.req("/answers", post({ ...base, selfScore: "9" }))).status).toBe(400);
  await app.req("/answers", post({ ...base, challengeId: "t:c2", prompt: "¿Y Z?", answer: "Otra", selfScore: 6 }));

  const all = (await (await app.req("/answers")).json()) as SavedAnswer[];
  expect(all.map((a) => a.answer)).toEqual(["Otra", "Segunda", "Primera"]);
  expect(all[1].grade?.score).toBe(10);
  expect(all[1].seconds).toBe(42);
  expect(all[0].selfScore).toBe(6);
  expect(all[1].selfScore).toBeUndefined();
  expect(all[2]).toEqual(a1);
  const c1 = (await (await app.req("/answers?challengeId=t:c1")).json()) as SavedAnswer[];
  expect(c1.map((a) => a.answer)).toEqual(["Segunda", "Primera"]);
  expect((await env.DB.prepare("SELECT DISTINCT course_id FROM answers").all()).results).toEqual([{ course_id: "t" }]);

  const exp = await app.req("/export");
  expect(exp.headers.get("content-type")).toContain("text/markdown");
  const md = await exp.text();
  expect(md).toContain("## t:l1");
  expect(md).toContain("### ¿Qué es X?");
  expect(md).toContain("### ¿Y Z?");
  expect(md.indexOf("Primera")).toBeLessThan(md.indexOf("Segunda"));
  expect(md).toContain("10/10");
  expect(md).toContain("6/10 (self-rated)");
  expect(md).toContain("ungraded");
  expect(md).toContain("- b");
  expect(md).toContain("Yo lo haría así.");
});

test("progress: 404 when empty, newest wins", async () => {
  const app = api();
  expect((await app.req("/progress")).status).toBe(404);
  const put = (value: unknown, updatedAt: unknown) => app.req("/progress", json("PUT", { value, updatedAt }));
  expect((await put([], 1)).status).toBe(400);
  expect((await put({ xp: 1 }, -1)).status).toBe(400);
  expect((await put({ xp: 1 }, "2")).status).toBe(400);
  expect(await (await put({ xp: 10 }, 200)).json()).toEqual({ stored: true });
  expect(await (await put({ xp: 5 }, 100)).json()).toEqual({ stored: false });
  expect(await (await put({ xp: 6 }, 200)).json()).toEqual({ stored: false });
  expect(await (await app.req("/progress")).json()).toEqual({ value: { xp: 10 }, updatedAt: 200 });
  expect(await (await put({ xp: 20 }, 300)).json()).toEqual({ stored: true });
  expect(await (await app.req("/progress")).json()).toEqual({ value: { xp: 20 }, updatedAt: 300 });
});

test("notes: CRUD, validation, search and tag filter", async () => {
  const app = api();
  const create = async (body: unknown) => (await (await app.req("/notes", post(body))).json()) as Note;
  for (const bad of [{}, { title: " ", body: "", tags: [] }, { title: "T", body: "", tags: "a" }, { title: "T", body: "", tags: [""] },
    { title: "T", body: "", tags: ["x".repeat(41)] }, { title: "T", body: "", tags: Array(21).fill("a") }, { title: "x".repeat(201), body: "", tags: [] },
    { title: "T", body: 1, tags: [] }, { title: "T", body: "", tags: [], courseId: 3 }]) {
    expect((await app.req("/notes", post(bad))).status).toBe(400);
  }
  const a = await create({ title: " Hooks ", body: "useEffect **cleanup**", tags: ["react", " react", "ts"], courseId: "t" });
  expect(a).toMatchObject({ title: "Hooks", tags: ["react", "ts"], courseId: "t" });
  const b = await create({ title: "Stripe", body: "Webhooks and REACT keys", tags: ["payments"] });
  expect(b.courseId).toBeUndefined();

  const list = async (qs = "") => ((await (await app.req(`/notes${qs}`)).json()) as Note[]).map((n) => n.title);
  expect(await list()).toEqual(["Stripe", "Hooks"]);
  expect(await list("?q=react")).toEqual(["Stripe"]);
  expect(await list("?q=CLEANUP")).toEqual(["Hooks"]);
  expect(await list("?q=hook")).toEqual(["Stripe", "Hooks"]);
  expect(await list("?tag=react")).toEqual(["Hooks"]);
  expect(await list("?tag=reac")).toEqual([]);
  expect(await list("?q=hooks&tag=payments")).toEqual(["Stripe"]);
  expect(await list("?q=%25")).toEqual([]);

  expect(await (await app.req(`/notes/${a.id}`)).json()).toEqual(a);
  expect((await app.req("/notes/nope")).status).toBe(404);
  await new Promise((r) => setTimeout(r, 5));
  const a2 = (await (await app.req(`/notes/${a.id}`, json("PUT", { title: "Hooks 2", body: "new", tags: [] }))).json()) as Note;
  expect(a2).toMatchObject({ id: a.id, title: "Hooks 2", body: "new", tags: [], createdAt: a.createdAt });
  expect(a2.courseId).toBeUndefined();
  expect(a2.updatedAt > a.updatedAt).toBe(true);
  expect(await list()).toEqual(["Hooks 2", "Stripe"]);
  expect((await app.req("/notes/nope", json("PUT", { title: "x", body: "", tags: [] }))).status).toBe(404);
  expect((await app.req(`/notes/${a.id}`, json("PUT", { title: "", body: "", tags: [] }))).status).toBe(400);

  expect((await app.req(`/notes/${a.id}`, { method: "DELETE" })).status).toBe(204);
  expect((await app.req(`/notes/${a.id}`, { method: "DELETE" })).status).toBe(404);
  expect(await list()).toEqual(["Stripe"]);
});

test("rejects oversized bodies", async () => {
  const size = 300 * 1024;
  const res = await api().req("/answers", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(size) }, body: "x".repeat(size) });
  expect(res.status).toBe(413);
});

test("rejects cross-site and non-JSON writes", async () => {
  const app = api({ grader: () => async () => grade });
  const body = { challengeId: "t:w", answer: "x" };
  const h = (headers: Record<string, string>) => ({ ...post(body), headers: { "Content-Type": "application/json", ...headers } });
  expect((await app.req("/grade", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) })).status).toBe(415);
  expect((await app.req("/grade", { method: "POST", body: JSON.stringify(body) })).status).toBe(415);
  expect((await app.req("/progress", { method: "PUT", body: "{}" })).status).toBe(415);
  expect((await app.req("/grade", h({ "Sec-Fetch-Site": "cross-site" }))).status).toBe(403);
  expect((await app.req("/grade", h({ "Sec-Fetch-Site": "same-site" }))).status).toBe(403);
  expect((await app.req("/grade", h({ Origin: "http://evil.test" }))).status).toBe(403);
  expect((await app.req("http://localhost/grade", h({ Origin: "http://localhost", "Sec-Fetch-Site": "same-origin" }))).status).toBe(200);
  expect((await app.req("/export", { headers: { "Sec-Fetch-Site": "none" } })).status).toBe(200);
});

test("unknown API paths return a JSON 404", async () => {
  const app = new Hono<{ Bindings: Env }>().route("/api", createApi({ courses: [course] }));
  const res = await app.request("/api/nope", undefined, env);
  expect(res.status).toBe(404);
  expect((await res.json()).error).toBeTruthy();
});
