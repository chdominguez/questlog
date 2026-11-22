import { Hono } from "hono";
import { beforeEach, expect, test } from "vitest";
import type { Grade, Note, Profile, SavedAnswer } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { resolve } from "../src/course/registry";
import { createApi, MAX_ANSWER, type Deps, type Env, type SessionUser } from "./api";
import { memoryDb } from "./db";
import { testEnv } from "./env";
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
beforeEach(() => { env = testEnv(memoryDb()); });

// Fake session: the user id comes from x-test-user; no header = signed out. "u" is the default user.
const account = (id: string): SessionUser => ({ id, email: `${id}@x.com`, name: id.toUpperCase(), emailVerified: true });
const session: Deps["session"] = async (c) => {
  const id = c.req.header("x-test-user") ?? "u";
  return id ? account(id) : null;
};
const api = (opts: Partial<Deps> = {}) => {
  const app = createApi({ courses: [course], grader: () => null, session, ...opts });
  return { app, req: (path: string, init?: RequestInit) => app.request(path, init, env) };
};
const as = (u: string, init: RequestInit = {}): RequestInit => ({ ...init, headers: { ...(init.headers as object), "x-test-user": u } });

test("session: every private route needs a user; public routes do not", async () => {
  const app = api();
  const res = await app.req("/notes", as(""));
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "Unauthorized", code: "unauthorized" });
  expect((await app.req("/health", as(""))).status).toBe(200);
  expect((await app.req("/auth/get-session", as(""))).status).not.toBe(401);
  expect((await app.req("/webhooks/stripe", as("", { method: "POST", body: "{}" }))).status).not.toBe(401);
  expect((await app.req("/notes")).status).toBe(200);
});

test("mount order: health, auth and webhooks are reachable cross-site and without JSON", async () => {
  const app = api();
  const cross = { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.test" };
  expect((await app.req("/health", { headers: cross })).status).toBe(200);
  for (const path of ["/auth/callback/apple", "/webhooks/stripe", "/webhooks/revenuecat"]) {
    const res = await app.req(path, as("", { method: "POST", headers: { ...cross, "Content-Type": "application/x-www-form-urlencoded" }, body: "a=1" }));
    expect([401, 403, 415]).not.toContain(res.status);
  }
});

test("health reports commit and features", async () => {
  expect(await (await api().req("/health")).json()).toEqual({ ok: true, commit: env.COMMIT, grader: false, narration: false });
  env = { ...env, ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICES: ["v"] };
  expect((await (await api({ grader: () => async () => grade }).req("/health")).json())).toMatchObject({ grader: true, narration: true });
});

test("health and grade report 503 without a grader", async () => {
  const app = api();
  const res = await app.req("/grade", post({ challengeId: "t:w", answer: "x" }));
  expect(res.status).toBe(503);
  expect(await res.json()).toMatchObject({ code: "not_configured", error: expect.any(String) });
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
  const res = await app.req("/grade", post({ challengeId: "t:w", answer: "x" }));
  expect(res.status).toBe(502);
  expect((await res.json()).code).toBe("ai_failed");
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
  expect((await env.DB.prepare("SELECT DISTINCT course_id, user_id FROM answers").all()).results).toEqual([{ course_id: "t", user_id: "u" }]);

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

test("body limits: 256 KB, 2 MB for course re-uploads, 20 MB for uploads", async () => {
  const app = api();
  const big = (method: string, path: string, size: number, type = "application/json") =>
    app.req(path, { method, headers: { "Content-Type": type, "Content-Length": String(size) }, body: "x".repeat(size) });
  const res = await big("POST", "/answers", 300 * 1024);
  expect(res.status).toBe(413);
  expect((await res.json()).code).toBe("too_large");
  expect((await big("PUT", "/courses/t", 300 * 1024)).status).not.toBe(413);
  expect((await big("PUT", "/courses/t", 3 * 1024 * 1024)).status).toBe(413);
  expect((await big("POST", "/builder/uploads", 3 * 1024 * 1024, "multipart/form-data; boundary=x")).status).not.toBe(413);
  expect((await big("POST", "/builder/uploads", 21 * 1024 * 1024, "multipart/form-data; boundary=x")).status).toBe(413);
});

test("guard: rejects cross-site and non-JSON writes, allows app origins", async () => {
  const app = api({ grader: () => async () => grade });
  const body = { challengeId: "t:w", answer: "x" };
  const h = (headers: Record<string, string>) => ({ ...post(body), headers: { "Content-Type": "application/json", ...headers } });
  const plain = await app.req("/grade", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) });
  expect(plain.status).toBe(415);
  expect((await plain.json()).code).toBe("unsupported_media_type");
  expect((await app.req("/grade", { method: "POST", body: JSON.stringify(body) })).status).toBe(415);
  expect((await app.req("/progress", { method: "PUT", body: "{}" })).status).toBe(415);
  expect((await app.req("/builder/jobs", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x" }, body: "" })).status).toBe(415);
  expect((await app.req("/builder/uploads", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x" }, body: "" })).status).not.toBe(415);
  const cross = await app.req("/grade", h({ "Sec-Fetch-Site": "cross-site" }));
  expect(cross.status).toBe(403);
  expect((await cross.json()).code).toBe("origin_not_allowed");
  expect((await app.req("/grade", h({ "Sec-Fetch-Site": "same-site" }))).status).toBe(403);
  expect((await app.req("/grade", h({ Origin: "http://evil.test" }))).status).toBe(403);
  expect((await app.req("http://localhost/grade", h({ Origin: "http://localhost", "Sec-Fetch-Site": "same-origin" }))).status).toBe(200);
  expect((await app.req("/export", { headers: { "Sec-Fetch-Site": "none" } })).status).toBe(200);
  for (const origin of ["capacitor://localhost", "https://localhost"]) {
    expect((await app.req("http://app.test/grade", h({ Origin: origin, "Sec-Fetch-Site": "cross-site" }))).status).toBe(200);
  }
});

test("guard marks app-origin requests so the session ignores cookies", async () => {
  const seen: (boolean | undefined)[] = [];
  const app = api({ session: async (c) => { seen.push(c.get("appOrigin")); return account("u"); } });
  await app.req("http://app.test/notes", { headers: { Origin: "capacitor://localhost" } });
  await app.req("http://app.test/notes", { headers: { Origin: "http://app.test" } });
  expect(seen).toEqual([true, undefined]);
});

test("cors: app origins get the exposed headers, others nothing", async () => {
  const app = api();
  const pre = await app.req("/grade", { method: "OPTIONS", headers: { Origin: "capacitor://localhost", "Access-Control-Request-Method": "POST" } });
  expect(pre.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  expect(pre.headers.get("access-control-allow-headers")).toBe("Authorization,Content-Type,Idempotency-Key");
  expect(pre.headers.get("access-control-max-age")).toBe("600");
  const res = await app.req("/health", { headers: { Origin: "capacitor://localhost" } });
  expect(res.headers.get("access-control-expose-headers")).toBe("set-auth-token,x-credits-balance,Retry-After");
  expect((await app.req("/health", { headers: { Origin: "https://evil.test" } })).headers.get("access-control-allow-origin")).toBeNull();
});

test("rate limits answer 429 with Retry-After per user", async () => {
  const app = api({ grader: () => async () => grade });
  for (let i = 0; i < 30; i++) expect((await app.req("/grade", as("rl", post({ challengeId: "t:w", answer: "x" })))).status).toBe(200);
  const res = await app.req("/grade", as("rl", post({ challengeId: "t:w", answer: "x" })));
  expect(res.status).toBe(429);
  expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await res.json()).toMatchObject({ code: "rate_limited", retryAfter: expect.any(Number) });
  expect((await app.req("/grade", as("rl2", post({ challengeId: "t:w", answer: "x" })))).status).toBe(200);
});

test("every route of the contract is mounted", () => {
  const routes = new Set(api().app.routes.map((r) => `${r.method} ${r.path}`));
  const contract = [
    "GET /health", "GET /auth/*", "POST /auth/*", "GET /me",
    "GET /profile", "PUT /profile", "GET /push/key", "POST /push/subscription", "DELETE /push/subscription",
    "GET /reminders", "PUT /reminders", "DELETE /reminders/:course", "POST /answers", "GET /answers", "GET /export",
    "GET /progress", "PUT /progress", "GET /notes", "GET /notes/:id", "POST /notes", "PUT /notes/:id", "DELETE /notes/:id",
    "POST /push/device", "DELETE /push/device",
    "GET /credits", "GET /credits/ledger", "POST /billing/checkout", "POST /billing/portal", "POST /billing/fulfill",
    "POST /admin/credits", "POST /webhooks/stripe", "POST /webhooks/revenuecat",
    "POST /grade", "POST /answers/:id/improve", "POST /mock",
    "GET /narration/:course/:level", "POST /narration", "GET /narration/audio/:hash",
    "POST /builder/uploads", "POST /builder/jobs", "GET /jobs", "GET /jobs/:id",
    "GET /courses", "GET /courses/:id", "PUT /courses/:id", "DELETE /courses/:id",
    "POST /courses/:id/share", "POST /courses/:id/publish", "POST /courses/:id/unpublish", "GET /library", "POST /flags",
    "GET /admin/review", "POST /admin/courses/:id/approve", "POST /admin/courses/:id/reject", "POST /admin/flags/:id/resolve",
  ];
  expect(contract.filter((r) => !routes.has(r))).toEqual([]);
});

test("admin routes need a verified admin email", async () => {
  env = { ...env, ADMIN_EMAILS: ["boss@x.com"] };
  const forbidden = await api().req("/admin/review", as("u"));
  expect(forbidden.status).toBe(403);
  expect((await forbidden.json()).code).toBe("forbidden");
  expect((await api().req("/admin/review", as("boss"))).status).not.toBe(403);
  const unverified = api({ session: async () => ({ ...account("boss"), emailVerified: false }) });
  expect((await unverified.req("/admin/review")).status).toBe(403);
});

test("/me comes from the session account", async () => {
  expect(await (await api().req("/me", as("a"))).json()).toEqual({
    user: "a", email: "a@x.com", name: "A", admin: false, aliases: [],
    features: { ai: false, billing: false, narration: false }, credits: null,
    limits: { uploadMaxBytes: 20 * 1024 * 1024, uploadMaxFiles: 10 },
  });
});

test("unknown API paths return a JSON 404", async () => {
  const app = new Hono<{ Bindings: Env }>().route("/api", createApi({ courses: [course], session }));
  const res = await app.request("/api/nope", undefined, env);
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "Not found", code: "not_found" });
});

test("users are isolated", async () => {
  const app = api();
  await app.req("/notes", as("a", post({ title: "A", body: "", tags: [] })));
  const [note] = (await (await app.req("/notes", as("a"))).json()) as Note[];
  expect(note.title).toBe("A");
  expect(await (await app.req("/notes", as("b"))).json()).toEqual([]);
  expect((await app.req(`/notes/${note.id}`, as("b"))).status).toBe(404);
  expect((await app.req(`/notes/${note.id}`, as("b", { method: "DELETE" }))).status).toBe(404);
  expect((await app.req(`/notes/${note.id}`, as("b", json("PUT", { title: "x", body: "", tags: [] })))).status).toBe(404);
  const body = { value: { xp: 1 }, updatedAt: 5 };
  await app.req("/progress", as("a", json("PUT", body)));
  expect((await app.req("/progress", as("b"))).status).toBe(404);
  expect((await app.req("/progress", as("a"))).status).toBe(200);
  const ans = { challengeId: "t:w", levelId: "l1", prompt: "p", answer: "x", source: "typed" };
  await app.req("/answers", as("a", post(ans)));
  expect(await (await app.req("/answers", as("b"))).json()).toEqual([]);
  expect(((await (await app.req("/answers", as("a"))).json()) as SavedAnswer[]).length).toBe(1);
  expect((await env.DB.prepare("SELECT user_id FROM notes").all()).results).toEqual([{ user_id: "a" }]);
});

test("profile: per-user, validated", async () => {
  const app = api();
  const empty = { name: "", title: "", location: "", link: "", bio: "" };
  expect(await (await app.req("/profile", as("a"))).json()).toEqual(empty);
  const p = { ...empty, name: " Ann ", bio: "Hi", link: "https://a.dev" };
  expect(await (await app.req("/profile", as("a", json("PUT", p)))).json()).toEqual({ ...p, name: "Ann" });
  expect(((await (await app.req("/profile", as("a"))).json()) as Profile).bio).toBe("Hi");
  expect(await (await app.req("/profile", as("b"))).json()).toEqual(empty);
  expect((await app.req("/profile", as("a", json("PUT", { ...p, link: "javascript:alert(1)" })))).status).toBe(400);
  expect((await app.req("/profile", as("a", json("PUT", { ...p, bio: "x".repeat(2001) })))).status).toBe(400);
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
