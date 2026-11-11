import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { listCourses, saveCourse, type Roots } from "./courses";

const course = (id = "t") => ({
  id, title: "T", lang: "en",
  levels: [{ id: `${id}-l1`, order: 1, title: "L", theory: [], challenges: [{ id: `${id}-q`, type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 }] }],
});

const roots = (): Roots => {
  const dir = mkdtempSync(join(tmpdir(), "questlog-mcp-"));
  return { public: join(dir, "courses"), private: join(dir, "private") };
};

test("saves a valid course as JSON and lists it", async () => {
  const r = roots();
  expect(saveCourse(course("a"), "private", false, r)).toEqual({ path: join(r.private, "a", "course.json") });
  expect(JSON.parse(readFileSync(join(r.private, "a", "course.json"), "utf8"))).toEqual(course("a"));
  expect(saveCourse(course("b"), "public", false, r)).toEqual({ path: join(r.public, "b", "course.json") });
  const list = await listCourses(r);
  expect(list).toHaveLength(2);
  expect(list).toContainEqual({ id: "a", title: "T", lang: "en", levels: 1, katas: 0, file: join(r.private, "a", "course.json"), visibility: "private" });
});

test("refuses an invalid course with the problem list and writes nothing", async () => {
  const r = roots();
  const bad = { ...course(), id: "Bad Id" };
  bad.levels[0].challenges[0].answer = 5;
  const res = saveCourse(bad, "public", false, r);
  expect("error" in res && res.error).toMatch(/^Course is invalid[^]*\nid: lowercase[^]*levels\[0\]\.challenges\[0\]\.answer: answer 5 but only 2 options/);
  expect(await listCourses(r)).toEqual([]);
});

test("overwrites a course.json only when asked", () => {
  const r = roots();
  saveCourse(course(), "private", false, r);
  expect(saveCourse({ ...course(), title: "New" }, "private", false, r)).toEqual({ error: expect.stringContaining("overwrite: true") });
  expect(saveCourse({ ...course(), title: "New" }, "private", true, r)).toHaveProperty("path");
  expect(JSON.parse(readFileSync(join(r.private, "t", "course.json"), "utf8")).title).toBe("New");
});

test("never replaces a course.ts or duplicates an id across roots", () => {
  const r = roots();
  mkdirSync(join(r.private, "t"), { recursive: true });
  writeFileSync(join(r.private, "t", "course.ts"), "export default {}");
  expect(saveCourse(course(), "private", true, r)).toEqual({ error: expect.stringContaining("TypeScript course") });
  saveCourse(course("p"), "public", false, r);
  expect(saveCourse(course("p"), "private", true, r)).toEqual({ error: expect.stringContaining("already exists as a public course") });
});
