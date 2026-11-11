import { runKata } from "../code/runner";
import { CourseSchema, formatIssues, type CourseInput } from "./schema";

/** Every problem with a course, one per line; empty when it is valid. Schema first, then each kata is run. */
export function validateCourse(raw: unknown): string[] {
  const r = CourseSchema.safeParse(raw);
  if (!r.success) return formatIssues(r.error).split("\n");
  return kataProblems(r.data);
}

function kataProblems(c: CourseInput): string[] {
  const out: string[] = [];
  (c.katas ?? []).forEach((k, i) => {
    const all = [...k.tests, ...k.hidden];
    for (const t of runKata(k.solution, all).filter((x) => !x.pass)) {
      out.push(`katas[${i}] (${k.id}): solution fails "${t.name}": ${t.error ?? `got ${t.got}, expected ${t.expected}`}`);
    }
    const starter = runKata(k.starter, all);
    const compileError = starter.find((x) => x.error?.startsWith("Compile error"));
    if (compileError) out.push(`katas[${i}] (${k.id}): starter does not compile: ${compileError.error}`);
    else if (starter.every((x) => x.pass)) out.push(`katas[${i}] (${k.id}): starter already passes every test`);
  });
  return out;
}
