import { expect, test } from "vitest";
import { CHALLENGES, COURSE_ERRORS, COURSES, courseById, coursesLoaded, markCoursesLoaded, registerCourses, subscribeCourses, unregisterCourse, visibleTo } from "./registry";
import { validateCourse } from "./validate";
import { CourseSchema } from "./schema";

const mods = import.meta.glob<{ default: unknown }>(["/courses/*/course.ts", "/courses/*/course.json", "@private/*/course.ts", "@private/*/course.json"], { eager: true });

test("every course file loads", () => {
  expect(COURSE_ERRORS).toEqual([]);
  expect(COURSES.length).toBe(Object.keys(mods).length);
});

test.each(Object.entries(mods))("%s is valid and its katas work", (_file, m) => {
  expect(validateCourse(m.default)).toEqual([]);
});

const course = (over: Record<string, unknown> = {}) => ({
  id: "t", title: "T", lang: "en",
  levels: [{ id: "l1", order: 1, title: "L", theory: [{ title: "C", blocks: [{ kind: "trace", lang: "ts", src: "a\nb", steps: [{ line: 1 }, { line: 2 }] }] }],
    challenges: [{ id: "q", type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 }] }],
  ...over,
});

test("multi challenges validate answers and truefalse shape", () => {
  const mk = (ch: object) => { const c = course(); (c.levels as any)[0].challenges = [{ id: "m", type: "multi", prompt: "P", ...ch }]; return validateCourse(c).join("\n"); };
  expect(mk({ options: ["a", "b", "c"], answers: [0, 2] })).toBe("");
  expect(mk({ options: ["True", "False"], answers: [0], style: "truefalse" })).toBe("");
  expect(mk({ options: ["a", "b", "c"], answers: [0, 0] })).toMatch(/unique/);
  expect(mk({ options: ["a", "b", "c"], answers: [3] })).toMatch(/only 3 options/);
  expect(mk({ options: ["a", "b"], answers: [0, 1] })).toMatch(/fewer than options/);
  expect(mk({ options: ["a", "b", "c"], answers: [0], style: "truefalse" })).toMatch(/truefalse needs/);
});

test("validation explains what is wrong and where", () => {
  expect(validateCourse(course())).toEqual([]);
  const bad = course();
  (bad.levels as any)[0].challenges.push({ id: "q", type: "quiz", prompt: "P", options: ["a"], answer: 3 });
  (bad.levels as any)[0].challenges.push({ id: "k", type: "kata", prompt: "P", kataId: "nope" });
  (bad.levels as any)[0].theory[0].blocks[0].steps[1].line = 9;
  const msgs = validateCourse(bad).join("\n");
  expect(msgs).toMatch(/levels\[0\]\.challenges\[1\]\.options/); // too few options
  expect(msgs).toMatch(/duplicate challenge id "q"/);
  expect(msgs).toMatch(/no kata "nope"/);
  expect(msgs).toMatch(/line 9 is past the end/);
  expect(CourseSchema.safeParse(course({ extra: 1 })).success).toBe(false);
});

test("match needs 3-8 pairs with unique sides", () => {
  const withMatch = (pairs: unknown[]) => {
    const c = course();
    (c.levels as any)[0].challenges.push({ id: "m", type: "match", prompt: "P", pairs });
    return validateCourse(c).join("\n");
  };
  const pair = (i: number) => ({ left: `l${i}`, right: `r${i}` });
  expect(withMatch([1, 2, 3].map(pair))).toBe("");
  expect(withMatch([1, 2].map(pair))).toMatch(/pairs/);
  expect(withMatch([1, 2, 3, 4, 5, 6, 7, 8, 9].map(pair))).toMatch(/pairs/);
  expect(withMatch([pair(1), pair(2), { left: "l1", right: "r3" }])).toMatch(/duplicate left item/);
  expect(withMatch([pair(1), pair(2), { left: "l3", right: "r2" }])).toMatch(/duplicate right item/);
});

test("sort buckets are checked", () => {
  const items = (bs: number[]) => bs.map((bucket) => ({ text: "x", bucket }));
  const sort = { id: "s", type: "sort", prompt: "P", buckets: ["a", "b"], items: items([0, 0, 1, 1]) };
  const withSort = (s: unknown) => course({ levels: [{ ...course().levels[0], challenges: [s] }] });
  expect(validateCourse(withSort(sort))).toEqual([]);
  expect(validateCourse(withSort({ ...sort, items: items([0, 0, 0, 5]) })).join("\n")).toMatch(/bucket 5 but only 2/);
  expect(validateCourse(withSort({ ...sort, items: items([0, 0, 0, 0]) })).join("\n")).toMatch(/bucket 1 has no items/);
});

test("flashcard needs a back and rejects extras", () => {
  const withCard = (card: Record<string, unknown>) => {
    const c = course();
    (c.levels as any)[0].challenges.push({ id: "f", type: "flashcard", prompt: "Front", ...card });
    return validateCourse(c);
  };
  expect(withCard({ back: "Back", explain: "Why" })).toEqual([]);
  expect(withCard({}).join("\n")).toMatch(/back/);
  expect(withCard({ back: "B", options: ["a", "b"] }).length).toBeGreaterThan(0);
});

test("python kata: solution passes, starter fails", () => {
  const kata = { id: "sum", title: "Sum", lang: "python", difficulty: "easy", statement: "S", examples: [{ input: "1", output: "1" }], complexity: "O(n)",
    starter: "def total(xs):\n    return 0", solution: "def total(xs):\n    return sum(xs)",
    tests: [1, 2, 3].map((n) => ({ name: `n${n}`, code: `return eq(total([${n}]), ${n})` })), hidden: [{ name: "h1", code: "return eq(total([]), 0)" }, { name: "h2", code: "return eq(total([2, 2]), 4)" }] };
  expect(validateCourse(course({ katas: [kata] }))).toEqual([]);
  expect(validateCourse(course({ katas: [{ ...kata, solution: kata.starter }] })).join()).toMatch(/solution fails "n1"/);
});

test("kata checks run the solution and the starter", () => {
  const kata = { id: "sum", title: "Sum", difficulty: "easy", statement: "S", examples: [{ input: "1", output: "1" }], complexity: "O(n)",
    starter: "export function sum(xs: number[]): number { return 0; }",
    solution: "export function sum(xs: number[]): number { return xs.reduce((a, b) => a + b, 0); }",
    tests: [1, 2, 3].map((n) => ({ name: `n${n}`, code: `return eq(sum([${n}, 1]), ${n + 1})` })),
    hidden: [4, 5].map((n) => ({ name: `h${n}`, code: `return eq(sum([${n}]), ${n})` })) };
  expect(validateCourse(course({ katas: [kata] }))).toEqual([]);
  expect(validateCourse(course({ katas: [{ ...kata, solution: kata.starter }] })).join()).toMatch(/solution fails "n1"/);
  expect(validateCourse(course({ katas: [{ ...kata, starter: kata.solution }] })).join()).toMatch(/starter already passes/);
});

test("cloze markers and bank are cross-checked", () => {
  const cz = (over: Record<string, unknown>) => course({ levels: [{ ...course().levels[0], challenges: [{ id: "c", type: "cloze", prompt: "P", text: "a {{1}} b {{2}}", blanks: [{ answers: ["x"] }, { answers: ["y"] }], ...over }] }] });
  expect(validateCourse(cz({}))).toEqual([]);
  expect(validateCourse(cz({ text: "a {{1}} b {{3}}" })).join()).toMatch(/markers must be/);
  expect(validateCourse(cz({ text: "a {{1}}" })).join()).toMatch(/markers must be/);
  expect(validateCourse(cz({ bank: ["x", "z"] })).join()).toMatch(/"y" is not in bank/);
});

test("visibleTo: courses with users show only to them, case-insensitive", () => {
  const [a, b] = COURSES;
  const cs = [{ ...a, users: ["Me@X.com"] }, { ...b, users: undefined }];
  expect(visibleTo("me@x.com", cs)).toEqual(cs);
  expect(visibleTo("other@x.com", cs)).toEqual([cs[1]]);
});

test("drill and practice blocks validate like challenges", () => {
  const mk = (block: object) => { const c = course(); (c.levels as any)[0].theory[0].blocks.push(block); return validateCourse(c).join("\n"); };
  const pairs = [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "c", right: "3" }];
  expect(mk({ kind: "drill", pairs })).toBe("");
  expect(mk({ kind: "drill", pairs: [...pairs, { left: "a", right: "4" }] })).toMatch(/duplicate left/);
  expect(mk({ kind: "practice", challenge: { id: "p", type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 } })).toBe("");
  expect(mk({ kind: "practice", challenge: { id: "p", type: "quiz", prompt: "P", options: ["a", "b"], answer: 5 } })).toMatch(/challenge\.answer: answer 5/);
  expect(mk({ kind: "practice", challenge: { id: "q", type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 } })).toMatch(/duplicate challenge id "q"/);
  expect(mk({ kind: "practice", challenge: { id: "p", type: "flashcard", prompt: "P", back: "B" } })).toMatch(/practice challenge type/);
});

test("registerCourses skips invalid and bundled ids, replaces, fills CHALLENGES; unregisterCourse removes", () => {
  const bundled = COURSES[0];
  const before = COURSES.length;
  let calls = 0;
  const stop = subscribeCourses(() => calls++);
  registerCourses([{ id: "bad" }, course({ id: bundled.id, title: "Shadow" }), course({ id: "rt", title: "Runtime" })]);
  expect(calls).toBe(1);
  expect(COURSES.length).toBe(before + 1);
  expect(courseById(bundled.id)?.title).toBe(bundled.title);
  expect(courseById("bad")).toBeUndefined();
  expect(courseById("rt")?.levels[0].id).toBe("rt:l1");
  expect(CHALLENGES["rt:q"]).toMatchObject({ type: "quiz", levelId: "rt:l1" });

  const c2 = course({ id: "rt", title: "Runtime 2" });
  (c2.levels as any)[0].challenges = [{ id: "q2", type: "quiz", prompt: "P", options: ["a", "b"], answer: 1 }];
  registerCourses([c2]);
  expect(COURSES.length).toBe(before + 1);
  expect(courseById("rt")?.title).toBe("Runtime 2");
  expect(CHALLENGES["rt:q"]).toBeUndefined();
  expect(CHALLENGES["rt:q2"]).toBeDefined();

  unregisterCourse(bundled.id);
  expect(courseById(bundled.id)).toBeDefined();
  unregisterCourse("rt");
  expect(courseById("rt")).toBeUndefined();
  expect(CHALLENGES["rt:q2"]).toBeUndefined();
  expect(COURSES.length).toBe(before);
  stop();
});

test("coursesLoaded flips once", () => {
  expect(coursesLoaded()).toBe(false);
  markCoursesLoaded();
  markCoursesLoaded();
  expect(coursesLoaded()).toBe(true);
});
