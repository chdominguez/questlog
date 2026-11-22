import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import type { CourseStatus, ReviewQueue, UserCourseMeta } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { COURSES, resolve } from "../src/course/registry";
import { validateCourse } from "../src/course/validate";
import { exportCourse } from "../scripts/export-course";
import { createApi, type Deps, type Env, type SessionUser } from "./api";
import { memoryDb } from "./db";
import { testEnv } from "./env";

const raw = { id: "t", title: "T", lang: "en", levels: [{ id: "l1", order: 1, title: "L", theory: [], challenges: [
  { id: "q", type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 },
] }] };
const course = resolve(CourseSchema.parse(raw));

let db: ReturnType<typeof memoryDb>;
let env: Env;
let clock = 0;
beforeEach(() => {
  db = memoryDb();
  env = testEnv(db, { ADMIN_EMAILS: ["boss@x.com"] });
  // Better Auth's user table comes with migration 0004 (auth); the columns used here exist in both.
  db.sqlite.exec(`CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, emailVerified INTEGER NOT NULL,
    createdAt DATE NOT NULL, updatedAt DATE NOT NULL)`);
  for (const [id, name] of [["ann", "Ann L."], ["bob", "Bob"], ["boss", "Boss"]]) {
    db.sqlite.prepare(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, 0, 0)`).run(id, name, `${id}@x.com`);
  }
});

const account = (id: string): SessionUser => ({ id, email: `${id}@x.com`, name: id, emailVerified: true });
const session: Deps["session"] = async (c) => account(c.req.header("x-test-user") ?? "ann");
const app = createApi({ courses: [course], session, now: () => new Date(Date.UTC(2026, 10, 22, 0, 0, clock++)) });
const req = (u: string, path: string, method = "GET", body?: unknown) =>
  app.request(path, { method, headers: { "x-test-user": u, "Content-Type": "application/json" }, ...(body !== undefined && { body: JSON.stringify(body) }) }, env);

const add = (id: string, owner: string, status: CourseStatus, publishedAt: string | null = null) =>
  db.sqlite.prepare(`INSERT INTO user_courses (id, owner_id, title, lang, json, status, mode, levels, sources, published_at, created_at, updated_at)
    VALUES (?, ?, ?, 'en', ?, ?, 'web', 1, 3, ?, '2026-11-01', '2026-11-01')`).run(id, owner, `Course ${id}`, JSON.stringify({ ...raw, id }), status, publishedAt);
const status = (id: string) => (db.sqlite.prepare("SELECT status FROM user_courses WHERE id = ?").get(id) as { status: string }).status;

test("owner transitions return the meta and move the status", async () => {
  add("ua", "ann", "private");
  let res = await req("ann", "/courses/ua/share", "POST");
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ id: "ua", status: "link", mine: true, author: "Ann L.", mode: "web", levels: 1, sources: 3 } satisfies Partial<UserCourseMeta>);
  expect((await req("ann", "/courses/ua/publish", "POST")).status).toBe(200);
  expect(status("ua")).toBe("pending");
  res = await req("ann", "/courses/ua/unpublish", "POST");
  expect((await res.json()).status).toBe("private");
  expect((await req("ann", "/courses/ua/publish", "POST")).status).toBe(200); // private -> pending
  expect(status("ua")).toBe("pending");
});

test("illegal transitions are 409; other users get 403, or 404 on a private course", async () => {
  add("ua", "ann", "pending");
  expect((await req("ann", "/courses/ua/share", "POST")).status).toBe(409);
  expect((await req("ann", "/courses/ua/publish", "POST")).status).toBe(409);
  add("ub", "ann", "public", "2026-11-02");
  expect((await req("ann", "/courses/ub/publish", "POST")).status).toBe(409);
  expect((await req("bob", "/courses/ua/unpublish", "POST")).status).toBe(403);
  add("uc", "ann", "private");
  expect((await req("bob", "/courses/uc/share", "POST")).status).toBe(404);
  expect((await req("ann", "/courses/nope/share", "POST")).status).toBe(404);
  expect(status("ua")).toBe("pending");
});

test("rejected courses can be submitted again; publish clears the note", async () => {
  add("ua", "ann", "pending");
  expect((await req("boss", "/admin/courses/ua/reject", "POST", { note: "Wrong facts" })).status).toBe(204);
  expect((await (await req("ann", "/courses/ua/share", "POST")).json())).toMatchObject({ code: "invalid_request" });
  const res = await req("ann", "/courses/ua/publish", "POST");
  expect(await res.json()).toMatchObject({ status: "pending", reviewNote: null });
});

test("admin routes are 403 for non-admins", async () => {
  add("ua", "ann", "pending");
  for (const [path, method] of [["/admin/review", "GET"], ["/admin/courses/ua/approve", "POST"], ["/admin/courses/ua/reject", "POST"], ["/admin/flags/x/resolve", "POST"]]) {
    expect((await req("ann", path, method, method === "POST" ? { note: "n" } : undefined)).status).toBe(403);
  }
  env = { ...env, ADMIN_EMAILS: ["ann@x.com"] };
  const unverified = createApi({ courses: [course], session: async () => ({ ...account("ann"), emailVerified: false }) });
  expect((await unverified.request("/admin/review", {}, env)).status).toBe(403);
  expect(status("ua")).toBe("pending");
});

test("approve and reject move only pending courses; reject needs a note", async () => {
  add("ua", "ann", "pending");
  add("ub", "ann", "link");
  expect((await req("boss", "/admin/courses/ub/approve", "POST")).status).toBe(409);
  expect((await req("boss", "/admin/courses/nope/approve", "POST")).status).toBe(404);
  for (const note of [undefined, "", " ", "x".repeat(501)]) expect((await req("boss", "/admin/courses/ua/reject", "POST", { note })).status).toBe(400);
  expect((await req("boss", "/admin/courses/ua/approve", "POST")).status).toBe(204);
  const row = db.sqlite.prepare("SELECT status, published_at, reviewed_by, reviewed_at FROM user_courses WHERE id = 'ua'").get() as Record<string, string>;
  expect(row).toMatchObject({ status: "public", reviewed_by: "boss" });
  expect(row.published_at).toBe(row.reviewed_at);
  expect((await req("boss", "/admin/courses/ua/reject", "POST", { note: "late" })).status).toBe(409);
});

test("library lists public courses only, newest approval first, with the author", async () => {
  add("ua", "ann", "public", "2026-11-02");
  add("ub", "bob", "public", "2026-11-05");
  add("uc", "ann", "pending");
  add("ud", "ann", "link");
  const list: UserCourseMeta[] = await (await req("bob", "/library")).json();
  expect(list.map((m) => [m.id, m.author, m.mine])).toEqual([["ub", "Bob", true], ["ua", "Ann L.", false]]);
  await req("ann", "/courses/ua/unpublish", "POST");
  expect((await (await req("bob", "/library")).json()).map((m: UserCourseMeta) => m.id)).toEqual(["ub"]);
});

test("flags: validation, per-item counts in the queue, resolve clears the item", async () => {
  add("ua", "ann", "pending");
  const C = COURSES[0].id; // findCourse knows bundled courses
  for (const bad of [{}, { courseId: C, reason: "meh" }, { courseId: C, reason: "wrong", text: "x".repeat(501) }, { courseId: C, reason: "wrong", itemId: "" }]) {
    expect((await req("bob", "/flags", "POST", bad)).status).toBe(400);
  }
  expect((await req("bob", "/flags", "POST", { courseId: "missing", reason: "wrong" })).status).toBe(404);
  expect((await req("bob", "/flags", "POST", { courseId: C, itemId: `${C}:q`, reason: "wrong", text: " typo " })).status).toBe(201);
  expect((await req("ann", "/flags", "POST", { courseId: C, itemId: `${C}:q`, reason: "unclear" })).status).toBe(201);
  expect((await req("ann", "/flags", "POST", { courseId: C, itemId: `${C}:l1#0`, reason: "broken" })).status).toBe(201);
  expect((await req("ann", "/flags", "POST", { courseId: C, reason: "other" })).status).toBe(201);

  const q: ReviewQueue = await (await req("boss", "/admin/review")).json();
  expect(q.pending.map((m) => m.id)).toEqual(["ua"]);
  expect(q.flags.map((f) => [f.itemId, f.reason, f.count])).toEqual([[undefined, "other", 1], [`${C}:l1#0`, "broken", 1], [`${C}:q`, "unclear", 2]]);

  const item = q.flags.find((f) => f.itemId === `${C}:q`)!;
  expect((await req("boss", `/admin/flags/${item.id}/resolve`, "POST")).status).toBe(204);
  expect((await req("boss", "/admin/flags/nope/resolve", "POST")).status).toBe(404);
  const after: ReviewQueue = await (await req("boss", "/admin/review")).json();
  expect(after.flags.map((f) => f.itemId)).toEqual([undefined, `${C}:l1#0`]);
});

test("export writes a valid course.json for public courses only", async () => {
  add("ua", "ann", "public", "2026-11-02");
  add("ub", "ann", "pending");
  const root = mkdtempSync(join(tmpdir(), "export-"));
  const file = await exportCourse(db, "ua", root);
  expect(file).toBe(join(root, "ua", "course.json"));
  const written = JSON.parse(readFileSync(file, "utf8"));
  expect(written.id).toBe("ua");
  expect(validateCourse(written)).toEqual([]);
  await expect(exportCourse(db, "ub", root)).rejects.toThrow("not public");
  await expect(exportCourse(db, "nope", root)).rejects.toThrow("not found");
});
