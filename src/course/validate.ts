import { runKata, type TestResult } from "../code/runner";
import { runPythonKata } from "../code/runPython";
import { CourseSchema, formatIssues, type Kata } from "./schema";

/** Runs a kata's tests (tests + hidden) against code. An empty result skips that kata's run checks. */
export type Runner = (kata: Kata, code: string) => Promise<TestResult[]>;

const localRun = (k: Kata, code: string) => (k.lang === "python" ? runPythonKata : runKata)(code, [...k.tests, ...k.hidden]);

/**
 * Every problem with a course, one per line; empty when it is valid. Schema first, then each kata is run.
 * Without `run`, katas run in this process (the owner's own files: MCP, npm run validate). User-influenced courses pass a
 * sandboxed runner and get a Promise.
 */
export function validateCourse(raw: unknown): string[];
export function validateCourse(raw: unknown, run: Runner): Promise<string[]>;
export function validateCourse(raw: unknown, run?: Runner): string[] | Promise<string[]> {
  const r = CourseSchema.safeParse(raw);
  const schema = r.success ? [] : formatIssues(r.error).split("\n");
  const katas = r.success ? r.data.katas ?? [] : [];
  if (!run) return schema.length ? schema : katas.flatMap((k, i) => kataProblems(k, i, localRun(k, k.solution), localRun(k, k.starter)));
  if (schema.length) return Promise.resolve(schema);
  return (async () => {
    const out: string[] = [];
    for (const [i, k] of katas.entries()) out.push(...kataProblems(k, i, await run(k, k.solution), await run(k, k.starter))); // one child at a time
    return out;
  })();
}

function kataProblems(k: Kata, i: number, solution: TestResult[], starter: TestResult[]): string[] {
  if (!solution.length) return [];
  const out = solution.filter((x) => !x.pass).map((t) => `katas[${i}] (${k.id}): solution fails "${t.name}": ${t.error ?? `got ${t.got}, expected ${t.expected}`}`);
  const compileError = starter.find((x) => x.error?.startsWith("Compile error"));
  if (compileError) out.push(`katas[${i}] (${k.id}): starter does not compile: ${compileError.error}`);
  else if (starter.every((x) => x.pass)) out.push(`katas[${i}] (${k.id}): starter already passes every test`);
  return out;
}
