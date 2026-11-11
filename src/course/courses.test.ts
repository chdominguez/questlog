import { expect, test } from "vitest";
import { COURSE_ERRORS, COURSES } from "./registry";
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
