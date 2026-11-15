import { Hono } from "hono";
import { beforeEach, expect, test } from "vitest";
import type { Grade, Note, Profile, SavedAnswer } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { resolve } from "../src/course/registry";
import { createApi, MAX_ANSWER, type Env } from "./api";
import { memoryDb } from "./db";
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
beforeEach(() => { env = { DB: memoryDb() }; });

const api = (opts: Parameters<typeof createApi>[0] = {}) => {
  const app = createApi({ courses: [course], grader: () => null, ...opts });
  return { req: (path: string, init?: RequestInit) => app.request(path, init, env) };
};

test("auth: the proxy header is required when USER_HEADER is set; without it everyone is local", async () => {
  const app = api();
  expect((await app.req("/health")).status).toBe(200);
  env = { DB: env.DB, USER_HEADER: "x-auth-request-email" };
  expect((await app.req("/health")).status).toBe(401);
  expect((await app.req("/health", { headers: { "X-Auth-Request-Email": "u@x.com" } })).status).toBe(200);
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

test("users are isolated; the first user claims pre-existing rows; a proxy header is required when USER_HEADER is set", async () => {
  await env.DB.prepare("INSERT INTO notes VALUES ('old', 't', 'b', '[]', NULL, 'd', 'd', '')").run(); // pre-multi-user row
  env = { DB: env.DB, USER_HEADER: "x-forwarded-email" };
  const app = api();
  const as = (u: string, init: RequestInit = {}) => ({ ...init, headers: { ...(init.headers as object), "X-Forwarded-Email": u } });
  expect((await app.req("/notes")).status).toBe(401);
  expect(((await (await app.req("/me", as(" A@X.com "))).json()) as { user: string }).user).toBe("a@x.com");
  expect(((await (await app.req("/notes", as("a@x.com"))).json()) as Note[]).map((n) => n.id)).toEqual(["old"]);
  expect(await (await app.req("/notes", as("b@x.com"))).json()).toEqual([]);
  expect((await app.req("/notes/old", as("b@x.com"))).status).toBe(404);
  expect((await app.req("/notes/old", as("b@x.com", { method: "DELETE" }))).status).toBe(404);
  const body = { value: { xp: 1 }, updatedAt: 5 };
  await app.req("/progress", as("a@x.com", json("PUT", body)));
  expect((await app.req("/progress", as("b@x.com"))).status).toBe(404);
  expect((await app.req("/progress", as("a@x.com"))).status).toBe(200);
  const ans = { challengeId: "t:w", levelId: "l1", prompt: "p", answer: "x", source: "typed" };
  await app.req("/answers", as("a@x.com", post(ans)));
  expect(await (await app.req("/answers", as("b@x.com"))).json()).toEqual([]);
  expect(((await (await app.req("/answers", as("a@x.com"))).json()) as SavedAnswer[]).length).toBe(1);
});

test("profile: per-user, validated; /me exposes the proxy name", async () => {
  env = { DB: env.DB, USER_HEADER: "x-forwarded-email", NAME_HEADER: "x-name" };
  const app = api();
  const as = (u: string, init: RequestInit = {}) => ({ ...init, headers: { ...(init.headers as object), "X-Forwarded-Email": u, "X-Name": "Ann" } });
  expect(await (await app.req("/me", as("a@x.com"))).json()).toEqual({ user: "a@x.com", name: "Ann" });
  const empty = { name: "", title: "", location: "", link: "", bio: "" };
  expect(await (await app.req("/profile", as("a@x.com"))).json()).toEqual(empty);
  const p = { ...empty, name: " Ann ", bio: "Hi", link: "https://a.dev" };
  expect(await (await app.req("/profile", as("a@x.com", json("PUT", p)))).json()).toEqual({ ...p, name: "Ann" });
  expect(((await (await app.req("/profile", as("a@x.com"))).json()) as Profile).bio).toBe("Hi");
  expect(await (await app.req("/profile", as("b@x.com"))).json()).toEqual(empty);
  expect((await app.req("/profile", as("a@x.com", json("PUT", { ...p, link: "javascript:alert(1)" })))).status).toBe(400);
  expect((await app.req("/profile", as("a@x.com", json("PUT", { ...p, bio: "x".repeat(2001) })))).status).toBe(400);
});

test("reminders: validate, upsert per course, list and delete; subscriptions are per user", async () => {
  const app = api();
  const r = { courseId: "t", title: "T", time: "08:30", tz: "Europe/Madrid" };
  expect((await app.req("/reminders", json("PUT", { ...r, time: "8:30" }))).status).toBe(400);
  expect((await app.req("/reminders", json("PUT", { ...r, tz: "Nope/Zone" }))).status).toBe(400);
  expect((await app.req("/reminders", json("PUT", r))).status).toBe(200);
  expect((await app.req("/reminders", json("PUT", { ...r, time: "09:00" }))).status).toBe(200);
  expect(await (await app.req("/reminders")).json()).toEqual([{ ...r, time: "09:00" }]);
  expect((await app.req("/reminders/t", { method: "DELETE" })).status).toBe(204);
  expect(await (await app.req("/reminders")).json()).toEqual([]);

  expect((await app.req("/push/subscription", json("POST", { endpoint: "http://x", p256dh: "k", auth: "a" }))).status).toBe(400);
  expect((await app.req("/push/subscription", json("POST", { endpoint: "https://x/1", p256dh: "k", auth: "a" }))).status).toBe(204);
  expect((await app.req("/push/key")).status).toBe(503);
});
