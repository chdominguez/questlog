import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Kata } from "../src/course/schema";
import { validateCourse } from "../src/course/validate";
import { childRunner, type KataRunner } from "./sandbox";

// The real child, bundled exactly as build:server does it.
const out = mkdtempSync(join(tmpdir(), "kata-build-"));
let run: KataRunner;
beforeAll(() => {
  execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--ssr", "server/kata-child.ts", "--outDir", out, "--logLevel", "error"], { env: { ...process.env, KATA: "1" } });
  run = childRunner(join(out, "kata-child.js"));
}, 60_000);
afterAll(() => rmSync(out, { recursive: true, force: true }));

const t = (name: string, code: string) => ({ name, code });
const kata: Kata = {
  id: "sum", title: "Sum", difficulty: "easy", statement: "Sum", examples: [{ input: "[1,2]", output: "3" }], complexity: "O(n)",
  starter: "function sum(xs: number[]): number { return 0; }",
  solution: "function sum(xs: number[]): number { return xs.reduce((a, b) => a + b, 0); }",
  tests: [t("a", "return eq(sum([1, 2]), 3)"), t("b", "return eq(sum([]), 0)"), t("c", "return eq(sum([5]), 5)")],
  hidden: [t("d", "return eq(sum([1, 1]), 2)"), t("e", "return eq(sum([2, 2]), 4)")],
};
const failsWith = async (code: string, re: RegExp) => {
  const r = await run(kata, code);
  expect(r).toHaveLength(5);
  expect(r.every((x) => !x.pass)).toBe(true);
  expect(r.map((x) => x.error ?? "").join("\n")).toMatch(re);
};

test("valid kata passes; starter fails without crashing", async () => {
  expect((await run(kata, kata.solution)).every((x) => x.pass)).toBe(true);
  const s = await run(kata, kata.starter);
  expect(s.map((x) => x.pass)).toEqual([false, true, false, false, false]);
  expect(s[0]).toMatchObject({ got: "0", expected: "3" });
});

test("a kata cannot read env, files or spawn", async () => {
  // The child's globals have no require; the escape route is the host function behind eq.
  const escape = (body: string) => `function sum(xs: number[]) { const p = (eq as any).constructor("return process")(); ${body} }`;
  const env = await run(kata, escape("return Object.keys(p.env).length;"));
  expect(env[1]).toMatchObject({ pass: true }); // empty env: 0 keys, the same as sum([])
  expect(env[0].got).toBe("0");
  await failsWith(escape(`return p.getBuiltinModule("fs").readFileSync("/etc/hostname", "utf8");`), /ERR_ACCESS_DENIED|denied|permission/i);
  await failsWith(escape(`return p.getBuiltinModule("child_process").execSync("id").toString();`), /ERR_ACCESS_DENIED|denied|permission/i);
}, 30_000);

test("a kata that loops forever or allocates without bound fails cleanly", async () => {
  await failsWith("function sum(xs: number[]): number { while (true) {} }", /timed out|Script execution/i);
  await failsWith("const junk: number[][] = []; while (true) junk.push(new Array(1e6).fill(1)); function sum() { return 0; }", /Kata run failed|Timed out/);
}, 30_000);

test("compile errors and python katas", async () => {
  await failsWith("function sum( {", /Compile error/);
  expect(await run({ ...kata, lang: "python" }, "def sum(xs): return 0")).toEqual([]);
});

test("validateCourse with the sandbox", async () => {
  const course = (k: Kata) => ({
    id: "c", title: "C", lang: "en", katas: [k],
    levels: [{ id: "l", order: 1, title: "L", theory: [], challenges: [{ id: "k", type: "kata", prompt: "P", kataId: "sum" }] }],
  });
  expect(await validateCourse(course(kata), run)).toEqual([]);
  expect((await validateCourse(course({ ...kata, solution: kata.starter }), run)).join()).toMatch(/solution fails "a"/);
  expect((await validateCourse({ id: "c" }, run)).length).toBeGreaterThan(0);
});
