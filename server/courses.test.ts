import { beforeEach, expect, test } from "vitest";
import type { UserCourseMeta } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { createApi, type Env } from "./api";
import { builderProblems, findCourse, newCourseId, saveUserCourse } from "./courses";
import { memoryDb } from "./db";
import { testEnv } from "./env";
import { as, course, fakeSandbox, json, kata, level, session } from "./fixtures.test-util";

let env: Env;
beforeEach(() => {
  const db = memoryDb();
  db.sqlite.exec(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u', 'Ada', 'u@x.com', 1, 0, 0), ('v', 'Bob', 'v@x.com', 1, 0, 0)`);
  env = testEnv(db);
});
const app = () => createApi({ session, sandbox: fakeSandbox });
const req = (path: string, init?: RequestInit) => app().request(path, init, env);
const save = (id: string, owner = "u") => saveUserCourse(env.DB, { owner, course: CourseSchema.parse(course(id)), mode: "topic" });
const setStatus = (id: string, s: string) => env.DB.tx((q) => q.run("UPDATE user_courses SET status = ? WHERE id = ?", s, id));

test("course id shape: u + 10 base36, slug, matches COURSE_DIR", () => {
  const id = newCourseId("Rust Ownership & Borrowing!");
  expect(id).toMatch(/^u[a-z0-9]{10}-rust-ownership-borrowing$/);
  expect(newCourseId("")).toMatch(/^u[a-z0-9]{10}-course$/);
});

test("access rule per status; private ids are not confirmed", async () => {
  const id = await save("ua-c");
  expect((await req(`/courses/${id}`, as("v"))).status).toBe(404);
  expect(await findCourse(env.DB, id, "v")).toBeNull();
  expect((await findCourse(env.DB, id, "u"))?.levels[0].id).toBe(`${id}:one`);
  for (const s of ["link", "pending", "public", "rejected"]) {
    setStatus(id, s);
    const res = await req(`/courses/${id}`, as("v"));
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"v1"');
    expect((await res.json()).id).toBe(id);
  }
  expect((await findCourse(env.DB, "http-basics", "v"))?.id).toBe("http-basics"); // static first
});

test("GET /courses lists own courses and courses opened by link, not other people's", async () => {
  const mine = await save("ua-mine");
  const theirs = await save("ub-theirs", "v");
  await save("uc-private", "v");
  setStatus(theirs, "link");
  expect((await (await req("/courses", as("u"))).json() as UserCourseMeta[]).map((c) => c.id)).toEqual([mine]);
  await req(`/courses/${theirs}`, as("u")); // opened by link
  const list = await (await req("/courses", as("u"))).json() as UserCourseMeta[];
  expect(list.map((c) => [c.id, c.mine, c.author]).sort()).toEqual([[mine, true, "Ada"], [theirs, false, "Bob"]]);
  setStatus(theirs, "private"); // made private again: gone from the opener's list
  expect((await (await req("/courses", as("u"))).json() as UserCourseMeta[]).map((c) => c.id)).toEqual([mine]);
});

test("PUT validates in the sandbox, keeps the id, bumps the version, sends public back to review", async () => {
  const id = await save("ud-c");
  setStatus(id, "public");
  expect((await req(`/courses/${id}`, as("v", json("PUT", course(id))))).status).toBe(403);
  const wrongId = await req(`/courses/${id}`, as("u", json("PUT", course("other"))));
  expect(wrongId.status).toBe(422);
  const bad = await req(`/courses/${id}`, as("u", json("PUT", course(id, { katas: [{ ...kata("k"), starter: kata("k").solution }], levels: [level("one", { kata: "k" })] }))));
  expect(bad.status).toBe(422);
  expect((await bad.json()).problems.join()).toMatch(/starter already passes/);
  const res = await req(`/courses/${id}`, as("u", json("PUT", course(id, { title: "New", users: ["a@b.co"] }))));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ id, title: "New", version: 2, status: "pending" });
  expect((await (await req(`/courses/${id}`, as("u"))).json()).users).toBeUndefined();
});

test("DELETE: owner only", async () => {
  const id = await save("ue-c");
  setStatus(id, "link");
  expect((await req(`/courses/${id}`, as("v", { method: "DELETE" }))).status).toBe(403);
  expect((await req(`/courses/${id}`, as("u", { method: "DELETE" }))).status).toBe(204);
  expect((await req(`/courses/${id}`, as("u"))).status).toBe(404);
});

test("builder rules: 3+ challenge types, no media, known sources, katas used", () => {
  const c = CourseSchema.parse(course("c"));
  expect(builderProblems(c, new Set())).toEqual([]);
  const mcq = { ...c, levels: [{ ...c.levels[0], challenges: c.levels[0].challenges.slice(0, 2) }] };
  expect(builderProblems(mcq, new Set()).join()).toMatch(/at least 3/);
  const cited = { ...c, levels: [level("one", { sources: [{ url: "https://made.up/x", title: "X" }] })] };
  expect(builderProblems(cited, new Set(["https://real.site/a"])).join()).toMatch(/not one of the given sources/);
  expect(builderProblems(cited, null)).toEqual([]);
  expect(builderProblems(c, new Set(), true).join()).toMatch(/cite at least one source/);
  expect(builderProblems({ ...c, katas: [kata("k")] }, new Set()).join()).toMatch(/no kata challenge uses it/);
  const media = { ...c, levels: [{ ...c.levels[0], theory: [{ title: "T", blocks: [{ kind: "media" as const, type: "image" as const, src: "a.png", alt: "A" }] }] }] };
  expect(builderProblems(media as never, new Set()).join()).toMatch(/media blocks/);
  expect(builderProblems({ ...c, art: { a: '<svg viewBox="0 0 1 1"></svg>' } }, new Set()).join()).toMatch(/inline art is not allowed/);
  const w = (model: string) => ({ ...c, levels: [{ ...c.levels[0], challenges: [...c.levels[0].challenges, { id: "w", type: "written" as const, prompt: "P", model, keyPoints: ["a", "b"] }] }] });
  expect(builderProblems(w("M"), new Set())).toEqual([]);
  expect(builderProblems(w("M".repeat(20_000)), new Set()).join()).toMatch(/levels\[0\]\.challenges\[3\]: .*under 20000/);
});
